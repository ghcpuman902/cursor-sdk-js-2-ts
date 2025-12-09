import { CursorAgent, type WorkingLocation } from "@cursor-ai/january";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

// Store agent instances by session ID for multi-turn conversations
const agentSessions = new Map<
  string,
  { agent: CursorAgent; lastAccess: number; workingDirectory: string }
>();

// Clean up old sessions (older than 30 minutes)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const cleanupSessions = () => {
  const now = Date.now();
  for (const [sessionId, session] of agentSessions) {
    if (now - session.lastAccess > SESSION_TIMEOUT_MS) {
      console.log("Cleaning up old session:", sessionId);
      agentSessions.delete(sessionId);
    }
  }
};

// Global error handlers for unhandled rejections from SDK
if (typeof process !== "undefined") {
  // Remove existing handlers to avoid duplicates
  process.removeAllListeners("unhandledRejection");
  
  process.on("unhandledRejection", (reason, promise) => {
    console.error("=== UNHANDLED REJECTION IN AGENT ===");
    console.error("Reason:", reason);
    if (reason instanceof Error) {
      console.error("Message:", reason.message);
      console.error("Stack:", reason.stack);
      
      // Check if it's an HTTP/2 error
      if (reason.message.includes("NGHTTP2") || reason.message.includes("HTTP2")) {
        console.error("This is an HTTP/2 connection error from the Cursor SDK");
        console.error("The agent's connection to Cursor API was interrupted");
      }
    }
    console.error("Promise:", promise);
    console.error("=================================");
    // Don't crash the process, just log it
  });
}

export async function POST(req: Request) {
  try {
    const {
      message,
      model = "claude-4-sonnet",
      sessionId: existingSessionId,
      workingDirectory,
    } = await req.json();

    console.log("=== AGENT REQUEST START ===");
    console.log("Message:", message?.substring(0, 100) + "...");
    console.log("Model:", model);
    console.log("Session ID:", existingSessionId || "NEW");
    console.log("Working Directory:", workingDirectory);

    if (!message) {
      console.error("ERROR: No message provided");
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.CURSOR_API_KEY;
    if (!apiKey) {
      console.error("ERROR: CURSOR_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "CURSOR_API_KEY not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Clean up old sessions periodically
    cleanupSessions();
    console.log("Active sessions:", agentSessions.size);

    let sessionId: string;
    let agent: CursorAgent;
    
    // Use provided workingDirectory or fall back to cwd
    const directory = workingDirectory || process.cwd();

    console.log("=== WORKSPACE DIRECTORY CHECK ===");
    console.log("Requested directory:", directory);
    console.log("Existing sessionId:", existingSessionId);
    
    // Check if we can reuse an existing session
    // NEW APPROACH: All agents have broad filesystem access (from HOME)
    // We only reuse sessions for multi-turn conversations in the SAME repo
    const canReuseSession = 
      existingSessionId && 
      agentSessions.has(existingSessionId) &&
      agentSessions.get(existingSessionId)!.workingDirectory === directory;

    console.log("Can reuse session?", canReuseSession);
    if (existingSessionId && agentSessions.has(existingSessionId)) {
      console.log("Existing session directory:", agentSessions.get(existingSessionId)!.workingDirectory);
      console.log("Directories match?", agentSessions.get(existingSessionId)!.workingDirectory === directory);
      console.log("Note: All agents have broad access, but sessions are repo-specific for conversation context");
    }

    if (canReuseSession) {
      sessionId = existingSessionId;
      const session = agentSessions.get(sessionId)!;
      agent = session.agent;
      session.lastAccess = Date.now();
      console.log("✅ REUSING SESSION:", sessionId);
      console.log("Session working directory:", session.workingDirectory);
    } else {
      // Create a new agent with a new workspace
      sessionId = randomUUID();

      console.log("🆕 CREATING NEW AGENT SESSION:", sessionId);
      console.log("New agent working directory:", directory);
      console.log("⚠️ This should trigger Cursor IDE workspace permission prompt!");

      const workingLocation: WorkingLocation = {
        type: "local",
        localDirectory: directory,
      };

      // Don't set localDirectory at all - this gives unrestricted filesystem access
      // The agent can access anywhere, and we'll use shell commands with explicit paths
      const broadWorkingLocation: WorkingLocation = {
        type: "local",
        // localDirectory is optional - omitting it gives unrestricted access
      };

      console.log("Creating CursorAgent with UNRESTRICTED filesystem access");
      console.log("Agent will be told to work in:", directory);

      // Create the agent with unrestricted filesystem access
      agent = new CursorAgent({
        apiKey,
        model,
        workingLocation: broadWorkingLocation,
      });

      console.log("✅ CursorAgent instance created with unrestricted filesystem access");

      agentSessions.set(sessionId, {
        agent,
        lastAccess: Date.now(),
        workingDirectory: directory,
      });
      
      console.log("Agent session stored. Total sessions:", agentSessions.size);
    }
    console.log("=================================");

    console.log("Submitting message to agent...");
    
    // Get the session's working directory
    const sessionDirectory = agentSessions.get(sessionId)!.workingDirectory;
    
    // Prepend STRONG working directory context with ABSOLUTE PATH instructions
    const contextualMessage = `🚨 CRITICAL: REPOSITORY LOCATION 🚨

The repository you need to work on is located at this ABSOLUTE PATH:
${sessionDirectory}

⚠️ MANDATORY INSTRUCTIONS:
1. You have UNRESTRICTED filesystem access - you can access any directory
2. The target repository is at: ${sessionDirectory}
3. You are NOT currently in that directory - you need to navigate to it or use absolute paths
4. For ALL file operations (ls, read, write, grep, etc.), use the ABSOLUTE PATH: ${sessionDirectory}
5. For shell commands, ALWAYS cd into the directory first: "cd ${sessionDirectory} && your-command"
6. Example: To list files, use: "cd ${sessionDirectory} && ls" or use absolute path
7. Example: To read package.json, use: "${sessionDirectory}/package.json" as the path
8. Do NOT use relative paths - ALWAYS use the full absolute path: ${sessionDirectory}

TARGET REPOSITORY PATH: ${sessionDirectory}

Now, please fulfill the user's request for the repository at ${sessionDirectory}:

${message}`;
    
    console.log("Sending message with ABSOLUTE PATH instructions for:", sessionDirectory);
    const { stream } = agent.submit({ message: contextualMessage });
    console.log("Stream created successfully");

    // Create a Server-Sent Events stream
    const encoder = new TextEncoder();
    let updateCount = 0;
    const readableStream = new ReadableStream({
      async start(controller) {
        // Track if we've sent an error or done message
        let streamClosed = false;
        
        const sendError = (error: unknown) => {
          if (streamClosed) return;
          streamClosed = true;
          
          console.error("=== STREAM ERROR ===");
          console.error("Error type:", error?.constructor?.name);
          console.error("Error details:", error);
          console.error("Stack:", error instanceof Error ? error.stack : "N/A");
          
          // Extract meaningful error message
          let errorMessage = "Unknown error";
          if (error instanceof Error) {
            errorMessage = error.message;
            // Check for HTTP/2 errors
            if (error.message.includes("NGHTTP2") || error.message.includes("HTTP2")) {
              errorMessage = "Connection to Cursor API lost. The agent may have timed out or encountered an internal error.";
            }
          }
          
          const errorData = JSON.stringify({
            type: "error",
            text: errorMessage,
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        };

        try {
          console.log("=== STREAM START ===");
          // Send session ID first so client can track conversation
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "session", sessionId })}\n\n`
            )
          );
          console.log("Sent session ID:", sessionId);

          // Add timeout to detect stuck streams
          const streamTimeout = setTimeout(() => {
            console.error("=== STREAM TIMEOUT (5 minutes) ===");
            sendError(new Error("Agent stream timed out after 5 minutes"));
          }, 5 * 60 * 1000); // 5 minutes

          try {
            for await (const update of stream) {
              updateCount++;
              console.log(`[Update #${updateCount}]`, update.type, 
                'callId' in update ? `(${update.callId})` : "",
                'text' in update ? `"${update.text.substring(0, 50)}..."` : ""
              );
              
              // Send each update as a JSON line
              const data = JSON.stringify(update);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            clearTimeout(streamTimeout);
            await stream.done;
            
            if (!streamClosed) {
              console.log("=== STREAM COMPLETE ===");
              console.log("Total updates:", updateCount);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
              );
              streamClosed = true;
              controller.close();
            }
          } catch (streamError) {
            clearTimeout(streamTimeout);
            console.error("=== ERROR DURING STREAM ITERATION ===");
            console.error("Stream error:", streamError);
            sendError(streamError);
          }
        } catch (error) {
          console.error("=== ERROR IN STREAM SETUP ===");
          console.error("Setup error:", error);
          sendError(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("=== AGENT REQUEST ERROR ===");
    console.error("Error:", error);
    console.error("Stack:", error instanceof Error ? error.stack : "N/A");
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// GET - Get info about active sessions
export async function GET() {
  return new Response(
    JSON.stringify({
      activeSessions: agentSessions.size,
      sessions: Array.from(agentSessions.entries()).map(([id, session]) => ({
        id,
        workingDirectory: session.workingDirectory,
        lastAccess: new Date(session.lastAccess).toISOString(),
      })),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// DELETE - Kill all agent sessions
export async function DELETE() {
  try {
    console.log("=== KILLING ALL AGENT SESSIONS ===");
    console.log("Active sessions before:", agentSessions.size);
    
    agentSessions.clear();
    
    console.log("Active sessions after:", agentSessions.size);
    console.log("All agent sessions terminated");
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "All agent sessions terminated" 
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error killing agents:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

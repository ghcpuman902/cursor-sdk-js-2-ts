import { CursorAgent, ToolCall, type WorkingLocation } from "@cursor-ai/january";
import { randomUUID } from "crypto";
import { homedir } from "os";
import { dbOperations } from "@/lib/db";
import type { AgentTask, ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 600;

// Store agent instances by session ID for multi-turn conversations
const agentSessions = new Map<  
  string,
  { 
    agent: CursorAgent; 
    lastAccess: number; 
    workingDirectory: string;
    currentController?: ReadableStreamDefaultController;
    currentSubmission?: { cancel: () => void }; // Store submission for cancellation
    isSubmitting: boolean;
  }
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
  let sessionIdForCleanup: string | null = null;
  
  try {
    const {
      message,
      model = "claude-4.5-sonnet",
      sessionId: existingSessionId,
      workingDirectory,
      taskId, // NEW: Accept taskId to link with database
    } = await req.json();

    console.log("=== AGENT REQUEST START ===");
    console.log("Message:", message?.substring(0, 100) + "...");
    console.log("Model:", model);
    console.log("Session ID:", existingSessionId || "NEW");
    console.log("Working Directory:", workingDirectory);
    console.log("Task ID:", taskId || "NONE");

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
    // DESIGN: All agents have broad filesystem access from ~/home directory
    // This allows them to work on any repo under the user's home folder
    // We only reuse sessions for multi-turn conversations in the SAME repo
    // (different repos need different sessions for proper context isolation)
    const canReuseSession = 
      existingSessionId && 
      agentSessions.has(existingSessionId) &&
      agentSessions.get(existingSessionId)!.workingDirectory === directory;

    console.log("Can reuse session?", canReuseSession);
    if (existingSessionId && agentSessions.has(existingSessionId)) {
      console.log("Existing session directory:", agentSessions.get(existingSessionId)!.workingDirectory);
      console.log("Directories match?", agentSessions.get(existingSessionId)!.workingDirectory === directory);
      console.log("Note: All agents have broad access from ~/, but sessions are repo-specific for conversation context");
    }

    if (canReuseSession) {
      sessionId = existingSessionId;
      sessionIdForCleanup = sessionId;
      const session = agentSessions.get(sessionId)!;
      agent = session.agent;
      session.lastAccess = Date.now();
      console.log("✅ REUSING SESSION:", sessionId);
      console.log("Session working directory:", session.workingDirectory);
      
      // Check if agent is currently submitting
      if (session.isSubmitting) {
        console.log("⚠️ Agent is currently busy with another submission");
        console.log("🛑 Attempting to FORCE-STOP previous submission");
        
        // Try to cancel the SDK submission first (preserves conversation history)
        if (session.currentSubmission && typeof session.currentSubmission.cancel === 'function') {
          try {
            console.log("Calling submission.cancel() to stop current processing...");
            session.currentSubmission.cancel();
            console.log("✅ Submission cancelled via SDK cancel() method");
          } catch (cancelError) {
            console.log("⚠️ Failed to cancel via SDK:", cancelError);
          }
        }
        
        // FORCE close the stream to notify client
        if (session.currentController) {
          try {
            session.currentController.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ 
                  type: "error", 
                  text: "Submission interrupted - new request received" 
                })}\n\n`
              )
            );
            session.currentController.close();
            console.log("✅ Stream controller closed");
          } catch (e) {
            console.log("⚠️ Previous controller already closed:", e);
          }
          session.currentController = undefined;
        }
        
        // FORCE clean up - don't wait for SDK
        session.currentSubmission = undefined;
        session.isSubmitting = false;
        
        // Give the SDK a brief moment to clean up
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log("✅ Previous submission FORCE-STOPPED - ready for new input");
      }
    } else {
      // Create a new agent with a new workspace
      // Use the provided sessionId (deterministic) or generate a random one
      sessionId = existingSessionId || randomUUID();
      sessionIdForCleanup = sessionId;

      console.log("🆕 CREATING NEW AGENT SESSION:", sessionId);
      console.log("Session ID source:", existingSessionId ? "Deterministic (from repo+prompt)" : "Random");
      console.log("New agent working directory:", directory);
      console.log("⚠️ This should trigger Cursor IDE workspace permission prompt!");

      // INTENTIONAL: Set working location to user's home directory (~/)
      // This gives the agent BROAD filesystem access to all repos under home directory
      // The agent can access any subdirectory (e.g., ~/dev/*, ~/projects/*, etc.)
      // We'll use absolute paths in prompts to tell the agent which specific repo to work on
      const userHome = homedir(); // Gets ~/Users/username on Mac, C:\Users\username on Windows
      const broadWorkingLocation: WorkingLocation = {
        type: "local",
        localDirectory: userHome, // Explicitly set to home directory for broad access
      };

      console.log("Creating CursorAgent with BROAD filesystem access from home directory");
      console.log("Home directory (working location):", userHome);
      console.log("Agent will be told to work in:", directory);
      console.log("This allows agent to access any repo under ~/");

      // Create the agent with broad filesystem access from home directory
      agent = new CursorAgent({
        apiKey,
        model,
        workingLocation: broadWorkingLocation,
      });

      console.log("✅ CursorAgent instance created with broad filesystem access from:", userHome);

      agentSessions.set(sessionId, {
        agent,
        lastAccess: Date.now(),
        workingDirectory: directory,
        isSubmitting: false,
      });
      
      console.log("Agent session stored. Total sessions:", agentSessions.size);
    }
    console.log("=================================");
    
    // Load task from database for message persistence
    let task: AgentTask | null = null;
    if (taskId) {
      task = dbOperations.getTask(taskId);
      if (task) {
        console.log("✅ Loaded task from database:", taskId);
        console.log("Existing messages:", task.messages.length);
        console.log("Task status:", task.status);
      } else {
        console.warn("⚠️ Task ID provided but not found in database:", taskId);
        console.warn("Messages will not be persisted!");
      }
    } else {
      console.warn("⚠️ No taskId provided - messages will not be persisted");
    }
    
    // Mark agent as submitting
    const session = agentSessions.get(sessionId)!;
    session.isSubmitting = true;

    console.log("Submitting message to agent...");
    
    // Get the session's working directory
    const sessionDirectory = agentSessions.get(sessionId)!.workingDirectory;
    
    // Determine if this is the first message in the session
    const isFirstMessage = !canReuseSession;
    
    // Only prepend contextual instructions on FIRST message of a new session
    // For follow-up messages, send plain message to maintain conversation flow
    let contextualMessage: string;
    
    if (isFirstMessage) {
      console.log("🆕 First message in session - sending contextual instructions");
      contextualMessage = `🚨 CRITICAL: REPOSITORY LOCATION 🚨

The repository you need to work on is located at this ABSOLUTE PATH:
${sessionDirectory}

⚠️ MANDATORY INSTRUCTIONS:
1. You have BROAD filesystem access from the home directory (~/) - you can access any repo under home
2. The target repository is at: ${sessionDirectory}
3. You are NOT currently in that directory - you need to navigate to it or use absolute paths every time you run any commands
4. For ALL file operations (ls, read, write, grep, etc.), use the ABSOLUTE PATH: ${sessionDirectory}
5. For shell commands, ALWAYS cd into the directory first: "cd ${sessionDirectory} && your-command"
6. Example: To list files, use: "cd ${sessionDirectory} && ls" or use absolute path
7. Example: To read package.json, use: "${sessionDirectory}/package.json" as the path
8. Do NOT use relative paths - ALWAYS use the full absolute path: ${sessionDirectory}

TARGET REPOSITORY PATH: ${sessionDirectory}

Now, please fulfill the user's request for the repository at ${sessionDirectory}:

${message}`;
    } else {
      console.log("🔄 Follow-up message in existing session - sending plain message");
      contextualMessage = message;
    }
    
    console.log("Sending message for:", sessionDirectory);
    
    let submission;
    let stream;
    try {
      submission = agent.submit({ message: contextualMessage });
      stream = submission.stream;
      
      // Store submission for potential cancellation (like Cursor IDE stop button)
      session.currentSubmission = submission as unknown as { cancel: () => void };
      console.log("Stream created successfully, submission stored for cancellation");
    } catch (submitError) {
      // Handle agent busy error - if still busy, FORCE clear the session
      if (submitError instanceof Error && submitError.message.includes("Agent busy")) {
        console.error("❌ Agent is STILL busy after force-stop attempt");
        console.error("🔥 DESTROYING session to break the deadlock");
        
        // NUCLEAR OPTION: Delete the session entirely
        agentSessions.delete(sessionId);
        console.log("💥 Session destroyed. Client should retry with new session.");
        
        return new Response(
          JSON.stringify({
            error: "Agent was stuck. Session cleared. Please retry your request.",
            sessionCleared: true,
          }),
          { 
            status: 409, // Conflict
            headers: { "Content-Type": "application/json" } 
          }
        );
      }
      throw submitError; // Re-throw other errors
    }

    // Create a Server-Sent Events stream
    const encoder = new TextEncoder();
    let updateCount = 0;
    const readableStream = new ReadableStream({
      async start(controller) {
        // Store controller in session for potential cancellation
        const session = agentSessions.get(sessionId);
        if (session) {
          session.currentController = controller;
        }
        
        // Track if we've sent an error or done message
        let streamClosed = false;
        
        // Track current message being built for database persistence
        let currentUserMessage: ChatMessage | null = null;
        let currentAssistantMessage: ChatMessage | null = null;
        let totalTokens = task?.tokenCount || 0;
        
        // Create user message at the start
        if (task) {
          currentUserMessage = {
            id: `msg-${randomUUID()}`,
            role: 'user',
            content: message,
            createdAt: Date.now(),
            metadata: {
              lastUpdateTime: Date.now(),
            } as { lastUpdateTime: number },
          } as ChatMessage;
          console.log("📝 Created user message:", currentUserMessage.id);
        }
        
        // Helper to save current state to database
        const saveToDatabase = () => {
          if (!task) return;
          
          try {
            // Build updated messages array
            const updatedMessages = [...task.messages];
            
            // Add user message if exists and not already in task
            if (currentUserMessage && !updatedMessages.find(m => m.id === currentUserMessage!.id)) {
              updatedMessages.push(currentUserMessage);
            }
            
            // Add or update assistant message
            if (currentAssistantMessage) {
              const existingIdx = updatedMessages.findIndex(m => m.id === currentAssistantMessage!.id);
              if (existingIdx >= 0) {
                updatedMessages[existingIdx] = { ...currentAssistantMessage };
              } else {
                updatedMessages.push({ ...currentAssistantMessage });
              }
            }
            
            // Update task
            task.messages = updatedMessages;
            task.tokenCount = totalTokens;
            task.lastActivityTime = Date.now();
            
            dbOperations.updateTask(task);
            console.log("💾 Saved to database - Messages:", task.messages.length, "Tokens:", totalTokens);
          } catch (saveError) {
            console.error("❌ Failed to save to database:", saveError);
          }
        };
        
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
          
          // Save error state to database
          if (task && currentAssistantMessage) {
            task.status = 'failed';
            task.error = errorMessage;
            currentAssistantMessage.isStreaming = false;
            // Add error to assistant message content if empty
            if (!currentAssistantMessage.content) {
              currentAssistantMessage.content = `Error: ${errorMessage}`;
            }
            saveToDatabase();
            console.log("💾 Error state saved to database");
          }
          
          const errorData = JSON.stringify({
            type: "error",
            text: errorMessage,
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
          
          // Clean up session state
          const session = agentSessions.get(sessionId);
          if (session) {
            session.isSubmitting = false;
            session.currentController = undefined;
            session.currentSubmission = undefined;
          }
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
          let lastUpdateTime = Date.now();
          const streamTimeout = setTimeout(() => {
            console.error("=== STREAM TIMEOUT (5 minutes) ===");
            sendError(new Error("Agent stream timed out after 5 minutes"));
          }, 10 * 60 * 1000); // 10 minutes

          // Also add a heartbeat to detect if updates stop coming
          const heartbeatInterval = setInterval(() => {
            const timeSinceLastUpdate = Date.now() - lastUpdateTime;
            const secondsStuck = Math.floor(timeSinceLastUpdate / 1000);
            
            if (timeSinceLastUpdate > 60000) { // 1 minute with no updates
              console.warn(`⚠️ No updates for ${secondsStuck}s - stream may be stuck`);
              console.warn(`Last update count: ${updateCount}`);
            }
            
            // AUTO-KILL if stuck for 5 minutes (SDK is probably hung)
            if (timeSinceLastUpdate > 300000) { // 5*60 seconds = 5 minutes
              console.error(`🔥 AGENT HUNG FOR 5 MINUTES - FORCE KILLING`);
              console.error(`Last update was at count ${updateCount}`);
              clearInterval(heartbeatInterval);
              clearTimeout(streamTimeout);
              
              // Try to cancel SDK submission
              const currentSession = agentSessions.get(sessionId);
              if (currentSession?.currentSubmission && typeof currentSession.currentSubmission.cancel === 'function') {
                try {
                  currentSession.currentSubmission.cancel();
                } catch (e) {
                  console.error("Failed to cancel hung submission:", e);
                }
              }
              
              // Send error and close stream
              sendError(new Error("Agent hung for 5 minutes with no updates. Task cancelled."));
            }
          }, 5000); // Check every 5 seconds

          try {
            for await (const update of stream) {
              lastUpdateTime = Date.now(); // Reset heartbeat timer
              updateCount++;
              
              // Log update with more details
              const logDetails: string[] = [update.type];
              if ('callId' in update && update.callId) {
                logDetails.push(`callId: ${update.callId}`);
              }
              if ('text' in update && update.text) {
                logDetails.push(`text: "${String(update.text).substring(0, 50)}..."`);
              }
              if (update.type === 'tool-call-started' && 'toolCall' in update) {
                logDetails.push(`tool: ${update.toolCall?.type}`);
              }
              if (update.type === 'tool-call-completed' && 'toolCall' in update) {
                const status = update.toolCall?.result?.status || 'unknown';
                logDetails.push(`result: ${status}`);
              }
              
              console.log(`[Update #${updateCount}]`, logDetails.join(' | '));
              
              // Process update and build messages for database persistence
              if (task) {
                if (update.type === 'thinking-delta') {
                  // Start or continue assistant message with thinking
                  if (!currentAssistantMessage) {
                    currentAssistantMessage = {
                      id: `msg-${randomUUID()}`,
                      role: 'assistant',
                      content: '',
                      createdAt: Date.now(),
                      isStreaming: true,
                      metadata: {
                        thinking: update.text || '',
                        toolCalls: {},
                        summaries: [],
                        lastUpdateTime: Date.now(),
                      } as { thinking: string; toolCalls: Record<string, ToolCall>; summaries: string[]; lastUpdateTime: number },
                    } as ChatMessage;
                  } else {
                    if (!currentAssistantMessage.metadata) {
                      currentAssistantMessage.metadata = { toolCalls: {}, summaries: [] };
                    }
                    currentAssistantMessage.metadata.thinking = (currentAssistantMessage.metadata.thinking || '') + (update.text || '');
                    (currentAssistantMessage.metadata as { lastUpdateTime: number }).lastUpdateTime = Date.now();
                  }
                } else if (update.type === 'text-delta') {
                  // Add text to current assistant message
                  if (!currentAssistantMessage) {
                    currentAssistantMessage = {
                      id: `msg-${randomUUID()}`,
                      role: 'assistant',
                      content: update.text || '',
                      createdAt: Date.now(),
                      isStreaming: true,
                      metadata: {
                        toolCalls: {},
                        summaries: [],
                        lastUpdateTime: Date.now(),
                      } as { toolCalls: Record<string, ToolCall>; summaries: string[]; lastUpdateTime: number },
                    } as ChatMessage;
                  } else {
                    currentAssistantMessage.content += update.text || '';
                    if (!currentAssistantMessage.metadata) {
                      currentAssistantMessage.metadata = { toolCalls: {}, summaries: [] };
                    }
                    (currentAssistantMessage.metadata as { lastUpdateTime: number }).lastUpdateTime = Date.now();
                  }
                } else if (update.type === 'tool-call-started') {
                  // Add tool call to current message
                  if (!currentAssistantMessage) {
                    currentAssistantMessage = {
                      id: `msg-${randomUUID()}`,
                      role: 'assistant',
                      content: '',
                      createdAt: Date.now(),
                      isStreaming: true,
                      metadata: {
                        toolCalls: {},
                        summaries: [],
                        lastUpdateTime: Date.now(),
                      } as { toolCalls: Record<string, ToolCall>; summaries: string[]; lastUpdateTime: number },
                    } as ChatMessage;
                  }
                  if (update.callId && update.toolCall) {
                    if (!currentAssistantMessage.metadata) {
                      currentAssistantMessage.metadata = { toolCalls: {}, summaries: [] };
                    }
                    currentAssistantMessage.metadata.toolCalls![update.callId] = {
                      type: update.toolCall.type,
                      args: update.toolCall.args,
                      startTime: Date.now(),
                    };
                    (currentAssistantMessage.metadata as { lastUpdateTime: number }).lastUpdateTime = Date.now();
                  }
                } else if (update.type === 'tool-call-completed') {
                  // Update tool call with result
                  if (currentAssistantMessage && update.callId) {
                    if (!currentAssistantMessage.metadata) {
                      currentAssistantMessage.metadata = { toolCalls: {}, summaries: [] };
                    }
                    const existingCall = currentAssistantMessage.metadata.toolCalls?.[update.callId];
                    if (existingCall) {
                      existingCall.result = update.toolCall?.result;
                      existingCall.endTime = Date.now();
                      (currentAssistantMessage.metadata as { lastUpdateTime: number }).lastUpdateTime = Date.now();
                    }
                  }
                } else if (update.type === 'summary') {
                  // Add summary to current message
                  if (currentAssistantMessage && update.summary) {
                    if (!currentAssistantMessage.metadata) {
                      currentAssistantMessage.metadata = { toolCalls: {}, summaries: [] };
                    }
                    if (!currentAssistantMessage.metadata.summaries) {
                      currentAssistantMessage.metadata.summaries = [];
                    }
                    currentAssistantMessage.metadata.summaries.push(update.summary);
                    (currentAssistantMessage.metadata as { lastUpdateTime: number }).lastUpdateTime = Date.now();
                  }
                } else if (update.type === 'token-delta') {
                  // Update token count (token-delta adds tokens incrementally)
                  if (update.tokens) {
                    totalTokens += update.tokens;
                  }
                }
                
                // Save to database every 10 updates or on important events
                if (updateCount % 10 === 0 || 
                    update.type === 'tool-call-completed' ||
                    update.type === 'summary') {
                  saveToDatabase();
                }
              }
              
              // Send each update as a JSON line
              // Note: JSON.stringify should handle objects properly
              // The SDK should be sending serializable data
              try {
                const data = JSON.stringify(update);
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              } catch (stringifyError) {
                console.error(`Failed to stringify update #${updateCount}:`, stringifyError);
                console.error('Update object:', update);
                // Send an error update instead
                const errorData = JSON.stringify({
                  type: "error",
                  text: `Failed to serialize agent update: ${stringifyError instanceof Error ? stringifyError.message : 'Unknown error'}`,
                });
                controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
              }
            }

            clearTimeout(streamTimeout);
            clearInterval(heartbeatInterval);
            await stream.done;
            
            if (!streamClosed) {
              console.log("=== STREAM COMPLETE ===");
              console.log("Total updates:", updateCount);
              
              // Mark assistant message as complete and save final state
              if (currentAssistantMessage) {
                currentAssistantMessage.isStreaming = false;
              }
              if (task) {
                task.status = 'completed';
                // Final save to ensure all data is persisted
                saveToDatabase();
                console.log("✅ Final state saved to database");
                console.log("   Total messages:", task.messages.length);
                console.log("   Total tokens:", task.tokenCount);
              }
              
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
              );
              streamClosed = true;
              controller.close();
              
              // Clean up session state
              const session = agentSessions.get(sessionId);
              if (session) {
                session.isSubmitting = false;
                session.currentController = undefined;
                session.currentSubmission = undefined;
              }
            }
          } catch (streamError) {
            clearTimeout(streamTimeout);
            clearInterval(heartbeatInterval);
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
      cancel() {
        // Called when the stream is cancelled (e.g., client disconnects)
        console.log("=== STREAM CANCELLED BY CLIENT ===");
        const session = agentSessions.get(sessionId);
        if (session) {
          session.isSubmitting = false;
          session.currentController = undefined;
          session.currentSubmission = undefined;
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
    
    // Clean up session state on error
    if (sessionIdForCleanup && agentSessions.has(sessionIdForCleanup)) {
      const session = agentSessions.get(sessionIdForCleanup);
      if (session) {
        session.isSubmitting = false;
        session.currentController = undefined;
        session.currentSubmission = undefined;
      }
    }
    
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

// DELETE - Kill agent sessions
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');
    
    if (sessionId) {
      // Kill specific session
      console.log(`=== KILLING SESSION: ${sessionId} ===`);
      
      const session = agentSessions.get(sessionId);
      if (!session) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Session not found" 
          }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      
      // Try to cancel current submission
      if (session.currentSubmission && typeof session.currentSubmission.cancel === 'function') {
        try {
          session.currentSubmission.cancel();
          console.log("✅ Submission cancelled");
        } catch (e) {
          console.log("⚠️ Failed to cancel submission:", e);
        }
      }
      
      // Close stream controller
      if (session.currentController) {
        try {
          session.currentController.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ 
                type: "error", 
                text: "Session terminated by user" 
              })}\n\n`
            )
          );
          session.currentController.close();
        } catch (e) {
          console.log("⚠️ Failed to close controller:", e);
        }
      }
      
      // Remove session
      agentSessions.delete(sessionId);
      console.log(`✅ Session ${sessionId} terminated`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Session ${sessionId} terminated` 
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } else {
      // Kill all sessions
      console.log("=== KILLING ALL AGENT SESSIONS ===");
      console.log("Active sessions before:", agentSessions.size);
      
      // Try to cancel all active submissions
      for (const [id, session] of agentSessions) {
        if (session.currentSubmission && typeof session.currentSubmission.cancel === 'function') {
          try {
            session.currentSubmission.cancel();
          } catch (e) {
            console.log(`Failed to cancel session ${id}:`, e);
          }
        }
        if (session.currentController) {
          try {
            session.currentController.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ 
                  type: "error", 
                  text: "All sessions terminated" 
                })}\n\n`
              )
            );
            session.currentController.close();
          } catch (e) {
            console.log(`Failed to close controller for session ${id}:`, e);
          }
        }
      }
      
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
    }
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

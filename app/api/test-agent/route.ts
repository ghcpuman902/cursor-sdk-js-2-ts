import { CursorAgent, type WorkingLocation } from "@cursor-ai/january";

export const runtime = "nodejs";
export const maxDuration = 300;

// Global error handlers for unhandled rejections from SDK
if (typeof process !== "undefined") {
  // Remove existing handlers to avoid duplicates
  process.removeAllListeners("unhandledRejection");
  
  process.on("unhandledRejection", (reason, promise) => {
    console.error("\n" + "!".repeat(80));
    console.error("=== UNHANDLED REJECTION IN TEST AGENT ===");
    console.error("!".repeat(80));
    console.error("Reason:", reason);
    if (reason instanceof Error) {
      console.error("Message:", reason.message);
      console.error("Stack:", reason.stack);
      
      // Check if it's an HTTP/2 error
      if (reason.message.includes("NGHTTP2") || reason.message.includes("HTTP2")) {
        console.error("\n⚠️  HTTP/2 CONNECTION ERROR DETECTED");
        console.error("This is an HTTP/2 stream error from the Cursor SDK");
        console.error("Possible causes:");
        console.error("  - Cursor API connection timeout");
        console.error("  - Network interruption");
        console.error("  - API rate limiting");
        console.error("  - Internal Cursor API error");
      }
    }
    console.error("Promise:", promise);
    console.error("!".repeat(80) + "\n");
    // Don't crash the process, just log it
  });
}

export async function POST(req: Request) {
  const startTime = Date.now();
  console.log("\n\n");
  console.log("=".repeat(80));
  console.log("=== TEST AGENT REQUEST START ===");
  console.log("=".repeat(80));
  console.log("Timestamp:", new Date().toISOString());
  
  try {
    const { message, workingDirectory } = await req.json();

    console.log("\n--- Request Details ---");
    console.log("Message:", message);
    console.log("Working Directory:", workingDirectory);

    if (!message) {
      console.error("ERROR: No message provided");
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!workingDirectory) {
      console.error("ERROR: No working directory provided");
      return new Response(
        JSON.stringify({ error: "Working directory is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
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

    console.log("\n--- Creating Agent ---");
    console.log("API Key present:", !!apiKey);
    console.log("API Key length:", apiKey.length);
    console.log("Model: claude-4-sonnet");

    const workingLocation: WorkingLocation = {
      type: "local",
      localDirectory: workingDirectory,
    };

    const agent = new CursorAgent({
      apiKey,
      model: "claude-4-sonnet",
      workingLocation,
    });

    console.log("Agent created successfully");
    console.log("\n--- Submitting Message ---");

    const { stream } = agent.submit({ message });
    console.log("Stream obtained");

    // Create SSE stream
    const encoder = new TextEncoder();
    let updateCount = 0;
    let textChunks = 0;
    let toolCallCount = 0;

    const readableStream = new ReadableStream({
      async start(controller) {
        let streamClosed = false;
        
        const sendError = (error: unknown) => {
          if (streamClosed) return;
          streamClosed = true;
          
          console.error("\n!!! STREAM ERROR !!!");
          console.error("Error type:", error?.constructor?.name);
          console.error("Error message:", error instanceof Error ? error.message : String(error));
          console.error("Stack trace:", error instanceof Error ? error.stack : "N/A");
          
          // Extract meaningful error message
          let errorMessage = "Unknown error";
          if (error instanceof Error) {
            errorMessage = error.message;
            if (error.message.includes("NGHTTP2") || error.message.includes("HTTP2")) {
              errorMessage = "Connection to Cursor API lost (HTTP/2 error). The agent may have timed out.";
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
          console.log("\n--- Stream Processing Started ---");
          
          // Add timeout to detect stuck streams
          const streamTimeout = setTimeout(() => {
            console.error("!!! STREAM TIMEOUT (5 minutes) !!!");
            sendError(new Error("Agent stream timed out after 5 minutes"));
          }, 5 * 60 * 1000);

          try {
            for await (const update of stream) {
              updateCount++;
              const updateType = update.type;
              
              // Log summary every 10 updates
              if (updateCount % 10 === 0) {
                console.log(`[Progress] Updates: ${updateCount}, Text chunks: ${textChunks}, Tool calls: ${toolCallCount}`);
              }

              // Detailed logging for key events
              if (updateType === "text-delta") {
                textChunks++;
                const preview = update.text?.substring(0, 50);
                console.log(`[${updateCount}] TEXT-DELTA: "${preview}${update.text && update.text.length > 50 ? '...' : ''}"`);
              } else if (updateType === "thinking-delta") {
                console.log(`[${updateCount}] THINKING-DELTA:`, update.text?.substring(0, 100));
              } else if (updateType === "tool-call-started") {
                toolCallCount++;
                console.log(`[${updateCount}] TOOL-CALL-STARTED:`, {
                  callId: update.callId,
                  type: update.toolCall?.type,
                  hasArgs: !!update.toolCall?.args,
                });
              } else if (updateType === "tool-call-completed") {
                console.log(`[${updateCount}] TOOL-CALL-COMPLETED:`, {
                  callId: update.callId,
                  status: update.toolCall?.result?.status,
                  hasValue: !!update.toolCall?.result?.value,
                  hasError: !!update.toolCall?.result?.error,
                });
              } else if (updateType === "summary") {
                console.log(`[${updateCount}] SUMMARY:`, update.summary?.substring(0, 100));
              } else if (updateType === "token-delta") {
                console.log(`[${updateCount}] TOKEN-DELTA:`, update.tokens);
              } else {
                console.log(`[${updateCount}] ${updateType.toUpperCase()}`);
              }

              // Send update to client
              const data = JSON.stringify(update);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            clearTimeout(streamTimeout);
            await stream.done;
            
            if (!streamClosed) {
              const duration = Date.now() - startTime;
              console.log("\n--- Stream Complete ---");
              console.log("Total updates:", updateCount);
              console.log("Text chunks:", textChunks);
              console.log("Tool calls:", toolCallCount);
              console.log("Duration:", duration, "ms");

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
              );
              streamClosed = true;
              controller.close();
              
              console.log("=".repeat(80));
              console.log("=== TEST AGENT REQUEST COMPLETE ===");
              console.log("=".repeat(80));
              console.log("\n\n");
            }
          } catch (streamError) {
            clearTimeout(streamTimeout);
            console.error("!!! ERROR DURING STREAM ITERATION !!!");
            sendError(streamError);
          }
        } catch (error) {
          console.error("!!! ERROR IN STREAM SETUP !!!");
          sendError(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error("\n!!! REQUEST ERROR !!!");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Stack trace:", error instanceof Error ? error.stack : "N/A");
    console.error("=".repeat(80));
    console.log("\n\n");
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

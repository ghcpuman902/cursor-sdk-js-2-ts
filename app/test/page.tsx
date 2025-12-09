"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Terminal, Loader2 } from "lucide-react";

export default function TestPage() {
  const [workingDir, setWorkingDir] = useState(process.cwd ? "" : "/Users/manglekuo/dev");
  const [prompt, setPrompt] = useState("List all files in the current directory");
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentResponse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workingDir || !prompt || isStreaming) return;

    console.log("=== TEST PAGE: STARTING REQUEST ===");
    console.log("Working Directory:", workingDir);
    console.log("Prompt:", prompt);

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    setCurrentResponse("");
    setIsStreaming(true);

    const currentPrompt = prompt;
    setPrompt("");

    try {
      const res = await fetch("/api/test-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: currentPrompt,
          workingDirectory: workingDir,
        }),
      });

      console.log("Response status:", res.status);
      console.log("Response headers:", Object.fromEntries(res.headers.entries()));

      if (!res.ok) {
        const errData = await res.json();
        console.error("Request failed:", errData);
        throw new Error(errData.error || "Failed to run agent");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let updateCount = 0;
      let fullResponse = "";

      console.log("Starting to read stream...");

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("Stream ended");
          console.log("Total updates:", updateCount);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6));
            updateCount++;
            
            console.log(`[Update #${updateCount}]`, {
              type: data.type,
              hasText: !!data.text,
              hasCallId: !!data.callId,
              hasToolCall: !!data.toolCall,
            });

            if (data.type === "text-delta" && data.text) {
              fullResponse += data.text;
              setCurrentResponse(fullResponse);
            } else if (data.type === "thinking-delta" && data.text) {
              // Show thinking in the response too
              fullResponse += `[Thinking: ${data.text}]\n`;
              setCurrentResponse(fullResponse);
            } else if (data.type === "tool-call-started") {
              console.log("Tool call started:", data.toolCall);
              const toolName = data.toolCall?.type || "Unknown";
              const toolArgs = data.toolCall?.args ? JSON.stringify(data.toolCall.args, null, 2) : "";
              fullResponse += `\n🔧 [Tool Started: ${toolName}]\n`;
              if (toolArgs) {
                fullResponse += `Args: ${toolArgs}\n`;
              }
              setCurrentResponse(fullResponse);
            } else if (data.type === "tool-call-completed") {
              console.log("Tool call completed:", data.toolCall?.result?.status);
              const toolName = data.toolCall?.type || "Unknown";
              const status = data.toolCall?.result?.status;
              const value = data.toolCall?.result?.value;
              const error = data.toolCall?.result?.error;
              
              fullResponse += `\n✅ [Tool Completed: ${toolName}]\n`;
              fullResponse += `Status: ${status}\n`;
              
              if (error) {
                fullResponse += `Error: ${JSON.stringify(error, null, 2)}\n`;
              } else if (value) {
                // Format the result nicely
                const valueStr = typeof value === "string" 
                  ? value 
                  : JSON.stringify(value, null, 2);
                fullResponse += `Result:\n${valueStr}\n`;
              }
              fullResponse += `\n`;
              setCurrentResponse(fullResponse);
            } else if (data.type === "error") {
              console.error("Agent error:", data.text);
              fullResponse += `\n[ERROR: ${data.text}]\n`;
              setCurrentResponse(fullResponse);
            } else if (data.type === "done") {
              console.log("Agent completed");
            }
          } catch (parseError) {
            console.error("Failed to parse SSE:", line.substring(0, 100), parseError);
          }
        }
      }

      // Save complete response
      setMessages((prev) => [...prev, { role: "assistant", content: fullResponse }]);
      setCurrentResponse("");
    } catch (err) {
      console.error("=== REQUEST FAILED ===");
      console.error("Error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `ERROR: ${err instanceof Error ? err.message : "Unknown error"}`,
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-violet-500" />
          <div>
            <h1 className="text-lg font-semibold text-white">Cursor SDK Test</h1>
            <p className="text-xs text-zinc-400">
              Simple agent test - no session management
            </p>
          </div>
        </div>
      </header>

      {/* Working Directory Input */}
      <div className="border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <label className="block text-xs text-zinc-400 mb-1">
          Working Directory (absolute path):
        </label>
        <input
          type="text"
          value={workingDir}
          onChange={(e) => setWorkingDir(e.target.value)}
          placeholder="/Users/username/project"
          className="w-full px-3 py-2 text-sm border border-zinc-700 rounded-lg bg-zinc-950 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-zinc-500 py-8">
            <p className="text-sm">Enter a working directory and prompt to start</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg ${
              msg.role === "user"
                ? "bg-zinc-800 text-zinc-100 ml-12"
                : "bg-zinc-900 text-zinc-200 mr-12 border border-zinc-800"
            }`}
          >
            <div className="text-xs text-zinc-500 mb-1 font-semibold">
              {msg.role === "user" ? "USER" : "ASSISTANT"}
            </div>
            <pre className="text-xs whitespace-pre-wrap font-mono">
              {msg.content}
            </pre>
          </div>
        ))}

        {/* Current streaming response */}
        {isStreaming && currentResponse && (
          <div className="p-3 rounded-lg bg-zinc-900 text-zinc-200 mr-12 border border-violet-500">
            <div className="text-xs text-violet-400 mb-1 font-semibold flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              ASSISTANT (streaming...)
            </div>
            <pre className="text-xs whitespace-pre-wrap font-mono">
              {currentResponse}
            </pre>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-zinc-800 bg-zinc-900 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt..."
            disabled={isStreaming}
            className="flex-1 px-3 py-2 text-sm border border-zinc-700 rounded-lg bg-zinc-950 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!workingDir || !prompt || isStreaming}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          Check browser console (F12) for detailed logs
        </p>
      </form>
    </div>
  );
}

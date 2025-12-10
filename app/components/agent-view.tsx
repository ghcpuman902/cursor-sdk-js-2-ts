"use client";

import { useRef, useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  Play,
  Sparkles,
  User,
  Bot,
  ExternalLink,
  Send,
} from "lucide-react";
import type { ToolCall, AgentTask } from "@/lib/types";

// Tool emoji mapping
const toolEmojis: Record<string, string> = {
  read: "📖",
  write: "✍️",
  ls: "📂",
  grep: "🔍",
  shell: "💻",
  delete: "🗑️",
  glob: "🌐",
  edit: "✏️",
  readLints: "🔧",
  mcp: "🔌",
  semSearch: "🔎",
  createPlan: "📝",
  updateTodos: "✅",
};

interface ToolCallDisplayProps {
  toolCall: ToolCall;
  isActive?: boolean;
}

const ToolCallDisplay = ({ toolCall, isActive }: ToolCallDisplayProps) => {
  const emoji = toolEmojis[toolCall.type] || "🔧";
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  
  // Update current time when active
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);
  
  // Calculate duration and detect if stuck
  const duration = toolCall.endTime 
    ? toolCall.endTime - (toolCall.startTime || 0)
    : isActive 
    ? currentTime - (toolCall.startTime || currentTime)
    : 0;
  
  const isStuck = isActive && duration > 30000; // 30 seconds
  const isSlowWarning = isActive && duration > 15000; // 15 seconds warning

  return (
    <div
      className={`border rounded-lg p-3 transition-all text-sm max-w-[80ch] ${
        isStuck
          ? "border-amber-400 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-950/30"
          : isActive
          ? "border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/30"
          : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{emoji}</span>
        <span className="font-medium text-xs">{toolCall.type}</span>
        {isActive && (
          <div className="flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
            <span className="text-[10px] text-zinc-500">
              {Math.floor(duration / 1000)}s
            </span>
          </div>
        )}
        {isStuck && (
          <span className="text-[9px] bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
            ⚠️ STUCK
          </span>
        )}
        {isSlowWarning && !isStuck && (
          <span className="text-[9px] text-blue-600 dark:text-blue-400">
            Taking longer than usual...
          </span>
        )}
      </div>

      {toolCall.args && Object.keys(toolCall.args).length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-1">
            Args:
          </div>
          <div className="max-w-full overflow-hidden">
            <pre className="text-[10px] bg-white dark:bg-black p-2 rounded border border-zinc-200 dark:border-zinc-800 overflow-auto max-h-32 max-w-full whitespace-pre">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {toolCall.result && (
        <div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-1">
            Result:
          </div>
          <div className="text-[10px] bg-white dark:bg-black p-2 rounded border border-zinc-200 dark:border-zinc-800">
            <div className="mb-1">
              Status:{" "}
              <span
                className={
                  toolCall.result.status === "success"
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {toolCall.result.status}
              </span>
            </div>
            {toolCall.result.error && (
              <div className="text-red-600 whitespace-pre-wrap wrap-break-word">
                Error: {typeof toolCall.result.error === 'string' 
                  ? toolCall.result.error 
                  : typeof toolCall.result.error === 'object' && toolCall.result.error && 'message' in toolCall.result.error
                  ? String((toolCall.result.error as { message: string }).message)
                  : String(toolCall.result.error)}
              </div>
            )}
            {toolCall.result.value != null && (
              <div className="mt-1 max-w-full overflow-hidden">
                <pre className="overflow-auto text-zinc-700 dark:text-zinc-300 max-h-64 max-w-full whitespace-pre">
                  {(() => {
                    const value: unknown = toolCall.result.value;
                    if (typeof value === "string") {
                      // For strings, check if it looks like JSON
                      try {
                        const parsed = JSON.parse(value);
                        return JSON.stringify(parsed, null, 2);
                      } catch {
                        // Not JSON, return as-is to preserve newlines
                        return value;
                      }
                    }
                    // For objects/arrays, pretty print
                    try {
                      return JSON.stringify(value, null, 2);
                    } catch {
                      return String(value);
                    }
                  })()}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface AgentViewProps {
  task: AgentTask | null;
  activeToolCalls: Set<string>;
  onSendMessage?: (taskId: string, message: string) => void;
  onKillSession?: (taskId: string, sessionId: string) => void;
}

export const AgentView = ({ task, activeToolCalls, onSendMessage, onKillSession }: AgentViewProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [, setRefreshTrigger] = useState(0);
  const [inputMessage, setInputMessage] = useState("");
  const [isStuck, setIsStuck] = useState(false);
  const [stuckDuration, setStuckDuration] = useState(0);
  const [isKilling, setIsKilling] = useState(false);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [task?.messages]);

  // Force periodic re-render when there are active tool calls (to update durations)
  useEffect(() => {
    if (activeToolCalls.size === 0) return;
    
    const interval = setInterval(() => {
      setRefreshTrigger((prev) => prev + 1);
    }, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, [activeToolCalls.size]);

  // Detect if agent is stuck (no updates for 10+ seconds while running)
  useEffect(() => {
    if (!task || task.status !== "running") {
      setIsStuck(false);
      setStuckDuration(0);
      return;
    }

    // Find the last streaming message
    const lastMessage = task.messages[task.messages.length - 1];
    if (!lastMessage?.isStreaming) {
      // If not streaming, reset stuck state
      setIsStuck(false);
      setStuckDuration(0);
      return;
    }

    // Check for lastUpdateTime at message level
    const lastUpdateTime = lastMessage.lastUpdateTime;
    if (!lastUpdateTime) {
      // No lastUpdateTime tracked yet
      return;
    }

    const checkStuck = () => {
      const timeSinceLastUpdate = Date.now() - lastUpdateTime;
      const secondsStuck = Math.floor(timeSinceLastUpdate / 1000);
      
      if (secondsStuck >= 10) {
        setIsStuck(true);
        setStuckDuration(secondsStuck);
      } else {
        setIsStuck(false);
        setStuckDuration(0);
      }
    };

    // Check immediately and then every second
    checkStuck();
    const interval = setInterval(checkStuck, 1000);
    
    return () => clearInterval(interval);
  }, [task, task?.messages, task?.messages?.length]);

  // Empty state
  if (!task) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <Bot className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Select a project action to start an agent
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            Agents will run in parallel across different repos
          </p>
        </div>
      </div>
    );
  }

  const { messages, repoName, status, error } = task;

  const handleOpenInCursor = () => {
    // Open the repo in Cursor using the cursor:// protocol
    // Add windowId parameter to force opening in a new window
    const cursorUrl = `cursor://file/${task.repoPath}?windowId=_blank`;
    window.open(cursorUrl, "_blank");
  };

  const handleOpenInCursorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleOpenInCursor();
    }
  };

  const handleKillSession = async () => {
    if (!task?.sessionId || isKilling) return;
    
    setIsKilling(true);
    try {
      const response = await fetch(`/api/agent?sessionId=${task.sessionId}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        console.log("✅ Session killed successfully");
        // Optionally notify parent component
        if (onKillSession) {
          onKillSession(task.id, task.sessionId);
        }
      } else {
        const data = await response.json();
        console.error("Failed to kill session:", data);
      }
    } catch (error) {
      console.error("Error killing session:", error);
    } finally {
      setIsKilling(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Task Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
        <div className="flex items-center gap-2">
          <TaskStatusIcon status={status} />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm truncate">{repoName}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
              {task.action.replace("-", " ")}
            </p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5 font-mono">
              📁 {task.repoPath}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {task.sessionId && (
              <div className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded border border-green-200 dark:border-green-900">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="font-medium">Session Active</span>
              </div>
            )}
            {task.tokenCount > 0 && (
              <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                {task.tokenCount} tokens
              </span>
            )}
            <button
              type="button"
              onClick={handleOpenInCursor}
              onKeyDown={handleOpenInCursorKeyDown}
              className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-violet-50 dark:hover:bg-violet-950/30 rounded transition-colors"
              aria-label="Open in Cursor"
              tabIndex={0}
            >
              <ExternalLink className="w-3 h-3" />
              Open in Cursor
            </button>
          </div>
        </div>
      </div>

      {/* Stuck Warning */}
      {isStuck && status === "running" && (
        <div className="m-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Circle className="w-4 h-4 animate-pulse" />
                <span className="text-xs font-medium">
                  Agent appears stuck ({stuckDuration}s with no updates)
                </span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                The agent may be processing a slow operation, or it could be hung. You can wait or force stop.
              </p>
            </div>
            <button
              type="button"
              onClick={handleKillSession}
              disabled={isKilling}
              className="ml-3 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900 rounded transition-colors disabled:opacity-50"
            >
              {isKilling ? "Stopping..." : "Force Stop"}
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="m-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <XCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Error</span>
          </div>
          <p className="text-xs text-red-700 dark:text-red-300 mt-1">{error}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((message) => (
          <div key={message.id} className="space-y-2">
            {message.role === "user" ? (
              <div className="flex gap-2">
                <div className="shrink-0 w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                  <User className="w-3 h-3 text-zinc-600 dark:text-zinc-300" />
                </div>
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3">
                  <div className="max-w-full overflow-hidden">
                    <pre className="text-xs whitespace-pre-wrap max-w-full wrap-break-word font-sans">
                      {message.content}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="shrink-0 w-6 h-6 rounded-full bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="flex-1 space-y-2">
                  {/* Thinking */}
                  {message.metadata?.thinking && (
                    <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-[10px] text-purple-600 dark:text-purple-400 font-medium mb-1">
                        <Sparkles className="w-3 h-3" />
                        THINKING
                      </div>
                      <div className="max-w-full overflow-hidden">
                        <pre className="text-[10px] text-purple-900 dark:text-purple-100 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-auto max-w-full wrap-break-word">
                          {message.metadata?.thinking}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Tool Calls */}
                  {message.metadata?.toolCalls && Object.keys(message.metadata.toolCalls).length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-zinc-500 font-medium flex items-center gap-1">
                        🔧 TOOLS ({Object.keys(message.metadata.toolCalls).length})
                      </div>
                      {Object.entries(message.metadata.toolCalls).map(
                        ([callId, toolCall]) => (
                          <ToolCallDisplay
                            key={callId}
                            toolCall={toolCall}
                            isActive={
                              message.isStreaming && activeToolCalls.has(callId)
                            }
                          />
                        )
                      )}
                    </div>
                  )}

                  {/* Response */}
                  {message.content && (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 shadow-sm">
                      <div className="max-w-full overflow-hidden">
                        <pre className="text-xs whitespace-pre-wrap max-w-full wrap-break-word font-sans">
                          {message.content}
                          {message.isStreaming && (
                            <span className="inline-block w-1.5 h-3 bg-violet-500 ml-0.5 animate-pulse" />
                          )}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Summaries */}
                  {message.metadata?.summaries && message.metadata.summaries.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mb-1">
                        📝 SUMMARY
                      </div>
                      <div className="space-y-1">
                        {message.metadata.summaries.map((summary, idx) => (
                          <div
                            key={idx}
                            className="max-w-full overflow-hidden"
                          >
                            <pre className="text-[10px] text-amber-900 dark:text-amber-100 whitespace-pre-wrap max-w-full wrap-break-word font-sans">
                              {summary}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Streaming indicator */}
                  {message.isStreaming &&
                    !message.content &&
                    !message.metadata?.thinking &&
                    Object.keys(message.metadata?.toolCalls || {}).length === 0 && (
                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="text-[10px]">
                          Agent is thinking...
                        </span>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input - Show when there's an active session */}
      {task && task.sessionId && onSendMessage && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          {/* Stuck Warning */}
          {isStuck && (
            <div className="px-3 pt-3 pb-2">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="shrink-0 mt-0.5">
                    <Loader2 className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        Agent appears stuck
                      </span>
                      <span className="text-xs text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded">
                        {stuckDuration}s no activity
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                      No updates received for {stuckDuration} seconds. Try sending a message to unstick the agent.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSendMessage(task.id, "Please continue with your task. If you're stuck, let me know what the issue is.");
                          setIsStuck(false);
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-amber-200 hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-900 dark:text-amber-100 rounded transition-colors"
                      >
                        Send &ldquo;Continue&rdquo;
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSendMessage(task.id, "What's your current status? Are you waiting for something?");
                          setIsStuck(false);
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-amber-200 hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-900 dark:text-amber-100 rounded transition-colors"
                      >
                        Ask Status
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsStuck(false)}
                        className="ml-auto px-2 py-1 text-xs text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (inputMessage.trim() && (status !== "running" || isStuck)) {
                  onSendMessage(task.id, inputMessage.trim());
                  setInputMessage("");
                  setIsStuck(false);
                }
              }}
              className="flex gap-2"
            >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                isStuck
                  ? "Type a message to unstick the agent..."
                  : status === "running"
                  ? "Agent is working..."
                  : status === "failed"
                  ? "Task failed - enter message to retry"
                  : "Send a follow-up message..."
              }
              disabled={status === "running" && !isStuck}
              className={`flex-1 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isStuck 
                  ? "border-amber-400 dark:border-amber-600 focus:ring-amber-500 dark:focus:ring-amber-600" 
                  : "border-zinc-300 dark:border-zinc-700 focus:ring-violet-500 dark:focus:ring-violet-600"
              }`}
              aria-label="Follow-up message"
            />
              <button
                type="submit"
                disabled={!inputMessage.trim() || (status === "running" && !isStuck)}
                className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                  isStuck
                    ? "bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
                    : "bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
                }`}
                aria-label="Send message"
              >
                {status === "running" && !isStuck ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Working</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {isStuck ? "Unstick" : "Send"}
                  </>
                )}
              </button>
            </form>
            
            {/* Session indicator */}
            <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span>Active session: {task.sessionId.slice(0, 8)}</span>
              </div>
              <span>{task.messages.length} messages in conversation</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface TaskStatusIconProps {
  status: AgentTask["status"];
}

const TaskStatusIcon = ({ status }: TaskStatusIconProps) => {
  switch (status) {
    case "pending":
      return <Circle className="w-4 h-4 text-zinc-400" />;
    case "running":
      return <Play className="w-4 h-4 text-blue-500 fill-blue-500" />;
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-500" />;
  }
};

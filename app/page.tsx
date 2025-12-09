"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Terminal } from "lucide-react";
import type {
  RepoInfo,
  AgentTask,
  TaskAction,
  ChatMessage,
  AgentUpdate,
} from "@/lib/types";
import { RepoScanner } from "./components/repo-scanner";
import { RepoList } from "./components/repo-list";
import { AgentView } from "./components/agent-view";
import { TaskSidebar } from "./components/task-sidebar";
import { DatabaseInfo } from "./components/database-info";

// Action prompts for pre-built actions
const actionPrompts: Record<Exclude<TaskAction, "custom">, string> = {
  "upgrade-typescript":
    "Convert this JavaScript project to TypeScript. Add tsconfig.json if missing, rename .js files to .ts/.tsx as appropriate, add type annotations to functions and variables. Ensure the project builds without errors.",
  "upgrade-framework":
    "Analyze this project and upgrade the main framework (Next.js, React, Vue, etc.) to the latest stable version. Update related dependencies and fix any breaking changes. Run build to verify everything works.",
  summarize:
    "Analyze this codebase thoroughly and generate a comprehensive README.md with: project overview, tech stack, folder structure, setup instructions, available scripts, and key features. Be detailed but concise.",
  "update-deps":
    "Check for outdated dependencies in this project. Update them to their latest compatible versions, prioritizing security updates. Fix any breaking changes that arise from the updates.",
};

export default function Home() {
  // Repo scanning state
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [scannedPath, setScannedPath] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Task management state
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeToolCalls, setActiveToolCalls] = useState<Set<string>>(new Set());
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);

  // Track task IDs that need persistence (debounced)
  const tasksToSaveRef = useRef<Set<string>>(new Set());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get active task
  const activeTask = tasks.find((t) => t.id === activeTaskId) || null;

  // Force periodic re-render when there are active tool calls (to update duration displays)
  useEffect(() => {
    if (activeToolCalls.size === 0) return;
    
    const interval = setInterval(() => {
      // Force a re-render by updating state slightly
      setTasks((prev) => [...prev]);
    }, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, [activeToolCalls.size]);

  // Load persisted tasks and repos on mount
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        // Load tasks
        const tasksRes = await fetch("/api/tasks");
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          if (tasksData.tasks && tasksData.tasks.length > 0) {
            // Restore Map objects for toolCalls
            const restoredTasks = tasksData.tasks.map((task: AgentTask) => ({
              ...task,
              messages: task.messages.map((msg: ChatMessage) => ({
                ...msg,
                toolCalls: msg.toolCalls
                  ? new Map(Object.entries(msg.toolCalls))
                  : new Map(),
              })),
            }));
            setTasks(restoredTasks);
            // Set the first task as active if none is set
            if (!activeTaskId && restoredTasks.length > 0) {
              setActiveTaskId(restoredTasks[0].id);
            }
          }
        }

        // Load last scanned repos
        const reposRes = await fetch("/api/repos");
        if (reposRes.ok) {
          const reposData = await reposRes.json();
          if (reposData.repos && reposData.repos.length > 0) {
            setRepos(reposData.repos);
            setScannedPath(reposData.scannedPath);
          }
        }
      } catch (error) {
        console.error("Failed to load persisted data:", error);
      } finally {
        setIsLoadingTasks(false);
      }
    };

    loadPersistedData();
  }, []); // Only run once on mount

  // Debounced save to database
  const saveTaskToDb = useCallback(async (task: AgentTask) => {
    try {
      // For now, we'll send the entire task to be saved/updated
      // The backend will handle the upsert logic
      await fetch("/api/tasks/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: {
            ...task,
            messages: task.messages.map((msg) => ({
              ...msg,
              toolCalls: msg.toolCalls
                ? Object.fromEntries(msg.toolCalls)
                : {},
            })),
          },
        }),
      });
    } catch (error) {
      console.error("Failed to save task:", error);
    }
  }, []);

  // Queue task for saving with debounce
  const queueTaskSave = useCallback(
    (taskId: string) => {
      tasksToSaveRef.current.add(taskId);

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout to batch saves
      saveTimeoutRef.current = setTimeout(() => {
        const taskIds = Array.from(tasksToSaveRef.current);
        tasksToSaveRef.current.clear();

        // Save all queued tasks
        taskIds.forEach((id) => {
          const task = tasks.find((t) => t.id === id);
          if (task) {
            saveTaskToDb(task);
          }
        });
      }, 1000); // Debounce by 1 second
    },
    [tasks, saveTaskToDb]
  );

  // Scan for repos
  const handleScan = useCallback(async (rootPath: string) => {
    setIsScanning(true);
    setScanError(null);

    try {
      const res = await fetch("/api/scan-repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootPath }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Scan failed");
      }

      setRepos(data.repos);
      setScannedPath(data.scannedPath);

      // Save scanned repos to database
      try {
        await fetch("/api/repos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scannedPath: data.scannedPath,
            repos: data.repos,
          }),
        });
      } catch (error) {
        console.error("Failed to save scanned repos:", error);
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
      setRepos([]);
      setScannedPath(null);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Create and run an agent task
  const handleAction = useCallback(
    async (repo: RepoInfo, action: TaskAction, customPrompt?: string) => {
      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // Determine the prompt
      const prompt =
        action === "custom"
          ? customPrompt || "Analyze this project."
          : actionPrompts[action];

      // Create new task
      const newTask: AgentTask = {
        id: taskId,
        repoPath: repo.path,
        repoName: repo.name,
        action,
        status: "pending",
        customPrompt: action === "custom" ? customPrompt : undefined,
        createdAt: Date.now(),
        messages: [],
        tokenCount: 0,
        terminalOutput: [],
        lastActivityTime: Date.now(),
      };

      // Add task and set as active
      setTasks((prev) => [newTask, ...prev]);
      setActiveTaskId(taskId);
      
      // Save new task to DB immediately
      saveTaskToDb(newTask);

      // Create user message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: prompt,
      };

      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        thinking: "",
        toolCalls: new Map(),
        summaries: [],
        isStreaming: true,
      };

      // Update task with messages and set to running
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "running",
                messages: [userMessage, assistantMessage],
              }
            : t
        )
      );

      try {
        console.log(`[Task ${taskId}] === STARTING AGENT REQUEST ===`);
        console.log(`[Task ${taskId}] Repo:`, repo.name);
        console.log(`[Task ${taskId}] Path:`, repo.path);
        console.log(`[Task ${taskId}] Action:`, action);
        
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: prompt,
            workingDirectory: repo.path,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          console.error(`[Task ${taskId}] Request failed:`, errData);
          throw new Error(errData.error || "Failed to run agent");
        }

        console.log(`[Task ${taskId}] Response received, starting stream...`);
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let updateCount = 0;

        // Helper to update task
        const updateTask = (updater: (task: AgentTask) => AgentTask) => {
          setTasks((prev) => {
            const updated = prev.map((t) => (t.id === taskId ? updater(t) : t));
            // Queue save for this task
            queueTaskSave(taskId);
            return updated;
          });
        };

        // Helper to update assistant message
        const updateAssistantMessage = (
          updater: (msg: ChatMessage) => ChatMessage
        ) => {
          updateTask((task) => ({
            ...task,
            messages: task.messages.map((msg) =>
              msg.id === assistantMessageId ? updater(msg) : msg
            ),
          }));
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log(`[Task ${taskId}] === STREAM ENDED ===`);
            console.log(`[Task ${taskId}] Total updates received:`, updateCount);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            try {
              const data: AgentUpdate = JSON.parse(line.slice(6));
              updateCount++;
              
              if (updateCount % 10 === 0) {
                console.log(`[Task ${taskId}] Progress: ${updateCount} updates received`);
              }

              // Update last activity time for all updates
              updateTask((task) => ({
                ...task,
                lastActivityTime: Date.now(),
              }));

              switch (data.type) {
                case "session":
                  // Store session ID for multi-turn conversations
                  if (data.sessionId) {
                    console.log(`[Task ${taskId}] Session ID:`, data.sessionId);
                    updateTask((task) => ({
                      ...task,
                      sessionId: data.sessionId,
                    }));
                  }
                  break;

                case "text-delta":
                  updateAssistantMessage((msg) => ({
                    ...msg,
                    content: msg.content + (data.text || ""),
                  }));
                  break;

                case "thinking-delta":
                  updateAssistantMessage((msg) => ({
                    ...msg,
                    thinking: (msg.thinking || "") + (data.text || ""),
                  }));
                  break;

                case "thinking-completed":
                  updateAssistantMessage((msg) => ({
                    ...msg,
                    thinking:
                      (msg.thinking || "") + ` ✓ (${data.thinkingDurationMs}ms)`,
                  }));
                  break;

                case "tool-call-started":
                  if (data.callId && data.toolCall) {
                    setActiveToolCalls((prev) =>
                      new Set(prev).add(data.callId!)
                    );
                    const toolWithTime = {
                      ...data.toolCall,
                      startTime: Date.now(),
                    };
                    updateAssistantMessage((msg) => {
                      const newToolCalls = new Map(msg.toolCalls);
                      newToolCalls.set(data.callId!, toolWithTime);
                      return { ...msg, toolCalls: newToolCalls };
                    });
                    
                    // Track ALL tool calls in terminal output for visibility
                    const formatArgs = (args: Record<string, unknown> | undefined) => {
                      if (!args) return "";
                      const key = Object.keys(args)[0];
                      const value = args[key];
                      if (typeof value === "string" && value.length < 60) {
                        return value;
                      }
                      return JSON.stringify(args, null, 2).slice(0, 200);
                    };

                    const terminalEntry = {
                      id: data.callId!,
                      timestamp: Date.now(),
                      toolType: data.toolCall.type,
                      command: data.toolCall.type === "shell" 
                        ? String(data.toolCall.args?.command || "")
                        : undefined,
                      toolArgs: data.toolCall.type !== "shell"
                        ? formatArgs(data.toolCall.args)
                        : undefined,
                      isRunning: true,
                    };
                    updateTask((task) => ({
                      ...task,
                      terminalOutput: [...task.terminalOutput, terminalEntry],
                    }));
                  }
                  break;

                case "tool-call-completed":
                  if (data.callId && data.toolCall) {
                    setActiveToolCalls((prev) => {
                      const next = new Set(prev);
                      next.delete(data.callId!);
                      return next;
                    });
                    updateAssistantMessage((msg) => {
                      const existingCall = msg.toolCalls?.get(data.callId!);
                      const toolWithTime = {
                        ...data.toolCall!,
                        startTime: existingCall?.startTime,
                        endTime: Date.now(),
                      };
                      const newToolCalls = new Map(msg.toolCalls);
                      newToolCalls.set(data.callId!, toolWithTime);
                      return { ...msg, toolCalls: newToolCalls };
                    });
                    
                    // Update shell command output in terminal
                    if (data.toolCall.type === "shell") {
                      updateTask((task) => ({
                        ...task,
                        terminalOutput: task.terminalOutput.map((entry) =>
                          entry.id === data.callId
                            ? {
                                ...entry,
                                output: data.toolCall?.result?.value 
                                  ? (typeof data.toolCall.result.value === "string" 
                                    ? data.toolCall.result.value 
                                    : JSON.stringify(data.toolCall.result.value, null, 2))
                                  : data.toolCall?.result?.error 
                                  ? (typeof data.toolCall.result.error === "string"
                                    ? data.toolCall.result.error
                                    : JSON.stringify(data.toolCall.result.error, null, 2))
                                  : "",
                                exitCode: data.toolCall?.result?.status === "success" ? 0 : 1,
                                isRunning: false,
                              }
                            : entry
                        ),
                      }));
                    }
                  }
                  break;

                case "summary":
                  if (data.summary) {
                    updateAssistantMessage((msg) => ({
                      ...msg,
                      summaries: [...(msg.summaries || []), data.summary!],
                    }));
                  }
                  break;

                case "token-delta":
                  if (data.tokens) {
                    updateTask((task) => ({
                      ...task,
                      tokenCount: task.tokenCount + data.tokens!,
                    }));
                  }
                  break;

                case "error":
                  console.error(`[Task ${taskId}] Error from agent:`, data.text);
                  updateTask((task) => ({
                    ...task,
                    status: "failed",
                    error: data.text || "Unknown error occurred",
                  }));
                  break;

                case "done":
                  console.log(`[Task ${taskId}] Agent completed successfully`);
                  updateAssistantMessage((msg) => ({
                    ...msg,
                    isStreaming: false,
                  }));
                  updateTask((task) => ({
                    ...task,
                    status: "completed",
                  }));
                  break;
              }
            } catch (parseError) {
              console.error(`[Task ${taskId}] Failed to parse SSE data:`, line.substring(0, 100));
            }
          }
        }

        // Mark as complete if not already failed
        updateTask((task) => ({
          ...task,
          status: task.status === "failed" ? "failed" : "completed",
          messages: task.messages.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false }
              : msg
          ),
        }));
      } catch (err) {
        console.error(`[Task ${taskId}] === AGENT REQUEST FAILED ===`);
        console.error(`[Task ${taskId}] Error:`, err);
        // Mark task as failed
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: "failed",
                  error: err instanceof Error ? err.message : "Unknown error",
                  messages: t.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, isStreaming: false }
                      : msg
                  ),
                }
              : t
          )
        );
      }
    },
    [queueTaskSave, saveTaskToDb]
  );

  // Send a follow-up message to an existing task
  const handleSendMessage = useCallback(
    async (taskId: string, message: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || !task.sessionId) return;

      // Create user message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: message,
      };

      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        thinking: "",
        toolCalls: new Map(),
        summaries: [],
        isStreaming: true,
      };

      // Update task with new messages and set to running
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "running",
                messages: [...t.messages, userMessage, assistantMessage],
              }
            : t
        )
      );

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            sessionId: task.sessionId,
            workingDirectory: task.repoPath,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to send message");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        // Helper to update task
        const updateTask = (updater: (task: AgentTask) => AgentTask) => {
          setTasks((prev) => {
            const updated = prev.map((t) => (t.id === taskId ? updater(t) : t));
            queueTaskSave(taskId);
            return updated;
          });
        };

        // Helper to update assistant message
        const updateAssistantMessage = (
          updater: (msg: ChatMessage) => ChatMessage
        ) => {
          updateTask((task) => ({
            ...task,
            messages: task.messages.map((msg) =>
              msg.id === assistantMessageId ? updater(msg) : msg
            ),
          }));
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            try {
              const data: AgentUpdate = JSON.parse(line.slice(6));

              // Update last activity time
              updateTask((task) => ({
                ...task,
                lastActivityTime: Date.now(),
              }));

              switch (data.type) {
                case "text-delta":
                  updateAssistantMessage((msg) => ({
                    ...msg,
                    content: msg.content + (data.text || ""),
                  }));
                  break;

                case "thinking-delta":
                  updateAssistantMessage((msg) => ({
                    ...msg,
                    thinking: (msg.thinking || "") + (data.text || ""),
                  }));
                  break;

                case "thinking-completed":
                  updateAssistantMessage((msg) => ({
                    ...msg,
                    thinking:
                      (msg.thinking || "") + ` ✓ (${data.thinkingDurationMs}ms)`,
                  }));
                  break;

                case "tool-call-started":
                  if (data.callId && data.toolCall) {
                    setActiveToolCalls((prev) =>
                      new Set(prev).add(data.callId!)
                    );
                    const toolWithTime = {
                      ...data.toolCall,
                      startTime: Date.now(),
                    };
                    updateAssistantMessage((msg) => {
                      const newToolCalls = new Map(msg.toolCalls);
                      newToolCalls.set(data.callId!, toolWithTime);
                      return { ...msg, toolCalls: newToolCalls };
                    });
                    
                    // Track ALL tool calls
                    const formatArgs = (args: Record<string, unknown> | undefined) => {
                      if (!args) return "";
                      const key = Object.keys(args)[0];
                      const value = args[key];
                      if (typeof value === "string" && value.length < 60) {
                        return value;
                      }
                      return JSON.stringify(args, null, 2).slice(0, 200);
                    };

                    const terminalEntry = {
                      id: data.callId!,
                      timestamp: Date.now(),
                      toolType: data.toolCall.type,
                      command: data.toolCall.type === "shell" 
                        ? String(data.toolCall.args?.command || "")
                        : undefined,
                      toolArgs: data.toolCall.type !== "shell"
                        ? formatArgs(data.toolCall.args)
                        : undefined,
                      isRunning: true,
                    };
                    updateTask((task) => ({
                      ...task,
                      terminalOutput: [...task.terminalOutput, terminalEntry],
                    }));
                  }
                  break;

                case "tool-call-completed":
                  if (data.callId && data.toolCall) {
                    setActiveToolCalls((prev) => {
                      const next = new Set(prev);
                      next.delete(data.callId!);
                      return next;
                    });
                    updateAssistantMessage((msg) => {
                      const existingCall = msg.toolCalls?.get(data.callId!);
                      const toolWithTime = {
                        ...data.toolCall!,
                        startTime: existingCall?.startTime,
                        endTime: Date.now(),
                      };
                      const newToolCalls = new Map(msg.toolCalls);
                      newToolCalls.set(data.callId!, toolWithTime);
                      return { ...msg, toolCalls: newToolCalls };
                    });
                    
                    // Update tool output
                    updateTask((task) => ({
                      ...task,
                      terminalOutput: task.terminalOutput.map((entry) =>
                        entry.id === data.callId
                          ? {
                              ...entry,
                              output: data.toolCall?.result?.value 
                                ? (typeof data.toolCall.result.value === "string" 
                                  ? data.toolCall.result.value 
                                  : JSON.stringify(data.toolCall.result.value, null, 2))
                                : data.toolCall?.result?.error 
                                ? (typeof data.toolCall.result.error === "string"
                                  ? data.toolCall.result.error
                                  : JSON.stringify(data.toolCall.result.error, null, 2))
                                : "",
                              exitCode: data.toolCall?.result?.status === "success" ? 0 : 1,
                              isRunning: false,
                            }
                          : entry
                      ),
                    }));
                  }
                  break;

                case "summary":
                  if (data.summary) {
                    updateAssistantMessage((msg) => ({
                      ...msg,
                      summaries: [...(msg.summaries || []), data.summary!],
                    }));
                  }
                  break;

                case "token-delta":
                  if (data.tokens) {
                    updateTask((task) => ({
                      ...task,
                      tokenCount: task.tokenCount + data.tokens!,
                    }));
                  }
                  break;

                case "error":
                  updateTask((task) => ({
                    ...task,
                    status: "failed",
                    error: data.text || "Unknown error occurred",
                  }));
                  break;

                case "done":
                  updateAssistantMessage((msg) => ({
                    ...msg,
                    isStreaming: false,
                  }));
                  updateTask((task) => ({
                    ...task,
                    status: "completed",
                  }));
                  break;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        // Mark as complete
        updateTask((task) => ({
          ...task,
          status: task.status === "failed" ? "failed" : "completed",
          messages: task.messages.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false }
              : msg
          ),
        }));
      } catch (err) {
        // Mark task as failed
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: "failed",
                  error: err instanceof Error ? err.message : "Unknown error",
                  messages: t.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, isStreaming: false }
                      : msg
                  ),
                }
              : t
          )
        );
      }
    },
    [tasks, queueTaskSave]
  );

  // Close a task
  const handleCloseTask = useCallback(
    async (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (activeTaskId === taskId) {
        setActiveTaskId(tasks.find((t) => t.id !== taskId)?.id || null);
      }
      
      // Delete from database
      try {
        await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      } catch (error) {
        console.error("Failed to delete task:", error);
      }
    },
    [activeTaskId, tasks]
  );

  // Clear completed tasks
  const handleClearCompleted = useCallback(async () => {
    const completedIds = new Set(
      tasks
        .filter((t) => t.status === "completed" || t.status === "failed")
        .map((t) => t.id)
    );
    setTasks((prev) => prev.filter((t) => !completedIds.has(t.id)));
    if (activeTaskId && completedIds.has(activeTaskId)) {
      const remaining = tasks.filter((t) => !completedIds.has(t.id));
      setActiveTaskId(remaining[0]?.id || null);
    }
    
    // Delete from database
    try {
      await fetch("/api/tasks", { method: "DELETE" });
    } catch (error) {
      console.error("Failed to clear completed tasks:", error);
    }
  }, [tasks, activeTaskId]);

  return (
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-linear-to-br from-violet-500 to-purple-600 rounded-lg">
                <Terminal className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Multi-Repo Agent Manager</h1>
                <p className="text-xs text-muted-foreground">
                  Scan repos, run maintenance tasks in parallel
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/test"
                className="px-3 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 bg-violet-50 dark:bg-violet-950/30 hover:bg-violet-100 dark:hover:bg-violet-950/50 rounded-lg transition-colors"
              >
                🧪 Test Page
              </a>
              <DatabaseInfo />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - 3 Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Repo Scanner + List */}
        <div className="w-80 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-950">
          <RepoScanner onScan={handleScan} isScanning={isScanning} />
          <RepoList
            repos={repos}
            scannedPath={scannedPath}
            error={scanError}
            onAction={handleAction}
          />
        </div>

        {/* Center Panel - Agent View */}
        <div className="flex-1 flex flex-col min-w-0">
          {isLoadingTasks ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Loading persisted tasks...
                </p>
              </div>
            </div>
          ) : (
            <AgentView 
              task={activeTask} 
              activeToolCalls={activeToolCalls}
              onSendMessage={handleSendMessage}
            />
          )}
        </div>

        {/* Right Panel - Task Sidebar */}
        <TaskSidebar
          tasks={tasks}
          activeTaskId={activeTaskId}
          onSelectTask={setActiveTaskId}
          onCloseTask={handleCloseTask}
          onClearCompleted={handleClearCompleted}
        />
      </div>
    </div>
  );
}

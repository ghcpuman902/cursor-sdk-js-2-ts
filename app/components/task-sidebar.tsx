"use client";

import { ListTodo, Trash2 } from "lucide-react";
import type { AgentTask } from "@/lib/types";
import { TaskTab } from "./task-tab";
import { TerminalOutput } from "./terminal-output";

interface TaskSidebarProps {
  tasks: AgentTask[];
  activeTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onCloseTask: (taskId: string) => void;
  onClearCompleted: () => void;
}

export const TaskSidebar = ({
  tasks,
  activeTaskId,
  onSelectTask,
  onCloseTask,
  onClearCompleted,
}: TaskSidebarProps) => {
  const runningCount = tasks.filter((t) => t.status === "running").length;
  const completedCount = tasks.filter(
    (t) => t.status === "completed" || t.status === "failed"
  ).length;

  const activeTask = tasks.find((t) => t.id === activeTaskId);

  return (
    <div className="w-80 shrink-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-violet-500" />
            <h2 className="font-semibold text-sm">Tasks</h2>
            {tasks.length > 0 && (
              <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                {tasks.length}
              </span>
            )}
          </div>
          {runningCount > 0 && (
            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
              {runningCount} running
            </span>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center p-4">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              No active tasks
              <br />
              <span className="text-[10px]">
                Select an action from a project to start
              </span>
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskTab
              key={task.id}
              task={task}
              isActive={task.id === activeTaskId}
              onSelect={() => onSelectTask(task.id)}
              onClose={() => onCloseTask(task.id)}
            />
          ))
        )}
      </div>

      {/* Terminal Output Section - Always show when task is selected */}
      {activeTask && (
        <div className="h-48 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
          <TerminalOutput
            output={activeTask.terminalOutput}
            lastActivityTime={activeTask.lastActivityTime}
          />
        </div>
      )}

      {/* Footer */}
      {completedCount > 0 && (
        <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={onClearCompleted}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
            aria-label="Clear completed tasks"
            tabIndex={0}
          >
            <Trash2 className="w-3 h-3" />
            Clear {completedCount} completed
          </button>
        </div>
      )}
    </div>
  );
};

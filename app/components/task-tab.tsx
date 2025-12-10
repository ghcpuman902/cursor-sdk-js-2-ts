"use client";

import {
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  X,
  FileCode2,
  ArrowUpCircle,
  FileText,
  Package,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { useState, useEffect } from "react";
import type { AgentTask, TaskAction, TaskStatus } from "@/lib/types";

interface TaskTabProps {
  task: AgentTask;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  pending: <Circle className="w-3 h-3 text-zinc-400" />,
  running: <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />,
  completed: <CheckCircle2 className="w-3 h-3 text-green-500" />,
  failed: <XCircle className="w-3 h-3 text-red-500" />,
};

const ACTION_ICONS: Record<TaskAction, React.ReactNode> = {
  "upgrade-typescript": <FileCode2 className="w-3 h-3" />,
  "upgrade-framework": <ArrowUpCircle className="w-3 h-3" />,
  summarize: <FileText className="w-3 h-3" />,
  "update-deps": <Package className="w-3 h-3" />,
  custom: <MessageSquare className="w-3 h-3" />,
};

const ACTION_LABELS: Record<TaskAction, string> = {
  "upgrade-typescript": "TS",
  "upgrade-framework": "Upgrade",
  summarize: "README",
  "update-deps": "Deps",
  custom: "Custom",
};

export const TaskTab = ({ task, isActive, onSelect, onClose }: TaskTabProps) => {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Update current time periodically to recalculate idle time
  useEffect(() => {
    if (task.status !== "running") return;
    
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [task.status]);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  const handleCloseKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  // Check if task is stuck (no activity for 30+ seconds)
  const idleTime = task.lastActivityTime ? currentTime - task.lastActivityTime : 0;
  const isStuck = task.status === "running" && idleTime > 30000;

  return (
    <button
      type="button"
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={`group w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors ${
        isActive
          ? "bg-violet-100 dark:bg-violet-950/50 border border-violet-300 dark:border-violet-800"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent"
      }`}
      aria-label={`Task: ${task.repoName} - ${task.action}`}
      tabIndex={0}
    >
      {/* Status Icon */}
      <div className="shrink-0">{STATUS_ICONS[task.status]}</div>

      {/* Task Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium truncate" title={task.repoName}>
            {task.repoName}
          </span>
          {task.sessionId && (
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title="Active session" />
          )}
          {isStuck && (
            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
          {ACTION_ICONS[task.action]}
          <span>{ACTION_LABELS[task.action]}</span>
          {task.sessionId && (
            <span className="text-green-600 dark:text-green-400">• Chat</span>
          )}
          {isStuck && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              • Stuck {Math.floor(idleTime / 1000)}s
            </span>
          )}
        </div>
        {task.sessionId && (
          <div className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono truncate mt-0.5" title={task.sessionId}>
            Session: {task.sessionId}
          </div>
        )}
      </div>

      {/* Close Button */}
      <div
        role="button"
        onClick={handleClose}
        onKeyDown={handleCloseKeyDown}
        className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-opacity cursor-pointer"
        aria-label="Close task"
        tabIndex={0}
      >
        <X className="w-3 h-3 text-zinc-500" />
      </div>
    </button>
  );
};

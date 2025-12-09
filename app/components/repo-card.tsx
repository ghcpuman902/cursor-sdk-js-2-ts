"use client";

import { useState } from "react";
import {
  FileCode2,
  ArrowUpCircle,
  FileText,
  Package,
  MessageSquare,
  FolderGit2,
} from "lucide-react";
import type { RepoInfo, TaskAction } from "@/lib/types";

interface RepoCardProps {
  repo: RepoInfo;
  onAction: (repo: RepoInfo, action: TaskAction, customPrompt?: string) => void;
}

const FRAMEWORK_COLORS: Record<string, string> = {
  nextjs: "bg-black text-white dark:bg-white dark:text-black",
  react: "bg-cyan-500 text-white",
  vue: "bg-emerald-500 text-white",
  angular: "bg-red-500 text-white",
  svelte: "bg-orange-500 text-white",
  other: "bg-zinc-500 text-white",
};

const FRAMEWORK_LABELS: Record<string, string> = {
  nextjs: "Next.js",
  react: "React",
  vue: "Vue",
  angular: "Angular",
  svelte: "Svelte",
  other: "Other",
};

export const RepoCard = ({ repo, onAction }: RepoCardProps) => {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const handleAction = (action: TaskAction) => {
    if (action === "custom") {
      setShowCustomInput(true);
      return;
    }
    onAction(repo, action);
  };

  const handleCustomSubmit = () => {
    if (customPrompt.trim()) {
      onAction(repo, "custom", customPrompt.trim());
      setCustomPrompt("");
      setShowCustomInput(false);
    }
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCustomSubmit();
    }
    if (e.key === "Escape") {
      setShowCustomInput(false);
      setCustomPrompt("");
    }
  };

  // Truncate path for display
  const displayPath = repo.path.replace(process.env.HOME || "~", "~");
  const shortPath =
    displayPath.length > 50
      ? "..." + displayPath.slice(-47)
      : displayPath;

  return (
    <div className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <FolderGit2 className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-sm truncate" title={repo.name}>
            {repo.name}
          </h3>
          <p
            className="text-xs text-zinc-500 dark:text-zinc-400 truncate"
            title={displayPath}
          >
            {shortPath}
          </p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {repo.framework && (
          <span
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
              FRAMEWORK_COLORS[repo.framework] || FRAMEWORK_COLORS.other
            }`}
          >
            {FRAMEWORK_LABELS[repo.framework] || repo.framework}
            {repo.frameworkVersion && (
              <span className="ml-1 opacity-75">
                {repo.frameworkVersion.replace("^", "")}
              </span>
            )}
          </span>
        )}
        <span
          className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
            repo.hasTypescript
              ? "bg-blue-500 text-white"
              : "bg-yellow-500 text-black"
          }`}
        >
          {repo.hasTypescript ? "TS" : "JS"}
        </span>
      </div>

      {/* Custom Prompt Input */}
      {showCustomInput && (
        <div className="mb-3">
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={handleCustomKeyDown}
            placeholder="Enter your custom prompt..."
            className="w-full px-2 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-zinc-50 dark:bg-zinc-800 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
            rows={2}
            autoFocus
            aria-label="Custom prompt input"
            tabIndex={0}
          />
          <div className="flex gap-1 mt-1">
            <button
              type="button"
              onClick={handleCustomSubmit}
              disabled={!customPrompt.trim()}
              className="px-2 py-1 text-[10px] font-medium bg-violet-500 text-white rounded hover:bg-violet-600 disabled:opacity-50"
              tabIndex={0}
            >
              Run
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCustomInput(false);
                setCustomPrompt("");
              }}
              className="px-2 py-1 text-[10px] font-medium bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600"
              tabIndex={0}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-1">
        <ActionButton
          icon={<FileCode2 className="w-3 h-3" />}
          label="TS"
          title="Convert to TypeScript"
          onClick={() => handleAction("upgrade-typescript")}
          disabled={repo.hasTypescript}
        />
        <ActionButton
          icon={<ArrowUpCircle className="w-3 h-3" />}
          label="Upgrade"
          title="Upgrade framework"
          onClick={() => handleAction("upgrade-framework")}
          disabled={!repo.framework}
        />
        <ActionButton
          icon={<FileText className="w-3 h-3" />}
          label="README"
          title="Generate README"
          onClick={() => handleAction("summarize")}
        />
        <ActionButton
          icon={<Package className="w-3 h-3" />}
          label="Deps"
          title="Update dependencies"
          onClick={() => handleAction("update-deps")}
        />
        <ActionButton
          icon={<MessageSquare className="w-3 h-3" />}
          label="Custom"
          title="Custom prompt"
          onClick={() => handleAction("custom")}
          isActive={showCustomInput}
        />
      </div>
    </div>
  );
};

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  isActive?: boolean;
}

const ActionButton = ({
  icon,
  label,
  title,
  onClick,
  disabled,
  isActive,
}: ActionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-colors ${
      isActive
        ? "bg-violet-500 text-white"
        : disabled
          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
          : "bg-zinc-100 dark:bg-zinc-800 hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-400"
    }`}
    aria-label={title}
    tabIndex={disabled ? -1 : 0}
  >
    {icon}
    {label}
  </button>
);

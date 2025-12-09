"use client";

import { FolderOpen, AlertCircle } from "lucide-react";
import type { RepoInfo, TaskAction } from "@/lib/types";
import { RepoCard } from "./repo-card";

interface RepoListProps {
  repos: RepoInfo[];
  scannedPath: string | null;
  error: string | null;
  onAction: (repo: RepoInfo, action: TaskAction, customPrompt?: string) => void;
}

export const RepoList = ({
  repos,
  scannedPath,
  error,
  onAction,
}: RepoListProps) => {
  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state - not yet scanned
  if (!scannedPath) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <FolderOpen className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Select a directory and scan to find projects
          </p>
        </div>
      </div>
    );
  }

  // Empty state - scanned but no repos found
  if (repos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <FolderOpen className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No projects found in
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 font-mono">
            {scannedPath}
          </p>
        </div>
      </div>
    );
  }

  // Repos list
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {repos.length} project{repos.length !== 1 ? "s" : ""} found
          </span>
          <span
            className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate max-w-[150px]"
            title={scannedPath}
          >
            {scannedPath.replace(process.env.HOME || "~", "~")}
          </span>
        </div>

        {/* Grid */}
        <div className="space-y-2">
          {repos.map((repo) => (
            <RepoCard key={repo.path} repo={repo} onAction={onAction} />
          ))}
        </div>
      </div>
    </div>
  );
};

"use client";

import { useState } from "react";
import {
  FolderOpen,
  AlertCircle,
  Filter,
  X,
  CheckSquare,
  Square,
  FileCode2,
  ArrowUpCircle,
  FileText,
  Package,
  MessageSquare,
} from "lucide-react";
import type { RepoInfo, TaskAction } from "@/lib/types";
import { RepoCard } from "./repo-card";

interface RepoListProps {
  repos: RepoInfo[];
  filteredRepos: RepoInfo[];
  scannedPath: string | null;
  error: string | null;
  onAction: (repo: RepoInfo, action: TaskAction, customPrompt?: string) => void;
  frameworkFilter: string;
  onFrameworkFilterChange: (value: string) => void;
  versionFilter: string;
  onVersionFilterChange: (value: string) => void;
  typescriptFilter: string;
  onTypescriptFilterChange: (value: string) => void;
  selectedRepos: Set<string>;
  onToggleSelection: (repoPath: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBatchAction: (action: TaskAction, customPrompt?: string) => void;
}

export const RepoList = ({
  repos,
  filteredRepos,
  scannedPath,
  error,
  onAction,
  frameworkFilter,
  onFrameworkFilterChange,
  versionFilter,
  onVersionFilterChange,
  typescriptFilter,
  onTypescriptFilterChange,
  selectedRepos,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onBatchAction,
}: RepoListProps) => {
  const [showFilters, setShowFilters] = useState(false);
  const [showBatchCustomInput, setShowBatchCustomInput] = useState(false);
  const [batchCustomPrompt, setBatchCustomPrompt] = useState("");

  // Extract unique frameworks and versions from scanned repos
  const availableFrameworks = Array.from(
    new Set(
      repos
        .map((r) => r.framework)
        .filter((f): f is NonNullable<typeof f> => f !== null)
    )
  ).sort();

  // Group repos by framework and version for detailed filtering
  const frameworkVersions = repos.reduce((acc, repo) => {
    if (repo.framework && repo.frameworkVersion) {
      if (!acc[repo.framework]) {
        acc[repo.framework] = new Set();
      }
      acc[repo.framework].add(repo.frameworkVersion.replace("^", "").replace("~", ""));
    }
    return acc;
  }, {} as Record<string, Set<string>>);

  // Get available versions for selected framework
  const availableVersions = frameworkFilter !== "all" && frameworkVersions[frameworkFilter]
    ? Array.from(frameworkVersions[frameworkFilter]).sort((a, b) => {
        // Sort versions numerically
        const aNum = parseFloat(a);
        const bNum = parseFloat(b);
        return aNum - bNum;
      })
    : [];

  // Count repos by TypeScript usage
  const tsCount = repos.filter((r) => r.hasTypescript).length;
  const jsCount = repos.filter((r) => !r.hasTypescript).length;

  // Get framework label with proper formatting
  const getFrameworkLabel = (framework: string): string => {
    const labels: Record<string, string> = {
      nextjs: "Next.js",
      react: "React",
      vue: "Vue",
      angular: "Angular",
      svelte: "Svelte",
      other: "Other",
    };
    return labels[framework] || framework.charAt(0).toUpperCase() + framework.slice(1);
  };
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

  const handleBatchAction = (action: TaskAction) => {
    if (action === "custom") {
      setShowBatchCustomInput(true);
      return;
    }
    onBatchAction(action);
  };

  const handleBatchCustomSubmit = () => {
    if (batchCustomPrompt.trim()) {
      onBatchAction("custom", batchCustomPrompt.trim());
      setBatchCustomPrompt("");
      setShowBatchCustomInput(false);
    }
  };

  const activeFilterCount = [
    frameworkFilter !== "all" ? 1 : 0,
    versionFilter !== "all" ? 1 : 0,
    typescriptFilter !== "all" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  // Build active filter description for tooltip
  const activeFilterDesc = [
    frameworkFilter !== "all" ? getFrameworkLabel(frameworkFilter) : null,
    versionFilter !== "all" ? `v${versionFilter}` : null,
    typescriptFilter === "typescript" ? "TypeScript" : typescriptFilter === "javascript" ? "JavaScript" : null,
  ].filter(Boolean).join(", ");

  // Repos list
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          {/* Header with Filter Toggle */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {filteredRepos.length} / {repos.length} project{repos.length !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Toggle filters"
                title={activeFilterCount > 0 ? `Active filters: ${activeFilterDesc}` : "Open filters"}
              >
                <Filter className="w-3 h-3" />
                {activeFilterCount > 0 && (
                  <span className="text-violet-600 dark:text-violet-400">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
            <span
              className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate max-w-[100px]"
              title={scannedPath}
            >
              {scannedPath.replace(process.env.HOME || "~", "~")}
            </span>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mb-3 p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 space-y-3">
              {/* Quick Stats */}
              <div className="pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <div className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Repository Summary
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400">Total:</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{repos.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400">Frameworks:</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{availableFrameworks.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400">TypeScript:</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">{tsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400">JavaScript:</span>
                    <span className="font-medium text-yellow-600 dark:text-yellow-400">{jsCount}</span>
                  </div>
                </div>
              </div>

              {/* Framework Filter */}
              <div>
                <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                  Framework
                </label>
                <select
                  value={frameworkFilter}
                  onChange={(e) => onFrameworkFilterChange(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="all">All Frameworks ({repos.length})</option>
                  {availableFrameworks.map((fw) => {
                    const count = repos.filter((r) => r.framework === fw).length;
                    return (
                      <option key={fw} value={fw}>
                        {getFrameworkLabel(fw)} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Version Filter - Only show if framework is selected */}
              {frameworkFilter !== "all" && availableVersions.length > 0 && (
                <div>
                  <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                    Version
                  </label>
                  <select
                    value={versionFilter}
                    onChange={(e) => onVersionFilterChange(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="all">
                      All Versions ({repos.filter((r) => r.framework === frameworkFilter).length})
                    </option>
                    {availableVersions.map((version) => {
                      const count = repos.filter(
                        (r) =>
                          r.framework === frameworkFilter &&
                          r.frameworkVersion?.replace("^", "").replace("~", "") === version
                      ).length;
                      return (
                        <option key={version} value={version}>
                          v{version} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* TypeScript Filter */}
              <div>
                <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                  Language
                </label>
                <select
                  value={typescriptFilter}
                  onChange={(e) => onTypescriptFilterChange(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="all">All Languages ({repos.length})</option>
                  <option value="typescript">TypeScript Only ({tsCount})</option>
                  <option value="javascript">JavaScript Only ({jsCount})</option>
                </select>
              </div>

              {/* Filter Results & Clear */}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                {activeFilterCount > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        Showing {filteredRepos.length} of {repos.length}
                      </span>
                      <span className="text-violet-600 dark:text-violet-400 font-medium">
                        {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onFrameworkFilterChange("all");
                        onVersionFilterChange("all");
                        onTypescriptFilterChange("all");
                      }}
                      className="w-full px-2 py-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    >
                      Clear All Filters
                    </button>
                  </div>
                ) : (
                  <div className="text-[10px] text-center text-zinc-400 dark:text-zinc-500 py-1">
                    No filters applied
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Selection Header */}
          {filteredRepos.length > 0 && (
            <div className="flex items-center justify-between mb-2 px-1">
              <button
                type="button"
                onClick={() => {
                  if (selectedRepos.size === filteredRepos.length) {
                    onClearSelection();
                  } else {
                    onSelectAll();
                  }
                }}
                className="flex items-center gap-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                aria-label="Toggle select all"
              >
                {selectedRepos.size === filteredRepos.length && filteredRepos.length > 0 ? (
                  <CheckSquare className="w-3.5 h-3.5" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                Select All
              </button>
              {selectedRepos.size > 0 && (
                <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400">
                  {selectedRepos.size} selected
                </span>
              )}
            </div>
          )}

          {/* Grid */}
          <div className="space-y-2">
            {filteredRepos.map((repo) => (
              <RepoCard
                key={repo.path}
                repo={repo}
                onAction={onAction}
                isSelected={selectedRepos.has(repo.path)}
                onToggleSelection={onToggleSelection}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Batch Action Footer */}
      {selectedRepos.size > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Batch Actions
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
              aria-label="Clear selection"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          </div>

          {/* Batch Custom Input */}
          {showBatchCustomInput && (
            <div className="mb-2">
              <textarea
                value={batchCustomPrompt}
                onChange={(e) => setBatchCustomPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleBatchCustomSubmit();
                  }
                  if (e.key === "Escape") {
                    setShowBatchCustomInput(false);
                    setBatchCustomPrompt("");
                  }
                }}
                placeholder="Enter custom prompt for all selected repos..."
                className="w-full px-2 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                rows={2}
                autoFocus
              />
              <div className="flex gap-1 mt-1">
                <button
                  type="button"
                  onClick={handleBatchCustomSubmit}
                  disabled={!batchCustomPrompt.trim()}
                  className="px-2 py-1 text-[10px] font-medium bg-violet-500 text-white rounded hover:bg-violet-600 disabled:opacity-50 transition-colors"
                >
                  Run on {selectedRepos.size} repos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBatchCustomInput(false);
                    setBatchCustomPrompt("");
                  }}
                  className="px-2 py-1 text-[10px] font-medium bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Batch Action Buttons */}
          <div className="flex flex-wrap gap-1">
            <BatchActionButton
              icon={<FileCode2 className="w-3 h-3" />}
              label="TypeScript"
              onClick={() => handleBatchAction("upgrade-typescript")}
            />
            <BatchActionButton
              icon={<ArrowUpCircle className="w-3 h-3" />}
              label="Upgrade"
              onClick={() => handleBatchAction("upgrade-framework")}
            />
            <BatchActionButton
              icon={<FileText className="w-3 h-3" />}
              label="README"
              onClick={() => handleBatchAction("summarize")}
            />
            <BatchActionButton
              icon={<Package className="w-3 h-3" />}
              label="Deps"
              onClick={() => handleBatchAction("update-deps")}
            />
            <BatchActionButton
              icon={<MessageSquare className="w-3 h-3" />}
              label="Custom"
              onClick={() => handleBatchAction("custom")}
              isActive={showBatchCustomInput}
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface BatchActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}

const BatchActionButton = ({
  icon,
  label,
  onClick,
  isActive,
}: BatchActionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-colors ${
      isActive
        ? "bg-violet-500 text-white"
        : "bg-white dark:bg-zinc-800 hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-400 border border-zinc-200 dark:border-zinc-700"
    }`}
    aria-label={`Batch ${label}`}
  >
    {icon}
    {label}
  </button>
);

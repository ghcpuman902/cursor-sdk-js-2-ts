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
  Search,
} from "lucide-react";
import type { RepoInfo, TaskAction } from "@/lib/types";
import { RepoCard } from "./repo-card";
import { actionPrompts } from "@/app/page";

interface RepoListProps {
  repos: RepoInfo[];
  filteredRepos: RepoInfo[];
  scannedPath: string | null;
  error: string | null;
  onAction: (repo: RepoInfo, action: TaskAction, customPrompt?: string) => void;
  frameworkFilter: string[];
  onFrameworkFilterChange: (value: string[]) => void;
  versionFilter: string[];
  onVersionFilterChange: (value: string[]) => void;
  typescriptFilter: string[];
  onTypescriptFilterChange: (value: string[]) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
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
  searchQuery,
  onSearchQueryChange,
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

  // Group versions by framework
  const versionsByFramework = repos.reduce<Record<string, Set<string>>>((acc, repo) => {
    if (repo.framework && repo.frameworkVersion) {
      const version = repo.frameworkVersion.replace("^", "").replace("~", "");
      if (!acc[repo.framework]) {
        acc[repo.framework] = new Set();
      }
      acc[repo.framework].add(version);
    }
    return acc;
  }, {});

  // Sort versions for each framework
  const sortedVersionsByFramework = Object.entries(versionsByFramework).reduce<
    Record<string, string[]>
  >((acc, [framework, versions]) => {
    acc[framework] = Array.from(versions).sort((a, b) => {
      const aNum = parseFloat(a);
      const bNum = parseFloat(b);
      return aNum - bNum;
    });
    return acc;
  }, {});

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

  const activeFilterCount = versionFilter.length + typescriptFilter.length;

  // Toggle functions for multi-select
  const toggleFramework = (fw: string) => {
    if (frameworkFilter.includes(fw)) {
      onFrameworkFilterChange(frameworkFilter.filter((f) => f !== fw));
    } else {
      onFrameworkFilterChange([...frameworkFilter, fw]);
    }
  };

  const toggleVersion = (ver: string) => {
    if (versionFilter.includes(ver)) {
      onVersionFilterChange(versionFilter.filter((v) => v !== ver));
    } else {
      onVersionFilterChange([...versionFilter, ver]);
    }
  };

  const toggleLanguage = (lang: string) => {
    if (typescriptFilter.includes(lang)) {
      onTypescriptFilterChange(typescriptFilter.filter((l) => l !== lang));
    } else {
      onTypescriptFilterChange([...typescriptFilter, lang]);
    }
  };

  const toggleAllFrameworkVersions = (framework: string) => {
    const frameworkVersions = sortedVersionsByFramework[framework] || [];
    const allSelected = frameworkVersions.every((v) => versionFilter.includes(v));
    
    if (allSelected) {
      // Deselect all versions of this framework
      onVersionFilterChange(versionFilter.filter((v) => !frameworkVersions.includes(v)));
    } else {
      // Select all versions of this framework
      const newVersions = [...versionFilter];
      frameworkVersions.forEach((v) => {
        if (!newVersions.includes(v)) {
          newVersions.push(v);
        }
      });
      onVersionFilterChange(newVersions);
    }
  };

  // Repos list
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sticky Header with Search and Select All */}
      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
        <div className="p-3 space-y-2">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search repos by name, path, or framework..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchQueryChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
              </button>
            )}
          </div>

          {/* Top Bar with Check All, Count, and Filter */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              {filteredRepos.length > 0 && (
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
              )}
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {filteredRepos.length} / {repos.length} project{repos.length !== 1 ? "s" : ""}
              </span>
              {selectedRepos.size > 0 && (
                <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400">
                  ({selectedRepos.size} selected)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate max-w-[100px]"
                title={scannedPath}
              >
                {scannedPath.replace(process.env.HOME || "~", "~")}
              </span>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Toggle filters"
              >
                <Filter className="w-3 h-3" />
                {activeFilterCount > 0 && (
                  <span className="text-violet-600 dark:text-violet-400">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          {/* Filter Panel */}
          {showFilters && (
            <div className="mb-3 p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 space-y-2">
              {/* Version Groups by Framework */}
              {Object.entries(sortedVersionsByFramework).map(([framework, versions]) => {
                if (versions.length === 0) return null;
                
                const frameworkBadges: Record<string, string> = {
                  nextjs: "https://img.shields.io/badge/Next.js-black?logo=next.js&logoColor=white",
                  react: "https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black",
                  vue: "https://img.shields.io/badge/Vue-4FC08D?logo=vue.js&logoColor=white",
                  angular: "https://img.shields.io/badge/Angular-DD0031?logo=angular&logoColor=white",
                  svelte: "https://img.shields.io/badge/Svelte-FF3E00?logo=svelte&logoColor=white",
                };

                const frameworkVersions = versions;
                const allSelected = frameworkVersions.every((v) => versionFilter.includes(v));

                return (
                  <div key={framework}>
                    <div className="flex items-center gap-2 mb-1.5">
                      {frameworkBadges[framework] && (
                        <img
                          src={frameworkBadges[framework]}
                          alt={`${getFrameworkLabel(framework)} badge`}
                          className="h-4"
                        />
                      )}
                      {!frameworkBadges[framework] && (
                        <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                          {getFrameworkLabel(framework)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleAllFrameworkVersions(framework)}
                        className={`text-[10px] font-medium transition-colors underline ${
                          allSelected
                            ? "text-violet-600 dark:text-violet-400"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400"
                        }`}
                        aria-label={`Toggle all ${getFrameworkLabel(framework)} versions`}
                      >
                        {allSelected ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 ml-5">
                      {versions.map((version) => {
                        const count = repos.filter(
                          (r) =>
                            r.framework === framework &&
                            r.frameworkVersion?.replace("^", "").replace("~", "") === version
                        ).length;
                        const isActive = versionFilter.includes(version);
                        return (
                          <button
                            key={version}
                            type="button"
                            onClick={() => toggleVersion(version)}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors ${
                              isActive
                                ? "bg-violet-500 text-white"
                                : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:border-violet-400 dark:hover:border-violet-600"
                            }`}
                            aria-label={`Filter by ${getFrameworkLabel(framework)} version ${version}`}
                          >
                            v{version} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Language Capsules */}
              <div>
                <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1.5">
                  Languages
                </label>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => toggleLanguage("typescript")}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors ${
                      typescriptFilter.includes("typescript")
                        ? "bg-blue-500 text-white"
                        : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-600"
                    }`}
                    aria-label="Filter by TypeScript"
                  >
                    TypeScript ({repos.filter((r) => r.hasTypescript).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleLanguage("javascript")}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors ${
                      typescriptFilter.includes("javascript")
                        ? "bg-yellow-500 text-white"
                        : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:border-yellow-400 dark:hover:border-yellow-600"
                    }`}
                    aria-label="Filter by JavaScript"
                  >
                    JavaScript ({repos.filter((r) => !r.hasTypescript).length})
                  </button>
                </div>
              </div>

              {/* Clear Filters */}
              {activeFilterCount > 0 && (
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Showing {filteredRepos.length} of {repos.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onVersionFilterChange([]);
                      onTypescriptFilterChange([]);
                    }}
                    className="px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                  >
                    Clear All ({activeFilterCount})
                  </button>
                </div>
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
              label="Upgrade TS"
              legend={actionPrompts["upgrade-typescript"]}
              onClick={() => handleBatchAction("upgrade-typescript")}
            />
            <BatchActionButton
              icon={<ArrowUpCircle className="w-3 h-3" />}
                label="Upgrade Framework"
              legend={actionPrompts["upgrade-framework"]}
              onClick={() => handleBatchAction("upgrade-framework")}
            />
            <BatchActionButton
              icon={<FileText className="w-3 h-3" />}
              label="README"
              legend={actionPrompts["summarize"]}
              onClick={() => handleBatchAction("summarize")}
            />
            <BatchActionButton
              icon={<Package className="w-3 h-3" />}
              label="Deps"
              legend={actionPrompts["update-deps"]}
              onClick={() => handleBatchAction("update-deps")}
            />
            <BatchActionButton
              icon={<MessageSquare className="w-3 h-3" />}
              label="Custom"
              legend="Custom prompt"
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
  legend: string;
  onClick: () => void;
  isActive?: boolean;
}

const BatchActionButton = ({
  icon,
  label,
  legend,
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
    title={legend}
  >
    {icon}
    {label}
  </button>
);

"use client";

import { Database, Info, RefreshCw, FileText, HardDrive, Activity, ChevronDown, ChevronRight, Trash2, XCircle } from "lucide-react";
import { useState, useEffect } from "react";

interface DbInfo {
  path: string;
  files: {
    tasks: string;
    repos: string;
  };
  size: {
    bytes: number;
    mb: string;
    breakdown: {
      tasks: string;
      repos: string;
    };
  };
  tables: {
    tasks: number;
    messages: number;
    tool_calls: number;
    scanned_repos: number;
  };
  tasksByStatus: Record<string, number>;
  recentTasks: Array<{
    id: string;
    repo_name: string;
    action: string;
    status: string;
    created_at: number;
    token_count: number;
  }>;
  totalTokens: number;
  schema: {
    storage: string;
    files: Array<{ name: string; description: string }>;
  };
}

export const DatabaseInfo = () => {
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["overview"]));
  const [isClearing, setIsClearing] = useState(false);
  const [isKilling, setIsKilling] = useState(false);

  const fetchDbInfo = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/db-info");
      if (res.ok) {
        const data = await res.json();
        setDbInfo(data);
      }
    } catch (error) {
      console.error("Failed to get DB info:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (showInfo && !dbInfo) {
      fetchDbInfo();
    }
  }, [showInfo]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const handleClearCache = async () => {
    if (!confirm("Are you sure you want to clear ALL cached data? This will delete all tasks and scanned repos.")) {
      return;
    }
    
    setIsClearing(true);
    try {
      const res = await fetch("/api/tasks?all=true", { method: "DELETE" });
      if (res.ok) {
        alert("All cache cleared successfully!");
        fetchDbInfo(); // Refresh the info
        window.location.reload(); // Reload to update UI
      } else {
        alert("Failed to clear cache");
      }
    } catch (error) {
      console.error("Error clearing cache:", error);
      alert("Error clearing cache");
    } finally {
      setIsClearing(false);
    }
  };

  const handleKillAgents = async () => {
    if (!confirm("Are you sure you want to kill all active agent sessions? This will terminate all running agents.")) {
      return;
    }
    
    setIsKilling(true);
    try {
      const res = await fetch("/api/agent", { method: "DELETE" });
      if (res.ok) {
        alert("All agent sessions terminated successfully!");
      } else {
        alert("Failed to kill agents");
      }
    } catch (error) {
      console.error("Error killing agents:", error);
      alert("Error killing agents");
    } finally {
      setIsKilling(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowInfo(!showInfo)}
        className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
        aria-label="Database information"
      >
        <Database className="w-4 h-4" />
        <span>Data Storage</span>
        <Info className="w-3 h-3" />
      </button>

      {showInfo && (
        <>
          {/* Backdrop to close on click outside */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowInfo(false)}
            aria-hidden="true"
          />
          
          {/* Popup positioned below and to the right - much wider */}
          <div className="absolute top-full right-0 mt-2 w-[600px] max-h-[600px] overflow-y-auto bg-popover text-popover-foreground border border-border rounded-lg shadow-lg text-xs z-50">
            {/* Header */}
            <div className="sticky top-0 bg-popover border-b border-border p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">Database Inspector</h3>
                </div>
                <button
                  onClick={fetchDbInfo}
                  disabled={isLoading}
                  className="p-1.5 hover:bg-accent rounded transition-colors disabled:opacity-50"
                  aria-label="Refresh database info"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleKillAgents}
                  disabled={isKilling}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900 rounded transition-colors disabled:opacity-50"
                  aria-label="Kill all agents"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  {isKilling ? "Killing..." : "Kill All Agents"}
                </button>
                <button
                  onClick={handleClearCache}
                  disabled={isClearing}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50 border border-orange-200 dark:border-orange-900 rounded transition-colors disabled:opacity-50"
                  aria-label="Clear all cache"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isClearing ? "Clearing..." : "Clear All Cache"}
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-3 space-y-3">
              {isLoading && !dbInfo ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : dbInfo ? (
                <>
                  {/* Overview Section */}
                  <div className="border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection("overview")}
                      className="w-full flex items-center justify-between p-2 bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-3.5 h-3.5 text-primary" />
                        <span className="font-medium">Overview</span>
                      </div>
                      {expandedSections.has("overview") ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    
                    {expandedSections.has("overview") && (
                      <div className="p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 bg-accent/50 rounded">
                            <p className="text-[10px] text-muted-foreground">Database Size</p>
                            <p className="font-mono font-semibold">{dbInfo.size.mb} MB</p>
                          </div>
                          <div className="p-2 bg-accent/50 rounded">
                            <p className="text-[10px] text-muted-foreground">Total Tokens</p>
                            <p className="font-mono font-semibold">{formatNumber(dbInfo.totalTokens)}</p>
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t border-border space-y-2">
                          <div>
                            <p className="font-medium mb-1">Storage Directory:</p>
                            <code className="block p-2 bg-muted rounded text-[10px] break-all">
                              {dbInfo.path}
                            </code>
                          </div>
                          <div>
                            <p className="font-medium mb-1">Files:</p>
                            <div className="space-y-1">
                              <code className="block p-1.5 bg-muted rounded text-[10px] break-all">
                                📄 {dbInfo.files.tasks.split('/').pop()} ({dbInfo.size.breakdown.tasks})
                              </code>
                              <code className="block p-1.5 bg-muted rounded text-[10px] break-all">
                                📄 {dbInfo.files.repos.split('/').pop()} ({dbInfo.size.breakdown.repos})
                              </code>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tables Section */}
                  <div className="border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection("tables")}
                      className="w-full flex items-center justify-between p-2 bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span className="font-medium">Tables & Row Counts</span>
                      </div>
                      {expandedSections.has("tables") ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    
                    {expandedSections.has("tables") && (
                      <div className="p-3">
                        <div className="space-y-1.5">
                          {Object.entries(dbInfo.tables).map(([table, count]) => (
                            <div
                              key={table}
                              className="flex items-center justify-between p-2 bg-accent/30 rounded hover:bg-accent/50 transition-colors"
                            >
                              <span className="font-mono text-[11px]">{table}</span>
                              <span className="font-semibold text-primary">{formatNumber(count)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Task Status Breakdown */}
                  <div className="border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection("status")}
                      className="w-full flex items-center justify-between p-2 bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-primary" />
                        <span className="font-medium">Task Status Breakdown</span>
                      </div>
                      {expandedSections.has("status") ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    
                    {expandedSections.has("status") && (
                      <div className="p-3">
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(dbInfo.tasksByStatus).map(([status, count]) => (
                            <div
                              key={status}
                              className="p-2 bg-accent/30 rounded"
                            >
                              <p className="text-[10px] text-muted-foreground capitalize">{status}</p>
                              <p className="font-mono font-semibold">{formatNumber(count)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recent Tasks */}
                  <div className="border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection("recent")}
                      className="w-full flex items-center justify-between p-2 bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-primary" />
                        <span className="font-medium">Recent Tasks (Last 10)</span>
                      </div>
                      {expandedSections.has("recent") ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    
                    {expandedSections.has("recent") && (
                      <div className="p-3">
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {dbInfo.recentTasks.map((task) => (
                            <div
                              key={task.id}
                              className="p-2 bg-accent/30 rounded space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium truncate">{task.repo_name}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    task.status === "completed"
                                      ? "bg-green-500/20 text-green-700 dark:text-green-400"
                                      : task.status === "failed"
                                      ? "bg-red-500/20 text-red-700 dark:text-red-400"
                                      : task.status === "running"
                                      ? "bg-blue-500/20 text-blue-700 dark:text-blue-400"
                                      : "bg-gray-500/20 text-gray-700 dark:text-gray-400"
                                  }`}
                                >
                                  {task.status}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span className="capitalize">{task.action.replace("-", " ")}</span>
                                <span>{formatNumber(task.token_count)} tokens</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                {formatDate(task.created_at)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Storage Info Section */}
                  <div className="border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection("schema")}
                      className="w-full flex items-center justify-between p-2 bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span className="font-medium">Storage Info</span>
                      </div>
                      {expandedSections.has("schema") ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    
                    {expandedSections.has("schema") && (
                      <div className="p-3 space-y-3">
                        <div className="p-2 bg-accent/30 rounded">
                          <p className="font-medium mb-1">Storage Type</p>
                          <p className="text-[11px] text-muted-foreground">{dbInfo.schema.storage}</p>
                        </div>
                        
                        <div>
                          <p className="font-medium mb-2">Data Files</p>
                          <div className="space-y-2">
                            {dbInfo.schema.files.map((file) => (
                              <div
                                key={file.name}
                                className="p-2 bg-accent/30 rounded space-y-1"
                              >
                                <p className="font-mono text-[11px] font-semibold">{file.name}</p>
                                <p className="text-[10px] text-muted-foreground">{file.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info Footer */}
                  <div className="pt-2 border-t border-border text-muted-foreground space-y-1">
                    <p className="flex items-center gap-1.5">
                      <span className="text-green-600 dark:text-green-500">✓</span>
                      Persists across restarts
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="text-green-600 dark:text-green-500">✓</span>
                      No data loss on crashes
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="text-green-600 dark:text-green-500">✓</span>
                      All data stored locally
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  No database information available
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};


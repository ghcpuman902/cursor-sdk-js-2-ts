import path from "path";
import fs from "fs";
import type { AgentTask, ChatMessage, ToolCall } from "./types";

// Storage directory - stored in user's home directory for persistence
const getStorageDir = () => {
  const homeDir = process.env.HOME || process.env.USERPROFILE || process.cwd();
  const storageDir = path.join(homeDir, ".cursor-sdk-manager");
  
  // Ensure storage directory exists
  if (!fs.existsSync(storageDir)) {
    try {
      fs.mkdirSync(storageDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create storage directory:", error);
      // Fallback to current working directory
      return process.cwd();
    }
  }
  
  return storageDir;
};

const STORAGE_DIR = getStorageDir();
const TASKS_FILE = path.join(STORAGE_DIR, "tasks.json");
const REPOS_FILE = path.join(STORAGE_DIR, "scanned-repos.json");

// In-memory cache
interface DataStore {
  tasks: AgentTask[];
  scannedRepos: Array<{
    scanKey: string;
    scannedPath: string;
    repos: unknown[];
    scannedAt: number;
  }>;
}

let dataStore: DataStore = {
  tasks: [],
  scannedRepos: [],
};

// Load data from disk
const loadData = () => {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      const tasksData = JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8"));
      // Messages are now stored with metadata as objects, no Map conversion needed
      dataStore.tasks = tasksData;
    }
    
    if (fs.existsSync(REPOS_FILE)) {
      dataStore.scannedRepos = JSON.parse(fs.readFileSync(REPOS_FILE, "utf-8"));
    }
  } catch (error) {
    console.error("Failed to load data from disk:", error);
  }
};

// Save data to disk
const saveData = () => {
  try {
    // Save tasks - messages already in JSON-serializable format
    fs.writeFileSync(TASKS_FILE, JSON.stringify(dataStore.tasks, null, 2), "utf-8");
    
    // Save scanned repos
    fs.writeFileSync(REPOS_FILE, JSON.stringify(dataStore.scannedRepos, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save data to disk:", error);
  }
};

// Initialize by loading existing data
loadData();

// No schema initialization needed for JSON storage

// Database operations
export const dbOperations = {
  // Save a new task
  saveTask: (task: AgentTask) => {
    const existingIndex = dataStore.tasks.findIndex((t) => t.id === task.id);
    if (existingIndex >= 0) {
      dataStore.tasks[existingIndex] = task;
    } else {
      dataStore.tasks.unshift(task);
    }
    saveData();
  },

  // Update existing task
  updateTask: (task: AgentTask) => {
    const index = dataStore.tasks.findIndex((t) => t.id === task.id);
    if (index >= 0) {
      dataStore.tasks[index] = task;
      saveData();
    }
  },

  // Load all tasks
  loadTasks: (): AgentTask[] => {
    return dataStore.tasks.sort((a, b) => b.createdAt - a.createdAt);
  },

  // Get a specific task
  getTask: (taskId: string): AgentTask | null => {
    return dataStore.tasks.find((t) => t.id === taskId) || null;
  },

  // Delete a task
  deleteTask: (taskId: string) => {
    dataStore.tasks = dataStore.tasks.filter((t) => t.id !== taskId);
    saveData();
  },

  // Clear completed tasks
  clearCompleted: () => {
    dataStore.tasks = dataStore.tasks.filter(
      (t) => t.status !== "completed" && t.status !== "failed"
    );
    saveData();
  },

  // Clear all cache (tasks and repos)
  clearAllCache: () => {
    dataStore.tasks = [];
    dataStore.scannedRepos = [];
    saveData();
  },

  // Save scanned repos result
  saveScannedRepos: (scanKey: string, scannedPath: string, repos: unknown[]) => {
    const existingIndex = dataStore.scannedRepos.findIndex(
      (r) => r.scanKey === scanKey
    );
    
    const entry = {
      scanKey,
      scannedPath,
      repos,
      scannedAt: Date.now(),
    };
    
    if (existingIndex >= 0) {
      dataStore.scannedRepos[existingIndex] = entry;
    } else {
      dataStore.scannedRepos.unshift(entry);
    }
    
    saveData();
  },

  // Get scanned repos by key
  getScannedRepos: (
    scanKey: string
  ): { scannedPath: string; repos: unknown[] } | null => {
    const entry = dataStore.scannedRepos.find((r) => r.scanKey === scanKey);
    if (!entry) return null;
    
    return {
      scannedPath: entry.scannedPath,
      repos: entry.repos,
    };
  },

  // Get the most recent scan
  getLatestScan: (): { scannedPath: string; repos: unknown[] } | null => {
    const sorted = [...dataStore.scannedRepos].sort(
      (a, b) => b.scannedAt - a.scannedAt
    );
    
    if (sorted.length === 0) return null;
    
    return {
      scannedPath: sorted[0].scannedPath,
      repos: sorted[0].repos,
    };
  },

  // Get storage path for debugging
  getDbPath: () => TASKS_FILE,

  // Get database info for inspection
  getDbInfo: () => {
    try {
      // Get file sizes
      const tasksSize = fs.existsSync(TASKS_FILE)
        ? fs.statSync(TASKS_FILE).size
        : 0;
      const reposSize = fs.existsSync(REPOS_FILE)
        ? fs.statSync(REPOS_FILE).size
        : 0;
      const totalSize = tasksSize + reposSize;
      const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
      
      // Calculate message count
      const messagesCount = dataStore.tasks.reduce(
        (sum, task) => sum + task.messages.length,
        0
      );
      
      // Calculate tool calls count
      const toolCallsCount = dataStore.tasks.reduce(
        (sum, task) =>
          sum +
          task.messages.reduce(
            (msgSum, msg) => msgSum + (msg.metadata?.toolCalls ? Object.keys(msg.metadata.toolCalls).length : 0),
            0
          ),
        0
      );
      
      // Get task status breakdown
      const tasksByStatus = dataStore.tasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Get recent activity (last 10 tasks)
      const recentTasks = dataStore.tasks
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10)
        .map((task) => ({
          id: task.id,
          repo_name: task.repoName,
          action: task.action,
          status: task.status,
          created_at: task.createdAt,
          token_count: task.tokenCount,
        }));
      
      // Get total token count
      const totalTokens = dataStore.tasks.reduce(
        (sum, task) => sum + task.tokenCount,
        0
      );
      
      return {
        path: STORAGE_DIR,
        files: {
          tasks: TASKS_FILE,
          repos: REPOS_FILE,
        },
        size: {
          bytes: totalSize,
          mb: sizeInMB,
          breakdown: {
            tasks: `${(tasksSize / 1024).toFixed(2)} KB`,
            repos: `${(reposSize / 1024).toFixed(2)} KB`,
          },
        },
        tables: {
          tasks: dataStore.tasks.length,
          messages: messagesCount,
          tool_calls: toolCallsCount,
          scanned_repos: dataStore.scannedRepos.length,
        },
        tasksByStatus,
        recentTasks,
        totalTokens,
        schema: {
          storage: "JSON files",
          files: [
            {
              name: "tasks.json",
              description: "Agent tasks with messages and tool calls",
            },
            {
              name: "scanned-repos.json",
              description: "Cached repository scan results",
            },
          ],
        },
      };
    } catch (error) {
      console.error("Error getting storage info:", error);
      throw error;
    }
  },
};

export default dbOperations;


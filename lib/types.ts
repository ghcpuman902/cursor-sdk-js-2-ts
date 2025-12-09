// Repo scanning types
export interface RepoInfo {
  path: string;
  name: string;
  hasTypescript: boolean;
  framework: "nextjs" | "react" | "vue" | "angular" | "svelte" | "other" | null;
  frameworkVersion: string | null;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

// Task action types
export type TaskAction =
  | "upgrade-typescript"
  | "upgrade-framework"
  | "summarize"
  | "update-deps"
  | "custom";

export type TaskStatus = "pending" | "running" | "completed" | "failed";

// Agent task types
export interface AgentTask {
  id: string;
  repoPath: string;
  repoName: string;
  action: TaskAction;
  status: TaskStatus;
  customPrompt?: string;
  createdAt: number;
  messages: ChatMessage[];
  tokenCount: number;
  error?: string;
  terminalOutput: TerminalOutput[];
  lastActivityTime?: number;
  sessionId?: string; // For multi-turn conversations
}

export interface TerminalOutput {
  id: string;
  timestamp: number;
  command?: string;
  output?: string;
  exitCode?: number;
  isRunning?: boolean;
  toolType?: string; // Type of tool call (shell, read, write, etc.)
  toolArgs?: string; // Formatted args for display
}

// Chat message types (extracted from current page.tsx)
export interface ToolCallResult {
  status: string;
  value?: unknown;
  error?: string;
}

export interface ToolCall {
  type: string;
  args?: Record<string, unknown>;
  result?: ToolCallResult;
  startTime?: number;
  endTime?: number;
  isStuck?: boolean;
}

export interface AgentUpdate {
  type: string;
  text?: string;
  callId?: string;
  toolCall?: ToolCall;
  summary?: string;
  tokens?: number;
  thinkingDurationMs?: number;
  userMessage?: { text: string };
  sessionId?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  toolCalls?: Map<string, ToolCall>;
  summaries?: string[];
  isStreaming?: boolean;
}

// Action prompt templates
export const ACTION_PROMPTS: Record<Exclude<TaskAction, "custom">, string> = {
  "upgrade-typescript":
    "Convert this JavaScript project to TypeScript. Add tsconfig.json if missing, rename .js files to .ts/.tsx as appropriate, add type annotations to functions and variables. Ensure the project builds without errors.",
  "upgrade-framework":
    "Analyze this project and upgrade the main framework (Next.js, React, Vue, etc.) to the latest stable version. Update related dependencies and fix any breaking changes. Run build to verify everything works.",
  summarize:
    "Analyze this codebase thoroughly and generate a comprehensive README.md with: project overview, tech stack, folder structure, setup instructions, available scripts, and key features. Be detailed but concise.",
  "update-deps":
    "Check for outdated dependencies in this project. Update them to their latest compatible versions, prioritizing security updates. Fix any breaking changes that arise from the updates.",
};

// Action display info
export const ACTION_INFO: Record<
  TaskAction,
  { label: string; icon: string; description: string }
> = {
  "upgrade-typescript": {
    label: "TypeScript",
    icon: "FileCode2",
    description: "Convert JS to TypeScript",
  },
  "upgrade-framework": {
    label: "Upgrade",
    icon: "ArrowUpCircle",
    description: "Upgrade framework version",
  },
  summarize: {
    label: "Summarize",
    icon: "FileText",
    description: "Generate README",
  },
  "update-deps": {
    label: "Update Deps",
    icon: "Package",
    description: "Update dependencies",
  },
  custom: {
    label: "Custom",
    icon: "MessageSquare",
    description: "Custom prompt",
  },
};

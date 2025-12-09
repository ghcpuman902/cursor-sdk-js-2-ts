"use client";

import { useState, useRef, useCallback } from "react";
import { Loader2, Send, Terminal, CheckCircle2, XCircle, Circle, Play, Sparkles, RotateCcw, User, Bot } from "lucide-react";

interface ToolCallResult {
	status: string;
	value?: unknown;
	error?: string;
}

interface ToolCall {
	type: string;
	args?: Record<string, unknown>;
	result?: ToolCallResult;
}

interface AgentUpdate {
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

interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	thinking?: string;
	toolCalls?: Map<string, ToolCall>;
	summaries?: string[];
	isStreaming?: boolean;
}

const statusEmojis = {
	pending: <Circle className="w-4 h-4 text-zinc-400" />,
	inProgress: <Play className="w-4 h-4 text-blue-500 fill-blue-500" />,
	completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
	cancelled: <XCircle className="w-4 h-4 text-red-500" />,
};

const toolEmojis: Record<string, string> = {
	read: "📖",
	write: "✍️",
	ls: "📂",
	grep: "🔍",
	shell: "💻",
	delete: "🗑️",
	glob: "🌐",
	edit: "✏️",
	readLints: "🔧",
	mcp: "🔌",
	semSearch: "🔎",
	createPlan: "📝",
	updateTodos: "✅",
};

const ToolCallDisplay = ({ toolCall, isActive }: { toolCall: ToolCall; isActive?: boolean }) => {
	const emoji = toolEmojis[toolCall.type] || "🔧";
	
	return (
		<div className={`border rounded-lg p-4 transition-all ${
			isActive 
				? "border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/30" 
				: "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50"
		}`}>
			<div className="flex items-center gap-2 mb-2">
				<span className="text-xl">{emoji}</span>
				<span className="font-medium text-sm">{toolCall.type}</span>
				{isActive && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
			</div>
			
			{toolCall.args && Object.keys(toolCall.args).length > 0 && (
				<div className="mb-2">
					<div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Args:</div>
					<pre className="text-xs bg-white dark:bg-black p-2 rounded border border-zinc-200 dark:border-zinc-800 overflow-x-auto max-h-32">
						{JSON.stringify(toolCall.args, null, 2)}
					</pre>
				</div>
			)}
			
			{toolCall.result && (
				<div>
					<div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Result:</div>
					<div className="text-xs bg-white dark:bg-black p-2 rounded border border-zinc-200 dark:border-zinc-800">
						<div className="mb-1">
							Status: <span className={toolCall.result.status === "success" ? "text-green-600" : "text-red-600"}>
								{toolCall.result.status}
							</span>
						</div>
						{toolCall.result.error && (
							<div className="text-red-600">Error: {toolCall.result.error}</div>
						)}
						{toolCall.result.value != null && (
							<pre className="mt-1 overflow-x-auto text-zinc-700 dark:text-zinc-300 max-h-48">
								{(() => {
									const value: unknown = toolCall.result.value;
									if (typeof value === "string") {
										return value.slice(0, 500) + (value.length > 500 ? "..." : "");
									}
									try {
										const str = JSON.stringify(value, null, 2);
										return str.slice(0, 500) + (str.length > 500 ? "..." : "");
									} catch {
										return String(value).slice(0, 500);
									}
								})()}
							</pre>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

export default function Home() {
	const [prompt, setPrompt] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [activeToolCalls, setActiveToolCalls] = useState<Set<string>>(new Set());
	const [tokenCount, setTokenCount] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	const handleNewChat = () => {
		setMessages([]);
		setSessionId(null);
		setTokenCount(0);
		setError(null);
		setPrompt("");
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!prompt.trim() || isLoading) return;

		const userMessage: ChatMessage = {
			id: `user-${Date.now()}`,
			role: "user",
			content: prompt.trim(),
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

		// Add user message and placeholder assistant message
		setMessages((prev) => [...prev, userMessage, assistantMessage]);
		setIsLoading(true);
		setError(null);
		setPrompt("");

		// Create abort controller for cancellation
		abortControllerRef.current = new AbortController();

		try {
			const res = await fetch("/api/agent", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ 
					message: userMessage.content,
					sessionId, // Pass existing session for continuation
				}),
				signal: abortControllerRef.current.signal,
			});

			if (!res.ok) {
				const errData = await res.json();
				throw new Error(errData.error || "Failed to run agent");
			}

			const reader = res.body?.getReader();
			if (!reader) throw new Error("No response body");

			const decoder = new TextDecoder();
			let buffer = "";

			// Helper to update the current assistant message
			const updateAssistantMessage = (updater: (msg: ChatMessage) => ChatMessage) => {
				setMessages((prev) =>
					prev.map((msg) => (msg.id === assistantMessageId ? updater(msg) : msg))
				);
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
						
						switch (data.type) {
							case "session":
								if (data.sessionId) {
									setSessionId(data.sessionId);
								}
								break;

							case "text-delta":
								updateAssistantMessage((msg) => ({
									...msg,
									content: msg.content + (data.text || ""),
								}));
								scrollToBottom();
								break;

							case "thinking-delta":
								updateAssistantMessage((msg) => ({
									...msg,
									thinking: (msg.thinking || "") + (data.text || ""),
								}));
								scrollToBottom();
								break;

							case "thinking-completed":
								updateAssistantMessage((msg) => ({
									...msg,
									thinking: (msg.thinking || "") + ` ✓ (${data.thinkingDurationMs}ms)`,
								}));
								break;

							case "tool-call-started":
								if (data.callId && data.toolCall) {
									setActiveToolCalls((prev) => new Set(prev).add(data.callId!));
									updateAssistantMessage((msg) => {
										const newToolCalls = new Map(msg.toolCalls);
										newToolCalls.set(data.callId!, data.toolCall!);
										return { ...msg, toolCalls: newToolCalls };
									});
									scrollToBottom();
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
										const newToolCalls = new Map(msg.toolCalls);
										newToolCalls.set(data.callId!, data.toolCall!);
										return { ...msg, toolCalls: newToolCalls };
									});
									scrollToBottom();
								}
								break;

							case "summary":
								if (data.summary) {
									updateAssistantMessage((msg) => ({
										...msg,
										summaries: [...(msg.summaries || []), data.summary!],
									}));
									scrollToBottom();
								}
								break;

							case "token-delta":
								if (data.tokens) {
									setTokenCount((prev) => prev + data.tokens!);
								}
								break;

							case "error":
								setError(data.text || "Unknown error occurred");
								break;

							case "done":
								updateAssistantMessage((msg) => ({
									...msg,
									isStreaming: false,
								}));
								break;
						}
					} catch {
						// Skip malformed JSON
					}
				}
			}

			// Mark streaming as complete
			updateAssistantMessage((msg) => ({
				...msg,
				isStreaming: false,
			}));
		} catch (err) {
			if (err instanceof Error && err.name === "AbortError") {
				setError("Request cancelled");
			} else {
				setError(err instanceof Error ? err.message : "Unknown error");
			}
			// Remove the empty assistant message on error
			setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId || msg.content));
		} finally {
			setIsLoading(false);
			abortControllerRef.current = null;
		}
	};

	const handleCancel = () => {
		abortControllerRef.current?.abort();
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			const form = e.currentTarget.form;
			if (form) form.requestSubmit();
		}
	};

	const hasMessages = messages.length > 0;

	return (
		<div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-black dark:to-zinc-900 flex flex-col">
			{/* Header */}
			<header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-black/80 backdrop-blur-sm sticky top-0 z-10">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
								<Terminal className="w-5 h-5 text-white" />
							</div>
							<div>
								<h1 className="text-lg font-semibold">Cursor Agent Demo</h1>
								<p className="text-xs text-muted-foreground">
									Multi-turn conversation with Cursor Agent
								</p>
							</div>
						</div>
						<div className="flex items-center gap-3">
							{tokenCount > 0 && (
								<div className="text-xs text-muted-foreground bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
									{tokenCount} tokens
								</div>
							)}
							{hasMessages && (
								<button
									type="button"
									onClick={handleNewChat}
									className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
									aria-label="Start new chat"
									tabIndex={0}
								>
									<RotateCcw className="w-3.5 h-3.5" />
									New Chat
								</button>
							)}
						</div>
					</div>
				</div>
			</header>

			{/* Messages Container */}
			<div className="flex-1 overflow-y-auto">
				<div className="container mx-auto px-4 py-6 max-w-4xl">
					{/* Error Display */}
					{error && (
						<div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
							<div className="flex items-center gap-2 text-red-600 dark:text-red-400">
								<XCircle className="w-4 h-4" />
								<span className="text-sm font-medium">Error</span>
							</div>
							<p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
						</div>
					)}

					{/* Chat Messages */}
					{hasMessages ? (
						<div className="space-y-6">
							{messages.map((message) => (
								<div key={message.id} className="space-y-3">
									{message.role === "user" ? (
										// User Message
										<div className="flex gap-3">
											<div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
												<User className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
											</div>
											<div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
												<div className="text-sm whitespace-pre-wrap">{message.content}</div>
											</div>
										</div>
									) : (
										// Assistant Message
										<div className="flex gap-3">
											<div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
												<Bot className="w-4 h-4 text-white" />
											</div>
											<div className="flex-1 space-y-3">
												{/* Thinking */}
												{message.thinking && (
													<div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-lg p-4">
														<div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 font-medium mb-2">
															<Sparkles className="w-4 h-4" />
															THINKING
														</div>
														<div className="text-sm text-purple-900 dark:text-purple-100 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
															{message.thinking}
														</div>
													</div>
												)}

												{/* Tool Calls */}
												{message.toolCalls && message.toolCalls.size > 0 && (
													<div className="space-y-2">
														<div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
															🔧 TOOL CALLS ({message.toolCalls.size})
														</div>
														{Array.from(message.toolCalls.entries()).map(([callId, toolCall]) => (
															<ToolCallDisplay 
																key={callId} 
																toolCall={toolCall} 
																isActive={message.isStreaming && activeToolCalls.has(callId)}
															/>
														))}
													</div>
												)}

												{/* Response */}
												{message.content && (
													<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 shadow-sm">
														<div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
															{message.content}
															{message.isStreaming && (
																<span className="inline-block w-2 h-4 bg-violet-500 ml-1 animate-pulse" />
															)}
														</div>
													</div>
												)}

												{/* Summaries */}
												{message.summaries && message.summaries.length > 0 && (
													<div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
														<div className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-2">
															📝 SUMMARY
														</div>
														{message.summaries.map((summary, idx) => (
															<div key={idx} className="text-sm text-amber-900 dark:text-amber-100">
																{summary}
															</div>
														))}
													</div>
												)}

												{/* Streaming indicator when no content yet */}
												{message.isStreaming && !message.content && !message.thinking && message.toolCalls?.size === 0 && (
													<div className="flex items-center gap-2 text-muted-foreground">
														<Loader2 className="w-4 h-4 animate-spin" />
														<span className="text-sm">Agent is thinking...</span>
													</div>
												)}
											</div>
										</div>
									)}
								</div>
							))}
						</div>
					) : (
						// Empty State
						!isLoading && !error && (
							<div className="text-center py-16">
								<div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center">
									<Terminal className="w-8 h-8 text-violet-600 dark:text-violet-400" />
								</div>
								<h2 className="text-lg font-medium mb-2">Ready to Start</h2>
								<p className="text-sm text-muted-foreground max-w-md mx-auto">
									Enter a prompt below to start a conversation with the Cursor Agent. Try "List files in this directory" or "What can you help me with?" to get started.
								</p>
							</div>
						)
					)}

					<div ref={messagesEndRef} />
				</div>
			</div>

			{/* Input Form - Fixed at bottom */}
			<div className="border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-black/80 backdrop-blur-sm">
				<div className="container mx-auto px-4 py-4 max-w-4xl">
					<form onSubmit={handleSubmit}>
						<div className="flex gap-2">
							<textarea
								value={prompt}
								onChange={(e) => setPrompt(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder={hasMessages ? "Continue the conversation..." : "Enter your prompt... (Press Enter to submit)"}
								className="flex-1 px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none min-h-[48px] max-h-[200px]"
								disabled={isLoading}
								rows={1}
								aria-label="Message input"
								tabIndex={0}
							/>
							{isLoading ? (
								<button
									type="button"
									onClick={handleCancel}
									className="px-6 py-3 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 flex items-center gap-2"
									aria-label="Cancel request"
									tabIndex={0}
								>
									<XCircle className="w-4 h-4" />
									Cancel
								</button>
							) : (
								<button
									type="submit"
									disabled={!prompt.trim()}
									className="px-6 py-3 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
									aria-label="Send message"
									tabIndex={0}
								>
									<Send className="w-4 h-4" />
									Send
								</button>
							)}
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}

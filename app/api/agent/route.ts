import { CursorAgent, type WorkingLocation } from "@cursor-ai/january";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

// Store agent instances by session ID for multi-turn conversations
const agentSessions = new Map<string, { agent: CursorAgent; lastAccess: number }>();

// Clean up old sessions (older than 30 minutes)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const cleanupSessions = () => {
	const now = Date.now();
	for (const [sessionId, session] of agentSessions) {
		if (now - session.lastAccess > SESSION_TIMEOUT_MS) {
			agentSessions.delete(sessionId);
		}
	}
};

export async function POST(req: Request) {
	try {
		const { message, model = "claude-4-sonnet", sessionId: existingSessionId } = await req.json();

		if (!message) {
			return new Response(JSON.stringify({ error: "Message is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const apiKey = process.env.CURSOR_API_KEY;
		if (!apiKey) {
			return new Response(JSON.stringify({ error: "CURSOR_API_KEY not configured" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Clean up old sessions periodically
		cleanupSessions();

		let sessionId: string;
		let agent: CursorAgent;

		// Reuse existing session or create new one
		if (existingSessionId && agentSessions.has(existingSessionId)) {
			sessionId = existingSessionId;
			const session = agentSessions.get(sessionId)!;
			agent = session.agent;
			session.lastAccess = Date.now();
		} else {
			sessionId = randomUUID();
			const workingLocation: WorkingLocation = {
				type: "local",
				localDirectory: process.cwd(),
			};

			agent = new CursorAgent({
				apiKey,
				model,
				workingLocation,
			});

			agentSessions.set(sessionId, { agent, lastAccess: Date.now() });
		}

		const { stream } = agent.submit({ message });

		// Create a Server-Sent Events stream
		const encoder = new TextEncoder();
		const readableStream = new ReadableStream({
			async start(controller) {
				try {
					// Send session ID first so client can track conversation
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify({ type: "session", sessionId })}\n\n`)
					);

					for await (const update of stream) {
						// Send each update as a JSON line
						const data = JSON.stringify(update);
						controller.enqueue(encoder.encode(`data: ${data}\n\n`));
					}

					await stream.done;
					controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
					controller.close();
				} catch (error) {
					console.error("Stream error:", error);
					const errorData = JSON.stringify({
						type: "error",
						message: error instanceof Error ? error.message : "Unknown error",
					});
					controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
					controller.close();
				}
			},
		});

		return new Response(readableStream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Agent error:", error);
		return new Response(
			JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
			{ status: 500, headers: { "Content-Type": "application/json" } }
		);
	}
}

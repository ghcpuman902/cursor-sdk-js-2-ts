import { NextResponse } from "next/server";
import dbOperations from "@/lib/db";
import type { AgentTask } from "@/lib/types";

export const runtime = "nodejs";

// POST - Save or update a task
export async function POST(req: Request) {
  try {
    const { task } = await req.json();

    if (!task || !task.id) {
      return NextResponse.json(
        { error: "Invalid task data" },
        { status: 400 }
      );
    }

    // Check if task exists
    const existingTask = dbOperations.getTask(task.id);

    if (existingTask) {
      // Update existing task
      dbOperations.updateTask(task as AgentTask);
    } else {
      // Save new task
      dbOperations.saveTask(task as AgentTask);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving task:", error);
    return NextResponse.json(
      { error: "Failed to save task" },
      { status: 500 }
    );
  }
}


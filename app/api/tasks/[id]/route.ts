import { NextResponse } from "next/server";
import dbOperations from "@/lib/db";

export const runtime = "nodejs";

// DELETE - Delete a specific task
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    dbOperations.deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}


import { NextResponse } from "next/server";
import dbOperations from "@/lib/db";

export const runtime = "nodejs";

// GET - Load all tasks
export async function GET() {
  try {
    const tasks = dbOperations.loadTasks();
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Error loading tasks:", error);
    return NextResponse.json(
      { error: "Failed to load tasks" },
      { status: 500 }
    );
  }
}

// DELETE - Clear completed tasks or all cache
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const clearAll = url.searchParams.get("all") === "true";
    
    if (clearAll) {
      console.log("=== CLEARING ALL CACHE ===");
      dbOperations.clearAllCache();
      console.log("All cache cleared successfully");
      return NextResponse.json({ success: true, message: "All cache cleared" });
    } else {
      console.log("=== CLEARING COMPLETED TASKS ===");
      dbOperations.clearCompleted();
      console.log("Completed tasks cleared successfully");
      return NextResponse.json({ success: true, message: "Completed tasks cleared" });
    }
  } catch (error) {
    console.error("Error clearing data:", error);
    return NextResponse.json(
      { error: "Failed to clear data" },
      { status: 500 }
    );
  }
}


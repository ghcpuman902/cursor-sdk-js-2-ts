import { NextResponse } from "next/server";
import dbOperations from "@/lib/db";

export const runtime = "nodejs";

// GET - Get comprehensive database information
export async function GET() {
  try {
    const dbInfo = dbOperations.getDbInfo();
    return NextResponse.json(dbInfo);
  } catch (error) {
    console.error("Error getting DB info:", error);
    return NextResponse.json(
      { error: "Failed to get DB info", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}


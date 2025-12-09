import { NextResponse } from "next/server";
import dbOperations from "@/lib/db";

export const runtime = "nodejs";

// GET - Load latest scanned repos
export async function GET() {
  try {
    const result = dbOperations.getLatestScan();
    
    if (!result) {
      return NextResponse.json({ repos: [], scannedPath: null });
    }

    return NextResponse.json({
      repos: result.repos,
      scannedPath: result.scannedPath,
    });
  } catch (error) {
    console.error("Error loading scanned repos:", error);
    return NextResponse.json(
      { error: "Failed to load scanned repos" },
      { status: 500 }
    );
  }
}

// POST - Save scanned repos
export async function POST(req: Request) {
  try {
    const { scannedPath, repos } = await req.json();

    if (!scannedPath || !repos) {
      return NextResponse.json(
        { error: "Invalid data" },
        { status: 400 }
      );
    }

    // Use scanned path as key
    dbOperations.saveScannedRepos(scannedPath, scannedPath, repos);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving scanned repos:", error);
    return NextResponse.json(
      { error: "Failed to save scanned repos" },
      { status: 500 }
    );
  }
}


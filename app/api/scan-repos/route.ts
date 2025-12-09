import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { RepoInfo } from "@/lib/types";

export const runtime = "nodejs";

// Directories to skip when scanning
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".cache",
  "coverage",
  ".turbo",
  ".vercel",
]);

// Max depth to prevent scanning too deep
const MAX_DEPTH = 4;

// Detect framework from dependencies
const detectFramework = (
  deps: Record<string, string>,
  devDeps: Record<string, string>
): { framework: RepoInfo["framework"]; version: string | null } => {
  const allDeps = { ...deps, ...devDeps };

  if (allDeps["next"]) {
    return { framework: "nextjs", version: deps["next"] || devDeps["next"] };
  }
  if (allDeps["vue"]) {
    return { framework: "vue", version: deps["vue"] || devDeps["vue"] };
  }
  if (allDeps["@angular/core"]) {
    return {
      framework: "angular",
      version: deps["@angular/core"] || devDeps["@angular/core"],
    };
  }
  if (allDeps["svelte"]) {
    return { framework: "svelte", version: deps["svelte"] || devDeps["svelte"] };
  }
  if (allDeps["react"]) {
    return { framework: "react", version: deps["react"] || devDeps["react"] };
  }

  return { framework: null, version: null };
};

// Check if project uses TypeScript
const hasTypeScript = (
  deps: Record<string, string>,
  devDeps: Record<string, string>
): boolean => {
  const allDeps = { ...deps, ...devDeps };
  return !!allDeps["typescript"];
};

// Recursively find package.json files
const findPackageJsons = async (
  dirPath: string,
  depth: number = 0
): Promise<string[]> => {
  if (depth > MAX_DEPTH) return [];

  const results: string[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          const nested = await findPackageJsons(fullPath, depth + 1);
          results.push(...nested);
        }
      } else if (entry.name === "package.json") {
        results.push(fullPath);
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return results;
};

// Parse package.json and extract repo info
const parsePackageJson = async (
  packageJsonPath: string
): Promise<RepoInfo | null> => {
  try {
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);

    const repoPath = path.dirname(packageJsonPath);
    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};
    const { framework, version } = detectFramework(deps, devDeps);

    return {
      path: repoPath,
      name: pkg.name || path.basename(repoPath),
      hasTypescript: hasTypeScript(deps, devDeps),
      framework,
      frameworkVersion: version,
      dependencies: deps,
      devDependencies: devDeps,
    };
  } catch {
    return null;
  }
};

export async function POST(req: Request) {
  try {
    const { rootPath } = await req.json();

    if (!rootPath || typeof rootPath !== "string") {
      return NextResponse.json(
        { error: "rootPath is required" },
        { status: 400 }
      );
    }

    // Expand ~ to home directory
    const expandedPath = rootPath.startsWith("~")
      ? path.join(process.env.HOME || "", rootPath.slice(1))
      : rootPath;

    // Verify path exists and is a directory
    try {
      const stat = await fs.stat(expandedPath);
      if (!stat.isDirectory()) {
        return NextResponse.json(
          { error: "Path is not a directory" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Path does not exist or is not accessible" },
        { status: 400 }
      );
    }

    // Find all package.json files
    const packageJsonPaths = await findPackageJsons(expandedPath);

    // Parse each package.json
    const repos: RepoInfo[] = [];
    for (const pkgPath of packageJsonPaths) {
      const repoInfo = await parsePackageJson(pkgPath);
      if (repoInfo) {
        repos.push(repoInfo);
      }
    }

    // Sort by name
    repos.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ repos, scannedPath: expandedPath });
  } catch (error) {
    console.error("Scan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scan failed" },
      { status: 500 }
    );
  }
}

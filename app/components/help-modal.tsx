"use client";

import { CircleHelp, Github } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const HelpModal = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Help"
        >
          <CircleHelp className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Multi-Repo Agent Manager</DialogTitle>
          <DialogDescription>
            AI agents for multiple repos, in parallel
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <section className="space-y-2">
            <p className="text-sm text-muted-foreground">
              👤 Made by Mangle Kuo
            </p>
            <a
              href="https://github.com/ghcpuman902/cursor-sdk-js-2-ts"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
            >
              <Github className="h-4 w-4" />
              <span>View on GitHub</span>
            </a>
          </section>

          <section>
            <h3 className="text-base font-semibold mb-2 text-violet-600 dark:text-violet-400">
              💡 Solves
            </h3>
            <ul className="space-y-1.5 text-sm">
              <li>• Outdated frameworks across many repos</li>
              <li>• JavaScript → TypeScript migration</li>
              <li>• Missing documentation</li>
              <li>• Dependency updates</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold mb-2 text-violet-600 dark:text-violet-400">
              🚀 Usage
            </h3>
            <ol className="space-y-1.5 text-sm">
              <li><strong>1.</strong> Scan directory</li>
              <li><strong>2.</strong> Filter repos</li>
              <li><strong>3.</strong> Select & run action</li>
              <li><strong>4.</strong> Monitor results</li>
            </ol>
          </section>

          <section>
            <h3 className="text-base font-semibold mb-2 text-violet-600 dark:text-violet-400">
              ⚡ Features
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>✓ Parallel execution</div>
              <div>✓ Real-time output</div>
              <div>✓ Custom prompts</div>
              <div>✓ Batch operations</div>
            </div>
          </section>

          <section className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Cursor SDK • Next.js 16 • React 19
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};


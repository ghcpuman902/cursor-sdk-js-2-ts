"use client";

import { Terminal, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import type { TerminalOutput as TerminalOutputType } from "@/lib/types";
import { useRef, useEffect, useState } from "react";

interface TerminalOutputProps {
  output: TerminalOutputType[];
  lastActivityTime?: number;
}

export const TerminalOutput = ({
  output,
  lastActivityTime,
}: TerminalOutputProps) => {
  const endRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [output]);

  // Update current time periodically to recalculate idle time
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const idleTime = lastActivityTime ? currentTime - lastActivityTime : 0;
  const isStuck = idleTime > 30000; // Consider stuck after 30s of no activity

  return (
    <div className="flex flex-col h-full bg-black/95 text-zinc-100 font-mono text-[10px] overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-700 bg-zinc-900 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3 h-3 text-green-400" />
          <span className="text-[10px] font-medium text-zinc-300">
            Tool Activity
          </span>
          {output.length > 0 && (
            <span className="text-[9px] text-zinc-500">
              {output.length} calls
            </span>
          )}
        </div>
        {lastActivityTime && (
          <div className="flex items-center gap-1.5">
            {isStuck ? (
              <>
                <Clock className="w-3 h-3 text-amber-500 animate-pulse" />
                <span className="text-[9px] text-amber-400">
                  Idle {Math.floor(idleTime / 1000)}s
                </span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[9px] text-green-400">Active</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Terminal Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {output.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-[9px]">
            <div className="text-center space-y-1">
              <Terminal className="w-4 h-4 mx-auto opacity-50" />
              <div>No tool calls yet</div>
              <div className="text-[8px] text-zinc-600">
                Waiting for agent to use tools...
              </div>
              {isStuck && (
                <div className="text-amber-400 text-[10px] mt-2">
                  ⚠️ Agent idle for {Math.floor(idleTime / 1000)}s
                </div>
              )}
            </div>
          </div>
        ) : (
          output.map((entry) => (
            <div key={entry.id} className="space-y-1">
              {/* Tool Type Badge */}
              {entry.toolType && (
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[9px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded">
                    {entry.toolType}
                  </span>
                  {entry.isRunning && (
                    <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                  )}
                </div>
              )}

              {/* Shell Command */}
              {entry.command && (
                <div className="flex items-center gap-1.5">
                  <span className="text-green-400">$</span>
                  <span className="text-zinc-200">{entry.command}</span>
                </div>
              )}

              {/* Non-shell Tool Args */}
              {entry.toolArgs && (
                <pre className="text-zinc-400 text-[9px] whitespace-pre-wrap wrap-break-word pl-4 border-l-2 border-zinc-700">
                  {entry.toolArgs}
                </pre>
              )}

              {/* Output */}
              {entry.output && (
                <pre className="text-zinc-300 whitespace-pre-wrap wrap-break-word pl-4 border-l-2 border-zinc-700">
                  {entry.output}
                </pre>
              )}

              {/* Exit Status */}
              {entry.exitCode !== undefined && !entry.isRunning && (
                <div className="flex items-center gap-1.5 text-[9px] pl-4">
                  {entry.exitCode === 0 ? (
                    <>
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span className="text-green-400">
                        Exit code: {entry.exitCode}
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3 text-red-500" />
                      <span className="text-red-400">
                        Exit code: {entry.exitCode}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};

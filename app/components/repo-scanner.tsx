"use client";

import { useState } from "react";
import { FolderSearch, Loader2, ChevronDown } from "lucide-react";

interface RepoScannerProps {
  onScan: (rootPath: string) => Promise<void>;
  isScanning: boolean;
}

const PRESET_PATHS = [
  { label: "~/dev", value: "~/dev" },
  { label: "~/projects", value: "~/projects" },
  { label: "~/code", value: "~/code" },
  { label: "~/Documents", value: "~/Documents" },
  { label: "~/Desktop", value: "~/Desktop" },
  { label: "Custom...", value: "custom" },
];

export const RepoScanner = ({ onScan, isScanning }: RepoScannerProps) => {
  const [selectedPreset, setSelectedPreset] = useState(PRESET_PATHS[0].value);
  const [customPath, setCustomPath] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const isCustom = selectedPreset === "custom";
  const currentPath = isCustom ? customPath : selectedPreset;
  const canScan = currentPath.trim().length > 0 && !isScanning;

  const handlePresetSelect = (value: string) => {
    setSelectedPreset(value);
    setIsDropdownOpen(false);
  };

  const handleScan = () => {
    if (canScan) {
      onScan(currentPath);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canScan) {
      handleScan();
    }
  };

  return (
    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="flex items-center gap-2 mb-3">
        <FolderSearch className="w-5 h-5 text-violet-500" />
        <h2 className="font-semibold text-sm">Scan for Projects</h2>
      </div>

      <div className="space-y-3">
        {/* Preset Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Select root path"
            aria-expanded={isDropdownOpen}
            tabIndex={0}
          >
            <span className="truncate">
              {PRESET_PATHS.find((p) => p.value === selectedPreset)?.label}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-zinc-500 transition-transform ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isDropdownOpen && (
            <div className="absolute z-10 w-full mt-1 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg">
              {PRESET_PATHS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => handlePresetSelect(preset.value)}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                    selectedPreset === preset.value
                      ? "bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400"
                      : ""
                  }`}
                  tabIndex={0}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom Path Input */}
        {isCustom && (
          <input
            type="text"
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="/absolute/path/to/folder"
            className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Custom path input"
            tabIndex={0}
          />
        )}

        {/* Scan Button */}
        <button
          type="button"
          onClick={handleScan}
          disabled={!canScan}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          aria-label="Scan for projects"
          tabIndex={0}
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <FolderSearch className="w-4 h-4" />
              Scan
            </>
          )}
        </button>
      </div>
    </div>
  );
};

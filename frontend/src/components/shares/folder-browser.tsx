"use client";

import { useCallback, useEffect, useState } from "react";
import { CaretLeft, CaretRight, Folder } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type BrowseEntry = { name: string; path: string; type: string };

type BrowseResult = {
  path: string;
  parent?: string;
  roots: string[];
  entries: BrowseEntry[];
  selectable: boolean;
};

export function FolderBrowser({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
}) {
  const [currentPath, setCurrentPath] = useState(value || "");
  const [roots, setRoots] = useState<string[]>([]);
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [parent, setParent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const browse = useCallback(async (path?: string) => {
    setLoading(true);
    setError("");
    try {
      const query = path ? `?path=${encodeURIComponent(path)}` : "";
      const res = await api<BrowseResult>(`/filesystem/browse${query}`);
      if (!path && res.roots?.length) {
        setRoots(res.roots);
        const firstRoot = res.roots[0];
        if (firstRoot) {
          const nested = await api<BrowseResult>(`/filesystem/browse?path=${encodeURIComponent(firstRoot)}`);
          setCurrentPath(nested.path || firstRoot);
          setEntries(nested.entries || []);
          setParent(nested.parent || "");
          return;
        }
      }
      setCurrentPath(res.path || path || "");
      setEntries(res.entries || []);
      setParent(res.parent || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to browse directories");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    browse(value || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value && value !== currentPath) {
      browse(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (disabled) {
    return (
      <div className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm">{value || "—"}</div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Selected:</span>
        <code className="text-xs break-all">{value || "—"}</code>
        {value && (
          <Button type="button" size="sm" variant="secondary" onClick={() => onChange(value)}>
            Use selected
          </Button>
        )}
      </div>

      {roots.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {roots.map((root) => (
            <Button key={root} type="button" size="sm" variant="outline" onClick={() => browse(root)}>
              {root}
            </Button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        {parent && (
          <Button type="button" size="sm" variant="outline" onClick={() => browse(parent)}>
            <CaretLeft className="h-4 w-4" />
            Up
          </Button>
        )}
        <span className="font-mono text-xs truncate">{currentPath || "Roots"}</span>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <ul className="max-h-40 overflow-y-auto divide-y rounded border">
          {currentPath && (
            <li>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
                onClick={() => onChange(currentPath)}
              >
                <Folder className="h-4 w-4 shrink-0" weight="fill" />
                <span className="font-medium">Select this folder</span>
                <CaretRight className="ml-auto h-3 w-3 text-muted-foreground" />
              </button>
            </li>
          )}
          {entries.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">No subdirectories</li>
          ) : (
            entries.map((entry) => (
              <li key={entry.path}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60",
                    value === entry.path && "bg-muted/50"
                  )}
                  onClick={() => browse(entry.path)}
                  onDoubleClick={() => onChange(entry.path)}
                >
                  <Folder className="h-4 w-4 shrink-0" />
                  <span>{entry.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Click a folder to open it; use Select to set the share path.</p>
    </div>
  );
}

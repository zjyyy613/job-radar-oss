"use client";
import { Star } from "lucide-react";
import { savedJobs, useSavedJobs } from "@/lib/saved/use-saved";
import { Button } from "@/components/ui/button";
export function SaveButton({
  id,
  title,
  compact = false,
}: {
  id: string;
  title: string;
  compact?: boolean;
}) {
  const snapshot = useSavedJobs();
  const saved = snapshot.entries.some((entry) => entry.job_id === id);
  return (
    <Button
      type="button"
      variant="ghost"
      className={`save-button ${compact ? "save-compact" : ""}`}
      disabled={!snapshot.loaded}
      aria-label={`${saved ? "取消收藏" : "收藏"}：${title}`}
      aria-pressed={saved}
      title={saved ? "取消收藏" : "收藏岗位"}
      onClick={() => savedJobs.setSaved(id, !saved)}
    >
      <Star
        size={17}
        fill={saved ? "currentColor" : "none"}
        aria-hidden="true"
      />
      {!compact && <span>{saved ? "已收藏" : "收藏"}</span>}
    </Button>
  );
}
export function SavedStorageNotice() {
  const snapshot = useSavedJobs();
  return snapshot.error ? (
    <p className="source-warning saved-storage-error" role="alert">
      {snapshot.error}
    </p>
  ) : null;
}

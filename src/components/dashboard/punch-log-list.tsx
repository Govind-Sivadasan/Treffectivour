"use client";

import { PunchEditRow } from "@/components/dashboard/punch-edit-row";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface PunchRow {
  id: string;
  type: "IN" | "OUT";
  timestamp: string;
  isManual: boolean;
  sortOrder?: number;
}

interface PunchLogListProps {
  punches: PunchRow[];
  date: string;
  onSave: () => void;
  onDelete: (punchId: string) => void;
}

export function PunchLogList({ punches, date, onSave, onDelete }: PunchLogListProps) {
  const [ordered, setOrdered] = useState(punches);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOrdered(punches);
  }, [punches]);

  async function persistOrder(next: PunchRow[]) {
    const previous = ordered;
    setOrdered(next);
    setSaving(true);
    try {
      const res = await fetch("/api/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          punchOrder: next.map((p) => p.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to reorder punches");
        setOrdered(previous);
        return;
      }
      onSave();
    } catch {
      toast.error("Failed to reorder punches");
      setOrdered(previous);
    } finally {
      setSaving(false);
    }
  }

  function moveItem(activeId: string, overItemId: string) {
    if (activeId === overItemId || saving) return;

    const fromIndex = ordered.findIndex((p) => p.id === activeId);
    const toIndex = ordered.findIndex((p) => p.id === overItemId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...ordered];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    persistOrder(next);
  }

  if (ordered.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)] py-4 text-center">
        No punches yet. Upload a screenshot or add manually.
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", saving && "opacity-70 pointer-events-none")}>
      {ordered.map((punch) => (
        <div
          key={punch.id}
          onDragOver={(e) => {
            e.preventDefault();
            if (draggingId && draggingId !== punch.id) {
              setOverId(punch.id);
            }
          }}
          onDragLeave={() => {
            if (overId === punch.id) setOverId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const activeId = e.dataTransfer.getData("text/plain");
            if (activeId) moveItem(activeId, punch.id);
            setDraggingId(null);
            setOverId(null);
          }}
          className={cn(
            "rounded-xl transition",
            overId === punch.id && draggingId !== punch.id && "ring-2 ring-indigo-400/50"
          )}
        >
          <PunchEditRow
            punch={punch}
            date={date}
            onSave={onSave}
            onDelete={() => onDelete(punch.id)}
            draggable={!saving}
            isDragging={draggingId === punch.id}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", punch.id);
              e.dataTransfer.effectAllowed = "move";
              setDraggingId(punch.id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setOverId(null);
            }}
          />
        </div>
      ))}
    </div>
  );
}

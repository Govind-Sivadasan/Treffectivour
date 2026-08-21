"use client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import {
  TimePicker,
  dateToTimePickerValue,
  type TimePickerValue,
} from "@/components/ui/time-picker";
import { timePickerToDate } from "@/lib/time-local";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Clock,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PunchRow {
  id: string;
  type: "IN" | "OUT";
  timestamp: string;
  isManual: boolean;
}

interface PunchEditRowProps {
  punch: PunchRow;
  date: string;
  onSave: () => void;
  onDelete: () => void;
}

export function PunchEditRow({ punch, date, onSave, onDelete }: PunchEditRowProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<"IN" | "OUT">(punch.type);
  const [time, setTime] = useState<TimePickerValue>(() =>
    dateToTimePickerValue(new Date(punch.timestamp))
  );

  function startEdit() {
    setType(punch.type);
    setTime(dateToTimePickerValue(new Date(punch.timestamp)));
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch("/api/entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          punchId: punch.id,
          date,
          type,
          timestamp: timePickerToDate(date, time).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update punch");
        return;
      }
      toast.success("Punch updated");
      setEditing(false);
      onSave();
    } catch {
      toast.error("Failed to update punch");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-indigo-500/20 bg-indigo-500/10">
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
            Edit punch
          </span>
          <button
            type="button"
            onClick={cancelEdit}
            className="p-1 rounded-md text-[var(--color-muted)] hover:text-white hover:bg-white/10"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-24">
              <label className="text-[10px] uppercase tracking-wide text-[var(--color-muted)] mb-1.5 block">
                Type
              </label>
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as "IN" | "OUT")}
                className="py-2"
              >
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
              </Select>
            </div>
            <button
              type="button"
              onClick={() => setTime(dateToTimePickerValue(new Date()))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)] hover:text-white hover:bg-white/5"
            >
              <Clock className="w-3.5 h-3.5" />
              Now
            </button>
          </div>

          <TimePicker compact value={time} onChange={setTime} />

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveEdit} disabled={saving}>
              <Check className="w-4 h-4" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[72px_1fr_auto] items-center gap-3 rounded-xl bg-black/30 border border-[var(--color-border)] px-4 py-3 group hover:bg-black/40 transition">
      <div className="flex items-center gap-2">
        {punch.type === "IN" ? (
          <ArrowDownLeft className="w-4 h-4 shrink-0 text-[var(--color-success)]" />
        ) : (
          <ArrowUpRight className="w-4 h-4 shrink-0 text-[var(--color-danger)]" />
        )}
        <span className="font-semibold text-sm w-8">{punch.type}</span>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-sm tabular-nums">
          {formatTime(new Date(punch.timestamp))}
        </span>
        {punch.isManual && (
          <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)] bg-white/5 px-1.5 py-0.5 rounded">
            manual
          </span>
        )}
      </div>

      <div className="flex gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={startEdit}
          aria-label="Edit punch"
          className={cn("h-8 w-8 p-0 opacity-60 group-hover:opacity-100")}
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label="Delete punch"
          className="h-8 w-8 p-0 opacity-60 group-hover:opacity-100"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

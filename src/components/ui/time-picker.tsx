"use client";

import type { TimePickerValue } from "@/lib/time-local";
import {
  dateToTimePickerValue,
  DEFAULT_TIME_PICKER_VALUE,
  nowTimePickerValue,
} from "@/lib/time-local";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type { TimePickerValue } from "@/lib/time-local";
export {
  dateToTimePickerValue,
  DEFAULT_TIME_PICKER_VALUE,
  nowTimePickerValue,
  timePickerToDate,
  timeStringToDate,
} from "@/lib/time-local";

interface TimePickerProps {
  value: TimePickerValue;
  onChange: (value: TimePickerValue) => void;
  className?: string;
  compact?: boolean;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wrap(value: number, min: number, max: number, delta: number) {
  const range = max - min + 1;
  return ((((value - min + delta) % range) + range) % range) + min;
}

function TimeColumn({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const columnRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => pad(value));

  useEffect(() => {
    if (!focused) {
      setDraft(pad(value));
    }
  }, [value, focused]);

  const step = useCallback(
    (delta: number) => onChange(wrap(value, min, max, delta)),
    [value, min, max, onChange]
  );

  const commitInput = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D/g, "");
      if (!digits) {
        setDraft(pad(value));
        return;
      }
      const parsed = parseInt(digits, 10);
      if (Number.isNaN(parsed)) {
        setDraft(pad(value));
        return;
      }
      onChange(clamp(parsed, min, max));
    },
    [min, max, onChange, value]
  );

  useEffect(() => {
    const el = columnRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      step(e.deltaY < 0 ? 1 : -1);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [step]);

  const display = pad(value);

  return (
    <div
      ref={columnRef}
      className="group flex flex-col items-center gap-0.5 overscroll-contain touch-none select-none"
    >
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] mb-0.5">
        {label}
      </span>
      <button
        type="button"
        onClick={() => step(1)}
        className="rounded-md p-0.5 text-[var(--color-muted)] hover:text-white hover:bg-white/10 transition opacity-70 group-hover:opacity-100"
        aria-label={`Increase ${label}`}
        tabIndex={-1}
      >
        <ChevronUp className="w-4 h-4" />
      </button>

      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={focused ? draft : display}
        onFocus={() => {
          setFocused(true);
          setDraft(display);
          requestAnimationFrame(() => inputRef.current?.select());
        }}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={() => {
          commitInput(draft);
          setFocused(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitInput(draft);
            inputRef.current?.blur();
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            step(1);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            step(-1);
          }
          if (e.key === "Escape") {
            setDraft(display);
            inputRef.current?.blur();
          }
        }}
        className={cn(
          "w-[3.25rem] h-14 rounded-xl border border-[var(--color-border)] bg-black/40",
          "text-2xl font-mono font-semibold tabular-nums text-center tracking-wider",
          "outline-none cursor-text",
          "focus:border-[var(--color-primary)] focus:ring-2 focus:ring-indigo-500/25",
          "group-hover:border-[var(--color-primary)]/40"
        )}
        aria-label={label}
      />

      <button
        type="button"
        onClick={() => step(-1)}
        className="rounded-md p-0.5 text-[var(--color-muted)] hover:text-white hover:bg-white/10 transition opacity-70 group-hover:opacity-100"
        aria-label={`Decrease ${label}`}
        tabIndex={-1}
      >
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
}

export function TimePicker({ value, onChange, className, compact }: TimePickerProps) {
  const display = useMemo(
    () =>
      `${value.hours}:${pad(value.minutes)}:${pad(value.seconds)} ${value.meridiem}`,
    [value]
  );

  const setNow = useCallback(() => {
    onChange(nowTimePickerValue());
  }, [onChange]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--color-border)] bg-black/20",
        compact ? "p-3" : "p-4",
        className
      )}
    >
      {!compact && (
        <div className="flex items-center justify-between mb-4">
          <span
            className="text-sm font-mono text-[var(--color-accent)]"
            suppressHydrationWarning
          >
            {display}
          </span>
          <button
            type="button"
            onClick={setNow}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-[var(--color-muted)] hover:text-white hover:bg-white/10 transition"
          >
            <Clock className="w-3.5 h-3.5" />
            Now
          </button>
        </div>
      )}

      <div className={cn("flex items-center justify-center gap-2", compact && "gap-1.5")}>
        <TimeColumn
          label="Hour"
          value={value.hours}
          min={1}
          max={12}
          onChange={(hours) => onChange({ ...value, hours })}
        />
        <span className="text-2xl font-bold text-[var(--color-muted)] self-center mt-4">
          :
        </span>
        <TimeColumn
          label="Min"
          value={value.minutes}
          min={0}
          max={59}
          onChange={(minutes) => onChange({ ...value, minutes })}
        />
        <span className="text-2xl font-bold text-[var(--color-muted)] self-center mt-4">
          :
        </span>
        <TimeColumn
          label="Sec"
          value={value.seconds}
          min={0}
          max={59}
          onChange={(seconds) => onChange({ ...value, seconds })}
        />

        <div className="flex flex-col gap-1.5 ml-2 self-center mt-4">
          {(["AM", "PM"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ ...value, meridiem: m })}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-semibold transition min-w-[48px]",
                value.meridiem === m
                  ? "bg-[var(--color-primary)] text-white shadow-lg shadow-indigo-500/20"
                  : "bg-black/30 text-[var(--color-muted)] hover:bg-white/10 hover:text-white"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function timePickerToString(v: TimePickerValue) {
  return `${v.hours}:${pad(v.minutes)}:${pad(v.seconds)} ${v.meridiem}`;
}

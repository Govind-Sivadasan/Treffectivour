"use client";

import { Input } from "@/components/ui/input";
import { parseDateKey } from "@/lib/calculations";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface DateFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  max?: string;
  min?: string;
  disabled?: boolean;
}

/** Text-based YYYY-MM-DD field — avoids iOS native date input overflow. */
export function DateField({
  value,
  onChange,
  className,
  max,
  min,
  disabled,
}: DateFieldProps) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  function commit(raw: string) {
    const parsed = parseDateKey(raw);
    if (!parsed) {
      setText(value);
      return;
    }
    if (max && parsed > max) {
      setText(value);
      return;
    }
    if (min && parsed < min) {
      setText(value);
      return;
    }
    onChange(parsed);
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      placeholder="YYYY-MM-DD"
      value={text}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => commit(text.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(text.trim());
        }
      }}
      className={cn("font-mono tabular-nums tracking-tight text-sm", className)}
    />
  );
}

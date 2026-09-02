"use client";

import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { getDateKey, shiftDateKey } from "@/lib/calculations";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DayDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  max?: string;
}

export function DayDatePicker({
  value,
  onChange,
  max = getDateKey(),
}: DayDatePickerProps) {
  const isToday = value === max;

  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0 w-full">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0"
        onClick={() => onChange(shiftDateKey(value, -1))}
        aria-label="Previous day"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      <DateField
        value={value}
        onChange={onChange}
        max={max}
        className="flex-1 min-w-0 basis-32"
      />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0"
        onClick={() => onChange(shiftDateKey(value, 1))}
        disabled={value >= max}
        aria-label="Next day"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>

      {!isToday && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={() => onChange(max)}
        >
          Today
        </Button>
      )}
    </div>
  );
}

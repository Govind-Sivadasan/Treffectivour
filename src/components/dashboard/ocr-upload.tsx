"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { timeStringToDate } from "@/lib/time-local";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ClipboardPaste,
  ImageIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface OcrUploadProps {
  date: string;
  onSuccess: () => void;
}

interface PendingOcr {
  dayKey: string;
  rawText: string;
  punches: Array<{ type: "IN" | "OUT"; time: string }>;
}

export function OcrUpload({ date, onSuccess }: OcrUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [pasteReady, setPasteReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingOcr | null>(null);
  const [overrideDate, setOverrideDate] = useState(date);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearPreview = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPending(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [preview]);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file");
        return;
      }

      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(file));
      setPending(null);
      setLoading(true);

      try {
        const { runOcrInBrowser, pickBestOcrResult, scoreOcrPunches } =
          await import("@/lib/ocr");
        toast.message("Reading screenshot…", { duration: 2000 });

        let ocr = await runOcrInBrowser(file);

        if (scoreOcrPunches(ocr.punches) < 40) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 45000);
          try {
            const form = new FormData();
            form.append("image", file);
            form.append("date", overrideDate);
            const res = await fetch("/api/ocr", {
              method: "POST",
              body: form,
              signal: controller.signal,
            });
            if (res.ok) {
              const data = await res.json();
              if (data.ocr) {
                ocr = pickBestOcrResult(ocr, data.ocr);
              }
            }
          } catch {
            // keep browser result
          } finally {
            clearTimeout(timeout);
          }
        }

        const dayKey = overrideDate || ocr.dateKey;
        if (!dayKey) {
          toast.error("Could not detect date — set it manually above");
          return;
        }

        if (ocr.punches.length === 0) {
          toast.message("OCR could not read times clearly", {
            description: "Use manual entry or try a clearer screenshot.",
          });
          return;
        }

        setPending({
          dayKey,
          rawText: ocr.rawText,
          punches: ocr.punches.map((p) => ({ type: p.type, time: p.time })),
        });
        toast.message("Review extracted punches below", { duration: 2500 });
      } catch {
        toast.error("Failed to process screenshot");
      } finally {
        setLoading(false);
      }
    },
    [overrideDate, preview]
  );

  async function confirmSave() {
    if (!pending) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: pending.dayKey,
          rawText: pending.rawText,
          punches: pending.punches.map((p) => ({
            type: p.type,
            timestamp: timeStringToDate(pending.dayKey, p.time).toISOString(),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save punches");
        return;
      }
      toast.success(`Saved ${pending.punches.length} punches`);
      clearPreview();
      onSuccess();
    } catch {
      toast.error("Failed to save punches");
    } finally {
      setSaving(false);
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const extractClipboardImage = useCallback((clipboard: DataTransfer | null) => {
    if (!clipboard) return null;

    for (const item of clipboard.items) {
      if (item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (!blob) continue;
        const ext = blob.type.split("/")[1] || "png";
        return new File([blob], `clipboard-${Date.now()}.${ext}`, { type: blob.type });
      }
    }

    return null;
  }, []);

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }

      const file = extractClipboardImage(e.clipboardData);
      if (!file) return;

      e.preventDefault();
      processFile(file);
    },
    [extractClipboardImage, processFile]
  );

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  useEffect(() => {
    setOverrideDate(date);
  }, [date]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardTitle className="flex items-center gap-2 mb-4">
        <ImageIcon className="w-5 h-5 text-[var(--color-accent)] shrink-0" />
        Screenshot Import
      </CardTitle>

      <div className="mb-4 min-w-0 w-full">
        <Label>Date override (if OCR misses it)</Label>
        <DateField
          value={overrideDate}
          onChange={setOverrideDate}
          className="w-full"
        />
        <p className="text-[10px] text-[var(--color-muted)] mt-1">Format: YYYY-MM-DD</p>
      </div>

      {!preview && (
        <div
          ref={dropRef}
          tabIndex={0}
          onFocus={() => setPasteReady(true)}
          onBlur={() => setPasteReady(false)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "relative rounded-xl border-2 border-dashed p-8 text-center transition cursor-pointer outline-none",
            dragging
              ? "border-[var(--color-accent)] bg-cyan-500/10"
              : pasteReady
                ? "border-[var(--color-primary)] bg-indigo-500/10 ring-2 ring-indigo-500/20"
                : "border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-white/5"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
            }}
            disabled={loading}
          />
          {loading ? (
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-[var(--color-primary)]" />
          ) : (
            <Upload className="w-10 h-10 mx-auto text-[var(--color-muted)]" />
          )}
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            Drop screenshot, click to browse, or paste from clipboard
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs text-[var(--color-accent)]">
            <ClipboardPaste className="w-3.5 h-3.5" />
            Copy screenshot, then press Ctrl+V (Cmd+V on Mac)
          </p>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Review punches before saving. Missing OUT uses current time.
          </p>
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden border border-[var(--color-border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Screenshot preview"
              className="w-full max-h-48 object-contain bg-black/40"
            />
            <button
              type="button"
              onClick={clearPreview}
              disabled={loading || saving}
              className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-lg bg-black/70 border border-white/10 px-2.5 py-1.5 text-xs text-white hover:bg-black/90 transition"
              aria-label="Close screenshot"
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              </div>
            )}
          </div>

          {pending && (
            <div className="rounded-xl border border-[var(--color-border)] bg-black/20 p-4 space-y-3">
              <p className="text-sm font-medium text-[var(--color-accent)]">
                Extracted punches — confirm before saving
              </p>
              {pending.rawText.trim() && (
                <details className="text-xs text-[var(--color-muted)]">
                  <summary className="cursor-pointer hover:text-white">
                    Raw OCR text (for debugging)
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-black/40 p-2 font-mono text-[10px] leading-relaxed">
                    {pending.rawText.trim()}
                  </pre>
                </details>
              )}
              <ul className="space-y-2">
                {pending.punches.map((p, idx) => (
                  <li
                    key={`${p.type}-${p.time}-${idx}`}
                    className="flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-sm"
                  >
                    {p.type === "IN" ? (
                      <ArrowDownLeft className="w-4 h-4 text-[var(--color-success)]" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-[var(--color-danger)]" />
                    )}
                    <span className="font-semibold w-10">{p.type}</span>
                    <span className="font-mono tabular-nums">{p.time}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pt-1">
                <Button onClick={confirmSave} disabled={saving} className="flex-1">
                  <Check className="w-4 h-4" />
                  {saving ? "Saving…" : "Save punches"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={clearPreview}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!pending && !loading && (
            <p className="text-sm text-[var(--color-muted)] text-center">
              No punches detected. Close and try another screenshot, or use manual entry.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

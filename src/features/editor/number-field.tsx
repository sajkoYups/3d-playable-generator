"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const INCOMPLETE = new Set(["", "-", "+", ".", "-.", "+."]);

export function parseNumberDraft(raw: string): number | null {
  const text = raw.trim();
  if (INCOMPLETE.has(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export function formatNumberValue(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Object.is(n, -0)) return "0";
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1e6) / 1e6);
}

function rangeMessage(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return `Must be ${min}–${max}`;
  if (min !== undefined) return `Must be at least ${min}`;
  if (max !== undefined) return `Must be at most ${max}`;
  return "Out of range";
}

function isInRange(n: number, min?: number, max?: number): boolean {
  if (min !== undefined && n < min) return false;
  if (max !== undefined && n > max) return false;
  return true;
}

function toCommitValue(n: number, integer?: boolean): number | null {
  if (integer) {
    if (n !== Math.round(n)) return null;
    return Math.round(n);
  }
  return n;
}

function clampToRange(n: number, min?: number, max?: number): number {
  let next = n;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}

function decimalPlaces(n: number): number {
  const s = n.toString().toLowerCase();
  if (s.includes("e")) {
    const [base, exp] = s.split("e");
    const expNum = Number(exp);
    const baseDec = base.includes(".") ? (base.split(".")[1]?.length ?? 0) : 0;
    return Math.max(0, baseDec - expNum);
  }
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

function addStep(n: number, step: number, direction: 1 | -1): number {
  const places = Math.max(decimalPlaces(n), decimalPlaces(step));
  return Number((n + direction * step).toFixed(Math.min(places, 10)));
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  integer,
  disabled,
  className,
  labelClassName,
  onChange,
}: {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const resolvedStep = step ?? 1;
  const [draft, setDraft] = useState(() => formatNumberValue(value));
  const focusedRef = useRef(false);
  const draftRef = useRef(draft);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const repeatTimeoutRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);
  draftRef.current = draft;
  valueRef.current = value;
  onChangeRef.current = onChange;

  useEffect(() => {
    if (focusedRef.current) return;
    setDraft(formatNumberValue(value));
  }, [value]);

  useEffect(() => () => stopRepeat(), []);

  const parsed = parseNumberDraft(draft);
  const commitValue = parsed === null ? null : toCommitValue(parsed, integer);
  const notInteger = integer && parsed !== null && parsed !== Math.round(parsed);
  const outOfRange = commitValue !== null && !isInRange(commitValue, min, max);
  const invalidText = draft.trim() !== "" && parsed === null;
  const error = invalidText
    ? "Enter a number"
    : notInteger
      ? "Must be a whole number"
      : outOfRange
        ? rangeMessage(min, max)
        : null;

  function commit(raw: string): boolean {
    const n = parseNumberDraft(raw);
    if (n === null) return false;
    const next = toCommitValue(n, integer);
    if (next === null || !isInRange(next, min, max)) return false;
    if (next !== valueRef.current) onChangeRef.current(next);
    return true;
  }

  function commitStepped(n: number) {
    let next = clampToRange(n, min, max);
    if (integer) next = Math.round(next);
    const formatted = formatNumberValue(next);
    draftRef.current = formatted;
    setDraft(formatted);
    if (next !== valueRef.current) onChangeRef.current(next);
  }

  function stepBy(direction: 1 | -1) {
    const fromDraft = parseNumberDraft(draftRef.current);
    const base = fromDraft ?? valueRef.current;
    commitStepped(addStep(base, resolvedStep, direction));
  }

  function stopRepeat() {
    if (repeatTimeoutRef.current !== null) {
      window.clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
    if (repeatIntervalRef.current !== null) {
      window.clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }

  function startRepeat(direction: 1 | -1) {
    stopRepeat();
    stepBy(direction);
    repeatTimeoutRef.current = window.setTimeout(() => {
      repeatIntervalRef.current = window.setInterval(() => stepBy(direction), 50);
    }, 400);
  }

  return (
    <div className={cn("space-y-1", className)}>
      {label ? (
        <Label htmlFor={id} className={labelClassName}>
          {label}
        </Label>
      ) : null}
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode={integer ? "numeric" : "decimal"}
          disabled={disabled}
          value={draft}
          aria-invalid={Boolean(error)}
          role="spinbutton"
          aria-valuenow={parsed ?? value}
          aria-valuemin={min}
          aria-valuemax={max}
          className={cn(
            "pr-7",
            error ? "border-destructive focus-visible:ring-destructive" : undefined,
          )}
          onFocus={(e) => {
            focusedRef.current = true;
            const el = e.currentTarget;
            requestAnimationFrame(() => {
              if (document.activeElement === el) el.select();
            });
          }}
          onChange={(e) => {
            const next = e.target.value;
            draftRef.current = next;
            setDraft(next);
            commit(next);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              stepBy(1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              stepBy(-1);
            }
          }}
          onBlur={() => {
            focusedRef.current = false;
            const raw = draftRef.current;
            if (commit(raw)) {
              const n = parseNumberDraft(raw);
              const next = n === null ? valueRef.current : (toCommitValue(n, integer) ?? valueRef.current);
              setDraft(formatNumberValue(next));
              return;
            }
            setDraft(formatNumberValue(valueRef.current));
          }}
        />
        <div className="absolute inset-y-[3px] right-[3px] flex w-5 flex-col overflow-hidden rounded-sm border border-border bg-background">
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label="Increase"
            className="flex h-1/2 items-center justify-center text-muted hover:bg-muted hover:text-foreground disabled:opacity-40"
            onPointerDown={(e) => {
              if (e.button !== 0 || disabled) return;
              e.preventDefault();
              startRepeat(1);
            }}
            onPointerUp={stopRepeat}
            onPointerLeave={stopRepeat}
            onPointerCancel={stopRepeat}
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label="Decrease"
            className="flex h-1/2 items-center justify-center border-t border-border text-muted hover:bg-muted hover:text-foreground disabled:opacity-40"
            onPointerDown={(e) => {
              if (e.button !== 0 || disabled) return;
              e.preventDefault();
              startRepeat(-1);
            }}
            onPointerUp={stopRepeat}
            onPointerLeave={stopRepeat}
            onPointerCancel={stopRepeat}
          >
            <ChevronDown className="size-3" />
          </button>
        </div>
      </div>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}

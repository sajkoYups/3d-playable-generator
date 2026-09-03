"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function toSwatchHex(value: string | undefined, fallback: string): string {
  const raw = (value || "").trim();
  const long = raw.match(/^#([0-9a-fA-F]{6})$/);
  if (long) return `#${long[1].toLowerCase()}`;
  const short = raw.match(/^#([0-9a-fA-F]{3})$/);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const rgb = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const hex = (n: string) => Number(n).toString(16).padStart(2, "0");
    return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`;
  }
  const fb = fallback.match(/^#([0-9a-fA-F]{6})$/);
  return fb ? fallback.toLowerCase() : "#e07a3d";
}

export function ColorField({
  label,
  value,
  fallback,
  disabled,
  onChange,
}: {
  label: string;
  value: string | undefined;
  fallback: string;
  disabled?: boolean;
  onChange: (hex: string) => void;
}) {
  const hex = toSwatchHex(value, fallback);
  const [draft, setDraft] = useState(value || hex);

  useEffect(() => {
    setDraft(value || hex);
  }, [value, hex]);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          disabled={disabled}
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Input
          value={draft}
          disabled={disabled}
          spellCheck={false}
          placeholder={fallback}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(next.trim())) {
              onChange(toSwatchHex(next, fallback));
            }
          }}
          onBlur={() => {
            const normalized = toSwatchHex(draft, hex);
            setDraft(normalized);
            if (normalized !== hex) onChange(normalized);
          }}
        />
      </div>
    </div>
  );
}

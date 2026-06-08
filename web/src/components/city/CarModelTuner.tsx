"use client";

import * as React from "react";
import {
  CAR_CONFIGS,
  CAR_VARIANTS,
  formatCarConfigSnippet,
  getCarModelTuning,
  type CarModelTuning,
  type CarVariant,
} from "@/game/content/cars";

type SliderSpec = {
  key: keyof CarModelTuning;
  label: string;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
};

const SLIDERS: SliderSpec[] = [
  { key: "scale", label: "Scale", min: 0.001, max: 250, step: 0.05 },
  { key: "modelYaw", label: "Yaw (rad)", min: -Math.PI * 2, max: Math.PI * 2, step: 0.01, format: (v) => `${v.toFixed(3)} rad` },
  { key: "modelTilt", label: "Tilt (rad)", min: -Math.PI, max: Math.PI, step: 0.01, format: (v) => `${v.toFixed(3)} rad` },
  { key: "forwardOffset", label: "Cam distance", min: 0, max: 80, step: 0.5 },
  { key: "downOffset", label: "Ground sink", min: -2, max: 10, step: 0.05 },
  { key: "sideOffset", label: "Side nudge", min: -10, max: 10, step: 0.05 },
  { key: "eyeOffset", label: "Eye height", min: 0, max: 30, step: 0.1 },
  { key: "speed", label: "Max speed", min: 20, max: 180, step: 1, format: (v) => String(Math.round(v)) },
  { key: "accel", label: "Acceleration", min: 20, max: 120, step: 1, format: (v) => String(Math.round(v)) },
  { key: "turnRadius", label: "Turn radius", min: 8, max: 80, step: 0.5, format: (v) => `${v.toFixed(1)}m` },
];

function EditableValue({
  value,
  display,
  onCommit,
}: {
  value: number;
  display: string;
  onCommit: (next: number) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const lastTapAt = React.useRef(0);

  const startEditing = React.useCallback(() => {
    setDraft(String(value));
    setEditing(true);
  }, [value]);

  React.useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const commit = React.useCallback(() => {
    const parsed = Number(draft.trim());
    if (Number.isFinite(parsed)) onCommit(parsed);
    setEditing(false);
  }, [draft, onCommit]);

  const cancel = React.useCallback(() => {
    setEditing(false);
  }, []);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        className="w-[88px] rounded border border-emerald-400/50 bg-black/60 px-1.5 py-0.5 text-right font-mono text-[10px] text-emerald-100 outline-none focus:ring-1 focus:ring-emerald-400/60"
      />
    );
  }

  return (
    <button
      type="button"
      onDoubleClick={startEditing}
      onPointerUp={() => {
        const now = Date.now();
        if (now - lastTapAt.current < 320) startEditing();
        lastTapAt.current = now;
      }}
      className="cursor-text rounded px-1 py-0.5 font-mono text-emerald-100 underline decoration-emerald-400/30 decoration-dotted underline-offset-2 hover:bg-emerald-500/10 hover:decoration-emerald-400/70"
      title="Double-click or double-tap to type"
    >
      {display}
    </button>
  );
}

export function CarModelTuner({
  variant,
  tuning,
  onChange,
  onReset,
  onVariantChange,
  className = "",
}: {
  variant: CarVariant;
  tuning: CarModelTuning;
  onChange: (next: CarModelTuning) => void;
  onReset: () => void;
  onVariantChange?: (next: CarVariant) => void;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const cfg = CAR_CONFIGS[variant];
  const variantIdx = CAR_VARIANTS.indexOf(variant);

  const cycleVariant = React.useCallback(
    (delta: number) => {
      if (!onVariantChange || CAR_VARIANTS.length === 0) return;
      const base = variantIdx >= 0 ? variantIdx : 0;
      const next = (base + delta + CAR_VARIANTS.length) % CAR_VARIANTS.length;
      onVariantChange(CAR_VARIANTS[next]!);
    },
    [onVariantChange, variantIdx],
  );

  const copySnippet = React.useCallback(async () => {
    const snippet = formatCarConfigSnippet(variant, tuning);
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this into cars.ts:", snippet);
    }
  }, [tuning, variant]);

  return (
    <div className={`space-y-2 rounded-xl border border-emerald-500/30 bg-black/40 p-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300/90">Model tuner</p>
          <p className="mt-0.5 text-[10px] text-[#484f58]">
            {cfg.label} · <span className="font-mono text-emerald-200/80">{variant}</span>
          </p>
          <p className="mt-0.5 text-[9px] text-white/30">Double-click a value to type</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-white/60 hover:bg-white/10"
          onClick={onReset}
        >
          Reset
        </button>
      </div>

      {onVariantChange && (
        <div className="rounded-lg border border-white/10 bg-black/30 p-2">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">Switch car</p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-mono text-white/70 hover:bg-white/10"
              onClick={() => cycleVariant(-1)}
              aria-label="Previous car"
            >
              ←
            </button>
            <div className="grid min-w-0 flex-1 grid-cols-4 gap-1">
              {CAR_VARIANTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onVariantChange(v)}
                  className={`rounded-md border py-1 text-[9px] font-mono uppercase tracking-[0.08em] transition ${
                    v === variant
                      ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100"
                      : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-mono text-white/70 hover:bg-white/10"
              onClick={() => cycleVariant(1)}
              aria-label="Next car"
            >
              →
            </button>
          </div>
        </div>
      )}

      {SLIDERS.map(({ key, label, min, max, step, format }) => (
        <div key={key}>
          <div className="flex items-center justify-between gap-2 text-[10px] text-[#484f58]">
            <span className="font-mono uppercase tracking-[0.18em]">{label}</span>
            <EditableValue
              value={tuning[key]}
              display={format ? format(tuning[key]) : tuning[key].toFixed(2)}
              onCommit={(next) => onChange({ ...tuning, [key]: next })}
            />
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={Math.min(max, Math.max(min, tuning[key]))}
            onChange={(e) => onChange({ ...tuning, [key]: Number(e.target.value) })}
            className="w-full accent-emerald-400"
          />
        </div>
      ))}

      <div className="rounded-lg border border-white/10 bg-black/30 p-2">
        <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">Preview snippet</p>
        <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all font-mono text-[9px] leading-relaxed text-emerald-100/80">
          {formatCarConfigSnippet(variant, tuning)}
        </pre>
      </div>

      <button
        type="button"
        className="w-full rounded-lg border border-emerald-500/40 bg-emerald-500/15 py-1.5 text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-100 hover:bg-emerald-500/25"
        onClick={() => void copySnippet()}
      >
        {copied ? "Copied!" : "Copy config to clipboard"}
      </button>
    </div>
  );
}

export function useCarModelTuning(variant: CarVariant) {
  const [override, setOverride] = React.useState<Partial<CarModelTuning>>({});
  const tuning = React.useMemo(() => getCarModelTuning(variant, override), [variant, override]);

  React.useEffect(() => {
    setOverride({});
  }, [variant]);

  const reset = React.useCallback(() => setOverride({}), []);

  const setTuning = React.useCallback((next: CarModelTuning) => {
    const base = getCarModelTuning(variant);
    const diff: Partial<CarModelTuning> = {};
    (Object.keys(next) as (keyof CarModelTuning)[]).forEach((key) => {
      if (Math.abs(next[key] - base[key]) > 1e-6) diff[key] = next[key];
    });
    setOverride(diff);
  }, [variant]);

  return { tuning, override, setTuning, reset };
}

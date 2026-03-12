"use client";

import type { CityId } from "@/lib/types";

const LABELS: Record<CityId, string> = {
  lahore: "Lahore",
  karachi: "Karachi",
  islamabad: "Islamabad",
};

interface Props {
  selected: CityId | null;
  onSelect(city: CityId): void;
  disabled?: boolean;
}

export function CitySelector({ selected, onSelect, disabled }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {(Object.keys(LABELS) as CityId[]).map((city) => {
        const active = city === selected;
        return (
          <button
            key={city}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(city)}
            className={`px-6 py-3 rounded-xl border text-sm font-semibold tracking-wide transition-all
              ${
                active
                  ? "bg-emerald-400 text-black border-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.9)]"
                  : "bg-slate-900/70 text-emerald-100 border-emerald-500/50 hover:bg-slate-900 hover:border-emerald-200/80"
              }
              ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            {LABELS[city]}
          </button>
        );
      })}
    </div>
  );
}


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
                  ? "bg-pink-400 text-black border-pink-300 shadow-[0_0_30px_rgba(236,72,153,0.8)]"
                  : "bg-slate-900/70 text-pink-100 border-purple-500/50 hover:bg-slate-900 hover:border-pink-200/80"
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


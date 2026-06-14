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
            className={`px-6 py-3 rounded-xl border bg-black text-sm font-semibold tracking-wide transition-all
              ${
                active
                  ? "text-emerald-100 border-emerald-700 shadow-[0_0_18px_rgba(6,78,59,0.55)]"
                  : "text-emerald-200/70 border-emerald-950 hover:border-emerald-700 hover:text-emerald-100"
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


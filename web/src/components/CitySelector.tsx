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
    <div className="flex flex-wrap items-center justify-center gap-3">
      {(Object.keys(LABELS) as CityId[]).map((city) => {
        const active = city === selected;
        return (
          <button
            key={city}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(city)}
            className={`px-5 py-2.5 border-2 text-sm font-semibold tracking-wide font-mono uppercase
              ${
                active
                  ? "gc-btn-active"
                  : "gc-btn text-[#484f58] border-[#30363d] hover:text-[#7ee787]"
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

"use client";

import { useEffect, useRef } from "react";
import type { CityId } from "@/lib/types";
import type { CityLayoutResult } from "@/lib/city/layout";
import { findSectorAt, gameAnalytics } from "./tracker";

type Options = {
  username: string;
  cityId: CityId;
  vehicle: string;
  theme: string;
  layoutResult: CityLayoutResult;
  getPose: () => { x: number; z: number };
  enabled?: boolean;
};

export function useGameAnalytics({
  username,
  cityId,
  vehicle,
  theme,
  layoutResult,
  getPose,
  enabled = true,
}: Options) {
  const getPoseRef = useRef(getPose);
  getPoseRef.current = getPose;

  const sectorEnteredAtRef = useRef<number>(Date.now());
  const currentSectorRef = useRef<{ id: number; label: string } | null>(null);
  const themeRef = useRef(theme);
  const themeStartedAtRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled || !username.trim()) return;

    void gameAnalytics.startSession({
      username: username.trim(),
      cityId,
      vehicle,
      theme,
    });

    const onPageHide = () => {
      void gameAnalytics.endSession();
    };
    window.addEventListener("pagehide", onPageHide);

    const positionInterval = window.setInterval(() => {
      if (!gameAnalytics.sessionActive) return;
      const pose = getPoseRef.current();
      gameAnalytics.trackPosition(pose.x, pose.z);

      const sector = findSectorAt(pose.x, pose.z, layoutResult.sectors);
      const prev = currentSectorRef.current;
      const now = Date.now();

      if (sector && (!prev || prev.id !== sector.id)) {
        if (prev) {
          const seconds = (now - sectorEnteredAtRef.current) / 1000;
          if (seconds >= 2) {
            gameAnalytics.trackSector(prev.id, prev.label, seconds);
          }
        }
        currentSectorRef.current = { id: sector.id, label: sector.label };
        sectorEnteredAtRef.current = now;
      } else if (!sector && prev) {
        const seconds = (now - sectorEnteredAtRef.current) / 1000;
        if (seconds >= 2) {
          gameAnalytics.trackSector(prev.id, prev.label, seconds);
        }
        currentSectorRef.current = null;
      }
    }, 5000);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(positionInterval);

      const prev = currentSectorRef.current;
      if (prev) {
        const seconds = (Date.now() - sectorEnteredAtRef.current) / 1000;
        if (seconds >= 2) {
          gameAnalytics.trackSector(prev.id, prev.label, seconds);
        }
      }

      void gameAnalytics.endSession();
    };
    // Session lifecycle is tied to entering the city canvas, not every pose callback change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId, enabled, username, vehicle]);

  useEffect(() => {
    if (!enabled || !gameAnalytics.sessionActive) return;
    if (themeRef.current === theme) return;

    const seconds = (Date.now() - themeStartedAtRef.current) / 1000;
    gameAnalytics.trackTheme(theme, seconds);
    themeRef.current = theme;
    themeStartedAtRef.current = Date.now();
  }, [enabled, theme]);

  return gameAnalytics;
}

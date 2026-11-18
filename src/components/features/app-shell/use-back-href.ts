"use client";

import { useSyncExternalStore } from "react";

import { backTarget, readNavHistory } from "@/lib/nav-history";

const noopSubscribe = () => () => {};

/**
 * Where "Tilbage" on `here` goes: the club page the member came from
 * (lib/nav-history.ts, D-179), else `fallback`. The fallback before
 * hydration, so server and client render the same link.
 */
export function useBackHref(here: string, clubPath: string, fallback: string): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => backTarget(readNavHistory(), here, clubPath, fallback),
    () => fallback,
  );
}

import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/**
 * How a user is referenced wherever the UI shows a person (D-105): creators,
 * hosts, owners, raters, members. Always through getDisplayName (nickname ??
 * name); only the member list and the profile also show the official name.
 */
export const personSelect = {
  id: true,
  name: true,
  nickname: true,
  image: true,
} satisfies Prisma.UserSelect;

export type PersonRef = {
  id: string;
  name: string;
  nickname: string | null;
  image: string | null;
};

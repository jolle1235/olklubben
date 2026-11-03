import { createCn } from "cn/config";

import { TEXT_ROLES } from "@/styles/tokens/typography";

/**
 * clsx + tailwind-merge, told about the type scale's text roles (SPEC §13.3).
 * Without it `text-title-sm` would count as a text colour, so next to
 * `text-primary-ink` one of them would be dropped. Import cn from here, never
 * from "cn" (ESLint enforces it).
 */
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: TEXT_ROLES }] } },
});

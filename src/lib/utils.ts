import { createCn } from "cn/config";

import { TEXT_ROLES } from "@/styles/tokens/typography";

/**
 * Knows the type scale's text roles. Plain "cn" sees `text-title-sm` as a colour
 * and drops it next to `text-primary-ink` (F-091).
 */
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: TEXT_ROLES }] } },
});

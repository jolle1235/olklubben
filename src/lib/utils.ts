import { createCn } from "cn/config";

import { SPACING_NAMES } from "@/styles/tokens/spacing";
import { TEXT_ROLES } from "@/styles/tokens/typography";

/**
 * Knows the type scale's text roles and the spacing tokens. Plain "cn" sees
 * `text-title-sm` as a colour and drops it next to `text-primary-ink` (F-091),
 * and keeps both `p-card` and `p-4`.
 */
export const cn = createCn({
  extend: {
    classGroups: { "font-size": [{ text: TEXT_ROLES }] },
    theme: { spacing: SPACING_NAMES },
  },
});

// SPDX-License-Identifier: AGPL-3.0-only
/** Une clases condicionales, descartando valores falsy. */
export function clsx(
  ...parts: (string | false | null | undefined)[]
): string {
  return parts.filter(Boolean).join(" ");
}

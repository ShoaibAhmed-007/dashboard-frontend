/**
 * Field styling shared by the Create and Edit MOM forms.
 *
 * Extracted so the two screens cannot drift apart — Edit is meant to read as
 * the same form as Create, and a copy-pasted class string is the usual way
 * that stops being true.
 */

export const fieldClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

export const labelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

/** `SingleDateField` supplies its own `mt-1.5`, so its label must not also add
 *  a bottom margin or the gap doubles against the neighbouring fields. */
export const dateLabelClass =
  "block text-sm font-medium text-gray-700 dark:text-gray-300";

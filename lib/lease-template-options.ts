/**
 * Languages a lease template can be written in. Tanzanian tenancy agreements
 * are drawn up in either, and often both — so a template carries the language
 * it is written in rather than the organization declaring one globally.
 *
 * Codes are stored, labels are shown. Nothing translates the app itself; this
 * only describes the prose inside a template.
 */
export const LEASE_TEMPLATE_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "sw", label: "Swahili" },
] as const;

export type LeaseTemplateLanguage =
  (typeof LEASE_TEMPLATE_LANGUAGES)[number]["value"];

export const LEASE_TEMPLATE_LANGUAGE_VALUES = LEASE_TEMPLATE_LANGUAGES.map(
  (language) => language.value
) as [LeaseTemplateLanguage, ...LeaseTemplateLanguage[]];

export function languageLabel(value: string) {
  return (
    LEASE_TEMPLATE_LANGUAGES.find((language) => language.value === value)
      ?.label ?? value
  );
}

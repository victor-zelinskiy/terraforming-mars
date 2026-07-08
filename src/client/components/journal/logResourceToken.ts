import {iconClassFor} from '@/client/components/modalInputs/optionIcons';

/**
 * Resolves a `RESOURCE` log token's icon KEY (a Resource / CardResource /
 * GlobalParameter value, or 'tr' / 'cards') to its premium inline-icon CSS
 * class via the SHARED `iconClassFor` (the one visual vocabulary), and to a
 * human label used for `aria-label` (accessibility — never a native title).
 * Shared by the modern journal renderer AND the legacy log renderer so the two
 * can't diverge.
 */

// i18n keys for the icon families whose value is not already a readable word.
// Card resources ('Floater', 'Microbe', …) ARE readable words, so they fall
// through to the value itself.
const RESOURCE_LABEL_KEYS: Readonly<Record<string, string>> = {
  megacredits: 'M€',
  steel: 'Steel',
  titanium: 'Titanium',
  plants: 'Plants',
  energy: 'Energy',
  heat: 'Heat',
  tr: 'TR',
  cards: 'cards',
  temperature: 'Temperature',
  oxygen: 'Oxygen',
  oceans: 'Oceans',
  ocean: 'Oceans',
  venus: 'Venus',
};

export function logResourceIconClass(value: string): string {
  return iconClassFor(value);
}

/** The i18n key for a token's accessible label (translated by the caller). */
export function logResourceLabelKey(value: string): string {
  return RESOURCE_LABEL_KEYS[value] ?? value;
}

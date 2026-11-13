/*
 * THE MODIFIER OF INFLUENCE — its words (`ConsoleInfluenceMod.vue` draws the «+N», this module says what stands
 * behind it). Pure: a reading in, a sentence out.
 */
import {translateText} from '@/client/directives/i18n';
import {InfluenceReading} from '@/client/console/parliament/influenceReading';

/** The giver of an entry the server keeps no name for (an older save) — the Information zone's own word. */
export const INFLUENCE_OTHER_SOURCE = 'other';

/** «Сверх Карьеры: Анализ событий +1 · …» — the modifier's hint, in the sources' own order. */
export function influenceModHint(reading: InfluenceReading): string {
  const parts = reading.sources.map((entry) => `${translateText(entry.source ?? INFLUENCE_OTHER_SOURCE)} +${entry.amount}`);
  const head = translateText('beyond the Agenda track');
  return parts.length === 0 ? `${head} +${reading.bonus}` : `${head}: ${parts.join(' · ')}`;
}

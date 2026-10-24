/**
 * @console-shared LIVE — the console's effects explorer and «Действия карт» stand on this file.
 *
 * WHO an effect or an action belongs to — ONE typed source for every surface of the effect framework (Turmoil Redux
 * «один фреймворк», 2026-10-24): a played CARD, a PARTY of the Parliament, or the ENACTED LAW. A party / a law is a
 * source of the same chassis with a badge, never a second chassis — and never a stand-in card name (the old
 * `PARTY_<party>` keys pretended to be `CardName`s). Surfaces key their groups by `sourceKey`.
 */
import {CardName} from '@/common/cards/CardName';
import {ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';

export type CardEffectSource = {kind: 'card', name: CardName};
export type PoliticalEffectSource = {kind: 'party', party: ReduxParty} | {kind: 'law', resolution: ResolutionId};
export type EffectSource = CardEffectSource | PoliticalEffectSource;

/** The source's stable key — `card:<name>` · `party:<party>` · `law:<id>` (a v-for key, a group key, a claim key). */
export function sourceKey(source: EffectSource): string {
  switch (source.kind) {
  case 'card': return `card:${source.name}`;
  case 'party': return `party:${source.party}`;
  case 'law': return `law:${source.resolution}`;
  }
}

export function isPoliticalSource(source: EffectSource): source is PoliticalEffectSource {
  return source.kind !== 'card';
}

/** The card behind a source, or `undefined` for a party / a law (a reader that needs a `CardModel` answers «nothing»). */
export function sourceCardName(source: EffectSource): CardName | undefined {
  return source.kind === 'card' ? source.name : undefined;
}

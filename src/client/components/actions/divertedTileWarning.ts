import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {divertedTileOf} from '@/client/components/actions/actionEffectReading';

/**
 * «YOU WILL NOT PLACE THIS TILE» — the words a composer says beside a greenery / ocean the standing law REPLACES
 * (Turmoil Redux RX35 Diverted Research; the owner, 2026-10-25: the struck icon alone let a player play a greenery card
 * and meet only a data pick). Read off the server's own mark (`ActionEffect.diverted` on the tile chip), never
 * re-derived: one row per struck tile chip, in the composers' skipped-effect shape — the title names the lost tile,
 * the chip shows it struck with the data it becomes, the reason names the law (the chip hint's own words).
 */
export type DivertedTileWarning = {title: string, reason: string, effect: ActionEffect, icon: ''};

const TITLE: Readonly<Record<'greenery' | 'ocean', {one: string, many: string}>> = {
  greenery: {one: 'The greenery tile will NOT be placed', many: 'The greenery tiles will NOT be placed'},
  ocean: {one: 'The ocean tile will NOT be placed', many: 'The ocean tiles will NOT be placed'},
};

export function divertedTileWarnings(effects: ReadonlyArray<ActionEffect> | undefined): Array<DivertedTileWarning> {
  const out: Array<DivertedTileWarning> = [];
  for (const effect of effects ?? []) {
    const tile = divertedTileOf(effect);
    const mark = effect.diverted;
    if (tile === undefined || mark === undefined) {
      continue;
    }
    const law = translateText(getResolution(mark.resolution)?.text.name ?? mark.resolution);
    out.push({
      title: translateText(effect.amount > 1 ? TITLE[tile].many : TITLE[tile].one),
      reason: translateTextWithParams(mark.lost === true ?
        'Replaced by ${0}: ${1} data — no card of yours can hold it' :
        'Replaced by ${0}: ${1} data on one of your cards', [law, String(mark.data)]),
      effect,
      icon: '',
    });
  }
  return out;
}

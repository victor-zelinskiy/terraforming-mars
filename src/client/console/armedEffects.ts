/*
 * THE «ВЗВЕДЕНО» READING (TR49 class) — a seat's armed one-play effects as
 * the console shows them: the strip over the hand album (where the next card
 * is CHOSEN), its compact twin in the dock, the «ЭФФЕКТЫ» section of the
 * Information mode. Pure: the server says what is armed
 * (`PublicPlayerModel.armedPlayEffects`, read off the card `lastCardPlayed`
 * names); this module only orders and phrases it — one formatter
 * (`requirementEasingText`) for every surface.
 */
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {ArmedPlayEffectKind, ArmedPlayEffectModel} from '@/common/models/ArmedPlayEffectModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {translateText} from '@/client/directives/i18n';
import {armedEffectBadge, armedEffectFormula, EASING_KEYS} from '@/client/console/requirementEasingText';

export type ArmedEffectView = {
  /** Stable render key. */
  key: string;
  source: CardName;
  /** The source is a PRELUDE — it hosts its own next play inside its effect. */
  prelude: boolean;
  kind: ArmedPlayEffectKind['kind'];
  /** «Требования глобальных параметров игнорируются» / «… ±2» / «Следующая карта −8 M€». */
  formula: string;
  /** The compact badge — «игнор.» / «±2» / «−8». */
  badge: string;
  /** «до следующего розыгрыша». */
  expiry: string;
};

function viewOf(armed: ArmedPlayEffectModel, index: number): ArmedEffectView {
  return {
    key: `${armed.source}:${armed.effect.kind}:${index}`,
    source: armed.source,
    prelude: armed.sourceType === CardType.PRELUDE,
    kind: armed.effect.kind,
    formula: armedEffectFormula(armed.effect),
    badge: armedEffectBadge(armed.effect),
    expiry: translateText(EASING_KEYS.untilNextPlay),
  };
}

/** The seat's armed effects, in the server's order (one armed card — usually one effect). */
export function armedEffectsOf(player: Pick<PublicPlayerModel, 'armedPlayEffects'> | undefined): ReadonlyArray<ArmedEffectView> {
  return (player?.armedPlayEffects ?? []).map(viewOf);
}

/** The ONE source the strip names (the card played last — one field, one armed card). */
export function armedSourceOf(views: ReadonlyArray<ArmedEffectView>): CardName | undefined {
  return views[0]?.source;
}

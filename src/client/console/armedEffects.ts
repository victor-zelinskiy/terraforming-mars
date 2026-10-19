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
import {ArmedPlayEffectKind, ArmedPlayEffectModel, armedSourceCard, armedSourceKey, isArmedLawSource} from '@/common/models/ArmedPlayEffectModel';
import {ResolutionId} from '@/common/parliament/ParliamentTypes';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {translateText} from '@/client/directives/i18n';
import {armedEffectBadge, armedEffectFormula, armedSourceName, EASING_KEYS} from '@/client/console/requirementEasingText';

export type ArmedEffectView = {
  /** Stable render key. */
  key: string;
  /** The CARD that armed it — undefined when a LAW did (RX36 Live Experiments — `law`). */
  source: CardName | undefined;
  /** The LAW that armed it (RX36 — its paid action), when no card did. */
  law?: ResolutionId;
  /** The source's stable key (a card's name, `law:<id>`) — DOM hooks and comparisons. */
  sourceKey: string;
  /** The source's own name, translated — the card's, or the law's. */
  sourceName: string;
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
  const sourceKey = armedSourceKey(armed.source);
  return {
    key: `${sourceKey}:${armed.effect.kind}:${index}`,
    source: armedSourceCard(armed.source),
    ...(isArmedLawSource(armed.source) ? {law: armed.source.resolution} : {}),
    sourceKey,
    sourceName: armedSourceName(armed.source),
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

/** The ONE source the strip names first (the card played last, else the law — RX36). */
export function armedSourceOf(views: ReadonlyArray<ArmedEffectView>): ArmedEffectView | undefined {
  return views[0];
}

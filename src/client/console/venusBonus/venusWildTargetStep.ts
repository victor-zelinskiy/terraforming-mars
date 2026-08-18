/*
 * THE VENUS WILD-RESOURCE TARGET STEP — the pure glue between the alt-track
 * bonus's own `SelectCard` and the SHARED played-card target selector
 * (`ConsolePlayedTargetStep` + `consolePlayedTargetModel`).
 *
 * WHY GLUE AND NOT A SURFACE. «Куда положить дикий ресурс» is the same decision
 * as «куда положить награду» (position 9 of the hydronetwork, a colony trade
 * payout, «Обстрел кометами» during a blue action): point at a physical card
 * already on the table and see what the press does to it. The console owns ONE
 * selector for that. The Venus bonus used to own a SECOND one — a bare
 * `overflow-x` strip of card faces driven by an index cursor, with no
 * `current → resulting`, no VP reading, no status rail, and the last candidates
 * physically cut off once the player held more than a few resource cards. That
 * is exactly the drift this fork forbids, so it is gone; this module only
 * translates the Venus shapes into the selector's model.
 *
 * ELIGIBILITY IS THE SERVER'S, and it is read from the SERVER'S OWN INPUT: the
 * candidates are `SelectCardModel.cards` — the very list the response is
 * validated against — so «все валидные карты доступны» is true by construction
 * rather than by a client-side re-derivation. Those models also carry the LIVE
 * per-card resource count (`SelectCard` serializes with `showResources`), which
 * is what makes the `было → стало` reading honest.
 *
 * Deliberate parallels with the hydro and colony glue, all structural:
 *  · NO `sourceCardName` — the bonus is paid by the VENUS TRACK, not by a card,
 *    so every candidate renders as its own physical face;
 *  · the preview is built from the step's own numbers (the live count on the
 *    candidate + the fixed +1 of the wild);
 *  · the VP reading is the SERVER's (`VenusBonusPromptMeta.wildCardVp`, produced
 *    by the same `actionPreviews.targetVictoryPoints` every other picker reads).
 *    Nothing here re-derives a scoring rule.
 *
 * PURE: no DOM, no Vue, no i18n (labels are English i18n KEYS); unit-tested.
 */
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {VictoryPointsDelta} from '@/common/models/ActionPreviewModel';
import {
  BuildPlayedTargetInput, PlayedTargetImpact, PlayedTargetModel, PlayedTargetPreviewSection,
  buildPlayedTargetModel,
} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetResourceFor} from '@/client/console/played/consolePlayedTargetPreview';

/** The wild is exactly ONE resource — the server's `addResourceTo(card, {qty: 1})`. */
export const VENUS_WILD_AMOUNT = 1;

/**
 * The wild's own `SelectCard`, dug out of the prompt the server actually sent.
 *
 * SHAPE, NEVER TITLE. The final-step prompt is a single `OrOptions` whose
 * branch 0 is `AndOptions(SelectCard wild-on-card, GainResources(base))` — the
 * same shape `venusBonusResponse` answers, so reading it here and writing it
 * there can never disagree. Returns `undefined` for the base bonus and for a
 * final bonus with no eligible card (both are a top-level `AndOptions`), which
 * is precisely when the on-card branch must be shown DISABLED with its reason.
 */
export function venusWildCardInput(prompt: unknown): SelectCardModel | undefined {
  const or = prompt as {
    type?: string,
    options?: ReadonlyArray<{type?: string, options?: ReadonlyArray<{type?: string}>}>,
  } | undefined;
  if (or?.type !== 'or') {
    return undefined;
  }
  const branch = or.options?.[0];
  if (branch?.type !== 'and') {
    return undefined;
  }
  const first = branch.options?.[0];
  return first?.type === 'card' ? (first as SelectCardModel) : undefined;
}

/**
 * The candidates, verbatim off the server's input.
 *
 * The marker's `wildCardTargets` names the same set (both are built from one
 * `player.getResourceCards()` call), but only the INPUT carries the live models
 * the selector renders — so the picker reads the input, and the marker stays
 * what it always was: the routing signal plus read-only preview data.
 */
export function venusWildCandidates(prompt: unknown): ReadonlyArray<CardModel> {
  return venusWildCardInput(prompt)?.cards ?? [];
}

export type BuildVenusWildTargetInput = {
  /** The server's own candidates (`venusWildCandidates`) — eligibility verbatim. */
  candidates: ReadonlyArray<CardModel>;
  /** Every player, for owner resolution (`PlayedTargetPlayerRef` shape). */
  players: BuildPlayedTargetInput['players'];
  viewerColor: string;
  /** The step's ask, already translated by the caller (empty when the host
   *  states it itself — the selector's `hostStatesAsk`). */
  ask: string;
  /** `ClientCardManifest.getCard(...)?.type`, injected for purity. */
  typeOf: (name: CardName) => CardType | undefined;
  /**
   * The card's OWN resource type, already in the `iconClassFor` vocabulary.
   * The wild takes the shape of whatever it lands on, so the resource being
   * placed is a PER-CANDIDATE fact — one header icon would be a lie on five
   * cards out of six.
   */
  resourceOf: (name: CardName) => string | undefined;
  /** The server's authoritative per-candidate VP reading (`wildCardVp`). */
  vpBox?: Partial<Record<CardName, VictoryPointsDelta>>;
};

/**
 * ONE candidate's contextual reading: the honest `current → resulting` on the
 * card's own counter, plus the victory points that resource MOVES.
 *
 * WHY A MOVED VP ONLY. The shared preview builder deliberately keeps a STATIC
 * reading («1 ПО за каждые ЧЕТЫРЕ микроба, и там сейчас 0»), because in a
 * REMOVAL choice «these points do not respond at all» and «they respond, just
 * not to this cube» are opposite answers. Here every candidate is the player's
 * own card and the wild is a GIFT: nothing is weighed against a loss, so a
 * «ПО 0 → 0» chip beside «0 → 1» adds a number that does not move to a line
 * whose whole job is the numbers that do. Absent VP data and a static reading
 * therefore render identically — the card states its resource change and stops.
 */
function venusWildPreview(
  card: CardModel | undefined,
  icon: string | undefined,
  vp: VictoryPointsDelta | undefined,
): ReadonlyArray<PlayedTargetPreviewSection> {
  if (card === undefined) {
    return [];
  }
  // A card with no counter yet reads as 0 — `SelectCard` omits the field rather
  // than sending a zero, so the absent field IS the zero.
  const from = card.resources ?? 0;
  const impacts: Array<PlayedTargetImpact> = [{
    label: 'Resources on this card',
    icon,
    from,
    to: from + VENUS_WILD_AMOUNT,
  }];
  if (vp !== undefined && vp.from !== vp.to) {
    // No icon: 'vp' resolves to no sprite in the shared vocabulary, and a broken
    // glyph beside a number is worse than the canonical «ПО» label.
    impacts.push({label: 'VP', from: vp.from, to: vp.to});
  }
  return [{key: 'res', title: 'Target card', entity: 'target', impacts}];
}

/**
 * The selector model of the Venus wild-resource target. Every candidate carries
 * the `было → стало` reading and the card's own resource badge — zero included,
 * because a legal target that happens to be empty must still answer «сколько
 * там сейчас».
 */
export function buildVenusWildTargetModel(input: BuildVenusWildTargetInput): PlayedTargetModel {
  const byName = new Map(input.candidates.map((c) => [c.name, c]));
  return buildPlayedTargetModel({
    candidates: input.candidates,
    players: input.players,
    viewerColor: input.viewerColor,
    ask: input.ask,
    typeOf: input.typeOf,
    preview: (name) => venusWildPreview(byName.get(name), input.resourceOf(name), input.vpBox?.[name]),
    resourceContext: (name, model) =>
      playedTargetResourceFor(VENUS_WILD_AMOUNT, input.resourceOf(name), model),
  });
}

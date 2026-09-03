/*
 * STARTUP STATUS PREVIEW — the pure model of the summary's status panel
 * (the Game Start Workspace).
 *
 * Deliberately MINIMAL: a quick decision summary — «что выбрано и сколько
 * денег останется» — never a pre-game simulator of the Player Rail. The
 * cards themselves already state their effects; this panel carries only the
 * financial core and the two set counts the final confirmation needs.
 *
 * AUTHORITATIVE ONLY: money through the shared `initialDraftMoney` brain
 * (the exact corp × prelude × buy-count pairs the desktop start screen and
 * the server agree on). Nothing speculative, nothing re-implemented.
 */
import {CardName} from '@/common/cards/CardName';
import {afterPreludes, cardCostForCorp, startingMegacredits} from '@/client/components/initialDraft/initialDraftMoney';
import type {InitialCardsPicks} from '@/client/console/consoleStartState';

export type StartStatusPreview = {
  corp: CardName | undefined,
  /** ── the financial core ── */
  start: number,
  buys: number,
  cardCost: number,
  /** −buys × cardCost (0 when nothing is bought). */
  projectsCost: number,
  /** The preludes' printed M€ effects (incl. the corp-pair extras). */
  preludeDelta: number,
  /** What the player will actually hold after the purchase resolves. */
  remaining: number,
  /** ── the set counts ── */
  /** The starting HAND (the bought projects — they go to the hand dock). */
  handSize: number,
  preludeCount: number,
};

/** CAMPAIGN missions 2–3: the lineage's contribution to the wizard money
 *  (see `campaignWizardExtra` — the client mirror of the server budget). */
export type CampaignPreviewExtra = {megaCredits: number, cardCostDelta: number, mergeFee: number};

const NO_EXTRA: CampaignPreviewExtra = {megaCredits: 0, cardCostDelta: 0, mergeFee: 0};

/** Build the preview from the current picks. Undefined until a corporation
 *  is chosen (there is no start state to preview without an identity). */
export function buildStartStatusPreview(picks: InitialCardsPicks, extra: CampaignPreviewExtra = NO_EXTRA): StartStatusPreview | undefined {
  const corp = picks.corp;
  if (corp === undefined) {
    return undefined;
  }
  const buys = picks.projects.length;
  const start = (startingMegacredits(corp, 0) ?? 0) + extra.megaCredits;
  const cardCost = cardCostForCorp(corp) + extra.cardCostDelta;
  const preludeDelta = afterPreludes(corp, picks.preludes, buys);
  return {
    corp,
    start,
    buys,
    cardCost,
    projectsCost: buys * cardCost,
    preludeDelta,
    remaining: start - buys * cardCost + preludeDelta,
    handSize: buys,
    preludeCount: picks.preludes.length,
  };
}

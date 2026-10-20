/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «КВИТАНЦИЯ СТОЛА» — the sitting's showing of a card payout that ASKED NOBODY
 * (Turmoil Redux: Sponsored Projects RX40, «add 1 resource to each of your
 * cards that already has a resource»; docs/TURMOIL_REDUX_SPONSORED_PROJECTS.md).
 *
 * Every earlier law that pays onto cards ASKS where (a pick, a layout), and its
 * showing stands on that question: the chips land on the picker's capsules
 * (`consoleResolutionPayout`). This payout has no question, so it has no picker
 * to land on — and the seat's cards are nowhere on the sitting's screen. The
 * receipt is the surface that shows them: the viewer's RECEIVING cards as a
 * row of faces in the reward stage's zone, each token born on the law's
 * printed «?» and landing on its own card's capsule IN TURN, the capsule
 * ticking on the touchdown, the card's points read beside it.
 *
 * THE BEAT IS SPLIT like every reward beat of this console (DETECT → SEED →
 * OWE → PLAY):
 *   DETECT — pure, against the authoritative response: the viewer's
 *            `cardResource` records with `onto: 'each-counted'` (structural —
 *            never a prompt, never a title) this response ADDED to the live
 *            phase, with at least one card that received;
 *   SEED   — in the SAME synchronous block as the view apply (from
 *            `parliamentRewardBeat.seedParliamentRewardHold`): the satellite's
 *            and the capsules' counters held at their pre-payout values
 *            (`beginPanelRewardHold`), the cards' victory points claimed for
 *            the touchdowns (`claimVpShares` … `releaseOnLanding`) — only while
 *            the sitting's stage stands; a parked sitting holds nothing and the
 *            counters tick with the commit;
 *   OWE    — the receipt waits here for the sitting director's reward stage
 *            (`sittingDirector.beatReceipt`), after the seat's own wave and the
 *            Career's walks — the draw's take first (one press, several effects:
 *            the surfaces go IN TURN);
 *   PLAY   — the director stands the receipt in the zone, the law's impulse
 *            hands off to ONE scene of the card-receive director (the fifth host,
 *            `cardReceiveDirector` — PRESENT · PAY · READ · RETURN), and the
 *            receipt leaves.
 *
 * Honest like every ledger: a reload (no «before» with fewer records) replays
 * nothing; reduced motion owes nothing; every hold is bounded and released on
 * every way out. Pure + a reactive record: no DOM, no Vue components, no i18n.
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel, ParliamentPhaseModel} from '@/common/models/ParliamentModel';
import {rewardAddressOf} from '@/common/parliament/rewardAddress';
import {ResourceTransferSpec, cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {beginPanelRewardHold, releasePanelRewardHold, resetCardResourceLandings} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {claimVpShares, dropVpClaim, releaseVpShares} from '@/client/console/scoreCell/vpShareLedger';
import {ART_THUMB_MAX_CSS_WIDTH, CardArtTier, preloadPremiumCardArt} from '@/client/cards/cardArt';
import {conUiScale} from '@/client/console/consoleLayoutProfile';

/** ONE card of the receipt: the card, the kind it took (the server's), what it held BEFORE, the units and its points' move. */
export type ReceiptCard = {
  card: CardName;
  /** The card resource the card took — its own storage rule (the record's `cards[].resource`). */
  resource: string;
  /** The transfer key of that kind (`animal`, `floater`, `data`) — the token's sprite, the satellite's row. */
  iconKey: string;
  before: number;
  amount: number;
  /** The card's points before and after the unit — the server's reading, present only where the points moved or read the resource. */
  vp?: {from: number; to: number};
};

/** ONE receipt the sitting still owes the viewer. */
export type TableReceipt = {
  /** The record's structural identity (seat · step · part · kind). */
  key: string;
  player: Color;
  generation: number;
  cards: ReadonlyArray<ReceiptCard>;
  /** The transfer of each card, in the record's order — the very objects the panel hold was seeded with. */
  specs: ReadonlyArray<ResourceTransferSpec>;
};

/** What the receipt is doing — the stage's pose and the e2e probes read it. */
export type TableReceiptPhase = '' | 'enter' | 'impulse' | 'present' | 'pay' | 'read' | 'return' | 'leave';

/** The VP claim's owner — one per sitting (a re-claim replaces it). */
export const TABLE_RECEIPT_VP_OWNER = 'parliament-table-receipt';

export const tableReceiptState = reactive({
  /** The sitting the receipts belong to (`generation:seq`) — a new sitting drops what the old one still owed. */
  sitting: '',
  /** The receipts still to show, in the records' order. */
  owed: [] as Array<TableReceipt>,
  /** The receipt standing in the zone now (from its arrival until its departure has finished). */
  showing: undefined as TableReceipt | undefined,
  /** The phase of the receipt on screen. */
  phase: '' as TableReceiptPhase,
  /** The receipt's pane has entered the zone (its entrance played) — the wave may measure its capsules. */
  paneIn: false,
  /** Specs still held on the panel (released by touchdown, or all at once by a release). */
  held: [] as Array<ResourceTransferSpec>,
  /** How many receipts the session has shown — a probe's counter. */
  shown: 0,
});

function phaseOf(view: PlayerViewModel | undefined): ParliamentPhaseModel | undefined {
  return view?.game.parliament?.phase;
}

function recordKey(outcome: ParliamentEnactOutcomeModel): string {
  return `${outcome.player}:${outcome.step}:${outcome.part ?? ''}:${outcome.kind}`;
}

/** The receipt of ONE record — undefined for a record that is not a card payout onto every counted card, or one that landed nothing. */
export function receiptOf(outcome: ParliamentEnactOutcomeModel, generation: number): TableReceipt | undefined {
  if (outcome.kind !== 'cardResource' || outcome.onto !== 'each-counted' || outcome.player === undefined) {
    return undefined;
  }
  const delivery = rewardAddressOf(outcome, outcome.player);
  const cards: Array<ReceiptCard> = [];
  for (const entry of delivery.payload.cards ?? []) {
    if (entry.resource === undefined || entry.amount <= 0) {
      continue;
    }
    cards.push({
      card: entry.card as CardName,
      resource: entry.resource,
      iconKey: cardResourceKey(entry.resource),
      before: entry.before ?? 0,
      amount: entry.amount,
      ...(entry.vp === undefined ? {} : {vp: {from: entry.vp.from, to: entry.vp.to}}),
    });
  }
  if (cards.length === 0) {
    return undefined;
  }
  const specs: Array<ResourceTransferSpec> = cards.map((c) => ({channel: 'card-resource', resource: c.iconKey, amount: c.amount, targetCard: c.card}));
  return {key: recordKey(outcome), player: outcome.player, generation, cards, specs};
}

/**
 * DETECT (pure): the VIEWER's each-counted card payouts the RESPONSE added to
 * the live phase — present in `after`, absent from `before` (same generation).
 * A first view or a new generation adds nothing: a reload has nothing to move
 * from, so nothing replays.
 */
export function detectNewTableReceipts(before: PlayerViewModel | undefined, after: PlayerViewModel): Array<TableReceipt> {
  const phase = phaseOf(after);
  const was = phaseOf(before);
  const viewer = after.thisPlayer?.color;
  if (viewer === undefined || phase === undefined || was === undefined || was.generation !== phase.generation) {
    return [];
  }
  const known = new Set((was.outcomes ?? []).map(recordKey));
  const out: Array<TableReceipt> = [];
  for (const outcome of phase.outcomes ?? []) {
    if (outcome.player !== viewer || known.has(recordKey(outcome))) {
      continue;
    }
    const receipt = receiptOf(outcome, phase.generation);
    if (receipt !== undefined) {
      out.push(receipt);
    }
  }
  return out;
}

function enterSitting(key: string): void {
  if (tableReceiptState.sitting === key) {
    return;
  }
  releaseTableReceipts();
  tableReceiptState.sitting = key;
}

/**
 * SEED — called by the reward ledger's seed, in the SAME synchronous block as
 * the commit. `onScreen`: the sitting's stage stands and motion is allowed —
 * else nothing is owed and nothing held (the counters tick with the commit).
 */
export function seedTableReceipts(sitting: string, before: PlayerViewModel | undefined, after: PlayerViewModel, onScreen: boolean): void {
  enterSitting(sitting);
  const fresh = detectNewTableReceipts(before, after);
  if (fresh.length === 0 || !onScreen) {
    return;
  }
  for (const receipt of fresh) {
    if (tableReceiptState.owed.some((r) => r.key === receipt.key) || tableReceiptState.showing?.key === receipt.key) {
      continue;
    }
    beginPanelRewardHold(receipt.specs);
    tableReceiptState.held.push(...receipt.specs);
    tableReceiptState.owed.push(receipt);
    // The faces stand up with their pictures: warmed (fetched AND decoded) at the seed, in every tier the receipt's
    // faces may paint on this profile — the reward's wave plays before the pane opens, time enough for eight.
    preloadPremiumCardArt(receipt.cards.map((c) => c.card), receiptArtTiers(conUiScale()));
  }
  // THE CARDS' POINTS ride the touchdowns: a card whose points the unit moved is held on the rail's score cell until
  // its own token lands (the ledger's `releaseOnLanding` — the contact beat of `noteCardResourceLanding`).
  const names = new Set<string>(tableReceiptState.owed.flatMap((r) => r.cards.map((c) => c.card)));
  claimVpShares(TABLE_RECEIPT_VP_OWNER, (share) => share.source.kind === 'card' && names.has(share.source.card), 0, {releaseOnLanding: true});
}

/** A receipt is owed or on screen — the reward stage holds its field and its page for it. */
export function tableReceiptsOwed(): boolean {
  return tableReceiptState.owed.length > 0 || tableReceiptState.showing !== undefined;
}

/** The director takes the NEXT receipt and stands it in the zone (its pane enters). */
export function takeTableReceipt(): TableReceipt | undefined {
  const receipt = tableReceiptState.owed.shift();
  if (receipt !== undefined) {
    // The capsules read the TOUCHDOWNS of THIS payout (`cardResourceLanded`) — a stale tally would tick a face early.
    resetCardResourceLandings();
    tableReceiptState.showing = receipt;
    tableReceiptState.phase = 'enter';
    tableReceiptState.paneIn = false;
    tableReceiptState.shown++;
  }
  return receipt;
}

/** ONE token touched down on its card: the satellite's and the capsule's counter tick now (exactly this spec). */
export function markReceiptSpecLanded(spec: ResourceTransferSpec): void {
  const index = tableReceiptState.held.findIndex((held) => held.targetCard === spec.targetCard && held.resource === spec.resource && held.amount === spec.amount);
  if (index < 0) {
    return;
  }
  tableReceiptState.held.splice(index, 1);
  releasePanelRewardHold(spec);
}

/** The receipt on screen is done: its pane leaves (the stage's leave phrase), nothing of it is held any more. */
export function endTableReceipt(): void {
  const receipt = tableReceiptState.showing;
  if (receipt !== undefined) {
    for (const spec of receipt.specs) {
      markReceiptSpecLanded(spec);
    }
  }
  tableReceiptState.showing = undefined;
  tableReceiptState.phase = '';
  tableReceiptState.paneIn = false;
  if (tableReceiptState.owed.length === 0) {
    releaseVpShares(TABLE_RECEIPT_VP_OWNER, {why: 'table-receipt-done'});
    dropVpClaim(TABLE_RECEIPT_VP_OWNER);
  }
}

/**
 * Release EVERY receipt at once (the stage settled without its beat, the sitting left, collapsed or unmounted, a
 * new sitting, the ceiling): every held counter ticks now, honestly late, never lost.
 */
export function releaseTableReceipts(): void {
  for (const spec of tableReceiptState.held.splice(0)) {
    releasePanelRewardHold(spec);
  }
  tableReceiptState.owed = [];
  tableReceiptState.showing = undefined;
  tableReceiptState.phase = '';
  tableReceiptState.paneIn = false;
  releaseVpShares(TABLE_RECEIPT_VP_OWNER, {why: 'table-receipt-release'});
  dropVpClaim(TABLE_RECEIPT_VP_OWNER);
}

/** Full reset (game switch, test cleanup). */
export function resetTableReceiptBeat(): void {
  releaseTableReceipts();
  tableReceiptState.sitting = '';
  tableReceiptState.shown = 0;
}

/**
 * A receipt owed or on screen HOLDS THE FOREGROUND — from the block that seeded it to the end of its departure: the
 * next ask (another seat's take, the adjourn gate) waits on the presentation until the last token has landed. The
 * registry's ceiling is the one wedge net; its `expire` releases the counters honestly.
 */
registerAnimationHoldSupplier('parliament-table-receipt', () => tableReceiptsOwed(), {
  diagnose: () => ({
    sitting: tableReceiptState.sitting,
    owed: tableReceiptState.owed.map((r) => r.key),
    showing: tableReceiptState.showing?.key,
    phase: tableReceiptState.phase,
    held: tableReceiptState.held.map((spec) => `${spec.targetCard}:${spec.resource}+${spec.amount}`),
  }),
  expire: () => releaseTableReceipts(),
});

// ── the row's geometry (pure) ────────────────────────────────────────────────

/** The premium face's natural box — the receipt scales THE face, never re-lays it out. */
export const RECEIPT_CARD_W = 320;
export const RECEIPT_CARD_H = 460;
/** The largest face: its natural size × the console's scale × this — the scene's scale, never a HUD's. */
const RECEIPT_MAX_ZOOM = 1.1;

/**
 * The art tiers a receipt face may paint on a profile of scale `ui` (the face's tier follows its solved width —
 * `artTierForWidth`): the thumb always, the full file only where the widest face passes the thumb's ceiling (a few
 * cards on the TV). What the seed warms. Pure.
 */
export function receiptArtTiers(ui: number): Array<CardArtTier> {
  return RECEIPT_CARD_W * RECEIPT_MAX_ZOOM * ui > ART_THUMB_MAX_CSS_WIDTH ? ['thumb', 'full'] : ['thumb'];
}

export type ReceiptRowInput = {
  /** The pane's content box (px). */
  availW: number;
  availH: number;
  count: number;
  /** The console's UI scale (`--con-ui-scale`): 1 at 1080, 2 at 4K. */
  ui: number;
  /** The reading under each card (the capsule's «2 → 3», the points' line) — px at the current scale. */
  tagH: number;
};

export type ReceiptRow = {zoom: number; gap: number};

/**
 * THE ROW — ONE line of faces, whatever their number (the receipt is read as a row; a second line would be a second
 * object): the largest face the pane affords in width AND in height — the scene's scale, never a HUD's (a face at its
 * natural size × the console's scale at most: a pane that stood two-thirds empty around four small faces read as a
 * leftover, the 1080 storyboard of 2026-10-21) — the gap a share of the face so eight cards draw closer, never
 * touching. Pure.
 */
export function planReceiptRow(o: ReceiptRowInput): ReceiptRow {
  const n = Math.max(1, o.count);
  const maxZoom = RECEIPT_MAX_ZOOM * o.ui;
  const gapShare = n <= 4 ? 0.12 : 0.06;
  // n·w·z + (n−1)·gapShare·w·z ≤ availW
  const zW = o.availW / (RECEIPT_CARD_W * (n + (n - 1) * gapShare));
  const zH = Math.max(0, o.availH - o.tagH) / RECEIPT_CARD_H;
  const zoom = Math.max(0.05, Math.min(maxZoom, zW, zH));
  return {zoom, gap: gapShare * RECEIPT_CARD_W * zoom};
}

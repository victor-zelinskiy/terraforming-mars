/*
 * THE SETTLEMENT TABLE — several settlements on one colony, each paying «draw 1, then discard 1» (Pluto), as ONE
 * table of k places (colony polish iteration 1, docs/claude/console/colony-resolution.md § Iteration 13).
 *
 * The rules resolve one settlement at a time and in FULL before the next card is drawn, so a player with k
 * settlements answers k payouts in a row and never sees card N+1 before choosing what to throw away for card N.
 * The console used to show that as k separate reveals: the next settlement's place held a static card back «born
 * from nowhere» with «Ожидает завершения предыдущего бонуса» under it, the table vanished for the discard, and the
 * next card then FLEW IN AGAIN to the place the player had just watched a card lie on (the owner's report).
 *
 * The table is now one physical object with three laws:
 *  1 · ONE OBJECT, ONE TURN. Place N's card is dealt FACE-DOWN under a SEAL with the first payout (from the
 *      colony's printed «БОНУС ВЛАДЕЛЬЦА» card — the colony pays per settlement); it never flies again. When its
 *      turn comes (the server's marker reaches N and draws it) that very card turns over IN PLACE, once.
 *  2 · THE RULE READS AS OBJECTS. The seal names its condition («−1 · после сброса за бонус N−1»), it rides into
 *      the hand's plate while the player chooses, and it BREAKS on the touchdown of that discard.
 *  3 · ONE INSTANCE. The table is the same reveal instance for the whole resolution (parked, never unmounted,
 *      while the hand owns the room); its places are keyed by their index, so the place element that held the
 *      sealed back IS the element that turns.
 *
 * Everything here is either PURE (spec'd under the server runner — `tests/client/console/settlementTable.spec.ts`)
 * or the tiny reactive record the surfaces share. The SERVER's marker (`discardPrompt.colonyBonus {index, total}`)
 * stays the only authority on where the sequence stands; this module only remembers what the screen has already
 * physically shown (which places were dealt, which seals broke, which place owes its turn).
 */

import {reactive} from 'vue';
import {ColonyBonusDiscardMeta, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {Reading, readingText} from '@/client/console/readingText';
import {adoptDeckSeed, releaseDeckDisplay} from '@/client/console/consoleDeckDisplay';

/** The ONE in-place turn of a sealed place: owed (its card arrived) → turning (the turn plays) → done. */
export type SettlementTurnPhase = 'none' | 'owed' | 'turning' | 'done';

export const settlementTable = reactive({
  /**
   * The INSTANCE identity of this resolution's table (0 = no table stands). Bumped once per resolution, never
   * per cycle: the e2e guard stamps the reveal root with it and demands one value from the first deal to the
   * marker's return.
   */
  nonce: 0,
  colony: '',
  /**
   * THE CARD THAT PAYS the pairs OUTSIDE a trade («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» Ф4 — the sealed place is the fork's
   * grammar): Habitat Science's «all your colony bonuses» pays Pluto's pairs through the card's own ledger, the
   * server marks their discard `colonyRepeat` with the card as its source and the batches carry `via`. '' = a trade's
   * table (the colony resolution's own).
   */
  via: '',
  /**
   * WHAT SEALS THE PLACES («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» Ф4 — the sealed place is the fork's grammar, not the colony
   * trade's): `colony` — a colony's pairs («draw 1, then discard 1» per settlement, the marker's ordinal);
   * `question` — a card's QUESTION of the same press (Mars University: «discard a card to draw one» asked after the
   * play's own draw): the batch the question sealed stands as the table's income, ONE place lies sealed beside it
   * («откроется после ответа «…»»), and the answer's draw — the next batch of the same action root — turns in it.
   */
  kind: 'colony' as 'colony' | 'question',
  /** A question table's root (`CardDrawRevealModel.actionId`) and the card that asks (`pendingAnswer.card`). */
  actionId: 0,
  askCard: '',
  /** The batch the question sealed (its id) — the next batch of the root is the place's card. */
  askBatch: 0,
  /** How many places — the recipient's settlements on the tile (the marker's `total`). */
  total: 0,
  /** The place resolving now (the marker's `index`, remembered across the gap between two cycles). */
  index: 0,
  /**
   * The FIRST payout's income cards. A settlement table keeps their sockets for every later cycle, so the places
   * stand at the same rects from the first deal to the last turn — a table that re-centres between cycles moves
   * the very card the player is waiting on.
   */
  incomeSlots: 0,
  /** Places whose card physically LIES on the table face-down (dealt, or materialized by a door with no deal). */
  dealt: [] as Array<number>,
  /** Places whose seal has broken — the previous place's discard touched down. */
  broken: [] as Array<number>,
  /** The place whose in-place turn is owed / playing / played (0 = none). */
  turnPlace: 0,
  turnPhase: 'none' as SettlementTurnPhase,
  /** The table has been ON SCREEN (a batch presented it) — only then may it park between cycles. */
  presented: false,
  /** Places whose card was TAKEN into the hand (its discard then owed) — remembered across the park. */
  taken: [] as Array<number>,
  /** The place whose seal has LEFT the table for the hand's plate (the discard step) — 0 = none. */
  sealLifted: 0,
  /** The seal BREAKING right now — the discard for the place before it touched down (0 = none). */
  breakingSeal: 0,
  /**
   * The cursor stands on a SEALED place (read-only — the owner's decision): the shell's bar shows no verb and
   * the status line reads the seal's condition. 0 = the cursor is on a card.
   */
  focusSealed: 0,
});

let nonceSeq = 0;

/**
 * ARM (idempotent): a payout of `total` > 1 settlements stands on this colony. A table for another colony (or
 * none) starts a fresh instance; the same colony keeps its instance and only advances `index`.
 */
export function armSettlementTable(colony: string, total: number, index: number, via: string = ''): void {
  if (total <= 1 || colony === '') {
    return;
  }
  if (settlementTable.nonce === 0 || settlementTable.kind !== 'colony' || settlementTable.colony !== colony || settlementTable.via !== via) {
    clearSettlementTable();
    settlementTable.nonce = ++nonceSeq;
    settlementTable.kind = 'colony';
    settlementTable.colony = colony;
    settlementTable.via = via;
  }
  settlementTable.total = total;
  settlementTable.index = Math.max(1, Math.min(index, total));
}

/**
 * ARM A QUESTION TABLE (idempotent): the batch `askBatch` of root `actionId` was sealed by `askCard`'s question. ONE
 * place; `index` 0 while the question stands (the place lies sealed), 1 once the answer's draw is on the wire (the
 * place's card turns). A different root starts a fresh instance.
 */
export function armQuestionTable(actionId: number, askCard: string, askBatch: number, index: 0 | 1): void {
  if (actionId === 0 || askCard === '') {
    return;
  }
  if (settlementTable.nonce === 0 || settlementTable.kind !== 'question' || settlementTable.actionId !== actionId) {
    clearSettlementTable();
    settlementTable.nonce = ++nonceSeq;
    settlementTable.kind = 'question';
    settlementTable.actionId = actionId;
    settlementTable.askCard = askCard;
    settlementTable.askBatch = askBatch;
  }
  settlementTable.total = 1;
  settlementTable.index = Math.max(settlementTable.index, index);
}

/** The table ends with its resolution (the falling edge) — and on every reset boundary. */
export function clearSettlementTable(): void {
  settlementTable.nonce = 0;
  settlementTable.kind = 'colony';
  settlementTable.actionId = 0;
  settlementTable.askCard = '';
  settlementTable.askBatch = 0;
  settlementTable.colony = '';
  settlementTable.via = '';
  settlementTable.total = 0;
  settlementTable.index = 0;
  settlementTable.incomeSlots = 0;
  settlementTable.dealt = [];
  settlementTable.broken = [];
  settlementTable.turnPlace = 0;
  settlementTable.turnPhase = 'none';
  settlementTable.presented = false;
  settlementTable.taken = [];
  settlementTable.sealLifted = 0;
  settlementTable.breakingSeal = 0;
  settlementTable.focusSealed = 0;
  releaseSettlementDeck();
}

/** The seal of `place` rides into the hand's plate for the discard step (0 = back on the table / none). */
export function liftSettlementSeal(place: number): void {
  settlementTable.sealLifted = place;
}

// ── THE DECK'S ANSWER ────────────────────────────────────────────────────────────────────────────────────────────
// The sealed card is drawn by the server only when its turn comes; its batch lands with the counter already
// smaller. The deck-draw scene seeds the pre-draw number in the apply block (PL-088); the table ADOPTS that seed
// (it never flies the card off the deck) and lets go of it as the card starts to turn — «the deck answers in the
// same beat». Bounded: a turn that never plays lets the counter fall to the server's number.
let deckHeld = false;
let deckNet: ReturnType<typeof setTimeout> | undefined;
const SETTLEMENT_DECK_NET_MS = 10_000;

/** Take the apply-block seed over (the batch is the table's — see the deck-draw layer's verdict). */
export function adoptSettlementDeck(): void {
  if (!adoptDeckSeed()) {
    return;
  }
  deckHeld = true;
  if (deckNet !== undefined) {
    clearTimeout(deckNet);
  }
  deckNet = setTimeout(() => {
    deckNet = undefined;
    releaseSettlementDeck();
  }, SETTLEMENT_DECK_NET_MS);
}

/** The card turns (or is simply shown): the counter falls to the server's number. Idempotent. */
export function releaseSettlementDeck(): void {
  if (deckNet !== undefined) {
    clearTimeout(deckNet);
    deckNet = undefined;
  }
  if (deckHeld) {
    deckHeld = false;
    releaseDeckDisplay();
  }
}

/** Place `place`'s card went into the hand — the table remembers it through the park (its socket keeps the ✓). */
export function noteSettlementTaken(place: number): void {
  if (settlementTable.nonce !== 0 && !settlementTable.taken.includes(place)) {
    settlementTable.taken.push(place);
  }
}

/**
 * THE TABLE OWNS THIS BATCH'S ARRIVAL (the module's own reading of `settlementOwnsBatch`, for the scenes that
 * only know the batch): the colony's draw for a place after the first, while this colony's table stands. The
 * table's `index` is armed from the server's marker by the shell BEFORE any scene's watcher runs (pre-flush, a
 * lower uid), so it already names the cycle this batch belongs to.
 */
export function settlementClaimsBatch(source: CardDrawRevealSource | undefined, batch?: {id: number, actionId?: number}): boolean {
  const t = settlementTable;
  if (t.nonce === 0) {
    return false;
  }
  if (t.kind === 'question') {
    // The answer's draw: the next batch of the question's root (never the sealed batch itself), once the table has
    // been on screen — a question nobody saw sealed has no place for the card to turn in.
    return t.presented && t.index >= 1 && batch !== undefined && batch.actionId !== undefined &&
      batch.actionId === t.actionId && batch.id !== t.askBatch;
  }
  return t.total > 1 && t.index > 1 &&
    source?.type === 'colony' && (source.via ?? '') === t.via && source.colonyName === t.colony;
}

/** The ONE place of a question table: sealed while the question stands, active once the answer's draw is in. */
export function questionZones(table: Pick<SettlementTableView, 'kind' | 'index'>): ReadonlyArray<{index: number, total: number, state: 'active' | 'sealed'}> {
  if (table.kind !== 'question') {
    return [];
  }
  return [{index: 1, total: 1, state: table.index >= 1 ? 'active' : 'sealed'}];
}

/** How the question's answer arrives in its place: a turn where the place lay sealed, simply shown otherwise. */
export function questionArrival(table: Pick<SettlementTableView, 'kind' | 'dealt'>): SettlementArrival {
  if (table.kind !== 'question') {
    return 'door';
  }
  return table.dealt.includes(1) ? 'turn' : 'shown';
}

/**
 * THE PAIR MARKER OF THE STANDING PROMPT — which colony's «draw 1, then discard 1» is being answered, «n of k»,
 * and WHO pays it: a trade's (`colonyBonus`, the colony resolution's own) or a CARD's (`colonyRepeat` with the card
 * as the prompt's source — Habitat Science's ledger). A resolution's pairs (RX07 — `colonyRepeat` with a resolution
 * source) are the sitting's own channel and arm no table here.
 */
export function settlementPairOf(wf: PlayerInputModel | undefined): {meta: ColonyBonusDiscardMeta, via: string} | undefined {
  const discard = wf?.discardPrompt;
  if (discard === undefined) {
    return undefined;
  }
  if (discard.colonyBonus !== undefined) {
    return {meta: discard.colonyBonus, via: ''};
  }
  if (discard.colonyRepeat !== undefined && discard.source?.kind === 'card' && discard.source.card !== undefined) {
    return {meta: discard.colonyRepeat, via: discard.source.card};
  }
  return undefined;
}

export function settlementTableStands(): boolean {
  return settlementTable.nonce !== 0;
}

/** A batch put the table on screen — from now on it parks between cycles instead of unmounting. */
export function noteSettlementPresented(): void {
  if (settlementTable.nonce !== 0) {
    settlementTable.presented = true;
  }
}

/** The reveal's cursor stands on sealed place `place` (0 = on a card). */
export function noteSettlementFocusSealed(place: number): void {
  settlementTable.focusSealed = place;
}

/** The first payout's income count — written once, by the batch that carried it. */
export function noteSettlementIncome(count: number): void {
  if (settlementTable.nonce !== 0 && settlementTable.incomeSlots === 0 && count > 0) {
    settlementTable.incomeSlots = count;
  }
}

/**
 * THE PLACES THE FIRST PAYOUT DEALS face-down — `[2 … total]` while this colony's table stands at its first place
 * and they are not on the table yet; empty otherwise (a single settlement, a later cycle, another colony).
 */
export function settlementPlacesToDeal(colony: string): Array<number> {
  const t = settlementTable;
  if (t.nonce === 0 || t.colony !== colony || t.index !== 1 || t.total <= 1) {
    return [];
  }
  const out: Array<number> = [];
  for (let p = 2; p <= t.total; p++) {
    if (!t.dealt.includes(p)) {
      out.push(p);
    }
  }
  return out;
}

/** These places' cards now lie on the table face-down (the deal landed / a door materialized them). */
export function noteSettlementDealt(places: ReadonlyArray<number>): void {
  for (const p of places) {
    if (!settlementTable.dealt.includes(p)) {
      settlementTable.dealt.push(p);
    }
  }
}

/**
 * THE DISCARD FOR `place − 1` TOUCHED DOWN — the seal on `place` starts to break (one short physical beat on the
 * table: the shackle springs, the disc lets go). Only a place that lies sealed on this table has a seal to break.
 */
export function startSettlementSealBreak(place: number): void {
  if (place > 1 && settlementTable.dealt.includes(place) && !settlementTable.broken.includes(place)) {
    settlementTable.breakingSeal = place;
  }
}

/** The seal on `place` is gone (its break played, or there was nothing to play). */
export function breakSettlementSeal(place: number): void {
  if (place > 0 && !settlementTable.broken.includes(place)) {
    settlementTable.broken.push(place);
  }
  if (settlementTable.breakingSeal === place) {
    settlementTable.breakingSeal = 0;
  }
}

/** Does a seal still stand between `place`'s card and its turn? */
export function settlementSealStands(place: number): boolean {
  return settlementTable.dealt.includes(place) && !settlementTable.broken.includes(place);
}

/** A sealed place's card arrived (the server drew it): its one turn is owed. */
export function oweSettlementTurn(place: number): void {
  if (settlementTable.turnPlace === place && settlementTable.turnPhase !== 'none') {
    return;
  }
  settlementTable.turnPlace = place;
  settlementTable.turnPhase = 'owed';
}

export function setSettlementTurnPhase(place: number, phase: SettlementTurnPhase): void {
  if (settlementTable.turnPlace === place) {
    settlementTable.turnPhase = phase;
  }
}

// ── PURE ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The seal's condition: place N opens after the discard for the bonus right before it. */
export function sealOpensAfter(place: number): number {
  return Math.max(1, place - 1);
}

/** How many places of a sequence still lie sealed while `meta.index` resolves. */
export function sealedPlacesOf(meta: ColonyBonusDiscardMeta | undefined): Array<number> {
  if (meta === undefined || meta.total <= 1) {
    return [];
  }
  const out: Array<number> = [];
  for (let p = Math.max(1, meta.index) + 1; p <= meta.total; p++) {
    out.push(p);
  }
  return out;
}

/** What the table remembers about a place, read as the facts the surfaces need. */
export type SettlementTableView = {
  kind: 'colony' | 'question',
  colony: string,
  /** The paying card ('' for a trade's table). */
  via: string,
  total: number,
  index: number,
  dealt: ReadonlyArray<number>,
  broken: ReadonlyArray<number>,
  turnPlace: number,
  turnPhase: SettlementTurnPhase,
};

/**
 * IS THIS BATCH A SEALED PLACE'S CARD — the table's own arrival, never a flight?
 *
 * The batch of settlement N > 1 (the marker's `index`, its own colony as the source) belongs to the place that
 * has been lying on the table since the first payout. Whoever would otherwise fly it (the trade's covers, the
 * deck-draw scene) stands aside: the card turns over where it lies.
 *
 * A place the table does NOT remember dealing (a reload straight into cycle N, a door that never laid the table)
 * is still the table's — the rule «no second flight» holds for it too — it simply opens in place without a turn
 * (`settlementArrival` → 'shown'). Index 1 is never the table's arrival: the first payout is the deal itself.
 */
export function settlementOwnsBatch(
  meta: ColonyBonusDiscardMeta | undefined,
  source: CardDrawRevealSource | undefined,
  via: string = '',
): boolean {
  return meta !== undefined && meta.total > 1 && meta.index > 1 &&
    source?.type === 'colony' && (source.via ?? '') === via && source.colonyName === meta.colonyName;
}

/**
 * HOW THE CARD OF PLACE `index` ARRIVES — the fourth arrival mode's decision (`consoleCardArrival` §
 * 'sealed-reveal'), SEMANTIC, never timing:
 *  · 'turn'  — the place lay sealed on this table (dealt), so its card turns over in place, once;
 *  · 'shown' — the table never laid this place (a reload, a door with no deal): it is simply open — nothing
 *              replays, nothing is invented;
 *  · 'door'  — not the table's (the first payout, or a single settlement): the door's own flight delivers it.
 */
export type SettlementArrival = 'turn' | 'shown' | 'door';

export function settlementArrival(
  meta: ColonyBonusDiscardMeta | undefined,
  source: CardDrawRevealSource | undefined,
  table: Pick<SettlementTableView, 'colony' | 'dealt'> & Partial<Pick<SettlementTableView, 'via'>>,
): SettlementArrival {
  if (!settlementOwnsBatch(meta, source, table.via ?? '') || meta === undefined) {
    return 'door';
  }
  return table.colony === meta.colonyName && table.dealt.includes(meta.index) ? 'turn' : 'shown';
}

/** What one place of the table PAINTS right now. */
export type SettlementPlacePaint =
  /** The card of THIS cycle, face-up (the first payout's — turned in the air — or a turned/shown place). */
  | 'open'
  /** This cycle's card, still face-down, its in-place turn owed or playing. */
  | 'turning'
  /** A later place: a face-down card under its seal (the seal may already have broken). */
  | 'sealed'
  /** A later place the table has not dealt yet (its cover is still in the air — held invisible). */
  | 'pending'
  /** An earlier place: its card was taken and discarded for — the empty socket with ✓. */
  | 'done'
  /** This cycle's card was TAKEN (it is in the hand) and its discard is still owed — the socket with ✓. */
  | 'taken'
  /** The current place before its card exists (the gap) — the empty socket, never a ✓. */
  | 'empty';

/** Where this cycle's card stands: on the table, taken into the hand, or not here (yet / any more). */
export type SettlementPlaceCard = 'present' | 'taken' | 'absent';

export function settlementPlacePaint(
  place: number,
  current: number,
  card: SettlementPlaceCard,
  table: Pick<SettlementTableView, 'dealt' | 'turnPlace' | 'turnPhase'>,
): SettlementPlacePaint {
  if (place < current) {
    return 'done';
  }
  if (place > current) {
    return table.dealt.includes(place) ? 'sealed' : 'pending';
  }
  if (card === 'taken') {
    return 'taken';
  }
  if (card === 'absent') {
    // The card of this cycle is not on the table yet: a sealed place keeps lying face-down (its card is coming —
    // the server draws it now), a fresh one is an empty socket.
    return table.dealt.includes(place) ? 'sealed' : 'empty';
  }
  if (table.turnPlace === place && (table.turnPhase === 'owed' || table.turnPhase === 'turning')) {
    return 'turning';
  }
  return 'open';
}

/**
 * THE CRUMB'S TAIL across a settlement table carries the ORDINAL and only ever moves forward:
 * «БОНУС 1 ИЗ 2 → СБРОС 1 ИЗ 2 → БОНУС 2 ИЗ 2 → СБРОС 2 ИЗ 2». A single settlement keeps its old words («БОНУС
 * ВЛАДЕЛЬЦА» / «СБРОС КАРТЫ» — «1 из 1» numbers a sequence that does not exist), so it answers `undefined` here.
 */
export function settlementStageReading(kind: 'bonus' | 'discard', meta: Pick<ColonyBonusDiscardMeta, 'index' | 'total'> | undefined): Reading | undefined {
  if (meta === undefined || meta.total <= 1) {
    return undefined;
  }
  const index = Math.max(1, Math.min(meta.index, meta.total));
  return {
    label: kind === 'bonus' ? 'Bonus ${0} of ${1}' : 'Discard ${0} of ${1}',
    params: [String(index), String(meta.total)],
  };
}

/** …rendered through the ONE reading renderer (the crumb takes a pre-translated tail, like the forecast's). */
export function settlementStageText(kind: 'bonus' | 'discard', meta: Pick<ColonyBonusDiscardMeta, 'index' | 'total'> | undefined): string | undefined {
  const reading = settlementStageReading(kind, meta);
  return reading === undefined ? undefined : readingText(reading);
}

/**
 * THE STATUS LINE OF A SEALED PLACE under the cursor (the owner's decision: focusable, read-only, no verb) —
 * English i18n keys with their params, rendered by the one reading renderer.
 */
export function sealedPlaceReading(place: number, total: number, question?: string): Reading {
  if (question !== undefined && question !== '') {
    return {label: 'Opens after answering ${0}', params: [question]};
  }
  return {
    label: 'Colony bonus ${0} of ${1} · opens after the discard for bonus ${2}',
    params: [String(place), String(total), String(sealOpensAfter(place))],
  };
}

/** The seal's condition under a question table's place («после ответа «Марсианский университет»»). */
export function questionSealReading(question: string): Reading {
  return {label: 'after answering ${0}', params: [question]};
}

/*
 * «THE LEDGER PAYS» — the payout of a CARD that gains «all your colony
 * bonuses» (TR23 Habitat Science's action; the server layer is
 * `server/colonies/allColonyBonuses.ts`).
 *
 * BEFORE the press the composer shows the server's ledger — a row per colony
 * tile, in the order the engine pays them. AFTER it the very same rows PAY, in
 * that order, each from its own printed bonus:
 *
 *   · a CHIPS row (a supply / production gain, a resource onto the card chosen
 *     before the press) — its chips are born on the row's bonus cell and land
 *     on the rail; the counter ticks on the touchdown;
 *   · a DRAW row (Miranda) — the workspace's own «ДОБОР КАРТ» takes the zone
 *     over the ledger, the card comes off the deck, the player takes it, the
 *     ledger comes back;
 *   · a PAIRS row (Pluto: «take 1, then discard 1», one pair per cube) — the
 *     same take, then the hand as the workspace's nested «СБРОС» step;
 *   · a SKIPPED row (no card can hold the resource) — named before the press,
 *     it stays named: nothing flies.
 *
 * THIS MODULE IS THE PLAN AND THE STATE, never the motion (the wave is
 * `colonyLedgerWave.ts`, the walk is the composer's — it owns the DOM):
 *
 *   ARM (the press)      `armColonyBonusPayout` — the ledger is FROZEN as the
 *                        player read it: the rows, their amounts and the
 *                        targets chosen in the composer. Nothing is ever
 *                        recomputed from the live model afterwards.
 *   SEED (the answer)    `seedColonyBonusPayoutHolds(before, after)` — the
 *                        transport's apply block. The rail keeps the pre-payout
 *                        number of every chips row until its own chip lands
 *                        (`beginPanelRewardHold`); the SAME synchronous block as
 *                        the view apply, or a counter flushes a frame early.
 *                        A resource onto a card lands on the server LATER than
 *                        the supply (behind Pluto's discard — the engine's
 *                        queue), so its row is seeded by the response that
 *                        actually carries it: the views' diff is the TRIGGER,
 *                        the amount is the frozen plan's.
 *   PARK                 `colonyBonusPayoutParksReveal` — a row's drawn batch
 *                        waits for ITS TURN: the deck deals nothing and the
 *                        reveal presents nowhere while an earlier row is still
 *                        paying (the board-beat / parliament park's own law —
 *                        scoped to the batch it parks, bounded by the stall net).
 *   LAND / SETTLE        the walk marks a row landed; a draw / pairs row is
 *                        settled by SERVER FACTS (every promised card drawn and
 *                        taken, no discard of that tile standing), never by a
 *                        timer.
 *   END                  the read beat, then `done` — the host concludes the
 *                        flow through the one guarded conclusion.
 *
 * Every wait is bounded and names itself: the wave is a named animation hold
 * with `expire` + `diagnose`; a walk that cannot move while the server owes
 * nothing is ended by the stall net (`data-colony-ledger-degraded` on the
 * composer — the e2e demands its absence).
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {AllColonyBonusesModel, ColonyLedgerEntryModel} from '@/common/models/ColonyBonusLedgerModel';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {colonyBonusShape} from '@/common/parliament/colonyLedger';
import {drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {beginPanelRewardHold, releasePanelRewardHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {cardResourceKey, mergeTransferSpecs, ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';

/** The flow's stage past the press — the crumb's tail and the command bar's context, ONE key for both («БОНУСЫ КОЛОНИЙ»). */
export const COLONY_LEDGER_STAGE = 'Colony bonuses';

/** HOW a row pays (see the header). `other` — a benefit with no chip and no step of this flow (a discount, a loss, a paid reveal). */
export type PayoutRowKind = 'chips' | 'draw' | 'pairs' | 'skipped' | 'other';

export type PayoutRowState = 'pending' | 'paying' | 'paid' | 'skipped';

export type PayoutRow = {
  colony: string;
  kind: PayoutRowKind;
  /** `chips`: the transfers the row's wave flies — frozen at the press. */
  specs: Array<ResourceTransferSpec>;
  /** `draw` / `pairs`: the cards the row draws in all (a pair draws one). */
  cards: number;
  /** `chips`: the server has applied the row and its hold is seeded — the wave may leave. */
  ready: boolean;
  state: PayoutRowState;
};

/** The frozen plan's rows, from the server's ledger and the targets the composer collected (in the ledger's order). */
export function payoutRowsOf(model: AllColonyBonusesModel, targets: ReadonlyArray<CardName>, resourceOf?: (card: CardName) => string | undefined): Array<PayoutRow> {
  const times = model.times ?? 1;
  let cursor = 0;
  return model.entries.map((entry: ColonyLedgerEntryModel): PayoutRow => {
    const repeats = entry.cubes * times;
    const base = {colony: String(entry.colony), specs: [] as Array<ResourceTransferSpec>, cards: 0, ready: false};
    if (entry.skipped !== undefined) {
      return {...base, kind: 'skipped', state: 'skipped'};
    }
    const grant = entry.grant;
    switch (colonyBonusShape(grant.benefit)) {
    case 'stock':
      return {...base, kind: 'chips', state: 'pending', specs: [{channel: 'stock', resource: grant.resource ?? 'megacredits', amount: grant.quantity * repeats}]};
    case 'production':
      return {...base, kind: 'chips', state: 'pending', specs: [{channel: 'production', resource: grant.resource ?? 'megacredits', amount: grant.quantity * repeats}]};
    case 'cardResource':
    case 'venusCardResource': {
      // One pick per cube, in the order the composer collected them. A pick the composer could not collect
      // leaves the row without a chip — the live prompt asks, and the row is settled by the walk's own facts.
      const specs: Array<ResourceTransferSpec> = [];
      for (let i = 0; i < repeats; i++) {
        const target = targets[cursor++];
        if (target === undefined) {
          continue;
        }
        const kind = grant.cardResource !== undefined ? String(grant.cardResource) : resourceOf?.(target);
        if (kind === undefined) {
          continue;
        }
        specs.push({channel: 'card-resource', resource: cardResourceKey(kind), amount: grant.quantity, targetCard: target});
      }
      return specs.length === 0 ?
        {...base, kind: 'other', state: 'pending'} :
        {...base, kind: 'chips', state: 'pending', specs: mergeTransferSpecs(specs)};
    }
    case 'draw':
      return {...base, kind: 'draw', state: 'pending', cards: grant.quantity * repeats};
    case 'drawDiscard':
      return {...base, kind: 'pairs', state: 'pending', cards: repeats};
    default:
      return {...base, kind: 'other', state: 'pending'};
    }
  });
}

export const colonyBonusPayout = reactive({
  /** The card whose press is being paid ('' — no payout). The key the claim, the reveal source and the prompts share (`via`). */
  sourceCard: '',
  /** The server's ledger AS THE PLAYER READ IT at the press — what a stage restored from a park shows (never a refetched preview's). */
  model: undefined as AllColonyBonusesModel | undefined,
  rows: [] as Array<PayoutRow>,
  /** The server answered the press — the first view after the arm. */
  answered: false,
  /** The row paying NOW ('' between rows) — the ledger marks exactly this one by weight; its batch is un-parked. */
  active: '',
  /** A row's chips are in the air (the named animation hold). */
  flying: false,
  /** The rows whose payout has LANDED — what the ledger reads «received» off. */
  landed: [] as Array<string>,
  /** Every row has paid: the ledger stands for one read. */
  reading: false,
  /** The scene is over — the host concludes the flow. */
  done: false,
  /** The walk ended without a measurable ledger / on its stall net — confessed on the composer. */
  degraded: false,
  /** What the press SPENT off the source card (Habitat Science's 2 data) — a resource landing on that very card is read past it. */
  spent: 0,
  /** The cards seen drawn per colony (by reveal batch id — a batch is counted once, even after it is taken). */
  drawn: {} as Record<string, number>,
  seenBatches: [] as Array<number>,
});

/** Is a payout armed at all (from the press to the scene's end)? */
export function colonyBonusPayoutArmed(): boolean {
  return colonyBonusPayout.sourceCard !== '';
}

/** Is the payout still OWED — the workspace that pressed may not conclude while this holds? */
export function colonyBonusPayoutLive(): boolean {
  return colonyBonusPayout.sourceCard !== '' && !colonyBonusPayout.done;
}

/** Is the payout of `card` armed — the answering paths ask by the card, never «some payout exists». */
export function colonyBonusPayoutOf(card: string): boolean {
  return card !== '' && colonyBonusPayout.sourceCard === card;
}

/** THE PRESS: freeze the ledger as the player read it. */
export function armColonyBonusPayout(sourceCard: string, rows: ReadonlyArray<PayoutRow>, spent = 0, model?: AllColonyBonusesModel): void {
  resetColonyBonusPayout();
  colonyBonusPayout.sourceCard = sourceCard;
  colonyBonusPayout.model = model;
  colonyBonusPayout.spent = spent;
  colonyBonusPayout.rows = rows.map((row) => ({...row, specs: [...row.specs]}));
}

/** Release every hold a row still keeps (a refusal, an abort, the stall net) — the rail snaps to the truth, nothing is lost. */
function releaseRowHolds(row: PayoutRow): void {
  if (row.kind === 'chips' && row.ready && row.state !== 'paid') {
    row.specs.forEach((spec) => releasePanelRewardHold(spec));
  }
}

/** Drop the payout (the submit was refused, the workspace is gone, a new game) — its holds released honestly. */
export function resetColonyBonusPayout(): void {
  colonyBonusPayout.rows.forEach(releaseRowHolds);
  colonyBonusPayout.sourceCard = '';
  colonyBonusPayout.model = undefined;
  colonyBonusPayout.rows = [];
  colonyBonusPayout.answered = false;
  colonyBonusPayout.active = '';
  colonyBonusPayout.flying = false;
  colonyBonusPayout.landed = [];
  colonyBonusPayout.reading = false;
  colonyBonusPayout.done = false;
  colonyBonusPayout.degraded = false;
  colonyBonusPayout.spent = 0;
  colonyBonusPayout.drawn = {};
  colonyBonusPayout.seenBatches = [];
}

/** END the walk where it stands: what is still held is released, every row reads as paid, the scene is over. */
export function finishColonyBonusPayout(degraded = false): void {
  if (colonyBonusPayout.sourceCard === '') {
    return;
  }
  for (const row of colonyBonusPayout.rows) {
    releaseRowHolds(row);
    if (row.state !== 'skipped') {
      row.state = 'paid';
      markPayoutRowLanded(row.colony);
    }
  }
  colonyBonusPayout.active = '';
  colonyBonusPayout.flying = false;
  colonyBonusPayout.reading = false;
  colonyBonusPayout.degraded = colonyBonusPayout.degraded || degraded;
  colonyBonusPayout.done = true;
}

export function markPayoutRowLanded(colony: string): void {
  if (!colonyBonusPayout.landed.includes(colony)) {
    colonyBonusPayout.landed = [...colonyBonusPayout.landed, colony];
  }
}

/** The row the walk stands on: the first that has neither paid nor been skipped. */
export function nextPayoutRow(): PayoutRow | undefined {
  return colonyBonusPayout.rows.find((row) => row.state === 'pending' || row.state === 'paying');
}

function resourcesOn(view: PlayerViewModel | undefined, card: string): number {
  return view?.thisPlayer?.tableau.find((c) => c.name === card)?.resources ?? 0;
}

/** Is this reveal batch one of the armed payout's own (the server's `via` is the key)? */
function payoutBatchColony(source: CardDrawRevealSource | undefined): string | undefined {
  return source?.type === 'colony' && source.via !== undefined && source.via === colonyBonusPayout.sourceCard ?
    String(source.colonyName) : undefined;
}

/**
 * THE APPLY BLOCK (the transport's `seedRewardHolds`): the answer to the press
 * seeds the supply / production rows; a later response that carries a card
 * resource of the plan seeds that row; every response's reveal batches are
 * tallied per colony. No-op unless a payout is armed.
 */
export function seedColonyBonusPayoutHolds(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  if (colonyBonusPayout.sourceCard === '' || after === undefined || colonyBonusPayout.done) {
    return;
  }
  // The batches this response carries: each counted ONCE for its colony.
  for (const batch of after.cardDrawReveals ?? []) {
    const colony = payoutBatchColony(batch.source);
    if (colony !== undefined && !colonyBonusPayout.seenBatches.includes(batch.id)) {
      colonyBonusPayout.seenBatches = [...colonyBonusPayout.seenBatches, batch.id];
      colonyBonusPayout.drawn = {...colonyBonusPayout.drawn, [colony]: (colonyBonusPayout.drawn[colony] ?? 0) + batch.cards.length};
    }
  }
  const first = !colonyBonusPayout.answered &&
    (before === undefined || before.game.gameAge !== after.game.gameAge);
  if (first) {
    colonyBonusPayout.answered = true;
  }
  if (!colonyBonusPayout.answered) {
    return;
  }
  for (const row of colonyBonusPayout.rows) {
    if (row.kind !== 'chips' || row.ready || row.state !== 'pending') {
      continue;
    }
    const cardResource = row.specs.some((spec) => spec.channel === 'card-resource');
    if (!cardResource) {
      // A supply / production gain lands with the press's own answer.
      if (first) {
        row.ready = true;
        beginPanelRewardHold(row.specs);
      }
      continue;
    }
    // A resource onto a card: seeded by the response that ACTUALLY carries it (the engine pays it behind
    // Pluto's discard) — the diff is the trigger, the amounts are the plan's.
    // (The press's own cost left the SOURCE card in the first response — a resource landing on that very card is read past it.)
    const cost = (card: string): number => first && card === colonyBonusPayout.sourceCard ? colonyBonusPayout.spent : 0;
    const arrived = row.specs.every((spec) =>
      spec.targetCard !== undefined &&
      resourcesOn(after, spec.targetCard) - resourcesOn(before, spec.targetCard) + cost(spec.targetCard) >= spec.amount);
    if (arrived) {
      row.ready = true;
      beginPanelRewardHold(row.specs);
    }
  }
}

/**
 * IS THIS BATCH PARKED — one of the armed payout's own, whose row's turn has
 * not come? Scoped to the batch (a draw of anybody else's keeps its surface);
 * released the moment the walk stands on its row.
 */
export function colonyBonusPayoutParksReveal(source: CardDrawRevealSource | undefined): boolean {
  const colony = payoutBatchColony(source);
  return colony !== undefined && !colonyBonusPayout.done && colonyBonusPayout.active !== colony;
}

/** Untaken cards of the armed payout's own batches for `colony` — the reveal queue's truth (reactive). */
export function payoutUntaken(colony: string): number {
  let n = 0;
  for (const e of drawnCardsState.events) {
    if (!e.dismissed && payoutBatchColony(e.source) === colony) {
      n += e.cards.length - e.takenIndices.size;
    }
  }
  return n;
}

/** WHAT the walk reads to settle a draw / pairs row — server facts, handed in by the DOM owner. */
export type PayoutFacts = {
  /** The prompt standing now. */
  waitingFor: PlayerInputModel | undefined;
  /** Untaken cards of the payout's batches, per colony (the reveal queue's own truth). */
  untaken: (colony: string) => number;
  /** A request is in flight — the next fact is on its way. */
  inFlight: boolean;
};

/** Does the standing prompt belong to `colony`'s row — its discard (`colonyRepeat`) or its resource target (`via`)? */
export function payoutPromptColony(wf: PlayerInputModel | undefined, sourceCard: string): string | undefined {
  if (wf === undefined || sourceCard === '') {
    return undefined;
  }
  const discard = wf.discardPrompt;
  if (discard?.colonyRepeat !== undefined && discard.source?.kind === 'card' && discard.source.card === sourceCard) {
    return String(discard.colonyRepeat.colonyName);
  }
  const source = wf.choiceContext?.source;
  if (source?.kind === 'colony' && source.via === sourceCard && typeof source.name === 'string') {
    return source.name;
  }
  return undefined;
}

/** Has a DRAW / PAIRS row finished: every promised card drawn AND taken, and nothing of this tile still asked? */
export function payoutRowSettled(row: PayoutRow, facts: PayoutFacts): boolean {
  if (row.kind !== 'draw' && row.kind !== 'pairs') {
    return true;
  }
  if (facts.inFlight) {
    return false;
  }
  if ((colonyBonusPayout.drawn[row.colony] ?? 0) < row.cards) {
    return false;
  }
  if (facts.untaken(row.colony) > 0) {
    return false;
  }
  return payoutPromptColony(facts.waitingFor, colonyBonusPayout.sourceCard) !== row.colony;
}

/**
 * IS THE PAYOUT'S DISCARD THE STEP THE WALK STANDS ON — the server asks the
 * discard of a tile whose row is paying NOW, and that pair's card has been
 * drawn AND taken? Before that the discard is only OWED: the engine raises it
 * with the press's own answer (its queue runs Pluto's pair ahead of nothing the
 * player has seen yet), rows ahead of it are still paying, and a hand opened
 * then would stand over a take the player has not been shown. The crumb's
 * «СБРОС» and the hand's door both ask THIS — one answer, so they cannot drift.
 */
export function payoutDiscardDue(facts: PayoutFacts): boolean {
  const wf = facts.waitingFor;
  const colony = payoutPromptColony(wf, colonyBonusPayout.sourceCard);
  if (colony === undefined || wf?.discardPrompt === undefined || colonyBonusPayout.active !== colony) {
    return false;
  }
  const pair = wf.discardPrompt.colonyRepeat?.index ?? 1;
  return (colonyBonusPayout.drawn[colony] ?? 0) >= pair && facts.untaken(colony) === 0;
}

/**
 * DOES THE SERVER STILL OWE THE WALK ANYTHING — a prompt of the payout's, an
 * untaken batch of its own, a request in flight? The stall net asks this
 * before it ends a walk that has stopped moving: a player reading a card is
 * not a stall.
 */
export function payoutServerOwes(facts: PayoutFacts): boolean {
  if (facts.inFlight || payoutPromptColony(facts.waitingFor, colonyBonusPayout.sourceCard) !== undefined) {
    return true;
  }
  return colonyBonusPayout.rows.some((row) => facts.untaken(row.colony) > 0);
}

// The WAVE is the scene's one animation hold: a row's chips in the air. Not the walk as a whole — a row that
// waits for the player's take or discard must leave the reveal and the hand free to present.
registerAnimationHoldSupplier('colony-bonus-payout', () => colonyBonusPayout.flying, {
  diagnose: () => ({
    card: colonyBonusPayout.sourceCard,
    active: colonyBonusPayout.active,
    rows: colonyBonusPayout.rows.map((row) => `${row.colony}:${row.kind}:${row.state}${row.ready ? ':ready' : ''}`),
    landed: colonyBonusPayout.landed,
  }),
  expire: () => finishColonyBonusPayout(true),
});

/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «ОТВЕТ СТОЛА» — A CARD OF THE TABLE ANSWERS A WALK OF THE CAREER, ON ONE
 * STAGE (Turmoil Redux — TR78 Arwind Inc.: «whenever you advance your Agenda
 * marker 1 step, add 1 fighter to ANY card»; docs/TURMOIL_REDUX_ARWIND_INC.md,
 * the rework of 2026-10-28).
 *
 * The owner's field report (2026-10-28): the first cut asked the player to
 * press the one card they could choose, played the framework's reaction scene
 * a second time after the player's own pick, and hosted the question in three
 * ad-hoc ways across the Parliament. ONE stage now, for every walk of the
 * track and both shapes of the answer:
 *
 *   THE STAGE  — `ConsoleParliamentTableAnswer`: the ASKER's face on the hero
 *                (the card whose printed effect fired — the WHY), and a ZONE.
 *                A RECEIPT (the server already landed the units: the asker
 *                alone, or a layout the composer pre-collected) shows the
 *                recipients as a row of faces and plays the landing; a
 *                QUESTION (a second holder — the family's pick or layout) hosts
 *                the picker in the zone, and the answer's receive scene flies
 *                from the asker's face to the chosen capsules.
 *   THE HOSTS  — the quest's flow after its ПОВЕСТКА (`chairmanQuestDirector`),
 *                the sitting's enactment page after its ПОВЕСТКА and its reward
 *                page after the Career's walks (`sittingDirector`), a card's
 *                walk hosted by the hand / the start / a Parliament of its own
 *                (`ConsoleParliamentSection.playOwedWalk`). The stage opens
 *                INSIDE the flow that walked the marker — never a band of its
 *                own.
 *   THE RECORD — the server's (`GameModel.cardReactions`: the corporation's
 *                effect scope on the `agenda-step` channel, the walk as the
 *                cause). The beat is SPLIT like every reward beat of this
 *                console:
 *     DETECT — pure, against the authoritative response: the viewer's fresh
 *              reaction records of that channel whose cause names a walk;
 *     SEED   — in the SAME synchronous block as the view apply: the capsules
 *              held at their pre-landing counts, the rows DECLARED to the
 *              card-reaction seeder (`declareHeldAnswers` — the record ATTACHES
 *              to this scene, the framework's standalone chain never plays it
 *              a second time, the feed builds no card for it); owed ONLY to a
 *              host that stands to play it — else the framework's own chain
 *              keeps the record (the reactor at the rail's edge);
 *     TOLD   — an answer the player GAVE on this stage (the pick's / the
 *              layout's receive scene, played with the commit held) is never
 *              owed again: the scene notes it before the apply block, the seed
 *              only declares it;
 *     PLAY   — the host opens the stage, the framework's attached flight brings
 *              the asker forward IN ITS PLACE (its effect row lit), every token
 *              is born on the asker's printed icon and lands on its recipient's
 *              capsule in turn (the capsule ticks on the touchdown), a read
 *              beat, the asker recedes, the stage folds.
 *
 * Honest like every ledger: a reload (no «before») replays nothing; reduced
 * motion owes nothing; every hold is bounded and released on every way out.
 * Pure + a reactive record: no DOM measurement here beyond the stage's own
 * hooks, no Vue components, no i18n, no wall clock.
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardReactionRecord} from '@/common/models/CardReactionModel';
import {AndOptionsModel, PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';
import {ResourceTransferSpec, cardResourceKey, railRowKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  beginPanelRewardHold, declareHeldAnswers, releasePanelRewardHold, resetCardResourceLandings, runResourceTransfers,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {cardReactionAnswerFlight, reserveCardReaction} from '@/client/console/cardReaction/cardReactionDirector';
import {freshCardReactions} from '@/client/console/cardReaction/cardReactionModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {workspaceFrameKnown} from '@/client/console/consoleWorkspaceStack';
import {ReceiptCard} from './tableReceiptBeat';
import {agendaReactionOf} from './agendaReaction';
import {chairmanQuestFlow} from './consoleChairmanQuest';
import {consoleParliamentUi} from './consoleParliamentFlow';
import {agendaWalkHostFor} from './agendaWalk';
import {scheduleParliamentBeat} from './parliamentBeat';
import {pickPayoutLanding} from './consoleResolutionPayout';
import {resolveActionCommitAnchors, resolveGainIconOrigins} from '@/client/console/consoleActionCommitMotion';
import {firstVisibleEnd} from '@/client/console/resourceTransfer/transferEndVisible';
import {TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';

/** WHO plays the answer: the chairman quest's flow, the sitting's walk, or a card's walk (the hand / the start / a Parliament of its own). */
export type TableAnswerHost = 'quest' | 'sitting' | 'walk';

/** WHY the marker walked — the server's own cause on the record. */
export type TableAnswerCause = 'quest' | 'phase' | 'card' | 'resolution';

export type TableAnswer = {
  /** The record's structural identity. */
  key: string;
  seq: number;
  /** The card whose effect answered (the reactor). */
  asker: CardName;
  player: Color;
  cause: TableAnswerCause;
  walk: {from: number, to: number};
  /** The transfer key of the unit's kind (`fighter`, …) — the token's sprite. */
  resource: string;
  /** How many units landed in all. */
  amount: number;
  /** Every recipient in the record's order — the asker itself among them when it kept a share. */
  cards: ReadonlyArray<ReceiptCard>;
  /** ONE transfer per recipient — the very objects the panel hold is seeded with. */
  specs: ReadonlyArray<ResourceTransferSpec>;
  generation: number;
  host: TableAnswerHost;
};

/** What the stage is doing — the pose of its faces and the e2e probes read it. */
export type TableAnswerPhase = '' | 'enter' | 'rise' | 'pay' | 'read' | 'leave';

/** A QUESTION standing on the stage: the asker, why, and the unit asked about. */
export type TableAnswerAsk = {asker: CardName, cause: TableAnswerCause, resource: string, amount: number, host: TableAnswerHost};

export const tableAnswerState = reactive({
  /** The receipts still to play, in the records' order. */
  owed: [] as Array<TableAnswer>,
  /** The receipt on stage now (from its arrival until its departure has finished). */
  showing: undefined as TableAnswer | undefined,
  /** A QUESTION on stage (the picker / the layout teleported into the zone) — set by the host, cleared on the answer. */
  asking: undefined as TableAnswerAsk | undefined,
  phase: '' as TableAnswerPhase,
  /** The stage has ENTERED (its unfold played) — the flight may measure its faces, the shell may teleport the picker. */
  paneIn: false,
  /** Specs still held on the panel (released by touchdown, or all at once by a release). */
  held: [] as Array<ResourceTransferSpec>,
  /** How many receipts the session has shown — a probe's counter. */
  shown: 0,
  /** The last reason a receipt was not shown as recorded (a probe's and a dev's read). */
  degraded: undefined as string | undefined,
});

/** The reservations the stage states to the reaction seeder: a receipt the stage plays, an answer the player's scene told. */
export const TABLE_ANSWER_RESERVATION = 'table-answer';
const TABLE_ANSWER_TOLD = 'table-answer:told';

/** The hold's ceilings: the stage's entrance, the whole receipt. */
const ANSWER_PANE_WAIT_MS = 1600;
export const ANSWER_HOLD_CEILING_MS = 16_000;
/** A host's budget for one receipt (its own hold's arithmetic): the entrance, the rise, a wave of up to six, the read. */
export const TABLE_ANSWER_BUDGET_MS = 6000;
/** The read after the last touchdown — «2 → 3» registers before the stage folds (the receipt's own class). */
const ANSWER_READ_MS = 700;

// ── DETECT (pure) ────────────────────────────────────────────────────────────

function storedOn(view: PlayerViewModel | undefined, card: CardName): number | undefined {
  return view?.thisPlayer?.tableau?.find((c) => c.name === card)?.resources;
}

/** The answer ONE record is — undefined for a record that is not a walk's card-resource answer to the viewer. */
export function tableAnswerOf(record: CardReactionRecord, before: PlayerViewModel | undefined, after: PlayerViewModel): Omit<TableAnswer, 'host'> | undefined {
  const viewer = after.thisPlayer?.color;
  const walk = record.cause?.walk;
  if (viewer === undefined || record.channel !== 'agenda-step' || record.owner !== viewer || walk === undefined ||
      (record.kind !== 'card' && record.kind !== 'corporation')) {
    return undefined;
  }
  const byCard = new Map<CardName, {resource: string, amount: number}>();
  for (const impact of record.impacts) {
    if (impact.kind !== 'card-resource' || impact.to !== viewer || impact.amount <= 0) {
      continue;
    }
    const key = cardResourceKey(impact.resource);
    const entry = byCard.get(impact.target);
    if (entry === undefined) {
      byCard.set(impact.target, {resource: key, amount: impact.amount});
    } else {
      entry.amount += impact.amount;
    }
  }
  if (byCard.size === 0) {
    return undefined;
  }
  const cards: Array<ReceiptCard> = [];
  for (const [card, entry] of byCard) {
    const now = storedOn(after, card);
    const was = storedOn(before, card) ?? (now === undefined ? 0 : Math.max(0, now - entry.amount));
    cards.push({card, resource: entry.resource, iconKey: entry.resource, before: was, amount: entry.amount});
  }
  const amount = cards.reduce((sum, c) => sum + c.amount, 0);
  return {
    key: `answer:${record.seq}`,
    seq: record.seq,
    asker: record.card,
    player: viewer,
    cause: walk.reason,
    walk: {from: walk.from, to: walk.to},
    resource: cards[0].resource,
    amount,
    cards,
    specs: cards.map((c) => ({channel: 'card-resource' as const, resource: c.resource, amount: c.amount, targetCard: c.card})),
    generation: after.game.generation,
  };
}

/** DETECT: the viewer's walk answers this response RECORDED (the ring consumed once by `seq`, never on a first view). */
export function detectTableAnswers(before: PlayerViewModel | undefined, after: PlayerViewModel): Array<Omit<TableAnswer, 'host'>> {
  const viewer = after.thisPlayer?.color;
  const sameSeat = before !== undefined && before.thisPlayer?.color === viewer;
  const out: Array<Omit<TableAnswer, 'host'>> = [];
  for (const record of freshCardReactions(before?.game?.cardReactions, after.game?.cardReactions, sameSeat)) {
    const answer = tableAnswerOf(record, before, after);
    if (answer !== undefined) {
      out.push(answer);
    }
  }
  return out;
}

/**
 * WHO WOULD PLAY an answer of this cause now — the flow that walked the marker, when it stands to play it: the
 * chairman quest's flow, the sitting (standing, or still AHEAD of the seat — the soft gates), a card's walk hosted
 * by the hand / the start / a Parliament of its own. Nobody → the framework's own chain keeps the record.
 */
export function tableAnswerHostFor(cause: TableAnswerCause, after: PlayerViewModel, standing: {
  questLive: boolean, sittingAhead: boolean, walkHost: boolean,
}): TableAnswerHost | undefined {
  switch (cause) {
  case 'quest': return standing.questLive ? 'quest' : undefined;
  case 'phase':
  case 'resolution':
    return standing.sittingAhead && after.game.parliament?.phase !== undefined ? 'sitting' : undefined;
  case 'card': return standing.walkHost ? 'walk' : undefined;
  }
}

// ── TOLD: an answer the player gave on this stage ────────────────────────────

/** The asker whose live answer the receive scene has just played (before the apply block) — consumed by the seed. */
let toldByScene: {asker: CardName, specs: ReadonlyArray<ResourceTransferSpec>} | undefined;

/** A live pick's / layout's receive scene played the answer on stage: the record that follows is told, never owed. */
export function noteTableAnswerTold(asker: CardName, specs: ReadonlyArray<ResourceTransferSpec>): void {
  toldByScene = {asker, specs};
}

/** Test-only / the transport's abort battery. */
export function forgetTableAnswerTold(): void {
  toldByScene = undefined;
}

// ── SEED (the apply block) ───────────────────────────────────────────────────

/**
 * SEED — called from the transport's apply block AFTER the Parliament's own seeders and BEFORE the card-reaction
 * seeder: a fresh answer a host stands to play is HELD (its capsules at their pre-landing counts) and DECLARED (the
 * record attaches to this scene); an answer the player gave on stage is declared only; an answer nobody here can play
 * is left to the framework's chain.
 */
export function seedTableAnswers(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined, standing?: {
  questLive: boolean, sittingAhead: boolean, walkHost: boolean,
}): void {
  if (after === undefined) {
    return;
  }
  const fresh = detectTableAnswers(before, after);
  const told = toldByScene;
  toldByScene = undefined;
  if (fresh.length === 0) {
    return;
  }
  const stands = standing ?? {
    questLive: chairmanQuestFlow.live,
    sittingAhead: consoleParliamentUi.stageStanding || (after.game.parliament?.phase !== undefined && !workspaceFrameKnown('parliament')),
    walkHost: agendaWalkHostFor() !== undefined,
  };
  for (const answer of fresh) {
    if (told !== undefined && told.asker === answer.asker) {
      // THE PLAYER ANSWERED ON STAGE: the scene flew it with the commit held — attributed to it (declared, reserved
      // for nobody), never flown again by any host's flight nor by the chain.
      declareHeldAnswers(answer.specs);
      reserveCardReaction(answer.seq, TABLE_ANSWER_TOLD);
      continue;
    }
    const host = tableAnswerHostFor(answer.cause, after, stands);
    if (host === undefined || consoleReducedMotionActive()) {
      continue;
    }
    if (tableAnswerState.owed.some((o) => o.key === answer.key) || tableAnswerState.showing?.key === answer.key) {
      continue;
    }
    beginPanelRewardHold(answer.specs);
    declareHeldAnswers(answer.specs);
    // Reserved for the stage: the play scene's unfiltered claim must not take it (it would rise the asker at the rail's
    // edge for nothing and leave the stage with no flight).
    reserveCardReaction(answer.seq, TABLE_ANSWER_RESERVATION);
    tableAnswerState.held.push(...answer.specs);
    tableAnswerState.owed.push({...answer, host});
    preloadPremiumCardArt([answer.asker, ...answer.cards.map((c) => c.card)], ['thumb', 'full']);
  }
}

// ── OWE ─────────────────────────────────────────────────────────────────────

/** A receipt is owed to `host` (of `cause`, when given). */
export function tableAnswerOwedTo(host: TableAnswerHost, cause?: TableAnswerCause): boolean {
  return tableAnswerState.owed.some((a) => a.host === host && (cause === undefined || a.cause === cause));
}

/** A receipt or a question stands on the stage. */
export function tableAnswerUp(): boolean {
  return tableAnswerState.showing !== undefined || tableAnswerState.asking !== undefined;
}

/** The host takes the NEXT receipt owed to it and stands it on the stage (its entrance follows). */
export function takeTableAnswer(host: TableAnswerHost, cause?: TableAnswerCause): TableAnswer | undefined {
  const at = tableAnswerState.owed.findIndex((a) => a.host === host && (cause === undefined || a.cause === cause));
  if (at < 0) {
    return undefined;
  }
  const [answer] = tableAnswerState.owed.splice(at, 1);
  resetCardResourceLandings();
  tableAnswerState.showing = answer;
  tableAnswerState.phase = 'enter';
  tableAnswerState.paneIn = false;
  tableAnswerState.shown++;
  return answer;
}

/** The stage has entered (the host's unfold played) — the flight may measure, the picker may be teleported in. */
export function noteTableAnswerPaneIn(): void {
  tableAnswerState.paneIn = true;
}

/** ONE token touched down on its card: the satellite's and the capsule's counters tick now (exactly this spec). */
function markAnswerSpecLanded(spec: ResourceTransferSpec): void {
  const index = tableAnswerState.held.findIndex((held) => held.targetCard === spec.targetCard && held.resource === spec.resource && held.amount === spec.amount);
  if (index >= 0) {
    tableAnswerState.held.splice(index, 1);
  }
  releasePanelRewardHold(spec);
}

/** The receipt on stage is over: whatever is still held ticks now; the stage folds (the host's leave phrase). */
export function endTableAnswer(): void {
  const answer = tableAnswerState.showing;
  if (answer !== undefined) {
    for (const spec of answer.specs) {
      markAnswerSpecLanded(spec);
    }
  }
  tableAnswerState.showing = undefined;
  tableAnswerState.phase = '';
  tableAnswerState.paneIn = false;
}

/** Release EVERY receipt at once (the host left, collapsed or unmounted, the ceiling): every held counter ticks now. */
export function releaseTableAnswers(): void {
  for (const spec of tableAnswerState.held.splice(0)) {
    releasePanelRewardHold(spec);
  }
  tableAnswerState.owed = [];
  tableAnswerState.showing = undefined;
  tableAnswerState.phase = '';
  tableAnswerState.paneIn = false;
}

/** Full reset (game switch, test cleanup). */
export function resetTableAnswerBeat(): void {
  releaseTableAnswers();
  tableAnswerState.asking = undefined;
  tableAnswerState.shown = 0;
  tableAnswerState.degraded = undefined;
  toldByScene = undefined;
}

// ── THE QUESTION ────────────────────────────────────────────────────────────

/**
 * THE QUESTION a walk's answer asks (pure, off the server's marker — never a title): the family's pick
 * (`resourceGainPrompt`) or its layout (`cardResourceDistributionPrompt`), stamped with the walk that asked
 * (`agendaWalkPrompt`). Undefined for every other prompt — and for a card's own walk, whose question the play's
 * composer pre-collects (a live one is served where any live pick is).
 */
export function tableAnswerAskOf(wf: PlayerInputModel | undefined): Omit<TableAnswerAsk, 'host'> | undefined {
  const meta = agendaReactionOf(wf);
  if (wf === undefined || meta === undefined || meta.reason === 'card') {
    return undefined;
  }
  if (wf.type === 'card') {
    const pick = wf as SelectCardModel;
    const icon = pick.resourceGainPrompt?.cardResource;
    return {asker: meta.source, cause: meta.reason, resource: icon === undefined ? 'resources' : cardResourceKey(icon), amount: pick.resourceGainPrompt?.amount ?? 1};
  }
  if (wf.type === 'and') {
    const layout = (wf as AndOptionsModel).cardResourceDistributionPrompt;
    const icon = layout?.cardResource;
    return {asker: meta.source, cause: meta.reason, resource: icon === undefined ? 'resources' : cardResourceKey(icon), amount: layout?.amount ?? 1};
  }
  return undefined;
}

/** The host stands the question on the stage (the shell teleports the picker in once the stage has entered). */
export function askTableAnswer(ask: TableAnswerAsk): void {
  tableAnswerState.asking = ask;
  tableAnswerState.phase = 'enter';
  tableAnswerState.paneIn = false;
}

/** The question is answered (the prompt fell): the stage folds. */
export function endTableAnswerAsk(): void {
  tableAnswerState.asking = undefined;
  tableAnswerState.phase = '';
  tableAnswerState.paneIn = false;
}

// ── PLAY ────────────────────────────────────────────────────────────────────

function waitUntil(pred: () => boolean, baseMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (pred()) {
      resolve(true);
      return;
    }
    let left = Math.max(1, Math.ceil(baseMs / 50));
    const tick = (): void => {
      if (pred()) {
        resolve(true);
        return;
      }
      if (--left <= 0) {
        resolve(false);
        return;
      }
      scheduleParliamentBeat(50, tick);
    };
    scheduleParliamentBeat(50, tick);
  });
}

/**
 * PLAY the receipt on the stage the host has opened: the framework's attached flight brings the asker forward IN ITS
 * PLACE (the stage's hero wears `data-reaction-home`), every token is born on its printed icon and lands on its
 * recipient's capsule in turn, a read beat, the asker recedes. Resolves when the stage may fold; never rejects. A
 * stage that never entered (the host left) releases the holds honestly — the counters tick, nothing flies.
 */
export async function playTableAnswer(answer: TableAnswer, opts: {alive: () => boolean, hurried?: () => boolean}): Promise<void> {
  if (tableAnswerState.showing?.key !== answer.key) {
    return;
  }
  const alive = (): boolean => opts.alive() && tableAnswerState.showing?.key === answer.key;
  const entered = await waitUntil(() => tableAnswerState.paneIn || !alive(), ANSWER_PANE_WAIT_MS);
  if (!alive() || !entered) {
    tableAnswerState.degraded = entered ? 'host-left' : 'stage-never-entered';
    endTableAnswer();
    return;
  }
  const rows = [...new Set(answer.specs.map((spec) => railRowKey(spec)))];
  const flight = cardReactionAnswerFlight({rows, reserved: TABLE_ANSWER_RESERVATION});
  try {
    tableAnswerState.phase = 'rise';
    await flight?.prepare?.();
    if (!alive()) {
      return;
    }
    tableAnswerState.phase = 'pay';
    for (const spec of answer.specs) {
      if (!alive()) {
        break;
      }
      const tokens = flight?.tokensOf?.(spec) ?? [spec];
      await runResourceTransfers({
        specs: tokens,
        // Born on the ASKER's printed icon (the attached flight's birth row — `originOf`), else on its face.
        origins: tokens.map((token) => flight?.originOf?.(token)),
        source: {selectors: ['.con-tans [data-tans-asker-face] .pcard', '.con-tans [data-tans-asker-face]']},
        arrival: 'auto',
        // The tokens land INSIDE the standing stage: a notification-only hold (a blocking one would retract the host).
        inSurface: true,
        onArrive: (landed) => markAnswerSpecLanded(landed),
      });
    }
    if (!alive()) {
      return;
    }
    tableAnswerState.phase = 'read';
    await new Promise<void>((resolve) => scheduleParliamentBeat(opts.hurried?.() === true ? ANSWER_READ_MS / 3 : ANSWER_READ_MS, resolve));
  } finally {
    flight?.onDone?.();
    tableAnswerState.phase = 'leave';
    endTableAnswer();
  }
}

/**
 * A receipt owed or on stage, or a question standing, HOLDS THE FOREGROUND — only while its host stands (the quest's
 * flow, the sitting's stage, a walk): seeded while the sitting is merely AHEAD of the seat, a blocking claim would hold
 * down the very plate that opens it (the receipt's law). The registry's ceiling is the one wedge net.
 */
function claimsForeground(): boolean {
  if (tableAnswerState.showing !== undefined) {
    return true;
  }
  return tableAnswerState.owed.some((a) => a.host === 'quest' ? chairmanQuestFlow.live : a.host === 'sitting' ? consoleParliamentUi.stageStanding : agendaWalkHostFor() !== undefined);
}

// ── THE LAYOUT'S ANSWER, GIVEN ON STAGE ─────────────────────────────────────

/** ONE recipient of a layout the player laid out live — the SERVER's record of what landed (never the client's picks). */
export type TableAnswerPayoutTarget = {card: CardName, amount: number, resource: string};

export type TableAnswerPayoutEvent = {
  asker: CardName;
  targets: ReadonlyArray<TableAnswerPayoutTarget>;
};

/**
 * DETECT (pure): the viewer answered a walk's LAYOUT (the family's distribution, asked by a card of the table —
 * `agendaWalkPrompt` on the standing `and`) and the response RECORDED the asker's reaction with the landed units —
 * every recipient a candidate of the layout that stood. Undefined for everything else (a refusal, a reload, a pick —
 * the pick's answer is the receive scene's, `promptReceive.ts`).
 */
export function detectTableAnswerPayout(before: PlayerViewModel | undefined, after: PlayerViewModel): TableAnswerPayoutEvent | undefined {
  const wf = before?.waitingFor;
  const meta = agendaReactionOf(wf);
  if (wf === undefined || wf.type !== 'and' || meta === undefined) {
    return undefined;
  }
  const layout = (wf as AndOptionsModel).cardResourceDistributionPrompt;
  if (layout === undefined) {
    return undefined;
  }
  const viewer = after.thisPlayer?.color;
  const sameSeat = before !== undefined && before.thisPlayer?.color === viewer;
  const record = freshCardReactions(before?.game?.cardReactions, after.game?.cardReactions, sameSeat)
    .find((r) => r.card === meta.source && r.channel === 'agenda-step' && r.owner === viewer);
  if (record === undefined || viewer === undefined) {
    return undefined;
  }
  const candidates = new Set(layout.cards.map((c) => c.name));
  const byCard = new Map<CardName, TableAnswerPayoutTarget>();
  for (const impact of record.impacts) {
    if (impact.kind !== 'card-resource' || impact.to !== viewer || impact.amount <= 0) {
      continue;
    }
    if (!candidates.has(impact.target)) {
      return undefined;
    }
    const entry = byCard.get(impact.target);
    if (entry === undefined) {
      byCard.set(impact.target, {card: impact.target, amount: impact.amount, resource: cardResourceKey(impact.resource)});
    } else {
      entry.amount += impact.amount;
    }
  }
  return byCard.size === 0 ? undefined : {asker: meta.source, targets: [...byCard.values()]};
}

/** The ASKER's face on the answer stage's hero (`ConsoleParliamentTableAnswer`), when one stands painted. */
function askerFaceEl(): HTMLElement | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const el = firstVisibleEnd('.con-tans [data-tans-asker-face]');
  return el instanceof HTMLElement ? el : undefined;
}

/** The read beat after the last touchdown: the capsules' ticks register before the surface leaves (the payout's class). */
const PAYOUT_READ_MS = 260;

/**
 * RUN — the commit HELD: one chip per recipient, born on the ASKER's printed icon on the answer stage's hero, onto that
 * candidate's capsule in the standing layout, in the record's order (the capsule ticks on the touchdown —
 * `pickPayoutLanding`, the shared picker's own tally). Resolves after the last touchdown + the read beat; never
 * rejects. The answer is TOLD to the seed: the record that follows is attributed, never flown again.
 */
export async function runTableAnswerPayout(event: TableAnswerPayoutEvent): Promise<void> {
  resetCardResourceLandings();
  pickPayoutLanding.landed = {};
  const specs: Array<ResourceTransferSpec> = event.targets.map((t) => ({channel: 'card-resource', resource: t.resource, amount: t.amount, targetCard: t.card}));
  const face = askerFaceEl();
  const origins: Array<TransferPoint | undefined> = face === undefined ? specs.map(() => undefined) : resolveGainIconOrigins(resolveActionCommitAnchors(face, undefined), specs);
  await runResourceTransfers({
    specs,
    origins,
    source: {selectors: ['.con-tans [data-tans-asker-face] .pcard', '.con-tans [data-tans-asker-face]', '.con-task-host .con-src .pcard']},
    arrival: 'auto',
    // The chips land INSIDE the standing layout: a notification-only hold, or the blocking one would retract the very
    // surface they land on.
    inSurface: true,
    onArrive: (spec) => {
      if (spec.targetCard !== undefined) {
        pickPayoutLanding.landed = {...pickPayoutLanding.landed, [spec.targetCard]: (pickPayoutLanding.landed[spec.targetCard] ?? 0) + spec.amount};
      }
    },
  });
  await new Promise<void>((resolve) => scheduleParliamentBeat(PAYOUT_READ_MS, resolve));
  noteTableAnswerTold(event.asker, specs);
}

/** END (post-commit) / ABORT — the landing ticks' scope closes (the committed view carries the real counts). */
export function endTableAnswerPayout(): void {
  pickPayoutLanding.landed = {};
}

registerAnimationHoldSupplier('parliament-table-answer', claimsForeground, {
  maxHoldMs: ANSWER_HOLD_CEILING_MS,
  diagnose: () => ({
    owed: tableAnswerState.owed.map((a) => `${a.host}:${a.asker}:${a.amount}`),
    showing: tableAnswerState.showing?.key,
    asking: tableAnswerState.asking?.asker,
    phase: tableAnswerState.phase,
    held: tableAnswerState.held.map((spec) => `${spec.targetCard}:${spec.resource}+${spec.amount}`),
  }),
  expire: () => releaseTableAnswers(),
});

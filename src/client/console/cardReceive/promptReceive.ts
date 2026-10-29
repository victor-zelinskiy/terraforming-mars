/*
 * THE LIVE «ON WHICH CARD» PROMPT — its ANSWER is a scene, never a draft pick
 * (TR53, the iteration «ресурс на карту — один стандарт», case 3; the owner's
 * photo of 2026-10-15: «игрок просто выбирает карту, и она как-то криво
 * наклоняется набок и просто падает внизу — никаких ресурсов не видно»).
 *
 * The task host answered every single-card pick the same way — the draft's
 * hero departure (`runHeroPick`: lift, −6°, a dive to the bottom of the screen)
 * with the other candidates tumbling aside (`con-exit-reject`) — and the
 * resource the player had chosen a card FOR never flew: the satellite ticked
 * when the view applied. Now the answer to a pick the server marked
 * `resourceGainPrompt` plays the grammar of `cardReceiveDirector.ts`, in the
 * family its SOURCE decides (the server's markers, never a title):
 *
 *   field  — the units come from the BOARD (`resourceGainPrompt.fromSpace`: a
 *            printed bonus, an Ares tile's adjacency, a survey): the plate GIVES
 *            THE SCREEN to the field — the chosen card is carried OUT OF THE
 *            PLATE to the paying cell, the token leaves that cell, the capsule
 *            ticks, «2 → 3» reads, the card goes home to its satellite cell.
 *            Played off the SERVER'S RECORD (`cardAdjacencyPayouts`, `asked`) —
 *            the board's own scene (`cityDataPayoutBeat`), one class for «asked»
 *            and «not asked»;
 *   colony — a colony pays (a foreign trade's owner bonus — Titan, Enceladus,
 *            Miranda): the scene plays INSIDE the colony stage the pick stands
 *            in — the chosen card sealed, the token leaves the PLANET, the
 *            capsule ticks, the card goes home;
 *   plate  — a card / anything else pays: the scene plays INSIDE the plate —
 *            the token leaves the SOURCE CARD's printed icon in the dock.
 *
 * TRANSPORT GATE (the resolution payout's shape): ARM at the press (the host,
 * before the submit — nothing is delayed behind the scene), DETECT against the
 * authoritative response (the card really took `amount` of its kind — checked
 * on the two views; the field family needs its record too), RUN with the commit
 * HELD (the pick is still the standing view: every candidate measurable), END
 * after the commit. A refused answer arms nothing that plays; a reload has no
 * armed press; reduced motion arms nothing.
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';
import {CardAdjacencyPayoutModel} from '@/common/models/CardAdjacencyPayoutModel';
import {SpaceId} from '@/common/Types';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {cardResourceKey, ResourceTransferSpec, TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {pulseDivertedSeal, resolveActionCommitAnchors, resolveGainIconOrigins} from '@/client/console/consoleActionCommitMotion';
import {firstVisibleEnd} from '@/client/console/resourceTransfer/transferEndVisible';
import {runCardHome} from '@/client/console/cardDeal/cardExitDirector';
import {auxCellRect, runCityPayoutBeat} from '@/client/console/tilePlacement/cityDataPayoutBeat';
import {claimCityPayout} from '@/client/console/tilePlacement/cityDataPayoutModel';
import {CardReceiveOutcome, runCardReceive} from '@/client/console/cardReceive/cardReceiveDirector';
import {noteTableAnswerTold} from '@/client/console/parliament/tableAnswerBeat';

/** Where the units of a live pick come from — the scene's family. */
export type PromptReceiveFamily = 'field' | 'colony' | 'plate';

export type Rect = {x: number, y: number, w: number, h: number};

/** What the press ARMED — read at the press, while the pick stands. */
type Armed = {
  card: CardName;
  /** Units the pick lands (the server's `amount`). */
  amount: number;
  /** The card-resource icon key of THIS card's kind. */
  resource: string;
  family: PromptReceiveFamily;
  fromSpace?: SpaceId;
  /** The card's stored count before the answer (the views' check and the field scene's frozen start). */
  before: number;
  /** The chosen card's live model (its face, flown in the scene). */
  model?: CardModel;
  /**
   * A CLIENT-HOSTED pick (RX35's «where» INSIDE a door's plate — the heat confirm, a standard project's row): the
   * standing view is the DOOR's prompt (the action menu), the answer rides the door's batch — the count is the evidence.
   */
  client?: true;
  /**
   * THE CARD THAT ASKS, when it stands among the candidates (TR78 Arwind Inc. — a table's answer to a step of the
   * Career, `agendaWalkPrompt.source`): the embedded pick has no dock, and the asker IS one of the faces on screen —
   * the token is born on that face's PRINTED icon of the resource.
   */
  asker?: CardName;
  /**
   * THE CARD WHOSE EFFECT ASKS (the pick's `choiceContext` source — TRP9 Medical Institute's «where?»): when the plate's
   * dock is not painted (the pick stands EMBEDDED in a host's zone — the start), the token is born on that card's own
   * face where the host shows it (the start's seat «Источник», a shelf), its printed icon of the resource.
   */
  sourceCard?: CardName;
  /**
   * The pick is a LAW's replacement of the seat's own terraforming (`resourceGainPrompt.diverted`): the token is born
   * on the STRUCK printed icon the player can see (else the plate's law seal), under the law's seal.
   */
  diverted?: true;
};

/** The family of a live pick, read off the server's markers only. */
export function promptReceiveFamily(wf: PlayerInputModel | undefined): PromptReceiveFamily | undefined {
  if (wf?.type !== 'card' || wf.resourceGainPrompt === undefined || wf.resourceGainPrompt.amount === undefined) {
    return undefined;
  }
  // A LAW'S REPLACEMENT of the seat's own terraforming (RX35 — the marker `diverted`): a card payout of the seat's
  // own action, asked by the law — the plate's scene, never the sitting's gate.
  if (wf.resourceGainPrompt.diverted !== undefined) {
    return 'plate';
  }
  // A resolution's payout keeps its own gate (`consoleResolutionPayout` — the Parliament's stage owns that scene).
  if (wf.choiceContext?.source?.kind === 'resolution') {
    return undefined;
  }
  if (wf.resourceGainPrompt.fromSpace !== undefined) {
    return 'field';
  }
  return wf.choiceContext?.source?.kind === 'colony' ? 'colony' : 'plate';
}

/** The kind THIS candidate takes (its own when the pick spans several kinds or any), as an icon key. */
export function promptReceiveResourceOf(wf: SelectCardModel, card: CardName): string | undefined {
  const meta = wf.resourceGainPrompt;
  const icon = meta?.cardResourceByCard?.[card] ?? meta?.cardResource;
  return icon === undefined ? undefined : cardResourceKey(icon);
}

export const promptReceiveState = reactive({
  /** The answered candidate while its scene is owed or playing — the host seals it and lets the others recede. */
  card: undefined as CardName | undefined,
  family: undefined as PromptReceiveFamily | undefined,
  /** The plate has given the screen to the FIELD (the field family's scene stands on the board). */
  board: false,
  /** The plate dissolves under the card going home (plate / colony families). */
  homing: false,
  /** What has LANDED on each card so far — the capsule's tick, on the touchdown. */
  landed: {} as Record<string, number>,
  /** The last scene's verdict (a probe's witness). */
  outcome: undefined as CardReceiveOutcome | 'unverified' | undefined,
});

let armed: Armed | undefined;

/** What the host's slot adds to a candidate's stored count right now (the capsule ticks at the touchdown). */
export function promptReceiveLandedOn(card: string): number {
  return promptReceiveState.landed[card] ?? 0;
}

/**
 * ARM — the host's A on a candidate of a live `resourceGainPrompt` pick, BEFORE
 * the submit. Returns whether the press is now the scene's (the host then
 * answers IN PLACE — no draft departure, no rejects tumbling).
 */
export function armPromptReceive(wf: PlayerInputModel | undefined, card: CardName, opts: {client?: boolean} = {}): boolean {
  const family = promptReceiveFamily(wf);
  if (family === undefined || consoleReducedMotionActive()) {
    return false;
  }
  const pick = wf as SelectCardModel;
  const model = pick.cards.find((c) => c.name === card);
  const resource = promptReceiveResourceOf(pick, card);
  const amount = pick.resourceGainPrompt?.amount ?? 0;
  if (model === undefined || resource === undefined || amount <= 0) {
    return false;
  }
  armed = {
    card, amount, resource, family,
    ...(pick.resourceGainPrompt?.fromSpace !== undefined ? {fromSpace: pick.resourceGainPrompt.fromSpace} : {}),
    before: model.resources ?? 0,
    model,
    ...(opts.client === true ? {client: true as const} : {}),
    ...(pick.resourceGainPrompt?.diverted !== undefined ? {diverted: true as const} : {}),
    ...(pick.agendaWalkPrompt !== undefined ? {asker: pick.agendaWalkPrompt.source} : {}),
    ...(pick.choiceContext?.source?.kind === 'card' && pick.choiceContext.source.card !== undefined ?
      {sourceCard: pick.choiceContext.source.card} : {}),
  };
  // The scene's faces are LITE (the field's receiving card, the carried home): warm the THUMB the field paints and
  // the full the plate already shows — at the PRESS, where the round trip pays for the decode (the field card rose
  // with a black art box on its first frames, the 4K stand).
  preloadPremiumCardArt([card], ['thumb', 'full']);
  promptReceiveState.card = card;
  promptReceiveState.family = family;
  promptReceiveState.board = false;
  promptReceiveState.homing = false;
  promptReceiveState.landed = {};
  return true;
}

/** The answer's evidence the gate plays on. */
export type PromptReceiveEvent = {
  armed: Armed;
  /** The field family's record (the server's own — the scene plays it, never a diff). */
  record?: CardAdjacencyPayoutModel;
};

function storedOn(view: PlayerViewModel, card: CardName): number | undefined {
  return view.thisPlayer?.tableau?.find((c) => c.name === card)?.resources;
}

/**
 * DETECT (pure + the claim): the armed answer was accepted — the standing view
 * was that pick, and the response shows the card's count risen by exactly the
 * pick's amount (the field family: and the server's `asked` record of it, not
 * seen before). Anything else disarms honestly: the host's state goes back,
 * the pick's own leave plays, the counters tick with the commit.
 */
export function detectPromptReceive(before: PlayerViewModel | undefined, after: PlayerViewModel): PromptReceiveEvent | undefined {
  const a = armed;
  if (a === undefined) {
    return undefined;
  }
  const wf = before?.waitingFor;
  // A client-hosted pick stands INSIDE its door: the view's prompt is the door's (the action menu), the pick is the
  // host's own model — the standing door and the count are the evidence.
  const standing = a.client === true ? wf !== undefined :
    wf?.type === 'card' && (wf as SelectCardModel).cards.some((c) => c.name === a.card) && promptReceiveFamily(wf) === a.family;
  const now = storedOn(after, a.card);
  if (!standing || now === undefined || now !== a.before + a.amount) {
    disarmPromptReceive('unverified');
    return undefined;
  }
  if (a.family !== 'field') {
    return {armed: a};
  }
  const seen = new Set((before?.game?.cardAdjacencyPayouts ?? []).map((r) => r.seq));
  const record = (after.game?.cardAdjacencyPayouts ?? []).find((r) =>
    !seen.has(r.seq) && r.asked === true && r.target === a.card && r.color === after.thisPlayer?.color && r.amount === a.amount);
  if (record === undefined || !claimCityPayout(record.seq)) {
    // No record to play (an older server, a ring overflow): the plate scene is the honest fallback — the card is
    // still here, the token flies from the dock or the plate itself.
    return {armed: {...a, family: 'plate'}};
  }
  return {armed: a, record};
}

function measureEl(selector: string): Rect | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const el = document.querySelector<HTMLElement>(selector);
  const r = el?.getBoundingClientRect();
  return r !== undefined && r.width > 2 && r.height > 2 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
}

function escapeName(name: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
}

/** The ASKER's face on the answer stage's hero (TR78 — `ConsoleParliamentTableAnswer`), when one stands. */
function askerFaceEl(): HTMLElement | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  return firstVisibleEnd('.con-tans [data-tans-asker-face]') as HTMLElement | undefined;
}

/** The asking card's PAINTED face outside the pick: the start's seat «Источник», else a shelf / table slot. */
function sourceFaceEl(card: CardName): HTMLElement | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const name = escapeName(card);
  return (firstVisibleEnd(`[data-start-seat-card="${name}"]`) ?? firstVisibleEnd(`[data-played-key="${name}"]`)) as HTMLElement | undefined;
}

/** The answered candidate's slot in the standing pick (the plate's strip or the colony stage's zone). */
function slotEl(card: CardName): HTMLElement | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  return document.querySelector<HTMLElement>(`.con-task-host .con-cards__slot[data-zoom-slot="${escapeName(card)}"]`) ?? undefined;
}

/** The slot's card face (the measured box a flight leaves from). */
function slotCardRect(card: CardName): Rect | undefined {
  const slot = slotEl(card);
  const face = slot?.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? slot;
  const r = face?.getBoundingClientRect();
  return r !== undefined && r.width > 4 && r.height > 4 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
}

const centre = (r: Rect): TransferPoint => ({x: r.x + r.w / 2, y: r.y + r.h / 2});

/**
 * Where a REPLACED unit's data is born (RX35): the STRUCK printed icon the player can see (the heat confirm's formula
 * row stands above its hosted picker), else the plate's own LAW SEAL (an embedded pick has no dock, and a standard
 * project's row is parked under its step) — read painted-first, never the first measurable.
 */
const DIVERTED_ORIGIN_SELECTORS: ReadonlyArray<string> = [
  '.action-effect-chip--diverted .action-effect-chip__icon:not(.action-effect-chip__diverted-icon)',
  '.con-task-host [data-task-law-seal] .con-task__lawseal-emblem',
];
function divertedOriginRect(): Rect | undefined {
  for (const sel of DIVERTED_ORIGIN_SELECTORS) {
    const el = firstVisibleEnd(sel);
    const r = el?.getBoundingClientRect();
    if (r !== undefined && r.width > 2 && r.height > 2) {
      return {x: r.left, y: r.top, w: r.width, h: r.height};
    }
  }
  return undefined;
}

/**
 * Where a token is BORN for the in-surface families: the colony's PLANET on
 * its stage (the colony pays), the source card's PRINTED icon of the resource
 * in the plate's dock (a card pays), else the dock's face / the plate itself.
 */
function originsFor(a: Armed, specs: ReadonlyArray<ResourceTransferSpec>): Array<TransferPoint | undefined> {
  if (a.diverted === true) {
    const struck = divertedOriginRect();
    if (struck !== undefined) {
      return specs.map(() => centre(struck));
    }
  }
  if (a.family === 'colony') {
    // The colony's PLANET on its stage; a standalone plate names the colony on its dock plate — that plate is the
    // colony's stand-in on screen, so the token is born there.
    const planet = measureEl('.con-colfocus .con-colfocus__planet') ?? measureEl('.con-colfocus .con-planet') ??
      measureEl('.con-task-host .con-src');
    return specs.map(() => planet === undefined ? undefined : centre(planet));
  }
  // A TABLE'S ANSWER TO A WALK OF THE CAREER (TR78 Arwind Inc. — «ОТВЕТ СТОЛА»): the embedded pick has no dock — the
  // ASKER stands on the answer stage's hero (else among the candidates), and the token is born on that face's PRINTED
  // icon of the resource (the corporation's fighter), never on the picker's own bar.
  const asker = a.asker === undefined ? undefined : (askerFaceEl() ?? slotEl(a.asker));
  if (asker !== undefined) {
    return resolveGainIconOrigins(resolveActionCommitAnchors(asker, undefined), specs);
  }
  // The plate's dock, as PAINTED (an embedded pick's dock stands under its host's glass — never a birth there).
  const paintedDock = firstVisibleEnd('.con-task-host .con-src') as HTMLElement | undefined;
  if (paintedDock !== undefined) {
    return resolveGainIconOrigins(resolveActionCommitAnchors(paintedDock, undefined), specs);
  }
  // …else the ASKING card's own face where its host shows it (TRP9 in the start's seat «Источник», a shelf's slot).
  const face = a.sourceCard === undefined ? undefined : sourceFaceEl(a.sourceCard);
  if (face !== undefined) {
    return resolveGainIconOrigins(resolveActionCommitAnchors(face, undefined), specs);
  }
  const dock = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.con-task-host .con-src');
  if (dock !== null) {
    return resolveGainIconOrigins(resolveActionCommitAnchors(dock, undefined), specs);
  }
  return specs.map(() => undefined);
}

/** The in-surface scene (plate / colony): seal → tokens from the source → tick → read → the card goes home. */
function runInSurface(a: Armed): Promise<CardReceiveOutcome> {
  const specs: Array<ResourceTransferSpec> = Array.from({length: a.amount}, () => ({
    channel: 'card-resource', resource: a.resource, amount: 1, targetCard: a.card,
  }));
  return runCardReceive({
    host: a.family === 'colony' ? 'colony' : 'prompt',
    card: a.card,
    // PRESENT: the press already sealed the card and let the others recede (`promptReceiveState.card`); the scene
    // only needs the slot to be there.
    present: () => Promise.resolve(slotCardRect(a.card) !== undefined),
    pay: async () => {
      // THE LAW'S SEAL on the birthplace (RX35): the rim and its strike dwell on the struck icon while the token is born.
      if (a.diverted === true) {
        pulseDivertedSeal(divertedOriginRect());
      }
      await runResourceTransfers({
        specs,
        origins: originsFor(a, specs),
        source: {selectors: [...(a.diverted === true ? DIVERTED_ORIGIN_SELECTORS : []), '.con-task-host .con-src .pcard', '.con-colfocus .con-colfocus__planet', '.con-task-host .con-src', '.con-task-host .con-cards__verdictbar']},
        arrival: 'auto',
        // The chips land INSIDE the standing pick: the feed only (a blocking hold would retract the very surface).
        inSurface: true,
        onArrive: (spec) => {
          if (spec.targetCard !== undefined) {
            promptReceiveState.landed = {...promptReceiveState.landed, [spec.targetCard]: (promptReceiveState.landed[spec.targetCard] ?? 0) + spec.amount};
          }
        },
      });
      return true;
    },
    ret: async () => {
      const slot = slotEl(a.card);
      if (slot === undefined) {
        return;
      }
      await runCardHome({name: a.card, el: slot, card: a.model === undefined ? undefined : {...a.model, resources: a.before + a.amount}}, () => {
        const cell = auxCellRect(a.resource, a.card);
        return cell === undefined ? undefined : new DOMRect(cell.x, cell.y, cell.w, cell.h);
      }, () => {
        // The result outlives its surface: the plate lets go UNDER the card going home.
        promptReceiveState.homing = true;
      });
    },
  });
}

/** The field scene: the board's own «tile pays a card» scene, the card carried OUT OF THE PLATE to the paying cell. */
async function runField(a: Armed, record: CardAdjacencyPayoutModel): Promise<CardReceiveOutcome> {
  const tile = measureEl(`.board-space[data_space_id="${escapeName(record.spaceId)}"]`);
  const from = slotCardRect(a.card);
  if (tile === undefined || from === undefined) {
    return 'degraded';
  }
  let outcome: CardReceiveOutcome = 'done';
  await runCityPayoutBeat({
    payout: record,
    tileRect: tile,
    cardModel: a.model,
    uiScale: conUiScale(),
    pace: 1,
    alive: () => true,
    // PRE-COMMIT: nothing is held — the view has not applied; the satellite and the rail tick with the commit, right
    // after the card has gone home.
    releaseCard: () => undefined,
    releaseReaction: () => undefined,
    riseFrom: from,
    inPrompt: true,
    onRise: () => {
      // The plate GIVES THE SCREEN to the field the frame the card stands over its slot.
      promptReceiveState.board = true;
      const slot = slotEl(a.card)?.querySelector<HTMLElement>(':is(.card-container, .pcard)');
      slot?.classList.add('con-deal-hold');
    },
    onEnd: (verdict) => {
      outcome = verdict;
    },
  });
  return outcome;
}

/**
 * RUN — the commit HELD: the family's scene. Resolves when the card has gone
 * home (or the scene degraded); never rejects.
 */
export async function runPromptReceive(event: PromptReceiveEvent): Promise<void> {
  const a = event.armed;
  promptReceiveState.family = a.family;
  try {
    promptReceiveState.outcome = event.record !== undefined ? await runField(a, event.record) : await runInSurface(a);
  } catch {
    promptReceiveState.outcome = 'degraded';
  }
  // A WALK'S ANSWER THE PLAYER GAVE ON STAGE (TR78): the scene has told it — the record that follows in the commit is
  // attributed to it, never flown a second time by the answer stage or the reaction chain.
  if (a.asker !== undefined) {
    noteTableAnswerTold(a.asker, [{channel: 'card-resource', resource: a.resource, amount: a.amount, targetCard: a.card}]);
  }
}

/** END (post-commit) / ABORT — the pick is gone; the poses and the ticks let go (idempotent). */
export function endPromptReceive(): void {
  disarmPromptReceive(promptReceiveState.outcome);
}

/** Disarm: nothing of the press is owed any more (a refusal, the end, the transport's abort battery). */
export function disarmPromptReceive(outcome?: PromptReceiveOutcomeLike): void {
  armed = undefined;
  promptReceiveState.card = undefined;
  promptReceiveState.family = undefined;
  promptReceiveState.board = false;
  promptReceiveState.homing = false;
  promptReceiveState.landed = {};
  if (outcome !== undefined) {
    promptReceiveState.outcome = outcome;
  }
}

type PromptReceiveOutcomeLike = CardReceiveOutcome | 'unverified';

/** The press is armed and its answer not in yet (the host keeps the seal; a probe reads it). */
export function promptReceiveArmed(): boolean {
  return armed !== undefined;
}

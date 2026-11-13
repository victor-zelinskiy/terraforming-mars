/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE MILESTONES / AWARDS CONTROLLER — the two workspaces of one family («Вехи» and «Награды») of the console shell:
 * the screen's items, the focused title's view (availability, block reason, price and its waiver), the payment lane of
 * a claim / a funding, and the commit beat with its safety and its ceremony's end.
 *
 * Taken out of ConsoleShell.vue by scripts/shell-extract.mjs (architecture v2 — docs/claude/console/architecture-v2/
 * PLAN.md §5 · S2): the members are verbatim, every `this.` rewritten — own members are locals, the rest of the shell
 * is the PORT below. The template blocks (the two workspaces) still live in the shell and read these members by name.
 */
import {claimMaVp, dropMaVp, flyMaVp} from '@/client/console/scoreCell/maVp';
import {ExposedOf} from '@/client/components/exposedOf';
import {addressed, AddressableInput, promptAddressOf} from '@/common/inputs/preselectAddress';
import {computed} from 'vue';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Message} from '@/common/logs/Message';
import {SelectPaymentModel} from '@/common/models/PlayerInputModel';
import {getMilestone, getAward} from '@/client/MilestoneAwardManifest';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {AwardName} from '@/common/ma/AwardName';
import {SubmitTicket} from '@/client/console/transport/gameTransport';
import {displayNameForColor, participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import ConsoleMaScreen from '@/client/components/console/ConsoleMaScreen.vue';
import {buildConsoleMaItems, ConsoleMaItem, ConsoleMaKind} from '@/client/components/console/consoleMaModel';
import {buildMaConfirm, MaConfirmView} from '@/client/components/ma/maConfirmModel';
import {MaPriceWaiver, maPriceWaiverOf, MaSponsorSlot} from '@/client/console/maPriceReading';
import {buildMaInspect, MaInspectView} from '@/client/components/console/consoleMaInspectModel';
import {armMaCeremony, claimMaCeremonyEmbed, releaseMaCeremonyEmbed, abandonMaCeremonyEmbed, disarmMaCeremony, maCeremonyState, MaCeremonyEvent} from '@/client/components/ma/maCeremonyState';
import {maFocusState, closeMaFocus, setMaFocusError, beginMaFocusCommit, failMaFocusCommit, beginMaFocusCeremony, beginMaFocusClosing, resetMaFocus, maFocusCommitArmed, maFocusCommitOutcome, openMaPay, closeMaPay, setMaPayCount, setMaPayFocus} from '@/client/console/consoleMaFocus';
import {armMaPrice, flyMaPrice, releaseMaPrice} from '@/client/console/maPriceRail';
import {buildPaymentView as buildMaPaymentView, dialLaneCount as dialMaPayLane, editableRows as maPayRows, initialCounts as maPayInitialCounts, megacreditsAvailable as maPayMcAvailable, paymentCovers as maPayCovers, paymentFromCounts as maPayFromCounts, PaymentLane as MaPayLane, paymentLanes as maPayLanes, PaymentView as MaPayView} from '@/client/console/paymentPlan';
import {buildMaHudZone, MaHudZone} from '@/client/console/consoleMaHudModel';
import {shareViewSnapshot} from '@/client/utils/viewSnapshotShare';
import {leaveWorkspace, workspaceFrameIndex, workspaceFrameAnchor, workspaceFrameHost, workspaceFrameKnown, WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {ConsoleTask} from '@/client/console/consoleTaskRouter';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleState} from '@/client/console/consoleRouter';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {AWARD_COSTS, MILESTONE_COST} from '@/common/constants';
import {findAwardOptionPath, findMilestoneOptionPath, inputTitleText, wrapPath} from '@/client/console/turnIntents';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import type {SeatController} from '@/client/console/shell/seatController';
import type {UnwrapRef} from 'vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import type {SurfaceRegistry} from '@/client/console/shell/surfaceRegistry';

/**
 * Identity-stable MA HUD zones (perf iteration 3). `buildMaHudZone` returns a
 * fresh object per evaluation, and the zones re-evaluate on every playerView
 * commit (their deps ride `game`); a fresh identity re-rendered the v-show'n
 * strategy rail AND fired its `observeZone` ledger watchers on every response
 * — hidden included. Sharing against the previous value returns the SAME
 * object whenever the content is unchanged (Vue 3.4 computeds then notify no
 * dependents at all). Module-level on purpose: plain memory, content-compared,
 * safe across a shell remount.
 */
const maHudZoneShare: {milestones?: MaHudZone, awards?: MaHudZone} = {};

/** The MA workspace commit backstop: a submit whose verdict never arrives
 *  (lost response) restores the reversible detail with an honest reason —
 *  far above any real round-trip, far below the 35 s hold ceiling. */
const MA_COMMIT_SAFETY_MS = 15_000;

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type MaPort = {
  game: UnwrapRef<SeatController['game']>,
  surfaces: SurfaceRegistry,
  readonly actionBlockedReason: string,
  readonly awaitingInput: boolean,
  concludeWorkspaceFlowOrOwe(kind: WorkspaceFrameKind, servedPromptHolds?: boolean): boolean,
  readonly myTurn: boolean,
  readonly playerView: PlayerViewModel,
  readonly shellTask: ConsoleTask | undefined,
  submit(response: unknown): SubmitTicket,
  submitBatch(responses: ReadonlyArray<unknown>, promptId?: number): SubmitTicket,
  readonly thisPlayer: PublicPlayerModel,
  readonly viewerPassed: boolean,
};

export function createMaController(shell: MaPort) {
  // The controller's own scope (architecture v2 — PLAN §10 · C1): it ends with the shell, and its timers with it.
  const flow = useFlowScope('ma-controller');
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The MA workspace commit's safety backstop (a verdict may never hang) — its cancel; the scope owns the timer. */
  let cancelMaFocusSafety: () => void = () => {};

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /** Award names for the translation-proof structure fallback (the fund
   *  OrOptions title is a Message that i18n mutates in place). */
  const awardNames = computed((): Array<string> => {
    return shell.game.awards.map((a) => a.name);
  });

  /** P30: the right STRATEGY RAIL's Milestones/Awards projections — the
   *  same authoritative sources as the workspaces (models + the live
   *  waitingFor option set + the server's own `maCosts` prices). */
  const hudMilestoneZone = computed((): MaHudZone => {
    const next = buildMaHudZone('milestones', shell.game.milestones, {
      myColor: shell.thisPlayer.color,
      availableNow: claimableTitles(findMilestoneOptionPath(shell.playerView.waitingFor)?.options),
      maxSlots: 3,
      cost: milestoneCostValue.value,
    });
    maHudZoneShare.milestones = shareViewSnapshot(maHudZoneShare.milestones, next) as MaHudZone;
    return maHudZoneShare.milestones;
  });

  const hudAwardZone = computed((): MaHudZone => {
    const next = buildMaHudZone('awards', shell.game.awards, {
      myColor: shell.thisPlayer.color,
      availableNow: claimableTitles(findAwardOptionPath(shell.playerView.waitingFor, awardNames.value)?.options),
      maxSlots: 3,
      // Free sponsorship (Vitor's start action) — the honest live price is 0.
      cost: awardFundingActive.value ? 0 : awardCostValue.value,
    });
    maHudZoneShare.awards = shareViewSnapshot(maHudZoneShare.awards, next) as MaHudZone;
    return maHudZoneShare.awards;
  });

  /**
   * P26 → FB′: milestones and awards are TWO workspaces of ONE family (the owner, 2026-11-03: the one-screen split
   * divided the player's attention and scrolled with Venus's sixth item). The sheet IS the kind; LB/RB walk between
   * the two (`openSheet` — a lateral move), and an open detail stage keeps its own sheet.
   */
  const maScreenKind = computed((): ConsoleMaKind | undefined => {
    const sheet = consoleState.sheet;
    return sheet === 'milestones' || sheet === 'awards' ? sheet : undefined;
  });

  /** The screen's items — PURE derivation (consoleMaModel). */
  const maScreenItems = computed((): Array<ConsoleMaItem> => {
    const kind = maScreenKind.value;
    return kind === undefined ? [] : buildMaItems(kind);
  });

  /**
   * THE LIVE PRICES — the engine's own `milestoneCost()` / `awardFundingCost()`,
   * published on the player view (`maCosts`). Every rule that moves them is
   * already applied there: Van Allen / Nirgal Enterprises make them free,
   * Staged Protests adds 8, and the award price climbs 8 → 14 → 20 with each
   * funding. The UI must never re-derive it from constants — it would keep
   * offering a number the server refuses (and the ladder is only a default
   * for a model that predates the field).
   */
  const milestoneCostValue = computed((): number => {
    return shell.playerView.maCosts?.milestone ?? MILESTONE_COST;
  });

  const awardCostValue = computed((): number => {
    const funded = shell.game.awards.filter((a) => a.playerName !== undefined && a.playerName !== '').length;
    return shell.playerView.maCosts?.award ?? (AWARD_COSTS[funded] ?? AWARD_COSTS[AWARD_COSTS.length - 1]);
  });

  /**
   * THE CARD THAT WAIVED A PRICE (PC01 Nirgal Enterprises · GO) and the table's price it waived — both off the
   * server's `maCosts` (`printed` / `waiver`, published only beside a waiver); never derived from the constants.
   */
  const maScreenPriceWaiver = computed((): MaPriceWaiver | undefined => {
    const kind = maScreenKind.value;
    return kind === undefined || (kind === 'awards' && awardFundingActive.value) ? undefined : ownMaPriceWaiverOf(kind);
  });

  /** The FREE award-funding prompt (Vitor's start action) is the pending
   *  shell task — the premium awards MA screen hosts it (desktop parity:
   *  the AwardsOverlay's free-sponsorship mode), never the generic list. */
  const awardFundingActive = computed((): boolean => {
    return shell.shellTask?.kind === 'awardFunding';
  });

  /**
   * The free funding stands as a HOSTED SCENE STEP of the start workspace
   * (Vitor's first action raised it from inside «ПЕРВОЕ ДЕЙСТВИЕ»). The
   * PROMPT anchor is what tells it apart from a lateral awards visit
   * standing over the same surviving phase root: a step the server demanded
   * ends with its flow (B = свернуть ВЕСЬ workspace, никакого «Close» в
   * никуда), and the category bumpers are not offered — a mandatory step is
   * not a dashboard stroll.
   */
  const awardStepHosted = computed((): boolean => {
    return workspaceFrameHost('awards') === 'start' &&
      workspaceFrameAnchor('awards')?.type === 'prompt';
  });

  /** The descended MA item (undefined = the detail stage is closed). */
  const maFocusItem = computed((): ConsoleMaItem | undefined => {
    if (!maFocusState.open || maScreenKind.value === undefined) {
      return undefined;
    }
    return maScreenItems.value.find((it) => it.name === maFocusState.name);
  });

  /** The detail stage's economy/slots view — REBUILT from the live
   *  playerView on every commit, so a slot raced away while the stage is
   *  open honestly re-renders as blocked (never a dead submit). */
  const maFocusView = computed((): MaConfirmView | undefined => {
    if (!maFocusState.open) {
      return undefined;
    }
    const kind = maFocusState.kind;
    const models = kind === 'milestone' ? shell.game.milestones : shell.game.awards;
    const source = models.find((m) => m.name === maFocusState.name);
    if (source === undefined) {
      return undefined;
    }
    const describe = (name: string): string => {
      try {
        return kind === 'milestone' ?
          getMilestone(name as MilestoneName).description :
          getAward(name as AwardName).description;
      } catch (err) {
        return '';
      }
    };
    const free = kind === 'award' && awardFundingActive.value;
    const waiver = free ? undefined : ownMaPriceWaiverOf(kind === 'milestone' ? 'milestones' : 'awards');
    return buildMaConfirm(kind, source, models, {
      myColor: shell.thisPlayer.color,
      myMegacredits: shell.thisPlayer.megacredits,
      cost: kind === 'milestone' ? milestoneCostValue.value : (free ? 0 : awardCostValue.value),
      free, // Vitor's free sponsorship — the stage shows the free chip.
      // PC01 · GO: the price's CAUSE — the table's price and the card that waived it, both the server's facts.
      ...(waiver !== undefined ? {printed: waiver.printed, waivedBy: waiver.waivedBy} : {}),
      maxSlots: 3,
      playerName: (c) => {
        const pl = shell.playerView.players.find((candidate) => candidate.color === c);
        return pl !== undefined ? participantDisplayName(pl) : c;
      },
      describe,
    });
  });

  /** The detail stage's ranked race/standings (the inspect view-model). */
  const maFocusInspect = computed((): MaInspectView | undefined => {
    const item = maFocusItem.value;
    if (item === undefined) {
      return undefined;
    }
    // Resolve every participant label through the ONE display-name helper
    // (a MarsBot reads «Бот» in the standings, never a raw «MarsBot»).
    const inspect = buildMaInspect(item, shell.playerView.players.map((p) => ({...p, name: participantDisplayName(p)})));
    // The bot's own rule for this name (the server's registry line) rides the inspect — the stage only renders it.
    const rule = shell.playerView.game.automa?.maRules?.find((l) => l.name === item.name && l.kind === inspect.kind);
    return rule === undefined ? inspect :
      {...inspect, botRule: {criterion: rule.criterion, ...(rule.kind === 'award' ? {helper: rule.helper} : {})}};
  });

  /** LIVE availability for the open detail stage (waitingFor = the truth). */
  const maFocusAvailable = computed((): boolean => {
    if (!maFocusState.open) {
      return false;
    }
    const found = maFocusState.kind === 'milestone' ?
      findMilestoneOptionPath(shell.playerView.waitingFor) :
      findAwardOptionPath(shell.playerView.waitingFor, awardNames.value);
    return claimableTitles(found?.options).has(maFocusState.name);
  });

  /**
   * The CONCRETE blocker when the open detail stage cannot act — the MODEL's ONE ladder (`ConsoleMaItem.blocker`,
   * the same the rail and the overview read; FB): the action menu withheld, the slots, the turn, the money — and a
   * milestone short of its threshold / its condition says so, never a generic «cannot right now».
   */
  const maFocusBlockReason = computed((): string => {
    if (maFocusAvailable.value) {
      return '';
    }
    const item = maFocusItem.value;
    if (item === undefined) {
      return '';
    }
    if (item.takenBy !== undefined) {
      return item.kind === 'milestone' ? 'Already claimed' : 'Already funded';
    }
    if (item.blocker !== '') {
      return item.blocker;
    }
    return item.threshold !== undefined ? 'Threshold not reached yet' : 'Condition not met';
  });

  /**
   * THE BILL THE CLAIM / THE FUNDING WILL ASK (PL-1622 — Helion's heat, Stormcraft's floaters): the server's preview
   * of the very payment its deferred bill raises (`maCosts.payments`, the claim named on its marker). Undefined when
   * the bill is paid silently in M€, and for a free sponsorship (Vitor's).
   */
  const maFocusPayment = computed((): SelectPaymentModel | undefined => {
    if (!maFocusState.open || maFocusView.value?.free === true) {
      return undefined;
    }
    return shell.playerView.maCosts?.payments?.[maFocusState.name];
  });

  /** The names whose bill the server WILL ask (`maCosts.payments` — not for a free sponsorship). */
  const maBillNames = computed((): ReadonlyArray<string> => {
    return awardFundingActive.value ? [] : Object.keys(shell.playerView.maCosts?.payments ?? {});
  });

  const maPayLaneList = computed((): Array<MaPayLane> => {
    const model = maFocusPayment.value;
    return model === undefined ? [] : maPayLanes(model, shell.thisPlayer);
  });

  /** The bill's amount — the server's own (Briber's +12 included), never the generic claim price. */
  const maPayCost = computed((): number => {
    return maFocusPayment.value?.amount ?? maFocusView.value?.cost ?? 0;
  });

  /** The payment stage's panel view (undefined while the stage is closed). */
  const maPayView = computed((): MaPayView | undefined => {
    const pay = maFocusState.pay;
    if (pay === undefined || maFocusPayment.value === undefined) {
      return undefined;
    }
    return buildMaPaymentView({cost: maPayCost.value, lanes: maPayLaneList.value, counts: pay.counts, mcAvailable: maPayMcAvailable(shell.thisPlayer)});
  });

  const maPayFocusUnit = computed((): string | undefined => {
    const v = maPayView.value;
    return v === undefined ? undefined : maPayRows(v)[maFocusState.pay?.focus ?? 0]?.unit;
  });

  const maPayReady = computed((): boolean => {
    const pay = maFocusState.pay;
    return pay !== undefined && maPayCovers(maPayCost.value, maPayLaneList.value, pay.counts, maPayMcAvailable(shell.thisPlayer));
  });

  /** The awards' sponsors in funding order — the detail's sponsorship ladder seats them on their slots. */
  const maAwardSponsors = computed((): ReadonlyArray<MaSponsorSlot> => {
    // FUNDING order, by the server's `slot` (PC01 · GO): the model lists the awards in BOARD order, so a ladder that
    // paired board order with the slot prices seated a sponsor on somebody else's price. A model without the field
    // keeps the board order (the degrade it always had).
    return shell.game.awards
      .filter((a) => a.playerName !== undefined && a.playerName !== '' && a.color !== undefined)
      .map((a, i) => ({a, order: a.slot ?? i}))
      .sort((x, y) => x.order - y.order)
      .map(({a}) => ({
        color: a.color as string,
        ...(a.paid !== undefined ? {paid: a.paid} : {}),
        ...(a.waivedBy !== undefined ? {waivedBy: a.waivedBy} : {}),
      }));
  });

  /** The ceremony queue head — the commit watcher's reactive mirror. */
  const maCurrentBeat = computed((): MaCeremonyEvent | undefined => {
    return maCeremonyState.current;
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The server's waiver of one kind's next price (PC01 · GO — `maCosts.waiver` / `.printed`). */
  function ownMaPriceWaiverOf(kind: 'milestones' | 'awards'): MaPriceWaiver | undefined {
    return maPriceWaiverOf(shell.playerView.maCosts, kind);
  }

  function claimableTitles(options: ReadonlyArray<PlayerInputModel> | undefined): Set<string> {
    const set = new Set<string>();
    for (const o of options ?? []) {
      if (o.type === 'option') {
        const t = inputTitleText(o.title);
        if (t !== undefined) {
          set.add(t);
        }
      }
    }
    return set;
  }

  /** One kind's items — PURE derivation (consoleMaModel): the live models, the waitingFor's offer, the price. */
  function buildMaItems(kind: ConsoleMaKind): Array<ConsoleMaItem> {
    const found = kind === 'milestones' ?
      findMilestoneOptionPath(shell.playerView.waitingFor) :
      findAwardOptionPath(shell.playerView.waitingFor, awardNames.value);
    const describe = (name: string): string => {
      try {
        return kind === 'milestones' ?
          getMilestone(name as MilestoneName).description :
          getAward(name as AwardName).description;
      } catch (err) {
        return '';
      }
    };
    return buildConsoleMaItems(kind, kind === 'milestones' ? shell.game.milestones : shell.game.awards, {
      myColor: shell.thisPlayer.color,
      blockedReason: awardFundingActive.value ? '' : shell.actionBlockedReason,
      myTurn: shell.myTurn,
      awaitingInput: shell.awaitingInput,
      passed: shell.viewerPassed,
      myMegacredits: shell.thisPlayer.megacredits,
      availableNow: claimableTitles(found?.options),
      describe,
      maxSlots: 3,
      // Free sponsorship (Vitor) costs 0 — the price chip then reads «Бесплатно».
      nextCost: kind === 'milestones' ? milestoneCostValue.value :
        (awardFundingActive.value ? 0 : awardCostValue.value),
      // Claimant label resolves the MarsBot seat to «Бот», never the raw name.
      resolveName: (color) => displayNameForColor(shell.playerView.players, color),
    });
  }

  /** A = «Выбрать» on the overview — descend into the focused item's
   *  detail stage. The SCREEN arms the descend origins (the pressed card's
   *  and its emblem pedestal's rects) synchronously at the press. */
  function enterMaFocus(): void {
    (shell.surfaces.at<ExposedOf<typeof ConsoleMaScreen>>('maScreen'))?.enterFocus();
  }

  /** Mouse/touch on an overview tile: focus it; a second click on the
   *  focused tile descends (the controller's own two-step, same doors). */
  function onMaPick(index: number): void {
    if (consoleState.sheetIndex === index) {
      enterMaFocus();
      return;
    }
    consoleState.sheetIndex = index;
  }

  /** B on the detail stage (pre-commit) — fold back to the overview; the
   *  browse layer was only parked, so selection and scroll survive. */
  function foldMaFocus(): void {
    closeMaFocus();
  }

  /**
   * A on the detail stage — the ONE commit of the MA workspace. Re-resolves
   * the LIVE option path (the prompt may have moved while the stage was
   * open) and submits the byte-identical nested OR response. The stage does
   * NOT close: the flow enters `committing` (input absorbed), the ceremony
   * is armed as a candidate + the embed claim is set, and the commit
   * watchers decide the outcome (ceremony / payment step / honest refusal).
   * A blocked press answers with the CONCRETE inline reason, never a mute
   * no-op — the stage stays up for reading either way.
   */
  function submitMaFocusCommit(): void {
    if (!maFocusState.open || maFocusState.phase !== 'detail') {
      return;
    }
    // A double-tap of A on the list must never buy the thing it just opened:
    // the stage has to have been READABLE first (consoleMaFocus.COMMIT_ARM_MS).
    if (!maFocusCommitArmed()) {
      return;
    }
    const item = maFocusItem.value;
    const view = maFocusView.value;
    if (item === undefined || view === undefined) {
      return;
    }
    if (shell.actionBlockedReason !== '') {
      setMaFocusError(shell.actionBlockedReason);
      return;
    }
    if (!maFocusAvailable.value) {
      setMaFocusError(maFocusBlockReason.value !== '' ? maFocusBlockReason.value : 'Unavailable right now');
      return;
    }
    const found = item.kind === 'milestone' ?
      findMilestoneOptionPath(shell.playerView.waitingFor) :
      findAwardOptionPath(shell.playerView.waitingFor, awardNames.value);
    if (found === undefined) {
      setMaFocusError('Unavailable right now');
      return;
    }
    const options = found.options as ReadonlyArray<{type: string, title: string | Message}>;
    const innerIdx = options.findIndex((o) => o.type === 'option' && inputTitleText(o.title) === item.name);
    if (innerIdx === -1) {
      setMaFocusError('Unavailable right now');
      return;
    }
    // «› ОПЛАТА» (PL-1622): a bill the server WILL ask (Helion's heat, Stormcraft's floaters) stands INSIDE the
    // detail first — the same press returns here with the counts in hand, and the claim and its payment leave in ONE
    // POST, the payment ADDRESSED to the claim's own bill (`maCosts.payments` names it on its marker).
    const bill = maFocusPayment.value;
    if (bill !== undefined && maFocusState.pay === undefined) {
      openMaPay(maPayInitialCounts(maPayCost.value, maPayLaneList.value, maPayMcAvailable(shell.thisPlayer)) as Record<string, number>);
      return;
    }
    if (bill !== undefined && !maPayReady.value) {
      return;
    }
    const payment = bill === undefined || maFocusState.pay === undefined ? undefined :
      maPayFromCounts(maPayCost.value, maPayLaneList.value, maFocusState.pay.counts, maPayMcAvailable(shell.thisPlayer));
    // THE PRICE LEAVES THE RAIL FIRST (PL-1621): armed at the press as PAID — the M€ (or the composed payment's rows),
    // held from the view that pays it and flown into the detail's printed price before the ceremony.
    armMaPrice(item.name, view.free ? {} : payment !== undefined ?
      {megacredits: payment.megacredits, heat: payment.heat} : {megacredits: view.cost});
    beginMaFocusCommit({gameAge: shell.game.gameAge, undoCount: shell.game.undoCount});
    claimMaCeremonyEmbed(item.kind, item.name);
    armMaCeremony({kind: item.kind, name: item.name, cost: view.cost, free: view.free, price: view.price});
    // THE SCORE CELL (TR55): the milestone's +5 / the award's place is the ceremony's to show — held to its token.
    claimMaVp(item.kind, item.name);
    armMaFocusSafety();
    // Deliberately NOT `submitInnerOption` — that helper closes the console
    // layers, and the whole point here is that the workspace stays up.
    const claim = wrapPath([...found.path, innerIdx], {type: 'option' as const});
    if (bill !== undefined && payment !== undefined) {
      shell.submitBatch([claim, addressed({type: 'payment' as const, payment}, promptAddressOf(bill as unknown as AddressableInput))]);
      return;
    }
    shell.submit(claim);
  }

  /** «› ОПЛАТА» (PL-1622): ↑↓ a source, ←→ / LB RB ±1, RT the source's MAX, A pays and claims, B back to the detail. */
  function handleMaPayIntent(intent: GamepadIntent): void {
    const pay = maFocusState.pay;
    const view = maPayView.value;
    if (pay === undefined || view === undefined) {
      return;
    }
    if (intent.kind === 'nav') {
      const rows = maPayRows(view).length;
      if (intent.dir === 'up' || intent.dir === 'down') {
        setMaPayFocus(Math.min(Math.max(0, rows - 1), Math.max(0, pay.focus + (intent.dir === 'down' ? 1 : -1))));
      } else {
        dialMaPay(intent.dir === 'right' ? 1 : -1);
      }
      return;
    }
    if (intent.kind !== 'press') {
      return;
    }
    switch (consoleActionOf(intent)) {
    case 'prevSection':
      dialMaPay(-1);
      return;
    case 'nextSection':
      dialMaPay(1);
      return;
    case 'nextTab':
      dialMaPay('max');
      return;
    case 'primary':
      submitMaFocusCommit();
      return;
    case 'back':
      closeMaPay();
      return;
    default:
      return;
    }
  }

  function dialMaPay(step: number | 'max'): void {
    const pay = maFocusState.pay;
    const unit = maPayFocusUnit.value;
    const lane = maPayLaneList.value.find((l) => l.unit === unit);
    if (pay === undefined || lane === undefined) {
      return;
    }
    setMaPayCount(lane.unit, dialMaPayLane(maPayCost.value, lane, maPayLaneList.value, pay.counts, step));
  }

  /** The committing beat may never hang: a commit with no verdict restores
   *  the reversible detail with an honest reason. */
  function armMaFocusSafety(): void {
    clearMaFocusSafety();
    cancelMaFocusSafety = flow.after(MA_COMMIT_SAFETY_MS, 'the MA commit\'s verdict (safety)', () => {
      cancelMaFocusSafety = () => {};
      if (maFocusState.phase === 'committing') {
        abandonMaCeremonyEmbed();
        disarmMaCeremony();
        dropMaVp('the claim never resolved');
        releaseMaPrice('the claim never resolved');
        failMaFocusCommit('Unavailable right now');
      }
    });
  }

  function clearMaFocusSafety(): void {
    cancelMaFocusSafety();
    cancelMaFocusSafety = () => {};
  }

  /**
   * The commit-outcome watcher body (pure decision: consoleMaFocus).
   * Runs on every playerView commit AND on every ceremony-queue change —
   * whichever arrives first (the queue is fed by NotificationLayer's own
   * update hook, so the two race benignly).
   */
  function evaluateMaFocusCommit(): void {
    if (maFocusState.phase !== 'committing') {
      return;
    }
    const committed = maFocusState.committedAt;
    if (committed === undefined) {
      return;
    }
    const models = maFocusState.kind === 'milestone' ? shell.game.milestones : shell.game.awards;
    const model = models.find((m) => m.name === maFocusState.name);
    const takenColor = model !== undefined && model.playerName !== undefined && model.playerName !== '' ?
      model.color : undefined;
    const outcome = maFocusCommitOutcome({
      committing: true,
      kind: maFocusState.kind,
      name: maFocusState.name,
      beat: maCurrentBeat.value,
      takenByViewer: takenColor !== undefined && takenColor === shell.thisPlayer.color,
      takenByOther: takenColor !== undefined && takenColor !== shell.thisPlayer.color,
      paymentPromptUp: shell.playerView.waitingFor?.type === 'payment',
      viewAdvanced: shell.game.gameAge !== committed.gameAge || shell.game.undoCount !== committed.undoCount,
    });
    switch (outcome.kind) {
    case 'wait':
      return;
    case 'ceremony':
      clearMaFocusSafety();
      if (maScreenKind.value === undefined || maFocusItem.value === undefined) {
        // The stage is gone (external teardown) — consume the claimed beat
        // deterministically; the board already shows the result.
        abandonMaCeremonyEmbed();
        resetMaFocus();
        return;
      }
      // PRICE, THEN CROWN (PL-1621): the price leaves its rows and is absorbed in the detail's printed price while
      // the detail still stands; the ceremony mounts on that absorb (at once when nothing was held — a free claim,
      // reduced motion, views that did not bear it out). Idempotent while it flies: every view re-asks.
      void flyMaPrice().then(() => {
        if (maFocusState.phase === 'committing') {
          beginMaFocusCeremony();
        }
      });
      return;
    case 'payment':
      // Helion / Stormcraft: the claim's own payment step needs the
      // standard payment surface — the workspace yields (today's exact
      // behaviour for this fork of the flow); the still-armed ceremony
      // then plays globally once the payment resolves.
      clearMaFocusSafety();
      releaseMaCeremonyEmbed();
      releaseMaPrice('the bill is asked on its own surface');
      resetMaFocus();
      leaveWorkspace();
      return;
    case 'refused': {
      clearMaFocusSafety();
      abandonMaCeremonyEmbed();
      disarmMaCeremony();
      dropMaVp('the claim was refused');
      releaseMaPrice('the claim was refused');
      const reason = outcome.cause === 'raced' ?
        (maFocusState.kind === 'milestone' ? 'Already claimed' : 'Already funded') :
        (maFocusBlockReason.value !== '' ? maFocusBlockReason.value : 'Unavailable right now');
      failMaFocusCommit(reason);
      return;
    }
    default:
      return;
    }
  }

  /**
   * The ceremony's OWN completion signal (the stage's timeline settled —
   * never a parallel timeout): consume the beat, close the workspace. The
   * screen's unmount hook performs the final state reset.
   */
  function onMaCeremonyDone(): void {
    if (maFocusState.phase !== 'ceremony') {
      return;
    }
    // THE POINTS LEAVE THE CEREMONY FIRST (TR55): the token is born on its «+5» and has left it before the
    // workspace lets go — the cell ticks at the touchdown, the surface never folds over a token still on it.
    void flyMaVp(maFocusState.kind).then(() => {
      if (maFocusState.phase !== 'ceremony') {
        return;
      }
      beginMaFocusClosing();
      abandonMaCeremonyEmbed();
      // A FINISHED flow LEAVES through the ONE guarded conclusion (`workspaceConclusionFor` — FB): the claim is
      // over, so the player lands on the board (the rail seals it), never back in the list. A HOSTED step (Vitor's
      // free sponsorship inside the start) pops one level — its host's flow goes on.
      const frame: WorkspaceFrameKind = workspaceFrameKnown('awards') ? 'awards' : 'milestones';
      if (workspaceFrameIndex(frame) > 0) {
        leaveWorkspace();
      } else {
        shell.concludeWorkspaceFlowOrOwe(frame);
      }
    });
  }

  /** The MA commit's verdict may arrive on either feed — the ceremony
   *  queue (fed by NotificationLayer's update) or the raw view values.
   *  Both watchers run the same pure decision; a no-op when not committing. */
  function whenMaCurrentBeatChanges(): void {
    evaluateMaFocusCommit();
  }

  /** WATCH `playerView.game.gameAge` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenPlayerViewGameGameAgeChanges(): void {
    evaluateMaFocusCommit();
  }

  /** WATCH `playerView.game.undoCount` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenPlayerViewGameUndoCountChanges(): void {
    evaluateMaFocusCommit();
  }

  return {
    awardNames,
    hudMilestoneZone,
    hudAwardZone,
    maScreenKind,
    maScreenItems,
    milestoneCostValue,
    awardCostValue,
    maScreenPriceWaiver,
    awardFundingActive,
    awardStepHosted,
    maFocusItem,
    maFocusView,
    maFocusInspect,
    maFocusAvailable,
    maFocusBlockReason,
    maFocusPayment,
    maBillNames,
    maPayLaneList,
    maPayCost,
    maPayView,
    maPayFocusUnit,
    maPayReady,
    maAwardSponsors,
    maCurrentBeat,
    maPriceWaiverOf: ownMaPriceWaiverOf,
    claimableTitles,
    buildMaItems,
    enterMaFocus,
    onMaPick,
    foldMaFocus,
    submitMaFocusCommit,
    handleMaPayIntent,
    dialMaPay,
    armMaFocusSafety,
    clearMaFocusSafety,
    evaluateMaFocusCommit,
    onMaCeremonyDone,
    whenMaCurrentBeatChanges,
    whenPlayerViewGameGameAgeChanges,
    whenPlayerViewGameUndoCountChanges,
  };
}

export type MaController = ReturnType<typeof createMaController>;

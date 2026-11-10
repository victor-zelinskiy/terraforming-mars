/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE HANDSELECT CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {computed, ref} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {DiscardPromptMeta, SelectCardModel} from '@/common/models/PlayerInputModel';
import {consoleCardActionsUi} from '@/client/console/consoleCardActions';
import {SubmitTicket} from '@/client/console/transport/gameTransport';
import ConsoleHandSection from '@/client/components/console/ConsoleHandSection.vue';
import {ConsoleHandEntry, ConsoleHandSelectMode, HandTransitionTargets} from '@/client/components/console/consoleHandSectionTypes';
import {deriveHandSelect, handSelectPicksValid, HandSelectDerivation} from '@/client/components/console/consoleHandSelectModel';
import {AlbumFilter, AlbumFilterOption, buildAlbumFilters, buildConsoleTagFilters, cycleTagFilter, hiddenByFilter} from '@/client/components/console/consoleHandFilter';
import {workspaceHostYieldsScene, leaveWorkspace, setWorkspaceFrameStage, workspaceFrameMounted, workspaceStackTop, workspaceFrameHost, workspaceFrameIsOverlay, workspaceFrameKnown, workspaceStackState, workspaceStepsEmbeddedIn} from '@/client/console/consoleWorkspaceStack';
import {armCardDiscard, cardDiscardColonyBonus, cardDiscardTransaction, isCardDiscardActive} from '@/client/console/cardDiscard/consoleCardDiscard';
import {colonyResolutionUi, noticeColonyResolutionDiscard} from '@/client/console/colonyTrade/colonyResolution';
import {discardPhaseInOverlay} from '@/client/console/cardDiscard/discardModel';
import {DiscardIntent, deriveDiscardIntent, discardMetaOf, discardPickedTags} from '@/client/console/cardDiscard/discardIntent';
import {handRevealState} from '@/client/console/handDock/handRevealState';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {finishInstant, isHandRevealEpisodeRunning, runHandFilterEpisode} from '@/client/console/handDock/handRevealDirector';
import {isPlayedHeroActive} from '@/client/console/played/consolePlayedHero';
import {resolutionZoomEntry} from '@/client/components/card/cardZoomTypes';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {taskFor} from '@/client/console/consoleTaskRouter';
import {ConsoleTaskSummary} from '@/client/console/consoleTaskSummary';
import {cardsResponse} from '@/client/console/taskResponses';
import {hydroFlowState, setHydroRepeatBridge} from '@/client/console/hydroFlow/consoleHydroFlow';
import {isPatentSaleActive} from '@/client/console/patentSale/consolePatentSale';
import {getCard} from '@/client/cards/ClientCardManifest';
import {consoleState, ConsoleSection} from '@/client/console/consoleRouter';
import {setPickSuppressed} from '@/client/console/surfaceMotion/surfaceMotionState';
import {consoleHandPickState, handPickArmsDiscardTray, resolveConsoleHandPick} from '@/client/console/consoleHandPick';
import {consoleRepeatPickState, cancelConsoleRepeatPick} from '@/client/console/consoleRepeatPick';
import {consolePlayPickState} from '@/client/console/consolePlayPick';
import {translateMessage, translateText} from '@/client/directives/i18n';
import type {RevealController} from '@/client/console/shell/revealController';
import type {ColonyController} from '@/client/console/shell/colonyController';
import type {MandatoryController} from '@/client/console/shell/mandatoryController';
import type {HydroController} from '@/client/console/shell/hydroController';
import type {RouterController} from '@/client/console/shell/routerController';
import type {PlayCardController} from '@/client/console/shell/playCardController';
import type {ParliamentController} from '@/client/console/shell/parliamentController';
import type {NoticeController} from '@/client/console/shell/noticeController';
import type {StagedController} from '@/client/console/shell/stagedController';
import type {SeatController} from '@/client/console/shell/seatController';

/**
 * THE FRESH-CARD FOCUS of the open hand pick has been given (2026-10-15): a question left for after a draw opens on the
 * card the draw brought — once per pick (the player's own cursor is never taken back). Plain module state: the watcher
 * that reads it is its only consumer.
 */
let freshPickFocusGiven = false;

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type HandSelectPort = {
  $nextTick(fn?: () => void): Promise<void>,
  $refs: Record<string, unknown>,
  readonly activeTaskSummary: ConsoleTaskSummary | undefined,
  closeHandWithReveal: UnwrapRef<RevealController['closeHandWithReveal']>,
  colonyEmbedSourceCard: UnwrapRef<ColonyController['colonyEmbedSourceCard']>,
  colonyEmbedSourceResolution: UnwrapRef<ColonyController['colonyEmbedSourceResolution']>,
  /** WRITTEN here. */ colonyFocusRestorePending: UnwrapRef<ColonyController['colonyFocusRestorePending']>,
  deferredDiscardFresh: UnwrapRef<MandatoryController['deferredDiscardFresh']>,
  readonly handAlbumPicker: boolean,
  handCoveredByHydro: UnwrapRef<HydroController['handCoveredByHydro']>,
  readonly handEntries: ReadonlyArray<ConsoleHandEntry>,
  readonly handEntriesAll: Array<ConsoleHandEntry>,
  readonly handModeEntries: ReadonlyArray<ConsoleHandEntry>,
  handPickDeferLive: UnwrapRef<MandatoryController['handPickDeferLive']>,
  leaveHandAfterAnswer(): void,
  openHandWithReveal: UnwrapRef<RevealController['openHandWithReveal']>,
  openShellTaskSurface: UnwrapRef<RouterController['openShellTaskSurface']>,
  /** WRITTEN here. */ pendingClientPick: UnwrapRef<PlayCardController['pendingClientPick']>,
  /** WRITTEN here. */ pendingPlayCard: UnwrapRef<PlayCardController['pendingPlayCard']>,
  playEmbedTarget: UnwrapRef<PlayCardController['playEmbedTarget']>,
  readonly playerView: PlayerViewModel,
  politicalDiscardOwed: UnwrapRef<ParliamentController['politicalDiscardOwed']>,
  restoreColonyFocusAfterDiscard: UnwrapRef<ColonyController['restoreColonyFocusAfterDiscard']>,
  revealVisualFor: UnwrapRef<RevealController['revealVisualFor']>,
  readonly sceneHandedOver: boolean,
  shellTask: UnwrapRef<RouterController['shellTask']>,
  showNotice: UnwrapRef<NoticeController['showNotice']>,
  stagedHandCard: UnwrapRef<StagedController['stagedHandCard']>,
  submit(response: unknown): SubmitTicket,
  taskAllSelected: UnwrapRef<RouterController['taskAllSelected']>,
  thisPlayer: UnwrapRef<SeatController['thisPlayer']>,
};

export function createHandSelectController(shell: HandSelectPort) {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * THE REPEAT-PICK ENTRY IS A CROSSFADE, NOT A BLINK. While the repeat
   * browser plays its `con-layer` enter, the surface it replaces (the
   * Viron composer / the hydro track / the play confirm) stays PAINTED
   * and fades out in place (`con-bridgefade`), so the swap reads as one
   * workspace advancing a stage — steady chrome, the header's root and
   * carried card overlapping their own text — instead of the band
   * dropping to the shade for the fade's whole duration and a whole new
   * plate redrawing over it. True only for the enter window: rising edge
   * of `repeatPickActive` → the repeat transition's after-enter (or its
   * cancel / the pick's own end, whichever comes first).
   */
  const repeatPickHandoff = ref(false);
  /* (`handPickReturn` is gone: the frame UNDER the pick's overlay hand IS
     the origin, so there is nothing to remember and nothing to restore.) */
  /**
   * The pick surface FROZEN at the moment a discard was answered. The client
   * hand-pick bridge resets itself as it resolves, but the cinematic still
   * has to lift the card out of that very grid — so the section keeps
   * rendering this snapshot until the scene hands off (phase 'leaving').
   */
  const discardFreeze = ref(undefined as ConsoleHandSelectMode | undefined);
  /** A phrased pick's last select look (kept while it stands) → frozen on the shelf while it leaves (`handSelectProps`). */
  const lastPickSelect = ref(undefined as ConsoleHandSelectMode | undefined);
  /** …held until the section's resume phrase is done (`pick-resumed`) — never browse decorations under the departure. */
  const pickResumeFreeze = ref(undefined as ConsoleHandSelectMode | undefined);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * A client pick bridge (hand / repeat-action) hides the owning composer
   * via v-show — the picked-in surface owns the screen, the shade yields.
   * (The TABLEAU bridge is gone: a played-card pick is now an EMBEDDED step
   * inside the workspace that asked, so nothing is hidden for it.)
   *
   * ⚠ THE ONE EXPRESSION. Every `v-show` that hides for a bridge binds to
   * THIS, and it is what `setPickSuppressed` publishes to surface-motion —
   * so the DOM flip and the director's «that leave was a bridge, not a
   * dismissal» verdict can never disagree. They did once, spelled out
   * separately: the director named only the hand pick, so the Viron repeat
   * pick's flip ran a real leave/enter pair and the action centre came back
   * as an empty frame (`surfaceMotionDirector.isPickBridgeHidden`).
   */
  const pickBridgeActive = computed((): boolean => {
    // …AND A SCENE HANDOVER IS ONE TOO. A host that gives its whole scene to
    // a nested full screen (`frameSteps: 'scene'`) is hidden exactly the way
    // a pick bridge hides its composer: the flow is untouched, the state is
    // untouched, the player is deeper inside the SAME workspace. Told
    // otherwise the director plays a real leave — which poses the surface
    // (`position: fixed`, `autoAlpha`) and leaves inline geometry behind —
    // and the entrance heals only the outermost panel, so the track came back
    // shifted and cropped with nothing to re-fit it. This is the ONE fact the
    // director reads; the alternative is a second list of bridges to forget.
    return handPickOverlays.value || repeatPickActive.value || shell.sceneHandedOver;
  });

  /**
   * The hand pick OVERLAYS its composer (the composer hides, the hand stands
   * over it) — every pick but a HOSTED one: the resolution action's
   * selection stands INSIDE the composer's own zone beside its hero, so the
   * workspace must stay on screen for the very step it hosts.
   */
  const handPickOverlays = computed((): boolean => {
    return handPickActive.value && consoleHandPickState.request?.hosted === undefined;
  });

  /**
   * THE PICK COVERS THE STEPS HOSTED IN ITS HAND — a hand pick stands on the hand's OWN shelf while a step of the
   * play is still standing INSIDE that hand (a played card's colony step finishing its build bonus — «Научная
   * колония» with «Марсианский университет» on the table, the field lock of 2026-10-14). Pausing the stage for the
   * pick (`--stagepaused`) hides exactly those steps, so the shelf is the surface ON TOP — while the stack's
   * projection still names the deepest frame. Read wherever «which surface do the presses belong to» is decided
   * (`padSection`), or the album stands on screen with every press routed into the hidden step.
   *
   * Not while a hydro frame covers the hand: that one is a sibling of the hand, not a step inside its stage.
   */
  const handPickCoversSteps = computed((): boolean => {
    return handPickOverlays.value && workspaceStepsEmbeddedIn('hand') && !shell.handCoveredByHydro;
  });

  /**
   * THE SECTION THE PAD DRIVES — the stack's projection (`consoleState.section`: the DEEPEST projecting frame),
   * except where a live hand pick covers the steps hosted in its hand (`handPickCoversSteps`): there the album is
   * the surface on top, and A / RT / LT / the d-pad / X / LB·RB / R3 are its verbs.
   */
  const padSection = computed((): ConsoleSection => {
    return handPickCoversSteps.value ? 'hand' : consoleState.section;
  });

  /**
   * THE PICK IS A PHRASE OF THE PLAY COMPOSER STANDING IN THIS VERY HAND (the owner's hard rule 2026-10-13 — a card
   * from the hand is chosen IN the hand, and the transition is the workspace's phrase, never a cut): a PRE-SELECT
   * (`leaving: 'none'`) of the composer embedded in the hand's stage pauses that stage and resumes it through the
   * section's own two phrases (`handStagePickPause` / `handStagePickResume`), so the composer stays MOUNTED and
   * visible to let go in place. The card being played is NOT in the album during its pick (2026-10-14, the owner's
   * Public Plans photo: «reveal any number of OTHER cards» — the rules never offer it, so it is not shown; it stays
   * the composer's hero, L3 inspects it as the SOURCE).
   */
  const handPickPhrased = computed((): boolean => {
    return handPickActive.value && consoleHandPickState.request?.leaving === 'none' && shell.playEmbedTarget !== undefined &&
      shell.pendingPlayCard !== undefined;
  });

  /** The discard cinematic owns the screen for its bounded beat — the same
   *  contract the played / tile heroes have. Without it the task host would
   *  re-mount the instant its nested pick resolved and paint the branch list
   *  back OVER the card that is still flying out of the hand. */
  const cardDiscardHolds = computed((): boolean => {
    const p = cardDiscardTransaction.phase;
    return cardDiscardTransaction.active && p !== 'idle' && p !== 'armed' && p !== 'failed';
  });

  /** The chosen cards are still lying in the pick surface (fixate / flip /
   *  gather): the hand recedes behind them and stays frozen. */
  const discardInOverlay = computed((): boolean => {
    return cardDiscardTransaction.active && discardPhaseInOverlay(cardDiscardTransaction.phase);
  });

  /** The candidates the picker's chip HIDES — «скрыто фильтром: N» beside the discard's exchange (never a silent cut). */
  const handHiddenByFilter = computed((): number => {
    if (!shell.handAlbumPicker || consoleState.selectTagFilter === 'all') {
      return 0;
    }
    const candidates = consoleState.sale.active ? shell.handModeEntries.map((e) => e.card.name) :
      shell.handModeEntries.map((e) => e.card.name).filter((name) => handSelectSelectableNames.value.includes(name));
    return hiddenByFilter(candidates, shell.handEntries.map((e) => e.card.name));
  });

  // ── mandatory hand SELECT (server `handSelect` task) ──────────────────
  /** The active mandatory hand-select prompt (all candidates in hand), or
   *  undefined. Derived from the shell-section task + the raw waitingFor. */
  const handSelectModel = computed((): SelectCardModel | undefined => {
    if (shell.shellTask?.kind !== 'handSelect') {
      return undefined;
    }
    const wf = shell.playerView.waitingFor;
    return wf?.type === 'card' ? (wf as SelectCardModel) : undefined;
  });

  /** True while the hand section is serving a mandatory hand-select. */
  const handSelectTaskActive = computed((): boolean => {
    return handSelectModel.value !== undefined;
  });

  // ── CLIENT hand pick (composer → hand bridge, consoleHandPick) ────────
  /** A composer (play confirm / blue-card action) handed a card pick to the
   *  hand section — the composer is hidden (v-show) and the hand owns input. */
  const handPickActive = computed((): boolean => {
    return consoleHandPickState.active;
  });

  /** A LAW'S PLAY PICK (RX36 Live Experiments): the law's stage handed «which card, and how» to the album + the
   *  play composer, hosted as a step of «Действия карт» (`consolePlayPick`). The asking stage stays mounted. */
  const playPickActive = computed((): boolean => {
    return consolePlayPickState.active;
  });

  /** A repeat-action source (ProjectInspection / Viron) handed the "pick an
   *  action to repeat" to the ДЕЙСТВИЯ КАРТ surface — the source composer is
   *  hidden (v-show) and `ConsoleCardActions` (repeat mode) owns input. */
  const repeatPickActive = computed((): boolean => {
    return consoleRepeatPickState.active;
  });

  /** The pick's own frame, as the STACK sees it — the witness that the step
   *  is still standing (see the guard watcher of the same name). */
  const repeatPickFrameLive = computed((): boolean => {
    return workspaceFrameKnown('repeat-pick');
  });

  /** The repeat browser handed its scene to a nested full-screen step (the
   *  hydro reward / landing pick standing on its frame) — it stops being
   *  drawn while its state waits underneath (the same self-hide the hydro
   *  host plays for its own scene guests). */
  const repeatPickSceneOut = computed((): boolean => {
    return workspaceHostYieldsScene('repeat-pick');
  });

  /** The hand section is in EITHER select mode — the server `handSelect`
   *  task OR a client composer pick. One UI, two sources. */
  const handSelectUiActive = computed((): boolean => {
    return handSelectTaskActive.value || handPickActive.value;
  });

  /**
   * Where the card the DRAW JUST BROUGHT stands among the open pick's entries (-1 = none yet): the album opens while
   * the intake still holds the view, so the newcomer joins the entries a beat AFTER the pick stood up — the watcher
   * below moves the cursor onto it then (2026-10-15).
   */
  const freshPickFocusAt = computed((): number => {
    if (!handSelectUiActive.value || shell.deferredDiscardFresh.length === 0) {
      return -1;
    }
    const fresh = new Set(shell.deferredDiscardFresh);
    const selectable = new Set(handSelectSelectableNames.value);
    return shell.handEntries.findIndex((e) => fresh.has(e.card.name) && selectable.has(e.card.name));
  });

  /** The «suitable only» filter of whichever select source is active. */
  const handSelectSuitableOnly = computed((): boolean => {
    return handPickActive.value ? consoleHandPickState.suitableOnly : consoleState.select.suitableOnly;
  });

  /** The live pick accumulation of whichever select source is active. */
  const handSelectPicked = computed((): ReadonlyArray<string> => {
    return handPickActive.value ? consoleHandPickState.selected : consoleState.select.selected;
  });

  /**
   * RT IS THE DECLINE of the open pick right now: an optional pick (`request.decline`) that is a single pick, or a
   * multi pick with nothing picked yet — from the first pick on RT confirms the set (`confirmHandSelect`), and the
   * question line's plate steps aside with it. Never while a discard cinematic is playing.
   */
  const handPickDeclineLive = computed((): boolean => {
    return handPickActive.value && consoleHandPickState.request?.decline !== undefined && !isCardDiscardActive() &&
      (handSelectSingle.value || consoleHandPickState.selected.length === 0);
  });

  /** The A-verb of whichever select source is active (server buttonLabel /
   *  the pick request's verb — 'Discard' / 'Reveal' / 'Link card' / …). */
  const handSelectVerb = computed((): string => {
    if (handPickActive.value) {
      return consoleHandPickState.request?.buttonLabel || 'Select';
    }
    return handSelectModel.value?.buttonLabel || 'Select';
  });

  /** Multi pick: every candidate (up to `max`) is already selected — L3 flips
   *  between select-all and unselect-all. */
  const pickAllSelected = computed((): boolean => {
    const req = consoleHandPickState.request;
    if (req === undefined) {
      return false;
    }
    const target = Math.min(req.selectable.length, req.max);
    return target > 0 && consoleHandPickState.selected.length >= target;
  });

  /** PURE derivation of the select facts (pickable set / single-vs-multi /
   *  conditional-subset / per-card «why not» reasons) — the i18n of a
   *  disabledReason is injected so the derivation module stays locale-free. */
  const handSelectDerived = computed((): HandSelectDerivation | undefined => {
    // CLIENT composer pick: the request already carries the candidate set +
    // the server's per-card reasons (disabledCards); every OTHER shown hand
    // card gets the honest generic line — same shape as the server path.
    const pick = consoleHandPickState.request;
    if (handPickActive.value && pick !== undefined) {
      const handNames = handPickHandNames.value;
      const selectableSet = new Set<string>(pick.selectable);
      const reasons: Record<string, string> = {};
      for (const [name, reason] of Object.entries(pick.reasons)) {
        reasons[name] = reason !== '' ? reason : translateText('This card cannot be chosen here');
      }
      for (const name of handNames) {
        if (!selectableSet.has(name) && reasons[name] === undefined) {
          reasons[name] = translateText('This card cannot be chosen here');
        }
      }
      return {
        selectable: pick.selectable,
        single: pick.min === 1 && pick.max === 1,
        filtered: pick.selectable.length < handNames.length,
        reasons,
      };
    }
    const model = handSelectModel.value;
    if (model === undefined) {
      return undefined;
    }
    const handNames = shell.handEntriesAll.map((e) => e.card.name);
    const translateReason = (r: string | Message | undefined): string =>
      r === undefined ? translateText('This card cannot be chosen here') :
        (typeof r === 'string' ? translateText(r) : translateMessage(r));
    return deriveHandSelect(model, handNames, translateReason);
  });

  /** The hand shown during a CLIENT pick: the real hand WITHOUT the card
   *  staged in the play composer (it is being played — visually lifted out)
   *  and without SRR-hosted cards (they are not "in hand" for the prompt). */
  const handPickHandNames = computed((): ReadonlyArray<string> => {
    return shell.handEntriesAll
      .filter((e) => !e.robot && e.card.name !== shell.stagedHandCard)
      .map((e) => e.card.name);
  });

  /** The candidate (pickable) card names of the current hand-select. */
  const handSelectSelectableNames = computed((): ReadonlyArray<string> => {
    return handSelectDerived.value?.selectable ?? [];
  });

  /** The prompt is a CONDITIONAL subset of the hand (there ARE non-pickable
   *  hand cards) — only then is the "suitable only" filter meaningful. */
  const handSelectFiltered = computed((): boolean => {
    return handSelectDerived.value?.filtered ?? false;
  });

  /** min===max===1 → A submits the focused card in one press (no toggle). */
  const handSelectSingle = computed((): boolean => {
    return handSelectDerived.value?.single ?? false;
  });

  /** The CARD that sent the player to this pick, when there is one — the
   *  source of a contextual selection flow (a decision screen's hand pick, a
   *  composer's target pick). Drives the L3 verb and its command hint. */
  /** A LAW is the source of the contextual step (the colonies the sitting hosts whole) — beside `contextualSourceCard`. */
  const contextualSourceResolution = computed((): string | undefined => {
    return workspaceFrameHost('colonies') !== undefined && !handPickCoversSteps.value ? shell.colonyEmbedSourceResolution : undefined;
  });

  /** L3 «Источник» has something to open. */
  const contextualSourceKnown = computed((): boolean => {
    return contextualSourceCard.value !== undefined || contextualSourceResolution.value !== undefined;
  });

  const contextualSourceCard = computed((): CardName | undefined => {
    // A colony step OWED BY A CARD (played card / activation / prelude):
    // the pick and its follow-up present inside that card's workspace, so
    // L3 = the source — the console-wide inspection grammar (X inspects
    // the current object, L3 the card that produced it). Standalone
    // colonies (the player walked in) have no source and no L3.
    // …unless a hand pick COVERS that step (`handPickCoversSteps`): the album on screen is the pick's, and its
    // source is the card that asked it (Mars University), never the colony's.
    if (workspaceFrameHost('colonies') !== undefined && !handPickCoversSteps.value) {
      return shell.colonyEmbedSourceCard;
    }
    if (padSection.value !== 'hand') {
      return undefined;
    }
    // The CLIENT bridge: a decision screen / composer sent the player here.
    if (handPickActive.value) {
      return consoleHandPickState.request?.source?.card;
    }
    // The SERVER's own MANDATORY hand pick (a discard / reveal / place a card
    // demanded by an effect). The prompt names its source structurally
    // (`discardPrompt.source` / `choiceContext`) and the footer below already
    // advertised «L3 Источник» for this branch — but the two flags are
    // mutually exclusive, so it could never resolve a card and the verb was
    // unreachable. This is the ONE prompt family that most needs it: the
    // player is being made to throw a card away by something they may not
    // have played themselves.
    if (handSelectTaskActive.value) {
      return shell.activeTaskSummary?.sourceCard;
    }
    return undefined;
  });

  /** Per-card reason (pre-translated) for a NON-selectable hand card. */
  const handSelectReasons = computed((): Record<string, string> => {
    return handSelectDerived.value?.reasons ?? {};
  });

  /**
   * ── THE ONE DISCARD ENTRY POINT ──────────────────────────────────────
   * The server marks EVERY "throw cards away" prompt structurally
   * (`discardPrompt`), and both surfaces that can serve the pick — the
   * mandatory `handSelect` task and the client hand-pick bridge (a discard
   * nested in an OrOptions branch, e.g. Mars University) — feed that SAME
   * marker into one derivation. Copy, verb, accent and the leaving
   * animation therefore cannot diverge between cases; there is no
   * per-card discard flow left to keep in sync.
   */
  const discardMeta = computed((): DiscardPromptMeta | undefined => {
    if (handPickActive.value) {
      return consoleHandPickState.request?.discard;
    }
    const live = discardMetaOf(handSelectModel.value);
    // A CLIENT bridge pick resets itself the moment it resolves, but the
    // cinematic has not seized the card yet — keep the surface exactly as the
    // player left it until it hands off (see `discardFreeze`).
    return live ?? (cardDiscardHolds.value ? discardFreeze.value?.discard : undefined);
  });

  /** The presentation of the active discard (undefined = not a discard). */
  const discardIntent = computed((): DiscardIntent | undefined => {
    const meta = discardMeta.value;
    if (meta === undefined) {
      return undefined;
    }
    // A per-TAG payout (the Reds' recycle) counts the picked cards' tags — the card manifest knows them.
    const pickedTags = handSelectPicked.value.map((name) => getCard(name as CardName)?.tags ?? []);
    return deriveDiscardIntent(meta, handSelectPicked.value.length, discardPickedTags(meta, pickedTags));
  });

  /** The bundled select-mode state handed to the hand section (undefined when
   *  not in a hand-select). */
  const handSelectProps = computed((): ConsoleHandSelectMode | undefined => {
    const d = handSelectDerived.value;
    if (d === undefined) {
      // Frozen discard surface (see `discardFreeze`): the answer is delivered
      // and the bridge is gone, but the card is still being lifted out of
      // this very grid. Reverting to browse mode here would flash tag filters
      // and an unrelated «Нельзя разыграть» verdict under the flying card.
      // …and the same for a PICK the composer's question just answered (or B'd out of): the shelf is LEAVING around
      // the card flying back up to the play, and a leaving surface keeps its last look — never browse decorations
      // (play rings, requirement chips, «Можно разыграть») flashing in under the departure.
      return cardDiscardHolds.value ? discardFreeze.value : pickResumeFreeze.value;
    }
    const pick = handPickActive.value ? consoleHandPickState.request : undefined;
    const gain = pick?.gainPerCard;
    return {
      active: true,
      selectable: d.selectable,
      // Spread so the computed re-runs (and hands the section a fresh prop)
      // on every pick mutation — the section re-renders the pick bands.
      selected: [...handSelectPicked.value],
      reasons: d.reasons,
      single: d.single,
      filtered: d.filtered,
      suitableOnly: handSelectSuitableOnly.value,
      // The honest «из Y» for the pick's shown-hand universe (the section's
      // own total would count the staged / SRR-hosted cards the pick hides).
      total: pick !== undefined ? handPickHandNames.value.length : undefined,
      // Live payout summary (Public Plans: +1 M€ per revealed card).
      payout: gain !== undefined ? {
        icon: gain.icon,
        amount: gain.amount,
        current: (shell.thisPlayer as unknown as Record<string, number>)[gain.icon],
        cards: gain.cards,
      } : undefined,
      // The source-operation chip (a composer's target pick names WHY).
      context: pick?.source !== undefined ? {kicker: pick.source.kicker, card: pick.source.card} : undefined,
      // THE DISCARD SKIN. Derived from the ONE server marker, whichever
      // source is serving the pick — so Mars University, a Pluto colony
      // bonus and a global event all read the same.
      discard: discardIntent.value,
      // THE DECLINE of an optional pick — its plate in the question line (RT answers it). A MULTI pick declines
      // only while nothing is picked: from the first pick on RT confirms the set, and the plate steps aside.
      decline: handPickDeclineLive.value ? pick?.decline : undefined,
      // …«decide after the draw» of a table question that may wait (R3 — its plate beside the decline's, 2026-10-15)…
      defer: shell.handPickDeferLive ? pick?.defer : undefined,
      // …and the cards the draw brought, in the live album of a question left for after it.
      fresh: shell.deferredDiscardFresh.length > 0 ? [...shell.deferredDiscardFresh] : undefined,
    };
  });

  /** The current multi-select picks satisfy the prompt bounds → RT confirms. */
  const ownHandSelectPicksValid = computed((): boolean => {
    const pick = consoleHandPickState.request;
    if (handPickActive.value && pick !== undefined) {
      return handSelectPicksValid(pick, consoleHandPickState.selected.length);
    }
    const model = handSelectModel.value;
    return model !== undefined && handSelectPicksValid(model, consoleState.select.selected.length);
  });

  // The tag-filter options for the panel (All + tags present in the hand).
  const handTagFilterOptions = computed((): Array<AlbumFilterOption> => {
    if (shell.handAlbumPicker) {
      // A PICKER's chips count the mode's own set (the candidates a «suitable only» left), with «ПЛАТЯТ» for a
      // per-tag exchange (the Reds) — read off the marker.
      return buildAlbumFilters(shell.handModeEntries.map((e) => e.card), consoleState.selectTagFilter, discardMeta.value?.exchange);
    }
    return buildConsoleTagFilters(shell.handEntriesAll.map((e) => e.card), consoleState.handTagFilter);
  });

  /** The chip the row lights — the picker's own, else the browse tag. */
  const handActiveFilter = computed((): AlbumFilter => {
    return shell.handAlbumPicker ? consoleState.selectTagFilter : consoleState.handTagFilter;
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** Land the cursor on the first pickable card of a hand select. */
  function focusFirstSelectableHandCard(): void {
    freshPickFocusGiven = false;
    consoleState.handIndex = firstPickFocusIndex();
  }

  /**
   * Where a hand pick OPENS: on the card the draw just brought when the player LEFT THE QUESTION FOR AFTER IT
   * (2026-10-15 — the card they waited for, usually the last of the hand, on a page the album would not open on);
   * else on the first pickable card.
   */
  function firstPickFocusIndex(): number {
    const selectable = new Set(handSelectSelectableNames.value);
    const fresh = new Set(shell.deferredDiscardFresh);
    const freshAt = shell.handEntries.findIndex((e) => fresh.has(e.card.name) && selectable.has(e.card.name));
    if (freshAt !== -1) {
      return freshAt;
    }
    const idx = shell.handEntries.findIndex((e) => selectable.has(e.card.name));
    return idx !== -1 ? idx : 0;
  }

  /**
   * THE DISCARD HAND-OFF (phase D), registered with the discard transaction.
   *
   * It is deliberately the ORDINARY close: the unchosen cards gather back
   * into the dock through the exact episode any other close plays, with the
   * discarded names filtered out. Nothing about the close is duplicated for
   * this case — the only discard-specific part is the exclusion set and the
   * clean-up of the frozen surface once the hand is gone.
   */
  async function handOffHandForDiscard(discarded: ReadonlySet<CardName>): Promise<void> {
    if (consoleState.section !== 'hand') {
      // ⚠️ THE EARLY RETURN MUST NOT TAKE THE RELEASE WITH IT. This site is
      // the ordinary end of a colony-bonus discard, and it also happens to be
      // the only thing that used to hand the room back; a response that had
      // already projected the section away therefore stranded the whole
      // resolution (see `colonyDiscardStageStranded`, which is the standing
      // guarantee — this is just the direct path).
      if (colonyResolutionUi.discardStage) {
        void shell.restoreColonyFocusAfterDiscard();
      }
      return;
    }
    // A COLONY-BONUS discard returns to the colony's focus — arm the
    // restore BEFORE the gather, so a track commit landing mid-flight is
    // already deferred to the restored stage.
    const colonyReturn = cardDiscardColonyBonus() !== undefined &&
      workspaceFrameHost('hand') === 'colonies';
    if (colonyReturn) {
      shell.colonyFocusRestorePending = true;
    }
    await shell.closeHandWithReveal(discarded);
    // The episode already sent the cards home; clear what the pick left
    // behind so the next surface starts from a clean state.
    consoleState.select.selected = [];
    consoleState.select.suitableOnly = true;
    shell.leaveHandAfterAnswer();
    discardFreeze.value = undefined;
    if (colonyReturn) {
      void shell.restoreColonyFocusAfterDiscard();
    }
  }

  /** B on the repeat-pick grid → cancel the whole repeat pick (return to the
   *  source composer with the OLD choice kept). */
  function onRepeatPickClose(): void {
    cancelConsoleRepeatPick();
  }

  /** The repeat browser's enter settled (or was cancelled) — the crossfade
   *  window closes and the replaced surface may go `display:none` under the
   *  now-opaque plate (it is already at opacity 0 via `con-bridgefade`). */
  function onRepeatPickEntered(): void {
    repeatPickHandoff.value = false;
  }

  /** The hand stands only because a pick stood it up over the board (its own root frame, an overlay). */
  function handPickStandsAlone(): boolean {
    const root = workspaceStackState.frames[0];
    return workspaceStackState.frames.length === 1 && root?.kind === 'hand' && root.overlay;
  }

  /** LT/RT: cycle the hand tag filter; R3: reset it to "All". Both preserve
   *  the selected card when it survives the new filter, else keep the
   *  nearest logical slot (never a jump to a random first page). */
  /** A on the focused chip (FD): the browse tag or the picker's own chip changes — the same physical re-pagination. */
  function applyFocusedFilterChip(): void {
    const option = handTagFilterOptions.value[consoleState.filterFocus];
    consoleState.filterFocus = -1;
    if (option === undefined) {
      return;
    }
    const picker = shell.handAlbumPicker;
    if ((picker ? consoleState.selectTagFilter : consoleState.handTagFilter) === option.value) {
      return;
    }
    applyHandFilterChange(() => {
      if (picker) {
        consoleState.selectTagFilter = option.value;
      } else if (option.value !== 'pays') {
        consoleState.handTagFilter = option.value;
      }
    });
    if (picker && shell.handEntries.length > 0) {
      // The cursor lands on the first card the chip left (the pick's own first choosable one when it has one).
      consoleState.handIndex = firstPickFocusIndex();
    }
  }

  function cycleHandFilter(dir: 1 | -1): void {
    applyHandFilterChange(() => {
      // The BROWSE ring (LT/RT) — the hand's own tag chips, never a picker's «ПЛАТЯТ» (FD).
      const options = buildConsoleTagFilters(shell.handEntriesAll.map((e) => e.card), consoleState.handTagFilter);
      consoleState.handTagFilter = cycleTagFilter(options, consoleState.handTagFilter, dir);
    });
  }

  function resetHandFilter(): void {
    if (consoleState.handTagFilter === 'all') {
      return;
    }
    applyHandFilterChange(() => {
      consoleState.handTagFilter = 'all';
    });
  }

  /**
   * Apply a tag-filter mutation as a PHYSICAL transition (the cards are
   * objects in the player's album, they never blink): measure the OLD slot
   * rects BEFORE the change, apply it (entries recompute synchronously —
   * the director's state writes ride the SAME patch flush, so nothing
   * flashes), then hand the episode to `runHandFilterEpisode`. In the
   * ALBUM model a filter is a RE-PAGINATION: leavers gather into the edge
   * PACKETS (never back into the dock — the dock stays empty for the whole
   * open hand), enterers glide out of those packets, survivors glide to
   * their re-planned slots. Rapid re-filtering stays responsive: a
   * still-running episode is SNAPPED to its end state first (never queued).
   * Falls back to the plain instant switch outside the browsable open hand
   * (sale never reaches here; staged-card / reduced-motion / unmounted
   * refs degrade the same way).
   */
  function applyHandFilterChange(apply: () => void): void {
    const selectedName = shell.handEntries[consoleState.handIndex]?.card.name;
    if (isHandRevealEpisodeRunning()) {
      // Re-filter mid-glide (or mid-open): snap the running episode to its
      // end state, then answer the new input from settled geometry.
      finishInstant();
    }
    const section = (shell.$refs.handSection ?? undefined) as InstanceType<typeof ConsoleHandSection> | undefined;
    // During a CLIENT hand pick the staged (being-played) card is EXCLUDED
    // from the entries, so the episode is safe to run under it — that's how
    // the pick's «suitable only» toggle gets the same physical transition
    // as the tag filter.
    const canAnimate = consoleState.section === 'hand' &&
      handRevealState.phase === 'open' && !isHandRevealEpisodeRunning() &&
      (shell.stagedHandCard === undefined || handPickActive.value) &&
      section !== undefined;
    if (!canAnimate) {
      apply();
      refocusAfterFilter(selectedName);
      return;
    }
    const before: HandTransitionTargets = section.transitionTargets();
    apply();
    refocusAfterFilter(selectedName);
    const newNames = shell.handEntries.map((e) => e.card.name);
    // The ENTERERS never had an album slot under the old filter, so their
    // art has never mounted: warm it before their proxies glide out of the
    // packets, or they fly a black art window (see openHandWithReveal).
    // Already-warm URLs are a memory-cache no-op.
    const seen = new Set(before.pairs.map((p) => p.name));
    preloadPremiumCardArt(newNames.filter((n) => !seen.has(n)));
    const newSet = new Set<string>(newNames);
    // A card parked in the packets that STAYS out of view takes no part in
    // the episode (no proxy at all): a packet→packet flight would paint a
    // phantom card at the stage edge. Kept pairs: everything visible before,
    // plus a parked card ENTERING the view (it glides in from its packet).
    const beforePairs = before.pairs.filter((p) => p.visible || newSet.has(p.name));
    const involved = new Set<string>([...beforePairs.map((p) => p.name), ...newNames]);
    // Leaver landings + enterer origins = the right-edge PACKET anchors —
    // the same conceptual place the open/close flights park the out-of-view
    // universe, so a filtered-out card always exits toward where it lives.
    const packetHomes = section.packetHomeRects([...involved]);
    void runHandFilterEpisode({
      before: beforePairs.map((p) => ({name: p.name, rect: p.rect, visible: p.visible, clip: p.clip})),
      dock: packetHomes,
      newNames,
      measureAfter: () => {
        // The album derives its page from the refocused index — the patch
        // has already flushed, so the measured targets are the settled
        // post-filter geometry.
        section.ensureSelectedVisible();
        return (section.transitionTargets() as HandTransitionTargets).pairs.map((p) => ({name: p.name, rect: p.rect, visible: p.visible, clip: p.clip}));
      },
      visualFor: (name) => shell.revealVisualFor(name),
    });
  }

  function refocusAfterFilter(selectedName: CardName | undefined): void {
    const list = shell.handEntries; // recomputed for the new filter
    const at = selectedName !== undefined ? list.findIndex((e) => e.card.name === selectedName) : -1;
    // The focused card survives the filter → follow it (its page opens by
    // derivation). Gone → the NEAREST LOGICAL slot: the same index clamped,
    // never a reset to the first page (the player keeps their place).
    consoleState.handIndex = at >= 0 ? at :
      Math.min(Math.max(0, consoleState.handIndex), Math.max(0, list.length - 1));
    const hand = (shell.$refs.handSection ?? undefined) as InstanceType<typeof ConsoleHandSection> | undefined;
    void shell.$nextTick(() => hand?.ensureSelectedVisible());
  }

  // ── hand SELECT (server `handSelect` task OR a client composer pick) ──
  /** A on a hand card in select mode: submit/resolve (single-pick) / toggle
   *  (multi), or explain WHY a non-candidate can't be chosen (never a mute A). */
  function handSelectPress(name: string): void {
    if (!handSelectUiActive.value) {
      return;
    }
    // The answer is already on its way and the cards are being seized — a
    // second A press must not submit twice.
    if (isCardDiscardActive()) {
      return;
    }
    if (!handSelectSelectableNames.value.includes(name)) {
      const reason = handSelectReasons.value[name];
      shell.showNotice(reason !== undefined && reason !== '' ? reason : translateText('This card cannot be chosen here'));
      return;
    }
    if (handSelectSingle.value) {
      // Single-card pick: A answers it in one press (no toggle-then-confirm).
      handSelectExecuteSingle(name);
      return;
    }
    toggleHandSelectPick(name);
  }

  /** The single-pick answer of whichever select source is active: a client
   *  pick RESOLVES back to its composer; the server task SUBMITS. */
  function handSelectExecuteSingle(name: string): void {
    if (isCardDiscardActive()) {
      return; // the answer is already in flight (fullscreen A / double press)
    }
    if (handPickActive.value) {
      // A client pick leaves through the tray only when it LEAVES at all — a
      // sale's terminal takes its cards, a composer's PRE-SELECT keeps them
      // in the hand until its commit (`handPickArmsDiscardTray`).
      if (handPickArmsDiscardTray(consoleHandPickState.request)) {
        armDiscardScene([name as CardName]);
      }
      resolveConsoleHandPick([name as CardName]);
      return;
    }
    armDiscardScene([name as CardName]);
    submitHandSelect([name]);
  }

  /**
   * THE ONE ARM POINT of the discard cinematic. Both answer paths (the
   * mandatory task's submit and the client bridge's resolve) call it
   * SYNCHRONOUSLY before delivering, so the launch rects are captured while
   * the pick surface is still on screen — a commit can unmount it three
   * frames later. A non-discard pick, or a legal empty pick, arms nothing.
   * `preselected` — a card action's discard answered in its composer BEFORE the press (P68): the marker is the
   * step's own, no pick surface stands (the cards leave from the dock), so there is nothing to freeze.
   */
  function armDiscardScene(names: ReadonlyArray<CardName>, preselected?: DiscardPromptMeta): void {
    const meta = preselected ?? discardMeta.value;
    if (meta === undefined || names.length === 0) {
      return;
    }
    // The surface as it looks RIGHT NOW — replayed while the scene seizes.
    if (preselected === undefined) {
      discardFreeze.value = handSelectProps.value;
    }
    armCardDiscard({
      names,
      meta,
      // A pre-selected discard leaves from the DOCK and hands no pick surface off (P86 — the play composer that
      // pre-selected it stands in the hand workspace, and the ordinary close would fold it under the play).
      fromDock: preselected !== undefined,
      // BOTH the live element AND a rect snapshot, always: the element is
      // re-measured if it is still connected when the proxies spawn, and the
      // snapshot carries the flight when the surface unmounted in between (a
      // commit can tear the hand down three frames before the spawn). Without
      // the snapshot the card would silently skip its flight.
      sources: names.map((name) => {
        const el = discardSourceElement(name, preselected !== undefined);
        return {name, el, rect: discardSourceRect(el)};
      }),
    });
  }

  /** The live element the card takes off from: its slot in the open hand
   *  grid, else the fullscreen inspector holding it (A can be pressed from
   *  the zoom), else its BODY in the hand dock (`data-hand-dock-card` — the berth
   *  anchor every intake director targets): a card action's PRE-SELECTED discard
   *  (P68) leaves at the commit, with no album standing. */
  function discardSourceElement(name: CardName, fromDock = false): HTMLElement | undefined {
    // A PRE-SELECTED discard (P68 / P86) leaves from where the card stands at the press — its body in the dock; an
    // album slot parked behind the composer's stage is not where the player sees it.
    const body = document.querySelector<HTMLElement>(`.con-handbody[data-hand-dock-card="${name}"]`) ?? undefined;
    if (fromDock && body !== undefined && body.getBoundingClientRect().width > 10) {
      return body;
    }
    const slot = document.querySelector<HTMLElement>(`.con-hand__slot[data-zoom-slot="${name}"]`);
    if (slot !== null) {
      return slot;
    }
    const zoomed = document.querySelector<HTMLElement>(`.con-zoom [data-zoom-slot="${name}"]`);
    return zoomed ?? document.querySelector<HTMLElement>(`.con-handbody[data-hand-dock-card="${name}"]`) ?? undefined;
  }

  /** The launch rect captured NOW: the live element's own box (a slot, the
   *  zoom, the dock body) — so a flight always starts from where the player
   *  last saw the card, never from the viewport origin; none → no flight. */
  function discardSourceRect(el: HTMLElement | undefined): {left: number, top: number, width: number, height: number} | undefined {
    if (el !== undefined) {
      const card = el.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? el;
      const r = card.getBoundingClientRect();
      if (r.width > 10 && r.height > 10) {
        return {left: r.left, top: r.top, width: r.width, height: r.height};
      }
    }
    return undefined;
  }

  /** L3 — open the effect's SOURCE in the ordinary fullscreen viewer. The
   *  overlay, its scroll, the focused card and the pick all stay exactly as
   *  they are underneath: the viewer owns nothing but itself. */
  function inspectContextualSource(): void {
    const name = contextualSourceCard.value;
    if (name === undefined) {
      const law = contextualSourceResolution.value;
      if (law !== undefined) {
        openConsoleCardZoom([resolutionZoomEntry(law)], 0, undefined, undefined, {statusLabel: 'Source'});
      }
      return;
    }
    // The viewer NAMES its role — console-wide inspection grammar: X reads
    // the current object, L3 reads the source that produced it. One verb for
    // every host (the colony step used to carry a second copy of this).
    // A LAW that asked (the resolution action's pick) opens its own inspector.
    const resolution = handPickActive.value ? consoleHandPickState.request?.source?.resolution : undefined;
    openConsoleCardZoom(resolution !== undefined ? [resolutionZoomEntry(resolution)] : [{name}], 0, undefined, undefined, {statusLabel: 'Source'});
  }

  /** Multi-select toggle (respects `max` — a full set ignores a new pick). */
  function toggleHandSelectPick(name: string): void {
    const pickMode = handPickActive.value;
    const picked = pickMode ? consoleHandPickState.selected : consoleState.select.selected;
    const max = pickMode ? (consoleHandPickState.request?.max ?? 1) : (handSelectModel.value?.max ?? 1);
    const at = picked.indexOf(name as CardName);
    if (at !== -1) {
      picked.splice(at, 1);
      return;
    }
    if (picked.length >= max) {
      return;
    }
    picked.push(name as CardName);
  }

  /** R3 in a multi client pick: select every candidate (bounded by `max`),
   *  or clear the whole selection when it is already complete. */
  function togglePickSelectAll(): void {
    const req = consoleHandPickState.request;
    if (req === undefined) {
      return;
    }
    consoleHandPickState.selected = pickAllSelected.value ?
      [] :
      [...req.selectable.slice(0, req.max)];
  }

  /** R3 on a live multi select that offers it (`showSelectAll`): every candidate (bounded by `max`), or clear. */
  function toggleSelectAllTask(): void {
    const model = handSelectModel.value;
    if (model === undefined) {
      return;
    }
    consoleState.select.selected = shell.taskAllSelected ?
      [] :
      [...handSelectSelectableNames.value.slice(0, model.max)];
  }

  /** RT / confirm: deliver the accumulated multi-select picks (bounds-checked).
   *  A client pick resolves to its composer; the server task submits. */
  function confirmHandSelect(): void {
    if (isCardDiscardActive()) {
      return; // the answer is already in flight — never submit a set twice
    }
    if (handPickActive.value) {
      const req = consoleHandPickState.request;
      const picked = consoleHandPickState.selected;
      if (req === undefined || picked.length < req.min || picked.length > req.max) {
        return;
      }
      // A pick that leaves through the trade terminal (the resolution action's
      // sale) arms the sale's own scene in its resolve — the discard tray's
      // scene would fight it over the same cards; a PRE-SELECT leaves nothing.
      if (handPickArmsDiscardTray(req)) {
        armDiscardScene([...picked]);
      }
      resolveConsoleHandPick([...picked]);
      return;
    }
    const model = handSelectModel.value;
    if (model === undefined) {
      return;
    }
    const picked = consoleState.select.selected;
    if (picked.length < model.min || picked.length > model.max) {
      return;
    }
    // A MULTI discard leaves through the same cinematic as a single one (the Reds' «any number»): armed here,
    // synchronously, while the picked cards still stand in the album — the single path's `handSelectExecuteSingle` does
    // the same. A non-discard pick, or a legal empty pick, arms nothing.
    armDiscardScene([...picked] as ReadonlyArray<CardName>);
    submitHandSelect([...picked]);
  }

  /** Submit the mandatory hand-select answer. The TOP-LEVEL SelectCard takes
   *  the BARE {type:'card', cards} (no OR wrapping) — byte-identical to the
   *  desktop hand-select overlay's `onHandSelect`. */
  function submitHandSelect(cards: ReadonlyArray<string>): void {
    // A PARTY'S DISCARD owed to the action workspace (the Reds): the transport takes the prompt DOWN at this submit,
    // and the prompt change would let the voluntary action centre leave before the answer — the one that seeds the
    // payout its plaque flies. The await is armed HERE, before anything moves (`payoutOwed`; the workspace pays and
    // leaves when the next view lands).
    if (shell.politicalDiscardOwed) {
      consoleCardActionsUi.payoutAwaitedAge = shell.playerView.game.gameAge;
      consoleCardActionsUi.payoutAwaited = true;
    }
    consoleState.select.selected = [];
    consoleState.select.suitableOnly = true;
    // A DISCARD keeps the hand open: the cinematic seizes the cards out of
    // the real grid first and hands the surface off itself (phase 'leaving'),
    // so the player watches the card leave the hand instead of the hand
    // vanishing and the card silently ceasing to exist. Every other pick
    // closes immediately, exactly as before.
    if (!isCardDiscardActive()) {
      shell.leaveHandAfterAnswer();
    }
    shell.submit(cardsResponse(cards as ReadonlyArray<CardName>));
  }

  /** The discard cinematic's hand-off: the hand section closes (the surviving
   *  cards fly home to the dock) while the condemned ones keep flying on the
   *  app-level stage. Driven by the scene's phase, never by a timer. */
  function closeSurfaceForDiscard(): void {
    consoleState.select.selected = [];
    consoleState.select.suitableOnly = true;
    shell.leaveHandAfterAnswer();
  }

  /** LT: flip the "suitable only" filter (candidates-only ↔ the whole hand)
   *  as the SAME physical card transition the tag filter plays (leavers
   *  gather into the dock, enterers fan out, survivors glide) — the focus
   *  stays on the surviving card, else lands on the first one. */
  function toggleSuitableOnly(): void {
    if (!handSelectFiltered.value) {
      return;
    }
    applyHandFilterChange(() => {
      if (handPickActive.value) {
        consoleHandPickState.suitableOnly = !consoleHandPickState.suitableOnly;
      } else {
        consoleState.select.suitableOnly = !consoleState.select.suitableOnly;
      }
    });
  }

  /**
   * A CLIENT-HOSTED PICK ANSWERED AS A SCENE (RX35): the pick stood, sealed, while the transport held the commit
   * and played the data onto the chosen card inside the door's plate; the scene let go (its end a tick after the
   * commit, or a disarm) — now the pick leaves and the door closes behind it. Never under the token.
   */
  function whenClientPickSceneLiveChanges(live: boolean): void {
    if (live || shell.pendingClientPick?.answered !== true) {
      return;
    }
    const pick = shell.pendingClientPick;
    shell.pendingClientPick = undefined;
    pick.onSettled?.();
  }

  // The bridge flag may never outlive the browser it describes: a HARD
  // teardown (`resetConsoleRepeatPick` — game switch / shell unmount)
  // fires no callbacks, and a stale flag would leave the hydro crumb
  // claiming «ПОВТОР ДЕЙСТВИЯ» over a screen nobody is picking on.
  function whenRepeatPickActiveChanges(active: boolean): void {
    // The crossfade window opens on the rising edge (the source keeps
    // painting under the entering browser) and can never outlive the pick:
    // a cancel before the enter settles closes it here. Only when the pick
    // is the ONE thing hiding the sources — a hand pick / scene handover
    // already had them hidden, and the window must not re-show those.
    repeatPickHandoff.value = active && !handPickActive.value && !shell.sceneHandedOver;
    if (!active && hydroFlowState.repeatBridge) {
      setHydroRepeatBridge(false);
    }
  }

  /**
   * …AND THE CONVERSE: the flag may never outlive the FRAME either.
   *
   * The pick's flag is what hides the surfaces underneath it
   * (`pickBridgeActive`), so a stack unwound by somebody else — a lateral
   * move, a flow that finished, a restore — would leave the source hidden
   * behind a browser that is no longer rendered: a blank band with a live
   * command bar, recoverable only by reload. Cancelling is the honest answer
   * (the source comes back with its captures and its old pick intact), and it
   * is idempotent.
   */
  function whenRepeatPickFrameLiveChanges(live: boolean): void {
    if (!live && consoleRepeatPickState.active) {
      cancelConsoleRepeatPick();
    }
  }

  /** The start prelude's discard has come DUE (P55 · FN): the hand opens as the start's step. */
  function whenStartDiscardStepDueChanges(due: boolean): void {
    const task = taskFor(shell.playerView);
    if (due && task?.kind === 'handSelect') {
      shell.openShellTaskSurface(task);
    }
  }

  /**
   * THE DISCARD HAND-OFF. The cinematic seizes the chosen cards out of the
   * still-open hand grid, and the moment it reaches `leaving` the pick
   * surface closes underneath the flying cards (the survivors gather home
   * into the dock, the condemned ones carry on to the pile). Driven by the
   * scene's own phase — never a timer, and never at submit time, or the
   * player would watch the hand disappear and the card silently cease to
   * exist, which is the whole bug this flow exists to fix.
   */
  function whenCardDiscardTransactionPhaseChanges(phase: string, was: string | undefined): void {
    // A COLONY-BONUS discard's physical landing writes the resolution's
    // receipt: the «СБРОШЕНО» seat keeps the count between cycles.
    if (phase === 'landing' && cardDiscardColonyBonus() !== undefined) {
      noticeColonyResolutionDiscard();
    }
    // The hand-off itself is AWAITED by the sequence (phase D calls
    // `handOffHandForDiscard`), so nothing is closed from here — a watcher
    // firing alongside the orchestrator is exactly how the two used to race.
    if (phase === 'carrying') {
      discardFreeze.value = undefined; // the packet has left the surface
      return;
    }
    // SAFETY: the scene may end WITHOUT ever reaching its hand-off — the
    // server refused the answer, the response never came, an error path
    // aborted. The hand was deliberately kept open for the seize beat, so
    // something must still close it, or the player is left staring at a pick
    // surface for a decision that is already over. Only when nothing else is
    // asking for the hand (a still-pending prompt legitimately keeps it).
    if (phase === 'idle' && was !== undefined && was !== 'idle') {
      discardFreeze.value = undefined;
      if (consoleState.section === 'hand' && !handSelectUiActive.value) {
        closeSurfaceForDiscard();
      }
    }
  }

  /** The shade yields to a live pick bridge (surface motion). */
  function whenPickBridgeActiveChanges(now: boolean): void {
    setPickSuppressed(now);
  }

  /**
   * The card the draw brought joined the open pick's entries: the cursor goes to it — once per pick (2026-10-15).
   * Seated by NAME, and seated again after the flush: the album's own entries watcher follows the card it was on
   * (`focusName`, the hand's «focus follows the card» law) and, in the very flush the newcomer arrives in, still names
   * the stale first card — it would carry the cursor straight back there.
   */
  function whenFreshPickFocusAtChanges(at: number): void {
    if (at < 0 || freshPickFocusGiven) {
      return;
    }
    freshPickFocusGiven = true;
    const name = shell.handEntries[at]?.card.name;
    const seat = (): void => {
      const i = shell.handEntries.findIndex((e) => e.card.name === name);
      if (i >= 0) {
        consoleState.handIndex = i;
      }
    };
    seat();
    void shell.$nextTick(() => {
      seat();
      void shell.$nextTick(() => ((shell.$refs.handSection ?? undefined) as InstanceType<typeof ConsoleHandSection> | undefined)?.ensureSelectedVisible());
    });
  }

  /** A phrased pick's latest select look — what the shelf freezes on while it leaves (`pickResumeFreeze`). */
  function whenHandSelectPropsChanges(v: ConsoleHandSelectMode | undefined): void {
    if (v !== undefined && handPickPhrased.value) {
      lastPickSelect.value = v;
    }
  }

  /**
   * CLIENT HAND PICK (composer → hand bridge): a composer asks the REAL hand
   * for a card, so the hand stands OVER it as an overlay frame — the composer
   * keeps its place, its state and its captures underneath. Leaving pops that
   * one frame, which puts the player back exactly where they were.
   *
   * There is no «remembered origin section» any more: the frame under the
   * overlay IS the origin, and it was never anywhere else.
   */
  function whenHandPickActiveChanges(now: boolean): void {
    // A PHRASED pick (`handPickPhrased`) resumes the embedded composer through the section's own phrase; the
    // leaving shelf keeps the pick's LAST look until that phrase is done (`pickResumeFreeze`, released by the
    // section's `pick-resumed`) — never browse decorations (play rings, requirement chips, «Можно разыграть»)
    // flashing in under the departure. An un-phrased pick recorded no look, so nothing is frozen.
    if (!now) {
      pickResumeFreeze.value = lastPickSelect.value;
      lastPickSelect.value = undefined;
    }
    if (now) {
      freshPickFocusGiven = false;
      consoleState.handIndex = firstPickFocusIndex();
      if (!workspaceFrameMounted('hand')) {
        // A HOSTED pick (the resolution action's selection — Turmoil Redux)
        // stands as a STEP of the workspace that asked, in its published
        // zone beside the hero; its stage name is handed up at once. Every
        // other pick overlays the composer that hides itself underneath.
        const hosted = consoleHandPickState.request?.hosted;
        void shell.openHandWithReveal({overlay: hosted === undefined});
        if (hosted !== undefined && workspaceFrameHost('hand') !== undefined) {
          setWorkspaceFrameStage('hand', hosted.stage);
        }
      } else {
        void shell.$nextTick(() => {
          ((shell.$refs.handSection ?? undefined) as InstanceType<typeof ConsoleHandSection> | undefined)?.ensureSelectedVisible();
        });
      }
      return;
    }
    // A DISCARD answer keeps the hand open: its cinematic has to seize the
    // card out of the real grid first and hands the surface off itself
    // (phase 'leaving'). Popping here would blank the hand a beat before the
    // card had visibly left it — the exact bug the unified discard flow
    // exists to remove.
    if (isCardDiscardActive()) {
      return;
    }
    // The play-composer pick stays in the hand it descended from (that frame
    // is not an overlay); only a hand the PICK stood up goes away again.
    if (workspaceFrameIsOverlay('hand')) {
      leaveWorkspace();
      return;
    }
    // A HOSTED pick that left through the SALE keeps its hand on screen: the
    // terminal's proxies lift off these very slots, and the step leaves at
    // the stack's insertion (the sale's phase watcher). A cancel leaves now.
    if (workspaceFrameHost('hand') === 'card-actions' && workspaceStackTop()?.kind === 'hand' && !isPatentSaleActive()) {
      leaveWorkspace();
    }
  }

  /**
   * A LAW'S PLAY PICK (RX36 Live Experiments — `consolePlayPick`): the album
   * stands up as a STEP of the asking stage (`card-actions ⊃ hand`, the
   * hosted hand's own road — RX24's), in its ordinary PLAY mode over the
   * law's promised pick (`playAction`); A on a card descends into the play
   * composer one level deeper. On the falling edge (the composer resolved, B
   * in the album, a prompt that moved on) the step leaves — one level — and
   * the law's stage stands again with its slot.
   */
  function whenPlayPickActiveChanges(now: boolean): void {
    if (now) {
      consoleState.handIndex = Math.max(0, shell.handEntries.findIndex((e) => e.playable));
      if (!workspaceFrameMounted('hand')) {
        void shell.openHandWithReveal({overlay: false});
        if (workspaceFrameHost('hand') !== undefined) {
          setWorkspaceFrameStage('hand', consolePlayPickState.request?.stage ?? 'Selection');
        }
      }
      return;
    }
    // The composer (if any) goes with the step — never a fly-back into the album that is leaving.
    if (shell.pendingPlayCard !== undefined && !isPlayedHeroActive()) {
      shell.pendingPlayCard = undefined;
    }
    if (workspaceFrameHost('hand') === 'card-actions' && workspaceStackTop()?.kind === 'hand') {
      leaveWorkspace();
    }
  }

  return {
    repeatPickHandoff,
    discardFreeze,
    lastPickSelect,
    pickResumeFreeze,
    pickBridgeActive,
    handPickOverlays,
    handPickCoversSteps,
    padSection,
    handPickPhrased,
    cardDiscardHolds,
    discardInOverlay,
    handHiddenByFilter,
    handSelectModel,
    handSelectTaskActive,
    handPickActive,
    playPickActive,
    repeatPickActive,
    repeatPickFrameLive,
    repeatPickSceneOut,
    handSelectUiActive,
    freshPickFocusAt,
    handSelectSuitableOnly,
    handSelectPicked,
    handPickDeclineLive,
    handSelectVerb,
    pickAllSelected,
    handSelectDerived,
    handPickHandNames,
    handSelectSelectableNames,
    handSelectFiltered,
    handSelectSingle,
    contextualSourceResolution,
    contextualSourceKnown,
    contextualSourceCard,
    handSelectReasons,
    discardMeta,
    discardIntent,
    handSelectProps,
    handSelectPicksValid: ownHandSelectPicksValid,
    handTagFilterOptions,
    handActiveFilter,
    focusFirstSelectableHandCard,
    firstPickFocusIndex,
    handOffHandForDiscard,
    onRepeatPickClose,
    onRepeatPickEntered,
    handPickStandsAlone,
    applyFocusedFilterChip,
    cycleHandFilter,
    resetHandFilter,
    applyHandFilterChange,
    refocusAfterFilter,
    handSelectPress,
    handSelectExecuteSingle,
    armDiscardScene,
    discardSourceElement,
    discardSourceRect,
    inspectContextualSource,
    toggleHandSelectPick,
    togglePickSelectAll,
    toggleSelectAllTask,
    confirmHandSelect,
    submitHandSelect,
    closeSurfaceForDiscard,
    toggleSuitableOnly,
    whenClientPickSceneLiveChanges,
    whenRepeatPickActiveChanges,
    whenRepeatPickFrameLiveChanges,
    whenStartDiscardStepDueChanges,
    whenCardDiscardTransactionPhaseChanges,
    whenPickBridgeActiveChanges,
    whenFreshPickFocusAtChanges,
    whenHandSelectPropsChanges,
    whenHandPickActiveChanges,
    whenPlayPickActiveChanges,
  };
}

export type HandSelectController = ReturnType<typeof createHandSelectController>;

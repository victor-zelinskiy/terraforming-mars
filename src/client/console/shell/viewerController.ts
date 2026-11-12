/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE CARD VIEWER'S CONTROLLER — the fullscreen card viewer (zoom) of the console shell: its open / close / swap
 * choreography, its side column (rules · availability · the resolution's aside · the party's access · the bot
 * corporation's ledger) and the verbs of its bar (select, take, execute, vote).
 *
 * Taken out of ConsoleShell.vue by scripts/shell-extract.mjs (architecture v2 — docs/claude/console/architecture-v2/
 * PLAN.md §5 · S2): the members are verbatim, every `this.` rewritten — own members are locals, the rest of the shell
 * is the PORT below. The module state the viewer stands on is `consoleCardZoom` (console/consoleCardZoom.ts); the
 * template block (the `<CardZoomModal>` and its slots) still lives in the shell and reads these members by name.
 */
import {computed, ref, onBeforeUnmount, onMounted} from 'vue';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {GameModel} from '@/common/models/GameModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {noteInputAbsorbed, registerInputAbsorber} from '@/client/console/inputAbsorb';
import {CONSOLE_SCROLL_STEP_PX} from '@/client/console/shell/shellMetrics';
import {ConsoleHandEntry} from '@/client/components/console/consoleHandSectionTypes';
import {parliamentVoteSubject} from '@/client/console/parliament/consoleParliamentFlow';
import {consoleParliamentUi} from '@/client/console/parliament/consoleParliamentFlow';
import {partyAnnotations, resolutionAnnotations, resolutionPartyAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {resolutionPartyContextKey, resolutionStatusOf, ResolutionStatusVm} from '@/client/console/parliament/resolutionInspectModel';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {winnerRewardTableOf} from '@/client/console/parliament/winnerRewardModel';
import {tileRemovalTableOf} from '@/client/console/parliament/tileRemovalModel';
import {WinnerRewardTable} from '@/common/parliament/winnerReward';
import {ParliamentEnactOutcomeModel} from '@/common/models/ParliamentModel';
import {enactedLevyOf, enactedYieldsOf, voteLevyOf, voteYieldsOf} from '@/client/console/parliament/influenceYieldModel';
import {LevyReading} from '@/common/parliament/resolutionLevy';
import {grantSupportOf, parliamentPromptBridge} from '@/client/console/parliament/consoleParliamentModel';
import {supportReadingOf, SupportReadingVm} from '@/client/console/parliament/voteInfoModel';
import {InfluenceYield} from '@/common/parliament/influenceScaling';
import type {DrawDiscardVerdict} from '@/client/console/deckDraw/drawSearchReading';
import {tagIconStyle} from '@/client/components/premiumCard/premiumCardIcons';
import {tagLabel} from '@/client/cards/tagLabel';
import {agendaWalkForYouAnnotation, countedPlayForYouAnnotation} from '@/client/console/consolePlayCardComposer';
import {countedWhyOf} from '@/client/console/countedPlay';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import {cardHasRules, cardRuleAnnotations, denserRulesTier, RulesLengthTier, rulesLengthTier} from '@/client/components/console/consoleCardRules';
import type {PlayedTargetDossier} from '@/client/console/played/playedTargetDossier';
import {buildZoomAvailability, CardAvailabilityView} from '@/client/console/cardAvailability';
import {withRequirementEasing} from '@/client/console/composerRequirementRow';
import {ZoomCard, isMarsBotCorpZoom, isPartyEffectZoom, isResolutionZoom, isTenderZoom} from '@/client/components/card/cardZoomTypes';
import {tenderAnnotations} from '@/client/console/campaign/tenderAnnotations';
import {CardAnnotation} from '@/client/components/cardAnnotations/annotationModel';
import {marsBotCorpAnnotations, marsBotDividendGroupId, marsBotHoldingAnnotations} from '@/client/components/marsbot/marsBotCorpRules';
import {BotDividendReading, botDividendDetailOf, botDividendReading} from '@/client/components/marsbot/botDividendReading';
import {consoleCardZoom, navigateConsoleCardZoom, closeConsoleCardZoom, setConsoleZoomInspectTab, ZoomOrigin, ConsoleZoomProvenance, ConsoleZoomVoteVerb} from '@/client/console/consoleCardZoom';
import {beginZoomOpen, cancelZoomOpen, playZoomOpenFlight, zoomOpenSourceRect, playZoomClose, playZoomDepart, playZoomHandoff, playZoomSwap, retargetZoomHold, releaseZoomMotion} from '@/client/console/consoleZoomMotion';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {Tag} from '@/common/cards/Tag';
import {ColonyModel} from '@/common/models/ColonyModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {motionMs} from '@/client/components/motion/motionTokens';
import type {StagedVoteModel} from '@/common/models/ActionPreviewModel';
import type {EffectForecast} from '@/common/models/EffectForecastModel';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {probeTick} from '@/client/console/probeTick';
import type {SurfaceRegistry} from '@/client/console/shell/surfaceRegistry';

/** The fullscreen viewer's OPEN / CLOSE flight swallows the pad on purpose (the card is mid-air) — said on the ledger. */
const ZOOM_FLIGHT_ABSORBER = 'zoom-flight';

/** One d-pad press of the card viewer's side column (a reading step, ~3 lines). */
const ZOOM_SIDE_NAV_STEP_PX = 90;

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type ViewerPort = {
  $nextTick(fn?: () => void): Promise<void>,
  surfaces: SurfaceRegistry,
  readonly awaitingInput: boolean,
  readonly game: GameModel,
  readonly handEntries: ReadonlyArray<ConsoleHandEntry>,
  readonly handSoftReason: string,
  readonly handTurnWindowClosed: boolean,
  readonly myTurn: boolean,
  readonly parliamentSeatName: (color: Color) => string,
  readonly playerView: PlayerViewModel,
  readonly stagedVoteModel: StagedVoteModel | undefined,
  readonly thisPlayer: PublicPlayerModel,
};

export function createViewerController(shell: ViewerPort) {
  // The controller's own scope (architecture v2 — PLAN §10 · C1): it ends with the shell, and its timers with it.
  const flow = useFlowScope('viewer-controller');
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** Fullscreen open/close choreography: chrome held hidden mid-flight. */
  const zoomFlight = ref(false);
  /** Backdrop fade-out while the close flight plays. */
  const zoomClosing = ref(false);
  /** Re-entrancy guard for the single-card reveal L3 role swap. */
  const zoomSwapping = ref(false);
  /** The OPEN flight is in progress (dialog not shown yet) — input gated. */
  const zoomOpening = ref(false);
  /** The open-flight proxy (rendered on `.con-zoom-flight-layer`). */
  const zoomOpenProxy = ref(undefined as {card: ZoomCard, zoom: number} | undefined);
  /**
   * A on a vote verb that cannot be sent (Turmoil Redux): each press bumps
   * this, which re-keys the verb's reason line and replays its nudge — the
   * viewer answers «not now» where the player is looking, never closes.
   */
  const zoomVoteNudge = ref(0);
  /** Stale-callback fence for the async open sequence (measure/flight). */
  const zoomOpenToken = ref(0);
  /** Deferred proxy removal after the top layer has covered it — its cancel (the scope owns the timer). */
  let cancelZoomOpenClear: () => void = () => {};

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  // ── P15: the fullscreen viewer's select context ─────────────────────
  /** The TV rules panel shows for cards with structured information —
   *  and suppresses the floating callouts (one place for details). */
  const zoomHasRules = computed((): boolean => {
    const name = consoleCardZoom.card?.name;
    // Asked with the suppression already applied: a card whose only rules
    // block is the requirement the availability panel states in full has
    // nothing left for this panel, and an empty box must not mount.
    return name !== undefined && cardHasRules(name, zoomCoveredRequirements.value);
  });

  const zoomCoveredRequirements = computed((): ReadonlyArray<string> => {
    return zoomAvailabilityView.value?.coveredRequirementIds ?? [];
  });

  /** The right SIDE panel shows for a card with structured rules OR whenever
   *  the viewer is an inspect DOSSIER (which always offers СТАТИСТИКА, even if a
   *  card had no rules) OR when the availability panel has something to say.
   *  Gates the panel AND the viewer's width reservation. */
  const zoomSideVisible = computed((): boolean => {
    return zoomHasRules.value || zoomBotCorpAnnotations.value !== undefined || zoomParliamentAnnotations.value !== undefined || zoomTenderAnnotations.value !== undefined ||
      consoleCardZoom.inspect !== undefined || zoomAvailabilityView.value !== undefined || zoomTargetDossier.value !== undefined;
  });

  /** The card on screen AS A TARGET of a «where does it go» step — re-read on every LB/RB browse. */
  const zoomTargetDossier = computed((): PlayedTargetDossier | undefined => {
    return consoleCardZoom.targetAt?.(consoleCardZoom.index);
  });

  /**
   * A hand card that WALKS the Agenda (TR04 / TR12 / TR37 / TR42): its rules, then «ДЛЯ ВАС» — the walk the server
   * read for the viewer's own hand card (`CardModel.agendaWalk`), in the composer's own rows (why · how far · a cut ·
   * the named zero). Undefined for every other card: the rules panel reads the manifest as before.
   */
  const zoomCardForYouAnnotations = computed((): ReadonlyArray<CardAnnotation> | undefined => {
    const name = zoomRulesCardName.value;
    const card = consoleCardZoom.card as CardModel | undefined;
    const walk = card?.agendaWalk;
    // A play COUNTED off the table (TR45) reads its composition here too — the composer's own «why», as one row.
    const counted = walk === undefined ? countedWhyOf(card?.countedPlay) : undefined;
    // TR49 class: a printed requirement a modifier bends is ANNOTATED under its own rule (the viewer's own card).
    const easings = card?.requirementEasing ?? [];
    if (name === undefined) {
      return undefined;
    }
    const t = {text: translateText, params: translateTextWithParams};
    const forYou = walk !== undefined ? agendaWalkForYouAnnotation(walk, t) : counted !== undefined ? countedPlayForYouAnnotation(counted, t) : undefined;
    if (forYou === undefined && easings.length === 0) {
      return undefined;
    }
    const rules = withRequirementEasing(cardRuleAnnotations(name, zoomCoveredRequirements.value), easings, t);
    return forYou === undefined ? rules : [...rules, forYou];
  });

  /** A parliament face's rules (Turmoil Redux) — only when the viewer is on a resolution / party entry. */
  /** A campaign TENDER on the viewer's stage — its contract read in the rules column (`tenderAnnotations`). */
  const zoomTenderAnnotations = computed((): ReadonlyArray<CardAnnotation> | undefined => {
    const card = consoleCardZoom.card;
    return card !== undefined && isTenderZoom(card) ? tenderAnnotations(card.tender) : undefined;
  });

  const zoomParliamentAnnotations = computed((): ReadonlyArray<CardAnnotation> | undefined => {
    const card = consoleCardZoom.card;
    if (card === undefined) {
      return undefined;
    }
    if (isResolutionZoom(card)) {
      // Парламент v8 (the owner's point 9): the dossier is the RULES — the printed texts in the project card's dose
      // (2026-10-23): no «ДЛЯ ВАС» block, no qualification sentence under an effect. The plates (the standing, the
      // vote's facts, the estimate, the counted cards) are the vote panel's.
      return resolutionAnnotations(card.resolution, zoomResolutionWorld.value);
    }
    if (isPartyEffectZoom(card)) {
      return partyAnnotations(card.partyEffect, shell.game.parliament, shell.thisPlayer.color, shell.myTurn && shell.awaitingInput, zoomPartyAccess.value !== undefined);
    }
    return undefined;
  });

  /** The RESOLUTION on the viewer's stage (Turmoil Redux), or undefined for any other subject. */
  const zoomResolutionId = computed((): string | undefined => {
    const card = consoleCardZoom.card;
    return card !== undefined && isResolutionZoom(card) ? card.resolution : undefined;
  });

  /** A PARTY's inspector is open (the plate + the rules column) — the handheld rules width rides this class (registry R-19). */
  const zoomPartyOpen = computed((): boolean => {
    const card = consoleCardZoom.card;
    return card !== undefined && isPartyEffectZoom(card);
  });

  /** THE «ДОСТУП» OBJECT of a party's dossier (Парламент v8 § 7) — its party, only with a live table and a seat that takes part. */
  const zoomPartyAccess = computed((): ReduxParty | undefined => {
    const card = consoleCardZoom.card;
    if (card === undefined || !isPartyEffectZoom(card) || shell.game.parliament === undefined) {
      return undefined;
    }
    const me = shell.game.parliament.players.find((p) => p.color === shell.thisPlayer.color);
    return me?.access.some((a) => a.party === card.partyEffect) === true ? card.partyEffect : undefined;
  });

  /** Its party — the left column's subject (the CATALOG's party, so it shows outside a live table too). */
  const zoomResolutionParty = computed((): ReduxParty | undefined => {
    const id = zoomResolutionId.value;
    return id === undefined ? undefined : getResolution(id)?.party;
  });

  /**
   * WHERE THE CARD STANDS and the viewer's access to its party's effect —
   * the footer's reading, from the VIEWER's own parliament model (never the
   * player whose turn it is). Undefined without a live table or for a card
   * that is neither in the vote nor enacted: the bar then states nothing.
   */
  const zoomResolutionStatus = computed((): ResolutionStatusVm | undefined => {
    const id = zoomResolutionId.value;
    return id === undefined ? undefined : resolutionStatusOf(id, shell.game.parliament, shell.thisPlayer.color);
  });

  /** The party column's one context line (a condition in the vote, a fact once enacted). */
  const zoomResolutionContextKey = computed((): string | undefined => {
    return resolutionPartyContextKey(zoomResolutionStatus.value);
  });

  /**
   * The viewer's readings of the resolution on the stage — the vote's
   * estimate + forecast, or the enacted card's recorded payout — from the
   * ONE influence-yield model. Empty when nothing scales with influence.
   */
  const zoomResolutionYields = computed((): ReadonlyArray<InfluenceYield> => {
    const id = zoomResolutionId.value;
    const resolution = id === undefined ? undefined : getResolution(id);
    if (resolution === undefined || (resolution.scaled ?? []).length === 0) {
      return [];
    }
    const model = shell.game.parliament;
    const viewer = zoomResolutionSubject.value;
    return model?.enacted?.resolution === id ? enactedYieldsOf(resolution, model, viewer) : voteYieldsOf(resolution, model, viewer);
  });

  /**
   * WHOSE numbers the inspector's footer reads — the SUBJECT the vote panel
   * is on (`parliamentVoteSubject`), so X over a rival's reading opens the
   * same seat's card rather than silently swapping back to the viewer's own.
   * Outside the vote mode there is no subject but the viewer. The vote FACTS
   * and the A verb below are never anybody's but the viewer's: the delegate
   * being sent is theirs.
   */
  const zoomResolutionSubject = computed((): Color | undefined => {
    return parliamentVoteSubject(shell.thisPlayer.color);
  });

  /** The SUBJECT's own name — the footer's kicker when the reading is not the viewer's. */
  const zoomResolutionSubjectName = computed((): string | undefined => {
    const subject = zoomResolutionSubject.value;
    return subject === undefined || subject === shell.thisPlayer.color ? undefined : shell.parliamentSeatName(subject);
  });

  /** THE LEVY of the resolution on the stage (a budget) — the vote's reading, or the enacted record; the same moments as the yields. */
  const zoomResolutionLevy = computed((): LevyReading | undefined => {
    const id = zoomResolutionId.value;
    const resolution = id === undefined ? undefined : getResolution(id);
    if (resolution === undefined || resolution.levy === undefined) {
      return undefined;
    }
    const model = shell.game.parliament;
    const viewer = zoomResolutionSubject.value;
    return model?.enacted?.resolution === id ? enactedLevyOf(resolution, model, viewer) : voteLevyOf(resolution, model, viewer);
  });

  /**
   * THE PARTY'S SUPPORT of the resolution on the stage, under the door the
   * vote mode stands behind (a delegate grant that also pays the party —
   * staged or live): the SERVER's row for that party, laid out by the vote
   * panel's own model. Undefined outside such a door — the column then says
   * nothing about support.
   */
  const zoomResolutionSupport = computed((): SupportReadingVm | undefined => {
    const party = zoomResolutionParty.value;
    if (party === undefined || !consoleParliamentUi.voteStanding) {
      return undefined;
    }
    const row = grantSupportOf(parliamentPromptBridge(shell.playerView.waitingFor, shell.stagedVoteModel).grant, party);
    return row === undefined ? undefined : supportReadingOf(row);
  });

  /**
   * The WORLD's part of the resolution on the stage, read over the live
   * table — and, once the sitting has made it, over the server's own
   * records (`worldMoveModel`): «Кислород: 5 % → 4 %», «Венера: 10 % →
   * 14 %, РТ никому».
   */
  const zoomResolutionWorld = computed((): {table: WinnerRewardTable | undefined, enacted: boolean, outcomes: ReadonlyArray<ParliamentEnactOutcomeModel> | undefined, colonies: ReadonlyArray<ColonyModel>, removal: {oceans: number, removableOceans?: number, maxOceans?: number} | undefined, nameOf: (color: Color) => string, forecast: EffectForecast | undefined} => {
    const id = zoomResolutionId.value;
    const model = shell.game.parliament;
    const enacted = id !== undefined && model?.enacted?.resolution === id;
    const phase = model?.phase;
    const summary = phase?.summary ?? (model?.lastPhase?.enacted.resolution === id ? model?.lastPhase : undefined);
    return {
      table: winnerRewardTableOf(shell.game),
      enacted,
      outcomes: enacted ? (phase?.outcomes ?? summary?.outcomes) : undefined,
      // WHAT THE TABLE ANSWERS to the world move (PL-052) — the viewer's own slot reading, server-made.
      forecast: id === undefined ? undefined : model?.slots.find((s) => s.resolution === id)?.worldForecast,
      // …and the COLONY TABLE, for a law that advances its tracks (Unity Budget — `colonyTrackModel`).
      colonies: shell.game.colonies,
      // …and the BOARD, for a law that takes a tile off it (Water Export — `tileRemovalModel`): the ocean count and the plain ones.
      removal: tileRemovalTableOf(shell.game.spaces, shell.game.gameOptions.boardName),
      nameOf: (color: Color) => shell.playerView.players.find((p) => p.color === color)?.name ?? String(color),
    };
  });

  /**
   * ONE type size for the resolution scene: the denser of the party
   * column's and the rules column's own reading tiers — two panels beside
   * one card read as one composition, never as two sizes of text.
   */
  const zoomResolutionTier = computed((): RulesLengthTier | undefined => {
    const id = zoomResolutionId.value;
    const party = zoomResolutionParty.value;
    if (id === undefined || party === undefined) {
      return undefined;
    }
    const rules = resolutionAnnotations(id, zoomResolutionWorld.value);
    return denserRulesTier(rulesLengthTier(rules), rulesLengthTier(resolutionPartyAnnotations(party)));
  });

  /**
   * «Send the delegate» for the card ON SCREEN — the vote mode's own
   * reading (source, price, refusal), re-read per browsed card and per
   * server change, so the verb can never belong to the previous card.
   */
  const zoomVoteVerb = computed((): ConsoleZoomVoteVerb | undefined => {
    const z = consoleCardZoom;
    return z.card === undefined ? undefined : z.vote?.verbAt(z.index);
  });

  /**
   * The vote verb's reading lines: the live one (keyed on the nudge, so a
   * blocked press replays its shake), then the other cards' readings as the
   * verb's invisible reserve — the same law as the status chip's.
   */
  const zoomVoteDetailLines = computed((): Array<{key: string, verb: ConsoleZoomVoteVerb, live: boolean}> => {
    const z = consoleCardZoom;
    const live = zoomVoteVerb.value;
    if (live === undefined || z.vote === undefined) {
      return [];
    }
    const lines = [{key: 'vote-detail-' + zoomVoteNudge.value, verb: live, live: true}];
    for (let i = 0; i < z.cards.length; i++) {
      const verb = i === z.index ? undefined : z.vote.verbAt(i);
      if (verb !== undefined) {
        lines.push({key: 'vote-sizer-' + i, verb, live: false});
      }
    }
    return lines;
  });

  /** The zoomed card is a MarsBot corporation the bot HOLDS (the portfolio — the server's `automa.holdings`). */
  const zoomBotCorpHolding = computed((): boolean => {
    const card = consoleCardZoom.card;
    return card !== undefined && isMarsBotCorpZoom(card) &&
      (shell.playerView.game.automa?.holdings ?? []).some((h) => h.id === card.marsBotCorp);
  });

  /** The MarsBot corporation's printed rule boxes for the rules panel —
   *  only when the viewer is on a bot-corporation entry. */
  const zoomBotCorpAnnotations = computed((): ReadonlyArray<CardAnnotation> | undefined => {
    const card = consoleCardZoom.card;
    if (card === undefined || !isMarsBotCorpZoom(card)) {
      return undefined;
    }
    // A FURTHER corporation (the campaign portfolio — the holdings are the
    // server's fact): the table shows it like any corporation, HERE the rules
    // say what it does — its dividend first (with the live ledger under it:
    // `zoomBotDividendReading`), the printed boxes after it marked inactive.
    // The primary carries no «Дивиденды» box at all (the owner, 2026-10-27):
    // it never pays one.
    if (zoomBotCorpHolding.value) {
      return marsBotHoldingAnnotations(card.marsBotCorp, {ledger: zoomBotDividendReading.value !== undefined});
    }
    return marsBotCorpAnnotations(card.marsBotCorp);
  });

  /** The live reading of the inspected further corporation's dividend — its two goals and its total (the bot's open VP breakdown). */
  const zoomBotDividendReading = computed((): BotDividendReading | undefined => {
    const card = consoleCardZoom.card;
    if (card === undefined || !isMarsBotCorpZoom(card) || !zoomBotCorpHolding.value) {
      return undefined;
    }
    return botDividendReading(botDividendDetailOf(shell.playerView.players, card.marsBotCorp));
  });

  /** The rules group the dividend ledger hangs under. */
  const zoomBotDividendGroupId = computed((): string | undefined => {
    const card = consoleCardZoom.card;
    return card !== undefined && isMarsBotCorpZoom(card) ? marsBotDividendGroupId(card.marsBotCorp) : undefined;
  });

  /**
   * The CURRENT-GAME availability view for the zoomed card — only in an
   * explicit context the OPENER opted into (`consoleCardZoom.availability`:
   * the draft workspace's zones pass 'draft', the hand's play browse passes
   * 'play'; a discard pick / patent sale / played-table browse pass nothing
   * and the panel cannot appear there). Built by the SHARED cardAvailability
   * model — the same view the draft's compact block and the hand verdict
   * derive from, so the fullscreen can never disagree with them. Recomputed
   * per browsed card (`consoleCardZoom.card` follows LB/RB), so a previous
   * card's reasons can never linger.
   */
  const zoomAvailabilityView = computed((): CardAvailabilityView | undefined => {
    const z = consoleCardZoom;
    const card = z.card;
    // The PURE builder (cardAvailability.buildZoomAvailability) owns every
    // decision: no context / no card → nothing; a non-card zoom entry (an
    // Automa bonus plate carries no `unplayableReasons`) → nothing; in the
    // play voice the live hand offer wins over the reasons (the offer can be
    // WIDER — a prompt-carried discount), and the turn note is attached ONLY
    // for a card the viewer's own hand carries — the shell's one soft
    // reason, the same string (and the same window flag) the hand verdict
    // bar reads, so the two lists match row for row.
    const handEntry = card === undefined ? undefined :
      shell.handEntries.find((e) => e.card.name === card.name);
    return buildZoomAvailability({
      context: z.availability,
      card: card as CardModel | undefined,
      handEntry,
      turnReason: shell.handTurnWindowClosed ? shell.handSoftReason : undefined,
    });
  });

  /** The zoomed card's name typed as a CardName for the rules panel — only
   *  read behind `zoomHasRules`, which is true solely for real project cards
   *  (a bonus entry never resolves rules), so the cast is sound. */
  const zoomRulesCardName = computed((): CardName | undefined => {
    const name = consoleCardZoom.card?.name;
    return name === undefined ? undefined : (name as CardName);
  });

  const zoomSelectable = computed((): boolean => {
    return consoleCardZoom.select !== undefined && consoleCardZoom.card !== undefined;
  });

  const zoomSelected = computed((): boolean => {
    const z = consoleCardZoom;
    return z.select !== undefined && z.card !== undefined && z.select.isSelected(z.card.name as CardName);
  });

  const zoomSelectLabel = computed((): string => {
    return consoleCardZoom.select?.selectLabel ?? 'Select';
  });

  const zoomDeselectLabel = computed((): string => {
    return consoleCardZoom.select?.deselectLabel ?? 'Deselect';
  });

  /** P17: the context action verb for the CURRENT card (play parity). */
  const zoomActionLabel = computed((): string | undefined => {
    const z = consoleCardZoom;
    if (z.action === undefined || z.card === undefined) {
      return undefined;
    }
    // The action bridge is only ever attached to project-card lists, so the
    // ZoomCard name is genuinely a CardName here (never a bonus id).
    return z.action.labelFor(z.card.name as CardName);
  });

  /** The RECEIVE bridge A-verb (drawn-cards reveal), or undefined. */
  const zoomReceiveLabel = computed((): string | undefined => {
    return consoleCardZoom.receive?.takeLabel;
  });

  /** The RECEIVE bridge RT-verb (take all), shown only when it exists. */
  const zoomTakeAllLabel = computed((): string | undefined => {
    const r = consoleCardZoom.receive;
    return r?.takeAll !== undefined ? r.takeAllLabel : undefined;
  });

  /** The prominent ROLE status pill (single-card reveal), or undefined. */
  const zoomStatusLabel = computed((): string | undefined => {
    return consoleCardZoom.statusLabel;
  });

  /**
   * WHY the card on screen was thrown away — a search's discard pile only
   * (TR32). Rides `index`, so LB/RB through the pile keeps it honest.
   */
  const zoomDiscardVerdict = computed((): DrawDiscardVerdict | undefined => {
    const index = consoleCardZoom.index;
    return consoleCardZoom.discardVerdictAt?.(index);
  });

  /**
   * ONE class per excluded tag the card on screen carries — the face marks
   * its own printed medallion as a STATE (`.con-zoom--reject-<tag>`), so the
   * reason is found where the rule looked, never re-drawn beside the card.
   */
  const zoomRejectedTagClasses = computed((): Array<string> => {
    const verdict = zoomDiscardVerdict.value;
    return verdict?.kind === 'tags' ? verdict.tags.map((tag) => `con-zoom--reject-${tag}`) : [];
  });

  /**
   * The PLAYED-TABLE provenance plate for the card ON SCREEN (undefined =
   * the viewer wasn't opened from «Разыграно»). Rides `index`, so browsing
   * a zone with LB/RB keeps the plate — and «N из M» — honest.
   */
  const zoomProvenance = computed((): ConsoleZoomProvenance | undefined => {
    // `index` is read explicitly: the resolver is a plain function, so the
    // computed must depend on the reactive field it is keyed by.
    const index = consoleCardZoom.index;
    return consoleCardZoom.provenanceAt?.(index);
  });

  /** The L3 role-swap chip verb (single-card reveal), or undefined. */
  const zoomSwapLabel = computed((): string | undefined => {
    return consoleCardZoom.swap?.label;
  });

  /** The OTHER card's name shown in the swap chip, or undefined. */
  const zoomSwapOtherName = computed((): CardName | undefined => {
    return consoleCardZoom.swap?.otherName;
  });

  /** The «ПОЛУЧЕНО N» count in the viewer bar (single-card reveal). 0 = hidden. */
  const zoomReceivedCount = computed((): number => {
    return consoleCardZoom.receivedCount;
  });

  /** The static source chip (non-card source, e.g. tile bonus), or undefined. */
  const zoomSourceInfo = computed((): {label: string, name: string} | undefined => {
    return consoleCardZoom.sourceInfo;
  });

  /** True ⇔ R3 peeks the discard pile (single-card fullscreen reveal). */
  const zoomDiscardsAvailable = computed((): boolean => {
    return consoleCardZoom.discards !== undefined;
  });

  /** P17: «why not» lines when the current card is NOT actionable. */
  const zoomReasons = computed((): ReadonlyArray<string> => {
    const z = consoleCardZoom;
    if (z.action === undefined || z.card === undefined || zoomActionLabel.value !== undefined) {
      return [];
    }
    return z.action.reasonsFor(z.card.name as CardName);
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The discard verdict's tag medallion (TR32) — the card face's own art. */
  function zoomVerdictTagStyle(tag: Tag): Record<string, string> {
    return tagIconStyle(tag);
  }

  /** …and its name, in the player's language («Растение»). */
  function zoomVerdictTagName(tag: Tag): string {
    return tagLabel(tag);
  }

  // ── P13/P15: the fullscreen card viewer (module-state driven) ───────
  function onCardZoomNavigate(card: ZoomCard, pos: number): void {
    navigateConsoleCardZoom(card, pos);
    zoomVoteNudge.value = 0;
    // The card "in hand" changed: the table hold moves to ITS slot, and
    // the host keeps the underlying focus in lockstep (so closing lands
    // the cursor on the card the player looked at LAST).
    retargetZoomHold(pos);
    consoleCardZoom.origin.onBrowse?.(pos);
  }

  /**
   * The OPEN sequence (see consoleZoomMotion.ts header — load-bearing):
   * measure the landing on the CLOSED dialog, fly the proxy on a normal
   * layer, and call `show()` (showModal) only at touchdown so the dialog's
   * first top-layer frame is final, static, fully-visible content — the
   * compositor-safe shape the mouse path always had. Every deferred
   * callback is fenced by `zoomOpenToken` (a close + reopen can never be
   * touched by a stale flight/safety callback).
   */
  async function runZoomOpen(zoom: InstanceType<typeof CardZoomModal>): Promise<void> {
    const token = ++zoomOpenToken.value;
    zoomOpening.value = true;
    const origin: ZoomOrigin = consoleCardZoom.origin;
    beginZoomOpen(origin);
    const landing = await zoom.measureLanding();
    if (token !== zoomOpenToken.value || consoleCardZoom.card === undefined) {
      return; // closed / reopened while measuring — that sequence owns state
    }
    const index = consoleCardZoom.index;
    if (landing === undefined || consoleReducedMotionActive()) {
      // VANILLA open (also the reduced-motion / JSDOM / degenerate-layout
      // path): show immediately — first frame final and fully visible.
      zoom.show();
      zoomOpening.value = false;
      flow.after(motionMs(140), 'the viewer\'s chrome fades in', () => {
        if (token === zoomOpenToken.value) {
          zoomFlight.value = false;
        }
      });
      return;
    }
    // Premium flight: proxy flies slot→landing while the veil (the ONE
    // dim — the dialog's ::backdrop paints nothing) fades in beneath it;
    // showModal at touchdown adds no visual dim step.
    const source = zoomOpenSourceRect(index);
    zoomOpenProxy.value = {card: consoleCardZoom.card, zoom: landing.zoom};
    await shell.$nextTick();
    if (token !== zoomOpenToken.value) {
      return;
    }
    const proxyEl = shell.surfaces.at<HTMLElement>('zoomFlightProxy');
    playZoomOpenFlight(proxyEl, index, source, landing.rect, {
      onShow: () => {
        if (token === zoomOpenToken.value && consoleCardZoom.card !== undefined) {
          zoom.show();
        }
      },
      onDone: () => {
        if (token !== zoomOpenToken.value) {
          return;
        }
        zoomOpening.value = false;
        zoomFlight.value = false; // chrome fades in over the landed card
        // The proxy was already made INVISIBLE synchronously at hand-off
        // (playZoomOpenFlight — it must not share a single PAINT with the
        // dialog card, or their halos stack into a bright contour flash).
        // This is only the UNMOUNT of an already-hidden element, so its
        // timing is free — a beat later keeps it off the hand-off frame.
        cancelZoomOpenClear = flow.after(motionMs(160), 'the open-flight proxy\'s unmount', () => clearZoomOpenFlight());
      },
    });
  }

  /** Drop the open-flight proxy (idempotent; any close path). */
  function clearZoomOpenFlight(): void {
    cancelZoomOpenClear();
    cancelZoomOpenClear = () => {};
    zoomOpenProxy.value = undefined;
  }

  function onCardZoomClosed(): void {
    // Any close path (choreographed B, native Esc, backdrop tap): restore
    // every held slot + kill the flight, then clear the module state.
    releaseZoomMotion();
    zoomOpenToken.value++; // fence out any stale open-sequence callback
    zoomFlight.value = false;
    zoomClosing.value = false;
    zoomSwapping.value = false;
    zoomOpening.value = false;
    zoomVoteNudge.value = 0;
    clearZoomOpenFlight();
    document.body.classList.remove('con-zoom-open');
    closeConsoleCardZoom();
  }

  /**
   * Page the viewer's SIDE column by `delta` px: the inspect dossier's active
   * tab (rules / statistics), else the rules panel, else the resolution
   * inspector's party column (the second reading surface — it takes the
   * input when the rules have nothing to scroll).
   */
  function scrollZoomSide(delta: number): void {
    const inspect = shell.surfaces.at<{scrollBody?: (dy: number) => boolean}>('zoomInspectSide');
    if (inspect?.scrollBody?.(delta) === true) {
      return;
    }
    const rules = shell.surfaces.at<{scrollBody?: (dy: number) => boolean}>('zoomRulesPanel');
    if (rules?.scrollBody?.(delta) !== true) {
      const aside = shell.surfaces.at<{scrollBody?: (dy: number) => boolean}>('zoomAsidePanel');
      aside?.scrollBody?.(delta);
    }
  }

  /** P15: the controller drives the viewer natively while it is open. */
  function handleZoomIntent(intent: GamepadIntent): boolean {
    // A close/handoff flight is in progress: the card is mid-air — swallow
    // everything (no browsing a departing card, no double execute). A
    // DELIBERATE swallow, so it is said on the ledger (`ZOOM_FLIGHT_ABSORBER`).
    if (zoomClosing.value) {
      noteInputAbsorbed(ZOOM_FLIGHT_ABSORBER);
      return true;
    }
    // Mid OPEN-flight (dialog not shown yet): only closing is meaningful —
    // browsing/acting waits for the landing (≤400ms). B/X aborts cleanly.
    if (zoomOpening.value) {
      if (intent.kind === 'press' && !consoleCardZoom.mandatory) {
        const action = consoleActionOf(intent);
        if (action === 'back' || action === 'inspect') {
          void closeZoomViewer();
          return true;
        }
      }
      noteInputAbsorbed(ZOOM_FLIGHT_ABSORBER);
      return true;
    }
    const zoom = shell.surfaces.at<InstanceType<typeof CardZoomModal>>('cardZoom');
    // INSPECT DOSSIER: LB/RB switch the ПРАВИЛА/СТАТИСТИКА tab (never browse —
    // the inspect list is always ONE card, so prev/next are free here). A
    // repeated press just re-sets the same tab (idempotent, no overlap).
    if (consoleCardZoom.inspect !== undefined) {
      if (intent.kind === 'nav' && (intent.dir === 'left' || intent.dir === 'right')) {
        setConsoleZoomInspectTab(intent.dir === 'left' ? 'rules' : 'history');
        return true;
      }
    }
    if (intent.kind === 'nav') {
      if (intent.dir === 'left') {
        zoom?.prev();
      } else if (intent.dir === 'right') {
        zoom?.next();
      } else {
        // ↑/↓ read the side column — the same body the right stick pages
        // (a long rules set, the statistics tab); a fitting body ignores it.
        scrollZoomSide((intent.dir === 'down' ? 1 : -1) * ZOOM_SIDE_NAV_STEP_PX * conUiScale());
      }
      return true;
    }
    if (intent.kind === 'scroll') {
      // Right-stick pages the RULES BODY, but ONLY when it genuinely
      // overflows (a very long rules set standing beside the availability
      // panel — the one case the side column cannot fit outright). The
      // panel answers false when there is nothing to scroll, and the stick
      // keeps its old meaning: swallowed, so it can never leak to a surface
      // underneath. No new binding, no advertised verb for a journey the
      // player cannot make.
      // The stick's dy is a per-frame deflection (−1…1) — scaled to pixels
      // here, or the body crawled under a pixel a frame (it read as dead).
      if (Math.abs(intent.dy) >= 0.05) {
        scrollZoomSide(intent.dy * CONSOLE_SCROLL_STEP_PX * conUiScale());
      }
      return true;
    }
    if (intent.kind !== 'press') {
      return true;
    }
    // L3 = the single-card reveal ROLE SWAP (received ⇄ source) on the SAME
    // viewer (screen-specific stick, before the semantic-action switch).
    if (intent.button === 'stickL' && consoleCardZoom.swap !== undefined) {
      zoomSwap();
      return true;
    }
    // R3 = peek the conditional-search DISCARD pile from the single-card
    // fullscreen reveal (parity with the multi-card modal's R3). The bridge
    // REPLACES the viewer with the read-only pile; B returns to the mandatory
    // received card. Guarded against a mid-swap crossfade.
    if (intent.button === 'stickR' && consoleCardZoom.discards !== undefined && !zoomSwapping.value) {
      consoleCardZoom.discards();
      return true;
    }
    switch (consoleActionOf(intent)) {
    case 'prevSection':
      // In the inspect dossier LB switches to ПРАВИЛА (else browse prev).
      if (consoleCardZoom.inspect !== undefined) {
        setConsoleZoomInspectTab('rules');
      } else {
        zoom?.prev();
      }
      return true;
    case 'nextSection':
      // In the inspect dossier RB switches to СТАТИСТИКА (else browse next).
      if (consoleCardZoom.inspect !== undefined) {
        setConsoleZoomInspectTab('history');
      } else {
        zoom?.next();
      }
      return true;
    case 'primary':
      // A = take the on-screen card (RECEIVE bridge) OR toggle the pick
      // (selection contexts) OR fire the context ACTION (play-from-hand
      // parity, P17) — read-only contexts (source viewer) no-op.
      if (consoleCardZoom.vote !== undefined) {
        // The Parliament's vote verb (Turmoil Redux) — the viewer opened
        // from the vote mode sends a delegate to the card on screen.
        zoomSendVote();
      } else if (consoleCardZoom.receive !== undefined) {
        zoomTakeReceived();
      } else if (consoleCardZoom.select !== undefined) {
        zoomToggleSelect();
      } else {
        zoomExecuteAction();
      }
      return true;
    case 'nextTab': {
      // RT = take all (RECEIVE bridge only). Same premium parity as the
      // single take: CLOSE the viewer first (the card flies back to its
      // slot), THEN run the reveal modal's own group collect — never a
      // bare state jump. Otherwise the viewer owns RT.
      const r = consoleCardZoom.receive;
      if (r?.takeAll !== undefined && !zoomClosing.value) {
        const takeAll = r.takeAll;
        void closeZoomViewer().then(() => takeAll());
      }
      return true;
    }
    case 'inspect': // X closes too — the same key that opened it
    case 'back':
      // A MANDATORY viewer (single-card reveal) cannot be closed — the only
      // completion is taking the received card (A). Swallow B / X so the
      // player can never return to the game with the card untaken; the swap
      // (L3) is the only way to look at the source and back.
      if (consoleCardZoom.mandatory) {
        return true;
      }
      void closeZoomViewer();
      return true;
    default:
      return true; // the viewer owns ALL input while open
    }
  }

  /**
   * L3 single-card reveal ROLE SWAP — flip the fullscreen between the
   * received card and the draw source on the SAME viewer (a soft crossfade,
   * never a nested viewer / recreation). The reveal overlay's `swap()`
   * re-points the module card + bridges; `playZoomSwap` crossfades the stage
   * and re-fits (the paired card can size differently). Re-entrant-guarded
   * so rapid L3 gives clean flips, not a mid-animation stutter.
   */
  function zoomSwap(): void {
    const swap = consoleCardZoom.swap;
    if (swap === undefined || zoomClosing.value || zoomSwapping.value) {
      return;
    }
    const zoom = shell.surfaces.at<InstanceType<typeof CardZoomModal>>('cardZoom');
    zoomSwapping.value = true;
    void playZoomSwap(zoom?.$el as HTMLElement | undefined, () => swap.swap(), () => zoom?.fitCardToViewport())
      .then(() => {
        zoomSwapping.value = false;
      });
  }

  function zoomToggleSelect(): void {
    const z = consoleCardZoom;
    if (z.select !== undefined && z.card !== undefined) {
      z.select.toggle(z.card.name as CardName);
    }
  }

  /**
   * The RECEIVE bridge A-verb — take the inspected card from FULLSCREEN.
   * PREMIUM PARITY: never a bare state jump — the viewer CLOSES first (the
   * card flies back into its reveal slot, choreographed), THEN the opener
   * runs the SAME premium take the reveal modal uses (the hand intake —
   * the card lifts off the slot and lays into the hand dock). So a
   * fullscreen take is the identical physical pipeline as an in-modal
   * take. Re-entrant safe (`zoomClosing` guards a double press mid-flight).
   */
  function zoomTakeReceived(): void {
    const r = consoleCardZoom.receive;
    if (r === undefined || zoomClosing.value) {
      return;
    }
    const idx = consoleCardZoom.index;
    const zoom = shell.surfaces.at<InstanceType<typeof CardZoomModal>>('cardZoom');
    if (r.departFromFullscreen === true) {
      // SINGLE-CARD reveal: the card departs from fullscreen INTO THE HAND
      // — playZoomDepart hands the flight to the hand-intake director (the
      // proxy takes over at the stage rect; the dialog closes in that same
      // paint via the staged callback, so the top layer never covers the
      // flight) and the card arcs into the dock, flipping to its back.
      // `takeAt` is the reveal overlay's bare commit — fired as the flight
      // begins; the counter ticks only on the touchdown.
      const card = consoleCardZoom.card;
      if (card === undefined) {
        r.takeAt(idx);
        zoom?.close();
        return;
      }
      zoomFlight.value = true;
      zoomClosing.value = true;
      void playZoomDepart(zoom?.$el as HTMLElement | undefined, card.name as CardName, () => r.takeAt(idx), () => zoom?.close());
      return;
    }
    // MULTI-CARD: close back to the strip slot first, then the reveal modal's
    // own premium take (the hand intake) lifts the card off the slot.
    void closeZoomViewer().then(() => r.takeAt(idx));
  }

  /** P17: the viewer's A hands the card to the context action. Two paths:
   *  - HANDOFF (the action opens a surface showing this card, e.g. the
   *    play-confirm composer): execute FIRST — the composer mounts UNDER
   *    the top-layer dialog — then the fullscreen card FLIES INTO the
   *    composer's card slot and the viewer closes on landing. The card
   *    visibly travels fullscreen → modal, never "back to the table".
   *  - default: the viewer closes first (flight included), so the exact
   *    source context restores underneath the follow-up surface. */
  function zoomExecuteAction(): void {
    const z = consoleCardZoom;
    const card = z.card;
    const action = z.action;
    if (card === undefined || action === undefined || action.labelFor(card.name as CardName) === undefined) {
      return;
    }
    const handoffSel = action.handoffTarget?.(card.name as CardName);
    const zoom = shell.surfaces.at<InstanceType<typeof CardZoomModal>>('cardZoom');
    if (handoffSel !== undefined && zoom !== undefined) {
      action.execute(card.name as CardName);
      zoomFlight.value = true;
      zoomClosing.value = true;
      void playZoomHandoff(zoom.$el as HTMLElement | undefined, () => document.querySelector<HTMLElement>(handoffSel))
        .then(() => zoom.close());
      return;
    }
    void closeZoomViewer().then(() => action.execute(card.name as CardName));
  }

  /**
   * A = SEND THE DELEGATE (Turmoil Redux) — one vote operation, two doors.
   * The index of the card ON SCREEN is taken at the press (after any paging),
   * the viewer flies the card home into its slot, and only then does the vote
   * mode's own submit run (the same snapshot, answer handling and delegate
   * flight as its confirm). A press that cannot send stays in the viewer and
   * nudges the reason; a second press while the card flies is swallowed by
   * the close (`zoomClosing`), and the mode's submit refuses outside its
   * vote stage — a held or doubled A can never send twice.
   */
  function zoomSendVote(): void {
    const z = consoleCardZoom;
    const vote = z.vote;
    const verb = zoomVoteVerb.value;
    if (vote === undefined || verb === undefined || zoomClosing.value || zoomOpening.value) {
      return;
    }
    if (!verb.available) {
      zoomVoteNudge.value++;
      return;
    }
    const index = z.index;
    void closeZoomViewer().then(() => vote.execute(index));
  }

  /**
   * Choreographed close: the chrome hides, the card flies back into the
   * CURRENT card's slot (physical origin) or dives away (textual/none),
   * THEN the dialog actually closes. Re-entrant safe (playZoomClose
   * resolves immediately while a close is already in flight; dialog.close
   * self-guards on `open`).
   */
  async function closeZoomViewer(): Promise<void> {
    const zoom = shell.surfaces.at<InstanceType<typeof CardZoomModal>>('cardZoom');
    if (zoom === undefined) {
      return;
    }
    const dialogEl = zoom.$el as HTMLDialogElement | undefined;
    // Closed during the OPEN flight (dialog never shown): abort the flight
    // and unwind directly — `dialog.close()` would no-op and the 'close'
    // event (the normal state unwinder) would never fire.
    if (zoomOpening.value && dialogEl?.open !== true) {
      cancelZoomOpen();
      onCardZoomClosed();
      return;
    }
    zoomFlight.value = true;
    zoomClosing.value = true;
    try {
      await playZoomClose(dialogEl as HTMLElement | undefined, consoleCardZoom.index);
      zoom.close();
    } finally {
      // THE CARD IS HOME — THE PAD IS BACK IN THE SAME TASK. The dialog's 'close' event (the usual unwinder) is a
      // QUEUED task: until it ran, `zoomClosing` stood with the viewer already gone and swallowed the next press — a
      // B meant for the surface beneath (CI 42223555435: «РАЗЫГРАНО»'s category never closed on a starved frame).
      // The late event is inert: the unmounted modal emits nothing (CardZoomModal), and the reset is idempotent.
      // In a `finally`: a viewer unmounted under the close beat threw here and left the flag standing — a deaf screen
      // (the monkey's DUO walk, `[page-error] … reading 'open'`).
      if (zoomClosing.value) {
        onCardZoomClosed();
      }
    }
  }

  // P13: the fullscreen viewer is a native <dialog> - open it on the
  // undefined->defined transition only (navigation keeps it open).
  // The open CHOREOGRAPHY (consoleZoomMotion): the landing geometry is
  // measured on the still-CLOSED dialog, the premium lift flies a PROXY
  // on a normal fixed layer, and `showModal()` fires only at touchdown —
  // the dialog's first top-layer frame is the final, fully-visible
  // content (the compositor-safe shape; see consoleZoomMotion.ts header).
  // The chrome stays hidden (`--flight`, set BEFORE anything renders) and
  // fades in once the card has landed.
  function whenConsoleCardZoomCardChanges(card: ZoomCard | undefined, prev: ZoomCard | undefined): void {
    if (card !== undefined && prev === undefined) {
      zoomFlight.value = true;
      zoomClosing.value = false;
      // Mark opening SYNCHRONOUSLY here (not inside the async runZoomOpen):
      // from this instant the dialog is rendered-but-CLOSED and the landing
      // measure runs over several frames. A B press in that window must hit
      // the `zoomOpening` branch (→ cancel the open) — NOT the normal close
      // path, which would run playZoomClose over a display:none dialog (rect
      // 0×0 → dive → zoom.close() no-op → no 'close' event → zoomClosing
      // stuck true → "B closes only on the second press"). Set it before the
      // nextTick so no intent can land in the gap.
      zoomOpening.value = true;
      // The ideological focus moves to the fullscreen inspector: the
      // background focus chrome (slot rings, «A …» chips, the gliding
      // frame) goes quiet while the viewer is open.
      document.body.classList.add('con-zoom-open');
      // Bounded-retry open: on a heavy first-open frame (cold session — chunk
      // eval / style recalc in the same tick) the ref/$el may not be ready at
      // nextTick yet; a silent no-op here left the zoom state stuck open over
      // NOTHING (the "first fullscreen shows nothing" bug). Retry a few
      // frames; give up cleanly by rolling the zoom state back.
      const tryOpen = (attempt: number) => {
        if (consoleCardZoom.card === undefined) {
          return; // closed before it ever opened
        }
        const zoom = shell.surfaces.at<InstanceType<typeof CardZoomModal>>('cardZoom');
        const el = zoom?.$el as HTMLElement | undefined;
        if (zoom === undefined || el === undefined || typeof el.querySelector !== 'function') {
          if (attempt < 10) {
            probeTick(() => tryOpen(attempt + 1));
          } else {
            onCardZoomClosed(); // never strand an open-but-empty zoom state
          }
          return;
        }
        void runZoomOpen(zoom);
      };
      void shell.$nextTick(() => tryOpen(0));
    }
  }

  // ── lifecycle ────────────────────────────────────────────────────────────────────────────────────────────────────
  // THE VIEWER'S FLIGHT IS A DELIBERATE SWALLOW — on the ledger, so a press it took is pressed again once it landed.
  // The controller registers its own gate for the shell's mounted life (it was a row of the shell's `mounted`).
  let zoomFlightAbsorbOff: (() => void) | undefined;
  onMounted(() => {
    zoomFlightAbsorbOff = registerInputAbsorber(ZOOM_FLIGHT_ABSORBER,
      () => consoleCardZoom.card !== undefined && (zoomClosing.value || zoomOpening.value), {scope: 'all'});
  });
  onBeforeUnmount(() => {
    zoomFlightAbsorbOff?.();
    zoomFlightAbsorbOff = undefined;
  });

  return {
    zoomFlight,
    zoomClosing,
    zoomSwapping,
    zoomOpening,
    zoomOpenProxy,
    zoomVoteNudge,
    zoomOpenToken,
    zoomHasRules,
    zoomCoveredRequirements,
    zoomSideVisible,
    zoomTargetDossier,
    zoomCardForYouAnnotations,
    zoomTenderAnnotations,
    zoomParliamentAnnotations,
    zoomResolutionId,
    zoomPartyOpen,
    zoomPartyAccess,
    zoomResolutionParty,
    zoomResolutionStatus,
    zoomResolutionContextKey,
    zoomResolutionYields,
    zoomResolutionSubject,
    zoomResolutionSubjectName,
    zoomResolutionLevy,
    zoomResolutionSupport,
    zoomResolutionWorld,
    zoomResolutionTier,
    zoomVoteVerb,
    zoomVoteDetailLines,
    zoomBotCorpHolding,
    zoomBotCorpAnnotations,
    zoomBotDividendReading,
    zoomBotDividendGroupId,
    zoomAvailabilityView,
    zoomRulesCardName,
    zoomSelectable,
    zoomSelected,
    zoomSelectLabel,
    zoomDeselectLabel,
    zoomActionLabel,
    zoomReceiveLabel,
    zoomTakeAllLabel,
    zoomStatusLabel,
    zoomDiscardVerdict,
    zoomRejectedTagClasses,
    zoomProvenance,
    zoomSwapLabel,
    zoomSwapOtherName,
    zoomReceivedCount,
    zoomSourceInfo,
    zoomDiscardsAvailable,
    zoomReasons,
    zoomVerdictTagStyle,
    zoomVerdictTagName,
    onCardZoomNavigate,
    runZoomOpen,
    clearZoomOpenFlight,
    onCardZoomClosed,
    scrollZoomSide,
    handleZoomIntent,
    zoomSwap,
    zoomToggleSelect,
    zoomTakeReceived,
    zoomExecuteAction,
    zoomSendVote,
    closeZoomViewer,
    whenConsoleCardZoomCardChanges,
  };
}

export type ViewerController = ReturnType<typeof createViewerController>;

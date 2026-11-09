// Campaign mode — the server-authoritative campaign registry
// (docs/CAMPAIGN_MODE_ARCHITECTURE.md §2.6–§2.9). Structurally modeled on
// RematchManager (singleton, per-viewer models, in-process race guards) but
// PERSISTENCE-BACKED: every mutation is written through IDatabase before the
// mutating call returns, so campaigns survive restarts — the property a
// rematch offer deliberately does not have.
//
// Invariants owned here (each guarded by tests/campaign/*):
//   1. ≤1 active mission; missions launch strictly in slot order.
//   2. Creation is durably idempotent: the CampaignId derives from the
//      client's idempotency key, so a retry converges on the same document.
//   3. Mission launch: the GAME is persisted before the campaign pointer —
//      the campaign never references a game that isn't on disk.
//   4. Result commit is idempotent and re-derivable from the terminal game
//      (lazy reconciliation on read heals a crash between END and commit).
//   5. Carryover cards are validated against the recorded terminal hand,
//      owner-only, and consumed atomically by the next launch.

import {createHash} from 'crypto';
import {CardName} from '../../common/cards/CardName';
import {BoardName} from '../../common/boards/BoardName';
import {RandomBoardOption} from '../../common/boards/RandomBoardOption';
import {PLAYER_COLORS} from '../../common/Color';
import {NewGameConfig} from '../../common/game/NewGameConfig';
import {CampaignId, GameId, PlayerId, isCampaignId, isGameId, isPlayerId, isSpectatorId, safeCast} from '../../common/Types';
import {normalizePlayerName, validatePlayerName} from '../../common/utils/playerName';
import {SeededRandom, UnseededRandom} from '../../common/utils/Random';
import {AUTOMA_SUPPORTED_BOARDS} from '../../common/automa/automaCompatibility';
import {MarsBotCorpId, marsBotCorpInfo} from '../../common/automa/MarsBotCorpData';
import {drawBotHoldings, holdingsForSlot} from './botPortfolio';
import {
  CAMPAIGN_GENERATOR_VERSION,
  CAMPAIGN_MISSION_COUNT,
  isCampaignMissionCount,
  CampaignSeat,
  MissionResult,
  MissionSlotState,
  TitleEntry,
  campaignFinalePicksCorporation,
} from '../../common/campaign/CampaignTypes';
import {FINAL_MISSION_AWARDS_TITLES, TITLE_TABLE, bonusForPlace, titleForPlace} from '../../common/campaign/campaignConfig';
import {CampaignCarryoverModel, CampaignMissionModel, CampaignModel, MissionResultModel} from '../../common/campaign/CampaignModel';
import {CampaignSummaryModel, CampaignViewerState} from '../../common/campaign/CampaignSummary';
import {Color} from '../../common/Color';
import {isAdminName} from '../../common/utils/adminName';
import {Phase} from '../../common/Phase';
import {boardOptions} from '../boards/randomBoard';
import {drawCampaignRoute} from './campaignRoute';
import {newPrelude, newProjectCard} from '../createCard';
import {CardType} from '../../common/cards/CardType';
import {Resource} from '../../common/Resource';
import {PRELUDE_CARDS_DEALT_PER_PLAYER} from '../../common/constants';
import {
  BiddingState,
  CampaignRewardMode,
  CampaignTenderOffer,
  DEFAULT_CAMPAIGN_TENDER_OFFER,
  TENDER_COMPENSATION_MC,
  TenderHolding,
  TenderId,
  biddingOfferSize,
  biddingPickers,
  biddingOpenCards,
  biddingTurnSeat,
  botTenderPick,
  isCampaignRewardMode,
  isCampaignTenderOffer,
  isTenderId,
  tenderDef,
} from '../../common/campaign/tenders';
import {BiddingModel} from '../../common/campaign/CampaignModel';
import {advanceBots, applyBid, biddingHoldings, biddingOrder, dealTenderOffer, openBidding} from './tenderBidding';
import {TenderApplicabilityContext, tenderApplicable} from './tenderWindows';
import {marsBotOf} from '../automa/AutomaUtil';
import {Database} from '../database/Database';
import {GameLoader} from '../database/GameLoader';
import {Game} from '../Game';
import {GameCards} from '../GameCards';
import {generateGameName} from '../GameName';
import {gameOptionsFromNewGameConfig} from '../game/newGameConfigToOptions';
import {CampaignGameContract, CampaignGrant} from '../game/GameOptions';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {LobbyIndex} from '../models/lobbyIndex';
import {Player} from '../Player';
import {generateRandomId} from '../utils/server-ids';
import {CarryoverSeatState, SerializedCampaign, SerializedMissionSlot} from './Campaign';
import {computeMissionStandings} from './missionStandings';
import {boardAlwaysDrawsMA, missionRandomMA, missionShuffleMap, rollSlotModifiers, slotModifiersOf} from './missionModifiers';
import {RandomMAOptionType} from '../../common/ma/RandomMAOptionType';
import {
  DEFAULT_CAMPAIGN_RANDOM_MA_CHANCE,
  DEFAULT_CAMPAIGN_SHUFFLE_MAP_CHANCE,
  RANDOM_MA_MODIFIER,
  hasMissionModifier,
  isCampaignModifierChance,
} from '../../common/campaign/missionModifiers';

/** Campaign-only creation choices — never part of the frozen game settings. */
export type CampaignCreateOptions = {
  /** Percent; one of `CAMPAIGN_MODIFIER_CHANCES` (anything else → the default). */
  randomMAChance?: number;
  /** Percent; one of `CAMPAIGN_MODIFIER_CHANCES` (anything else → the default). */
  shuffleMapChance?: number;
  /** The route's length; one of `CAMPAIGN_MISSION_COUNTS` (anything else → `CAMPAIGN_MISSION_COUNT`). The last is the finale. */
  missionCount?: number;
  /** How the campaign rewards a mission's placement (anything else → `titles`). */
  rewardMode?: CampaignRewardMode;
  /** The «Тендеры» mode: how many tenders a bidding deals (anything else → `minusOne`). */
  tenderOffer?: CampaignTenderOffer;
};
import {carryoverLimitFor, carryoverLimitOf} from './carryoverLimit';

/** The ONE reader of a document's reward mode — a document written before the mode existed is a titles campaign. */
export function campaignRewardMode(campaign: Pick<SerializedCampaign, 'rewardMode'>): CampaignRewardMode {
  return campaign.rewardMode ?? 'titles';
}

/** The ONE reader of a document's offer rule — a document written before the dial existed deals `seats − 1`. */
export function campaignTenderOffer(campaign: Pick<SerializedCampaign, 'tenderOffer'>): CampaignTenderOffer {
  return campaign.tenderOffer ?? DEFAULT_CAMPAIGN_TENDER_OFFER;
}

/** A float seed per (campaign, mission) for the bidding's lots — `SeededRandom` wants a fraction, never an integer. */
function biddingSeedFor(campaignSeed: number, slot: number): number {
  const mixed = (campaignSeed + 0.7548776662 * (slot + 1)) % 1;
  return mixed < 0 ? mixed + 1 : mixed;
}

/**
 * The seat's carry limit as the «Тендеры» mode reads it before the FINALE:
 * the stored base plus one seat per held «Расширенное наследие». Every other
 * interlude (and every titles campaign) reads the base alone.
 */
export function carryoverLimitWithTenders(campaign: SerializedCampaign, seat: number, state: Pick<CarryoverSeatState, 'limit'>, sourceSlot: number): number {
  return carryoverLimitOf(state) + tenderSeatsOf(campaign, seat, sourceSlot);
}

/** The carryover INTO the finale is the ONE step a legacy-window tender speaks on. */
function legacyTenderStep(campaign: SerializedCampaign, sourceSlot: number): boolean {
  return campaignRewardMode(campaign) === 'tenders' && sourceSlot === campaign.missions.length - 2;
}

/**
 * The seat's EXECUTED copies of a tender. A legacy tender is ACTIVATED on the carryover step (`executeLegacyTender`,
 * the owner 2026-11-08: the activation opens the slot and is felt) — never «used» silently by what the seat carried.
 */
function executedTenderCount(campaign: SerializedCampaign, seat: number, id: TenderId): number {
  return (campaign.progression.tenders?.[seat] ?? []).filter((h) => h.id === id && h.status === 'executed').length;
}

/** How many legacy seats the ACTIVATED «Расширенное наследие» tenders add on the carryover INTO the finale. */
function tenderSeatsOf(campaign: SerializedCampaign, seat: number, sourceSlot: number): number {
  return legacyTenderStep(campaign, sourceSlot) ? executedTenderCount(campaign, seat, 'extendedLegacy') : 0;
}

/** How many played preludes the ACTIVATED «Продление программы» tenders carry on the carryover INTO the finale. */
function tenderPreludeLimitOf(campaign: SerializedCampaign, seat: number, sourceSlot: number): number {
  return legacyTenderStep(campaign, sourceSlot) ? executedTenderCount(campaign, seat, 'programExtension') : 0;
}

/** The reasons a HELD tender cannot be activated on a carryover step — English i18n keys the certificate prints as they are. */
export const TENDER_LEGACY_REFUSAL = {
  startWindow: 'Executed at the finale\'s start',
  notTheFinaleStep: 'Its window is the legacy step before the finale',
  noPreludePlayed: 'You played no prelude in that mission',
} as const;

/**
 * WHY a held tender cannot be activated on THIS carryover step — `undefined` = it can. ONE reader for the model
 * (`carryover.yourTenders[].blocked` — the portfolio prints it) and for `executeLegacyTender` (the refusal), so the
 * client never derives availability (invariant 2).
 */
export function legacyTenderRefusal(campaign: SerializedCampaign, seat: number, sourceSlot: number, holding: Pick<TenderHolding, 'id'>): string | undefined {
  if (tenderDef(holding.id).window === 'start') {
    return TENDER_LEGACY_REFUSAL.startWindow;
  }
  if (!legacyTenderStep(campaign, sourceSlot)) {
    return TENDER_LEGACY_REFUSAL.notTheFinaleStep;
  }
  if (holding.id === 'programExtension' && (campaign.missions[sourceSlot]?.finalPreludes?.[seat] ?? []).length === 0) {
    return TENDER_LEGACY_REFUSAL.noPreludePlayed;
  }
  return undefined;
}

export class CampaignManager {
  private static instance: CampaignManager | undefined;

  private readonly cache = new Map<CampaignId, SerializedCampaign>();
  /** Same-process race guards (double-tap within one event-loop turn). */
  private readonly creating = new Set<CampaignId>();
  private readonly launching = new Set<CampaignId>();

  public static getInstance(): CampaignManager {
    if (CampaignManager.instance === undefined) {
      CampaignManager.instance = new CampaignManager();
    }
    return CampaignManager.instance;
  }

  /** Test-only: drop all in-memory state (the database is the truth anyway). */
  public static resetForTesting(): void {
    CampaignManager.instance = undefined;
  }

  /** Deterministic id from the client's idempotency key — the durable half of create-idempotency. */
  public static campaignIdForKey(key: string): CampaignId {
    const hash = createHash('sha256').update(key).digest('hex').slice(0, 12);
    return safeCast('c' + hash, isCampaignId);
  }

  // -------------------------------------------------------------- loading --

  public async load(id: CampaignId): Promise<SerializedCampaign | undefined> {
    const cached = this.cache.get(id);
    if (cached !== undefined) {
      if (cached.deletingAtMs !== undefined) {
        await this.resumeDeletion(cached);
        return undefined;
      }
      await this.reconcile(cached);
      return cached;
    }
    try {
      const stored = await Database.getInstance().getCampaign(id);
      if (stored === undefined) {
        return undefined;
      }
      this.cache.set(id, stored);
      if (stored.deletingAtMs !== undefined) {
        // Crash-recovery: a tombstoned campaign resumes its cascade on the
        // very next read and is invisible to the reader either way.
        await this.resumeDeletion(stored);
        return undefined;
      }
      await this.reconcile(stored);
      return stored;
    } catch (err) {
      return undefined;
    }
  }

  private async save(campaign: SerializedCampaign): Promise<void> {
    campaign.rev++;
    this.cache.set(campaign.id, campaign);
    await Database.getInstance().saveCampaign(campaign);
    this.notify(campaign);
    this.touchLobby();
  }

  /** Campaign mutations bump the LOBBY revision, so lobby subscribers (the
   *  «Мои кампании» list included) learn of the change by push, not by poll. */
  private touchLobby(): void {
    try {
      LobbyIndex.getInstance().touch();
    } catch (err) {
      // Realtime is an accelerator, never a dependency.
    }
  }

  /** Best-effort realtime nudge: the campaign's OWN room hears the new
   *  revision (the map/interlude push channel — what makes «готов →
   *  авто-заход» immediate), and cached mission games are invalidated so
   *  their subscribers refresh. The campaign map still polls as the bounded
   *  fallback. */
  private notify(campaign: SerializedCampaign): void {
    try {
      const {RealtimeHub} = require('../server/realtime/RealtimeHub');
      RealtimeHub.getInstance().invalidateCampaign(campaign.id, campaign.rev);
      const loader = GameLoader.getInstance();
      for (const slot of campaign.missions) {
        if (slot.gameId === undefined) {
          continue;
        }
        const game = loader.peek(slot.gameId);
        if (game !== undefined) {
          RealtimeHub.getInstance().invalidate({gameId: game.id, gameAge: game.gameAge, undoCount: game.undoCount, phase: game.phase});
        }
      }
    } catch (err) {
      // Realtime is an accelerator, never a dependency.
    }
  }

  /**
   * Lazy reconciliation (invariant 4): a mission game that reached Phase.END
   * without a committed slot result (crash between the END save and the
   * campaign save) commits on the next campaign read.
   */
  private async reconcile(campaign: SerializedCampaign): Promise<void> {
    if (campaign.phase !== 'missionActive') {
      return;
    }
    const slot = campaign.missions[campaign.pointer];
    if (slot?.gameId === undefined || slot.result !== undefined) {
      return;
    }
    try {
      const game = await GameLoader.getInstance().getGame(slot.gameId);
      if (game !== undefined && game.phase === Phase.END) {
        await this.commitMissionResult(game);
      }
    } catch (err) {
      // The mission game may be unreachable (purged); the map surfaces that.
    }
  }

  // ------------------------------------------------------------- creation --

  public async createCampaign(key: string, config: NewGameConfig, options: CampaignCreateOptions = {}): Promise<SerializedCampaign> {
    const id = CampaignManager.campaignIdForKey(key);
    const existing = await this.load(id);
    if (existing !== undefined) {
      return existing; // Durable idempotency: a retry converges here.
    }
    if (this.creating.has(id)) {
      throw new Error('Campaign creation is already in progress');
    }
    this.creating.add(id);
    try {
      const again = await this.load(id);
      if (again !== undefined) {
        return again;
      }
      const campaign = this.buildCampaign(id, config, options);
      await this.save(campaign);
      return campaign;
    } finally {
      this.creating.delete(id);
    }
  }

  private buildCampaign(id: CampaignId, config: NewGameConfig, options: CampaignCreateOptions): SerializedCampaign {
    const hasBot = config.automa !== undefined;
    const humans = config.players;
    if (humans.length < 1 || humans.length > 5) {
      throw new Error('A campaign seats 1-5 human players');
    }
    const totalSeats = humans.length + (hasBot ? 1 : 0);
    if (totalSeats < 2 || totalSeats > 5) {
      throw new Error('A campaign needs 2-5 participants');
    }
    const seen = new Set<string>();
    for (const p of humans) {
      const validation = validatePlayerName(p.name);
      if (validation.ok !== true) {
        throw new Error(`Invalid player name: ${p.name}`);
      }
      const norm = normalizePlayerName(p.name);
      // Unique normalized names are load-bearing: seat resolution across four
      // mission games is name-keyed (same rule as «Мои партии»).
      if (seen.has(norm)) {
        throw new Error('Campaign participants must have distinct names');
      }
      seen.add(norm);
    }
    const colors = new Set(humans.map((p) => p.color));
    if (colors.size !== humans.length) {
      throw new Error('Campaign participants must have distinct colors');
    }

    // The board route: same canonical pool + the same MarsBot narrowing as a
    // single game's random board, drawn WEIGHTED with a finale favourite
    // (`campaignRoute.ts` — generator version 2). The concrete snapshot below
    // is what is authoritative forever; seed/pool/version are provenance.
    // The route's LENGTH is the creator's choice (3–6, the last the finale) —
    // every reader downstream asks `missions.length`, never a constant.
    const missionCount = isCampaignMissionCount(options.missionCount) ? options.missionCount : CAMPAIGN_MISSION_COUNT;
    const pool = boardOptions(RandomBoardOption.ALL, {automa: hasBot});
    if (pool.length < missionCount) {
      throw new Error(`Not enough unique boards for a campaign: ${pool.length} of ${missionCount} required`);
    }
    const seed = Math.random();
    const rng = new SeededRandom(seed);
    const boards = drawCampaignRoute(pool, missionCount, rng);

    this.validateCorporationPool(config, missionCount);

    const seats: Array<CampaignSeat> = humans.map((p, i) => ({
      seat: i,
      kind: 'human' as const,
      name: p.name,
      color: p.color,
      trBoost: Number(p.handicap) || 0,
    }));
    if (hasBot) {
      // The bot's color is deterministic (first free PLAYER_COLORS entry —
      // the same rule AutomaSetup.createBotPlayer applies per game), so the
      // campaign map and every mission agree on it.
      const botColor = PLAYER_COLORS.find((c) => !colors.has(c));
      if (botColor === undefined) {
        throw new Error('No free color for the MarsBot seat');
      }
      seats.push({
        seat: seats.length,
        kind: 'bot',
        name: 'MarsBot',
        color: botColor,
        trBoost: 0,
        botDifficulty: config.automa?.difficulty,
      });
    }

    const frozen: NewGameConfig = {...config, clonedGamedId: undefined, customProjectCards: config.customProjectCards ?? []};

    // The roguelike layer: each slot rolls its modifiers — «Случайные цели и
    // награды», «Случайные места для тайлов» — from the same seeded stream
    // (every roll for every slot, always), each at its chosen chance; 0 when
    // its rule is off. A board with no printed row carries the random set
    // whatever the roll.
    const chanceOf = (on: boolean, chosen: number | undefined, fallback: number): number =>
      on ? (isCampaignModifierChance(chosen) ? chosen : fallback) : 0;
    const randomMAChance = chanceOf(config.randomMA !== undefined && config.randomMA !== RandomMAOptionType.NONE,
      options.randomMAChance, DEFAULT_CAMPAIGN_RANDOM_MA_CHANCE);
    const shuffleMapChance = chanceOf(config.shuffleMapOption === true, options.shuffleMapChance, DEFAULT_CAMPAIGN_SHUFFLE_MAP_CHANCE);
    const missions: Array<SerializedMissionSlot> = boards.map((board, slot) => {
      const rolls = {randomMA: rng.next(), shuffleMap: rng.next()};
      return {slot, board, modifiers: rollSlotModifiers(board, {randomMA: randomMAChance, shuffleMap: shuffleMapChance}, rolls)};
    });

    // The «Тендеры» reward mode: nothing is dealt at creation — every mission's table comes off a FRESH deck
    // shuffled at its commit (`openBiddingFor`), so a titles campaign's route and rolls are byte-identical to before
    // the mode existed, and no deck order ever exists before a mission's results.
    const rewardMode: CampaignRewardMode = isCampaignRewardMode(options.rewardMode) ? options.rewardMode : 'titles';
    // The offer rule (the owner, 2026-11-08): stored only when it is not the default, read through ONE reader.
    const tenderOffer: CampaignTenderOffer = isCampaignTenderOffer(options.tenderOffer) ? options.tenderOffer : DEFAULT_CAMPAIGN_TENDER_OFFER;

    return {
      version: 1,
      id,
      rev: 0,
      name: generateGameName(UnseededRandom.INSTANCE),
      createdTimeMs: Date.now(),
      seats,
      settings: frozen,
      generator: {seed, version: CAMPAIGN_GENERATOR_VERSION, pool: [...pool], randomMAChance, shuffleMapChance},
      missions,
      pointer: 0,
      phase: 'generated',
      // A bot campaign starts its portfolio EMPTY (not absent): absent is the
      // marker of a campaign created before the portfolio existed (D7).
      progression: {
        lineages: {},
        titles: [],
        ...(hasBot ? {botHoldings: []} : {}),
        ...(rewardMode === 'tenders' ? {tenders: {}} : {}),
      },
      ...(rewardMode === 'tenders' ? {rewardMode} : {}),
      ...(rewardMode === 'tenders' && tenderOffer !== DEFAULT_CAMPAIGN_TENDER_OFFER ? {tenderOffer} : {}),
    };
  }

  /**
   * Which tenders this campaign can ever use — computed ONCE from the frozen
   * settings (the pools never change over a campaign's life): the Prelude
   * expansion for every prelude tender, and the pools' sizes for the tenders
   * that widen a deal (`tenderWindows.ts`).
   */
  private tenderApplicability(settings: NewGameConfig, missionCount: number): (id: TenderId) => boolean {
    const options = gameOptionsFromNewGameConfig({...settings, board: BoardName.THARSIS}, BoardName.THARSIS);
    const cards = new GameCards(options);
    const ctx: TenderApplicabilityContext = {
      preludes: options.preludeExtension === true,
      humans: settings.players.length,
      missionCount,
      preludePool: options.preludeExtension === true ? cards.getPreludeCards().length : 0,
      startingPreludes: Math.max(options.startingPreludes ?? 0, PRELUDE_CARDS_DEALT_PER_PLAYER),
      corporationPool: cards.getCorporationCards().length,
      // The finale drafts a corporation when the lineage it meets is short of the company of three (the three-mission route).
      finaleDraftsCorporation: campaignFinalePicksCorporation(missionCount - 1),
      startingCorporations: Math.max(1, options.startingCorporations ?? 2),
    };
    return (id) => tenderApplicable(tenderDef(id), ctx);
  }

  /**
   * The corporation pool must survive the whole campaign: each mission deals
   * `startingCorporations` per human while every previously-acquired corp
   * (up to `missionCount - 2` per human by the last mission that still picks
   * one) + the bot's frozen original AND its holdings' originals (the
   * portfolio) are banned.
   */
  private validateCorporationPool(config: NewGameConfig, missionCount: number): void {
    const options = gameOptionsFromNewGameConfig({...config, board: BoardName.THARSIS}, BoardName.THARSIS);
    const poolSize = new GameCards(options).getCorporationCards().length;
    const humans = config.players.length;
    // The missions that DEAL corporations: every one but the finale — and the finale too when the lineage it meets
    // is still short of the company of three (the three-mission route). Every earlier deal banned one per human.
    const dealingMissions = campaignFinalePicksCorporation(missionCount - 1) ? missionCount : missionCount - 1;
    const worstCaseBans = humans * Math.max(dealingMissions - 1, 0) +
      (config.automa !== undefined ? 1 + holdingsForSlot(missionCount - 1, missionCount) : 0);
    const required = humans * config.startingCorporations + worstCaseBans;
    if (poolSize < required) {
      throw new Error(`Not enough unique corporations for a campaign: ${poolSize} available, ${required} required`);
    }
  }

  // -------------------------------------------------------------- launch --

  public async launchMission(id: CampaignId, viewerName: string): Promise<{campaign: SerializedCampaign, gameId: GameId, yourPlayerId: PlayerId | undefined}> {
    const campaign = await this.load(id);
    if (campaign === undefined) {
      throw new Error('Campaign not found');
    }
    const viewerSeat = this.seatOf(campaign, viewerName);
    if (viewerSeat === undefined || viewerSeat.seat !== 0) {
      throw new Error('Only the campaign creator can launch the mission');
    }
    const slot = campaign.missions[campaign.pointer];
    if (slot === undefined) {
      throw new Error('No mission is ready to launch');
    }
    if (slot.gameId !== undefined) {
      // Idempotent fast path: double-submit / refresh / a second creator
      // client all converge on the one existing mission game.
      return {campaign, gameId: slot.gameId, yourPlayerId: slot.playerIds?.[viewerSeat.seat]};
    }
    if (campaign.phase !== 'generated' && campaign.phase !== 'interlude') {
      throw new Error('No mission is ready to launch');
    }
    if (this.launching.has(id)) {
      throw new Error('Mission launch is already in progress');
    }
    this.launching.add(id);
    try {
      const blockers = this.launchBlockersOf(campaign);
      if (blockers.length > 0) {
        throw new Error(blockers[0]);
      }
      // The «Тендеры» mode: a legacy tender was ACTIVATED on the carryover step (`executeLegacyTender`) — the launch
      // marks nothing; only the tenders still held ride into the finale, where the start's compensation buys them back.
      const game = this.buildMissionGame(campaign, slot);
      // Invariant 3: the GAME is on disk before the campaign points at it.
      await Database.getInstance().saveGame(game);
      slot.gameId = game.id;
      slot.playerIds = {};
      for (const p of game.players) {
        if (p.campaignSeat !== undefined) {
          slot.playerIds[p.campaignSeat] = p.id;
        }
      }
      // Atomically consume the carryover selections this launch applied,
      // and snapshot what actually travelled into this mission — the live
      // carryover window is overwritten by the next commit, so this is the
      // durable per-mission legacy history.
      if (campaign.carryover !== undefined && campaign.carryover.sourceSlot === slot.slot - 1) {
        const carried: Record<number, Array<CardName>> = {};
        for (const [seatKey, state] of Object.entries(campaign.carryover.bySeat)) {
          const seat = Number(seatKey);
          state.consumed = true;
          if (state.cards.length > 0) {
            carried[seat] = [...state.cards];
          }
        }
        slot.carriedBySeat = carried;
      }
      campaign.phase = 'missionActive';
      // The loader learns the game BEFORE the campaign pointer publishes:
      // the moment `save` lands, every other seat's map model names the new
      // gameId/playerIds — a player pressing «Присоединиться» right behind
      // the creator's launch must find `/api/player` already able to serve
      // it (registering after the save was a real 404 window: «Не удалось
      // загрузить данные партии» on the second seat's join).
      await GameLoader.getInstance().add(game);
      await this.save(campaign);
      return {campaign, gameId: game.id, yourPlayerId: slot.playerIds[viewerSeat.seat]};
    } finally {
      this.launching.delete(id);
    }
  }

  private buildMissionGame(campaign: SerializedCampaign, slot: SerializedMissionSlot): IGame {
    const settings = campaign.settings;
    const final = slot.slot === campaign.missions.length - 1;
    const humanSeats = campaign.seats.filter((s) => s.kind === 'human');
    const botSeat = campaign.seats.find((s) => s.kind === 'bot');

    // Pool exclusions (§6.5): Merger always; every acquired corporation of
    // every seat; the bot's frozen human twin. All through the ONE existing
    // filter (bannedCards → GameCards.filterBannedCards).
    const banned = new Set<CardName>(settings.bannedCards);
    banned.add(CardName.MERGER);
    for (const lineage of Object.values(campaign.progression.lineages)) {
      for (const name of lineage) {
        banned.add(name);
      }
    }
    if (campaign.progression.botCorporation !== undefined) {
      banned.add(marsBotCorpInfo(campaign.progression.botCorporation).original);
    }
    // The bot's portfolio grows with the humans' (missions 2 and 3): a new
    // HOLDING is drawn here, before the deal, and its original leaves the
    // humans' pool like the primary's — a human and the bot never hold one card.
    const holdings = botSeat === undefined ? [] : this.growBotHoldings(campaign, slot);
    for (const holding of holdings) {
      banned.add(marsBotCorpInfo(holding).original);
    }

    // ⚠️ THE CUSTOM/DEV LISTS CAN RESURRECT A BANNED CARD: GameCards applies
    // `filterBannedCards` FIRST and `addCustomCards` (customCorporationsList /
    // customPreludes / customCeos / includedCards / customProjectCards)
    // AFTERWARDS, instantiating any name missing from the pool. The campaign's
    // frozen settings legitimately carry mission-1 dev lists, and by mission 2
    // one of those names can be somebody's LINEAGE corporation (or Merger, or
    // the bot's twin) — physically ONE card that must never re-enter a deck.
    // Sanitize every list against the mission's exclusions. CARRIED project
    // names deliberately STAY in the project lists: a carried card must exist
    // in the pool exactly once (a module-off card can only enter via
    // `includedCards`) so `reserveCarriedProjectCards` can pull that single
    // physical copy out BEFORE any deal — the dev «guarantee» then finds
    // nothing to lift (`Deck.putOnTop` only rearranges, never instantiates)
    // and the carryover keeps absolute priority.
    const stripBanned = (names: ReadonlyArray<CardName> | undefined): Array<CardName> =>
      (names ?? []).filter((n) => !banned.has(n));
    const missionConfig: NewGameConfig = {
      ...settings,
      board: slot.board,
      // The slot's rolled modifier decides — never the frozen rule alone.
      randomMA: missionRandomMA(campaign, slot),
      shuffleMapOption: missionShuffleMap(campaign, slot),
      seed: Math.random(),
      clonedGamedId: undefined,
      bannedCards: [...banned],
      customCorporationsList: stripBanned(settings.customCorporationsList),
      customPreludes: stripBanned(settings.customPreludes),
      customCeos: stripBanned(settings.customCeos),
      customProjectCards: stripBanned(settings.customProjectCards),
      includedCards: stripBanned(settings.includedCards),
    };
    const gameOptions = gameOptionsFromNewGameConfig(missionConfig, slot.board);
    if (gameOptions.automa !== undefined && campaign.progression.botCorporation !== undefined) {
      gameOptions.automa = {
        ...gameOptions.automa,
        corporation: campaign.progression.botCorporation,
        ...(holdings.length > 0 ? {portfolio: [...holdings]} : {}),
      };
    }
    gameOptions.campaign = this.buildContract(campaign, slot.slot, final);

    const carryover = campaign.carryover;
    const players = humanSeats.map((seat) => {
      const player = new Player(seat.name, seat.color, false, seat.trBoost, safeCast(generateRandomId('p'), isPlayerId));
      player.campaignSeat = seat.seat;
      if (carryover !== undefined && carryover.sourceSlot === slot.slot - 1) {
        const state = carryover.bySeat[seat.seat];
        if (state !== undefined && state.cards.length > 0) {
          player.campaignCarriedCards = [...state.cards];
        }
        if (state !== undefined && state.preludes !== undefined && state.preludes.length > 0) {
          player.campaignCarriedPreludes = [...state.preludes];
        }
      }
      // The «Тендеры» mode, the FINALE: the seat's HELD tenders ride into the
      // game as the player's own (the start executes them); a realized or
      // bought-back one has nothing left to do here.
      if (final && campaignRewardMode(campaign) === 'tenders') {
        const held = (campaign.progression.tenders?.[seat.seat] ?? []).filter((t) => t.status === 'held');
        if (held.length > 0) {
          player.campaignTenders = held.map((t) => ({instance: t.instance, id: t.id, status: 'held' as const}));
        }
      }
      return player;
    });

    let firstIdx = 0;
    if (settings.randomFirstPlayer === true) {
      firstIdx = Math.floor(Math.random() * players.length);
    } else {
      const flagged = settings.players.findIndex((p) => p.first === true);
      firstIdx = flagged >= 0 ? flagged : 0;
    }

    const gameId = safeCast(generateRandomId('g'), isGameId);
    const spectatorId = safeCast(generateRandomId('s'), isSpectatorId);
    const game = Game.newInstance(gameId, players, players[firstIdx], spectatorId, gameOptions, Math.random());
    // The bot player is seated inside newInstance — bind its campaign seat now
    // (before the first save below persists it).
    if (botSeat !== undefined) {
      const bot = game.players.find((p) => p.isMarsBot);
      if (bot !== undefined) {
        bot.campaignSeat = botSeat.seat;
      }
      // The «Тендеры» mode: THE BOT ALWAYS CASHES OUT — every tender it took
      // (on denial) is bought back at the finale's launch, the M€ landing in
      // its stock (its leftover M€ score at the end, so the sum is honest
      // and small). Marked here; the launch's save persists it.
      if (final && campaignRewardMode(campaign) === 'tenders') {
        const held = (campaign.progression.tenders?.[botSeat.seat] ?? []).filter((t) => t.status === 'held');
        if (held.length > 0) {
          const bot2 = marsBotOf(game);
          bot2.stock.add(Resource.MEGACREDITS, held.length * TENDER_COMPENSATION_MC, {log: true});
          for (const holding of held) {
            holding.status = 'cashed';
          }
          game.log('${0} received ${1} M€ for ${2} unexecuted tender(s)', (b) => b.player(bot2).number(held.length * TENDER_COMPENSATION_MC).number(held.length));
        }
      }
    }
    return game;
  }

  /**
   * Grow the bot's portfolio to this mission's count (one more per mission
   * after the first, none added on the finale — `holdingsForSlot`) and return it. The draw is the pure
   * `drawBotHoldings` over the campaign's own seed, so a relaunch draws
   * nothing new and a failed launch redraws the same. A campaign created
   * before the portfolio (`botHoldings` absent — D7) and one whose primary is
   * not known yet get none.
   */
  private growBotHoldings(campaign: SerializedCampaign, slot: SerializedMissionSlot): ReadonlyArray<MarsBotCorpId> {
    const progression = campaign.progression;
    const primary = progression.botCorporation;
    if (progression.botHoldings === undefined || primary === undefined) {
      return [];
    }
    const humanCorporations = new Set<CardName>();
    for (const lineage of Object.values(progression.lineages)) {
      for (const name of lineage) {
        humanCorporations.add(name);
      }
    }
    const expansions = gameOptionsFromNewGameConfig({...campaign.settings, board: slot.board}, slot.board).expansions;
    progression.botHoldings = drawBotHoldings({
      slot: slot.slot,
      missionCount: campaign.missions.length,
      primary,
      holdings: progression.botHoldings,
      expansions,
      humanCorporations,
      seed: campaign.generator.seed,
      extraCorporations: campaign.settings.automa?.extraCorporations === true,
    });
    return progression.botHoldings;
  }

  private buildContract(campaign: SerializedCampaign, slot: number, final: boolean): CampaignGameContract {
    const previous = slot > 0 ? campaign.missions[slot - 1].result : undefined;
    const grants: Array<CampaignGrant> = campaign.seats.map((seat) => {
      const bonus = seat.kind === 'human' ?
        (previous?.bonuses.find((b) => b.seat === seat.seat)?.megaCredits ?? 0) :
        0; // The bot never plays a corporation, so a bonus would silently never apply — honesty demands none.
      const rewardMode = campaignRewardMode(campaign);
      const heldTenders = final && rewardMode === 'tenders' && seat.kind === 'human' ?
        (campaign.progression.tenders?.[seat.seat] ?? []).filter((t) => t.status === 'held').map((t) => ({instance: t.instance, id: t.id})) :
        undefined;
      return {
        seat: seat.seat,
        color: seat.color,
        bonusMegaCredits: bonus,
        corporations: seat.kind === 'human' ? [...(campaign.progression.lineages[seat.seat] ?? [])] : [],
        titlePoints: final && rewardMode === 'titles' ? campaign.progression.titles.filter((t) => t.seat === seat.seat)
          .map((t) => ({missionSlot: t.missionSlot, title: t.title, titlePoints: t.titlePoints})) : [],
        ...(heldTenders !== undefined && heldTenders.length > 0 ? {tenders: heldTenders} : {}),
      };
    });
    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      missionSlot: slot,
      missionCount: campaign.missions.length,
      final,
      ...(campaignRewardMode(campaign) === 'tenders' ? {rewardMode: 'tenders' as const} : {}),
      grants,
    };
  }

  // -------------------------------------------------------------- commit --

  public async commitMissionResult(game: IGame): Promise<void> {
    const contract = game.gameOptions.campaign;
    if (contract === undefined) {
      return;
    }
    const campaign = this.cache.get(contract.campaignId) ?? await this.loadWithoutReconcile(contract.campaignId);
    if (campaign === undefined) {
      console.error('Campaign not found for mission commit:', contract.campaignId, game.id);
      return;
    }
    if (campaign.deletingAtMs !== undefined) {
      return; // A dying campaign accepts no new results.
    }
    const slot = campaign.missions[contract.missionSlot];
    if (slot === undefined || slot.gameId !== game.id) {
      return; // Stale or foreign game — never commits.
    }
    if (slot.result !== undefined) {
      return; // Idempotent: the stored snapshot is authoritative.
    }
    const final = contract.final;
    const standings = computeMissionStandings(game);
    const seatCount = campaign.seats.length;
    const humanSeats = new Set(campaign.seats.filter((s) => s.kind === 'human').map((s) => s.seat));
    const tenderMode = campaignRewardMode(campaign) === 'tenders';

    const titles: Array<{seat: number} & TitleEntry> = [];
    const bonuses: Array<{seat: number, megaCredits: number}> = [];
    if (!final || FINAL_MISSION_AWARDS_TITLES) {
      for (const standing of standings) {
        const title = tenderMode ? undefined : titleForPlace(standing.place, seatCount);
        if (title !== undefined && title !== null) {
          titles.push({seat: standing.seat, missionSlot: slot.slot, title, titlePoints: TITLE_TABLE[title].titlePoints});
        }
        // Bonus M€ only for humans: the bot never plays a corporation, so the
        // application point does not exist for it (D5 honesty rule). And only
        // in the TITLES mode: the tenders ARE the reward (the owner, 2026-11-08).
        if (!final && humanSeats.has(standing.seat) && !tenderMode) {
          const bonus = bonusForPlace(standing.place);
          if (bonus > 0) {
            bonuses.push({seat: standing.seat, megaCredits: bonus});
          }
        }
      }
    }

    const result: MissionResult = {
      gameId: game.id,
      committedAtMs: Date.now(),
      gameLastSaveId: game.lastSaveId,
      gameUndoCount: game.undoCount,
      generations: game.generation,
      standings,
      titles,
      bonuses,
      championSeats: final ? standings.filter((s) => s.place === 1).map((s) => s.seat) : undefined,
    };
    slot.result = result;

    // Lineages: the tableau at mission end IS the acquisition-ordered lineage
    // (lineage plays first, the new pick last; Merger is banned in campaigns,
    // so nothing else can add a corporation).
    for (const standing of standings) {
      if (humanSeats.has(standing.seat)) {
        campaign.progression.lineages[standing.seat] = [...standing.corporations];
      }
    }
    if (campaign.progression.botCorporation === undefined && game.automa?.corporation !== undefined) {
      campaign.progression.botCorporation = game.automa.corporation;
    }
    campaign.progression.titles.push(...titles);

    if (final) {
      campaign.phase = 'finished';
      campaign.championSeats = [...(result.championSeats ?? [])];
      campaign.carryover = undefined;
      // The «Тендеры» mode: what each player did with their tenders in the
      // finale is the chronicle's record (executed / bought back).
      if (tenderMode) {
        for (const player of game.players) {
          const seat = player.campaignSeat;
          if (seat === undefined || !humanSeats.has(seat)) {
            continue;
          }
          for (const own of player.campaignTenders ?? []) {
            const holding = campaign.progression.tenders?.[seat]?.find((h) => h.instance === own.instance);
            if (holding !== undefined) {
              holding.status = own.status === 'held' ? 'cashed' : own.status;
            }
          }
        }
      }
    } else {
      // Record the terminal hands (SERVER-PRIVATE) and open the carryover
      // window. EVERY human starts 'pending' — the confirmation doubles as
      // the READINESS regime: the next mission launches only when every
      // human has explicitly confirmed (an empty hand confirms «готов» with
      // zero cards, but the press is still theirs to make).
      slot.finalHands = {};
      if (tenderMode) {
        slot.finalPreludes = {};
      }
      const bySeat: Record<number, CarryoverSeatState> = {};
      for (const player of game.players) {
        const seat = player.campaignSeat;
        if (seat === undefined || !humanSeats.has(seat)) {
          continue;
        }
        const hand = player.cardsInHand.map((c) => c.name);
        slot.finalHands[seat] = hand;
        if (slot.finalPreludes !== undefined) {
          slot.finalPreludes[seat] = player.playedCards.filter((c) => c.type === CardType.PRELUDE).map((c) => c.name);
        }
        bySeat[seat] = {status: 'pending', cards: [], consumed: false, limit: carryoverLimitFor(campaign, seat, slot.modifiers)};
      }
      campaign.carryover = {sourceSlot: slot.slot, bySeat};
      campaign.pointer = slot.slot + 1;
      campaign.phase = 'interlude';
      // The «Тендеры» mode: THE BIDDING opens — the mission's fresh deck deals the table,
      // the standings set the order (a lot inside every full tie), and the bot
      // picks at once wherever its turn comes before a human's.
      if (tenderMode) {
        this.openBiddingFor(campaign, slot, standings);
      }
    }
    await this.save(campaign);
  }

  /** Deal the table, set the order, let the bot pick — the bidding of one committed mission. */
  private openBiddingFor(campaign: SerializedCampaign, slot: SerializedMissionSlot, standings: ReadonlyArray<{seat: number, place: number}>): void {
    const rng = new SeededRandom(biddingSeedFor(campaign.generator.seed, slot.slot));
    const applicable = this.tenderApplicability(campaign.settings, campaign.missions.length);
    // The campaign's OFFER RULE decides the table's size and how many seats take a card (the owner, 2026-11-08); the
    // table comes off THIS mission's fresh deck — one card of every applicable kind, shuffled by the mission's seed.
    const offerRule = campaignTenderOffer(campaign);
    const seatCount = campaign.seats.length;
    const offer = dealTenderOffer(biddingOfferSize(seatCount, offerRule), slot.slot, applicable, rng);
    const {order, lots} = biddingOrder(standings.map((s) => ({seat: s.seat, place: s.place, score: 0, megaCredits: 0, corporations: [], tiedWith: []})), rng);
    const bidding = advanceBots(openBidding(slot.slot, offer, order, lots, biddingPickers(seatCount, offerRule)), (seat) => campaign.seats[seat]?.kind === 'bot');
    this.settleBidding(campaign, bidding);
  }

  /** A finished bidding becomes the slot's record and the seats' holdings; an open one stands on the campaign. */
  private settleBidding(campaign: SerializedCampaign, bidding: BiddingState): void {
    if (!bidding.done) {
      campaign.bidding = bidding;
      return;
    }
    campaign.bidding = undefined;
    const slot = campaign.missions[bidding.sourceSlot];
    if (slot !== undefined) {
      slot.bidding = bidding;
    }
    const tenders = campaign.progression.tenders ?? {};
    for (const {seat, holding} of biddingHoldings(bidding)) {
      const list = tenders[seat] ?? [];
      if (!list.some((h) => h.instance === holding.instance)) {
        list.push(holding);
      }
      tenders[seat] = list;
    }
    campaign.progression.tenders = tenders;
  }

  // ------------------------------------------------------------ bidding --

  /**
   * ONE SEAT'S PICK at the open bidding. The bearer is the picker's PlayerId in
   * the source mission. The pure engine refuses out of turn / a card not on the
   * table; the bot's picks that follow are applied at once; the last pick
   * closes the bidding and records the holdings.
   */
  public async submitBid(id: CampaignId, playerId: PlayerId, instance: string): Promise<{campaign: SerializedCampaign, viewerName: string | undefined}> {
    const campaign = await this.load(id);
    if (campaign === undefined) {
      throw new Error('Campaign not found');
    }
    const bidding = campaign.bidding;
    if (bidding === undefined || bidding.done) {
      throw new Error('No tender bidding is open');
    }
    const sourceSlot = campaign.missions[bidding.sourceSlot];
    const seatEntry = Object.entries(sourceSlot.playerIds ?? {}).find(([, pid]) => pid === playerId);
    if (seatEntry === undefined) {
      throw new Error('Not a participant of the source mission');
    }
    const seat = Number(seatEntry[0]);
    const next = advanceBots(applyBid(bidding, seat, instance), (s) => campaign.seats[s]?.kind === 'bot');
    this.settleBidding(campaign, next);
    await this.save(campaign);
    return {campaign, viewerName: campaign.seats[seat]?.name};
  }

  private async loadWithoutReconcile(id: CampaignId): Promise<SerializedCampaign | undefined> {
    try {
      const stored = await Database.getInstance().getCampaign(id);
      if (stored !== undefined) {
        this.cache.set(id, stored);
      }
      return stored;
    } catch (err) {
      return undefined;
    }
  }

  // ----------------------------------------------------------- carryover --

  /**
   * «ТЕНДЕРЫ» — a LEGACY-window tender is ACTIVATED on the carryover step into the finale (the owner, 2026-11-08: the
   * activation opens the slot — a seat of the manifest, the prelude band — and is felt; nothing is «used» silently).
   * Irreversible: the seat's limit / prelude allowance read the EXECUTED copies from here on. The bearer is the seat's
   * PlayerId in the SOURCE mission (the carryover's own credential).
   */
  public async executeLegacyTender(id: CampaignId, playerId: PlayerId, instance: string): Promise<{campaign: SerializedCampaign, viewerName: string}> {
    const campaign = await this.load(id);
    if (campaign === undefined) {
      throw new Error('Campaign not found');
    }
    const carryover = campaign.carryover;
    if (carryover === undefined || campaign.phase !== 'interlude') {
      throw new Error('No legacy step is open');
    }
    if (campaign.bidding !== undefined && !campaign.bidding.done) {
      throw new Error('The tender bidding must finish first');
    }
    const sourceSlot = campaign.missions[carryover.sourceSlot];
    const seatEntry = Object.entries(sourceSlot.playerIds ?? {}).find(([, pid]) => pid === playerId);
    if (seatEntry === undefined) {
      throw new Error('Not a participant of the source mission');
    }
    const seat = Number(seatEntry[0]);
    const state = carryover.bySeat[seat];
    if (state === undefined) {
      throw new Error('This seat has no carryover selection');
    }
    if (state.consumed) {
      throw new Error('The selection was already applied by the next mission');
    }
    const holding = (campaign.progression.tenders?.[seat] ?? []).find((h) => h.instance === instance);
    if (holding === undefined) {
      throw new Error('You hold no such tender');
    }
    if (holding.status !== 'held') {
      throw new Error('This tender was already executed');
    }
    const refusal = legacyTenderRefusal(campaign, seat, carryover.sourceSlot, holding);
    if (refusal !== undefined) {
      throw new Error(refusal);
    }
    holding.status = 'executed';
    await this.save(campaign);
    return {campaign, viewerName: campaign.seats[seat].name};
  }

  public async submitCarryover(id: CampaignId, playerId: PlayerId, cards: ReadonlyArray<CardName>, preludes: ReadonlyArray<CardName> = []): Promise<SerializedCampaign> {
    const campaign = await this.load(id);
    if (campaign === undefined) {
      throw new Error('Campaign not found');
    }
    const carryover = campaign.carryover;
    if (carryover === undefined || campaign.phase !== 'interlude') {
      throw new Error('No project carryover is open');
    }
    // The «Тендеры» mode: the bidding decides what the legacy may carry — the
    // carryover waits for it (the same readiness regime: everybody waits).
    if (campaign.bidding !== undefined && !campaign.bidding.done) {
      throw new Error('The tender bidding must finish first');
    }
    const sourceSlot = campaign.missions[carryover.sourceSlot];
    const seatEntry = Object.entries(sourceSlot.playerIds ?? {}).find(([, pid]) => pid === playerId);
    if (seatEntry === undefined) {
      throw new Error('Not a participant of the source mission');
    }
    const seat = Number(seatEntry[0]);
    const state = carryover.bySeat[seat];
    if (state === undefined) {
      throw new Error('This seat has no carryover selection');
    }
    if (state.consumed) {
      throw new Error('The selection was already applied by the next mission');
    }
    const limit = carryoverLimitWithTenders(campaign, seat, state, carryover.sourceSlot);
    if (cards.length > limit) {
      throw new Error(`This seat can carry at most ${limit} project card(s) over`);
    }
    if (new Set(cards).size !== cards.length) {
      throw new Error('Duplicate cards in the carryover selection');
    }
    const eligible = sourceSlot.finalHands?.[seat] ?? [];
    const pool = [...eligible];
    for (const name of cards) {
      const idx = pool.indexOf(name);
      if (idx === -1) {
        throw new Error(`Card ${name} was not in your hand at the end of the mission`);
      }
      pool.splice(idx, 1);
      if (newProjectCard(name) === undefined) {
        throw new Error(`Card ${name} is not available in this build`);
      }
    }
    // «Продление программы»: one PLAYED prelude per held copy, from the recorded set.
    const preludeLimit = tenderPreludeLimitOf(campaign, seat, carryover.sourceSlot);
    if (preludes.length > preludeLimit) {
      throw new Error(preludeLimit === 0 ? 'This seat carries no prelude' : `This seat can carry at most ${preludeLimit} prelude(s)`);
    }
    if (new Set(preludes).size !== preludes.length) {
      throw new Error('Duplicate preludes in the carryover selection');
    }
    const playedPreludes = [...(sourceSlot.finalPreludes?.[seat] ?? [])];
    for (const name of preludes) {
      const idx = playedPreludes.indexOf(name);
      if (idx === -1) {
        throw new Error(`Prelude ${name} was not played by you in that mission`);
      }
      playedPreludes.splice(idx, 1);
      if (newPrelude(name) === undefined) {
        throw new Error(`Prelude ${name} is not available in this build`);
      }
    }
    state.cards = [...cards];
    if (preludes.length > 0) {
      state.preludes = [...preludes];
    } else {
      delete state.preludes;
    }
    state.status = 'confirmed';
    await this.save(campaign);
    return campaign;
  }

  // ------------------------------------------------- rollback integration --

  /**
   * Rollback support: revoke the committed result of the CURRENT last mission
   * — allowed only while the NEXT mission does not exist (the admin-rollback
   * guard refuses otherwise). Clears the interlude carryover wholesale and
   * rebuilds the progression from the remaining committed results.
   */
  public async revokeMissionResult(gameId: GameId, campaignId?: CampaignId): Promise<boolean> {
    const candidates: Array<SerializedCampaign> = [];
    if (campaignId !== undefined) {
      const loaded = await this.loadWithoutReconcile(campaignId);
      if (loaded !== undefined) {
        candidates.push(loaded);
      }
    } else {
      candidates.push(...this.cache.values());
    }
    for (const campaign of candidates) {
      if (campaign.deletingAtMs !== undefined) {
        continue;
      }
      const slot = campaign.missions.find((m) => m.gameId === gameId);
      if (slot === undefined || slot.result === undefined) {
        continue;
      }
      const next = campaign.missions[slot.slot + 1];
      if (next?.gameId !== undefined) {
        return false; // The result was already consumed by the next mission.
      }
      slot.result = undefined;
      slot.finalHands = undefined;
      slot.finalPreludes = undefined;
      campaign.carryover = undefined;
      campaign.championSeats = undefined;
      campaign.pointer = slot.slot;
      campaign.phase = 'missionActive';
      // The «Тендеры» mode: the revoked mission's bidding and what it gave are
      // withdrawn (the mission's deck is fresh at every commit — a replayed
      // mission simply deals again).
      if (slot.bidding !== undefined || campaign.bidding?.sourceSlot === slot.slot) {
        slot.bidding = undefined;
        campaign.bidding = undefined;
        const tenders = campaign.progression.tenders;
        if (tenders !== undefined) {
          for (const [seat, list] of Object.entries(tenders)) {
            tenders[Number(seat)] = list.filter((h) => h.wonAtSlot !== slot.slot);
          }
        }
      }
      this.rebuildProgression(campaign);
      await this.save(campaign);
      return true;
    }
    return true; // Unknown game / no committed result — nothing to revoke.
  }

  /** Is a rollback of this game across its END boundary safe for the campaign? */
  public async rollbackGuard(game: IGame): Promise<{allowed: boolean, reason?: string}> {
    const contract = game.gameOptions.campaign;
    if (contract === undefined) {
      return {allowed: true};
    }
    const campaign = await this.load(contract.campaignId);
    if (campaign === undefined) {
      return {allowed: true};
    }
    const slot = campaign.missions[contract.missionSlot];
    if (slot?.result === undefined) {
      return {allowed: true};
    }
    const next = campaign.missions[slot.slot + 1];
    if (next?.gameId !== undefined) {
      return {allowed: false, reason: 'The mission result was already consumed by the next mission'};
    }
    return {allowed: true};
  }

  private rebuildProgression(campaign: SerializedCampaign): void {
    const titles: Array<{seat: number} & TitleEntry> = [];
    const lineages: Record<number, Array<CardName>> = {};
    for (const slot of campaign.missions) {
      const result = slot.result;
      if (result === undefined) {
        continue;
      }
      titles.push(...result.titles.map((t) => ({...t})));
      for (const standing of result.standings) {
        const seat = campaign.seats[standing.seat];
        if (seat?.kind === 'human') {
          lineages[standing.seat] = [...standing.corporations];
        }
      }
    }
    campaign.progression.titles = titles;
    campaign.progression.lineages = lineages;
    if (campaign.missions[0]?.result === undefined) {
      campaign.progression.botCorporation = undefined;
      // No primary, no portfolio — and none can have been drawn: the guard
      // refuses a rollback once the next mission exists.
      if (campaign.progression.botHoldings !== undefined) {
        campaign.progression.botHoldings = [];
      }
    }
  }

  // ------------------------------------------------------------ lifecycle --

  public async abandon(id: CampaignId, viewerName: string): Promise<SerializedCampaign> {
    const campaign = await this.load(id);
    if (campaign === undefined) {
      throw new Error('Campaign not found');
    }
    const seat = this.seatOf(campaign, viewerName);
    if (seat === undefined || seat.seat !== 0) {
      throw new Error('Only the campaign creator can abandon the campaign');
    }
    if (campaign.phase === 'finished') {
      throw new Error('A finished campaign cannot be abandoned');
    }
    campaign.phase = 'abandoned';
    await this.save(campaign);
    return campaign;
  }

  /** D12: creator-only repair of a BLOCKED slot — re-rolls that slot's board
   *  from the current pool, recorded in the chronicle. */
  public async repairSlotBoard(id: CampaignId, viewerName: string, slotIndex: number): Promise<SerializedCampaign> {
    const campaign = await this.load(id);
    if (campaign === undefined) {
      throw new Error('Campaign not found');
    }
    const seat = this.seatOf(campaign, viewerName);
    if (seat === undefined || seat.seat !== 0) {
      throw new Error('Only the campaign creator can repair a mission');
    }
    const slot = campaign.missions[slotIndex];
    if (slot === undefined || slot.gameId !== undefined) {
      throw new Error('Only an unlaunched mission can be repaired');
    }
    const hasBot = campaign.settings.automa !== undefined;
    if (this.boardIsAvailable(slot.board, hasBot)) {
      throw new Error('The mission board is available — nothing to repair');
    }
    const used = new Set(campaign.missions.filter((m) => m !== slot).map((m) => m.board));
    const pool = boardOptions(RandomBoardOption.ALL, {automa: hasBot}).filter((b) => !used.has(b));
    if (pool.length === 0) {
      throw new Error('No replacement board is available');
    }
    const replacement = pool[Math.floor(Math.random() * pool.length)];
    slot.repairs = [...(slot.repairs ?? []), {atMs: Date.now(), fromBoard: slot.board, toBoard: replacement}];
    slot.board = replacement;
    // A replacement with no printed row draws its set — the badge follows.
    if (campaign.generator.randomMAChance !== undefined && boardAlwaysDrawsMA(replacement) &&
      !hasMissionModifier(slot.modifiers, RANDOM_MA_MODIFIER)) {
      slot.modifiers = [...slot.modifiers, {id: RANDOM_MA_MODIFIER}];
    }
    await this.save(campaign);
    return campaign;
  }

  /** Campaign-linked ACTIVE mission games are exempt from the age purge (D11). */
  public async protectedGameIds(): Promise<Array<GameId>> {
    const ids: Array<GameId> = [];
    try {
      const campaignIds = await Database.getInstance().getCampaignIds();
      for (const cid of campaignIds) {
        const campaign = await this.loadWithoutReconcile(cid);
        if (campaign === undefined || campaign.phase === 'finished' || campaign.phase === 'abandoned' ||
            campaign.deletingAtMs !== undefined) {
          continue;
        }
        for (const slot of campaign.missions) {
          if (slot.gameId !== undefined) {
            ids.push(slot.gameId);
          }
        }
      }
    } catch (err) {
      // Fail open: purging proceeds without exemptions rather than crashing.
    }
    return ids;
  }

  // ------------------------------------------------------ list («Мои кампании») --

  /**
   * The participant-scoped campaign list: one SAFE summary per campaign the
   * viewer (by normalized name — the campaign identity model) holds a seat in.
   * `activeColorByGame` is optional live-turn context (the lobby index's
   * `activePlayerColor` per unfinished game) — without it «ваш ход» simply
   * degrades to «миссия идёт». Deterministic base order: newest CREATED
   * first, id as the tiebreak — the order the list shows (the client sorts
   * again by the same rule: LAN rows arrive from several servers).
   */
  public async listSummaries(viewerName: string, activeColorByGame?: ReadonlyMap<GameId, Color>): Promise<Array<CampaignSummaryModel>> {
    const out: Array<CampaignSummaryModel> = [];
    if (viewerName === undefined || normalizePlayerName(viewerName) === '') {
      return out;
    }
    let ids: Array<CampaignId>;
    try {
      ids = await Database.getInstance().getCampaignIds();
    } catch (err) {
      return out;
    }
    for (const id of ids) {
      // `load` reconciles a crashed commit and RESUMES a crashed deletion —
      // a tombstoned campaign therefore never reaches the list.
      const campaign = await this.load(id);
      if (campaign === undefined) {
        continue;
      }
      const summary = this.summaryOf(campaign, viewerName, activeColorByGame);
      if (summary !== undefined) {
        out.push(summary);
      }
    }
    out.sort((a, b) => (b.createdTimeMs - a.createdTimeMs) || a.id.localeCompare(b.id));
    return out;
  }

  /** One campaign's summary for one viewer; `undefined` for a non-participant. */
  public summaryOf(campaign: SerializedCampaign, viewerName: string, activeColorByGame?: ReadonlyMap<GameId, Color>): CampaignSummaryModel | undefined {
    const viewerSeat = this.seatOf(campaign, viewerName);
    if (viewerSeat === undefined) {
      return undefined;
    }
    const completed = campaign.missions.filter((m) => m.result !== undefined);
    const lastActivityMs = completed.reduce((max, m) => Math.max(max, m.result?.committedAtMs ?? 0), campaign.createdTimeMs);
    const currentSlot = campaign.missions[Math.min(campaign.pointer, campaign.missions.length - 1)];
    const missionGameId = campaign.phase === 'missionActive' ? currentSlot?.gameId : undefined;
    const {state, blockedReason} = this.viewerStateOf(campaign, viewerSeat, activeColorByGame);
    return {
      id: campaign.id,
      rev: campaign.rev,
      name: campaign.name,
      createdTimeMs: campaign.createdTimeMs,
      lastActivityMs,
      phase: campaign.phase,
      pointer: campaign.pointer,
      missionCount: campaign.missions.length,
      completedMissions: completed.length,
      missionGamesCount: campaign.missions.filter((m) => m.gameId !== undefined).length,
      currentBoard: currentSlot.board,
      seats: campaign.seats,
      you: {seat: viewerSeat.seat},
      isCreator: viewerSeat.seat === 0,
      state,
      blockedReason,
      missionGameId,
      championSeats: campaign.championSeats,
      yourTitlePoints: campaign.progression.titles
        .filter((t) => t.seat === viewerSeat.seat)
        .reduce((sum, t) => sum + t.titlePoints, 0),
      rewardMode: campaignRewardMode(campaign),
      yourTenders: (campaign.progression.tenders?.[viewerSeat.seat] ?? []).filter((t) => t.status === 'held').length,
    };
  }

  /** Priority-resolved viewer state: the viewer's own required action first. */
  private viewerStateOf(campaign: SerializedCampaign, viewerSeat: CampaignSeat, activeColorByGame?: ReadonlyMap<GameId, Color>): {state: CampaignViewerState, blockedReason?: string} {
    if (campaign.phase === 'abandoned') {
      return {state: 'abandoned'};
    }
    if (campaign.phase === 'finished') {
      return {state: 'finished'};
    }
    if (campaign.phase === 'missionActive') {
      const gameId = campaign.missions[campaign.pointer]?.gameId;
      const activeColor = gameId !== undefined ? activeColorByGame?.get(gameId) : undefined;
      return {state: activeColor !== undefined && activeColor === viewerSeat.color ? 'yourTurn' : 'missionActive'};
    }
    // generated | interlude — the launch window.
    const carryover = campaign.carryover;
    const bidding = campaign.bidding;
    if (bidding !== undefined && !bidding.done && campaign.phase === 'interlude') {
      // The «Тендеры» mode: the open bidding is the viewer's own action only on their turn.
      return {state: biddingTurnSeat(bidding) === viewerSeat.seat ? 'chooseTender' : 'waitingOthers'};
    }
    if (carryover !== undefined && campaign.phase === 'interlude') {
      const own = carryover.bySeat[viewerSeat.seat];
      if (own !== undefined && own.status !== 'confirmed') {
        return {state: 'chooseCarryover'};
      }
    }
    const blockers = this.launchBlockersOf(campaign)
      .filter((b) => b !== 'Waiting for the project carryover selections' && b !== 'Waiting for the tender bidding');
    if (blockers.length > 0) {
      return {state: 'blocked', blockedReason: blockers[0]};
    }
    if (carryover !== undefined && campaign.phase === 'interlude' &&
        Object.values(carryover.bySeat).some((s) => s.status !== 'confirmed')) {
      return {state: 'waitingOthers'};
    }
    return {state: viewerSeat.seat === 0 ? 'launchReady' : 'waitingLaunch'};
  }

  // --------------------------------------------------------- cascade delete --

  /**
   * CREATOR-ONLY cascade delete: the campaign document AND every mission game
   * it verifiably owns. Ordering makes a crash recoverable in every window:
   *   1. the tombstone (`deletingAtMs`) persists BEFORE the first game dies —
   *      from that moment the campaign is invisible and immutable, and any
   *      later read resumes the cascade;
   *   2. each mission game is deleted through the ONE canonical path
   *      (`GameLoader.deleteGame`: cache, purge guard, lobby index, database —
   *      saves, participants, results, completion records) — only after its
   *      OWN `gameOptions.campaign.campaignId` names this campaign. A missing
   *      game is logged and skipped (idempotent repeats); a foreign id in a
   *      corrupted document is NEVER deleted;
   *   3. the campaign document goes last — if any owned game failed to delete
   *      the tombstone survives and the next attempt converges.
   * Repeat calls (double-press, retry after crash, other replicas) are safe:
   * an already-tombstoned campaign just resumes; a fully deleted one answers
   * success with nothing to do.
   */
  public async deleteCampaign(id: CampaignId, viewerName: string): Promise<{deletedGames: Array<GameId>}> {
    const campaign = await this.loadWithoutReconcile(id);
    if (campaign === undefined) {
      return {deletedGames: []}; // Idempotent: already gone.
    }
    if (campaign.deletingAtMs === undefined) {
      const seat = this.seatOf(campaign, viewerName);
      if ((seat === undefined || seat.seat !== 0) && !isAdminName(viewerName)) {
        throw new Error('Only the campaign creator can delete the campaign');
      }
      campaign.deletingAtMs = Date.now();
      await this.save(campaign);
    }
    // An already-tombstoned campaign resumes without re-authorizing: the
    // authorization was consumed when the tombstone was written.
    return await this.runDeletionCascade(campaign);
  }

  private async resumeDeletion(campaign: SerializedCampaign): Promise<void> {
    try {
      await this.runDeletionCascade(campaign);
    } catch (err) {
      console.error('campaign-delete: resume failed for', campaign.id, err);
    }
  }

  private async runDeletionCascade(campaign: SerializedCampaign): Promise<{deletedGames: Array<GameId>}> {
    const deletedGames: Array<GameId> = [];
    const failures: Array<GameId> = [];
    const loader = GameLoader.getInstance();
    for (const slot of campaign.missions) {
      const gameId = slot.gameId;
      if (gameId === undefined) {
        continue;
      }
      try {
        // Ownership is verified on the SERIALIZED form — readable even when a
        // full deserialize would fail, so a corrupt-but-ours save still dies.
        let serialized;
        try {
          serialized = await Database.getInstance().getGame(gameId);
        } catch (err) {
          serialized = undefined;
        }
        if (serialized === undefined) {
          // Nothing verifiable on disk. A provably-ours RESIDENT instance is
          // still evicted; anything else is diagnostic, never a deletion.
          const resident = loader.peek(gameId);
          if (resident !== undefined && resident.gameOptions.campaign?.campaignId === campaign.id) {
            const invalidation = {gameId, gameAge: resident.gameAge + 1, undoCount: resident.undoCount, phase: resident.phase};
            await loader.deleteGame(gameId);
            this.invalidateDeletedGame(invalidation);
            deletedGames.push(gameId);
          } else {
            console.warn(`campaign-delete: mission game ${gameId} of ${campaign.id} not found — continuing`);
          }
          continue;
        }
        if (serialized.gameOptions?.campaign?.campaignId !== campaign.id) {
          console.error(`campaign-delete: mission slot of ${campaign.id} names foreign game ${gameId} — NOT deleted`);
          continue;
        }
        const invalidation = {gameId, gameAge: (serialized.gameAge ?? 0) + 1, undoCount: serialized.undoCount ?? 0, phase: serialized.phase};
        await loader.deleteGame(gameId);
        this.invalidateDeletedGame(invalidation);
        deletedGames.push(gameId);
      } catch (err) {
        console.error(`campaign-delete: failed to delete mission game ${gameId} of ${campaign.id}`, err);
        failures.push(gameId);
      }
    }
    if (failures.length > 0) {
      // The tombstone survives — a retry (explicit or the next read) resumes.
      // Deleting the document now would orphan the failed games as ordinary
      // ones, which is the one outcome the ordering exists to prevent.
      throw new Error('Campaign deletion is incomplete. Please try again.');
    }
    await Database.getInstance().deleteCampaign(campaign.id);
    this.cache.delete(campaign.id);
    this.touchLobby();
    return {deletedGames};
  }

  /** Wake every subscriber of a just-deleted mission game (their refetch then
   *  404s and the client leaves cleanly instead of waiting out a poll). */
  private invalidateDeletedGame(invalidation: {gameId: GameId, gameAge: number, undoCount: number, phase: Phase}): void {
    try {
      const {RealtimeHub} = require('../server/realtime/RealtimeHub');
      RealtimeHub.getInstance().invalidate(invalidation);
    } catch (err) {
      // Realtime is an accelerator, never a dependency.
    }
  }

  // ---------------------------------------------------------- dev tooling --

  /**
   * DEV/admin fast-forward: fabricate a committed result for the CURRENT slot
   * from an explicit seat placement order, without playing the mission. The
   * slot gets no real game; the map tolerates that (dev-only path).
   */
  public async devCommit(id: CampaignId, placements: ReadonlyArray<number>, fixture?: {
    /** seat → corporations acquired by the fabricated mission (in order). */
    lineages?: Record<number, Array<CardName>>,
    /** seat → carried project cards, pre-confirmed (missions 2–4 testable). */
    carryover?: Record<number, Array<CardName>>,
    /**
     * Leave every human seat's carryover PENDING (the real
     * `commitMissionResult` regime) with `carryover` as the recorded
     * terminal hand — makes the interlude readiness flow (mandatory step →
     * confirm → launch gate → auto-join) testable without playing a mission.
     */
    carryoverPending?: boolean,
    /** seat → the seat's carry limit, overriding `carryoverLimitFor` (a stand sees 1 / 3 / 5 live). */
    carryoverLimits?: Record<number, number>,
    /**
     * The «Тендеры» mode: leave the bidding OPEN for the humans (the real
     * regime — the endgame's bidding scene is testable without playing a
     * mission). Default: every human's pick is resolved by the bot's own
     * denial order, so a fast-forward never waits.
     */
    biddingPending?: boolean,
    /** The «Тендеры» mode: seat → the tender KIND that seat picks at this bidding (when it lies on the table). */
    tenderPicks?: Record<number, TenderId>,
    /** The «Тендеры» mode: seat → tenders granted OUTRIGHT by the fabricated mission (no bidding dealt for them). */
    tenders?: Record<number, Array<TenderId>>,
    /** The «Тендеры» mode: seat → the preludes the fabricated mission recorded as PLAYED (a «Продление» candidate set). */
    finalPreludes?: Record<number, Array<CardName>>,
    /** The «Тендеры» mode: seat → the played preludes a CONFIRMED carryover carries («Продление программы» realized by the stand). */
    carryoverPreludes?: Record<number, Array<CardName>>,
  }): Promise<SerializedCampaign> {
    const campaign = await this.load(id);
    if (campaign === undefined) {
      throw new Error('Campaign not found');
    }
    if (campaign.phase !== 'generated' && campaign.phase !== 'interlude' && campaign.phase !== 'missionActive') {
      throw new Error('Campaign is not in a committable phase');
    }
    const slot = campaign.missions[campaign.pointer];
    if (slot === undefined || slot.result !== undefined) {
      throw new Error('No open slot to commit');
    }
    const seatCount = campaign.seats.length;
    if (placements.length !== seatCount || new Set(placements).size !== seatCount) {
      throw new Error('Placements must list every seat exactly once');
    }
    const final = slot.slot === campaign.missions.length - 1;
    const titles: Array<{seat: number} & TitleEntry> = [];
    const bonuses: Array<{seat: number, megaCredits: number}> = [];
    if (fixture?.lineages !== undefined) {
      for (const [seat, lineage] of Object.entries(fixture.lineages)) {
        campaign.progression.lineages[Number(seat)] = [...lineage];
      }
    }
    const standings = placements.map((seat, i) => ({
      seat,
      place: i + 1,
      score: 60 - i * 5,
      megaCredits: 20 - i,
      corporations: campaign.progression.lineages[seat] ?? [],
      tiedWith: [],
    }));
    const humanSeats = new Set(campaign.seats.filter((s) => s.kind === 'human').map((s) => s.seat));
    const tenderMode = campaignRewardMode(campaign) === 'tenders';
    if (!final) {
      for (const standing of standings) {
        const title = tenderMode ? undefined : titleForPlace(standing.place, seatCount);
        if (title !== undefined && title !== null) {
          titles.push({seat: standing.seat, missionSlot: slot.slot, title, titlePoints: TITLE_TABLE[title].titlePoints});
        }
        if (humanSeats.has(standing.seat) && !tenderMode) {
          const bonus = bonusForPlace(standing.place);
          if (bonus > 0) {
            bonuses.push({seat: standing.seat, megaCredits: bonus});
          }
        }
      }
    }
    slot.result = {
      gameId: slot.gameId ?? safeCast(generateRandomId('g'), isGameId),
      committedAtMs: Date.now(),
      gameLastSaveId: 0,
      gameUndoCount: 0,
      generations: 8,
      standings,
      titles,
      bonuses,
      championSeats: final ? [placements[0]] : undefined,
    };
    campaign.progression.titles.push(...titles);
    // The «Тендеры» mode: tenders granted OUTRIGHT by the fixture (a finale
    // stand needs holdings, not a bidding).
    if (tenderMode && fixture?.tenders !== undefined) {
      const tenders = campaign.progression.tenders ?? {};
      for (const [seatKey, ids] of Object.entries(fixture.tenders)) {
        const seat = Number(seatKey);
        const list = tenders[seat] ?? [];
        ids.forEach((tenderId, k) => {
          if (isTenderId(tenderId)) {
            list.push({instance: `dev${slot.slot}-${seat}-${k}`, id: tenderId, wonAtSlot: slot.slot, place: 1, status: 'held'});
          }
        });
        tenders[seat] = list;
      }
      campaign.progression.tenders = tenders;
    }
    if (final) {
      campaign.phase = 'finished';
      campaign.championSeats = [placements[0]];
      campaign.carryover = undefined;
    } else {
      slot.finalHands = {};
      if (tenderMode) {
        slot.finalPreludes = {};
      }
      const bySeat: Record<number, CarryoverSeatState> = {};
      for (const seat of humanSeats) {
        const carried = fixture?.carryover?.[seat] ?? [];
        slot.finalHands[seat] = [...carried];
        if (slot.finalPreludes !== undefined) {
          slot.finalPreludes[seat] = [...(fixture?.finalPreludes?.[seat] ?? [])];
        }
        const limit = fixture?.carryoverLimits?.[seat] ?? carryoverLimitFor(campaign, seat, slot.modifiers);
        const carriedPreludes = fixture?.carryoverPreludes?.[seat] ?? [];
        bySeat[seat] = fixture?.carryoverPending === true ?
          {status: 'pending', cards: [], consumed: false, limit} :
          {status: 'confirmed', cards: carried.slice(0, limit), consumed: false, limit,
            ...(carriedPreludes.length > 0 ? {preludes: [...carriedPreludes]} : {})};
      }
      campaign.carryover = {sourceSlot: slot.slot, bySeat};
      campaign.pointer = slot.slot + 1;
      campaign.phase = 'interlude';
      // The «Тендеры» mode: the REAL bidding opens over the fabricated
      // standings; a human's pick comes from the fixture (`tenderPicks`), or is
      // resolved by the bot's own order so the fast-forward never waits — unless
      // the stand asks for the open bidding itself (`biddingPending`).
      if (tenderMode && fixture?.tenders === undefined) {
        this.openBiddingFor(campaign, slot, standings);
        if (fixture?.biddingPending !== true) {
          this.resolveHumanBids(campaign, fixture?.tenderPicks);
        }
      }
    }
    await this.save(campaign);
    return campaign;
  }

  /** The dev fast-forward's answer for every human turn of an open bidding. */
  private resolveHumanBids(campaign: SerializedCampaign, picks?: Record<number, TenderId>): void {
    const isBot = (seat: number) => campaign.seats[seat]?.kind === 'bot';
    let guard = 0;
    while (campaign.bidding !== undefined && !campaign.bidding.done && guard++ < 10) {
      const bidding = campaign.bidding;
      const turn = biddingTurnSeat(bidding);
      if (turn === undefined) {
        break;
      }
      const open = biddingOpenCards(bidding);
      const wanted = picks?.[turn];
      const card = open.find((c) => c.id === wanted) ?? botTenderPick(open);
      if (card === undefined) {
        break;
      }
      this.settleBidding(campaign, advanceBots(applyBid(bidding, turn, card.instance), isBot));
    }
  }

  // --------------------------------------------------------------- model --

  public seatOf(campaign: SerializedCampaign, viewerName: string | undefined): CampaignSeat | undefined {
    if (viewerName === undefined || viewerName === '') {
      return undefined;
    }
    const norm = normalizePlayerName(viewerName);
    return campaign.seats.find((s) => s.kind === 'human' && normalizePlayerName(s.name) === norm);
  }

  private boardIsAvailable(board: BoardName, hasBot: boolean): boolean {
    if (!Object.values(BoardName).includes(board)) {
      return false;
    }
    if (hasBot && !AUTOMA_SUPPORTED_BOARDS.includes(board)) {
      return false;
    }
    return true;
  }

  /** Launch blockers as English i18n reason keys (empty = launchable). */
  public launchBlockersOf(campaign: SerializedCampaign): Array<string> {
    const blockers: Array<string> = [];
    if (campaign.phase !== 'generated' && campaign.phase !== 'interlude') {
      return ['No mission is ready to launch'];
    }
    const slot = campaign.missions[campaign.pointer];
    if (slot === undefined) {
      return ['No mission is ready to launch'];
    }
    const hasBot = campaign.settings.automa !== undefined;
    if (!this.boardIsAvailable(slot.board, hasBot)) {
      blockers.push('The mission board is unavailable in this build');
    }
    if (campaign.bidding !== undefined && !campaign.bidding.done) {
      blockers.push('Waiting for the tender bidding');
    }
    const carryover = campaign.carryover;
    if (carryover !== undefined && carryover.sourceSlot === slot.slot - 1) {
      for (const state of Object.values(carryover.bySeat)) {
        if (state.status !== 'confirmed') {
          blockers.push('Waiting for the project carryover selections');
          break;
        }
      }
      for (const state of Object.values(carryover.bySeat)) {
        if (state.cards.some((name) => newProjectCard(name) === undefined) ||
            (state.preludes ?? []).some((name) => newPrelude(name) === undefined)) {
          blockers.push('A carried project card is unavailable in this build');
          break;
        }
      }
    }
    return blockers;
  }

  public getModel(campaign: SerializedCampaign, viewerName: string | undefined): CampaignModel {
    const viewerSeat = this.seatOf(campaign, viewerName);
    const finalIndex = campaign.missions.length - 1;
    const missions: Array<CampaignMissionModel> = campaign.missions.map((slot) => {
      let state: MissionSlotState;
      if (slot.result !== undefined) {
        state = 'committed';
      } else if (slot.gameId !== undefined) {
        state = 'active';
      } else if (slot.slot === campaign.pointer && (campaign.phase === 'generated' || campaign.phase === 'interlude')) {
        state = 'ready';
      } else {
        state = 'locked';
      }
      const hasBot = campaign.settings.automa !== undefined;
      const blockedReason = (state === 'ready' && !this.boardIsAvailable(slot.board, hasBot)) ?
        'The mission board is unavailable in this build' : undefined;
      // Carried-in legacy history (snapshotted at launch). PRIVACY: counts
      // are public, card identities go to their owner alone. Absent =
      // unknown (a slot launched before the field existed), never «0».
      let carriedCounts: Record<number, number> | undefined = undefined;
      if (slot.carriedBySeat !== undefined) {
        carriedCounts = {};
        for (const seat of campaign.seats) {
          if (seat.kind === 'human') {
            carriedCounts[seat.seat] = slot.carriedBySeat[seat.seat]?.length ?? 0;
          }
        }
      }
      return {
        slot: slot.slot,
        board: slot.board,
        final: slot.slot === finalIndex,
        state,
        modifiers: slotModifiersOf(campaign, slot),
        blockedReason,
        gameId: slot.gameId,
        yourPlayerId: viewerSeat !== undefined ? slot.playerIds?.[viewerSeat.seat] : undefined,
        result: slot.result !== undefined ? this.resultModel(slot.result) : undefined,
        carriedCounts,
        yourCarried: viewerSeat !== undefined ? slot.carriedBySeat?.[viewerSeat.seat] : undefined,
        ...(slot.bidding !== undefined ? {bidding: slot.bidding} : {}),
      };
    });

    const titlePoints: Record<number, number> = {};
    for (const seat of campaign.seats) {
      titlePoints[seat.seat] = 0;
    }
    for (const t of campaign.progression.titles) {
      titlePoints[t.seat] = (titlePoints[t.seat] ?? 0) + t.titlePoints;
    }
    const pendingBonuses: Record<number, number> = {};
    if (campaign.phase === 'interlude' || campaign.phase === 'generated') {
      const previous = campaign.pointer > 0 ? campaign.missions[campaign.pointer - 1].result : undefined;
      for (const b of previous?.bonuses ?? []) {
        pendingBonuses[b.seat] = b.megaCredits;
      }
    }

    let carryoverModel: CampaignCarryoverModel | undefined = undefined;
    if (campaign.carryover !== undefined) {
      const sourceIndex = campaign.carryover.sourceSlot;
      const source = campaign.missions[sourceIndex];
      const tenderMode = campaignRewardMode(campaign) === 'tenders';
      const own = viewerSeat !== undefined ? campaign.carryover.bySeat[viewerSeat.seat] : undefined;
      carryoverModel = {
        sourceSlot: sourceIndex,
        bySeat: Object.entries(campaign.carryover.bySeat).map(([seat, state]) => ({
          seat: Number(seat),
          status: state.status,
          count: state.cards.length,
          limit: carryoverLimitWithTenders(campaign, Number(seat), state, sourceIndex),
          ...(tenderMode ? {preludeCount: (state.preludes ?? []).length} : {}),
        })),
        // PRIVACY: card identities go to their owner alone.
        yourCards: own?.cards,
        yourEligible: viewerSeat !== undefined ? source.finalHands?.[viewerSeat.seat] : undefined,
        yourLimit: viewerSeat !== undefined && own !== undefined ?
          carryoverLimitWithTenders(campaign, viewerSeat.seat, own, sourceIndex) : undefined,
        // The «Тендеры» mode before the finale: the seats the held «Расширенное
        // наследие» add, and the played preludes a «Продление программы» may carry.
        ...(tenderMode && viewerSeat !== undefined && own !== undefined ? {
          yourTenderSeats: tenderSeatsOf(campaign, viewerSeat.seat, sourceIndex),
          yourEligiblePreludes: source.finalPreludes?.[viewerSeat.seat] ?? [],
          yourPreludeLimit: tenderPreludeLimitOf(campaign, viewerSeat.seat, sourceIndex),
          yourPreludes: own.preludes ?? [],
          // EVERY holding with its availability on THIS step — the portfolio stage reads it (the server names the reason).
          yourTenders: (campaign.progression.tenders?.[viewerSeat.seat] ?? []).map((h) => {
            const blocked = h.status === 'held' ? legacyTenderRefusal(campaign, viewerSeat.seat, sourceIndex, h) : undefined;
            return {instance: h.instance, id: h.id, status: h.status, window: tenderDef(h.id).window, ...(blocked !== undefined ? {blocked} : {})};
          }),
        } : {}),
      };
    }

    let biddingModel: BiddingModel | undefined = undefined;
    if (campaign.bidding !== undefined) {
      biddingModel = {
        ...campaign.bidding,
        yourTurn: viewerSeat !== undefined && biddingTurnSeat(campaign.bidding) === viewerSeat.seat,
      };
    }

    const launchBlockers = this.launchBlockersOf(campaign);
    const canLaunch = viewerSeat?.seat === 0 &&
      (campaign.phase === 'generated' || campaign.phase === 'interlude') &&
      launchBlockers.length === 0;

    return {
      id: campaign.id,
      rev: campaign.rev,
      name: campaign.name,
      createdTimeMs: campaign.createdTimeMs,
      phase: campaign.phase,
      pointer: campaign.pointer,
      missionCount: campaign.missions.length,
      seats: campaign.seats,
      you: viewerSeat !== undefined ? {seat: viewerSeat.seat} : undefined,
      canLaunch,
      launchBlockers,
      missions,
      progression: {
        lineages: campaign.progression.lineages,
        botCorporation: campaign.progression.botCorporation,
        ...(campaign.progression.botHoldings !== undefined ? {botHoldings: campaign.progression.botHoldings} : {}),
        titles: campaign.progression.titles,
        titlePoints,
        pendingBonuses,
        ...(campaign.progression.tenders !== undefined ? {tenders: campaign.progression.tenders} : {}),
      },
      carryover: carryoverModel,
      championSeats: campaign.championSeats,
      rewardMode: campaignRewardMode(campaign),
      ...(biddingModel !== undefined ? {bidding: biddingModel} : {}),
    };
  }

  private resultModel(result: MissionResult): MissionResultModel {
    // The wire projection strips nothing today (finalHands live on the SLOT,
    // not the result) — kept as a projection point so a future private field
    // can never leak by accident.
    return {
      gameId: result.gameId,
      generations: result.generations,
      standings: result.standings,
      titles: result.titles,
      bonuses: result.bonuses,
      championSeats: result.championSeats,
    };
  }
}

export function playerIsCampaignParticipant(player: IPlayer): boolean {
  return player.campaignSeat !== undefined && player.game.gameOptions.campaign !== undefined;
}

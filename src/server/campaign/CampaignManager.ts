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
import {marsBotCorpInfo} from '../../common/automa/MarsBotCorpData';
import {
  CAMPAIGN_GENERATOR_VERSION,
  CAMPAIGN_MISSION_COUNT,
  CARRYOVER_MAX_CARDS,
  CampaignSeat,
  MissionResult,
  MissionSlotState,
  TitleEntry,
} from '../../common/campaign/CampaignTypes';
import {FINAL_MISSION_AWARDS_TITLES, TITLE_TABLE, bonusForPlace, titleForPlace} from '../../common/campaign/campaignConfig';
import {CampaignCarryoverModel, CampaignMissionModel, CampaignModel, MissionResultModel} from '../../common/campaign/CampaignModel';
import {Phase} from '../../common/Phase';
import {boardOptions} from '../boards/randomBoard';
import {newProjectCard} from '../createCard';
import {Database} from '../database/Database';
import {GameLoader} from '../database/GameLoader';
import {Game} from '../Game';
import {GameCards} from '../GameCards';
import {generateGameName} from '../GameName';
import {gameOptionsFromNewGameConfig} from '../game/newGameConfigToOptions';
import {CampaignGameContract, CampaignGrant} from '../game/GameOptions';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Player} from '../Player';
import {generateRandomId} from '../utils/server-ids';
import {CarryoverSeatState, SerializedCampaign, SerializedMissionSlot} from './Campaign';
import {computeMissionStandings} from './missionStandings';

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
      await this.reconcile(cached);
      return cached;
    }
    try {
      const stored = await Database.getInstance().getCampaign(id);
      if (stored === undefined) {
        return undefined;
      }
      this.cache.set(id, stored);
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
  }

  /** Best-effort realtime nudge: invalidate cached mission games so their
   *  subscribers refresh. The campaign map additionally polls (5 s active). */
  private notify(campaign: SerializedCampaign): void {
    try {
      const {RealtimeHub} = require('../server/realtime/RealtimeHub');
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

  public async createCampaign(key: string, config: NewGameConfig): Promise<SerializedCampaign> {
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
      const campaign = this.buildCampaign(id, config);
      await this.save(campaign);
      return campaign;
    } finally {
      this.creating.delete(id);
    }
  }

  private buildCampaign(id: CampaignId, config: NewGameConfig): SerializedCampaign {
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
    // single game's random board. The concrete snapshot below is what is
    // authoritative forever; seed/pool/version are provenance.
    const pool = boardOptions(RandomBoardOption.ALL, {automa: hasBot});
    if (pool.length < CAMPAIGN_MISSION_COUNT) {
      throw new Error(`Not enough unique boards for a campaign: ${pool.length} of ${CAMPAIGN_MISSION_COUNT} required`);
    }
    const seed = Math.random();
    const rng = new SeededRandom(seed);
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const boards = shuffled.slice(0, CAMPAIGN_MISSION_COUNT);

    this.validateCorporationPool(config);

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

    const missions: Array<SerializedMissionSlot> = boards.map((board, slot) => ({
      slot,
      board,
      modifiers: [],
    }));

    return {
      version: 1,
      id,
      rev: 0,
      name: generateGameName(UnseededRandom.INSTANCE),
      createdTimeMs: Date.now(),
      seats,
      settings: frozen,
      generator: {seed, version: CAMPAIGN_GENERATOR_VERSION, pool: [...pool]},
      missions,
      pointer: 0,
      phase: 'generated',
      progression: {lineages: {}, titles: []},
    };
  }

  /**
   * The corporation pool must survive the whole campaign: each mission deals
   * `startingCorporations` per human while every previously-acquired corp
   * (up to 2 per human by mission 3) + the bot's frozen original are banned.
   */
  private validateCorporationPool(config: NewGameConfig): void {
    const options = gameOptionsFromNewGameConfig({...config, board: BoardName.THARSIS}, BoardName.THARSIS);
    const poolSize = new GameCards(options).getCorporationCards().length;
    const humans = config.players.length;
    const worstCaseBans = humans * 2 + (config.automa !== undefined ? 1 : 0);
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
      // Atomically consume the carryover selections this launch applied.
      if (campaign.carryover !== undefined && campaign.carryover.sourceSlot === slot.slot - 1) {
        for (const state of Object.values(campaign.carryover.bySeat)) {
          state.consumed = true;
        }
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

    const missionConfig: NewGameConfig = {
      ...settings,
      board: slot.board,
      seed: Math.random(),
      clonedGamedId: undefined,
      bannedCards: [...banned],
    };
    const gameOptions = gameOptionsFromNewGameConfig(missionConfig, slot.board);
    if (gameOptions.automa !== undefined && campaign.progression.botCorporation !== undefined) {
      gameOptions.automa = {...gameOptions.automa, corporation: campaign.progression.botCorporation};
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
    }
    return game;
  }

  private buildContract(campaign: SerializedCampaign, slot: number, final: boolean): CampaignGameContract {
    const previous = slot > 0 ? campaign.missions[slot - 1].result : undefined;
    const grants: Array<CampaignGrant> = campaign.seats.map((seat) => {
      const bonus = seat.kind === 'human' ?
        (previous?.bonuses.find((b) => b.seat === seat.seat)?.megaCredits ?? 0) :
        0; // The bot never plays a corporation, so a bonus would silently never apply — honesty demands none.
      return {
        seat: seat.seat,
        color: seat.color,
        bonusMegaCredits: bonus,
        corporations: seat.kind === 'human' ? [...(campaign.progression.lineages[seat.seat] ?? [])] : [],
        titlePoints: final ? campaign.progression.titles.filter((t) => t.seat === seat.seat)
          .map((t) => ({missionSlot: t.missionSlot, title: t.title, titlePoints: t.titlePoints})) : [],
      };
    });
    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      missionSlot: slot,
      missionCount: campaign.missions.length,
      final,
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

    const titles: Array<{seat: number} & TitleEntry> = [];
    const bonuses: Array<{seat: number, megaCredits: number}> = [];
    if (!final || FINAL_MISSION_AWARDS_TITLES) {
      for (const standing of standings) {
        const title = titleForPlace(standing.place, seatCount);
        if (title !== undefined && title !== null) {
          titles.push({seat: standing.seat, missionSlot: slot.slot, title, titlePoints: TITLE_TABLE[title].titlePoints});
        }
        // Bonus M€ only for humans: the bot never plays a corporation, so the
        // application point does not exist for it (D5 honesty rule).
        if (!final && humanSeats.has(standing.seat)) {
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
    } else {
      // Record the terminal hands (SERVER-PRIVATE) and open the carryover
      // window. EVERY human starts 'pending' — the confirmation doubles as
      // the READINESS regime: the next mission launches only when every
      // human has explicitly confirmed (an empty hand confirms «готов» with
      // zero cards, but the press is still theirs to make).
      slot.finalHands = {};
      const bySeat: Record<number, CarryoverSeatState> = {};
      for (const player of game.players) {
        const seat = player.campaignSeat;
        if (seat === undefined || !humanSeats.has(seat)) {
          continue;
        }
        const hand = player.cardsInHand.map((c) => c.name);
        slot.finalHands[seat] = hand;
        bySeat[seat] = {status: 'pending', cards: [], consumed: false};
      }
      campaign.carryover = {sourceSlot: slot.slot, bySeat};
      campaign.pointer = slot.slot + 1;
      campaign.phase = 'interlude';
    }
    await this.save(campaign);
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

  public async submitCarryover(id: CampaignId, playerId: PlayerId, cards: ReadonlyArray<CardName>): Promise<SerializedCampaign> {
    const campaign = await this.load(id);
    if (campaign === undefined) {
      throw new Error('Campaign not found');
    }
    const carryover = campaign.carryover;
    if (carryover === undefined || campaign.phase !== 'interlude') {
      throw new Error('No project carryover is open');
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
    if (cards.length > CARRYOVER_MAX_CARDS) {
      throw new Error(`At most ${CARRYOVER_MAX_CARDS} project cards can be carried over`);
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
    state.cards = [...cards];
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
      campaign.carryover = undefined;
      campaign.championSeats = undefined;
      campaign.pointer = slot.slot;
      campaign.phase = 'missionActive';
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
        if (campaign === undefined || campaign.phase === 'finished' || campaign.phase === 'abandoned') {
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
    if (!final) {
      for (const standing of standings) {
        const title = titleForPlace(standing.place, seatCount);
        if (title !== undefined && title !== null) {
          titles.push({seat: standing.seat, missionSlot: slot.slot, title, titlePoints: TITLE_TABLE[title].titlePoints});
        }
        if (humanSeats.has(standing.seat)) {
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
    if (final) {
      campaign.phase = 'finished';
      campaign.championSeats = [placements[0]];
      campaign.carryover = undefined;
    } else {
      slot.finalHands = {};
      const bySeat: Record<number, CarryoverSeatState> = {};
      for (const seat of humanSeats) {
        const carried = fixture?.carryover?.[seat] ?? [];
        slot.finalHands[seat] = [...carried];
        bySeat[seat] = {status: 'confirmed', cards: [...carried], consumed: false};
      }
      campaign.carryover = {sourceSlot: slot.slot, bySeat};
      campaign.pointer = slot.slot + 1;
      campaign.phase = 'interlude';
    }
    await this.save(campaign);
    return campaign;
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
    const carryover = campaign.carryover;
    if (carryover !== undefined && carryover.sourceSlot === slot.slot - 1) {
      for (const state of Object.values(carryover.bySeat)) {
        if (state.status !== 'confirmed') {
          blockers.push('Waiting for the project carryover selections');
          break;
        }
      }
      for (const state of Object.values(carryover.bySeat)) {
        if (state.cards.some((name) => newProjectCard(name) === undefined)) {
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
      return {
        slot: slot.slot,
        board: slot.board,
        final: slot.slot === finalIndex,
        state,
        modifiers: slot.modifiers,
        blockedReason,
        gameId: slot.gameId,
        yourPlayerId: viewerSeat !== undefined ? slot.playerIds?.[viewerSeat.seat] : undefined,
        result: slot.result !== undefined ? this.resultModel(slot.result) : undefined,
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
      const source = campaign.missions[campaign.carryover.sourceSlot];
      carryoverModel = {
        sourceSlot: campaign.carryover.sourceSlot,
        bySeat: Object.entries(campaign.carryover.bySeat).map(([seat, state]) => ({
          seat: Number(seat),
          status: state.status,
          count: state.cards.length,
        })),
        // PRIVACY: card identities go to their owner alone.
        yourCards: viewerSeat !== undefined ? campaign.carryover.bySeat[viewerSeat.seat]?.cards : undefined,
        yourEligible: viewerSeat !== undefined ? source.finalHands?.[viewerSeat.seat] : undefined,
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
        titles: campaign.progression.titles,
        titlePoints,
        pendingBonuses,
      },
      carryover: carryoverModel,
      championSeats: campaign.championSeats,
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

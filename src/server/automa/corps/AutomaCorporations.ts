import {CardName} from '../../../common/cards/CardName';
import {Expansion} from '../../../common/cards/GameModule';
import {Tag} from '../../../common/cards/Tag';
import {BonusCardId, TrackAction} from '../../../common/automa/AutomaTypes';
import {FailedActionReason} from '../../../common/automa/MarsBotTurn';
import {MARS_BOT_CORP_IDS, MarsBotCorpCubeModel, MarsBotCorpId, MarsBotCorpInfo, MarsBotTrackCube, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {inplaceShuffle} from '../../utils/shuffle';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../../cards/ICard';
import {Space} from '../../boards/Space';
import {IProjectCard} from '../../cards/IProjectCard';
import {isICorporationCard} from '../../cards/corporation/ICorporationCard';
import {AutomaHumanTagReactions} from '../AutomaHumanTagReactions';
import {AutomaResolver} from '../AutomaResolver';
import {bumpCorpStat, humansOf, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';
import {MarsBotCredicor} from './MarsBotCredicor';
import {MarsBotHelion} from './MarsBotHelion';
import {MarsBotInterplanetaryCinematics} from './MarsBotInterplanetaryCinematics';
import {MarsBotInventrix} from './MarsBotInventrix';
import {MarsBotMiningGuild} from './MarsBotMiningGuild';
import {MarsBotPhobolog} from './MarsBotPhobolog';
import {MarsBotPointLuna} from './MarsBotPointLuna';
import {MarsBotRobinsonIndustries} from './MarsBotRobinsonIndustries';
import {MarsBotValleyTrust} from './MarsBotValleyTrust';
import {MarsBotArcadianCommunities} from './MarsBotArcadianCommunities';
import {MarsBotAstroDrill} from './MarsBotAstroDrill';
import {MarsBotFactorum} from './MarsBotFactorum';
import {MarsBotPharmacyUnion} from './MarsBotPharmacyUnion';
import {MarsBotPhilares} from './MarsBotPhilares';
import {MarsBotRecyclon} from './MarsBotRecyclon';
import {MarsBotSplice} from './MarsBotSplice';
import {MarsBotCelestic} from './MarsBotCelestic';
import {MarsBotMorningStar} from './MarsBotMorningStar';
import {MarsBotViron} from './MarsBotViron';
import {MarsBotVitor} from './MarsBotVitor';
import {MarsBotSaturnSystems} from './MarsBotSaturnSystems';
import {MarsBotTeractor} from './MarsBotTeractor';
import {MarsBotTharsisRepublic} from './MarsBotTharsisRepublic';
import {MarsBotThorgate} from './MarsBotThorgate';
import {MarsBotCheungShingMars} from './MarsBotCheungShingMars';
import {MarsBotUnmi} from './MarsBotUnmi';
import {MarsBotDraftResolver} from './MarsBotDraftResolver';
import {MarsBotEcoline} from './MarsBotEcoline';
import {MarsBotSpire} from './MarsBotSpire';

/**
 * THE MarsBot corporation registry + dispatch layer (Rule Book B "Adding
 * Corporations"). Adding corporation N+1 is: one data entry in
 * `common/automa/MarsBotCorpData.ts`, one behavior file in this directory,
 * one line in `REGISTRY` — no switch anywhere else grows.
 *
 * TIMING. The official setup order (RB-B Setup 1–6): the human selects and
 * PLAYS their corporation → MarsBot's corporation is randomly selected
 * (rejecting the human's) → its Setup box resolves → its starting tags
 * resolve like a revealed card's tags → preludes → first round; "Before
 * Action Phase" boxes also resolve after setup, before the first
 * generation's action phase. This engine has ONE research → action gate
 * (`Game.playerIsFinishedWithResearchPhase`), entered after every human
 * corporation is played (generation 1) and after every research phase
 * (generation 2+): `onActionPhaseStart` runs there — selection once in
 * generation 1, the Before-Action-Phase boxes once every generation. The
 * engine's prelude phase nests INSIDE the first player's first action turn
 * (after this gate), while RB-B resolves setup before preludes — equivalent
 * for every implemented corporation (the bot takes no prelude turn, and no
 * implemented Before-Action-Phase box reads state preludes can change); a
 * future corporation for which that matters must revisit this dispatch.
 */
export class AutomaCorporations {
  private static readonly REGISTRY: Readonly<Record<MarsBotCorpId, MarsBotCorp>> = {
    [MarsBotCorpId.C01_CREDICOR]: MarsBotCredicor,
    [MarsBotCorpId.C02_ECOLINE]: MarsBotEcoline,
    [MarsBotCorpId.C03_HELION]: MarsBotHelion,
    [MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS]: MarsBotInterplanetaryCinematics,
    [MarsBotCorpId.C05_INVENTRIX]: MarsBotInventrix,
    [MarsBotCorpId.C06_MINING_GUILD]: MarsBotMiningGuild,
    [MarsBotCorpId.C07_PHOBOLOG]: MarsBotPhobolog,
    [MarsBotCorpId.C08_SATURN_SYSTEMS]: MarsBotSaturnSystems,
    [MarsBotCorpId.C09_TERACTOR]: MarsBotTeractor,
    [MarsBotCorpId.C10_THARSIS_REPUBLIC]: MarsBotTharsisRepublic,
    [MarsBotCorpId.C11_THORGATE]: MarsBotThorgate,
    [MarsBotCorpId.C12_UNMI]: MarsBotUnmi,
    [MarsBotCorpId.C13_CHEUNG_SHING_MARS]: MarsBotCheungShingMars,
    [MarsBotCorpId.C14_POINT_LUNA]: MarsBotPointLuna,
    [MarsBotCorpId.C15_ROBINSON_INDUSTRIES]: MarsBotRobinsonIndustries,
    [MarsBotCorpId.C16_VALLEY_TRUST]: MarsBotValleyTrust,
    [MarsBotCorpId.C17_VITOR]: MarsBotVitor,
    [MarsBotCorpId.C18_ARCADIAN_COMMUNITIES]: MarsBotArcadianCommunities,
    [MarsBotCorpId.C19_ASTRO_DRILL]: MarsBotAstroDrill,
    [MarsBotCorpId.C20_FACTORUM]: MarsBotFactorum,
    [MarsBotCorpId.C21_PHARMACY_UNION]: MarsBotPharmacyUnion,
    [MarsBotCorpId.C22_PHILARES]: MarsBotPhilares,
    [MarsBotCorpId.C23_RECYCLON]: MarsBotRecyclon,
    [MarsBotCorpId.C24_SPLICE]: MarsBotSplice,
    [MarsBotCorpId.C25_VIRON]: MarsBotViron,
    [MarsBotCorpId.C26_CELESTIC]: MarsBotCelestic,
    [MarsBotCorpId.C27_MORNING_STAR]: MarsBotMorningStar,
    [MarsBotCorpId.C45_SPIRE]: MarsBotSpire,
  };

  public static corpFor(id: MarsBotCorpId): MarsBotCorp {
    return AutomaCorporations.REGISTRY[id];
  }

  /** The one active corporation of this game, if selected. */
  public static activeCorp(game: IGame): MarsBotCorp | undefined {
    const id = game.automa?.corporation;
    return id === undefined ? undefined : AutomaCorporations.REGISTRY[id];
  }

  /**
   * The collision rule, as a PURE predicate (RB-B Setup 1: "If the same
   * corporation was selected as the one you're playing, select another" —
   * generalized to ALL humans in the multiplayer house-rule mode). Canonical
   * identity is the original corporation's CardName — never a display name.
   */
  public static isMarsBotCorporationEligible(info: MarsBotCorpInfo, humanCorporations: ReadonlySet<CardName>): boolean {
    return !humanCorporations.has(info.original);
  }

  /**
   * The printed MODULE condition, as a PURE predicate (C16 Valley Trust: «Use
   * this corporation only when playing with Prelude»). A corporation printing
   * no condition is always eligible. Deliberately SEPARATE from the collision
   * predicate: each answers one question, and neither has a permissive
   * default a caller could forget to pass.
   */
  public static hasRequiredModules(info: MarsBotCorpInfo, expansions: Partial<Record<Expansion, boolean>>): boolean {
    const all = (info.requiresModules ?? []).every((module) => expansions[module] === true);
    // «… only when playing with X OR Y» (C25). An absent list is no condition,
    // so an empty `requiresAnyModule` must not refuse every game.
    const any = info.requiresAnyModule === undefined ||
      info.requiresAnyModule.some((module) => expansions[module] === true);
    return all && any;
  }

  /** Every corporation any human PICKED or already PLAYED (union — robust across the start flow). */
  public static humanCorporationNames(game: IGame): Set<CardName> {
    const names = new Set<CardName>();
    for (const human of humansOf(game)) {
      for (const card of human.playedCards.filter(isICorporationCard)) {
        names.add(card.name);
      }
      if (human.pickedCorporationCard !== undefined) {
        names.add(human.pickedCorporationCard.name);
      }
    }
    return names;
  }

  /**
   * The implemented corporations still eligible for this game, in card-number
   * order: neither colliding with a human corporation nor missing a module its
   * printed card requires.
   */
  public static eligibleCorpIds(game: IGame): Array<MarsBotCorpId> {
    const humanCorporations = AutomaCorporations.humanCorporationNames(game);
    const expansions = game.gameOptions.expansions ?? {};
    return MARS_BOT_CORP_IDS.filter((id) => {
      const info = marsBotCorpInfo(id);
      return AutomaCorporations.isMarsBotCorporationEligible(info, humanCorporations) &&
        AutomaCorporations.hasRequiredModules(info, expansions);
    });
  }

  /**
   * THE research → action gate hook (both generations 1 and 2+):
   *  - generation 1 of a NEW game: select the corporation (RB-B Setup 1–4).
   *    A legacy save already past its first action phase never gets one
   *    mid-game (`generation === 1` guard) — it keeps playing corpless.
   *  - every generation: run the Before-Action-Phase box exactly once
   *    (`corpBapGeneration` guard survives save/load/undo).
   */
  public static onActionPhaseStart(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    if (automa.corporation === undefined && game.generation === 1) {
      AutomaCorporations.selectCorporation(game);
    }
    const corp = AutomaCorporations.activeCorp(game);
    if (corp === undefined || automa.corpBapGeneration >= game.generation) {
      return;
    }
    automa.corpBapGeneration = game.generation;
    corp.beforeActionPhase?.(game);
  }

  /**
   * RB-B Setup 1–4: randomly select an eligible corporation (seeded rng),
   * resolve its Setup box, then its starting tags "as if they are shown on a
   * card revealed during play" — each advances its MarsBot track once, with
   * landed-on track actions firing as usual; that track position IS how the
   * bot owns the tag from then on (tag counts read the tracks). Setup 5
   * (other corps' bonus cards stay in the box) is structural: only the
   * active corporation's own cards are ever added anywhere.
   *
   * An empty eligible pool is an invariant violation (Spire's human
   * counterpart needs Prelude 2, which conflicts with the bot — so with the
   * implemented set the pool can never empty), never a corpless fallback.
   */
  private static selectCorporation(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    const eligible = AutomaCorporations.eligibleCorpIds(game);
    if (eligible.length === 0) {
      throw new Error('MarsBot corporation pool is empty — every implemented corporation collides with a human corporation. ' +
        `Implemented: ${MARS_BOT_CORP_IDS.join(', ')}; humans hold: ${[...AutomaCorporations.humanCorporationNames(game)].join(', ')}`);
    }
    // DEV/TEST override (the customBonusCards twin): honored only while
    // eligible — a request colliding with a human corporation falls back to
    // the normal random selection rather than seating an illegal corp.
    const requested = game.gameOptions.automa?.corporation;
    const id = requested !== undefined && eligible.includes(requested) ?
      requested :
      eligible[game.rng.nextInt(eligible.length)];
    automa.corporation = id;
    const corp = AutomaCorporations.REGISTRY[id];
    const bot = marsBotOf(game);
    game.events.beginAction(bot, {kind: 'corporation', card: corp.info.original, owner: bot.color}, {category: 'corporation-action'});
    try {
      game.log('${0} received the corporation ${1}', (b) => b.player(bot).string(corp.info.original));
      corp.setup?.(game);
      for (const tag of corp.info.startingTags) {
        game.log('${0} resolved the starting ${1} tag of its corporation', (b) => b.player(bot).string(tag));
        AutomaResolver.resolveTag(game, tag);
        // RB-B FAQ: a starting tag triggers the sanctioned HUMAN reactors as
        // if a card carried it (Saturn Systems' Jovian clause; a microbe
        // starting tag routes to Pharmacy Union / Splice).
        AutomaHumanTagReactions.onBotNonCardTag(game, tag);
      }
    } finally {
      game.events.endScope();
    }
  }

  /**
   * «Is this build happening on an area MY OWN marker reserved?» — asked by
   * `Game.addTile` for the BOT seat only, before the tile seats. A corporation
   * that answers `'pays'` collects the engine's existing reserved-area bonus,
   * exactly as the human Arcadian Communities does.
   */
  public static buildOnOwnMarkerPays(game: IGame, player: IPlayer, space: Space): boolean {
    if (player.isMarsBot !== true) {
      return false;
    }
    return AutomaCorporations.activeCorp(game)?.onBuildOnOwnMarker?.(game, space) === 'pays';
  }

  /**
   * The bot's pick from a passed research-draft hand. With a corporation
   * whose card prints a Draft Priority, the priority decides (ties randomly,
   * seeded — RB-B p.2); without one (no corporation on a legacy save, or a
   * priority-less corporation) the pick is the official random one,
   * byte-identical in rng consumption to the pre-corporation code.
   */
  public static draftPick(game: IGame, hand: ReadonlyArray<IProjectCard>): IProjectCard {
    const automa = game.automa;
    const priority = AutomaCorporations.activeCorp(game)?.info.draftPriority;
    if (automa === undefined || priority === undefined) {
      return hand[game.rng.nextInt(hand.length)];
    }
    const resolver = new MarsBotDraftResolver(automa.board, (items) => inplaceShuffle(items, game.rng));
    const {card, tiedCount} = resolver.pickCard(hand, priority);
    bumpCorpStat(game, 'draftPriorityPicks');
    if (tiedCount > 1) {
      bumpCorpStat(game, 'draftPickTiesBroken');
    }
    return card;
  }

  /**
   * The post-draft discard (RB-B: shuffle, then discard the first drafted
   * card the priority does not protect; at most one card leaves — protecting
   * all four leaves a 5-card action deck). Without a priority: the official
   * corpless rule — shuffle, discard the first (rng-identical to the
   * pre-corporation code). Returns the kept cards; the caller discards.
   */
  public static draftDiscard(game: IGame, drafted: Array<IProjectCard>): {kept: Array<IProjectCard>, discarded: Array<IProjectCard>} {
    const automa = game.automa;
    const priority = AutomaCorporations.activeCorp(game)?.info.draftPriority;
    if (automa === undefined || priority === undefined) {
      inplaceShuffle(drafted, game.rng);
      const discarded = drafted.shift();
      return {kept: drafted, discarded: discarded === undefined ? [] : [discarded]};
    }
    const resolver = new MarsBotDraftResolver(automa.board, (items) => inplaceShuffle(items, game.rng));
    const result = resolver.discardAfterDraft(drafted, priority);
    if (result.discarded.length === 0) {
      bumpCorpStat(game, 'draftNoDiscardRounds');
      bumpCorpStat(game, 'fiveCardDecks');
      game.log('${0} corporation protected all drafted cards — nothing is discarded', (b) => b.player(marsBotOf(game)));
    } else if (result.protectionChangedOutcome) {
      bumpCorpStat(game, 'draftProtectionSaves');
    }
    return result;
  }


  // ── Track cubes (RB-B «Special Cubes on the MarsBot Player Mat») ──────
  //
  // Cube POSITIONS are static card data addressed by the track's identity TAG
  // («the building track», «the Earth track»); this layer resolves them to the
  // live board's indexes, owns the spent-once bookkeeping and the regression
  // rule, and lets the corporation state only the CONSEQUENCE.

  /** `trackIndex:position` — the key a spent cube is remembered by. */
  private static cubeKey(trackIndex: number, position: number): string {
    return `${trackIndex}:${position}`;
  }

  /** The active corporation's cubes, resolved onto THIS board's track indexes.
   *  A cube whose tag has no track here (a board without that track) is
   *  dropped — the same «unused-expansion icon» reading the resolver uses. */
  public static cubesOf(game: IGame): ReadonlyArray<MarsBotTrackCube & {trackIndex: number}> {
    const automa = game.automa;
    const cubes = AutomaCorporations.activeCorp(game)?.info.trackCubes;
    if (automa === undefined || cubes === undefined) {
      return [];
    }
    const resolved: Array<MarsBotTrackCube & {trackIndex: number}> = [];
    for (const cube of cubes) {
      const trackIndex = automa.board.getTrackIndexForTag(cube.tag);
      if (trackIndex !== undefined && cube.position <= automa.board.tracks[trackIndex].maxPosition) {
        resolved.push({...cube, trackIndex});
      }
    }
    return resolved;
  }

  /** Track indexes whose MARKER the corporation's setup paints white (C04). */
  public static whiteMarkerTrackIndexes(game: IGame): ReadonlyArray<number> {
    const automa = game.automa;
    const tags = AutomaCorporations.activeCorp(game)?.info.whiteMarkerTracks;
    if (automa === undefined || tags === undefined) {
      return [];
    }
    const out: Array<number> = [];
    for (const tag of tags) {
      const index = automa.board.getTrackIndexForTag(tag);
      if (index !== undefined && !out.includes(index)) {
        out.push(index);
      }
    }
    return out;
  }

  /** The public cube model (open table information — the client draws them). */
  public static cubeModels(game: IGame): ReadonlyArray<MarsBotCorpCubeModel> {
    const triggered = game.automa?.corpCubesTriggered ?? new Set<string>();
    return AutomaCorporations.cubesOf(game).map((cube) => ({
      trackIndex: cube.trackIndex,
      position: cube.position,
      cubeType: cube.cubeType,
      spent: triggered.has(AutomaCorporations.cubeKey(cube.trackIndex, cube.position)),
    }));
  }

  /**
   * The bot's marker just ADVANCED onto `position` of `trackIndex`. Runs the
   * corporation's per-advance effect, then its cube effect when an unspent
   * cube sits there (RB-B: before and in addition to the printed icon).
   * Returns true when the corporation REPLACED the printed action — the
   * caller then skips it.
   */
  public static onTrackAdvanced(game: IGame, trackIndex: number, position: number, printedAction: TrackAction | undefined): boolean {
    const automa = game.automa;
    const corp = AutomaCorporations.activeCorp(game);
    if (automa === undefined || corp === undefined) {
      return false;
    }
    // A per-advance effect (C04: «each time MarsBot advances the building or
    // event track…») fires for every successful step, cube or not.
    corp.onTrackAdvance?.(game, trackIndex, position);
    if (corp.onTrackCubeTrigger === undefined) {
      return false;
    }
    const key = AutomaCorporations.cubeKey(trackIndex, position);
    if (automa.corpCubesTriggered.has(key)) {
      return false; // Spent: a regressed track never re-arms it (RB-B).
    }
    const cube = AutomaCorporations.cubesOf(game)
      .find((c) => c.trackIndex === trackIndex && c.position === position);
    if (cube === undefined) {
      return false;
    }
    // Marked BEFORE the effect runs: the effect can cascade back onto this very
    // track (Helion's draw resolves a card), and a cube must never fire twice.
    automa.corpCubesTriggered.add(key);
    return corp.onTrackCubeTrigger(game, cube, printedAction) === 'replaces-action';
  }

  /**
   * A tile landed on Mars — dispatched from `Game.addTile`, the one place
   * every placement (either seat, any source) goes through.
   */
  public static onTilePlaced(game: IGame, player: IPlayer, space: Space): void {
    AutomaCorporations.activeCorp(game)?.onTilePlaced?.(game, player, space);
  }

  /**
   * MarsBot resolved one printed TAG — dispatched from `AutomaResolver`, the
   * one place a bot tag is ever resolved (card tags and starting tags alike).
   */
  public static onTagResolved(game: IGame, tag: Tag): void {
    AutomaCorporations.activeCorp(game)?.onTagResolved?.(game, tag);
  }

  /**
   * MarsBot got a MICROBE ADVANCEMENT with no tag behind it (the Venus board's
   * printed microbe cell). Dispatched from that ONE site, beside the
   * sanctioned human reactors the same FAQ already fires there.
   */
  public static onMicrobeAdvancement(game: IGame): void {
    AutomaCorporations.activeCorp(game)?.onMicrobeAdvancement?.(game);
  }

  /**
   * The corporation's OWN endgame VP, if it prints an endgame clause (C25).
   * Called from the scoring pass, so it must stay read-only.
   */
  public static endgameVictoryPoints(game: IGame): number {
    return AutomaCorporations.activeCorp(game)?.endgameVictoryPoints?.(game) ?? 0;
  }

  /** MarsBot took a Failed Action — dispatched from the ONE `failedAction`. */
  public static onFailedAction(game: IGame, reason: FailedActionReason): void {
    AutomaCorporations.activeCorp(game)?.onFailedAction?.(game, reason);
  }

  /**
   * The ROUND START box, immediately before the Research Phase. Guarded once
   * per generation by its own marker — the same shape as the Before-Action-
   * Phase box, so a reload or an undo can never run it twice.
   */
  public static onRoundStart(game: IGame): void {
    const automa = game.automa;
    const corp = AutomaCorporations.activeCorp(game);
    if (automa === undefined || corp?.roundStart === undefined) {
      return;
    }
    if (automa.corpRoundStartGeneration >= game.generation) {
      return;
    }
    automa.corpRoundStartGeneration = game.generation;
    corp.roundStart(game);
  }

  /**
   * A HUMAN played a card — the bot corporation's window onto the other side
   * of the table (C08). Dispatched from `Player.onCardPlayed`; the bot's own
   * flips never go through it, and the guard keeps it that way.
   */
  public static onHumanCardPlayed(game: IGame, player: IPlayer, card: ICard): void {
    if (player.isMarsBot) {
      return;
    }
    AutomaCorporations.activeCorp(game)?.onHumanCardPlayed?.(game, player, card);
  }

  /**
   * The bot GAINED M€ — dispatched from the one choke point every gain goes
   * through (`Stock.add`), so a corporation that redirects its income (C06's
   * bank) sees all of it and no caller has to know. Silent for every other
   * corporation and for non-automa games.
   */
  public static onBotGainedMegacredits(game: IGame, amount: number): void {
    AutomaCorporations.activeCorp(game)?.onMegacreditsGained?.(game, amount);
  }

  /** Corporation Effect dispatch — EVERY path that resolves a bot project card calls this first. */
  public static onProjectCardResolving(game: IGame, card: IProjectCard): void {
    AutomaCorporations.activeCorp(game)?.onProjectCardResolving?.(game, card);
  }

  /** Corporation-specific bonus card (B22–B32) dispatch. Undefined for a foreign id. */
  public static resolveCorpBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome | undefined {
    const corp = AutomaCorporations.activeCorp(game);
    if (corp === undefined || !corp.info.corpBonusCards.includes(id)) {
      return undefined;
    }
    return corp.resolveBonusCard?.(game, id);
  }
}

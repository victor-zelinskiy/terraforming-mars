import {CardName} from '../../../common/cards/CardName';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MARS_BOT_CORP_IDS, MarsBotCorpId, MarsBotCorpInfo, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {inplaceShuffle} from '../../utils/shuffle';
import {IGame} from '../../IGame';
import {IProjectCard} from '../../cards/IProjectCard';
import {isICorporationCard} from '../../cards/corporation/ICorporationCard';
import {AutomaHumanTagReactions} from '../AutomaHumanTagReactions';
import {AutomaResolver} from '../AutomaResolver';
import {bumpCorpStat, humansOf, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';
import {MarsBotCredicor} from './MarsBotCredicor';
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

  /** The implemented corporations still eligible for this game, in card-number order. */
  public static eligibleCorpIds(game: IGame): Array<MarsBotCorpId> {
    const humanCorporations = AutomaCorporations.humanCorporationNames(game);
    return MARS_BOT_CORP_IDS.filter((id) =>
      AutomaCorporations.isMarsBotCorporationEligible(marsBotCorpInfo(id), humanCorporations));
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

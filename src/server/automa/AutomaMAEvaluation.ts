import {CardType} from '../../common/cards/CardType';
import {MarsBotTrackRole} from '../../common/automa/AutomaTypes';
import {AutomaCorporations} from './corps/AutomaCorporations';
import {IAward} from '../awards/IAward';
import {IMilestone, milestoneThreshold} from '../milestones/IMilestone';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {IProjectCard} from '../cards/IProjectCard';
import {newProjectCard} from '../createCard';
import {marsBotOf} from './AutomaUtil';

/** The position of the track holding this canonical role (0 when the board has no such track). */
function trackPosition(game: IGame, role: MarsBotTrackRole): number {
  return game.automa?.board.getTrackOfRole(role)?.position ?? 0;
}

/** Every track EXCEPT the separate Venus board — the set the "every track" milestones read. */
function martianTracks(game: IGame) {
  return game.automa?.board.tracks.filter((t) => t.definition.role !== 'venus') ?? [];
}

/**
 * The threshold an "at least space N on every track" milestone actually clears.
 *
 * Without Venus that is simply the least-advanced track. With Venus the
 * official adaptation lets ONE track be substituted — «Planner (Tharsis):
 * reached spot 4 on every track except [Venus]», «Diversifier (Hellas):
 * reached spot 3 on 7 of the eight tracks (i.e., can substitute one other
 * track)» (Adding Expansions p.2). The two readings differ: Planner drops the
 * Venus track from the set, Diversifier counts it and drops the WORST of the
 * eight — so Diversifier can be met with the Venus track at 0 as long as the
 * seven others are there, and equally with Venus at 3 and one Martian track
 * behind.
 *
 * `drop` is how many of the lowest positions may be ignored; the value returned
 * is the lowest position that still counts, which doubles as the display score.
 */
function everyTrackScore(positions: ReadonlyArray<number>, drop: number): number {
  if (positions.length === 0) {
    return 0;
  }
  const sorted = [...positions].sort((a, b) => a - b);
  return sorted[Math.min(drop, sorted.length - 1)];
}

/** "7 of the eight tracks" — every track on the board, one substitutable, once Venus adds the 8th. */
function diversifierScore(game: IGame): number {
  const tracks = game.automa?.board.tracks ?? [];
  const substitutable = game.gameOptions.venusNextExtension ? 1 : 0;
  return everyTrackScore(tracks.map((t) => t.position), substitutable);
}

/** The furthest-advanced track — "any one track at space N or higher". */
function bestTrackPosition(game: IGame): number {
  const positions = game.automa?.board.tracks.map((t) => t.position) ?? [];
  return positions.length === 0 ? 0 : Math.max(...positions);
}

/**
 * Project cards in MarsBot's PLAYED PILE matching a predicate — the bot has no
 * tableau, so every «cards in play» criterion has to read the pile instead.
 * The card OBJECT is what answers (its printed type and cost), never a UI
 * colour or a stored label.
 */
function botPlayedPile(game: IGame, matches: (card: IProjectCard) => boolean): number {
  let count = 0;
  for (const name of game.automa?.playedPile ?? []) {
    const card = newProjectCard(name);
    if (card !== undefined && matches(card)) {
      count++;
    }
  }
  return count;
}

/** Green (automated) project cards in MarsBot's played pile. */
function botPlayedPileCount(game: IGame, type: CardType): number {
  return botPlayedPile(game, (card) => card.type === type);
}

/** «Green/blue cards» — the pair the Tycoon family counts (never events). */
const GREEN_AND_BLUE: ReadonlyArray<CardType> = [CardType.AUTOMATED, CardType.ACTIVE];

/**
 * The milestone's OWN printed threshold, used as the `target` of a bot
 * criterion that is the PLAYER's metric read out of a different container
 * (the played pile). Keeping the two equal makes the normalization the
 * identity — the bot's row shows the very number a human row would.
 *
 * `fallback` covers a milestone with no numeric threshold, which cannot happen
 * for this family but must not silently become a division by zero.
 */
function printedTarget(milestone: IMilestone, game: IGame, fallback: number): number {
  return milestoneThreshold(milestone, game) ?? fallback;
}

/**
 * How MarsBot evaluates milestones & awards: its strength comes from the BOARD
 * REFERENCE CARD of the map in play — its tracks, its tiles and its M€ — never
 * from played cards.
 *
 * Sources: rulebook pp.8–9 (Tharsis) · Adding Expansions p.9 (Hellas) · pp.2–3
 * (Hoverlord / Venuphile / the Venus adaptations of the "every track"
 * milestones).
 *
 * Milestone and award NAMES are unique across the supported board set, so one
 * switch covers every map — the tracks behind the cases are looked up by
 * canonical ROLE, which is what makes «advance the science track» mean the
 * Jovian/Science track on Hellas and the plain Science track on Tharsis.
 *
 * A dedicated module (no AwardScorer import) so AwardScorer itself can consult
 * it without an import cycle.
 */
export class AutomaMAEvaluation {
  /**
   * MarsBot's OWN criterion for one milestone, as a FRACTION: how far it has
   * come (`value`) out of what its reference card demands (`target`).
   *
   * `undefined` = the bot is judged by the PLAYER's own metric (the
   * "unchanged" family) — there is nothing to translate.
   *
   * ⚠️ THIS IS THE ONE PLACE A BOT MILESTONE RULE IS WRITTEN. Both public
   * entry points read it: `botMilestoneMet` is `value >= target`, and
   * `botMilestoneScore` is the same fraction re-expressed on the player's
   * scale. A second switch is exactly how "met" and "displayed progress"
   * silently drift apart — so when a new map / expansion gives the bot its own
   * criterion, add it HERE as value + target and never as a bare boolean. The
   * normalization below (and the guard test that enumerates this scope,
   * `tests/automa/AutomaMilestoneNormalization.spec.ts`) then covers it for
   * free.
   */
  private static botMilestoneProgress(
    milestone: IMilestone, game: IGame,
  ): {value: number, target: number} | undefined {
    switch (milestone.name) {
    // ── Tharsis ──────────────────────────────────────────────────────────────
    case 'Builder': // Space 8 on the Building track (the human counts building tags).
      return {value: trackPosition(game, 'building'), target: 8};
    case 'Planner': // Space 4 on every track — except Venus (Adding Expansions p.2).
      return {value: everyTrackScore(martianTracks(game).map((t) => t.position), 0), target: 4};
    // ── Hellas (Adding Expansions p.9) ───────────────────────────────────────
    case 'Diversifier': // "At least space 3 on every track" (7 of 8 with Venus).
      return {value: diversifierScore(game), target: 3};
    case 'Tactician': // "It has at least 35 MC".
      return {value: marsBotOf(game).megaCredits, target: 35};
    case 'Energizer': // "[Power] track at space 6 or higher".
      return {value: trackPosition(game, 'power'), target: 6};
    case 'Rim Settler': // "[Jovian/Science] track at space 6 or higher".
      return {value: trackPosition(game, 'science'), target: 6};
    // ── Elysium (Adding Expansions p.9) ──────────────────────────────────────
    case 'Generalist':
      // "At least space 2 on EVERY track" — and the board prints the exclusion
      // itself: «(excl. [V])». So this is Planner's shape, NOT Diversifier's:
      // the Venus track leaves the set entirely instead of being the one
      // substitutable member. Seven Martian tracks at 2 with Venus at 0 is MET;
      // Venus at 18 never stands in for a Martian track that is still at 1.
      return {value: everyTrackScore(martianTracks(game).map((t) => t.position), 0), target: 2};
    case 'Specialist':
      // "Any one track at space 10 or higher". No exclusion is printed here —
      // the sheet marks «(excl. [V])» on Generalist alone — and «the Venus
      // track behaves identically to every other track» (Adding Expansions
      // p.2), so the Venus track is a candidate like the rest.
      return {value: bestTrackPosition(game), target: 10};
    case 'Ecologist': // "[Bio] track at space 4 or higher".
      return {value: trackPosition(game, 'bio'), target: 4};
    case 'Tycoon':
    case 'Tycoon10': // the fork's Elysium variant (10 blue+green, not 15)
      // Officially "Unchanged (green/blue cards in MarsBot's played pile)" —
      // the SAME metric as the human's, but the bot has no tableau, so the
      // milestone's own getScore would honestly read 0 forever. It is here for
      // that container difference ALONE: the target is the milestone's own
      // printed threshold (the fork ships Tycoon10 on Elysium, so this reads
      // 10, not a hard-coded 15), which makes the normalization the identity —
      // the bot's row is literally the human's number. The award twin of this
      // case is Magnate in `botAwardScore`.
      return {
        value: botPlayedPile(game, (card) => GREEN_AND_BLUE.includes(card.type)),
        target: printedTarget(milestone, game, 15),
      };
    case 'Legend':
    case 'Legend4': // the modular variant (4 red)
      // "Unchanged (red cards in MarsBot's played pile)" — the played-pile
      // container case again, see Tycoon above. Covers the modular Legend4.
      return {
        value: botPlayedPile(game, (card) => card.type === CardType.EVENT),
        target: printedTarget(milestone, game, 5),
      };
    // ── Venus Next ───────────────────────────────────────────────────────────
    case 'Hoverlord': // Unchanged: 7 floater resources (Adding Expansions p.2).
      return {value: game.automa?.floaters ?? 0, target: 7};
    default:
      // THE «UNCHANGED» FAMILY — the bot is judged by the PLAYER's own metric
      // because it honestly HAS that metric, in the very place the player
      // milestone looks:
      //   · Terraformer (incl. the fork's Terraformer29 variant) — real TR;
      //   · Mayor / Gardener — real city and greenery tiles;
      //   · Hellas' Polar Explorer — real tiles in the two bottom rows;
      //   · Ares: Networker reads aresData.milestoneResults (the bot is
      //     tallied there like any player); Purifier honestly stays 0 (the bot
      //     never covers a hazard).
      // ELYSIUM CONTRIBUTES NOTHING HERE, and that is a decision, not an
      // oversight: its row is Generalist / Specialist / Ecologist (own track
      // criteria) plus Tycoon and Legend, which are worded "Unchanged" yet
      // still get explicit branches above — not because the RULE differs but
      // because the bot keeps its cards in `automa.playedPile` instead of a
      // tableau, so `canClaim` would read a permanent 0. "Unchanged rule" and
      // "default branch" are therefore not the same question: ask whether the
      // player evaluator can SEE the bot's version of the quantity.
      // A card-based milestone that cannot appear here
      // (validateOptions pins the board set) reads the bot's empty tableau and
      // is honestly "not met". Nothing to normalize: same metric, same scale.
      return undefined;
    }
  }

  /** "How MarsBot determines how it meets milestones" — the map's reference card. */
  public static botMilestoneMet(milestone: IMilestone, game: IGame): boolean {
    const progress = AutomaMAEvaluation.botMilestoneProgress(milestone, game);
    return progress === undefined ?
      milestone.canClaim(marsBotOf(game)) :
      progress.value >= progress.target;
  }

  /**
   * MarsBot's progress on the PLAYER'S scale — the number every UI surface
   * shows in the milestone list, next to the human rows.
   *
   * NORMALIZATION CONTRACT (why this is not the raw metric). At the table
   * MarsBot is just another player, and what a human needs from a milestone
   * row is "how close is it" — stated in the SAME units as everyone else's.
   * The bot's internal units (M€ for Tactician, a track space for Rim Settler)
   * are an implementation detail of the reference card and must never reach
   * the client: under one printed threshold they read as nonsense («Вы 2/5 ·
   * Бот 41») and rank the race by a number that means nothing.
   *
   *     displayed = floor(value * threshold / target)
   *
   * so Tactician (bot: 35 M€ ↔ player: 5 cards with requirements) reads
   * 34 M€ → 4/5, 35 → 5/5, 40 → 5/5, 50 → 7/5 — still visibly past the
   * threshold, still in the player's units.
   *
   * The floor is load-bearing, not cosmetic: `floor(v·H/T) >= H` holds EXACTLY
   * when `v >= T`, so the displayed number crosses the printed threshold on
   * the very frame `botMilestoneMet` flips. A client can therefore never paint
   * "can claim" early or hide it late — and needs no bot-specific code to get
   * that right.
   *
   * AWARDS ARE DELIBERATELY NOT NORMALIZED (`botAwardScore` below): an award
   * score is compared DIRECTLY against the human scores to hand out the 5/2 VP
   * (`AwardScorer` → `giveAwards`), so it is already the shared currency the
   * rules speak — rescaling it would make the displayed race contradict the
   * endgame result.
   */
  public static botMilestoneScore(milestone: IMilestone, game: IGame): number {
    const progress = AutomaMAEvaluation.botMilestoneProgress(milestone, game);
    if (progress === undefined) {
      return milestone.getScore(marsBotOf(game));
    }
    const threshold = milestoneThreshold(milestone, game);
    if (threshold === undefined || progress.target <= 0) {
      // A milestone with no numeric threshold has no scale to map onto; the
      // raw progress is the only honest thing left to say.
      return progress.value;
    }
    return Math.floor((progress.value * threshold) / progress.target);
  }

  /**
   * A HUMAN's award strength as the Automa rules define it — `undefined` when
   * the printed award rule stands unchanged, which is every award but one.
   *
   * INDUSTRIALIST (Elysium). The reference card spells the human side out:
   * «when considering your strength for Industrialist, MarsBot counts your
   * current steel resources, your current steel production, and your current
   * power production. (Your current power resources do not count since they
   * cannot be carried over.)» That is a rules override, not a hint: the
   * printed award reads «most steel and energy», and after the final
   * production the plain evaluator switches to `steel + energy` — counting
   * exactly the resources this sentence excludes and dropping the production
   * it includes.
   *
   * Applied through `AwardScorer` so ONE number serves the bot's funding
   * decision, the award overlay and the endgame VP alike; a game without
   * MarsBot never reaches it, so ordinary player-side scoring is untouched.
   */
  public static humanAwardScore(award: IAward, game: IGame, player: IPlayer): number | undefined {
    if (game.automa === undefined) {
      return undefined;
    }
    switch (award.name) {
    case 'Industrialist':
      return player.steel + player.production.steel + player.production.energy;
    default:
      return undefined;
    }
  }

  /**
   * "How MarsBot determines how it stands within each award" — the map's
   * reference card (+ Venuphile). Easy difficulty: every value −5 (rulebook
   * p.11, no floor — the printed rule has none).
   */
  public static botAwardScore(award: IAward, game: IGame): number {
    const bot = marsBotOf(game);
    let score: number;
    switch (award.name) {
    // ── Tharsis ──────────────────────────────────────────────────────────────
    case 'Landlord': // Unchanged: tiles owned in play.
      score = award.getScore(bot);
      break;
    case 'Banker':
      score = trackPosition(game, 'building') + trackPosition(game, 'event');
      break;
    case 'Scientist':
      score = trackPosition(game, 'science');
      break;
    case 'Thermalist':
      score = trackPosition(game, 'power') + 5;
      break;
    case 'Miner':
      score = trackPosition(game, 'space') + 5;
      break;
    // ── Hellas (Adding Expansions p.9) ───────────────────────────────────────
    case 'Magnate':
      // "Unchanged (green cards in MarsBot's played pile)" — the bot has no
      // tableau, so the award's own getScore would honestly read 0.
      score = botPlayedPileCount(game, CardType.AUTOMATED);
      break;
    case 'Space Baron': // "[Space] track space".
      score = trackPosition(game, 'space');
      break;
    case 'Excentric': // "Every 5 MC counts as 1 resource".
      score = Math.floor(bot.megaCredits / 5);
      break;
    case 'Contractor': // "[Building] track space".
      score = trackPosition(game, 'building');
      break;
    // ── Elysium (Adding Expansions p.9) ──────────────────────────────────────
    case 'Celebrity':
      // "As usual, but MarsBot INCLUDES EVENTS in this count unlike you" — the
      // one printed asymmetry on this card. Two differences from the player's
      // own getScore, then: the pile instead of a tableau, and red cards
      // counted. Cost is the card's own printed base cost, 20 EXACTLY included.
      score = botPlayedPile(game, (card) => card.cost >= 20);
      break;
    case 'Industrialist': // "[Power] track space + 5".
      score = trackPosition(game, 'power') + 5;
      break;
    case 'Benefactor':
      // "Reduce MarsBot's TR by 15 FOR THE PURPOSE OF THIS AWARD" — an
      // evaluation-only handicap. The bot's actual terraform rating is
      // untouched (no event, no endgame change): this number exists solely to
      // be compared against the humans' TR here.
      score = bot.terraformRating - 15;
      break;
    // ── Venus Next ───────────────────────────────────────────────────────────
    case 'Venuphile': // Venus track position (Adding Expansions p.3).
      score = trackPosition(game, 'venus');
      break;
    default:
      // Tile-based awards evaluate the bot's real board presence — Hellas'
      // Cultivator ("unchanged", greeneries owned) rides this, and so does the
      // whole Elysium tile pair: Desert Settler ("unchanged", tiles in the
      // Southern Region) and Estate Dealer ("unchanged", tiles adjacent to an
      // ocean) read the bot's REAL tiles through the very same evaluator the
      // humans use — there is nothing bot-specific to write. The Ares pair
      // rides it too: Rugged counts its REAL tiles next to hazards,
      // Entrepreneur honestly reads 0 (the bot never owns adjacency-bonus
      // tiles); anything else cannot appear (validateOptions pins the board
      // set).
      score = award.getScore(bot);
      break;
    }
    if (game.automa?.difficulty === 'easy') {
      score -= 5;
    }
    // The seated corporation's own printed modifier (C42's «+2 on all
    // awards»). Applied HERE because this is the one derivation every
    // consumer reads through `AwardScorer` — the bot's funding decision, the
    // award overlay and the endgame scoring alike.
    return score + AutomaCorporations.awardScoreBonus(game);
  }
}

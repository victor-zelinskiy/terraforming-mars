import {CardType} from '../../common/cards/CardType';
import {MarsBotTrackRole} from '../../common/automa/AutomaTypes';
import {AutomaCorporations} from './corps/AutomaCorporations';
import {IAward} from '../awards/IAward';
import {IMilestone, milestoneThreshold} from '../milestones/IMilestone';
import {IGame} from '../IGame';
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

/** Green (automated) project cards in MarsBot's PLAYED PILE — the bot has no tableau. */
function botPlayedPileCount(game: IGame, type: CardType): number {
  let count = 0;
  for (const name of game.automa?.playedPile ?? []) {
    if (newProjectCard(name)?.type === type) {
      count++;
    }
  }
  return count;
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
    // ── Venus Next ───────────────────────────────────────────────────────────
    case 'Hoverlord': // Unchanged: 7 floater resources (Adding Expansions p.2).
      return {value: game.automa?.floaters ?? 0, target: 7};
    default:
      // "Unchanged" milestones (Terraformer — incl. the fork's Terraformer29
      // threshold variant — Mayor, Gardener, and Hellas' Polar Explorer)
      // evaluate the bot exactly like a player: its TR and its tiles are real,
      // so the milestone's own canClaim is the honest source. The Ares
      // additions ride this too: Networker reads aresData.milestoneResults (the
      // bot is tallied there like any player), Purifier honestly stays 0 (the
      // bot never covers a hazard). A card-based milestone that cannot appear here
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
    // ── Venus Next ───────────────────────────────────────────────────────────
    case 'Venuphile': // Venus track position (Adding Expansions p.3).
      score = trackPosition(game, 'venus');
      break;
    default:
      // Tile-based awards evaluate the bot's real board presence — Hellas'
      // Cultivator ("unchanged", greeneries owned) rides this, as does the
      // Ares pair: Rugged counts its REAL tiles next to hazards, Entrepreneur
      // honestly reads 0 (the bot never owns adjacency-bonus tiles); anything
      // else cannot appear (validateOptions pins the board set).
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

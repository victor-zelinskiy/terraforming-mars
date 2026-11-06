import {AutomaCorporations} from './corps/AutomaCorporations';
import {IAward} from '../awards/IAward';
import {IMilestone, milestoneThreshold} from '../milestones/IMilestone';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Founder} from '../awards/modular/Founder';
import {isSpecialTileSpace} from '../boards/Board';
import {TileType} from '../../common/TileType';
import {marsBotOf} from './AutomaUtil';
import {botAwardRawScore, botMilestoneProgress} from './ma/botMAInterpreter';

/**
 * How MarsBot evaluates milestones & awards — the PUBLIC face of the bot-rule registry. Each name's rule is ONE row
 * of `ma/botMARules.ts` (its sources and provenance there, the reasoning in docs/AUTOMA_DATA_AUDIT.md §22.2), read
 * by the ONE interpreter `ma/botMAInterpreter.ts`; this class adds what is the same for every name — the milestone
 * normalization onto the player's scale, the difficulty and corporation modifiers of the award score, and the one
 * HUMAN-side override (`humanAwardScore`).
 *
 * A dedicated module (no AwardScorer import) so AwardScorer itself can consult it without an import cycle.
 */
export class AutomaMAEvaluation {
  /**
   * MarsBot's OWN criterion for one milestone, as a FRACTION: how far it has come (`value`) out of what its rule
   * demands (`target`); `undefined` = the bot is judged by the PLAYER's own metric (the «unchanged» family).
   *
   * ⚠️ The rule itself is a ROW of the bot-rule registry (`ma/botMARules.ts`), read by the ONE interpreter
   * (`ma/botMAInterpreter.ts`) — never a branch here. Both public entry points below read this one fraction:
   * `botMilestoneMet` is `value >= target`, `botMilestoneScore` the same fraction on the player's scale, so «met»
   * and «displayed progress» cannot drift apart.
   */
  private static botMilestoneProgress(milestone: IMilestone, game: IGame): {value: number, target: number} | undefined {
    return botMilestoneProgress(milestone, game);
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
   * FOUNDER (Terra Cimmeria) is the other one, and it reads the other way
   * round: the printed award is unchanged for the BOT, and the humans lose one
   * tile from the special-tile set — the Neural Instance, which only exists in
   * an automa game in the first place.
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
    case 'Founder':
      // TERRA CIMMERIA. "Unchanged, but the Neural Instance tile counts as a
      // special tile for MarsBot BUT NOT FOR YOU!" The bot keeps the canonical
      // classifier (which answers TRUE for it); the humans count the same
      // adjacency over a set with that one tile removed. Same counting code —
      // `Founder.count` takes the set as an argument precisely so these two
      // readings cannot drift.
      return Founder.count(player, (space) =>
        isSpecialTileSpace(space) && space.tile?.tileType !== TileType.NEURAL_INSTANCE);
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
    // The rule is a row of the registry (`ma/botMARules.ts`); the «as usual» family reads the award's own score.
    let score = botAwardRawScore(award, game);
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

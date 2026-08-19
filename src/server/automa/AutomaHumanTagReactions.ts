import {CardName} from '../../common/cards/CardName';
import {Tag} from '../../common/cards/Tag';
import {IGame} from '../IGame';
import {ICard} from '../cards/ICard';
import {IProjectCard} from '../cards/IProjectCard';
import {humansOf, marsBotOf} from './AutomaUtil';

/**
 * HUMAN corporation effects that officially react to the BOT's card flips —
 * Rule Book B «Adding Corporations», FAQ p.4 (transcribed in
 * docs/AUTOMA_DATA_AUDIT.md §10):
 *
 *  · Saturn Systems — «The Jovian tag effect of this corporation is triggered
 *    only when you or MarsBot play a card with a Jovian tag. An advance
 *    tracker effect on MarsBot's player mat does not trigger it. …If
 *    MarsBot's corporation has a Jovian starting tag, resolve your ability as
 *    if a card containing the tag was played.»
 *  · Pharmacy Union / Splice — «If you're playing Pharmacy Union or Splice,
 *    and MarsBot's starting corporation or any track or bonus effect gives it
 *    a microbe advancement (not a plant or animal), resolve your
 *    corporation's effect as if a card with a microbe was played.»
 *
 * The bot's flips do not go through `Player.playCard`, so the ordinary
 * `onCardPlayedByAnyPlayer` dispatch never sees them — this module is the
 * sanctioned bridge. It is an EXPLICIT allowlist (the AutomaBans precedent):
 * RB-B enumerates exactly these corporations, so a blanket "fire every
 * any-player reactor for bot flips" would invent triggers the rules never
 * sanctioned (Solar Logistics et al. stay silent by design — see
 * docs/AUTOMA_PROMO_MULTIPLAYER_FRAME.md §4). The card LOGIC stays co-located
 * in the card files (their own existing hooks, plus the RB-B microbe-
 * advancement hook `onMarsBotMicrobeAdvancement`); this module only routes.
 *
 * The tracker-advance exclusion for Saturn Systems is STRUCTURAL: cascaded
 * track actions never pass through these dispatch points, only a resolved
 * card's printed row / a corporation's starting tag / the Venus board's
 * printed microbe cell do.
 */
const SANCTIONED_REACTORS: ReadonlySet<CardName> = new Set([
  CardName.SATURN_SYSTEMS,
  CardName.PHARMACY_UNION,
  CardName.SPLICE,
]);

export class AutomaHumanTagReactions {
  /**
   * The bot RESOLVED a project card (its turn flip, the Research &
   * Development draw, the Neural Instance fallback) — fire the sanctioned
   * human reactors exactly the way `Player.onCardPlayed` would (same hook,
   * same event attribution). A sanctioned reactor must never return a
   * PROMPT for the bot (Splice's co-located bot branch resolves its
   * card-player half deterministically) — a returned input is a loud error,
   * never a silently dropped decision.
   */
  public static onBotCardResolved(game: IGame, card: IProjectCard): void {
    if (game.automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    for (const human of humansOf(game)) {
      for (const effectCard of human.playedCards) {
        if (!SANCTIONED_REACTORS.has(effectCard.name) || effectCard.onCardPlayedByAnyPlayer === undefined) {
          continue;
        }
        const input = game.events.withEffect(human, effectCard, 'card-played-by-any',
          () => effectCard.onCardPlayedByAnyPlayer?.(human, card, bot));
        if (input !== undefined) {
          throw new Error(`${effectCard.name} returned a prompt for a MarsBot card flip — the bot never receives prompts`);
        }
      }
    }
  }

  /**
   * The bot resolved a NON-CARD tag — its corporation's starting tag (RB-B
   * Setup 4). Routes to the sanctioned reactors' existing
   * `onNonCardTagAddedByAnyPlayer` hook (the same one the Hydronetwork's
   * Jovian award already fires). Today that reaches Saturn Systems' Jovian
   * clause; a future corporation with a MICROBE starting tag additionally
   * goes through {@link onBotMicrobeAdvancement} at its call site.
   */
  public static onBotNonCardTag(game: IGame, tag: Tag): void {
    if (game.automa === undefined) {
      return;
    }
    for (const human of humansOf(game)) {
      for (const effectCard of human.playedCards) {
        if (!SANCTIONED_REACTORS.has(effectCard.name) || effectCard.onNonCardTagAddedByAnyPlayer === undefined) {
          continue;
        }
        game.events.withEffect(human, effectCard, 'tag-added',
          () => effectCard.onNonCardTagAddedByAnyPlayer?.(human, tag));
      }
    }
    if (tag === Tag.MICROBE) {
      AutomaHumanTagReactions.onBotMicrobeAdvancement(game);
    }
  }

  /**
   * «Any track or bonus effect gives it a MICROBE advancement (not a plant or
   * animal)» — the Venus board's printed microbe cell (position 9 advances
   * the Bio track BY a microbe), or a future microbe-flavored effect. Pharmacy
   * Union / Splice resolve «as if a card with a microbe was played», through
   * their co-located `onMarsBotMicrobeAdvancement` hooks.
   */
  public static onBotMicrobeAdvancement(game: IGame): void {
    if (game.automa === undefined) {
      return;
    }
    for (const human of humansOf(game)) {
      for (const effectCard of human.playedCards) {
        if (!SANCTIONED_REACTORS.has(effectCard.name)) {
          continue;
        }
        const hook = (effectCard as ICard).onMarsBotMicrobeAdvancement;
        if (hook !== undefined) {
          game.events.withEffect(human, effectCard, 'tag-added',
            () => hook.call(effectCard, human));
        }
      }
    }
  }
}

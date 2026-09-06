import {CardName} from '../../common/cards/CardName';
import {Tag} from '../../common/cards/Tag';
import {IGame} from '../IGame';
import {ICard} from '../cards/ICard';
import {IProjectCard} from '../cards/IProjectCard';
import {humansOf, marsBotOf} from './AutomaUtil';

/**
 * HUMAN card/corporation effects reacting to the BOT's card flips. The bot's
 * flips do not go through `Player.playCard`, so the ordinary
 * `onCardPlayedByAnyPlayer` dispatch never sees them — this module is the
 * sanctioned bridge. The card LOGIC stays co-located in the card files (their
 * own existing hooks, plus the RB-B microbe-advancement hook
 * `onMarsBotMicrobeAdvancement`); this module only routes.
 *
 * TWO dispatch regimes, deliberately different:
 *
 * 1. A RESOLVED PROJECT CARD fans out to EVERY reactor («the general rule»,
 *    fork rule fixed by the owner 2026-09-06, superseding the earlier
 *    allowlist): when MarsBot resolves a real project card, that card counts
 *    as «any player plays a card» for every human `onCardPlayedByAnyPlayer`
 *    effect — the generalization of the Saturn Systems FAQ precedent («…is
 *    triggered when you or MarsBot play a card with a Jovian tag; an advance
 *    tracker effect does not trigger it», RB-B FAQ p.4, transcribed in
 *    docs/AUTOMA_DATA_AUDIT.md §10). Solar Logistics therefore draws once per
 *    Space+Event project the bot resolves — through the mandatory
 *    external-draw intake, since the trigger is foreign by construction. Each
 *    reactor keeps its OWN printed granularity (per-card vs per-tag is the
 *    card file's reading, as always). The tracker-advance exclusion is
 *    STRUCTURAL: cascaded track actions never pass through these dispatch
 *    points, only a resolved card's printed row does — and a card counts even
 *    when its track movement collapses into a Failed Action (the dispatch
 *    sits before the resolver on purpose).
 *
 * 2. NON-CARD tags and microbe advancements stay an EXPLICIT FAQ allowlist
 *    (the AutomaBans precedent): RB-B maps those non-card events to «as if a
 *    card was played» for exactly Saturn Systems / Pharmacy Union / Splice —
 *    generalizing THAT would invent triggers no rule sanctions.
 */
const SANCTIONED_NON_CARD_REACTORS: ReadonlySet<CardName> = new Set([
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
        if (effectCard.onCardPlayedByAnyPlayer === undefined) {
          continue;
        }
        const input = game.events.withEffect(human, effectCard, 'card-played-by-any',
          () => effectCard.onCardPlayedByAnyPlayer?.(human, card, bot));
        if (input !== undefined) {
          // A returned input would be a prompt whose ANSWERING side involves
          // the bot's flip — a reactor that needs one must resolve its bot
          // half deterministically in a co-located branch (Splice precedent).
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
        if (!SANCTIONED_NON_CARD_REACTORS.has(effectCard.name) || effectCard.onNonCardTagAddedByAnyPlayer === undefined) {
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
        if (!SANCTIONED_NON_CARD_REACTORS.has(effectCard.name)) {
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

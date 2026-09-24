/*
 * THE CHAIRMAN QUEST TRACKER (rulebook p.9).
 *
 * Progress is counted from a player's OWN actions in the action phase — never
 * from an enacted resolution's effect (project decision Q5), never from the
 * political phase or the World Government, never from another player's
 * action that happened to pay this player. The tracker decides eligibility
 * from the EVENT RECORDER's live chain (whose action is the root, under which
 * category, and whether a resolution source is anywhere on the stack) and
 * counts the ACTUAL delta the engine applied — never the amount a card asked
 * for. Journal and notifications merely reflect what is recorded here.
 */
import {IPlayer} from '../../IPlayer';
import {Phase} from '../../../common/Phase';
import {Resource} from '../../../common/Resource';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {TileType, isSpecialTile} from '../../../common/TileType';
import {SpaceType} from '../../../common/boards/SpaceType';
import {Space} from '../../boards/Space';
import {Board} from '../../boards/Board';
import {BoardType} from '../../boards/BoardType';
import {JournalActionCategory} from '../../../common/events/GameEvent';
import {QuestGoal} from '../../../common/parliament/ParliamentTypes';
import {ChairmanSeat} from './ChairmanSeat';

export type QuestEvent =
  | {kind: 'production'; resource: Resource; amount: number}
  | {kind: 'tag'; tags: ReadonlyArray<Tag>}
  /**
   * A tile seated on a space. `board` names WHICH board: every tile goal is
   * printed for Mars (a city / a special tile / a greenery «on Mars», a space
   * city in Mars' reserved areas), so a lunar placement — whose spaces are
   * `LAND` too and would read as «on Mars» by space type alone — is rejected
   * by the board, not by a tile-type list that would rot with the next
   * expansion. Today only `Game.addTile` (Mars) reports; the field keeps a
   * future Moon report from silently counting.
   */
  | {kind: 'tile'; space: Space; tileType: TileType; board: BoardType}
  | {kind: 'colony'}
  | {kind: 'tr'; steps: number}
  | {kind: 'cardResource'; resource: CardResource | undefined; amount: number}
  | {kind: 'delegates'; amount: number}
  | {kind: 'cardsPlayed'; cardType: CardType};

/** Roots that are NOT a player's own action: nothing under them progresses a quest. */
const FOREIGN_ROOT_CATEGORIES: ReadonlySet<JournalActionCategory> = new Set<JournalActionCategory>([
  'political-phase', 'planetary-event', 'solar-phase', 'automa-turn', 'vp-pressure',
]);

export class QuestTracker {
  /**
   * Is the live chain one of `player`'s own action-phase actions? Public so
   * tests can pin the rule; read-only.
   */
  public static eligible(player: IPlayer): boolean {
    const game = player.game;
    const parliament = game?.parliament;
    if (parliament === undefined || !parliament.participates(player)) {
      return false;
    }
    if (game.phase !== Phase.ACTION) {
      return false;
    }
    const events = game.events;
    const root = events.currentRoot();
    if (root === undefined || root.player !== player.color) {
      return false;
    }
    if (root.category !== undefined && FOREIGN_ROOT_CATEGORIES.has(root.category)) {
      return false;
    }
    // An enacted resolution's effect — including the result of its action —
    // never counts (decision Q5).
    if (events.hasSourceOnStack('resolution')) {
      return false;
    }
    return true;
  }

  /** How much of `goal` the event satisfies (0 when it does not apply). */
  public static match(goal: QuestGoal, event: QuestEvent): number {
    switch (goal.kind) {
    case 'production':
      return event.kind === 'production' && event.resource === goal.resource ? Math.max(0, event.amount) : 0;
    case 'tag':
      return event.kind === 'tag' ? event.tags.filter((tag) => tag === goal.tag).length : 0;
    case 'tile':
      return event.kind === 'tile' ? (QuestTracker.tileMatches(goal.tile, event) ? 1 : 0) : 0;
    case 'colony':
      return event.kind === 'colony' ? 1 : 0;
    case 'tr':
      return event.kind === 'tr' ? Math.max(0, event.steps) : 0;
    case 'cardResource':
      return event.kind === 'cardResource' && event.resource === goal.resource ? Math.max(0, event.amount) : 0;
    case 'delegates':
      return event.kind === 'delegates' ? Math.max(0, event.amount) : 0;
    case 'cardsPlayed':
      if (event.kind !== 'cardsPlayed') {
        return 0;
      }
      // An EVENT is matched by its TYPE (Joint Research: «play 2 event cards»):
      // the event tag is never in `card.tags`, so the tag goal could not see it.
      return (goal.cardType === 'active' && event.cardType === CardType.ACTIVE) ||
        (goal.cardType === 'automated' && event.cardType === CardType.AUTOMATED) ||
        (goal.cardType === 'event' && event.cardType === CardType.EVENT) ? 1 : 0;
    }
  }

  private static tileMatches(kind: Extract<QuestGoal, {kind: 'tile'}>['tile'], event: Extract<QuestEvent, {kind: 'tile'}>): boolean {
    // The Moon is not Mars: no printed tile goal reads a lunar placement,
    // whatever its space type says.
    if (event.board !== BoardType.MARS) {
      return false;
    }
    const {space, tileType} = event;
    const onMars = space.spaceType !== SpaceType.COLONY;
    const isCity = Board.isCitySpace(space);
    switch (kind) {
    case 'greenery':
      return onMars && tileType === TileType.GREENERY;
    case 'city':
      return onMars && isCity;
    case 'special':
      // The printed solid brown hex: a special tile on Mars — the game's own
      // classifier (`isSpecialTile`: not a greenery, not an ocean, not a plain
      // city, not a Moon tile, not an Ares hazard) minus the CITY family
      // (Capital, an ocean city: cities, and a city is its own goal).
      return onMars && !isCity && isSpecialTile(tileType);
    case 'spaceCity':
      return !onMars && isCity;
    }
  }

  /** Report an engine mutation. Cheap when there is no parliament or no open quest. */
  public static report(player: IPlayer, event: QuestEvent): void {
    const parliament = player.game?.parliament;
    if (parliament === undefined) {
      return;
    }
    const quest = parliament.quest;
    if (quest === undefined || quest.completedBy !== undefined) {
      return;
    }
    if (!QuestTracker.eligible(player)) {
      return;
    }
    const amount = QuestTracker.match(quest.definition.goal, event);
    if (amount <= 0) {
      return;
    }
    const result = parliament.addQuestProgress(player, amount);
    if (result === 'progress') {
      player.game.log('${0} advanced the chairman quest to ${1}/${2}', (b) =>
        b.player(player).number(parliament.questProgressOf(player)).number(quest.definition.count));
    } else if (result === 'completed') {
      ChairmanSeat.onQuestCompleted(player);
    }
  }
}

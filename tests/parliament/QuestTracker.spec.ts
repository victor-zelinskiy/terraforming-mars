import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {QuestEvent, QuestTracker} from '../../src/server/parliament/quests/QuestTracker';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {Tag} from '../../src/common/cards/Tag';
import {SelectParty} from '../../src/server/inputs/SelectParty';
import {cast} from '../../src/common/utils/utils';
import {fakeCard} from '../TestingUtils';
import {EventSource} from '../../src/common/events/EventSource';
import {CLIMATE_RESEARCH_ID} from '../../src/server/parliament/resolutions/greens/ClimateResearch';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {answerQuestGate} from './parliamentArrange';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Space} from '../../src/server/boards/Space';
import {BoardType} from '../../src/server/boards/BoardType';

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Run `f` as one of `player`'s own actions (a card play). */
function asOwnAction(player: TestPlayer, f: () => void, source: EventSource = {kind: 'card', card: CardName.TREES, owner: player.color}): void {
  const events = player.game.events;
  events.beginAction(player, source, {category: 'card-play'});
  try {
    f();
  } finally {
    events.endScope();
  }
}

/** Queue «+1 heat production» for `player` — a step that runs when the deferred queue is drained. */
function heatLater(player: TestPlayer): void {
  player.defer(() => {
    player.production.add(Resource.HEAT, 1);
    return undefined;
  });
}

describe('QuestTracker (the chairman quest)', () => {
  it('counts the starter quest (+3 heat production) only from the player\'s own action-phase actions', () => {
    const [game, p1, p2, parliament] = reduxGame();
    // Outside any action: nothing.
    p1.production.add(Resource.HEAT, 1);
    expect(parliament.questProgressOf(p1)).eq(0);
    // Under another player's action: nothing for p1.
    asOwnAction(p2, () => p1.production.add(Resource.HEAT, 1));
    expect(parliament.questProgressOf(p1)).eq(0);
    // Outside the action phase: nothing.
    game.phase = Phase.PARLIAMENT;
    asOwnAction(p1, () => p1.production.add(Resource.HEAT, 1));
    expect(parliament.questProgressOf(p1)).eq(0);
    game.phase = Phase.ACTION;
    // Under an enacted resolution's effect: nothing (decision Q5) — Climate
    // Research raises heat production exactly this way.
    asOwnAction(p1, () => p1.production.add(Resource.HEAT, 1), {kind: 'resolution', id: CLIMATE_RESEARCH_ID, owner: p1.color});
    expect(parliament.questProgressOf(p1)).eq(0);
    // The player's own card play: counts the ACTUAL delta.
    asOwnAction(p1, () => p1.production.add(Resource.HEAT, 2));
    expect(parliament.questProgressOf(p1)).eq(2);
    // A different resource: nothing.
    asOwnAction(p1, () => p1.production.add(Resource.PLANTS, 2));
    expect(parliament.questProgressOf(p1)).eq(2);
  });

  /*
   * A DEFERRED STEP IS STILL THE PLAYER'S ACTION. A deferred action captures only the TOP scope of the event
   * stack, so a step queued inside a source override (`withSource` — a colony's bonus, a fleet dock's reward) or
   * a passive effect used to run with no ROOT on the stack: the same gain counted when made at once and was
   * silently dropped when it had to wait for the queue (a colony's ocean, a dock's ocean — their TR never reached
   * the quest). The non-root scope now remembers the root it was opened under (`EventContext.root`).
   */
  it('a step deferred inside a source override, or a passive effect, keeps its ROOT — the gain counts as it does when made at once', () => {
    const [game, p1, , parliament] = reduxGame();
    const card = fakeCard({name: 'A reacting card' as CardName});
    // At once, inside the override: counts (it always did).
    asOwnAction(p1, () => game.events.withSource({kind: 'colony', name: game.colonies[0].name}, () => p1.production.add(Resource.HEAT, 1)));
    expect(parliament.questProgressOf(p1)).eq(1);
    // Deferred from inside the override, run after the action's scope has closed: counts too.
    asOwnAction(p1, () => game.events.withSource({kind: 'colony', name: game.colonies[0].name}, () => {
      heatLater(p1);
    }));
    expect(parliament.questProgressOf(p1), 'nothing ran yet').eq(1);
    game.deferredActions.runAll(() => {});
    expect(parliament.questProgressOf(p1), 'the deferred step is still p1\'s own action').eq(2);
    // …and the same from inside a passive effect of the player's own card.
    asOwnAction(p1, () => game.events.withEffect(p1, card, 'card-played', () => {
      heatLater(p1);
    }));
    game.deferredActions.runAll(() => {});
    expect(parliament.questProgressOf(p1)).eq(3);
    // The root is REMEMBERED, never invented: a step deferred under ANOTHER player's action is still not p1's deed…
    const [game2, q1, q2, parliament2] = reduxGame();
    asOwnAction(q2, () => game2.events.withSource({kind: 'colony', name: game2.colonies[0].name}, () => {
      heatLater(q1);
    }));
    game2.deferredActions.runAll(() => {});
    expect(parliament2.questProgressOf(q1)).eq(0);
    // …and a step deferred with no action at all has no root to remember.
    game2.events.withSource({kind: 'colony', name: game2.colonies[0].name}, () => {
      heatLater(q1);
    });
    game2.deferredActions.runAll(() => {});
    expect(parliament2.questProgressOf(q1)).eq(0);
  });

  it('completing the quest advances the Agenda and seats the chairman from the reserve; nobody else can complete it this generation', () => {
    const [game, p1, p2, parliament] = reduxGame();
    asOwnAction(p1, () => p1.production.add(Resource.HEAT, 3));
    expect(parliament.quest?.completedBy).eq(p1.id);
    // THE GATE STANDS: the completion is recorded, nothing is applied.
    expect(parliament.pendingActions).deep.eq([{kind: 'chairman-quest', player: p1.id}]);
    expect(parliament.chairman).is.undefined;
    expect(parliament.agendaOf(p1)).eq(0);
    answerQuestGate(game, p1);
    expect(parliament.chairman).eq(p1.id);
    expect(parliament.agendaOf(p1)).eq(1);
    expect(parliament.lobby.has(p1.id), 'the lobby delegate stays; the seat came from the reserve').is.true;
    expect(parliament.reserve(p1)).eq(5);
    asOwnAction(p2, () => p2.production.add(Resource.HEAT, 3));
    expect(parliament.questProgressOf(p2)).eq(0);
    expect(parliament.chairman).eq(p1.id);
  });

  it('a new chairman unseats the previous one (whose delegate returns); a sitting chairman only advances', () => {
    const [game, p1, p2, parliament] = reduxGame();
    parliament.chairman = p2.id;
    expect(parliament.reserve(p2)).eq(5);
    asOwnAction(p1, () => p1.production.add(Resource.HEAT, 3));
    expect(parliament.chairman, 'the office is untouched until the gate is answered').eq(p2.id);
    answerQuestGate(game, p1);
    expect(parliament.chairman).eq(p1.id);
    expect(parliament.reserve(p2)).eq(6);
    // Next generation's quest (the spec's own definition — the tracker reads
    // the definition, the source only names it): the chairman completes it again.
    parliament.quest = {definition: {goal: {kind: 'tag', tag: Tag.EARTH}, count: 1}, source: ARCHITECTURE_AWARD_ID, generation: 2, progress: new Map()};
    const reserve = parliament.reserve(p1);
    asOwnAction(p1, () => p1.onCardPlayed(fakeCard({tags: [Tag.EARTH]})));
    // The sitting chairman is asked too — the office does not change, but the step is still a reward.
    answerQuestGate(game, p1);
    expect(parliament.chairman).eq(p1.id);
    expect(parliament.agendaOf(p1)).eq(2);
    expect(parliament.reserve(p1), 'kept the seated delegate').eq(reserve);
  });

  it('when every delegate is on a resolution, the player chooses which own resolution gives one up — and the choice survives a reload', () => {
    const [game, p1, , parliament] = reduxGame();
    // A generation-1 reload without corporations re-enters the initial research; make it a generation-2 matter.
    game.generation = 2;
    parliament.placeVote(p1, parliament.slots[0], 'lobby');
    for (let i = 0; i < 6; i++) {
      parliament.placeVote(p1, parliament.slots[i < 3 ? 1 : 2], 'reserve');
    }
    expect(parliament.reserve(p1)).eq(0);
    asOwnAction(p1, () => p1.production.add(Resource.HEAT, 3));
    answerQuestGate(game, p1);
    expect(parliament.chairman, 'not seated yet — a delegate must be chosen').is.undefined;
    expect(parliament.pendingActions).deep.eq([{kind: 'chairman-seat', player: p1.id}]);
    expect(parliament.agendaOf(p1), 'the step waits for the seat it pays for').eq(0);
    const ask = cast(p1.getWaitingFor(), SelectParty);
    expect(ask.votePrompt).deep.eq({source: 'chairman-seat', cost: 0});
    expect(ask.parties).has.length(3);

    const restored = Game.deserialize(structuredClone(game.serialize()));
    const one = restored.getPlayerById(p1.id);
    const copy = restored.parliament!;
    const rebuilt = cast(one.getWaitingFor(), SelectParty);
    const party = copy.resolutionOf(copy.slots[2].instance).party;
    rebuilt.process({type: 'party', partyName: party});
    expect(copy.chairman).eq(p1.id);
    expect(copy.agendaOf(one), 'the Agenda step follows the seat, never precedes it').eq(1);
    expect(copy.votesOf(one, copy.slots[2])).eq(2);
    expect(copy.votesOf(one)).eq(6);
    expect(copy.pendingActions).deep.eq([]);
    copy.assertLedger(restored);
  });

  it('matches every goal kind the catalog uses', () => {
    const [, p1, , parliament] = reduxGame();
    const check = (goal: Parameters<typeof QuestTracker.match>[0], event: Parameters<typeof QuestTracker.match>[1], expected: number) => {
      expect(QuestTracker.match(goal, event), JSON.stringify(goal)).eq(expected);
    };
    check({kind: 'tag', tag: Tag.EARTH}, {kind: 'tag', tags: [Tag.EARTH, Tag.EARTH, Tag.SPACE]}, 2);
    check({kind: 'tr'}, {kind: 'tr', steps: 2}, 2);
    check({kind: 'colony'}, {kind: 'colony'}, 1);
    check({kind: 'delegates'}, {kind: 'delegates', amount: 1}, 1);
    check({kind: 'cardsPlayed', cardType: 'active'}, {kind: 'cardsPlayed', cardType: CardType.EVENT}, 0);
    check({kind: 'cardsPlayed', cardType: 'active'}, {kind: 'cardsPlayed', cardType: CardType.ACTIVE}, 1);
    check({kind: 'cardsPlayed', cardType: 'automated'}, {kind: 'cardsPlayed', cardType: CardType.AUTOMATED}, 1);
    // An EVENT is a TYPE here (Joint Research): the event tag is never in `card.tags`, so only the type goal sees it.
    check({kind: 'cardsPlayed', cardType: 'event'}, {kind: 'cardsPlayed', cardType: CardType.EVENT}, 1);
    check({kind: 'cardsPlayed', cardType: 'event'}, {kind: 'cardsPlayed', cardType: CardType.AUTOMATED}, 0);
    check({kind: 'production', resource: Resource.STEEL}, {kind: 'production', resource: Resource.STEEL, amount: -1}, 0);
    // A TRADE performed (Trade Industries): one deed, one point — never a colony built, never a fleet owned.
    check({kind: 'trade'}, {kind: 'trade'}, 1);
    check({kind: 'trade'}, {kind: 'colony'}, 0);
    check({kind: 'colony'}, {kind: 'trade'}, 0);
    // TILES — the seated tile on a Mars land cell / a reserved area off Mars, stamped with its board.
    const game = p1.game;
    const land = game.board.getAvailableSpacesOnLand(p1)[0];
    const reserved = game.board.spaces.find((s) => s.spaceType === SpaceType.COLONY)!;
    const tile = (tileType: TileType, space: Space = land, board: BoardType = BoardType.MARS): QuestEvent =>
      ({kind: 'tile', space: {...space, tile: {tileType}}, tileType, board});
    check({kind: 'tile', tile: 'greenery'}, tile(TileType.GREENERY), 1);
    check({kind: 'tile', tile: 'greenery'}, tile(TileType.CITY), 0);
    check({kind: 'tile', tile: 'city'}, tile(TileType.CITY), 1);
    check({kind: 'tile', tile: 'city'}, tile(TileType.CAPITAL), 1);
    check({kind: 'tile', tile: 'city'}, tile(TileType.CITY, reserved), 0);
    check({kind: 'tile', tile: 'spaceCity'}, tile(TileType.CITY, reserved), 1);
    check({kind: 'tile', tile: 'spaceCity'}, tile(TileType.CITY), 0);
    // SPECIAL (Development Craze, Urban Development): the printed solid brown hex — a special tile
    // on Mars. Never a city (the Capital and an ocean city are cities), never a greenery or an
    // ocean, never an Ares hazard; and never a Moon tile — the BOARD says no, not the tile type.
    check({kind: 'tile', tile: 'special'}, tile(TileType.NUCLEAR_ZONE), 1);
    check({kind: 'tile', tile: 'special'}, tile(TileType.OCEAN_FARM), 1);
    check({kind: 'tile', tile: 'special'}, tile(TileType.CITY), 0);
    check({kind: 'tile', tile: 'special'}, tile(TileType.CAPITAL), 0);
    check({kind: 'tile', tile: 'special'}, tile(TileType.OCEAN_CITY), 0);
    check({kind: 'tile', tile: 'special'}, tile(TileType.GREENERY), 0);
    check({kind: 'tile', tile: 'special'}, tile(TileType.OCEAN), 0);
    check({kind: 'tile', tile: 'special'}, tile(TileType.DUST_STORM_MILD), 0);
    check({kind: 'tile', tile: 'special'}, tile(TileType.EROSION_SEVERE), 0);
    check({kind: 'tile', tile: 'special'}, tile(TileType.NUCLEAR_ZONE, reserved), 0);
    check({kind: 'tile', tile: 'special'}, tile(TileType.LUNAR_MINE_URBANIZATION, land, BoardType.MOON), 0);
    check({kind: 'tile', tile: 'special'}, tile(TileType.NUCLEAR_ZONE, land, BoardType.MOON), 0);
    check({kind: 'tile', tile: 'greenery'}, tile(TileType.GREENERY, land, BoardType.MOON), 0);
    check({kind: 'tile', tile: 'city'}, tile(TileType.CITY, land, BoardType.MOON), 0);
    // Votes count toward the delegates quest through the handler.
    parliament.quest = {definition: {goal: {kind: 'delegates'}, count: 2}, source: ARCHITECTURE_AWARD_ID, generation: 1, progress: new Map()};
    const vote = p1.getActions().options.find((o) => (o as SelectParty).votePrompt !== undefined) as SelectParty;
    vote.cb(parliament.resolutionOf(parliament.slots[0].instance).party);
    expect(parliament.questProgressOf(p1)).eq(1);
  });
});

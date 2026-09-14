import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {QuestTracker} from '../../src/server/parliament/quests/QuestTracker';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {Tag} from '../../src/common/cards/Tag';
import {SelectParty} from '../../src/server/inputs/SelectParty';
import {cast} from '../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../TestingUtils';
import {EventSource} from '../../src/common/events/EventSource';

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
    // Under an enacted resolution's effect: nothing (decision Q5).
    asOwnAction(p1, () => p1.production.add(Resource.HEAT, 1), {kind: 'resolution', id: 'RDX_DUMMY_REDS_1', owner: p1.color});
    expect(parliament.questProgressOf(p1)).eq(0);
    // The player's own card play: counts the ACTUAL delta.
    asOwnAction(p1, () => p1.production.add(Resource.HEAT, 2));
    expect(parliament.questProgressOf(p1)).eq(2);
    // A different resource: nothing.
    asOwnAction(p1, () => p1.production.add(Resource.PLANTS, 2));
    expect(parliament.questProgressOf(p1)).eq(2);
  });

  it('completing the quest advances the Agenda and seats the chairman from the reserve; nobody else can complete it this generation', () => {
    const [, p1, p2, parliament] = reduxGame();
    asOwnAction(p1, () => p1.production.add(Resource.HEAT, 3));
    expect(parliament.quest?.completedBy).eq(p1.id);
    expect(parliament.chairman).eq(p1.id);
    expect(parliament.agendaOf(p1)).eq(1);
    expect(parliament.lobby.has(p1.id), 'the lobby delegate stays; the seat came from the reserve').is.true;
    expect(parliament.reserve(p1)).eq(5);
    asOwnAction(p2, () => p2.production.add(Resource.HEAT, 3));
    expect(parliament.questProgressOf(p2)).eq(0);
    expect(parliament.chairman).eq(p1.id);
  });

  it('a new chairman unseats the previous one (whose delegate returns); a sitting chairman only advances', () => {
    const [, p1, p2, parliament] = reduxGame();
    parliament.chairman = p2.id;
    expect(parliament.reserve(p2)).eq(5);
    asOwnAction(p1, () => p1.production.add(Resource.HEAT, 3));
    expect(parliament.chairman).eq(p1.id);
    expect(parliament.reserve(p2)).eq(6);
    // Next generation's quest: the chairman completes it again.
    parliament.quest = {definition: {goal: {kind: 'tag', tag: Tag.EARTH}, count: 1}, source: 'RDX_DUMMY_UNITY_1', generation: 2, progress: new Map()};
    const reserve = parliament.reserve(p1);
    asOwnAction(p1, () => p1.onCardPlayed(fakeCard({tags: [Tag.EARTH]})));
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
    expect(parliament.chairman, 'not seated yet — a delegate must be chosen').is.undefined;
    expect(parliament.pendingActions).deep.eq([{kind: 'chairman-seat', player: p1.id}]);
    runAllActions(game);
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
    check({kind: 'production', resource: Resource.STEEL}, {kind: 'production', resource: Resource.STEEL, amount: -1}, 0);
    // Votes count toward the delegates quest through the handler.
    parliament.quest = {definition: {goal: {kind: 'delegates'}, count: 2}, source: 'RDX_DUMMY_REDS_1', generation: 1, progress: new Map()};
    const vote = p1.getActions().options.find((o) => (o as SelectParty).votePrompt !== undefined) as SelectParty;
    vote.cb(parliament.resolutionOf(parliament.slots[0].instance).party);
    expect(parliament.questProgressOf(p1)).eq(1);
  });
});

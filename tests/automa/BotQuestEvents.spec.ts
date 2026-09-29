import {expect} from 'chai';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {MarsBotTurn, MarsBotTurnStep} from '../../src/common/automa/MarsBotTurn';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {CardResource} from '../../src/common/CardResource';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {Resource} from '../../src/common/Resource';
import {QuestDefinition, QuestGoal} from '../../src/common/parliament/ParliamentTypes';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Miranda} from '../../src/server/colonies/Miranda';
import {PlutoRedux} from '../../src/server/colonies/PlutoRedux';
import {IColony} from '../../src/server/colonies/IColony';
import {Parliament} from '../../src/server/parliament/Parliament';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

/**
 * THE BOT'S DEEDS COUNT — «the same object, the bot's way» (docs/TURMOIL_REDUX_MARSBOT.md §5):
 * one case per goal kind, each driven through the bot's REAL turn (never the
 * adapter called by hand), the quest posted directly on the table so the case
 * names exactly what it asks for. The board is Tharsis (the spec's default):
 * the building track's cells 5 `tr2` · 8 `greenery` · 10 `city`; the space
 * track's 11 `tr3`; the Earth track (heat production) opens with a `city`.
 */
const BUILDING = 0;
const SPACE = 1;
const EARTH = 5;

type Table = {game: IGame; human: TestPlayer; bot: IPlayer; parliament: Parliament};

function table(mode: 'none' | 'politics' = 'politics'): Table {
  const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: mode});
  game.playerIsFinishedWithResearchPhase(human);
  return {game, human, bot, parliament: game.parliament!};
}

/** Post `goal × count` as this generation's quest — nobody has progressed it. */
function ask(t: Table, goal: QuestGoal, count: number): QuestDefinition {
  const definition = {goal, count};
  t.parliament.quest = {definition, source: 'starter', generation: t.game.generation, progress: new Map()};
  return definition;
}

/** The bot plays exactly these cards, one per turn (the human ends each turn without passing); the last turn is returned. */
function botPlays(t: Table, ...deck: Array<CardName | BonusCardId>): MarsBotTurn {
  let turn: MarsBotTurn | undefined;
  for (const entry of deck) {
    t.game.automa!.actionDeck = [typeof entry === 'string' && (Object.values(BonusCardId) as Array<string>).includes(entry) ?
      {kind: 'bonus', id: entry as BonusCardId} : {kind: 'project', name: entry as CardName}];
    t.human.popWaitingFor();
    t.game.playerIsFinishedTakingActions();
    runAllActions(t.game);
    turn = t.game.automa!.lastTurn;
  }
  return turn!;
}

function progress(t: Table): number {
  return t.parliament.questProgressOf(t.bot);
}

function chairmanStep(turn: MarsBotTurn): Extract<MarsBotTurnStep, {kind: 'chairman'}> | undefined {
  return turn.steps.find((s): s is Extract<MarsBotTurnStep, {kind: 'chairman'}> => s.kind === 'chairman');
}

/** Seat a colony tile the deal may not have dealt, active on its highlighted step (the automa setup). */
function seatColony(t: Table, colony: IColony): IColony {
  const present = t.game.colonies.find((c) => c.name === colony.name);
  if (present !== undefined) {
    return present;
  }
  colony.isActive = true;
  colony.trackPosition = 2;
  t.game.colonies.push(colony);
  return colony;
}

describe('BotQuestEvents — the bot\'s deeds count toward the chairman quest', () => {
  it('a TAG: two building cards in two different turns complete «play 2 building tags» — and the chairmanship follows at once', () => {
    const t = table();
    ask(t, {kind: 'tag', tag: Tag.BUILDING}, 2);
    botPlays(t, CardName.AQUIFER_PUMPING);
    expect(progress(t)).eq(1);
    expect(t.parliament.chairman).is.undefined;
    const turn = botPlays(t, CardName.AQUIFER_PUMPING);
    expect(t.parliament.quest?.completedBy).eq(t.bot.id);
    expect(t.parliament.chairman).eq(t.bot.id);
    expect(t.parliament.agendaOf(t.bot)).eq(1);
    expect(t.bot.getWaitingFor()).is.undefined;
    expect(t.parliament.pendingActions).deep.eq([]);
    expect(chairmanStep(turn)).deep.include({source: 'reserve', agenda: {from: 0, to: 1}});
    expect(t.game.gameLog.some((m) => m.message === '${0} completed the chairman quest')).is.true;
    expect(t.game.gameLog.some((m) => m.message === '${0} becomes the chairman (delegate from the reserve)')).is.true;
    t.parliament.assertLedger(t.game);
  });

  it('a Failed-Action card (no tags) still counts as a card PLAYED; a wild tag counts for no named tag', () => {
    const t = table();
    ask(t, {kind: 'cardsPlayed', cardType: 'automated'}, 1);
    const turn = botPlays(t, CardName.MICRO_MILLS);
    expect(turn.steps.some((s) => s.kind === 'failed')).is.true;
    expect(t.parliament.quest?.completedBy).eq(t.bot.id);
  });

  it('a CARD TYPE: an event card completes «play 1 event card»', () => {
    const t = table();
    ask(t, {kind: 'cardsPlayed', cardType: 'event'}, 1);
    botPlays(t, CardName.ASTEROID);
    expect(t.parliament.quest?.completedBy).eq(t.bot.id);
  });

  it('a GREENERY the bot places from a track cell counts; a CITY on Mars too', () => {
    const greenery = table();
    ask(greenery, {kind: 'tile', tile: 'greenery'}, 1);
    greenery.game.automa!.board.tracks[BUILDING].position = 7; // the next building step lands on `greenery`
    botPlays(greenery, CardName.AQUIFER_PUMPING);
    expect(greenery.parliament.quest?.completedBy).eq(greenery.bot.id);

    const city = table();
    ask(city, {kind: 'tile', tile: 'city'}, 1);
    botPlays(city, CardName.CARTEL); // the Earth track's first cell is a city
    expect(city.parliament.quest?.completedBy).eq(city.bot.id);
  });

  it('a COLONY the bot builds (Outer System Foothold) counts', () => {
    const t = table();
    ask(t, {kind: 'colony'}, 1);
    botPlays(t, BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD);
    expect(t.parliament.quest?.completedBy).eq(t.bot.id);
  });

  it('a TRADE the bot makes (Shipping Lines) counts', () => {
    const t = table();
    ask(t, {kind: 'trade'}, 1);
    t.bot.megaCredits = 5;
    botPlays(t, BonusCardId.B19_SHIPPING_LINES);
    expect(t.parliament.quest?.completedBy).eq(t.bot.id);
  });

  it('TR the bot gains in its turn counts: a `tr3` cell completes «gain 3 TR»', () => {
    const t = table();
    ask(t, {kind: 'tr'}, 3);
    t.game.automa!.board.tracks[SPACE].position = 10; // the next space step lands on `tr3`
    botPlays(t, CardName.ASTEROID);
    expect(t.parliament.quest?.completedBy).eq(t.bot.id);
  });

  it('DELEGATES: four through lobbying (two cards of cost 18) complete «send 4 delegates»', () => {
    const t = table();
    ask(t, {kind: 'delegates'}, 4);
    t.bot.megaCredits = 20;
    botPlays(t, CardName.AQUIFER_PUMPING);
    expect(progress(t)).eq(2);
    botPlays(t, CardName.AQUIFER_PUMPING);
    expect(t.parliament.quest?.completedBy).eq(t.bot.id);
    expect(t.parliament.chairman).eq(t.bot.id);
  });

  it('PRODUCTION is a track advance: +1 steel is one building step; +3 heat is three Earth steps; a regression counts nothing', () => {
    const steel = table();
    ask(steel, {kind: 'production', resource: Resource.STEEL}, 1);
    botPlays(steel, CardName.AQUIFER_PUMPING);
    expect(steel.parliament.quest?.completedBy).eq(steel.bot.id);

    const heat = table();
    ask(heat, {kind: 'production', resource: Resource.HEAT}, 3);
    botPlays(heat, CardName.CARTEL, CardName.CARTEL);
    expect(progress(heat)).eq(2);
    // The human regresses the Earth track (a heat-production decrease): nothing moves.
    heat.game.events.beginAction(heat.human, undefined, {category: 'card-play'});
    try {
      heat.bot.production.add(Resource.HEAT, -1);
    } finally {
      heat.game.events.endScope();
    }
    expect(heat.game.automa!.board.tracks[EARTH].position).eq(1);
    expect(progress(heat)).eq(2);
    botPlays(heat, CardName.CARTEL);
    expect(heat.parliament.quest?.completedBy).eq(heat.bot.id);
  });

  it('a CARD RESOURCE is a unit in the bot\'s area of that kind: animals through Miranda, data through Pluto Redux', () => {
    const animals = table();
    ask(animals, {kind: 'cardResource', resource: CardResource.ANIMAL}, 2);
    const miranda = seatColony(animals, new Miranda());
    miranda.trackPosition = 6; // the most advanced track — Shipping Lines trades there
    animals.game.colonies.filter((c) => c !== miranda).forEach((c) => (c.trackPosition = 1));
    animals.bot.megaCredits = 5;
    botPlays(animals, BonusCardId.B19_SHIPPING_LINES);
    expect(animals.game.automa!.shippingStorage[ColonyName.MIRANDA]).eq(2);
    expect(animals.parliament.quest?.completedBy).eq(animals.bot.id);

    const data = table();
    ask(data, {kind: 'cardResource', resource: CardResource.DATA}, 2);
    const pluto = seatColony(data, new PlutoRedux());
    pluto.trackPosition = 6;
    data.game.colonies.filter((c) => c !== pluto).forEach((c) => (c.trackPosition = 1));
    data.bot.megaCredits = 5;
    botPlays(data, BonusCardId.B19_SHIPPING_LINES);
    expect(data.parliament.quest?.completedBy).eq(data.bot.id);
  });

  it('a SPACE CITY is unreachable for the bot: the model says so and its play never moves the count', () => {
    const t = table();
    ask(t, {kind: 'tile', tile: 'spaceCity'}, 1);
    expect(getParliamentModel(t.game, t.human)?.quest?.botReachable).is.false;
    botPlays(t, CardName.CARTEL, CardName.AQUIFER_PUMPING);
    expect(progress(t)).eq(0);
    expect(t.parliament.quest?.completedBy).is.undefined;
  });

  it("mode 'none': the observer bot's deeds count nothing", () => {
    const t = table('none');
    ask(t, {kind: 'tag', tag: Tag.BUILDING}, 1);
    botPlays(t, CardName.AQUIFER_PUMPING);
    expect(progress(t)).eq(0);
    expect(t.parliament.quest?.completedBy).is.undefined;
    expect(getParliamentModel(t.game, t.human)?.quest?.botReachable).is.undefined;
  });
});

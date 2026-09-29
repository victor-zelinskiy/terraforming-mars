import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {CardResource} from '../../src/common/CardResource';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {BOT_QUEST_PATHS, BOT_QUEST_TILE_PATHS, botQuestReachable, BotQuestTable} from '../../src/common/parliament/botQuestPath';
import {QuestGoal} from '../../src/common/parliament/ParliamentTypes';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {botQuestTableOf} from '../../src/server/automa/BotQuestEvents';
import {TharsisRepublic} from '../../src/server/cards/corporation/TharsisRepublic';
import {Parliament} from '../../src/server/parliament/Parliament';
import {chooseSeatSlot} from '../../src/server/parliament/BotVoteChooser';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {QuestTracker} from '../../src/server/parliament/quests/QuestTracker';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {CENTRAL_POWER_GRID_ID} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {COLONIZATION_FUNDING_ID} from '../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {seatResolution} from './parliamentArrange';

/**
 * THE CHAIRMAN QUEST WITH A BOT AT THE TABLE (docs/TURMOIL_REDUX_MARSBOT.md §5, stage Э3):
 * the tracker's rule for the bot (its TURN alone), the human under the bot's
 * root, the race for the chair, the seat's delegate by the deterministic
 * rule, and the reachability guard over the catalog.
 */
type Table = {game: IGame; human: TestPlayer; bot: IPlayer; parliament: Parliament};

function table(mode: 'none' | 'politics' = 'politics'): Table {
  const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: mode});
  game.playerIsFinishedWithResearchPhase(human);
  return {game, human, bot, parliament: game.parliament!};
}

function ask(t: Table, goal: QuestGoal, count: number): void {
  t.parliament.quest = {definition: {goal, count}, source: 'starter', generation: t.game.generation, progress: new Map()};
}

function botPlays(t: Table, ...deck: Array<CardName>): void {
  for (const name of deck) {
    t.game.automa!.actionDeck = [{kind: 'project', name}];
    t.human.popWaitingFor();
    t.game.playerIsFinishedTakingActions();
    runAllActions(t.game);
  }
}

const FULL_TABLE: BotQuestTable = {
  productions: [Resource.MEGACREDITS, Resource.STEEL, Resource.TITANIUM, Resource.PLANTS, Resource.ENERGY, Resource.HEAT],
  cardResources: [CardResource.ANIMAL, CardResource.MICROBE, CardResource.FLOATER, CardResource.DATA],
  specialTiles: false,
};

describe('BotQuest — the chairman quest and MarsBot', () => {
  describe('eligibility: the bot\'s TURN alone', () => {
    it('under its own turn the bot is eligible; under its corporation box at the gate, or with no chain, it is not', () => {
      const t = table();
      const events = t.game.events;
      events.beginAction(t.bot, undefined, {category: 'automa-turn'});
      try {
        expect(QuestTracker.eligible(t.bot)).is.true;
        // …and the human under the bot's root is not (the root's actor rule).
        expect(QuestTracker.eligible(t.human)).is.false;
      } finally {
        events.endScope();
      }
      events.beginAction(t.bot, {kind: 'corporation', card: CardName.CREDICOR, owner: t.bot.color}, {category: 'corporation-action'});
      try {
        expect(QuestTracker.eligible(t.bot)).is.false;
      } finally {
        events.endScope();
      }
      expect(QuestTracker.eligible(t.bot)).is.false;
    });

    it("mode 'none': never eligible, even under its own turn", () => {
      const t = table('none');
      const events = t.game.events;
      events.beginAction(t.bot, undefined, {category: 'automa-turn'});
      try {
        expect(QuestTracker.eligible(t.bot)).is.false;
      } finally {
        events.endScope();
      }
    });

    it('a human PAID under the bot\'s turn (Tharsis Republic on the bot\'s city) progresses nothing — as before', () => {
      const t = table();
      t.human.playedCards.push(new TharsisRepublic());
      ask(t, {kind: 'production', resource: Resource.MEGACREDITS}, 1);
      const production = t.human.production.megacredits;
      botPlays(t, CardName.CARTEL); // the Earth track's first cell is a city → Tharsis pays the human 1 M€ production
      expect(t.human.production.megacredits).eq(production + 1);
      expect(t.parliament.questProgressOf(t.human)).eq(0);
      // The bot's own Earth step is its heat production, not M€: its count is untouched too.
      expect(t.parliament.questProgressOf(t.bot)).eq(0);
    });
  });

  describe('the race for the chair', () => {
    it('the bot completes first: the office, the Agenda step, no gate; the human\'s later count is ignored', () => {
      const t = table();
      ask(t, {kind: 'tag', tag: Tag.BUILDING}, 1);
      botPlays(t, CardName.AQUIFER_PUMPING);
      expect(t.parliament.quest?.completedBy).eq(t.bot.id);
      expect(t.parliament.chairman).eq(t.bot.id);
      expect(t.parliament.reserve(t.bot)).eq(5); // lobby 1 + chair 1 + reserve 5 (a paid delegate went to a card: 18 M€? no — the bot had 0 M€)
      expect(t.parliament.pendingActions).deep.eq([]);
      expect(t.bot.getWaitingFor()).is.undefined;
      expect(t.parliament.agendaOf(t.bot)).eq(1);
      // The human plays a building card now: the quest is closed for this generation.
      t.game.events.beginAction(t.human, {kind: 'card', card: CardName.AQUIFER_PUMPING, owner: t.human.color}, {category: 'card-play'});
      try {
        QuestTracker.report(t.human, {kind: 'tag', tags: [Tag.BUILDING]});
      } finally {
        t.game.events.endScope();
      }
      expect(t.parliament.questProgressOf(t.human)).eq(0);
      expect(t.parliament.chairman).eq(t.bot.id);
    });

    it('the human completes first: the bot\'s later deed is ignored, the human keeps the chair', () => {
      const t = table();
      ask(t, {kind: 'tag', tag: Tag.BUILDING}, 1);
      t.game.events.beginAction(t.human, {kind: 'card', card: CardName.AQUIFER_PUMPING, owner: t.human.color}, {category: 'card-play'});
      try {
        QuestTracker.report(t.human, {kind: 'tag', tags: [Tag.BUILDING]});
      } finally {
        t.game.events.endScope();
      }
      expect(t.parliament.quest?.completedBy).eq(t.human.id);
      // The human's gate stands; the bot's turn does not touch a closed quest.
      botPlays(t, CardName.AQUIFER_PUMPING);
      expect(t.parliament.quest?.completedBy).eq(t.human.id);
      expect(t.parliament.chairman).not.eq(t.bot.id);
    });

    it('a previous HUMAN chairman gets the delegate back in the reserve; the bot\'s seat delegate comes from the reserve', () => {
      const t = table();
      t.parliament.chairman = t.human.id;
      expect(t.parliament.reserve(t.human)).eq(5);
      ask(t, {kind: 'tag', tag: Tag.BUILDING}, 1);
      botPlays(t, CardName.AQUIFER_PUMPING);
      expect(t.parliament.chairman).eq(t.bot.id);
      expect(t.parliament.reserve(t.human)).eq(6);
      expect(t.game.gameLog.some((m) => m.message === 'The delegate of ${0} leaves the chairman seat')).is.true;
      const step = t.game.automa!.lastTurn!.steps.find((s) => s.kind === 'chairman');
      expect(step).deep.include({kind: 'chairman', source: 'reserve', previous: t.human.color});
      t.parliament.assertLedger(t.game);
    });

    it('the seat\'s delegate: the reserve empty → the lobby; the lobby empty too → off the resolution the rule names', () => {
      const lobby = table();
      ask(lobby, {kind: 'tag', tag: Tag.BUILDING}, 1);
      for (let i = 0; i < 6; i++) {
        lobby.parliament.placeVote(lobby.bot, lobby.parliament.slots[i % 3], 'reserve');
      }
      expect(lobby.parliament.reserve(lobby.bot)).eq(0);
      expect(lobby.parliament.lobby.has(lobby.bot.id)).is.true;
      botPlays(lobby, CardName.AQUIFER_PUMPING);
      expect(lobby.parliament.chairman).eq(lobby.bot.id);
      expect(lobby.parliament.lobby.has(lobby.bot.id)).is.false;
      expect(lobby.game.automa!.lastTurn!.steps.find((s) => s.kind === 'chairman')).deep.include({source: 'lobby'});
      lobby.parliament.assertLedger(lobby.game);

      const resolution = table();
      ask(resolution, {kind: 'tag', tag: Tag.BUILDING}, 1);
      seatResolution(resolution.parliament, 0, ARCHITECTURE_AWARD_ID);
      seatResolution(resolution.parliament, 1, CENTRAL_POWER_GRID_ID);
      seatResolution(resolution.parliament, 2, COLONIZATION_FUNDING_ID);
      resolution.parliament.slots.forEach((slot) => (slot.votes = []));
      // 3 on slot 0, 2 on slot 1, 2 on slot 2 — all seven in play.
      for (const index of [0, 0, 0, 1, 1, 2, 2]) {
        resolution.parliament.placeVote(resolution.bot, resolution.parliament.slots[index], resolution.parliament.lobby.has(resolution.bot.id) ? 'lobby' : 'reserve');
      }
      expect(resolution.parliament.reserve(resolution.bot)).eq(0);
      expect(resolution.parliament.lobby.has(resolution.bot.id)).is.false;
      const named = chooseSeatSlot(resolution.parliament, resolution.bot);
      botPlays(resolution, CardName.AQUIFER_PUMPING);
      expect(resolution.parliament.chairman).eq(resolution.bot.id);
      expect(resolution.parliament.votesOf(resolution.bot)).eq(6);
      const step = resolution.game.automa!.lastTurn!.steps.find((s) => s.kind === 'chairman');
      expect(step).deep.include({source: 'resolution', resolution: resolution.parliament.resolutionOf(resolution.parliament.slots[named!].instance).id});
      expect(resolution.game.gameLog.some((m) => m.message === '${0} takes a delegate back from ${1} for the chairman seat')).is.true;
      resolution.parliament.assertLedger(resolution.game);
    });

    it('a sitting chairman that completes again keeps the seat and only advances', () => {
      const t = table();
      t.parliament.chairman = t.bot.id;
      ask(t, {kind: 'tag', tag: Tag.BUILDING}, 1);
      botPlays(t, CardName.AQUIFER_PUMPING);
      expect(t.parliament.chairman).eq(t.bot.id);
      expect(t.parliament.agendaOf(t.bot)).eq(1);
      expect(t.game.automa!.lastTurn!.steps.find((s) => s.kind === 'chairman')).deep.include({source: 'kept'});
    });

    it('the completion survives a reload: the chair, the Agenda, no pending record, no prompt', () => {
      const t = table();
      ask(t, {kind: 'tag', tag: Tag.BUILDING}, 1);
      botPlays(t, CardName.AQUIFER_PUMPING);
      const live = Game.deserialize(structuredClone(t.game.serialize()));
      const parliament = live.parliament!;
      expect(parliament.chairman).eq(t.bot.id);
      expect(parliament.agendaOf(t.bot)).eq(1);
      expect(parliament.pendingActions).deep.eq([]);
      expect(live.getPlayerById(t.bot.id).getWaitingFor()).is.undefined;
      parliament.assertLedger(live);
    });
  });

  describe('the seat rule (chooseSeatSlot)', () => {
    it('names the card whose latest cube leaves without changing the verdict or the bot\'s lead; ties → the fewest cubes → the farthest slot', () => {
      const t = table();
      t.game.phase = Phase.ACTION;
      const parliament = t.parliament;
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID);
      seatResolution(parliament, 1, CENTRAL_POWER_GRID_ID);
      seatResolution(parliament, 2, COLONIZATION_FUNDING_ID);
      parliament.slots.forEach((slot) => (slot.votes = []));
      // The bot leads slot 0 with 3 (the verdict), holds 2 on slot 1 (leads it), 1 on slot 2 (leads it).
      for (const index of [0, 0, 0, 1, 1, 2]) {
        parliament.placeVote(t.bot, parliament.slots[index], parliament.lobby.has(t.bot.id) ? 'lobby' : 'reserve');
      }
      expect(parliament.winner()?.slotIndex).eq(0);
      // Taking one off slot 0 leaves it at 2 = slot 1's 2 → the tie priority still enacts slot 0 and the bot still leads: harmless.
      // Slot 1 at 1 and slot 2 at 0: the bot still leads slot 1; slot 2 loses its lead (nobody leads an empty card) → not harmless.
      // Harmless {0, 1}; the fewest cubes → slot 1 (2 < 3).
      expect(chooseSeatSlot(parliament, t.bot)).eq(1);
      // With the human holding slot 1 with 2 EARLIER cubes, the bot's 2 there never led — leaving one changes nothing → still harmless; slot 2's lone cube is the lead it loses.
    });

    it('the human contests: leaving the human\'s card is harmless, the verdict card is not', () => {
      const t = table();
      t.game.phase = Phase.ACTION;
      const parliament = t.parliament;
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID);
      seatResolution(parliament, 1, CENTRAL_POWER_GRID_ID);
      seatResolution(parliament, 2, COLONIZATION_FUNDING_ID);
      parliament.slots.forEach((slot) => (slot.votes = []));
      parliament.placeVote(t.human, parliament.slots[1], 'lobby');
      // The bot: 2 on slot 0 (the verdict — 2 = slot 1's 2, the tie priority), 1 on slot 1 (the human's earlier cube leads it), 1 on slot 2.
      for (const index of [0, 0, 1, 2]) {
        parliament.placeVote(t.bot, parliament.slots[index], parliament.lobby.has(t.bot.id) ? 'lobby' : 'reserve');
      }
      expect(parliament.winner()?.slotIndex).eq(0);
      expect(parliament.winner()?.player).eq(t.bot.id);
      // Slot 0 at 1 → slot 1 (2) wins for the human: not harmless. Slot 1 at 1 (the human's): verdict same, the bot never led it: harmless.
      // Slot 2 at 0: verdict same, but the bot loses its lead there: not harmless. → slot 1.
      expect(chooseSeatSlot(parliament, t.bot)).eq(1);
    });

    it('no delegate on any card → undefined', () => {
      const t = table();
      expect(chooseSeatSlot(t.parliament, t.bot)).is.undefined;
    });
  });

  describe('reachability (botQuestPath) — computed, never listed', () => {
    it('every goal kind of the catalog has a path, and every tile kind too (the compiler holds the record; the walk holds the catalog)', () => {
      const failures: Array<string> = [];
      for (const definition of REDUX_RESOLUTION_CATALOG.all()) {
        const goal = definition.quest.goal;
        if (BOT_QUEST_PATHS[goal.kind] === undefined) {
          failures.push(`${definition.id}: goal kind '${goal.kind}' has no bot path`);
        }
        if (goal.kind === 'tile' && BOT_QUEST_TILE_PATHS[goal.tile] === undefined) {
          failures.push(`${definition.id}: tile kind '${goal.tile}' has no bot path`);
        }
        expect(typeof botQuestReachable(goal, FULL_TABLE), definition.id).eq('boolean');
      }
      expect(failures).deep.eq([]);
    });

    it('the UNREACHABLE quests of the dealt catalog (the worklist): the space city always; the special tiles unless the bot is Philares', () => {
      const unreachableOn = (specialTiles: boolean) => REDUX_RESOLUTION_CATALOG.all()
        .filter((d) => d.copies > 0 && !botQuestReachable(d.quest.goal, {...FULL_TABLE, specialTiles}))
        .map((d) => `${d.id}: ${JSON.stringify(d.quest.goal)}`)
        .sort();
      expect(unreachableOn(false)).deep.eq([
        'RDX_MARS_DEVELOPMENT_CRAZE: {"kind":"tile","tile":"special"}',
        'RDX_MARS_URBAN_DEVELOPMENT: {"kind":"tile","tile":"special"}',
        `${COLONIZATION_FUNDING_ID}: {"kind":"tile","tile":"spaceCity"}`,
      ].sort());
      expect(unreachableOn(true)).deep.eq([`${COLONIZATION_FUNDING_ID}: {"kind":"tile","tile":"spaceCity"}`]);
    });

    it('the table decides: a production the tracks lack, a card resource no area holds, a special tile without Philares', () => {
      const bare: BotQuestTable = {productions: [Resource.STEEL], cardResources: [], specialTiles: false};
      expect(botQuestReachable({kind: 'production', resource: Resource.STEEL}, bare)).is.true;
      expect(botQuestReachable({kind: 'production', resource: Resource.HEAT}, bare)).is.false;
      expect(botQuestReachable({kind: 'cardResource', resource: CardResource.ANIMAL}, bare)).is.false;
      expect(botQuestReachable({kind: 'cardResource', resource: CardResource.ANIMAL}, FULL_TABLE)).is.true;
      expect(botQuestReachable({kind: 'tile', tile: 'special'}, bare)).is.false;
      expect(botQuestReachable({kind: 'tile', tile: 'special'}, {...bare, specialTiles: true})).is.true;
      expect(botQuestReachable({kind: 'tile', tile: 'spaceCity'}, FULL_TABLE)).is.false;
      expect(botQuestReachable({kind: 'tile', tile: 'greenery'}, bare)).is.true;
      expect(botQuestReachable({kind: 'tag', tag: Tag.VENUS}, bare)).is.true;
      expect(botQuestReachable({kind: 'trade'}, bare)).is.true;
    });

    it('the server\'s table: Tharsis\' six productions (no science), the dealt tiles\' kinds plus floaters, no special tiles for Credicor', () => {
      const t = table();
      const tableOf = botQuestTableOf(t.game);
      expect([...tableOf.productions].sort()).deep.eq([Resource.ENERGY, Resource.HEAT, Resource.MEGACREDITS, Resource.PLANTS, Resource.STEEL, Resource.TITANIUM].sort());
      expect(tableOf.cardResources).includes(CardResource.FLOATER);
      expect(tableOf.specialTiles).is.false;
      // The model carries the verdict for the bot seat: the starter quest (heat production) is reachable.
      expect(getParliamentModel(t.game, t.human)?.quest?.botReachable).is.true;
    });
  });
});

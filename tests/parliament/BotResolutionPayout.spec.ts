import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {Resource} from '../../src/common/Resource';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {REWARD_ADDRESS} from '../../src/common/parliament/rewardAddress';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {botPayoutSteps, BOT_PRODUCTION_STEP_MEGACREDITS, botMegacreditsOf} from '../../src/server/automa/BotResolutionPayout';
import {botResolutionCount} from '../../src/server/automa/BotResolutionCounts';
import {EnactContext, EnactOutcome, ResolutionDefinition} from '../../src/server/parliament/resolutions/IResolution';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {FORESTRY_SUPPORT_ID, payGreeneryAdjacency} from '../../src/server/parliament/resolutions/greens/ForestrySupport';
import {URBAN_DEVELOPMENT_ID} from '../../src/server/parliament/resolutions/marsFirst/UrbanDevelopment';
import {newProjectCard} from '../../src/server/createCard';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {seatEnacted} from './parliamentArrange';

/**
 * DECISION D16 (the owner, 2026-10-27, replacing D3): an enacted resolution PAYS and CHARGES MarsBot like every
 * seat — through ITS adapter (`automa/BotResolutionPayout.ts`): its OWN counts (`BotResolutionCounts` — its tracks
 * for tags, its played pile for cards, its tracks for production, its stores for holders; the board, the colonies
 * and the rating are real), the card's printed formula, every unit converted to M€ by the Automa rulebook (1 M€ a
 * unit / card / resource on a card / colony bonus, 2 M€ a production step), the record in the PLAYER's units.
 */

function botTable(): [IGame, IPlayer] {
  const [game, , bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, venusNextExtension: true, botParliamentMode: 'politics'});
  return [game, bot];
}

/** Run every bot step of `definition` at `influence` straight on the executor; returns the records. */
function enactForBot(game: IGame, bot: IPlayer, definition: ResolutionDefinition, influence: number, winner?: IPlayer): Array<EnactOutcome> {
  const records: Array<EnactOutcome> = [];
  const state: Record<string, unknown> = {};
  for (const step of botPayoutSteps(definition)) {
    const ctx: EnactContext = {
      game, parliament: game.parliament!, player: bot, winner, influence,
      source: {kind: 'resolution', id: definition.id, owner: bot.color},
      state, report: (o) => records.push(o),
    };
    expect(step.run(ctx), `${definition.id}: the bot's step never asks`).is.undefined;
  }
  return records;
}

function setTrack(game: IGame, tag: Tag, position: number): void {
  const index = game.automa!.board.getTrackIndexForTag(tag)!;
  game.automa!.board.tracks[index].position = position;
}

describe('BotResolutionPayout — MarsBot is paid by every resolution (D16)', () => {
  describe('THE WORKLIST: every resolution of the catalog pays the bot every scaled part it declares', () => {
    for (const definition of REDUX_RESOLUTION_CATALOG.all().filter((d) => d.copies > 0)) {
      it(`${definition.id}`, () => {
        const [game, bot] = botTable();
        game.automa!.board.tracks.forEach((t) => (t.position = 6));
        bot.megaCredits = 50;
        const records = enactForBot(game, bot, definition, 3, bot);
        const seat = records.filter((o) => o.kind !== 'skipped' || o.effect !== undefined);
        for (const effect of definition.scaled ?? []) {
          const mine = seat.filter((o) => o.effect === effect.id);
          expect(mine.length, `${definition.id}/${effect.id}: one record at least`).greaterThan(0);
          for (const record of mine) {
            // Every record has an address (the results row can draw it) and the hidden M€ beside a paid one.
            expect(REWARD_ADDRESS[record.kind], `${definition.id}/${effect.id}: kind ${record.kind} has an address`).is.not.undefined;
            if (record.kind !== 'skipped' && (record.amount ?? 0) > 0) {
              expect(record.megacredits, `${definition.id}/${effect.id}: the hidden M€`).is.a('number');
            }
          }
        }
        if (definition.levy !== undefined) {
          expect(records[0].kind === 'stock' || records[0].kind === 'skipped', `${definition.id}: the levy first`).is.true;
        }
        // Nothing but M€ moved for a paying part: the bot holds no production, no hand, no plants it was given.
        expect(bot.cardsInHand).is.empty;
      });
    }
  });

  describe('the rate — the Automa rulebook', () => {
    it('a production step is 2 M€, every other unit 1 M€', () => {
      const production = REDUX_RESOLUTION_CATALOG.all().flatMap((d) => d.scaled ?? []).find((e) => e.unit.kind === 'production')!;
      const stock = REDUX_RESOLUTION_CATALOG.all().flatMap((d) => d.scaled ?? []).find((e) => e.unit.kind === 'stock')!;
      expect(botMegacreditsOf(production, 3)).eq(3 * BOT_PRODUCTION_STEP_MEGACREDITS);
      expect(botMegacreditsOf(stock, 3)).eq(3);
    });

    it('Central Power Grid: +1 M€ production per power tag + 1 per influence → the record speaks production, the bot holds M€', () => {
      const [game, bot] = botTable();
      setTrack(game, Tag.POWER, 2);
      const before = bot.megaCredits;
      const definition = REDUX_RESOLUTION_CATALOG.all().find((d) => d.code === 'RX04')!;
      const [record] = enactForBot(game, bot, definition, 1);
      expect(record).deep.include({kind: 'production', production: Resource.MEGACREDITS, amount: 3, megacredits: 6, count: 2});
      expect(bot.megaCredits).eq(before + 6);
      expect(bot.production.megacredits, 'no production — M€ under the hood').eq(0);
    });
  });

  describe('the bot\'s OWN counts', () => {
    it('a tag is its track\'s position; a count over several tags reads a shared track ONCE; Mars is 0', () => {
      const [game, bot] = botTable();
      setTrack(game, Tag.PLANT, 7); // the bio track: plant AND microbe AND animal
      setTrack(game, Tag.SCIENCE, 4);
      expect(botResolutionCount(bot, 'plantMicrobeAnimalTags')?.count, 'the bio track once').eq(7);
      expect(botResolutionCount(bot, 'scienceTags')?.count).eq(4);
      setTrack(game, Tag.SPACE, 5);
      expect(botResolutionCount(bot, 'spaceMarsTags')?.count, 'Mars has no track').eq(5);
      // The one reader answers for the bot by the same door a human's count goes through.
      expect(resolutionCount(bot, 'scienceTags').count).eq(4);
    });

    it('cards are its played pile, through the shared predicate (a blue card is a blue card)', () => {
      const [game, bot] = botTable();
      game.automa!.playedPile.push(CardName.SEARCH_FOR_LIFE, CardName.RESEARCH, CardName.ASTEROID);
      // Search For Life is blue; Research is green; Asteroid is an event.
      expect(botResolutionCount(bot, 'blueCards')?.count).eq(1);
    });

    it('production is the track that production stands for (steel → building, titanium → space, energy → power)', () => {
      const [game, bot] = botTable();
      game.automa!.board.tracks.forEach((t) => (t.position = 0));
      setTrack(game, Tag.BUILDING, 3);
      setTrack(game, Tag.SPACE, 2);
      setTrack(game, Tag.POWER, 1);
      const count = botResolutionCount(bot, 'steelTitaniumEnergyProduction')!;
      expect(count.count).eq(6);
      expect(count.byResource).deep.eq([{resource: Resource.STEEL, count: 3}, {resource: Resource.TITANIUM, count: 2}, {resource: Resource.ENERGY, count: 1}]);
    });

    it('the board, the colonies and the rating are its real state (the human path)', () => {
      const [game, bot] = botTable();
      expect(botResolutionCount(bot, 'terraformRatingSets')).is.undefined;
      expect(botResolutionCount(bot, 'colonies')).is.undefined;
      expect(resolutionCount(bot, 'terraformRatingSets').count).eq(Math.floor(Math.max(0, bot.terraformRating - 15) / 5));
      void game;
    });
  });

  describe('a LEVEL: the top-up is the bot\'s whole (no hand), the cut its real stock', () => {
    it('Joint Research draws up to 6 + influence — the bot holds no hand, so all of it, as M€', () => {
      const [game, bot] = botTable();
      const definition = REDUX_RESOLUTION_CATALOG.all().find((d) => d.code === 'RX16')!;
      const before = bot.megaCredits;
      const [record] = enactForBot(game, bot, definition, 2);
      expect(record).deep.include({kind: 'cards', amount: 8, target: 8, megacredits: 8});
      expect(bot.megaCredits).eq(before + 8);
      expect(bot.cardsInHand).is.empty;
    });
  });

  describe('the PAYING passives answer the bot too', () => {
    it('Forestry Support: a greenery next to the bot\'s tile pays 2 M€ + 1 plant — all M€ under the hood', () => {
      const [game, bot] = botTable();
      const centre = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined &&
        game.board.getAdjacentSpaces(s).some((n) => n.spaceType === SpaceType.LAND && n.tile === undefined))!;
      const grove = game.board.getAdjacentSpaces(centre).find((n) => n.spaceType === SpaceType.LAND && n.tile === undefined)!;
      grove.tile = {tileType: TileType.GREENERY};
      const before = {mc: bot.megaCredits, plants: bot.plants};
      const bonus = payGreeneryAdjacency(bot, centre)!;
      expect(bonus.greenerySpaceIds).has.length(1);
      expect(bot.megaCredits).eq(before.mc + bonus.megacredits + bonus.plants);
      expect(bot.plants).eq(before.plants);
      void FORESTRY_SUPPORT_ID;
    });

    it('Urban Development: a card the bot resolves with a Building tag pays 1 M€ per tag (its card)', () => {
      const [game, bot] = botTable();
      seatEnacted(game.parliament!, URBAN_DEVELOPMENT_ID);
      const before = bot.megaCredits;
      const card = newProjectCard(CardName.CAPITAL)!; // Building + City
      AutomaResolver.resolveProjectCard(game, card);
      expect(bot.megaCredits - before, 'one Building tag → 1 M€ (plus whatever its tracks paid)').gte(1);
      expect(game.gameLog.some((m) => m.message === '${0} played ${1} building tag(s) and draws ${2} card(s) from ${3}')).is.true;
    });
  });
});

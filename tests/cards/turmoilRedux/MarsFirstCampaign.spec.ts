import {expect} from 'chai';
import {MARS_FIRST_CAMPAIGN_STEEL_PRODUCTION, MarsFirstCampaign} from '../../../src/server/cards/turmoilRedux/MarsFirstCampaign';
import {CAMPAIGN_SUPPORT, PopularSupportCampaign} from '../../../src/server/cards/turmoilRedux/PopularSupportCampaign';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {GameCards} from '../../../src/server/GameCards';
import {Game} from '../../../src/server/Game';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {runAllActions} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {TileType} from '../../../src/common/TileType';
import {SpaceId} from '../../../src/common/Types';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem, isICardRenderProductionBox} from '../../../src/common/cards/render/Types';
import {NeutralRallyModel} from '../../../src/common/models/ActionPreviewModel';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {PARLIAMENT_NEUTRAL_DELEGATES, REDUX_PARTIES} from '../../../src/common/parliament/ParliamentTypes';
import {endGenerationThroughParliament, quietResolutionOf, quietWinnerIndex, seatQuiet, seatResolution} from '../../parliament/parliamentArrange';

/**
 * TRP3 — MARS FIRST CAMPAIGN: the second of the six Prelude campaigns. Every rule reading of the card file's header (and
 * of `PopularSupportCampaign`'s) is pinned here; the preview's promise is held to the play.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: MarsFirstCampaign};
const MARS = PartyName.MARS;

function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true});
  game.phase = Phase.PRELUDES;
  const parliament = game.parliament!;
  const card = new MarsFirstCampaign();
  p1.preludeCardsInHand.push(card);
  return {game, p1, p2, parliament, card};
}

function options(overrides: Partial<GameOptions> = {}): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, coloniesExtension: true, ...overrides};
}

function skips(t: Table) {
  return t.game.events.events.filter((e) => e.type === 'effect-skipped');
}

/** Play the Prelude and run the queue up to its question (the city's cell). */
function play(t: Table): SelectSpace {
  cast(t.card.play(t.p1), undefined);
  runAllActions(t.game);
  return cast(t.p1.getWaitingFor(), SelectSpace);
}

/** Answer the city's cell (the first legal one, unless named) and run the queue on. */
function place(t: Table, prompt: SelectSpace, spaceId?: SpaceId): SpaceId {
  const space = spaceId === undefined ? prompt.spaces[0] : prompt.spaces.find((s) => s.id === spaceId)!;
  t.p1.popWaitingFor();
  prompt.cb(space);
  runAllActions(t.game);
  return space.id;
}

function previewOf(t: Table) {
  return cardPlayPreview(t.p1, t.card).branches[0];
}

function rallyOf(t: Table): NeutralRallyModel {
  const step = previewOf(t).steps.find((s) => s.kind === 'neutralRally');
  expect(step, 'the support is a SHOW step of the preview').is.not.undefined;
  return (step as {kind: 'neutralRally', rally: NeutralRallyModel}).rally;
}

describe('MarsFirstCampaign', () => {
  describe('the card as printed', () => {
    it('is a PRELUDE with the Mars, City and Building tags, no VP, TRP3 — printing «city · steel production · 3 neutral delegates [Mars First]»', () => {
      const card = new MarsFirstCampaign();
      expect(card.type).eq(CardType.PRELUDE);
      expect(card.tags).deep.eq([Tag.MARS, Tag.CITY, Tag.BUILDING]);
      expect(card.cost).eq(0);
      expect(card.victoryPoints).is.undefined;
      expect(card.requirements).deep.eq([]);
      expect(card.metadata.cardNumber).eq('TRP3');
      expect(card).instanceOf(PopularSupportCampaign);
      expect(card.campaignParty).eq(MARS);
      expect(card.behavior).deep.eq({city: {}, production: {steel: MARS_FIRST_CAMPAIGN_STEEL_PRODUCTION}});
      expect([MARS_FIRST_CAMPAIGN_STEEL_PRODUCTION, CAMPAIGN_SUPPORT]).deep.eq([1, 3]);
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      expect(rows).has.lengthOf(1);
      const row = rows[0].filter((i) => typeof i !== 'string');
      expect(isICardRenderItem(row[0]) || (row[0] as {type?: string}).type === 'city', 'the city hex first').is.true;
      expect(row.some((i) => isICardRenderProductionBox(i)), 'a production box').is.true;
      const items = row.filter(isICardRenderItem) as Array<ICardRenderItem>;
      const neutral = items.find((i) => i.type === CardRenderItemType.NEUTRAL_DELEGATE);
      expect(neutral?.amount).eq(3);
      expect(items.find((i) => i.type === CardRenderItemType.PARTY_SEAL)?.party).eq(MARS);
    });
  });

  describe('deck wiring — a Prelude of the Redux manifest, dealt only beside the Prelude expansion', () => {
    it('is registered under `preludeCards` with the Prelude mark only (no Colonies mark on the scan)', () => {
      expect(TURMOIL_REDUX_CARD_MANIFEST.preludeCards[CardName.MARS_FIRST_CAMPAIGN]?.compatibility).eq('prelude');
      expect(TURMOIL_REDUX_CARD_MANIFEST.projectCards[CardName.MARS_FIRST_CAMPAIGN]).is.undefined;
    });

    it('joins the prelude deck with Redux + Preludes on, and never otherwise', () => {
      const names = (o: Partial<GameOptions>) => new GameCards(options(o)).getPreludeCards().map((c) => c.name);
      expect(names({turmoilReduxExpansion: true, preludeExtension: true})).contains(CardName.MARS_FIRST_CAMPAIGN);
      expect(names({turmoilReduxExpansion: true, preludeExtension: false})).not.contains(CardName.MARS_FIRST_CAMPAIGN);
      expect(names({turmoilReduxExpansion: false, preludeExtension: true})).not.contains(CardName.MARS_FIRST_CAMPAIGN);
    });
  });

  describe('the printed order: the city ASKS, the support waits for its answer', () => {
    it('the play raises the city\'s cell pick, the steel production comes with it — and Mars First\'s area is still empty', () => {
      const t = table();
      const prompt = play(t);
      expect(prompt.spaces.length, 'legal cells offered').is.greaterThan(0);
      expect(t.p1.production.steel).eq(1);
      expect(t.parliament.popularSupportOf(MARS), 'the support waits for the city').eq(0);
      expect(t.parliament.lastRally).is.undefined;
    });

    it('the answer seats the city, then the three neutrals land in Mars First\'s area — one record, no recount, no M€', () => {
      const t = table();
      const megacredits = t.p1.megaCredits;
      const at = place(t, play(t));
      expect(t.game.board.getSpaceOrThrow(at).tile?.tileType).eq(TileType.CITY);
      expect(t.game.board.getSpaceOrThrow(at).player).eq(t.p1);
      expect(t.parliament.popularSupportOf(MARS)).eq(3);
      for (const party of REDUX_PARTIES.filter((p) => p !== MARS)) {
        expect(t.parliament.popularSupportOf(party), `${party}'s area`).eq(0);
      }
      const record = t.parliament.lastRally!;
      expect(record).deep.include({player: t.p1.id, card: CardName.MARS_FIRST_CAMPAIGN, recount: false, megacredits: 0});
      expect(record.votes).deep.eq([]);
      expect(record.missing).deep.eq([]);
      expect(record.support).deep.eq([{party: MARS, current: 0, gained: 3, resulting: 3, printed: 3}]);
      expect(t.p1.megaCredits - megacredits, 'a campaign pays no recount (the cell\'s own M€ bonus aside)').is.lessThan(PARLIAMENT_NEUTRAL_DELEGATES);
      expect(t.parliament.neutralSupply()).eq(PARLIAMENT_NEUTRAL_DELEGATES - 3);
      expect(t.p1.getWaitingFor(), 'nothing else is asked').is.undefined;
      expect(skips(t)).is.empty;
      t.parliament.assertLedger(t.game);
    });

    it('no legal cell for the city: the Prelude cannot be played (it burns); nothing is half-paid', () => {
      const t = table();
      expect(t.card.canPlay(t.p1)).is.true;
      for (const space of t.game.board.getAvailableSpacesForCity(t.p1)) {
        t.game.simpleAddTile(t.p2, space, {tileType: TileType.GREENERY});
      }
      expect(t.game.board.getAvailableSpacesForCity(t.p1)).is.empty;
      expect(t.card.canPlay(t.p1)).is.false;
    });
  });

  describe('rule 1 — Mars First\'s resolution up for a vote takes NONE of the three: they WAIT in the area', () => {
    it('with Mars First\'s card in the voting area the cubes go to the area; the card\'s votes do not move', () => {
      const t = table();
      seatResolution(t.parliament, 0, quietResolutionOf(MARS));
      const slot = t.parliament.slotOf(MARS)!;
      const votesBefore = slot.votes.length;
      place(t, play(t));
      expect(slot.votes.length, 'no vote on the standing card').eq(votesBefore);
      expect(t.parliament.neutralVotes(slot)).eq(0);
      expect(t.parliament.popularSupportOf(MARS)).eq(3);
      expect(t.parliament.lastRally!.votes).deep.eq([]);
    });

    it('…and they become votes only on a Mars First card the REFRESH deals — never on the standing one, whatever the sitting decides', () => {
      const t = table();
      const winner = quietWinnerIndex(t.parliament);
      seatQuiet(t.parliament, winner);
      if (t.parliament.resolutionOf(t.parliament.slots[winner].instance).party !== MARS) {
        seatResolution(t.parliament, (winner + 1) % t.parliament.slots.length, quietResolutionOf(MARS));
      }
      t.parliament.placeVote(t.p2, t.parliament.slots[winner], 'lobby');
      for (let i = 0; i < t.parliament.slots.length; i++) {
        if (i !== winner) {
          seatQuiet(t.parliament, i);
        }
      }
      const standing = t.parliament.slotOf(MARS)!.instance;
      place(t, play(t));
      expect(t.parliament.popularSupportOf(MARS)).eq(3);
      t.game.phase = Phase.ACTION;
      for (const player of [t.p1, t.p2]) {
        player.preludeCardsInHand = [];
      }

      endGenerationThroughParliament(t.game);

      const dealt = t.parliament.slotOf(MARS);
      if (t.parliament.rulingParty() === MARS) {
        expect(t.parliament.enacted).eq(standing);
        expect(dealt, 'the ruler\'s party is never dealt').is.undefined;
        expect(t.parliament.popularSupportOf(MARS)).eq(3);
      } else if (dealt !== undefined) {
        expect(dealt.instance).not.eq(standing);
        expect(t.parliament.neutralVotes(dealt)).eq(3);
        expect(t.parliament.popularSupportOf(MARS)).eq(0);
      } else {
        expect(t.parliament.popularSupportOf(MARS)).eq(3);
      }
    });
  });

  describe('rule 2 of the campaign — the area holds three', () => {
    it('a full area takes none — a NAMED skip; the city and the production still come', () => {
      const t = table();
      t.parliament.addPopularSupport(MARS, 3);
      expect(rallyOf(t).support[0]).deep.include({current: 3, gained: 0, limit: 'area'});
      const at = place(t, play(t));
      expect(t.game.board.getSpaceOrThrow(at).tile?.tileType).eq(TileType.CITY);
      expect(t.p1.production.steel).eq(1);
      expect(t.parliament.popularSupportOf(MARS)).eq(3);
      expect(skips(t)).has.lengthOf(1);
    });
  });

  describe('the preview == the play', () => {
    it('chips: +1 steel production and «+3 [neutral] · to Popular Support»; steps: the city\'s placement, then the support\'s SHOW step', () => {
      const t = table();
      const branch = previewOf(t);
      expect(branch.effects.some((e) => e.icon === 'steel' && e.amount === 1), 'the steel production chip').is.true;
      expect(branch.effects.find((e) => e.icon === 'neutral-delegate')).deep.include({amount: 3, note: 'to Popular Support'});
      expect(branch.steps.map((s) => s.kind)).deep.eq(['boardPlacement', 'neutralRally']);
      const rally = rallyOf(t);
      expect(rally).deep.include({recount: false, megacredits: 0});
      place(t, play(t));
      expect(t.parliament.lastRally!.support).deep.eq(rally.support);
      expect(t.parliament.lastRally!.inUse).deep.eq(rally.inUse);
    });
  });

  describe('save / load', () => {
    it('the area survives a reload; the record (a presentation ring) does not', () => {
      const t = table();
      place(t, play(t));
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      expect(reloaded.parliament!.popularSupportOf(MARS)).eq(3);
      expect(reloaded.parliament!.lastRally).is.undefined;
    });
  });
});

import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {ActionPreviewStep} from '@/common/models/ActionPreviewModel';
import {BoardFact, BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';
import {CardAdjacencyPayoutModel} from '@/common/models/CardAdjacencyPayoutModel';
import {CardResource} from '@/common/CardResource';
import {SpaceId} from '@/common/Types';
import {playedTargetPreviewFor, playedTargetResourceFor} from '@/client/console/played/consolePlayedTargetPreview';
import {playedTargetQuickImpacts} from '@/client/console/played/consolePlayedTargetModel';
import {dossierSections} from '@/client/console/placementDossier';
import {
  CITY_PAYOUT_READ_MS, CITY_PAYOUT_RETURN_MS, CITY_PAYOUT_RISE_MS, CITY_PAYOUT_TICK_GAP_MS, cityPayoutTickAt,
  SELF_TOKEN_REACH, cityPayoutPlate, cityPayoutVpSteps, cityPayoutsFor, cityTokenPlan, claimCityPayout, directionToward, pointToward,
  resetCityPayoutClaims, sentByTheTile, tokenSpread,
} from '@/client/console/tilePlacement/cityDataPayoutModel';
import {cityPayoutReactionSpecs} from '@/client/console/tilePlacement/cityDataPayoutBeat';
import ruConsole from '@/locales/ru/console.json';
import ruBoardInfo from '@/locales/ru/board_info.json';

/**
 * A CARD REWARD THE CELL DECIDES (Turmoil Redux TR21 Arboretum) — the client's
 * pure halves: the composer's candidate reading WITHOUT a number, the dossier's
 * «where it lands» and «Сработает», and the «cities pay» scene's script.
 */
const VC = CardName.VECTOR_COMPUTATIONS;

function basisInput(cards: ReadonlyArray<{name: string, resources?: number}>): SelectCardModel {
  return {
    type: 'card', title: 't', buttonLabel: 'b', cards: cards as ReadonlyArray<CardModel>, min: 1, max: 1,
    resourceGainPrompt: {cardResource: 'data', amountBasis: {per: 'adjacent-city'}},
  } as never;
}

function fact(partial: Partial<BoardFact> & {id: string}): BoardFact {
  return {category: 'card-trigger', timing: 'immediate', severity: 'positive', recipient: {kind: 'current-player'}, title: partial.id, ...partial} as BoardFact;
}

function preview(partial: Partial<BoardPlacementPreview>): BoardPlacementPreview {
  return {
    space: '10' as SpaceId, kind: 'greenery', legal: true,
    costFacts: [], immediateFacts: [], recipientFacts: [], warningFacts: [], futureScoringFacts: [], ruleFacts: [],
    ...partial,
  };
}

function payout(partial: Partial<CardAdjacencyPayoutModel> = {}): CardAdjacencyPayoutModel {
  return {
    seq: 501, cause: 'adjacent-cities', color: 'blue', card: CardName.ARBORETUM, spaceId: '10' as SpaceId, basis: {per: 'adjacent-city'},
    neighbours: [{spaceId: '11' as SpaceId, units: 1}, {spaceId: '14' as SpaceId, units: 2}],
    target: VC, resource: CardResource.DATA, amount: 3, before: 2,
    ...partial,
  };
}

describe('a card reward the cell decides (TR21) — the client', () => {
  describe('the composer\'s candidate: the live count and the RATE, never a guessed number', () => {
    it('reads «data 2 · +1 for each adjacent city» from the marker\'s basis', () => {
      const step: ActionPreviewStep = {kind: 'input', input: basisInput([{name: VC, resources: 2}]), cardResource: 'data'};
      const sections = playedTargetPreviewFor(step, basisInput([{name: VC, resources: 2}]), VC);
      expect(sections).has.length(1);
      expect(sections[0].impacts).deep.eq([{label: 'Resources on this card', icon: 'data', from: 2, per: '+1 for each adjacent city'}]);
      // The rail shows it (a rate is a reading, not a static «N → N»).
      expect(playedTargetQuickImpacts(sections)).has.length(1);
      expect(playedTargetQuickImpacts(sections)[0]).to.not.have.property('to');
    });

    it('a card with no counter yet reads 0 · the rate', () => {
      const sections = playedTargetPreviewFor(undefined, basisInput([{name: VC}]), VC);
      expect(sections[0].impacts[0]).to.include({from: 0, per: '+1 for each adjacent city'});
    });

    it('no badge on the face is invented (the badge needs a number)', () => {
      expect(playedTargetResourceFor(undefined, 'data', {name: VC} as CardModel)).is.undefined;
    });

    it('the rate key is translated', () => {
      expect((ruConsole as Record<string, string>)['+1 for each adjacent city']).eq('+1 за каждый соседний город');
    });
  });

  describe('the dossier: where the data lands, and what answers it', () => {
    const lands = fact({
      id: 'card-Arboretum-adjacent-cities', title: 'For ${0} adjacent {city|cities}', params: ['3'],
      delta: {icon: 'data', amount: 3, direction: 'gain'}, landsOnChosenCard: {resource: 'data'},
      spaces: ['11', '14'] as SpaceId[],
    });
    const fiber = fact({
      id: 'reaction-fiber', title: 'You add data to a card', reaction: true,
      delta: {icon: 'megacredits', amount: 3, direction: 'gain', current: 40, resulting: 43},
      source: {type: 'card', id: CardName.MARTIAN_FIBER, label: CardName.MARTIAN_FIBER},
    });

    it('with the staged pick known: the row names the card and moves its count by THIS cell\'s amount', () => {
      const sections = dossierSections(preview({immediateFacts: [lands, fiber]}), 'blue', {name: VC, count: 2});
      const gain = sections.find((s) => s.key === 'gain');
      expect(gain?.rows).has.length(1);
      expect(gain?.rows[0].target).deep.eq({name: VC, icon: 'data', from: 2, to: 5});
      expect(gain?.rows[0].delta).deep.eq({icon: 'data', amount: 3, direction: 'gain'});
    });

    it('…and the table\'s answer reads WITH its cause: one line under the landing, never a section of its own', () => {
      const sections = dossierSections(preview({immediateFacts: [lands, fiber]}), 'blue', {name: VC, count: 2});
      expect(sections.map((s) => s.key)).deep.eq(['gain']);
      const row = sections[0].rows[0];
      expect(row.reactions).has.length(1);
      expect(row.reactions?.[0].key).eq('reaction-fiber');
      expect(row.reactions?.[0].delta).to.include({icon: 'megacredits', amount: 3, direction: 'gain'});
      // The landing keeps its own value: the reaction is never merged into the result.
      expect(row.delta).deep.eq({icon: 'data', amount: 3, direction: 'gain'});
    });

    it('a reaction with no landing row to stand under keeps «Сработает» (never dropped)', () => {
      const sections = dossierSections(preview({immediateFacts: [fiber]}), 'blue');
      expect(sections.map((s) => s.key)).deep.eq(['reactions']);
      expect(sections[0].titleKey).eq('Will trigger');
      expect(sections[0].rows[0].delta).to.include({icon: 'megacredits', current: 40, resulting: 43});
    });

    it('with no pick known (a live prompt): the amount alone — nothing guessed about a card', () => {
      const sections = dossierSections(preview({immediateFacts: [lands]}), 'blue');
      expect(sections[0].rows[0].target).is.undefined;
    });

    it('the fact titles are translated', () => {
      const ru = ruBoardInfo as Record<string, string>;
      expect(ru['For ${0} adjacent {city|cities}']).eq('За ${0} {соседний город|соседних города|соседних городов}');
      expect(ru['No adjacent cities — no data from this tile']).is.a('string');
      expect(ru['No card can hold the data — it is lost']).is.a('string');
    });
  });

  describe('the «cities pay» scene: the server\'s record, played once', () => {
    beforeEach(() => resetCityPayoutClaims());
    after(() => resetCityPayoutClaims());

    it('accepts only the records of the NEWEST placement on THIS cell — for THIS seat, or every seat', () => {
      const old = payout({seq: 300});
      const other = payout({seq: 502, spaceId: '20' as SpaceId});
      const foreign = payout({seq: 503, color: 'red'});
      const mine = payout({seq: 504});
      expect(cityPayoutsFor([old, mine, other, foreign], '10', 'blue')).deep.eq([mine]);
      expect(cityPayoutsFor([old, other, foreign], '10', 'red')).deep.eq([foreign]);
      expect(cityPayoutsFor([other], '10', 'blue')).deep.eq([]);
      expect(cityPayoutsFor(undefined, '10', 'blue')).deep.eq([]);
      // Any seat, when the caller is the remote stage.
      expect(cityPayoutsFor([foreign], '10', undefined)).deep.eq([foreign]);
    });

    it('a record is played ONCE (the hero or the remote stage, never both)', () => {
      expect(claimCityPayout(504)).is.true;
      expect(claimCityPayout(504)).is.false;
      expect(claimCityPayout(505)).is.true;
    });

    it('one token per unit, city by city in the server\'s order — a stack of two sends two, back to back', () => {
      const plan = cityTokenPlan(payout());
      expect(plan.map((t) => [t.spaceId, t.unit, t.units])).deep.eq([['11', 0, 1], ['14', 0, 2], ['14', 1, 2]]);
      expect(plan.map((t) => t.id)).deep.eq([0, 1, 2]);
    });

    it('a stack\'s two tokens sit side by side, a single one on the line', () => {
      expect(tokenSpread(0, 1)).eq(0);
      expect(tokenSpread(0, 2)).eq(-0.5);
      expect(tokenSpread(1, 2)).eq(0.5);
    });

    it('what the table answered becomes stock flights (the server\'s measure, nothing derived)', () => {
      expect(cityPayoutReactionSpecs(payout({reactions: {megacredits: 3}}))).deep.eq([{channel: 'stock', resource: 'megacredits', amount: 3}]);
      expect(cityPayoutReactionSpecs(payout())).deep.eq([]);
    });

    it('the timings are the declared classes', () => {
      expect([CITY_PAYOUT_RISE_MS, CITY_PAYOUT_READ_MS, CITY_PAYOUT_RETURN_MS]).deep.eq([320, 680, 260]);
    });

    it('two touchdowns in one frame tick one after the other — never +2 in one render, never ahead of a touchdown', () => {
      // A touchdown with nothing before it ticks on the spot.
      expect(cityPayoutTickAt(1000, -Infinity, CITY_PAYOUT_TICK_GAP_MS)).eq(1000);
      // The second of two same-frame touchdowns waits out the gap; a later one is free again.
      expect(cityPayoutTickAt(1000, 1000, CITY_PAYOUT_TICK_GAP_MS)).eq(1000 + CITY_PAYOUT_TICK_GAP_MS);
      expect(cityPayoutTickAt(1400, 1090, CITY_PAYOUT_TICK_GAP_MS)).eq(1400);
      // Reduced motion (gap 0): every tick on its touchdown.
      expect(cityPayoutTickAt(1000, 1000, 0)).eq(1000);
    });

    describe('where the receiving card stands', () => {
      const tile = {x: 500, y: 400, w: 100, h: 110};
      const plate = {w: 130, h: 182};
      const bounds = {x: 0, y: 0, w: 1920, h: 1080};
      const hits = (a: {x: number, y: number, w: number, h: number}, b: {x: number, y: number, w: number, h: number}) =>
        Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);

      it('beside the tile, covering neither the tile nor a paying city', () => {
        const right = {x: 600, y: 400, w: 100, h: 110};
        const rect = cityPayoutPlate(tile, [right], plate, bounds, 14);
        expect(hits(rect, tile)).is.false;
        expect(hits(rect, right)).is.false;
        expect(rect.x + rect.w).lessThan(tile.x + 1); // the right side was taken — it stands on the left
      });

      it('inside the board\'s visible box, sliding along the edge rather than off it', () => {
        const edge = {x: 1800, y: 400, w: 100, h: 110};
        const rect = cityPayoutPlate(edge, [], plate, bounds, 14);
        expect(rect.x).gte(0);
        expect(rect.x + rect.w).lte(1920);
        expect(hits(rect, edge)).is.false;
      });
    });
  });

  /*
   * THE CLASS «ТАЙЛ ПЛАТИТ КАРТЕ» (TR30 Red Museum, Pets, Martian Census — the
   * TILE ITSELF sends the units; `cards/tilePayout.ts`): one placement may pay
   * several cards, the sender of a unit may be the placed cell, and the
   * table's answer stands under the grant it answers.
   */
  describe('the class «a tile pays a card» (TR30) — the client', () => {
    const museum = (partial: Partial<CardAdjacencyPayoutModel> = {}) => payout({
      cause: 'tile-placed', card: CardName.RED_MUSEUM, target: CardName.RED_MUSEUM, basis: undefined,
      neighbours: [{spaceId: '10' as SpaceId, units: 2}], amount: 2, before: 0, ...partial,
    });
    beforeEach(() => resetCityPayoutClaims());
    after(() => resetCityPayoutClaims());

    it('every record of THIS placement, in the engine\'s order — never an earlier placement\'s on the same cell', () => {
      const earlier = museum({seq: 401});
      const pets = museum({seq: 502, card: CardName.PETS, target: CardName.PETS, resource: CardResource.ANIMAL, amount: 1, neighbours: [{spaceId: '10' as SpaceId, units: 1}]});
      const own = museum({seq: 501});
      const census = museum({seq: 503, color: 'red', card: CardName.MARTIAN_CENSUS, target: CardName.MARTIAN_CENSUS, amount: 1});
      const elsewhere = museum({seq: 504, spaceId: '20' as SpaceId});
      const all = [earlier, pets, census, own, elsewhere];
      expect(cityPayoutsFor(all, '10', undefined), 'every seat, the newest block, oldest first').deep.eq([own, pets, census]);
      expect(cityPayoutsFor(all, '10', 'blue'), 'one seat').deep.eq([own, pets]);
      expect(cityPayoutsFor(all, '30', undefined)).deep.eq([]);
      expect(cityPayoutsFor(undefined, '10', undefined)).deep.eq([]);
    });

    it('the TILE is the sender when the record names the placed cell — a neighbour is not', () => {
      expect(sentByTheTile(museum(), '10')).is.true;
      expect(sentByTheTile(payout(), '11')).is.false;
      // The plan is the shared one: two units of the one sender, side by side.
      expect(cityTokenPlan(museum()).map((t) => [t.spaceId, t.unit, t.units])).deep.eq([['10', 0, 2], ['10', 1, 2]]);
    });

    it('a token of the tile itself is born ON the tile, at the edge facing where it goes', () => {
      const tile = {x: 500, y: 400, w: 100, h: 110};
      const card = {x: 800, y: 455};
      const dir = directionToward(tile, card);
      expect(dir.x).closeTo(1, 1e-9);
      expect(dir.y).closeTo(0, 1e-9);
      const at = pointToward(tile, dir, SELF_TOKEN_REACH);
      expect(at.x, 'inside the hex').lessThan(tile.x + tile.w);
      expect(at.x, 'on the half facing the card').greaterThan(tile.x + tile.w / 2);
      expect(at.y).eq(tile.y + tile.h / 2);
      // A destination ON the tile has no direction: straight up, never a NaN.
      expect(directionToward(tile, {x: 550, y: 455})).deep.eq({x: 0, y: -1});
    });

    it('the points the units bring tick on the touchdown that crosses them (the derived VP cell)', () => {
      const half = (count: number) => Math.floor(count / 2);
      expect(cityPayoutVpSteps(0, 2, half), '0 → 2 data: nothing on the first, +1 on the second').deep.eq([0, 1]);
      expect(cityPayoutVpSteps(1, 2, half), '1 → 3 data: +1 on the first').deep.eq([1, 0]);
      expect(cityPayoutVpSteps(4, 2, () => 0), 'a card that does not score').deep.eq([0, 0]);
    });

    it('the dossier reads the table\'s answer under the grant it ANSWERS — no chosen card needed, no section of its own', () => {
      const pays = fact({id: 'card-Red Museum-pays', title: 'No greenery or ocean beside', delta: {icon: 'data', amount: 2, direction: 'gain'}});
      const fiber = fact({
        id: 'reaction-fiber', title: CardName.MARTIAN_FIBER, reaction: true, answers: 'card-Red Museum-pays',
        delta: {icon: 'megacredits', amount: 2, direction: 'gain'},
        source: {type: 'card', id: CardName.MARTIAN_FIBER},
      });
      const sections = dossierSections(preview({immediateFacts: [pays, fiber]}), 'blue');
      expect(sections.map((s) => s.key)).deep.eq(['gain']);
      expect(sections[0].rows[0].reactions?.map((r) => r.key)).deep.eq(['reaction-fiber']);
      // A reply naming a row that does not stand keeps «Сработает» (never dropped).
      const orphan = {...fiber, answers: 'card-gone'};
      const alone = dossierSections(preview({immediateFacts: [pays, orphan]}), 'blue');
      expect(alone.map((s) => s.key)).deep.eq(['gain', 'reactions']);
    });
  });
});

import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {MarsBotModel, MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {marsBotStandardRows, marsBotTagEntries, marsBotExtraGroups, MarsBotExtrasContext} from '@/client/components/console/marsBotRailModel';

function track(tags: Array<Tag>, position: number, maxPosition = 18): MarsBotTrackModel {
  return {tags, position, maxPosition, layout: [], regressed: []};
}

function fakeAutoma(overrides: Partial<MarsBotModel> = {}): MarsBotModel {
  return {
    difficulty: 'normal',
    tracks: [],
    actionDeckSize: 10,
    bonusDeckSize: 7,
    bonusDiscard: [],
    recurringBonusCards: [],
    destroyedBonusCards: [],
    playedPile: [],
    floaters: 0,
    ...overrides,
  } as unknown as MarsBotModel;
}

const bot = {
  megacredits: 42,
  steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0,
} as unknown as PublicPlayerModel;

/** A colonies game with every storable tile in play. */
const COLONIES_CTX: MarsBotExtrasContext = {
  venus: false,
  colonies: ['Ceres', 'Luna', 'Io', 'Enceladus', 'Ganymede', 'Callisto', 'Miranda', 'Triton', 'Pluto', 'Titan', 'Europa'],
};

/** The Tharsis tag set, as `game.tags` would carry it. */
const GAME_TAGS: Array<Tag> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.WILD,
];

describe('marsBotRailModel — the MarsBot participant presentation', () => {
  // ── the six standard rows (the parity skeleton) ─────────────────────────
  describe('marsBotStandardRows — six rows, type-classified, always', () => {
    it('ALWAYS the six canonical rows, zeros included — no automa data at all', () => {
      const rows = marsBotStandardRows(bot, fakeAutoma());
      expect(rows.map((r) => r.key)).to.deep.eq(['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']);
      expect(rows.map((r) => r.value)).to.deep.eq([42, 0, 0, 0, 0, 0]);
      expect(rows.map((r) => r.metricKey)).to.deep.eq(
        ['megacredits.stock', 'steel.stock', 'titanium.stock', 'plants.stock', 'energy.stock', 'heat.stock']);
    });

    it('shipping storage lands in its TYPE\'s row (Ceres→steel, Triton→titanium, Ganymede→plants, Callisto→energy, Io→heat)', () => {
      const rows = marsBotStandardRows(bot, fakeAutoma({
        shippingStorage: {'Ceres': 4, 'Triton': 2, 'Ganymede': 4, 'Callisto': 2, 'Io': 2},
      } as unknown as Partial<MarsBotModel>));
      const byKey = new Map(rows.map((r) => [r.key, r]));
      expect(byKey.get('steel')?.value).to.eq(4);
      expect(byKey.get('steel')?.sources).to.deep.eq([{name: 'Ceres', amount: 4}]);
      expect(byKey.get('titanium')?.value).to.eq(2);
      expect(byKey.get('plants')?.value).to.eq(4);
      expect(byKey.get('energy')?.value).to.eq(2);
      expect(byKey.get('heat')?.value).to.eq(2);
    });

    it('M€: the SUPPLY is the value; Luna is a SEPARATE store, never folded in', () => {
      const rows = marsBotStandardRows(bot, fakeAutoma({
        shippingStorage: {'Luna': 3},
      } as unknown as Partial<MarsBotModel>));
      const mc = rows[0];
      expect(mc.value, 'the supply keeps its meaning').to.eq(42);
      expect(mc.store?.total).to.eq(3);
      expect(mc.store?.sources).to.deep.eq([{name: 'Luna', amount: 3}]);
    });

    it('a corp M€ bank/till joins the SAME store readout as an independent source', () => {
      const rows = marsBotStandardRows(bot, fakeAutoma({
        shippingStorage: {'Luna': 3},
        corporation: {id: 'C06', original: 'Mining Guild', startingTags: [], resource: 'megacredits', resources: 10, cubes: [], stats: {}},
      } as unknown as Partial<MarsBotModel>));
      const mc = rows[0];
      expect(mc.value).to.eq(42);
      expect(mc.store?.total).to.eq(13);
      expect(mc.store?.sources).to.deep.eq([{name: 'Luna', amount: 3}, {name: 'Mining Guild', amount: 10}]);
    });

    it('no stored M€ — no store readout at all (never a «0» capsule)', () => {
      expect(marsBotStandardRows(bot, fakeAutoma())[0].store).to.be.undefined;
    });

    it('a corp PLANT store joins the plants row as a second source (Ecoline)', () => {
      const rows = marsBotStandardRows(bot, fakeAutoma({
        shippingStorage: {'Ganymede': 2},
        corporation: {id: 'C02', original: 'Ecoline', startingTags: [], resource: 'plant', resources: 4, cubes: [], stats: {}},
      } as unknown as Partial<MarsBotModel>));
      const plants = rows.find((r) => r.key === 'plants');
      expect(plants?.value).to.eq(6);
      expect(plants?.sources).to.deep.eq([{name: 'Ganymede', amount: 2}, {name: 'Ecoline', amount: 4}]);
    });

    it('a cube-marker corp store is STATE — it lands in no row', () => {
      const rows = marsBotStandardRows(bot, fakeAutoma({
        corporation: {id: 'C35', original: 'Lakefront Resorts', startingTags: [], resource: 'cube-white', resources: 1, cubes: [], stats: {}},
      } as unknown as Partial<MarsBotModel>));
      expect(rows.every((r) => r.sources.length === 0 && r.store === undefined)).to.be.true;
    });

    it('a science corp store is NOT a standard row (it is «Доп. ресурсы»)', () => {
      const rows = marsBotStandardRows(bot, fakeAutoma({
        corporation: {id: 'C13', original: 'Philares', startingTags: [], resource: 'science', resources: 2, cubes: [], stats: {}},
      } as unknown as Partial<MarsBotModel>));
      expect(rows.every((r) => r.sources.length === 0)).to.be.true;
    });
  });

  // ── the tag matrix (parity with the human МЕТКИ block) ──────────────────
  describe('marsBotTagEntries — the SAME matrix cells, counts from the tracks', () => {
    const automa = fakeAutoma({tracks: [
      track([Tag.BUILDING], 2),
      track([Tag.POWER, Tag.JOVIAN], 4),
      track([Tag.EARTH, Tag.CITY], 6),
      track([Tag.PLANT, Tag.ANIMAL, Tag.MICROBE], 5),
    ]});

    it('a mapped tag reads its track position — the engine\'s own tag count', () => {
      const byTag = new Map(marsBotTagEntries(GAME_TAGS, automa).map((e) => [e.tag, e.count]));
      expect(byTag.get(Tag.BUILDING)).to.eq(2);
    });

    it('one shared track serves EVERY of its tags with the same number (POWER+JOVIAN)', () => {
      const byTag = new Map(marsBotTagEntries(GAME_TAGS, automa).map((e) => [e.tag, e.count]));
      expect(byTag.get(Tag.POWER)).to.eq(4);
      expect(byTag.get(Tag.JOVIAN)).to.eq(4);
      expect(byTag.get(Tag.PLANT)).to.eq(5);
      expect(byTag.get(Tag.ANIMAL)).to.eq(5);
      expect(byTag.get(Tag.MICROBE)).to.eq(5);
    });

    it('a tag no track maps is «not tracked» (undefined) — never a lying 0', () => {
      const byTag = new Map(marsBotTagEntries(GAME_TAGS, automa).map((e) => [e.tag, e.count]));
      expect(byTag.get(Tag.WILD), 'wild never maps to a track').to.be.undefined;
      expect(byTag.get(Tag.SCIENCE), 'science exists in the game but this board has no science track').to.be.undefined;
      expect(byTag.has('none' as never), 'the no-tag cell is present').to.be.true;
      expect(byTag.get('none' as never)).to.be.undefined;
    });

    it('the cell SET is the game\'s own matrix — identical to a human seat', () => {
      const cells = marsBotTagEntries(GAME_TAGS, automa).map((e) => e.tag);
      // Same membership rule as consoleAvailableTags: game tags + the two
      // client-side counters (events, no-tags), canonical order.
      expect(cells).to.include(Tag.EVENT);
      expect(cells).to.include('none');
      expect(cells.indexOf(Tag.BUILDING), 'canonical order — building first').to.eq(0);
    });
  });

  // ── «Доп. ресурсы» — the CARD-TYPE pools only ───────────────────────────
  describe('marsBotExtraGroups — card-type pools; standard storage lives in the rows', () => {
    it('microbes/animals/cards are extras; standard-typed storage NEVER appears here', () => {
      const groups = marsBotExtraGroups(fakeAutoma({
        floaters: 6,
        shippingStorage: {'Miranda': 1, 'Callisto': 4, 'Io': 4, 'Enceladus': 4, 'Triton': 2, 'Pluto': 3},
      } as unknown as Partial<MarsBotModel>), COLONIES_CTX);
      const byKey = new Map(groups.map((g) => [g.key, g]));
      expect(byKey.get('floater')?.total).to.eq(6);
      expect(byKey.get('animal')?.total, 'Miranda stores animals').to.eq(1);
      expect(byKey.get('animal')?.holders).to.deep.eq([{name: 'Miranda', amount: 1}]);
      expect(byKey.get('microbe')?.total, 'Enceladus stores microbes').to.eq(4);
      expect(byKey.get('cards')?.total, 'Pluto stores card tokens').to.eq(3);
      expect(byKey.has('energy'), 'Callisto energy is a STANDARD row').to.be.false;
      expect(byKey.has('heat'), 'Io heat is a STANDARD row').to.be.false;
      expect(byKey.has('titanium'), 'Triton titanium is a STANDARD row').to.be.false;
      expect(byKey.has('steel')).to.be.false;
    });

    it('keys are the HUMAN satellite\'s own type keys — the semantic focus survives a seat switch', () => {
      const groups = marsBotExtraGroups(fakeAutoma({
        floaters: 1, shippingStorage: {'Enceladus': 2, 'Miranda': 1},
      } as unknown as Partial<MarsBotModel>), COLONIES_CTX);
      expect(groups.map((g) => g.key)).to.include.members(['floater', 'microbe', 'animal']);
    });

    it('a storable colony IN PLAY is a real source at 0 — the type shows its honest zero', () => {
      const groups = marsBotExtraGroups(fakeAutoma(), {venus: false, colonies: ['Enceladus', 'Europa']});
      expect(groups.map((g) => g.key)).to.deep.eq(['microbe']);
      expect(groups[0].total).to.eq(0);
      expect(groups[0].holders).to.deep.eq([{name: 'Enceladus', amount: 0}]);
    });

    it('the floater pool exists with Venus even at 0; without any floater mechanism it does not', () => {
      const venus = marsBotExtraGroups(fakeAutoma(), {venus: true, colonies: []});
      expect(venus.map((g) => g.key)).to.deep.eq(['floater']);
      expect(venus[0].total).to.eq(0);
      expect(venus[0].origin).to.eq('pool');
      expect(marsBotExtraGroups(fakeAutoma(), {venus: false, colonies: []})).to.deep.eq([]);
    });

    it('the floater pool exists via the Titan area without Venus (no double count — Titan storage never appears)', () => {
      const groups = marsBotExtraGroups(fakeAutoma({
        floaters: 3,
        // A malformed model routing Titan into storage must stay silent —
        // the floater pool is the ONE home of those.
        shippingStorage: {'Titan': 5, 'Europa': 2} as never,
      } as unknown as Partial<MarsBotModel>), {venus: false, colonies: ['Titan', 'Europa']});
      expect(groups.map((g) => g.key)).to.deep.eq(['floater']);
      expect(groups[0].total).to.eq(3);
    });

    it('the corp science store is an extras type with the corp card as its holder — zeros included', () => {
      const groups = marsBotExtraGroups(fakeAutoma({
        corporation: {id: 'C13', original: 'Philares', startingTags: [], resource: 'science', resources: 0, cubes: [], stats: {}},
      } as unknown as Partial<MarsBotModel>), {venus: false, colonies: []});
      expect(groups.map((g) => g.key)).to.deep.eq(['science']);
      expect(groups[0].total).to.eq(0);
      expect(groups[0].holders).to.deep.eq([{name: 'Philares', amount: 0}]);
      expect(groups[0].origin).to.eq('corp');
    });

    it('the group order is CANONICAL (pool → board order → corp), never the totals\'', () => {
      const groups = marsBotExtraGroups(fakeAutoma({
        floaters: 1,
        shippingStorage: {'Pluto': 9, 'Enceladus': 1, 'Miranda': 5},
        corporation: {id: 'C13', original: 'Philares', startingTags: [], resource: 'science', resources: 7, cubes: [], stats: {}},
      } as unknown as Partial<MarsBotModel>), COLONIES_CTX);
      expect(groups.map((g) => g.key)).to.deep.eq(['floater', 'microbe', 'animal', 'cards', 'science']);
    });

    it('an empty bot in a game with no sources shows nothing', () => {
      expect(marsBotExtraGroups(fakeAutoma(), {venus: false, colonies: []})).to.deep.eq([]);
    });
  });
});

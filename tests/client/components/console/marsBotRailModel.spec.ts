import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {MarsBotModel, MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {marsBotRailEconomy, marsBotTagEntries, marsBotExtraGroups} from '@/client/components/console/marsBotRailModel';

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

const bot = {megacredits: 42} as unknown as PublicPlayerModel;

/** The Tharsis tag set, as `game.tags` would carry it. */
const GAME_TAGS: Array<Tag> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.WILD,
];

describe('marsBotRailModel — the MarsBot participant presentation', () => {
  it('economy: the M€ supply always; floaters are NOT an economy row (they are «Доп. ресурсы»)', () => {
    const rows = marsBotRailEconomy(bot, fakeAutoma({floaters: 3}));
    expect(rows.map((r) => r.key), 'floaters must not appear beside the M€ supply').to.deep.eq(['megacredits']);
    expect(rows[0].value).to.eq(42);
    expect(rows[0].metricKey).to.eq('megacredits.stock');
  });

  it('economy: a corporation with a REAL resource store adds its row (Ecoline plants)', () => {
    const automa = fakeAutoma({
      corporation: {id: 'C02', original: 'Ecoline', startingTags: [], resource: 'plant', resources: 4, cubes: [], stats: {}},
    } as unknown as Partial<MarsBotModel>);
    const rows = marsBotRailEconomy(bot, automa);
    expect(rows.map((r) => r.key)).to.deep.eq(['megacredits', 'corp-plant']);
    expect(rows[1].value).to.eq(4);
    expect(rows[1].iconClass).to.contain('resource_icon--plants');
  });

  it('economy: a cube-marker corp store is STATE, never a resource row', () => {
    const automa = fakeAutoma({
      corporation: {id: 'C35', original: 'Lakefront Resorts', startingTags: [], resource: 'cube-white', resources: 1, cubes: [], stats: {}},
    } as unknown as Partial<MarsBotModel>);
    expect(marsBotRailEconomy(bot, automa).map((r) => r.key)).to.deep.eq(['megacredits']);
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

  // ── «Доп. ресурсы» — the extra-resource adapter ─────────────────────────
  describe('marsBotExtraGroups — pools by TYPE, holders are colony tiles', () => {
    it('floaters are one pool; storage groups by the STORED resource type', () => {
      const groups = marsBotExtraGroups(fakeAutoma({
        floaters: 6,
        shippingStorage: {'Miranda': 1, 'Callisto': 4, 'Io': 4, 'Enceladus': 4, 'Triton': 2},
      } as unknown as Partial<MarsBotModel>));
      const byKey = new Map(groups.map((g) => [g.key, g]));
      expect(byKey.get('floaters')?.total).to.eq(6);
      expect(byKey.get('animals')?.total, 'Miranda stores animals').to.eq(1);
      expect(byKey.get('animals')?.holders).to.deep.eq([{name: 'Miranda', amount: 1}]);
      expect(byKey.get('energy')?.total, 'Callisto stores energy').to.eq(4);
      expect(byKey.get('heat')?.total, 'Io stores heat').to.eq(4);
      expect(byKey.get('microbes')?.total, 'Enceladus stores microbes').to.eq(4);
      expect(byKey.get('titanium')?.total, 'Triton stores titanium').to.eq(2);
    });

    it('no double count by construction: Titan/Europa never appear as storage', () => {
      const groups = marsBotExtraGroups(fakeAutoma({
        floaters: 3,
        // A malformed model routing Titan into storage must stay silent —
        // the floater pool is the ONE home of those.
        shippingStorage: {'Titan': 5, 'Europa': 2} as never,
      } as unknown as Partial<MarsBotModel>));
      expect(groups.map((g) => g.key)).to.deep.eq(['floaters']);
      expect(groups[0].total).to.eq(3);
    });

    it('an empty bot shows nothing — the zone renders its honest empty state', () => {
      expect(marsBotExtraGroups(fakeAutoma())).to.deep.eq([]);
    });
  });
});

import {expect} from 'chai';
import {
  BoardPlacementStep,
  canonicalTileName,
  describeTilePlacement,
  noteRow,
  placementRow,
} from '@/client/console/consolePlacementNextStep';
import {TileType} from '@/common/TileType';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';

import ruConsole from '@/locales/ru/console.json';
import ruCards from '@/locales/ru/cards.json';
import ruAresCards from '@/locales/ru/ares_cards.json';
import ruPromo from '@/locales/ru/promo.json';
import ruUiCards from '@/locales/ru/UI_cards.json';

/**
 * The «ДАЛЕЕ» placement line must NAME the tile it is about to place — and take
 * that name from the TILE, never from the card that places it.
 *
 * The presenter is pure and takes its translator as a port, so these specs drive
 * it twice: with the identity translator (EN — the keys themselves) and with the
 * REAL `src/locales/ru` dictionaries, which also proves every key it can emit is
 * actually translated.
 */
describe('consolePlacementNextStep', () => {
  /* ── translators ──────────────────────────────────────────────────── */

  function interpolate(text: string, params?: ReadonlyArray<string>): string {
    return (params ?? []).reduce<string>((acc, p, i) => acc.split('${' + i + '}').join(p), text);
  }

  /** English: the key IS the text (this repo has no `en/` locale). */
  const en = (key: string, params?: ReadonlyArray<string>) => interpolate(key, params);

  /** Russian: a flat merge of the real locale files the presenter can hit. */
  const RU: Record<string, string> = {
    ...(ruCards as Record<string, string>),
    ...(ruAresCards as Record<string, string>),
    ...(ruPromo as Record<string, string>),
    ...(ruUiCards as Record<string, string>),
    ...(ruConsole as Record<string, string>),
  };
  const ru = (key: string, params?: ReadonlyArray<string>) => interpolate(RU[key] ?? key, params);

  function step(over: Partial<BoardPlacementStep> = {}): BoardPlacementStep {
    return {kind: 'boardPlacement', placementType: 'land', ...over};
  }

  /** A key that resolved to itself never reached the RU dictionary. */
  function assertTranslated(key: string): void {
    expect(RU[key], `missing RU translation for "${key}"`).to.be.a('string');
  }

  /* ── 1. an ordinary tile with no name of its own ──────────────────── */

  it('a placement with NO tile identity stays the honest generic line', () => {
    const d = describeTilePlacement(step(), en);
    expect(d.key).to.equal('Place the tile');
    expect(d.label).to.equal('Place the tile');
    expect(d.special).to.be.false;
    expect(d.tileName).to.equal('');
    assertTranslated('Place the tile');
    expect(describeTilePlacement(step(), ru).label).to.equal('разместите тайл');
  });

  /* ── 2/3. the ordinary tiles that DO have a localized type noun ───── */

  it('a CITY tile names its type, not "a tile"', () => {
    const d = describeTilePlacement(step({placementType: 'city', tileType: TileType.CITY}), ru);
    expect(d.key).to.equal('Place the city tile');
    expect(d.label).to.equal('разместите тайл города');
    expect(d.special).to.be.false;
  });

  it('an OCEAN tile names its type', () => {
    const d = describeTilePlacement(step({placementType: 'ocean', tileType: TileType.OCEAN}), ru);
    expect(d.label).to.equal('разместите тайл океана');
  });

  it('a GREENERY tile names its type', () => {
    const d = describeTilePlacement(step({placementType: 'greenery', tileType: TileType.GREENERY}), ru);
    expect(d.label).to.equal('разместите тайл озеленения');
  });

  it('an ordinary tile is never quoted as a NAME («тайл «city»»)', () => {
    for (const t of [TileType.CITY, TileType.OCEAN, TileType.GREENERY]) {
      const d = describeTilePlacement(step({tileType: t}), ru);
      expect(d.tileName).to.equal('');
      expect(d.label).to.not.include('«');
    }
  });

  /* ── 4. a NAMED special tile — the headline case ──────────────────── */

  it('a named special tile reads «особый тайл «Солнечная электростанция»» — kind BEFORE name', () => {
    const d = describeTilePlacement(step({tileType: TileType.SOLAR_FARM}), ru);
    expect(d.special).to.be.true;
    expect(d.tileName).to.equal('Солнечная электростанция');
    expect(d.label).to.equal('разместите особый тайл «Солнечная электростанция»');
    // The ORDER is load-bearing: «особый тайл» must precede the name.
    expect(d.label.indexOf('особый тайл')).to.be.lessThan(d.label.indexOf('Солнечная'));
  });

  it('the EN sentence is idiomatic, not a calque of the RU word order', () => {
    const d = describeTilePlacement(step({tileType: TileType.SOLAR_FARM}), en);
    expect(d.key).to.equal('Place the ${0} special tile');
    expect(d.label).to.equal('Place the Solar Farm special tile');
  });

  it('every special tile in the supported scope resolves a REAL translated name', () => {
    const SCOPE: ReadonlyArray<TileType> = [
      TileType.CAPITAL, TileType.COMMERCIAL_DISTRICT, TileType.ECOLOGICAL_ZONE, TileType.INDUSTRIAL_CENTER,
      TileType.LAVA_FLOWS, TileType.MINING_AREA, TileType.MINING_RIGHTS, TileType.MOHOLE_AREA,
      TileType.NATURAL_PRESERVE, TileType.NUCLEAR_ZONE, TileType.RESTRICTED_AREA, TileType.DEIMOS_DOWN,
      TileType.GREAT_DAM, TileType.MAGNETIC_FIELD_GENERATORS, TileType.BIOFERTILIZER_FACILITY,
      TileType.METALLIC_ASTEROID, TileType.SOLAR_FARM, TileType.OCEAN_CITY, TileType.OCEAN_FARM,
      TileType.OCEAN_SANCTUARY, TileType.NEW_HOLLAND,
    ];
    const untranslated = SCOPE.filter((t) => {
      const d = describeTilePlacement(step({tileType: t}), ru);
      return d.tileName === '' || d.tileName === canonicalTileName(t);
    }).map((t) => TileType[t]);
    expect(untranslated, `special tiles with no RU name: ${untranslated.join(', ')}`).to.be.empty;
  });

  /* ── 5. a special tile with NO usable name ────────────────────────── */

  it('a special tile without a name falls back to «особый тайл» — never empty quotes', () => {
    // A TileType this build does not know (a newer server) — the total
    // `tileTypeToString` record cannot be trusted at runtime.
    const d = describeTilePlacement(step({tileType: 9999 as TileType}), ru);
    expect(d.special).to.be.true;
    expect(d.key).to.equal('Place the special tile');
    expect(d.label).to.equal('разместите особый тайл');
    expect(d.tileName).to.equal('');
  });

  /* ── 6. several identical tiles ───────────────────────────────────── */

  it('a 2-tile ocean placement counts correctly', () => {
    const d = describeTilePlacement(step({placementType: 'ocean', tileType: TileType.OCEAN, count: 2}), ru);
    expect(d.count).to.equal(2);
    expect(d.key).to.equal('Place ${0} ocean tiles');
    expect(d.label).to.equal('разместите 2 тайла океана');
  });

  it('several unnamed special tiles read «2 особых тайла»', () => {
    const d = describeTilePlacement(step({tileType: 9999 as TileType, count: 2}), ru);
    expect(d.label).to.equal('разместите 2 особых тайла');
  });

  it('a NAMED tile keeps its name even when the count is > 1', () => {
    const d = describeTilePlacement(step({tileType: TileType.SOLAR_FARM, count: 2}), ru);
    expect(d.label).to.equal('разместите особый тайл «Солнечная электростанция» (×2)');
  });

  it('count 0 / a missing count are both a single tile (never «0 тайлов»)', () => {
    expect(describeTilePlacement(step({tileType: TileType.OCEAN}), ru).count).to.equal(1);
    expect(describeTilePlacement(step({tileType: TileType.OCEAN, count: 0}), ru).label).to.equal('разместите тайл океана');
  });

  /* ── 9/10. the NAME comes from the tile, never from a card ────────── */

  it('the name comes from the TILE definition table, keyed by TileType', () => {
    // `tileTypeToString` is the canonical table; a special tile's entry is the
    // tile's own identity (which for an eponymous tile equals a CardName value).
    expect(canonicalTileName(TileType.SOLAR_FARM)).to.equal(CardName.SOLAR_FARM);
    expect(canonicalTileName(TileType.INDUSTRIAL_CENTER)).to.equal(CardName.INDUSTRIAL_CENTER);
    // The ordinary tiles carry no NAME — their type is the whole identity.
    expect(canonicalTileName(TileType.CITY)).to.be.undefined;
    expect(canonicalTileName(TileType.OCEAN)).to.be.undefined;
    expect(canonicalTileName(TileType.GREENERY)).to.be.undefined;
    expect(canonicalTileName(undefined)).to.be.undefined;
  });

  it('the step carries NO card field the presenter could fall back to', () => {
    // A structural guarantee: there is nothing card-shaped in the input, so a
    // card name cannot leak into the line even by accident.
    expect(Object.keys(step({tileType: TileType.SOLAR_FARM}))).to.deep.equal(['kind', 'placementType', 'tileType']);
  });

  it('a card whose NAME differs from its tile shows the TILE (Nuclear Zone:ares → the base tile)', () => {
    // The Ares variant card is `CardName.NUCLEAR_ZONE_ARES` ('Nuclear Zone:ares'),
    // but the TILE is `TileType.NUCLEAR_ZONE` — the suffixed card name must never
    // reach the line.
    const d = describeTilePlacement(step({tileType: TileType.NUCLEAR_ZONE}), ru);
    expect(d.tileName).to.equal(RU[CardName.NUCLEAR_ZONE]);
    expect(d.label).to.not.include(':ares');
    expect(d.label).to.not.include('undefined');
  });

  /* ── 11. never a technical identifier / undefined / empty quotes ──── */

  it('no variant can produce `undefined`, `[object Object]` or empty quotes', () => {
    const variants: ReadonlyArray<BoardPlacementStep> = [
      step(),
      step({tileType: TileType.CITY}),
      step({tileType: TileType.SOLAR_FARM}),
      step({tileType: 9999 as TileType}),
      step({tileType: 9999 as TileType, count: 3}),
      step({placementType: 'colony'}),
      step({tileType: TileType.OCEAN, count: 2}),
    ];
    for (const v of variants) {
      for (const t of [en, ru]) {
        const label = describeTilePlacement(v, t).label;
        expect(label).to.not.match(/undefined|NaN|\[object|\$\{\d\}/);
        expect(label).to.not.include('««');
        expect(label).to.not.include('«»');
        expect(label.trim()).to.not.equal('');
      }
    }
  });

  /* ── the colony branch keeps its own (non-tile) copy ──────────────── */

  it('a colony build is NOT a tile — no name, no «особый»', () => {
    const d = describeTilePlacement(step({placementType: 'colony'}), ru);
    expect(d.key).to.equal('Choose where to build a colony');
    expect(d.special).to.be.false;
    expect(d.tileType).to.be.undefined;
  });

  /* ── the row shape the templates consume ──────────────────────────── */

  it('placementRow keeps the constraint as a SEPARATE muted tail', () => {
    const row = placementRow(
      step({tileType: TileType.INDUSTRIAL_CENTER, constraint: 'next to a city'}),
      ru,
      (m) => (typeof m === 'string' ? ru(m) : m.message),
    );
    expect(row.text).to.equal('разместите особый тайл «Промышленный центр»');
    expect(row.constraint).to.equal('рядом с городом');
    // The full value stays available for accessibility behind any ellipsis.
    expect(row.full).to.equal('разместите особый тайл «Промышленный центр» — рядом с городом');
    expect(row.tileType).to.equal(TileType.INDUSTRIAL_CENTER);
  });

  it('a constraint authored as a Message is resolved too', () => {
    const msg: Message = {message: 'next to an ocean', data: []};
    const row = placementRow(step({tileType: TileType.GREAT_DAM, constraint: msg}), ru, () => 'рядом с океаном');
    expect(row.constraint).to.equal('рядом с океаном');
  });

  it('a row without a constraint reports an EMPTY tail (the template renders nothing)', () => {
    const row = placementRow(step({tileType: TileType.OCEAN}), ru, (m) => String(m));
    expect(row.constraint).to.equal('');
    expect(row.full).to.equal(row.text);
  });

  it('a prose note row carries no tile icon', () => {
    const row = noteRow('выберите клетку для резервирования');
    expect(row.tileType).to.be.undefined;
    expect(row.constraint).to.equal('');
    expect(row.full).to.equal('выберите клетку для резервирования');
  });

  /* ── every emitted key is present in RU ───────────────────────────── */

  it('every sentence the presenter can emit is translated in ru/console.json', () => {
    const cases: ReadonlyArray<BoardPlacementStep> = [
      step(),
      step({tileType: TileType.CITY}), step({tileType: TileType.OCEAN}), step({tileType: TileType.GREENERY}),
      step({tileType: 9999 as TileType}), step({tileType: TileType.SOLAR_FARM}),
      step({count: 2}),
      step({tileType: TileType.CITY, count: 2}), step({tileType: TileType.OCEAN, count: 2}),
      step({tileType: TileType.GREENERY, count: 2}), step({tileType: 9999 as TileType, count: 2}),
      step({tileType: TileType.SOLAR_FARM, count: 2}),
      step({placementType: 'colony'}), step({placementType: 'colony', count: 2}),
    ];
    for (const c of cases) {
      assertTranslated(describeTilePlacement(c, en).key);
    }
  });
});

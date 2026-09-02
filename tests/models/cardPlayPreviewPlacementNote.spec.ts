import {expect} from 'chai';
import {testGame} from '../TestGame';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {ActionPreviewStep} from '../../src/common/models/ActionPreviewModel';
import {TileType} from '../../src/common/TileType';
import {CardName} from '../../src/common/cards/CardName';
import {MiningRights} from '../../src/server/cards/base/MiningRights';
import {MiningArea} from '../../src/server/cards/base/MiningArea';
import {EcologicalZone} from '../../src/server/cards/base/EcologicalZone';
import {ImmigrantCity} from '../../src/server/cards/base/ImmigrantCity';
import {IndustrialCenter} from '../../src/server/cards/base/IndustrialCenter';
import {LandClaim} from '../../src/server/cards/base/LandClaim';
import {UrbanizedArea} from '../../src/server/cards/base/UrbanizedArea';
import {Flooding} from '../../src/server/cards/base/Flooding';
import {Capital} from '../../src/server/cards/base/Capital';
import {CommercialDistrict} from '../../src/server/cards/base/CommercialDistrict';
import {NuclearZone} from '../../src/server/cards/base/NuclearZone';
import {ArtificialLake} from '../../src/server/cards/base/ArtificialLake';
import {LakeMarineris} from '../../src/server/cards/base/LakeMarineris';
import {KaguyaTech} from '../../src/server/cards/promo/KaguyaTech';
import {MarsNomads} from '../../src/server/cards/promo/MarsNomads';
import {GreatDamPromo} from '../../src/server/cards/promo/GreatDamPromo';
import {SolarFarm} from '../../src/server/cards/ares/SolarFarm';
import {LavaTubeSettlement} from '../../src/server/cards/prelude/LavaTubeSettlement';
import {BoomTown} from '../../src/server/cards/promo/BoomTown';
import {MinorityRefuge} from '../../src/server/cards/colonies/MinorityRefuge';
import {PioneerSettlement} from '../../src/server/cards/colonies/PioneerSettlement';

type PlacementStep = Extract<ActionPreviewStep, {kind: 'boardPlacement'}>;

/**
 * An on-play placement must reach the modal as a STRUCTURED step carrying the
 * `TileType` it will place — that is what lets the preview line say WHICH tile
 * («особый тайл «Солнечная электростанция»») instead of a mute "place a tile".
 *
 * Two things are load-bearing here:
 *   - the identity is the TILE's, so a card whose name differs from its tile
 *     (Flooding → OCEAN, Lava Tube Settlement → CITY) reports the tile;
 *   - a board step that places NO tile (reserve a space, move a marker, convert
 *     an existing tile) still says so in prose — it must not fake a tile.
 */
describe('cardPlayPreview — a placement carries its tile identity', () => {
  function steps(card: IProjectCard): ReadonlyArray<ActionPreviewStep> {
    const [/* game */, player] = testGame(2);
    return cardPlayPreview(player, card).branches[0].steps;
  }
  function placements(card: IProjectCard): Array<PlacementStep> {
    return steps(card).filter((s): s is PlacementStep => s.kind === 'boardPlacement');
  }
  function noteKinds(card: IProjectCard): Array<string> {
    return steps(card)
      .filter((s): s is ActionPreviewStep & {noteKind: string} => s.kind === 'note')
      .map((s) => s.noteKind);
  }

  /* ── bespoke placements now declare their tile ────────────────────── */

  const TILED: Array<[string, IProjectCard, TileType]> = [
    // A NAMED special tile — the case the whole line exists for.
    ['Solar Farm', new SolarFarm(), TileType.SOLAR_FARM],
    ['Ecological Zone', new EcologicalZone(), TileType.ECOLOGICAL_ZONE],
    ['Industrial Center', new IndustrialCenter(), TileType.INDUSTRIAL_CENTER],
    ['Great Dam', new GreatDamPromo(), TileType.GREAT_DAM],
    ['Mining Rights', new MiningRights(), TileType.MINING_RIGHTS],
    ['Mining Area', new MiningArea(), TileType.MINING_AREA],
    // Cards whose own name is NOT the tile they place.
    ['Immigrant City', new ImmigrantCity(), TileType.CITY],
    ['Urbanized Area', new UrbanizedArea(), TileType.CITY],
    ['Lava Tube Settlement', new LavaTubeSettlement(), TileType.CITY],
    // A PRELUDE previews through the same path (the console start scene fetches it).
    ['Boom Town', new BoomTown(), TileType.CITY],
    ['Flooding', new Flooding(), TileType.OCEAN],
    // Declarative `behavior.tile` / `behavior.ocean` — the walker path.
    ['Capital', new Capital(), TileType.CAPITAL],
    ['Commercial District', new CommercialDistrict(), TileType.COMMERCIAL_DISTRICT],
    ['Nuclear Zone', new NuclearZone(), TileType.NUCLEAR_ZONE],
    ['Artificial Lake', new ArtificialLake(), TileType.OCEAN],
  ];
  for (const [name, card, tileType] of TILED) {
    it(`${name} → a board placement carrying ${TileType[tileType]}`, () => {
      const found = placements(card);
      expect(found, 'no boardPlacement step').to.have.length.greaterThan(0);
      expect(found.map((s) => s.tileType)).to.include(tileType);
    });
  }

  it('Ecological Zone places its OWN special tile — not a greenery', () => {
    // The old copy claimed "place the greenery tile"; the tile raises no oxygen
    // and never counts as a greenery, so that was simply wrong.
    expect(placements(new EcologicalZone())[0].tileType).to.equal(TileType.ECOLOGICAL_ZONE);
    expect(placements(new EcologicalZone())[0].tileType).to.not.equal(TileType.GREENERY);
  });

  it('a multi-tile placement reports its count (Lake Marineris → 2 oceans)', () => {
    const ocean = placements(new LakeMarineris()).find((s) => s.tileType === TileType.OCEAN);
    expect(ocean?.count).to.equal(2);
  });

  it('a single-tile placement does not claim a count', () => {
    const ocean = placements(new ArtificialLake()).find((s) => s.tileType === TileType.OCEAN);
    expect(ocean?.count === undefined || ocean?.count === 1).to.be.true;
  });

  /* ── the tile identity is never the CARD's name ───────────────────── */

  it('the placement step carries no card name to fall back on', () => {
    for (const [, card] of TILED) {
      for (const s of placements(card)) {
        expect(Object.keys(s)).to.not.include('card');
        expect(JSON.stringify(s)).to.not.include(card.name);
      }
    }
  });

  it('Flooding reports an OCEAN, never "Flooding"', () => {
    const [placement] = placements(new Flooding());
    expect(placement.tileType).to.equal(TileType.OCEAN);
    expect(JSON.stringify(placement)).to.not.include(CardName.FLOODING);
  });

  it('Flooding keeps the adjacent-opponent attack as its OWN note', () => {
    // The M€ attack is not a placement rule — it must not be folded into (nor
    // dropped from) the placement line.
    const texts = steps(new Flooding())
      .filter((s): s is ActionPreviewStep & {text?: string} => s.kind === 'note')
      .map((s) => s.text);
    expect(texts).to.include('An adjacent opponent may lose 4 M€');
  });

  /* ── constraints ride the step, not the sentence ──────────────────── */

  const CONSTRAINED: Array<[string, IProjectCard, string]> = [
    ['Industrial Center', new IndustrialCenter(), 'next to a city'],
    ['Ecological Zone', new EcologicalZone(), 'next to a greenery'],
    ['Great Dam', new GreatDamPromo(), 'next to an ocean'],
    ['Urbanized Area', new UrbanizedArea(), 'next to at least 2 other cities'],
    ['Lava Tube Settlement', new LavaTubeSettlement(), 'on a volcanic area'],
    ['Mining Rights', new MiningRights(), 'on a steel or titanium bonus area'],
    ['Boom Town', new BoomTown(), 'on a steel or titanium bonus area'],
  ];
  for (const [name, card, constraint] of CONSTRAINED) {
    it(`${name} keeps its placement restriction ("${constraint}")`, () => {
      expect(placements(card).map((s) => s.constraint)).to.include(constraint);
    });
  }

  /* ── steps that place NO tile stay honest prose ───────────────────── */

  const TILELESS: Array<[string, IProjectCard]> = [
    ['Land Claim', new LandClaim()],          // reserves a space, no tile
    ['Mars Nomads', new MarsNomads()],        // moves a marker, no tile
    ['Kaguya Tech', new KaguyaTech()],        // converts an existing greenery
  ];
  for (const [name, card] of TILELESS) {
    it(`${name} places no tile → a prose 'board' note, never a fake tile`, () => {
      expect(noteKinds(card)).to.include('board');
      expect(placements(card)).to.be.empty;
    });
  }

  const COLONY: Array<[string, IProjectCard]> = [
    ['Minority Refuge', new MinorityRefuge()],
    ['Pioneer Settlement', new PioneerSettlement()],
  ];
  for (const [name, card] of COLONY) {
    it(`${name} → a colony build (off-Mars: no tile identity)`, () => {
      const [placement] = placements(card);
      expect(placement?.placementType).to.equal('colony');
      expect(placement?.tileType).to.be.undefined;
    });
  }

  /* ── no card smuggles a tile name back into prose ─────────────────── */

  it('no placement note text names a tile — that is the structured step\'s job', () => {
    const ALL = [...TILED.map(([, c]) => c), ...TILELESS.map(([, c]) => c), ...COLONY.map(([, c]) => c)];
    const offenders: Array<string> = [];
    for (const card of ALL) {
      for (const s of steps(card)) {
        if (s.kind === 'note' && typeof s.text === 'string' && /\btile\b/i.test(s.text)) {
          offenders.push(`${card.name}: "${s.text}"`);
        }
      }
    }
    expect(offenders, offenders.join(' | ')).to.be.empty;
  });
});

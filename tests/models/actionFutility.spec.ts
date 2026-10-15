import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {maxOutOceans, setOxygenLevel, setTemperature, setVenusScaleLevel} from '../TestingUtils';
import {actionFutility, standardProjectFutility} from '../../src/server/models/actionFutility';
import {potentialActions} from '../../src/server/models/potentialActions';
import {actionPreview} from '../../src/server/models/actionPreview';
import {buildStandardProjectPreview} from '../../src/server/models/standardProjectPreview';
import {heatConversionMetadata} from '../../src/server/cards/base/standardActions/ConvertHeat';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {isIActionCard, ICard, IActionCard} from '../../src/server/cards/ICard';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {Resource} from '../../src/common/Resource';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE, MAX_VENUS_SCALE} from '../../src/common/constants';
import {WaterSplittingPlant} from '../../src/server/cards/base/WaterSplittingPlant';
import {VenusMagnetizer} from '../../src/server/cards/venusNext/VenusMagnetizer';
import {GHGProducingBacteria} from '../../src/server/cards/base/GHGProducingBacteria';
import {Ironworks} from '../../src/server/cards/base/Ironworks';
import {AquiferPumping} from '../../src/server/cards/base/AquiferPumping';
import {WaterImportFromEuropa} from '../../src/server/cards/base/WaterImportFromEuropa';
import {Whales} from '../../src/server/cards/underworld/Whales';
import {SearchForLife} from '../../src/server/cards/base/SearchForLife';
import {MeatIndustry} from '../../src/server/cards/promo/MeatIndustry';
import {Excentric} from '../../src/server/awards/Excentric';
import {DirectedImpactors} from '../../src/server/cards/promo/DirectedImpactors';
import {RedShips} from '../../src/server/cards/promo/RedShips';
import {FloydContinuum} from '../../src/server/cards/promo/FloydContinuum';
import {MartianRails} from '../../src/server/cards/base/MartianRails';
import {SymbioticFungus} from '../../src/server/cards/base/SymbioticFungus';
import {AsteroidStandardProject} from '../../src/server/cards/base/standardProjects/AsteroidStandardProject';
import {AquiferStandardProject} from '../../src/server/cards/base/standardProjects/AquiferStandardProject';
import {CrediCor} from '../../src/server/cards/corporation/CrediCor';

/**
 * THE «NO EFFECT» VERDICT (the owner's iteration of 2026-10-15) — PROVEN or nothing: an action the rules allow is
 * futile only when every yield is provably empty and nothing on the table answers it. Three families of claims are
 * pinned here (a maxed parameter · a counted gain of zero / no target · a resource past the card's points), the
 * rescues (Whales, a reacting card, a live award), the partial class that must NEVER read futile (Ironworks at 14 %
 * oxygen still pays its steel), and a corpus walk over every in-scope action card.
 */
const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject', 'turmoilRedux']);

function seat(player: TestPlayer, card: ICard, resources = 0): void {
  player.playedCards.push(card);
  if (resources > 0) {
    card.resourceCount = resources;
  }
}

function maxEverything(game: IGame, player: TestPlayer): void {
  setTemperature(game, MAX_TEMPERATURE);
  setOxygenLevel(game, MAX_OXYGEN_LEVEL);
  setVenusScaleLevel(game, MAX_VENUS_SCALE);
  maxOutOceans(player);
}

describe('actionFutility — the «no effect» verdict', () => {
  let game: IGame;
  let player: TestPlayer;
  beforeEach(() => {
    [game, player] = testGame(2, {venusNextExtension: true});
  });

  describe('a maxed parameter', () => {
    it('Water Splitting Plant: its whole result is an oxygen step — futile at 14 %, useful below', () => {
      const card = new WaterSplittingPlant();
      seat(player, card);
      player.energy = 3;
      expect(actionFutility(player, card)).to.be.undefined;
      setOxygenLevel(game, MAX_OXYGEN_LEVEL);
      expect(actionFutility(player, card)?.verdict).to.deep.include({kind: 'parameter-maxed', parameter: 'oxygen'});
    });

    it('Venus Magnetizer: a production PRICE is not a yield — futile at 30 %', () => {
      const card = new VenusMagnetizer();
      seat(player, card);
      player.production.add(Resource.ENERGY, 2);
      setVenusScaleLevel(game, MAX_VENUS_SCALE);
      expect(actionFutility(player, card)?.verdict).to.deep.include({kind: 'parameter-maxed', parameter: 'venus'});
    });

    it('GHG Producing Bacteria: the spend branch is futile at +8 °C, the add branch keeps the card useful', () => {
      const card = new GHGProducingBacteria();
      seat(player, card, 2);
      setTemperature(game, MAX_TEMPERATURE);
      const f = actionFutility(player, card);
      expect(f?.verdict, 'the card as a whole has value').to.be.undefined;
      // The card's own `or` order: the spend branch first, the add branch second.
      expect(f?.branches?.map((b) => b.futile)).to.deep.eq([true, false]);
      expect(f?.branches?.[0].verdict).to.deep.include({kind: 'parameter-maxed', parameter: 'temperature'});
      // The composer reads the same verdict on the branch it names — and only there.
      const preview = actionPreview(player, card);
      expect(preview.branches.map((b) => b.futile?.kind)).to.deep.eq(['parameter-maxed', undefined]);
    });

    it('THE PARTIAL CLASS IS NEVER FUTILE — Ironworks at 14 % oxygen still pays its steel', () => {
      const card = new Ironworks();
      seat(player, card);
      player.energy = 4;
      setOxygenLevel(game, MAX_OXYGEN_LEVEL);
      expect(card.canAct(player)).is.true;
      expect(card.warnings.has('maxoxygen'), 'the card-level warning says «part is wasted»').is.true;
      expect(actionFutility(player, card), 'but the action has value').to.be.undefined;
    });

    it('Aquifer Pumping / Water Import From Europa: an ocean with every ocean placed — futile; a Whales owner still collects', () => {
      for (const card of [new AquiferPumping(), new WaterImportFromEuropa()]) {
        [game, player] = testGame(2);
        seat(player, card);
        player.megaCredits = 50;
        maxOutOceans(player);
        expect(actionFutility(player, card)?.verdict, card.name).to.deep.include({kind: 'parameter-maxed', parameter: 'oceans'});
        seat(player, new Whales());
        expect(actionFutility(player, card), `${card.name} — Whales collects the blocked ocean`).to.be.undefined;
      }
    });

    it('Directed Impactors at +8 °C: with nothing to pay for an asteroid the action IS the futile removal', () => {
      const card = new DirectedImpactors();
      seat(player, card, 1);
      setTemperature(game, MAX_TEMPERATURE);
      player.megaCredits = 0;
      expect(actionFutility(player, card)?.verdict).to.deep.include({kind: 'parameter-maxed', parameter: 'temperature'});
      player.megaCredits = 10;
      const f = actionFutility(player, card);
      expect(f?.verdict, 'the purchase is a yield').to.be.undefined;
      expect(f?.branches?.[0].futile).is.true;
    });
  });

  describe('a counted gain of zero · no target', () => {
    it('Red Ships with no city beside an ocean pays 0 M€', () => {
      const card = new RedShips();
      seat(player, card);
      expect(actionFutility(player, card)?.verdict?.kind).to.eq('zero-yield');
    });

    it('Floyd Continuum: no completed parameter — 0 M€; one completed — useful', () => {
      const card = new FloydContinuum();
      seat(player, card);
      expect(actionFutility(player, card)?.verdict?.kind).to.eq('zero-yield');
      setTemperature(game, MAX_TEMPERATURE);
      expect(actionFutility(player, card)).to.be.undefined;
    });

    it('Martian Rails with no city on Mars (a declarative count) pays nothing', () => {
      const card = new MartianRails();
      seat(player, card);
      player.energy = 1;
      expect(actionFutility(player, card)?.verdict?.kind).to.eq('zero-yield');
    });

    it('Symbiotic Fungus with no microbe card to take the microbe', () => {
      const card = new SymbioticFungus();
      seat(player, card);
      expect(actionFutility(player, card)?.verdict?.kind).to.eq('no-target');
      seat(player, new GHGProducingBacteria());
      expect(actionFutility(player, card)).to.be.undefined;
    });
  });

  describe('a resource past the card\'s points', () => {
    it('Search For Life holding its science: futile — unless the table still counts the science', () => {
      const card = new SearchForLife();
      seat(player, card);
      player.megaCredits = 5;
      expect(actionFutility(player, card), 'no science yet: a find scores 3 VP').to.be.undefined;
      card.resourceCount = 1;
      expect(actionFutility(player, card)?.verdict).to.deep.include({kind: 'vp-capped', resource: CardResource.SCIENCE});
      // A LIVE award that counts every card resource (the owner's decision: value while it is alive).
      game.awards.push(new Excentric());
      expect(actionFutility(player, card), 'Excentric, still fundable').to.be.undefined;
      game.awards.pop();
      // A card that reacts to a resource being added.
      seat(player, new MeatIndustry());
      expect(actionFutility(player, card), 'a reactor answers the addition').to.be.undefined;
    });
  });

  describe('the standard actions and projects', () => {
    it('the heat conversion at the temperature\'s maximum carries the verdict on its option', () => {
      expect(heatConversionMetadata(player, 8).futile).to.be.undefined;
      setTemperature(game, MAX_TEMPERATURE);
      expect(heatConversionMetadata(player, 8).futile).to.deep.include({kind: 'parameter-maxed', parameter: 'temperature'});
      expect(heatConversionMetadata(player, 6).futile, 'the Kelvinists\' variant reads the same').to.deep.include({kind: 'parameter-maxed'});
    });

    it('an asteroid at +8 °C is futile — CrediCor\'s rebate answers any project; an aquifer with Whales is not', () => {
      const asteroid = new AsteroidStandardProject();
      expect(buildStandardProjectPreview(player, asteroid, 14).futile).to.be.undefined;
      setTemperature(game, MAX_TEMPERATURE);
      expect(buildStandardProjectPreview(player, asteroid, 14).futile).to.deep.include({kind: 'parameter-maxed', parameter: 'temperature'});
      player.playedCards.push(new CrediCor());
      expect(standardProjectFutility(player, asteroid, false, false), 'a standard-project reactor pays').to.be.undefined;

      [game, player] = testGame(2);
      maxOutOceans(player);
      const aquifer = new AquiferStandardProject();
      expect(buildStandardProjectPreview(player, aquifer, 18).futile).to.deep.include({kind: 'parameter-maxed', parameter: 'oceans'});
      seat(player, new Whales());
      expect(buildStandardProjectPreview(player, aquifer, 18).futile).to.be.undefined;
    });
  });

  it('the availability projection counts the futile ones apart — and still counts them', () => {
    seat(player, new WaterSplittingPlant());
    seat(player, new GHGProducingBacteria(), 2);
    player.energy = 3;
    setOxygenLevel(game, MAX_OXYGEN_LEVEL);
    const potential = potentialActions(player);
    expect(potential.cardActions).to.eq(2);
    expect(potential.futileCardActions).to.eq(1);
  });

  describe('the corpus — every in-scope action card, a rich seat, two tables', () => {
    function forEachActionCard(fn: (name: CardName, make: () => ICard & IActionCard) => void): void {
      for (const manifest of ALL_MODULE_MANIFESTS) {
        if (!SCOPE.has(manifest.module)) {
          continue;
        }
        for (const group of [manifest.projectCards, manifest.corporationCards, manifest.preludeCards]) {
          for (const name of Object.keys(group)) {
            const Factory = (group as Record<string, {Factory: new () => ICard}>)[name]?.Factory;
            if (Factory === undefined) {
              continue;
            }
            let probe: ICard;
            try {
              probe = new Factory();
            } catch {
              continue;
            }
            if (isIActionCard(probe)) {
              fn(probe.name, () => new Factory() as ICard & IActionCard);
            }
          }
        }
      }
    }

    type Reading = {canAct: boolean, futile: boolean, branches: ReadonlyArray<boolean>, kinds: ReadonlyArray<string>};
    function read(make: () => ICard & IActionCard, maxed: boolean): Reading {
      const [g, p] = testGame(2, {venusNextExtension: true});
      const card = make();
      p.playedCards.push(card);
      if (card.resourceType !== undefined) {
        card.resourceCount = 5;
      }
      p.megaCredits = 100;
      p.steel = 30;
      p.titanium = 30;
      p.plants = 30;
      p.energy = 30;
      p.heat = 30;
      p.production.add(Resource.ENERGY, 3);
      if (maxed) {
        maxEverything(g, p);
      }
      let canAct = false;
      try {
        canAct = card.canAct(p);
      } catch {
        return {canAct: false, futile: false, branches: [], kinds: []};
      }
      if (!canAct) {
        return {canAct, futile: false, branches: [], kinds: []};
      }
      const before = JSON.stringify(g.serialize());
      const f = actionFutility(p, card);
      expect(JSON.stringify(g.serialize()), `${card.name}: the verdict is READ-ONLY`).to.eq(before);
      return {
        canAct,
        futile: f?.verdict !== undefined,
        branches: (f?.branches ?? []).map((b) => b.futile),
        kinds: [f?.verdict?.kind, ...(f?.branches ?? []).map((b) => b.verdict?.kind)].filter((k): k is NonNullable<typeof k> => k !== undefined),
      };
    }

    const readings = new Map<CardName, {low: Reading, max: Reading}>();
    before(() => {
      forEachActionCard((name, make) => readings.set(name, {low: read(make, false), max: read(make, true)}));
    });

    it('reads a real corpus (anti-vacuous)', () => {
      expect(readings.size).to.be.greaterThan(100);
      const futileAtMax = [...readings.values()].filter((r) => r.max.futile).length;
      expect(futileAtMax, 'a maxed table makes several actions futile').to.be.greaterThan(4);
    });

    it('WHOLE-futile at max for the cards whose whole result is a maxed step', () => {
      for (const name of [CardName.WATER_SPLITTING_PLANT, CardName.VENUS_MAGNETIZER, CardName.PLASMA_FANS, CardName.AQUIFER_PUMPING, CardName.WATER_IMPORT_FROM_EUROPA]) {
        const r = readings.get(name);
        expect(r?.max.canAct, `${name} is legal on the maxed table`).is.true;
        expect(r?.max.futile, `${name} is futile on the maxed table`).is.true;
        expect(r?.low.futile, `${name} has value on the open table`).is.false;
      }
    });

    it('a futile BRANCH at max beside a useful one for the spend-or-add cards', () => {
      for (const name of [CardName.GHG_PRODUCING_BACTERIA, CardName.REGOLITH_EATERS, CardName.THERMOPHILES, CardName.DIRECTED_IMPACTORS,
        CardName.ROTATOR_IMPACTS, CardName.FORCED_PRECIPITATION, CardName.COMET_AIMING, CardName.ICY_IMPACTORS]) {
        const r = readings.get(name);
        expect(r?.max.futile, `${name}: the add branch keeps the card useful`).is.false;
        expect(r?.max.branches.some((b) => b), `${name}: its spend branch is futile`).is.true;
      }
    });

    it('NEVER futile: the partial class and the cards that pay TR directly', () => {
      for (const name of [CardName.IRONWORKS, CardName.STEELWORKS, CardName.ORE_PROCESSOR, CardName.CARETAKER_CONTRACT,
        CardName.EQUATORIAL_MAGNETIZER]) {
        const r = readings.get(name);
        expect(r?.max.futile || r?.low.futile, `${name}`).is.false;
        expect(r?.max.branches.some((b) => b) ?? false, `${name}: no branch`).is.false;
      }
    });

    it('on the OPEN table no action is futile because of a parameter', () => {
      const offenders = [...readings.entries()].filter(([, r]) => r.low.kinds.includes('parameter-maxed')).map(([n]) => n);
      expect(offenders).to.deep.eq([]);
    });
  }).timeout(60_000); // two fresh tables per in-scope action card — seconds, and it grows with every card shipped

  it('every award / milestone that reads a resource AMOUNT declares it (`cardResourceCount`)', () => {
    const offenders: Array<string> = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith('.ts')) {
          const text = fs.readFileSync(full, 'utf8');
          if ((text.includes('getResourceCount(') || text.includes('.resourceCount')) && !text.includes('cardResourceCount')) {
            offenders.push(path.relative(process.cwd(), full));
          }
        }
      }
    };
    walk(path.join(__dirname, '../../src/server/awards'));
    walk(path.join(__dirname, '../../src/server/milestones'));
    expect(offenders, 'a scorer that counts card resources must say which (the «no effect» rescue reads it)').to.deep.eq([]);
  });
});

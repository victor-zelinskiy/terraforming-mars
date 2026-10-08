import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {actionPreview} from '../../src/server/models/actionPreview';
import {ICard, IActionCard} from '../../src/server/cards/ICard';
import {UnitedNationsMarsInitiative} from '../../src/server/cards/corporation/UnitedNationsMarsInitiative';
import {CaretakerContract} from '../../src/server/cards/base/CaretakerContract';
import {EquatorialMagnetizer} from '../../src/server/cards/base/EquatorialMagnetizer';
import {NitriteReducingBacteria} from '../../src/server/cards/base/NitriteReducingBacteria';
import {TitanAirScrapping} from '../../src/server/cards/colonies/TitanAirScrapping';
import {AquiferPumping} from '../../src/server/cards/base/AquiferPumping';
import {WaterImportFromEuropa} from '../../src/server/cards/base/WaterImportFromEuropa';
import {EarthArmyContract} from '../../src/server/cards/turmoilRedux/EarthArmyContract';
import {SpaceshipRecycling} from '../../src/server/cards/turmoilRedux/SpaceshipRecycling';
import {FormulaZero} from '../../src/server/cards/turmoilRedux/FormulaZero';
import {EvaMechs} from '../../src/server/cards/turmoilRedux/EvaMechs';
import {MechSports} from '../../src/server/cards/turmoilRedux/MechSports';
import {SecurityFleet} from '../../src/server/cards/base/SecurityFleet';
import {ElectroCatapult} from '../../src/server/cards/base/ElectroCatapult';
import {SpaceMirrors} from '../../src/server/cards/base/SpaceMirrors';
import {Ants} from '../../src/server/cards/base/Ants';
import {Decomposers} from '../../src/server/cards/base/Decomposers';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {Phase} from '../../src/common/Phase';
import {ActionPreviewBranch} from '../../src/common/models/ActionPreviewModel';
import {RATING_RAIL_KEY} from '../../src/client/console/resourceTransfer/resourceTransferModel';
import {
  actionKnownRailMoves, actionRailTrSpecs, capsuleTimeline, commitKindForBranch, commitRailPlan, commitWaveSpecs, spendLinkSpecs,
} from '../../src/client/console/consoleActionCommit';

/**
 * PL-001 FOR ACTIONS — «A DIRECT TR OF A BRANCH IS A REWARD OF THE RAIL», swept
 * over the SERVER's own previews of the cards the rule exists for (server
 * runner: the client half is pure). ✓ — the TR flies from its printed icon and
 * ticks on the touchdown (UNMI, Caretaker Contract, Equatorial Magnetizer, the
 * TR branches of Nitrite-Reducing Bacteria and Titan Air-scrapping, Earth Army
 * Contract); ✗ — the TR belongs to a tile or a scale that is still ahead and
 * arrives with it (Aquifer Pumping, Water Import From Europa — their previews
 * print no TR chip at all — and every placement / scale shape the rule names).
 */
type Subject = ICard & IActionCard;

function table(): {p: TestPlayer, cards: Record<string, Subject>} {
  const [game, p] = testGame(2, {coloniesExtension: true, turmoilReduxExpansion: true});
  game.phase = Phase.ACTION;
  p.megaCredits = 30;
  p.heat = 10;
  p.titanium = 5;
  p.production.add(Resource.ENERGY, 2);
  p.hasIncreasedTerraformRatingThisGeneration = true;
  const nitrite = new NitriteReducingBacteria();
  nitrite.resourceCount = 3;
  const titan = new TitanAirScrapping();
  titan.resourceCount = 2;
  const eac = new EarthArmyContract();
  eac.resourceCount = 1;
  p.plants = 4;
  p.steel = 5;
  const cards: Record<string, Subject> = {
    unmi: new UnitedNationsMarsInitiative(), caretaker: new CaretakerContract(), equatorial: new EquatorialMagnetizer(),
    nitrite, titan, aquifer: new AquiferPumping(), europa: new WaterImportFromEuropa(), eac,
    electro: new ElectroCatapult(), mirrors: new SpaceMirrors(),
  };
  Object.values(cards).forEach((card) => p.playedCards.push(card));
  return {p, cards};
}

const branchesOf = (p: TestPlayer, card: Subject): ReadonlyArray<ActionPreviewBranch> => actionPreview(p, card).branches;
const TR = [{channel: 'stock', resource: RATING_RAIL_KEY, amount: 1}];

describe('the action commit\'s rail rule — a DIRECT TR of a branch flies to the rail', () => {
  describe('the sweep over the server\'s own previews', () => {
    const cases: ReadonlyArray<{card: string, branch: number, rail: boolean}> = [
      {card: 'unmi', branch: 0, rail: true},
      {card: 'caretaker', branch: 0, rail: true},
      {card: 'equatorial', branch: 0, rail: true},
      {card: 'nitrite', branch: 0, rail: true},
      {card: 'nitrite', branch: 1, rail: false},
      {card: 'titan', branch: 0, rail: true},
      {card: 'titan', branch: 1, rail: false},
      {card: 'eac', branch: 0, rail: true},
      {card: 'aquifer', branch: 0, rail: false},
      {card: 'europa', branch: 0, rail: false},
    ];
    for (const c of cases) {
      it(`${c.card} · branch ${c.branch}: ${c.rail ? '✓ the TR rides the rail' : '✗ nothing for the rail'}`, () => {
        const {p, cards} = table();
        const branch = branchesOf(p, cards[c.card])[c.branch];
        expect(branch.available, 'the fixture makes the branch available').is.true;
        expect(actionRailTrSpecs(branch)).deep.eq(c.rail ? TR : []);
        if (c.rail) {
          expect(commitKindForBranch(branch), 'the impulse lands on the printed TR (a timeline lands on its first beat)')
            .eq(c.card === 'eac' ? 'resources' : 'rating');
        }
      });
    }
  });

  describe('a TR something AHEAD owns never rides the rail', () => {
    const tr = {direction: 'gain' as const, icon: 'tr', amount: 1};
    const base = {index: 0, title: '', available: true, renderKeys: [], effects: [], steps: []} as unknown as ActionPreviewBranch;
    it('a placement step (the tile pays it)', () => {
      expect(actionRailTrSpecs({...base, effects: [tr], steps: [{kind: 'boardPlacement', placementType: 'ocean'}]} as ActionPreviewBranch)).deep.eq([]);
    });
    for (const scale of ['temperature', 'oxygen', 'venus', 'oceans']) {
      it(`a ${scale} gain (the scale's step pays it)`, () => {
        expect(actionRailTrSpecs({...base, effects: [{direction: 'gain', icon: scale, amount: 1}, tr]})).deep.eq([]);
      });
    }
    it('a draw or a reveal (the workspace hosts that result)', () => {
      expect(actionRailTrSpecs({...base, effects: [{direction: 'gain', icon: 'cards', amount: 1}, tr]})).deep.eq([]);
      expect(actionRailTrSpecs({...base, effects: [tr], reveal: {} as never})).deep.eq([]);
    });
    it('a TR chip with a note is not a direct TR (the historical landing stays)', () => {
      const noted = {...base, effects: [{...tr, note: 'per city'}]};
      expect(actionRailTrSpecs(noted)).deep.eq([]);
      expect(commitKindForBranch(noted)).eq('global');
    });
  });

  describe('the printed row as a timeline (TR28)', () => {
    it('Earth Army Contract at ≥ 1 is a timeline; at 0 it is not; Nitrite\'s and Titan\'s spends are not', () => {
      const {p, cards} = table();
      expect(capsuleTimeline(branchesOf(p, cards.eac)[0])).deep.eq({
        gain: {direction: 'gain', icon: 'fighter', amount: 1, current: 1, resulting: 2, note: 'on this card'},
        spend: {direction: 'cost', icon: 'fighter', amount: 2, current: 2, resulting: 0, note: 'on this card'},
      });
      cards.eac.resourceCount = 0;
      expect(capsuleTimeline(branchesOf(p, cards.eac)[0]), 'at 0 the action is the +1 alone').is.undefined;
      expect(capsuleTimeline(branchesOf(p, cards.nitrite)[0]), 'a spend with no gain before it').is.undefined;
      expect(capsuleTimeline(branchesOf(p, cards.titan)[0])).is.undefined;
      expect(capsuleTimeline(branchesOf(p, cards.titan)[1]), 'a gain with no spend after it').is.undefined;
    });

    it('the rail plan: three links in the printed order — the landing, the two leaving, the TR — and the surface held', () => {
      const {p, cards} = table();
      const branch = branchesOf(p, cards.eac)[0];
      const greens = [{channel: 'stock' as const, resource: 'megacredits', amount: 2}];
      const plan = commitRailPlan(cards.eac.name, branch, {}, greens);
      expect(plan?.reward.cause).deep.eq([
        {channel: 'card-resource', resource: 'fighter', amount: 1, targetCard: cards.eac.name},
        {channel: 'card-resource', resource: 'fighter', amount: 2, targetCard: cards.eac.name, direction: 'loss'},
        {channel: 'stock', resource: RATING_RAIL_KEY, amount: 1},
      ]);
      expect(plan?.links).deep.eq([[0], [1], [2]]);
      expect(plan?.holdsSurface).is.true;
      expect(plan?.reward.reactions).deep.eq(greens);
      expect(commitWaveSpecs(cards.eac.name, branch, {}), 'the landing is the rail\'s first link — never a second chip').deep.eq([]);
    });

    it('UNMI (the rail-spend law, PL-099): the price leaves the rail FIRST, the TR is the last link — the surface held while the card absorbs the price', () => {
      const {p, cards} = table();
      const plan = commitRailPlan(cards.unmi.name, branchesOf(p, cards.unmi)[0], {}, []);
      expect(plan?.reward.cause).deep.eq([{channel: 'stock', resource: 'megacredits', amount: 3, direction: 'loss'}, ...TR]);
      expect(plan?.links).deep.eq([[0], [1]]);
      expect(plan?.spendLinks).deep.eq([0]);
      expect(plan?.holdsSurface).is.true;
      expect(plan?.reward.known, 'the price is the chain\'s own promise, never a «known» move beside it').deep.eq({});
      expect(plan?.capsules).deep.eq([]);
    });

    it('a plain TR with no price: one link, the surface folds at once (a production cost is the plate\'s own number)', () => {
      const {p, cards} = table();
      const plan = commitRailPlan(cards.equatorial.name, branchesOf(p, cards.equatorial)[0], {}, []);
      expect(plan?.reward.cause).deep.eq(TR);
      expect(plan?.links).deep.eq([[0]]);
      expect(plan?.holdsSurface).is.false;
      expect(plan?.reward.known).deep.eq({'production:energy': -1});
    });

    it('a price before a TILE (Aquifer Pumping, Water Import): the price alone is the rail half — one link, the surface held until the card has absorbed it; nothing else', () => {
      const {p, cards} = table();
      // With steel in hand Aquifer Pumping's price becomes a PAYMENT step (steel may pay it) — the Europa shape
      // below; without it the price is a plain cost chip, the shape asserted here.
      p.steel = 0;
      const aquifer = commitRailPlan(cards.aquifer.name, branchesOf(p, cards.aquifer)[0], {}, []);
      expect(aquifer?.reward.cause).deep.eq([{channel: 'stock', resource: 'megacredits', amount: 8, direction: 'loss'}]);
      expect(aquifer?.links).deep.eq([[0]]);
      expect(aquifer?.holdsSurface).is.true;
      expect(aquifer?.reward.known).deep.eq({});
      // Water Import prints NO cost chip — its price is the payment STEP; before the step is answered there is
      // nothing to fly, after it the captured payment's rows are the price (steel and titanium count here).
      const europa = branchesOf(p, cards.europa)[0];
      expect(commitRailPlan(cards.europa.name, europa, {}, []), 'no answer yet — no link').is.undefined;
      const paid = commitRailPlan(cards.europa.name, europa, {0: {type: 'payment', payment: {megacredits: 9, titanium: 1}}}, []);
      expect(paid?.reward.cause).deep.eq([
        {channel: 'stock', resource: 'megacredits', amount: 9, direction: 'loss'},
        {channel: 'stock', resource: 'titanium', amount: 1, direction: 'loss'},
      ]);
      expect(paid?.links).deep.eq([[0], [1]]);
      expect(paid?.reward.known).deep.eq({});
    });

    it('no rail half for a branch without a direct TR, a timeline, a price, a spend or a gain on the card itself', () => {
      const free = {index: 0, title: '', available: true, renderKeys: [], steps: [], effects: [{direction: 'gain', icon: 'cards', amount: 1}]} as unknown as ActionPreviewBranch;
      expect(commitRailPlan(CardName.INVENTORS_GUILD, free, {}, [])).is.undefined;
    });

    /**
     * PL-063: «+N на эту карту» with nothing spent before it lands in the HERO's capsule (the card standing in the
     * composer), never in the board's satellite over a folding workspace: one link, the surface held to its
     * touchdown, the capsule held until then, no second chip in the wave. Earth Army Contract at 0 is exactly that
     * (its timeline needs a fighter to spend).
     */
    it('a gain on THIS card: one link into the hero\'s capsule, the surface held (Titan — after its titanium leaves, PL-099 · EAC at 0)', () => {
      const {p, cards} = table();
      const titan = branchesOf(p, cards.titan)[1];
      const plan = commitRailPlan(cards.titan.name, titan, {}, []);
      // The titanium price is the chain's FIRST link now (PL-099); the floaters follow it into the capsule.
      expect(plan?.reward.cause).deep.eq([
        {channel: 'stock', resource: 'titanium', amount: 1, direction: 'loss'},
        {channel: 'card-resource', resource: 'floater', amount: 2, targetCard: cards.titan.name},
      ]);
      expect(plan?.links).deep.eq([[0], [1]]);
      expect(plan?.holdsSurface, 'the workspace stands to the touchdown').is.true;
      expect(plan?.capsules).deep.eq([cards.titan.name]);
      expect(plan?.reward.known, 'the titanium price is the chain\'s own promise now').deep.eq({});
      expect(commitWaveSpecs(cards.titan.name, titan, {}, plan), 'never a second floater chip in the wave').deep.eq([]);

      cards.eac.resourceCount = 0;
      const eac = commitRailPlan(cards.eac.name, branchesOf(p, cards.eac)[0], {}, []);
      expect(eac?.reward.cause[0]).deep.eq({channel: 'card-resource', resource: 'fighter', amount: 1, targetCard: cards.eac.name});
      expect(eac?.holdsSurface).is.true;
      expect(commitRailPlan(cards.titan.name, titan, {}, [], {departsElsewhere: true}), 'another scene owns that flow').is.undefined;
    });
  });

  describe('the branch\'s known moves — what the diff check allows beside the reward', () => {
    it('UNMI: −3 M€ (the cost); Caretaker: −8 heat; Equatorial: −1 energy production', () => {
      const {p, cards} = table();
      expect(actionKnownRailMoves(branchesOf(p, cards.unmi)[0])).deep.eq({'stock:megacredits': -3});
      expect(actionKnownRailMoves(branchesOf(p, cards.caretaker)[0])).deep.eq({'stock:heat': -8});
      expect(actionKnownRailMoves(branchesOf(p, cards.equatorial)[0])).deep.eq({'production:energy': -1});
    });

    it('a captured payment replaces the M€ cost it settles (Helion paying with heat)', () => {
      const {p, cards} = table();
      const branch = branchesOf(p, cards.unmi)[0];
      expect(actionKnownRailMoves(branch, {0: {type: 'payment', payment: {megacredits: 1, heat: 2}}}))
        .deep.eq({'stock:megacredits': -1, 'stock:heat': -2});
    });

    it('a card resource is not a rail row', () => {
      const {p, cards} = table();
      expect(actionKnownRailMoves(branchesOf(p, cards.eac)[0])).deep.eq({});
    });
  });

  /*
   * PL-064 IN GENERAL — «A SPEND IS A DEPARTURE FROM ITS REAL SOURCE» (TR29): the losses a branch takes off a CARD
   * before its result fly FROM that card, and the result is born where the spend landed. Swept over the server's own
   * previews: TR29 A / B (the source a card-level step chose) ✓, Nitrite's and Titan Air-scrapping's TR branches
   * (the hero's own capsule) ✓, Ants with a source of the viewer's own ✓; Ants taking from another seat ✗ (an
   * attack's business), Earth Army Contract ✗ (a timeline already owns its spend), Formula Zero / Security Fleet ✗
   * (a stock price, no card spent).
   */
  describe('the SPEND — a departure from its real source (PL-064, TR29)', () => {
    function spendTable() {
      const [game, p, rival] = testGame(2, {coloniesExtension: true, turmoilReduxExpansion: true});
      game.phase = Phase.ACTION;
      p.megaCredits = 30;
      p.titanium = 5;
      const recycling = new SpaceshipRecycling();
      recycling.resourceCount = 2;
      const formula = new FormulaZero();
      formula.resourceCount = 1;
      const eva = new EvaMechs();
      const sports = new MechSports();
      const nitrite = new NitriteReducingBacteria();
      nitrite.resourceCount = 3;
      const titan = new TitanAirScrapping();
      titan.resourceCount = 2;
      const eac = new EarthArmyContract();
      eac.resourceCount = 1;
      const ants = new Ants();
      const decomposers = new Decomposers();
      decomposers.resourceCount = 2;
      const fleet = new SecurityFleet();
      p.playedCards.push(recycling, formula, eva, sports, nitrite, titan, eac, ants, decomposers, fleet);
      const tardigrades = new Tardigrades();
      tardigrades.resourceCount = 1;
      rival.playedCards.push(tardigrades);
      const own = (name: CardName) => p.playedCards.has(name);
      return {p, recycling, formula, eva, sports, nitrite, titan, eac, ants, decomposers, tardigrades, fleet, own};
    }
    const fighterSource = (card: CardName) => ({0: {type: 'card', cards: [card]}});
    const loss = (resource: string, amount: number, targetCard: CardName) =>
      ({channel: 'card-resource', resource, amount, targetCard, direction: 'loss'});

    it('TR29 A — the fighter leaves the card the SOURCE STEP chose; the titanium is the chain\'s last link, never a wave chip', () => {
      const t = spendTable();
      const preview = actionPreview(t.p, t.recycling);
      const [a] = preview.branches;
      const ctx = {preSteps: preview.preSteps, preResponses: fighterSource(t.formula.name), ownCard: t.own};
      expect(spendLinkSpecs(t.recycling.name, a, {}, ctx)).deep.eq([loss('fighter', 1, t.formula.name)]);
      const plan = commitRailPlan(t.recycling.name, a, {}, [], ctx);
      expect(plan?.reward.cause).deep.eq([loss('fighter', 1, t.formula.name), {channel: 'stock', resource: 'titanium', amount: 2}]);
      expect(plan?.links, 'the spend, then the result — link 2 starts on link 1\'s touchdown').deep.eq([[0], [1]]);
      expect(plan?.spendLinks).deep.eq([0]);
      expect(plan?.holdsSurface, 'the source stands on the surface').is.true;
      expect(plan?.capsules).deep.eq([t.formula.name]);
      expect(plan?.reward.vp, 'Formula Zero\'s point leaves WITH its fighter').deep.eq([-1, 0]);
      expect(plan?.reward.known, 'the titanium is the chain\'s promise, never a «known» move beside it').deep.eq({});
      expect(commitWaveSpecs(t.recycling.name, a, {}, plan), 'no second titanium chip in the wave').deep.eq([]);
      expect(commitKindForBranch(a)).eq('resources');
    });

    it('TR29 A from THIS card — the hero\'s own capsule is the source', () => {
      const t = spendTable();
      const preview = actionPreview(t.p, t.recycling);
      const ctx = {preSteps: preview.preSteps, preResponses: fighterSource(t.recycling.name), ownCard: t.own};
      const plan = commitRailPlan(t.recycling.name, preview.branches[0], {}, [], ctx);
      expect(plan?.reward.cause[0]).deep.eq(loss('fighter', 1, t.recycling.name));
      expect(plan?.capsules).deep.eq([t.recycling.name]);
      expect(plan?.reward.vp, 'no VP on either card').is.undefined;
    });

    it('TR29 B — the spend, then the mech onto the card the TARGET step chose (its VP with it)', () => {
      const t = spendTable();
      const preview = actionPreview(t.p, t.recycling);
      const b = preview.branches[1];
      expect(b.available).is.true;
      const ctx = {preSteps: preview.preSteps, preResponses: fighterSource(t.formula.name), ownCard: t.own};
      const plan = commitRailPlan(t.recycling.name, b, {0: {type: 'card', cards: [t.sports.name]}}, [], ctx);
      expect(plan?.reward.cause).deep.eq([
        loss('fighter', 1, t.formula.name),
        {channel: 'card-resource', resource: 'mech', amount: 1, targetCard: t.sports.name},
      ]);
      expect(plan?.links).deep.eq([[0], [1]]);
      expect(plan?.capsules, 'the source and the target both stand in the composer\'s rows').deep.eq([t.formula.name, t.sports.name]);
      expect(plan?.reward.vp, 'Formula Zero −1 at the departure, Mech Sports +1 at the touchdown').deep.eq([-1, 1]);
      expect(commitWaveSpecs(t.recycling.name, b, {0: {type: 'card', cards: [t.sports.name]}}, plan)).deep.eq([]);
    });

    it('Nitrite-Reducing Bacteria\'s TR branch — «−3 here», then the TR born under its ring', () => {
      const t = spendTable();
      const branch = branchesOf(t.p, t.nitrite)[0];
      const plan = commitRailPlan(t.nitrite.name, branch, {}, [], {ownCard: t.own});
      expect(plan?.reward.cause).deep.eq([loss('microbe', 3, t.nitrite.name), ...TR]);
      expect(plan?.links).deep.eq([[0], [1]]);
      expect(plan?.capsules).deep.eq([t.nitrite.name]);
      expect(commitKindForBranch(branch), 'the impulse still lands on the printed TR').eq('rating');
    });

    it('Titan Air-scrapping\'s TR branch — «−2 here», then the TR', () => {
      const t = spendTable();
      const plan = commitRailPlan(t.titan.name, branchesOf(t.p, t.titan)[0], {}, [], {ownCard: t.own});
      expect(plan?.reward.cause).deep.eq([loss('floater', 2, t.titan.name), ...TR]);
      expect(plan?.spendLinks).deep.eq([0]);
    });

    it('Ants — a source of the viewer\'s OWN is a departure; another seat\'s card is not (an attack)', () => {
      const t = spendTable();
      const branch = branchesOf(t.p, t.ants)[0];
      expect(spendLinkSpecs(t.ants.name, branch, {0: {type: 'card', cards: [t.decomposers.name]}}, {ownCard: t.own}))
        .deep.eq([loss('microbe', 1, t.decomposers.name)]);
      expect(spendLinkSpecs(t.ants.name, branch, {0: {type: 'card', cards: [t.tardigrades.name]}}, {ownCard: t.own})).deep.eq([]);
    });

    it('✗ — a timeline owns its spend (Earth Army Contract); a stock price spends no CARD — it leaves the RAIL (Formula Zero\'s 1 M€, Security Fleet\'s titanium — PL-099)', () => {
      const t = spendTable();
      expect(spendLinkSpecs(t.eac.name, branchesOf(t.p, t.eac)[0], {}, {ownCard: t.own})).deep.eq([]);
      expect(spendLinkSpecs(t.formula.name, branchesOf(t.p, t.formula)[0], {}, {ownCard: t.own}))
        .deep.eq([{channel: 'stock', resource: 'megacredits', amount: 1, direction: 'loss'}]);
      expect(spendLinkSpecs(t.fleet.name, branchesOf(t.p, t.fleet)[0], {}, {ownCard: t.own}))
        .deep.eq([{channel: 'stock', resource: 'titanium', amount: 1, direction: 'loss'}]);
      // …and the fighter is the chain's LAST link, born after the titanium has been absorbed — into the hero's capsule.
      const fleet = commitRailPlan(t.fleet.name, branchesOf(t.p, t.fleet)[0], {}, [], {ownCard: t.own});
      expect(fleet?.links).deep.eq([[0], [1]]);
      expect(fleet?.reward.cause[1]).deep.eq({channel: 'card-resource', resource: 'fighter', amount: 1, targetCard: t.fleet.name});
      expect(fleet?.holdsSurface).is.true;
    });

    it('a spend whose departure another scene owns is no link (TR15\'s vote: the data leave WITH the cube)', () => {
      const t = spendTable();
      const branch = branchesOf(t.p, t.nitrite)[0];
      expect(spendLinkSpecs(t.nitrite.name, branch, {}, {ownCard: t.own, departsElsewhere: true})).deep.eq([]);
      const plan = commitRailPlan(t.nitrite.name, branch, {}, [], {ownCard: t.own, departsElsewhere: true});
      expect(plan?.reward.cause, 'the TR still rides the rail — only the spend is somebody else\'s').deep.eq([...TR]);
      expect(plan?.spendLinks).is.undefined;
      expect(plan?.capsules, 'no capsule held: the scene that owns the departure holds it').deep.eq([]);
    });

    it('a spend with no answered source yet holds nothing (the pick is still open)', () => {
      const t = spendTable();
      const preview = actionPreview(t.p, t.recycling);
      expect(spendLinkSpecs(t.recycling.name, preview.branches[0], {}, {preSteps: preview.preSteps, preResponses: {}, ownCard: t.own})).deep.eq([]);
    });
  });

  /**
   * THE PRICE ON THE RAIL IS A DEPARTURE TOO (the owner's decision 2026-10-08, PL-099): a stock cost of the
   * branch is a link of its own — born on its row, absorbed at the printed cost icon, the row ticking on the
   * departure — and the result is the chain's last link. Swept over the server's own previews.
   */
  describe('the PRICE on the rail — a departure from its row (PL-099)', () => {
    const loss = (resource: string, amount: number) => ({channel: 'stock', resource, amount, direction: 'loss'});

    it('Electro Catapult: the plant (branch 0) or the steel (branch 1) leaves first; the 7 M€ are the last link; the wave flies nothing', () => {
      const {p, cards} = table();
      const [plant, steel] = branchesOf(p, cards.electro);
      expect(spendLinkSpecs(cards.electro.name, plant)).deep.eq([loss('plants', 1)]);
      expect(spendLinkSpecs(cards.electro.name, steel)).deep.eq([loss('steel', 1)]);
      const plan = commitRailPlan(cards.electro.name, plant, {}, [])!;
      expect(plan.reward.cause).deep.eq([loss('plants', 1), {channel: 'stock', resource: 'megacredits', amount: 7}]);
      expect(plan.links).deep.eq([[0], [1]]);
      expect(plan.spendLinks).deep.eq([0]);
      expect(plan.holdsSurface, 'the card absorbs the price — the surface stands to it').is.true;
      expect(plan.reward.known, 'both rows are the chain\'s own promise').deep.eq({});
      expect(commitWaveSpecs(cards.electro.name, plant, {}, plan), 'the 7 M€ ride the chain — never a second chip').deep.eq([]);
      expect(commitKindForBranch(plant)).eq('resources');
    });

    it('Space Mirrors: the 7 M€ leave first, the energy PRODUCTION is the last link', () => {
      const {p, cards} = table();
      const branch = branchesOf(p, cards.mirrors)[0];
      const plan = commitRailPlan(cards.mirrors.name, branch, {}, [])!;
      expect(plan.reward.cause).deep.eq([loss('megacredits', 7), {channel: 'production', resource: 'energy', amount: 1}]);
      expect(plan.links).deep.eq([[0], [1]]);
      expect(plan.reward.known).deep.eq({});
    });

    it('Caretaker Contract: the 8 heat leave first, the TR after (two links, the surface held)', () => {
      const {p, cards} = table();
      const plan = commitRailPlan(cards.caretaker.name, branchesOf(p, cards.caretaker)[0], {}, [])!;
      expect(plan.reward.cause).deep.eq([loss('heat', 8), ...TR]);
      expect(plan.links).deep.eq([[0], [1]]);
      expect(plan.holdsSurface).is.true;
    });

    it('a price a PAYMENT step settled leaves from the rows the player actually paid from — each its own token, the M€ chip never twice', () => {
      const {p, cards} = table();
      const branch = branchesOf(p, cards.unmi)[0];
      const paid = {0: {type: 'payment', payment: {megacredits: 1, heat: 2}}};
      expect(spendLinkSpecs(cards.unmi.name, branch, paid)).deep.eq([loss('megacredits', 1), loss('heat', 2)]);
      const plan = commitRailPlan(cards.unmi.name, branch, paid, [])!;
      expect(plan.links).deep.eq([[0], [1], [2]]);
      expect(plan.reward.known, 'the payment\'s rows are the chain\'s promise too').deep.eq({});
    });

    it('a production cost is the plate\'s own number, never a token (Equatorial Magnetizer)', () => {
      const {p, cards} = table();
      expect(spendLinkSpecs(cards.equatorial.name, branchesOf(p, cards.equatorial)[0])).deep.eq([]);
    });
  });
});

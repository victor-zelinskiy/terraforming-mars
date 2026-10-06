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
import {Resource} from '../../src/common/Resource';
import {Phase} from '../../src/common/Phase';
import {ActionPreviewBranch} from '../../src/common/models/ActionPreviewModel';
import {RATING_RAIL_KEY} from '../../src/client/console/resourceTransfer/resourceTransferModel';
import {
  actionKnownRailMoves, actionRailTrSpecs, capsuleTimeline, commitKindForBranch, commitRailPlan, commitWaveSpecs,
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
  const cards: Record<string, Subject> = {
    unmi: new UnitedNationsMarsInitiative(), caretaker: new CaretakerContract(), equatorial: new EquatorialMagnetizer(),
    nitrite, titan, aquifer: new AquiferPumping(), europa: new WaterImportFromEuropa(), eac,
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

    it('a plain TR: one link, the surface folds at once', () => {
      const {p, cards} = table();
      const plan = commitRailPlan(cards.unmi.name, branchesOf(p, cards.unmi)[0], {}, []);
      expect(plan?.reward.cause).deep.eq(TR);
      expect(plan?.links).deep.eq([[0]]);
      expect(plan?.holdsSurface).is.false;
    });

    it('no rail half for a branch without a direct TR or a timeline', () => {
      const {p, cards} = table();
      expect(commitRailPlan(cards.titan.name, branchesOf(p, cards.titan)[1], {}, [])).is.undefined;
      expect(commitRailPlan(cards.aquifer.name, branchesOf(p, cards.aquifer)[0], {}, [])).is.undefined;
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
});

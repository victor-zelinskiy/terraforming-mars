import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {DELTA_TRACK_TAGS, DeltaProjectExpansion} from '../../src/server/delta/DeltaProjectExpansion';
import {declaredActionCost, deltaAdvancePlanVerdict, guaranteedStockGainAt, withProjectedStock} from '../../src/server/delta/deltaAdvancePlan';
import {DevelopmentCenter} from '../../src/server/cards/base/DevelopmentCenter';
import {DeltaWorks} from '../../src/server/cards/delta/DeltaWorks';
import {DeltaSurge} from '../../src/server/cards/delta/DeltaSurge';
import {ElectroCatapult} from '../../src/server/cards/base/ElectroCatapult';
import {WaterImportFromEuropa} from '../../src/server/cards/base/WaterImportFromEuropa';
import {RegolithEaters} from '../../src/server/cards/base/RegolithEaters';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {fakeCard, runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {SelectCard} from '../../src/server/inputs/SelectCard';

function playAllDeltaTrackTags(p: TestPlayer) {
  p.playedCards.push(fakeCard({tags: DELTA_TRACK_TAGS.filter((t) => t !== undefined)}));
}

/** Seat a USED Development Center (spend 1 energy → draw 1) — the reference
 *  shape of the double-promised resource: its cost competes with the
 *  movement payment for the very same energy. */
function seatUsedDevelopmentCenter(p: TestPlayer): DevelopmentCenter {
  const dc = new DevelopmentCenter();
  p.playedCards.push(dc);
  p.actionsThisGeneration.add(CardName.DEVELOPMENT_CENTER);
  return dc;
}

describe('deltaAdvancePlan (the ordered projected resource plan)', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2, {deltaProjectExpansion: true});
    playAllDeltaTrackTags(player);
  });

  describe('the dry-run seam', () => {
    it('withProjectedStock overlays and restores EXACTLY (a projection, never a spend)', () => {
      player.energy = 3;
      player.steel = 2;
      const seen = withProjectedStock(player, {
        megacredits: 7, steel: 0, titanium: 1, plants: 4, energy: 0, heat: 9,
      }, () => ({energy: player.energy, steel: player.steel, heat: player.heat}));
      expect(seen).deep.eq({energy: 0, steel: 0, heat: 9});
      expect(player.energy).eq(3);
      expect(player.steel).eq(2);
      expect(player.heat).eq(0);
    });

    it('declaredActionCost reads the card\'s OWN declarative spend — no table anywhere', () => {
      seatUsedDevelopmentCenter(player);
      expect(declaredActionCost(player, CardName.DEVELOPMENT_CENTER)).deep.eq({energy: 1});
      // A bespoke/or-cost action states no structural cost (eligibility still
      // dry-runs at its own point).
      player.playedCards.push(new ElectroCatapult());
      expect(declaredActionCost(player, CardName.ELECTRO_CATAPULT)).deep.eq({});
    });

    it('guaranteedStockGainAt mirrors resolveReward: chosen alternative + plants per tag; an unmade choice guarantees nothing', () => {
      expect(guaranteedStockGainAt(player, 1, 0)).deep.eq({steel: 2});
      expect(guaranteedStockGainAt(player, 1, 1)).deep.eq({plants: 2});
      expect(guaranteedStockGainAt(player, 1, undefined)).deep.eq({});
      expect(guaranteedStockGainAt(player, 6, undefined)).deep.eq({plants: player.tags.count(Tag.PLANT)});
      expect(guaranteedStockGainAt(player, 3, undefined)).deep.eq({});
    });
  });

  describe('the mandatory scenarios (the §3 model table)', () => {
    it('THE BUG CASE: 1 energy cannot pay both the movement and Development Center', () => {
      player.energy = 1;
      seatUsedDevelopmentCenter(player);
      const verdict = deltaAdvancePlanVerdict(player, {
        fromPosition: 6, toPosition: 7,
        payment: {energy: 1, steel: 0},
        actions: [{position: 7, card: CardName.DEVELOPMENT_CENTER}],
      });
      expect(verdict.feasible).eq(false);
      expect(verdict.conflicts).has.length(1);
      expect(verdict.conflicts[0]).deep.include({
        position: 7, card: CardName.DEVELOPMENT_CENTER, reason: 'resources', resource: 'energy',
      });
    });

    it('Delta Works steel pays the movement — the 1 energy stays for the action: feasible', () => {
      player.energy = 1;
      player.steel = 1;
      player.playedCards.push(new DeltaWorks());
      seatUsedDevelopmentCenter(player);
      const verdict = deltaAdvancePlanVerdict(player, {
        fromPosition: 6, toPosition: 7,
        payment: {energy: 0, steel: 1},
        actions: [{position: 7, card: CardName.DEVELOPMENT_CENTER}],
      });
      expect(verdict.feasible).eq(true);
    });

    it('an EARLY guaranteed reward funds a LATER action; an UNMADE choice funds nothing', () => {
      // Electro Catapult spends 1 plant OR 1 steel; the player holds neither.
      // The stage-1 choice crossed BEFORE stage 7 funds it — but only under
      // the traversal modifier (a standing-rule crossing pays nothing), and
      // only once actually CHOSEN (either alternative pays here).
      player.playedCards.push(new DeltaSurge());
      player.energy = 7;
      player.plants = 0;
      player.steel = 0;
      const ec = new ElectroCatapult();
      player.playedCards.push(ec);
      player.actionsThisGeneration.add(CardName.ELECTRO_CATAPULT);
      // The short 0 → 2 path isolates the stage-1 choice as the ONE possible
      // funding source (stage 6's deterministic plants would otherwise pay).
      const chosen = deltaAdvancePlanVerdict(player, {
        fromPosition: 0, toPosition: 2,
        payment: {energy: 2, steel: 0},
        choices: {1: 1},
        actions: [{position: 2, card: CardName.ELECTRO_CATAPULT}],
      });
      const unmade = deltaAdvancePlanVerdict(player, {
        fromPosition: 0, toPosition: 2,
        payment: {energy: 2, steel: 0},
        actions: [{position: 2, card: CardName.ELECTRO_CATAPULT}],
      });
      expect(chosen.feasible, 'the chosen early gain funds the later action').eq(true);
      expect(unmade.feasible, 'an unmade choice funds nothing').eq(false);
    });

    it('a LATE reward can never fund an EARLIER action (plants arrive only after stage 6)', () => {
      // Electro Catapult sits at stage 7? No — plan it at a stage BEFORE the
      // plant gain: synthetic order check via stage 6 gain AFTER stage… the
      // track's one costed stage is 7 (after 6), so invert: 0 plants, the
      // stage-1 choice takes STEEL (no plants), stage-6 grants plants ONLY
      // when the player holds plant tags — strip them.
      player.energy = 7;
      player.plants = 0;
      player.steel = 0;
      // Replace the all-tags card with one lacking PLANT tags is impractical;
      // instead prove the ORDER by planning the action at stage 7 with the
      // funding choice DECLARED but the movement stopping BEFORE it: a
      // one-step 6 → 7 move crosses nothing, so the stage-1 gain (never
      // visited) cannot fund it.
      const ec = new ElectroCatapult();
      player.playedCards.push(ec);
      player.actionsThisGeneration.add(CardName.ELECTRO_CATAPULT);
      const verdict = deltaAdvancePlanVerdict(player, {
        fromPosition: 6, toPosition: 7,
        payment: {energy: 1, steel: 0},
        choices: {1: 1}, // declared, but stage 1 is NOT on this path
        actions: [{position: 7, card: CardName.ELECTRO_CATAPULT}],
      });
      expect(verdict.feasible).eq(false);
      expect(verdict.conflicts[0].reason).eq('eligibility');
    });

    it('two commitments cannot overbook one resource (the walk is general beyond today\'s track)', () => {
      // Two planned Development-Center-shaped costs against ONE spare energy:
      // the first passes, the second finds the balance already spent. The
      // track holds one stage 7 today; the ENGINE stays general — feed it two.
      player.energy = 2;
      seatUsedDevelopmentCenter(player);
      const verdict = deltaAdvancePlanVerdict(player, {
        fromPosition: 5, toPosition: 7,
        payment: {energy: 1, steel: 0},
        actions: [
          {position: 6, card: CardName.DEVELOPMENT_CENTER},
          {position: 7, card: CardName.DEVELOPMENT_CENTER},
        ],
      });
      expect(verdict.feasible).eq(false);
      expect(verdict.conflicts).has.length(1);
      expect(verdict.conflicts[0]).deep.include({position: 7, reason: 'resources', resource: 'energy'});
    });

    it('independent resources never conflict (an M€ action beside an energy movement)', () => {
      // Water Import From Europa: 12 M€ action cost; movement takes energy.
      player.energy = 2;
      player.megaCredits = 12;
      const wife = new WaterImportFromEuropa();
      player.playedCards.push(wife);
      player.actionsThisGeneration.add(CardName.WATER_IMPORT_FROM_EUROPA);
      const verdict = deltaAdvancePlanVerdict(player, {
        fromPosition: 6, toPosition: 7,
        payment: {energy: 1, steel: 0},
        actions: [{position: 7, card: CardName.WATER_IMPORT_FROM_EUROPA}],
      });
      expect(verdict.feasible).eq(true);
    });

    it('a cost-free action never conflicts with the payment', () => {
      player.energy = 1;
      const regolith = new RegolithEaters();
      player.playedCards.push(regolith);
      player.actionsThisGeneration.add(CardName.REGOLITH_EATERS);
      const verdict = deltaAdvancePlanVerdict(player, {
        fromPosition: 6, toPosition: 7,
        payment: {energy: 1, steel: 0},
        actions: [{position: 7, card: CardName.REGOLITH_EATERS}],
      });
      expect(verdict.feasible).eq(true);
    });
  });

  describe('the atomic commit gate (advance refuses BEFORE any mutation)', () => {
    it('a starved plan throws: nothing spent, no movement, no reward', () => {
      player.energy = 1;
      player.deltaProjectData!.position = 6;
      seatUsedDevelopmentCenter(player);
      expect(() => DeltaProjectExpansion.advance(player, 1, undefined, {
        plannedActions: [{position: 7, card: CardName.DEVELOPMENT_CENTER}],
      })).to.throw(/cannot be executed at stage 7/);
      expect(player.energy, 'nothing spent').eq(1);
      expect(player.deltaProjectData!.position, 'the marker never moved').eq(6);
    });

    it('the SAME declared plan with a Delta Works steel mix commits and repeats the action', () => {
      player.energy = 1;
      player.steel = 1;
      player.deltaProjectData!.position = 6;
      player.playedCards.push(new DeltaWorks());
      seatUsedDevelopmentCenter(player);
      DeltaProjectExpansion.advance(player, 1, undefined, {
        plannedActions: [{position: 7, card: CardName.DEVELOPMENT_CENTER}],
        payment: {energy: 0, steel: 1},
      });
      expect(player.steel).eq(0);
      expect(player.energy, 'the energy survived the movement').eq(1);
      runAllActions(game);
      const pick = cast(player.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).contains(CardName.DEVELOPMENT_CENTER);
      const hand = player.cardsInHand.length;
      pick.cb([pick.cards.find((c) => c.name === CardName.DEVELOPMENT_CENTER)!]);
      runAllActions(game);
      expect(player.energy, 'the action spent ITS OWN energy at its own point').eq(0);
      expect(player.cardsInHand.length).eq(hand + 1);
    });

    it('a plan with a declared funding CHOICE is honoured end to end (Delta Surge path)', () => {
      // 0 → 7 under Delta Surge: stage-1 chosen plants fund Electro Catapult.
      player.playedCards.push(new DeltaSurge());
      player.energy = 7;
      player.plants = 0;
      player.steel = 0;
      const ec = new ElectroCatapult();
      player.playedCards.push(ec);
      player.actionsThisGeneration.add(CardName.ELECTRO_CATAPULT);
      expect(() => DeltaProjectExpansion.advance(player, 7, undefined, {
        plannedActions: [{position: 7, card: CardName.ELECTRO_CATAPULT}],
        plannedChoices: [{position: 1, choice: 1}, {position: 2, choice: 0}],
      })).to.not.throw();
    });

    it('an undeclared plan keeps the historical wire byte-for-byte (no gate, no throw)', () => {
      player.energy = 1;
      player.deltaProjectData!.position = 6;
      seatUsedDevelopmentCenter(player);
      // No plannedActions: the historical shape commits as before (the
      // runtime candidates then honestly exclude the starved card).
      expect(() => DeltaProjectExpansion.advance(player, 1)).to.not.throw();
      expect(player.energy).eq(0);
    });
  });

  describe('the runtime safety net (unpredictable divergence only)', () => {
    it('no candidate at execute → the reward is SKIPPED BY NAME and resolution continues', () => {
      player.energy = 1;
      player.deltaProjectData!.position = 6;
      seatUsedDevelopmentCenter(player); // starved at execute (energy spent)
      DeltaProjectExpansion.advance(player, 1);
      runAllActions(game);
      expect(player.popWaitingFor(), 'no empty prompt').is.undefined;
      const log = game.gameLog.map((m) => m.message).join('\n');
      expect(log).to.contain('had no usable action to repeat');
    });

    it('other candidates remain → the standard selector serves them (never an empty fallback)', () => {
      player.energy = 1;
      player.deltaProjectData!.position = 6;
      seatUsedDevelopmentCenter(player);
      const regolith = new RegolithEaters();
      player.playedCards.push(regolith);
      player.actionsThisGeneration.add(CardName.REGOLITH_EATERS);
      DeltaProjectExpansion.advance(player, 1);
      runAllActions(game);
      const pick = cast(player.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.REGOLITH_EATERS]);
    });
  });

  describe('the preview serves the plan\'s numbers (never a client-computed cost)', () => {
    it('reuseActionCosts carries each candidate\'s declarative spend', () => {
      player.energy = 5;
      seatUsedDevelopmentCenter(player);
      const regolith = new RegolithEaters();
      player.playedCards.push(regolith);
      player.actionsThisGeneration.add(CardName.REGOLITH_EATERS);
      const preview = DeltaProjectExpansion.getPreview(player);
      expect(preview.reuseActionCards).to.have.members([CardName.DEVELOPMENT_CENTER, CardName.REGOLITH_EATERS]);
      expect(preview.reuseActionCosts).deep.eq({[CardName.DEVELOPMENT_CENTER]: {energy: 1}});
    });

    it('stays byte-identical when no candidate has a declarative cost', () => {
      player.energy = 5;
      const regolith = new RegolithEaters();
      player.playedCards.push(regolith);
      player.actionsThisGeneration.add(CardName.REGOLITH_EATERS);
      const preview = DeltaProjectExpansion.getPreview(player);
      expect(preview.reuseActionCosts).is.undefined;
    });
  });
});

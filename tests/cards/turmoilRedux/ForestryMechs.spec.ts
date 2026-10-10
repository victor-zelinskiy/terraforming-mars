import {expect} from 'chai';
import {
  ENERGY_PER_MECH, FORESTRY_MECHS_ADD_TITLE, FORESTRY_MECHS_STEP_TITLE, ForestryMechs, MECHS_ON_PLAY, MECHS_PER_STEP,
} from '../../../src/server/cards/turmoilRedux/ForestryMechs';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {ConstructionMechs} from '../../../src/server/cards/turmoilRedux/ConstructionMechs';
import {MechSports} from '../../../src/server/cards/turmoilRedux/MechSports';
import {MarsArmyMechs} from '../../../src/server/cards/turmoilRedux/MarsArmyMechs';
import {AutomatedConvoys, TradeWithAutomatedConvoys} from '../../../src/server/cards/turmoilRedux/AutomatedConvoys';
import {AdministrationDistrict} from '../../../src/server/cards/turmoilRedux/AdministrationDistrict';
import {Decomposers} from '../../../src/server/cards/base/Decomposers';
import {Vesta} from '../../../src/server/colonies/Vesta';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {AutomaResolver} from '../../../src/server/automa/AutomaResolver';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Resource} from '../../../src/common/Resource';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {CARD_FOR_SPENDABLE_RESOURCE} from '../../../src/common/inputs/Spendable';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForAction} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {AddResourcesToCard} from '../../../src/server/deferredActions/AddResourcesToCard';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {ICard} from '../../../src/server/cards/ICard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, formatMessage, runAllActions} from '../../TestingUtils';

/**
 * TR40 — FORESTRY MECHS: the Greens' third plate, the mechs' SIXTH holder,
 * and the set's first `or`-action that is ONE DECLARATION of the Local
 * Shading class — TR34 Mars Army Mechs' A (1 energy → a mech here) beside
 * TR38 Biological Simulations' B (a stored resource → +1 plant production).
 * Every rule reading of the card file's header is pinned here: the plate's
 * two roads (the starting rule counts; TR36 does not help), the play's one
 * mech, the two variants and what the ENGINE answers for each configuration
 * (both live → `OrOptions`, one live → no question, both dead → the energy
 * first), the Greens' answer at the moment of the press, the mechs here as
 * ordinary mechs that are nobody's money / VP / delegates / trade, the tags
 * that wake the neighbours — and what does NOT fire (TR16).
 */
const G = PartyName.GREENS;
const COST = 7;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: ForestryMechs};

/** A two-seat Redux table in the action phase: generation 1, nothing enacted — the Greens rule by the STARTING RULE. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const card = new ForestryMechs();
  return {game, player, opponent, parliament: game.parliament!, card};
}

/** The Reds rule by an enacted card — the Greens' effect is nobody's by the ruling road. */
function redsRule(t: Table): Table {
  seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
  expect(t.parliament.rulingParty()).eq(PartyName.REDS);
  return t;
}

/** `n` of `player`'s own cubes on the Greens' quiet resolution in slot 0 (the lobby's free one first, the rest from the reserve). */
function greensCubes(t: Table, player: TestPlayer, n: number): void {
  let slot = t.parliament.slotOf(G);
  if (slot === undefined) {
    seatResolution(t.parliament, 0, quietResolutionOf(G));
    slot = t.parliament.slotOf(G)!;
  }
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

/** The card on the player's table with `mechs` here and the player at `energy`. */
function owned(t: Table, mechs: number, energy: number): Table {
  t.player.playedCards.push(t.card);
  t.card.resourceCount = mechs;
  t.player.energy = energy;
  return t;
}

/** The blue card's action from the action menu, every deferred step run. */
function act(t: Table): void {
  const door = cast(t.player.playActionCard(), SelectCard);
  expect(door.cards.map((c) => c.name)).to.include(CardName.FORESTRY_MECHS);
  door.cb([t.card]);
  runAllActions(t.game);
}

function played(tags: Array<Tag>, type: CardType = CardType.AUTOMATED): IProjectCard {
  return fakeCard({tags, type});
}

describe('ForestryMechs', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a blue card for 7, Plant + Building, a mech holder, no VP, the GREENS\' plate (the set\'s third), TR40 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(CardName.FORESTRY_MECHS);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(COST);
      expect(card.tags).deep.eq([Tag.PLANT, Tag.BUILDING]);
      expect(card.resourceType).eq(CardResource.MECH);
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(requiredPartyOf(card), 'the MIN plate holds the Greens\' emblem — a requirement, not a tag').eq(G);
      expect(card.requirements).has.length(1);
      expect(card.metadata.cardNumber).eq('TR40');
      expect(card.metadata.description).eq('Requires the Greens to be ruling or that you have 2 delegates there. Add 1 mech resource to this card.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[CardName.FORESTRY_MECHS];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left: the module is the gate').is.undefined;
      expect(MECHS_ON_PLAY).eq(1);
      expect(ENERGY_PER_MECH).eq(1);
      expect(MECHS_PER_STEP).eq(1);
      // Plain storage (decision 4 — К-R1 is the owner's), no trigger, no hook of its own.
      expect((card as ICard).resourceRole, 'a plain mech store — no claiming role').is.undefined;
      expect((card as ICard).onCardPlayed, 'no trigger').is.undefined;
      expect((card as ICard).actionUnavailableReason, 'no reason of its own — the declaration\'s automatic ones').is.undefined;
    });

    it('the ACTION is ONE DECLARATION of the Local Shading class: an `or` of two titled variants in the printed order, auto-selecting the lone live one', () => {
      const action = t.card.actionBehavior;
      expect(action?.or?.autoSelect).is.true;
      expect(action?.or?.behaviors.map((b) => b.title)).deep.eq([FORESTRY_MECHS_ADD_TITLE, FORESTRY_MECHS_STEP_TITLE]);
      expect(action?.or?.behaviors[0]).deep.eq({spend: {energy: 1}, addResources: 1, title: FORESTRY_MECHS_ADD_TITLE});
      expect(action?.or?.behaviors[1]).deep.eq({spend: {resourcesHere: 1}, production: {plants: 1}, title: FORESTRY_MECHS_STEP_TITLE});
      expect(Object.keys(action ?? {}), 'nothing beside the `or`').deep.eq(['or']);
    });

    it('rule 12 — the structured text prints the requirement, the two action rows of the `or` with B\'s short, and the play\'s own line', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks) ?? [];
      expect(blocks.map((b) => b.text)).deep.eq([
        'Requires Greens to be ruling or that you have 2 delegates on its resolution.',
        'Action: Pay 1 energy to add a mech resource to this card.',
        'Action: Spend 1 mech from here to increase your plant production 1 step.',
        'Add 1 mech to this card.',
      ]);
      expect(blocks.map((b) => [b.kind, b.short])).to.deep.include.members([
        ['action', 'Spend 1 mech for 1 plant production'],
      ]);
    });
  });

  describe('rule 1 — the requirement: the Greens rule (the starting rule counts), or 2 of your delegates on their resolution', () => {
    beforeEach(() => {
      t.player.cardsInHand.push(t.card);
      t.player.megaCredits = 20;
    });

    it('generation 1, nothing enacted: the Greens rule by the STARTING RULE — playable with no delegate anywhere', () => {
      expect(t.parliament.rulingParty()).eq(G);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('the Reds ruling: «0 of 2» with the named reason; one cube: «1 of 2»; two: playable', () => {
      redsRule(t);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [G, '2'], party: G, current: 0, requirement: true, requirementKey: 'req:party',
      });
      greensCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: G, current: 1});
      greensCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never a REQUIREMENT\'s: with one cube the card still reads «1 of 2»', () => {
      redsRule(t);
      t.player.playedCards.push(new CouncilSeat());
      greensCubes(t, t.player, 1);
      expect(t.parliament.hasPartyEffect(t.player, G), 'the Greens\' EFFECT is the player\'s by the Seat').is.true;
      expect(t.player.canPlay(t.card), 'the requirement is still two').is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: G, current: 1, params: [G, '2']});
    });

    it('checked at the PLAY only: once on the table, the action works whoever rules', () => {
      const u = redsRule(table());
      owned(u, 1, 1);
      expect(u.card.canAct(u.player)).is.true;
    });
  });

  describe('rule 2 — the play: +1 mech on THIS card and nothing else; paid in M€ and Construction Mechs\' mechs, never EVA\'s', () => {
    it('the cost is paid, the card is in the tableau with 1 mech, nothing is asked', () => {
      t.player.cardsInHand.push(t.card);
      t.player.megaCredits = 20;
      t.player.playCard(t.card, Payment.of({megacredits: COST}));
      runAllActions(t.game);
      expect(t.player.megaCredits).eq(20 - COST);
      expect(t.player.playedCards.get(CardName.FORESTRY_MECHS)).eq(t.card);
      expect(t.card.resourceCount).eq(MECHS_ON_PLAY);
      expect(t.player.getWaitingFor()).is.undefined;
      expect(t.player.production.plants, 'the play raises nothing').eq(0);
    });

    it('the composer promises the one mech as the card\'s own chip', () => {
      t.player.cardsInHand.push(t.card);
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.branches[0].effects.find((e) => e.icon === 'mech')).deep.include({direction: 'gain', amount: MECHS_ON_PLAY});
    });

    it('the Building tag opens the `constructionMechs` lane (Construction Mechs pay 5 each); the `mechs` lane (EVA, Space) stays shut', () => {
      t.player.cardsInHand.push(t.card);
      const options = t.player.paymentOptionsForCard(t.card);
      expect(options.constructionMechs).is.true;
      expect(options.mechs).is.false;
      expect(CARD_FOR_SPENDABLE_RESOURCE.constructionMechs).eq(CardName.CONSTRUCTION_MECHS);
      const construction = new ConstructionMechs();
      construction.resourceCount = 2;
      t.player.playedCards.push(construction);
      t.player.megaCredits = 0;
      expect(t.player.canAfford({cost: COST, constructionMechs: true}), 'two mechs are 10 M€ on a Building card').is.true;
      t.player.playCard(t.card, Payment.of({constructionMechs: 2}));
      runAllActions(t.game);
      expect(t.player.playedCards.get(CardName.FORESTRY_MECHS)).eq(t.card);
      expect(construction.resourceCount, 'both left the payer (the upstream overpay semantic)').eq(0);
      expect(t.card.resourceCount, 'the play\'s own mech, untouched by the price').eq(MECHS_ON_PLAY);
    });
  });

  describe('rules 3–4 — ONE action, two variants, their availability (what the `or` engine answers)', () => {
    it('both live: an OrOptions in the printed order (A, then B), marked as this card\'s effect choice; the preview\'s two branches index it', () => {
      owned(t, 1, 1);
      // The declarative class DEFERS its question (Local Shading, Aerial Mappers): the action returns nothing, the prompt is queued.
      expect(t.card.action(t.player)).is.undefined;
      runAllActions(t.game);
      const or = cast(t.player.popWaitingFor(), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([FORESTRY_MECHS_ADD_TITLE, FORESTRY_MECHS_STEP_TITLE]);
      expect(or.choiceContext?.source).deep.eq({kind: 'card', card: CardName.FORESTRY_MECHS});
      expect(or.choiceContext?.mode).eq('effect-choice');
      const preview = actionPreview(t.player, t.card);
      expect(preview.kind).eq('declarative');
      expect(preview.branches.map((b) => [b.index, b.available])).deep.eq([[0, true], [1, true]]);
      expect(preview.branches.map((b) => b.title)).deep.eq([FORESTRY_MECHS_ADD_TITLE, FORESTRY_MECHS_STEP_TITLE]);
      // Nothing moved by the question itself.
      expect([t.player.energy, t.card.resourceCount, t.player.production.plants]).deep.eq([1, 1, 0]);
    });

    it('A alone (no mech, 1 energy): no prompt — the action IS «1 energy → 1 mech»; the lone branch carries index −1', () => {
      owned(t, 0, 1);
      expect(actionPreview(t.player, t.card).branches.map((b) => [b.index, b.available])).deep.eq([[-1, true], [-1, false]]);
      expect(t.card.action(t.player), 'one live variant is the whole action').is.undefined;
      runAllActions(t.game);
      expect(t.player.getWaitingFor()).is.undefined;
      expect([t.player.energy, t.card.resourceCount, t.player.production.plants]).deep.eq([0, 1, 0]);
    });

    it('B alone (a mech, no energy): no prompt — the mech leaves, the plant production steps', () => {
      owned(t, 1, 0);
      expect(actionPreview(t.player, t.card).branches.map((b) => [b.index, b.available])).deep.eq([[-1, false], [-1, true]]);
      expect(t.card.action(t.player)).is.undefined;
      runAllActions(t.game);
      expect(t.player.getWaitingFor()).is.undefined;
      expect([t.player.energy, t.card.resourceCount, t.player.production.plants]).deep.eq([0, 0, 1]);
    });

    it('A at 0 energy is SHOWN disabled with the automatic energy reason; B at 0 mechs with the automatic «on this card» count — never hidden', () => {
      owned(t, 1, 0);
      const a = actionPreview(t.player, t.card).branches[0];
      expect(a.available).is.false;
      expect(a.unavailableReason).eq('Not enough energy');
      expect(a.effects.map((e) => e.icon), 'the refused variant still shows its chips').deep.eq(['energy', 'mech']);

      const u = owned(table(), 0, 1);
      const b = actionPreview(u.player, u.card).branches[1];
      expect(b.available).is.false;
      expect(b.unavailableReason).eq('Not enough resources on this card');
      expect(b.effects.map((e) => e.icon)).deep.eq(['mech', Resource.PLANTS]);
    });

    describe('both dead — `canAct` is false and the FIRST card-level reason is the energy (the one blocker the player can act on)', () => {
      const cases: Array<[energy: number, mechs: number, canAct: boolean]> = [
        [1, 0, true],
        [0, 1, true],
        [1, 1, true],
        [0, 0, false],
      ];
      for (const [energy, mechs, expected] of cases) {
        it(`energy ${energy}, mechs ${mechs} → ${expected}`, () => {
          owned(t, mechs, energy);
          expect(t.card.canAct(t.player)).eq(expected);
          expect(t.player.getPlayableActionCards().includes(t.card)).eq(expected);
        });
      }

      it('no mech and no energy: the energy first, the mech count second — both named, nothing invented', () => {
        owned(t, 0, 0);
        const reasons = actionUnavailableReasons(t.player, t.card);
        expect(reasons.map((r) => r.message)).deep.eq(['Not enough energy', 'Not enough resources on this card']);
        expect(reasons[0]).deep.include({type: 'resource', resource: Resource.ENERGY, current: 0});
        expect(reasons[1]).deep.include({type: 'count', current: 0});
        expect(actionPreview(t.player, t.card).branches.map((b) => b.available), 'two branches, both shown').deep.eq([false, false]);
      });
    });
  });

  describe('rule 5 — B is an ordinary plant-production step: the Greens answer it only if the effect is yours at the press', () => {
    it('the Greens ruling (the starting rule): mech 1 → 0, +1 plant production, +1 M€ production from the Greens; the use is spent; the journal reads spend · step · answer', () => {
      owned(t, 1, 0);
      const at = t.game.gameLog.length;
      expect(t.parliament.hasPartyEffect(t.player, G)).is.true;
      act(t);
      expect(t.card.resourceCount).eq(0);
      expect(t.player.production.plants).eq(1);
      expect(t.player.production.megacredits).eq(1);
      expect(t.player.actionsThisGeneration.has(CardName.FORESTRY_MECHS), 'once per generation').is.true;
      expect(t.player.getWaitingFor(), 'nothing is asked').is.undefined;
      const lines = t.game.gameLog.slice(at).map((m) => formatMessage(m));
      const spend = lines.findIndex((l) => /removed 1 .*Forestry Mechs|1 mech.*Forestry Mechs/i.test(l));
      const step = lines.findIndex((l) => /plant.*production|production.*plant/i.test(l));
      const greens = lines.findIndex((l) => /Greens/.test(l) && /production/i.test(l));
      expect(spend, lines.join('\n')).is.gte(0);
      expect(step, lines.join('\n')).is.gt(spend);
      expect(greens, lines.join('\n')).is.gt(step);
    });

    it('the Greens NOT ruling: two own cubes open the effect — +1 M€ production; one cube does not; one cube WITH TR36 does', () => {
      for (const [cubes, seat, answer] of [[2, false, 1], [1, false, 0], [1, true, 1]] as const) {
        const u = owned(redsRule(table()), 1, 0);
        if (seat) {
          u.player.playedCards.push(new CouncilSeat());
        }
        greensCubes(u, u.player, cubes);
        expect(u.parliament.hasPartyEffect(u.player, G), `${cubes} cube(s), seat ${seat}`).eq(answer === 1);
        act(u);
        expect(u.card.resourceCount).eq(0);
        expect(u.player.production.plants, `${cubes} cube(s), seat ${seat}`).eq(1);
        expect(u.player.production.megacredits, `${cubes} cube(s), seat ${seat}`).eq(answer);
      }
    });

    it('the preview of B is DECLARATIVE: a «1 → 0 on this card» cost chip and a plant-production chip; A: the energy and the mech «on this card»', () => {
      owned(t, 1, 1);
      const [a, b] = actionPreview(t.player, t.card).branches;
      expect(a.effects[0]).deep.include({direction: 'cost', icon: 'energy', amount: 1, current: 1, resulting: 0});
      expect(a.effects[1]).deep.include({direction: 'gain', icon: 'mech', amount: 1, current: 1, resulting: 2, note: 'on this card'});
      expect(b.effects[0]).deep.include({direction: 'cost', icon: 'mech', amount: 1, current: 1, resulting: 0, note: 'on this card'});
      expect(b.effects[1]).deep.include({direction: 'gain', icon: Resource.PLANTS, amount: 1, current: 0, resulting: 1, note: 'production'});
    });

    it('the forecast of the press names the Greens\' «+1 M€ production» while the effect is yours — and nothing when it is not', () => {
      owned(t, 1, 1);
      // With TWO branches the forecast files each option's reactions under ITS branch (`byBranch`), never in the shared `facts`:
      // the Greens answer B (position 1) and have nothing to say to A.
      const forecast = effectForecastForAction(t.player, t.card, actionPreview(t.player, t.card));
      expect(forecast.facts.find((f) => f.id?.endsWith('greens-production')), 'not a fact of the whole action').is.undefined;
      expect((forecast.byBranch?.[0] ?? []).find((f) => f.id?.endsWith('greens-production')), 'nothing on A').is.undefined;
      const greens = (forecast.byBranch?.[1] ?? []).find((f) => f.id?.endsWith('greens-production'));
      expect(greens, JSON.stringify(forecast)).is.not.undefined;
      // A fact TIED to an option reads «depends on this option»; what it is once B is fixed — EXACT — rides inside
      // (`asBranchFact` → `condition.chosen`; the composer with B selected restores it).
      expect(greens).deep.include({certainty: 'conditional'});
      expect(greens?.condition).deep.include({state: 'depends', branchPos: 1});
      expect(greens?.condition?.chosen).deep.include({certainty: 'exact'});
      expect(greens?.source).deep.include({kind: 'party', name: G, channel: 'production-gain'});
      expect(greens?.effects[0]).deep.include({direction: 'gain', icon: Resource.MEGACREDITS, amount: 1, current: 0, resulting: 1, note: 'production'});

      // B the only live variant: still a two-branch preview, the answer still B's.
      const lone = owned(table(), 1, 0);
      const loneForecast = effectForecastForAction(lone.player, lone.card, actionPreview(lone.player, lone.card));
      expect((loneForecast.byBranch?.[1] ?? []).some((f) => f.id?.endsWith('greens-production'))).is.true;

      const u = owned(redsRule(table()), 1, 1);
      const silent = effectForecastForAction(u.player, u.card, actionPreview(u.player, u.card));
      expect([...silent.facts, ...Object.values(silent.byBranch ?? {}).flat()].find((f) => f.id?.endsWith('greens-production'))).is.undefined;
    });
  });

  describe('rule 8 — A: the energy leaves, then the mech arrives, under the card\'s source', () => {
    it('energy 1 → 0, mechs +1, nothing else touched; the two deltas are on the event stream in that order', () => {
      owned(t, 0, 1);
      const before = t.game.events.events.length;
      act(t);
      expect([t.player.energy, t.card.resourceCount, t.player.production.plants, t.player.production.megacredits]).deep.eq([0, 1, 0, 0]);
      const events = t.game.events.events.slice(before);
      const energy = events.findIndex((e) => e.impact.stock?.energy === -1);
      const mech = events.findIndex((e) => (e.impact.cardResources ?? []).some((cr) =>
        cr.target === CardName.FORESTRY_MECHS && cr.cardResource === CardResource.MECH && cr.amount === 1));
      expect(energy, JSON.stringify(events.map((e) => e.type))).is.gte(0);
      expect(mech, JSON.stringify(events.map((e) => e.type))).is.gt(energy);
      expect(t.player.actionsThisGeneration.has(CardName.FORESTRY_MECHS)).is.true;
    });
  });

  describe('rule 6 — the mechs here are ORDINARY mechs: nobody\'s money, VP, delegates or trade; every generic «mech to any card» may land here', () => {
    it('three mechs here are 0 on the `mechs` and `constructionMechs` units, 0 VP for Mech Sports, nothing for TR66\'s door', () => {
      owned(t, 3, 0);
      expect(t.player.getSpendable('mechs')).eq(0);
      expect(t.player.getSpendable('constructionMechs')).eq(0);
      expect(t.card.getVictoryPoints(t.player), 'no VP').eq(0);
      const sports = new MechSports();
      t.player.playedCards.push(sports);
      expect(sports.getVictoryPoints(t.player), 'Mech Sports scores its own mechs only').eq(0);
      const convoys = new AutomatedConvoys();
      t.player.playedCards.push(convoys);
      expect(new TradeWithAutomatedConvoys(t.player).canUse()).is.false;
      const eva = new EvaMechs();
      eva.resourceCount = 1;
      t.player.playedCards.push(eva);
      expect(t.player.getSpendable('mechs'), 'EVA\'s one mech is the only tender').eq(1);
    });

    it('a mech holder for every generic «mech to any card» (TR29\'s B, Vesta) — a Vesta trade that picks it makes B live', () => {
      owned(t, 0, 0);
      const {game, player, card} = t;
      expect(player.getResourceCards(CardResource.MECH).map((c) => c.name)).includes(CardName.FORESTRY_MECHS);
      expect(new AddResourcesToCard(player, CardResource.MECH, {count: 1}).getCards().map((c) => c.name)).includes(CardName.FORESTRY_MECHS);
      const vesta = new Vesta();
      game.colonies = [vesta];
      player.playedCards.push(new MarsArmyMechs());
      vesta.trackPosition = 6; // the 7th cell: 3 units
      expect(card.canAct(player), 'both dead before the trade').is.false;
      vesta.trade(player);
      runAllActions(game);
      const pick = cast(player.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).to.have.members([CardName.FORESTRY_MECHS, CardName.MARS_ARMY_MECHS]);
      pick.cb([card]);
      runAllActions(game);
      expect(card.resourceCount).eq(3);
      expect(card.canAct(player), 'B is live on Vesta\'s mechs').is.true;
      expect(actionPreview(player, card).branches[1].available).is.true;
    });
  });

  describe('rule 7 — the card\'s OWN tags wake its neighbours, and what they do NOT wake', () => {
    it('Plant: Decomposers takes a microbe; Building: TR16 Administration District does NOT draw (no VP icon) — and this card takes nothing from itself', () => {
      const decomposers = new Decomposers();
      const district = new AdministrationDistrict();
      t.player.playedCards.push(decomposers, district);
      t.player.cardsInHand.push(t.card);
      const hand = t.player.cardsInHand.length;
      t.player.playCard(t.card);
      runAllActions(t.game);
      expect(decomposers.resourceCount).eq(1);
      expect(t.player.cardsInHand.length, 'the card left the hand and nothing was drawn').eq(hand - 1);
      expect(t.card.resourceCount).eq(MECHS_ON_PLAY);
      expect(t.player.getWaitingFor()).is.undefined;
    });

    it('Construction Mechs is a PAYMENT, never a trigger: a play paid in M€ leaves its mechs where they were', () => {
      const construction = new ConstructionMechs();
      construction.resourceCount = 2;
      t.player.playedCards.push(construction);
      t.player.cardsInHand.push(t.card);
      t.player.megaCredits = 20;
      t.player.playCard(t.card, Payment.of({megacredits: COST}));
      runAllActions(t.game);
      expect(construction.resourceCount).eq(2);
      expect(t.card.resourceCount).eq(MECHS_ON_PLAY);
    });

    it('an opponent\'s play of a plant or building tag touches nothing here', () => {
      owned(t, 1, 0);
      t.opponent.playCard(played([Tag.PLANT, Tag.BUILDING]));
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(1);
    });
  });

  describe('rule 11 — MarsBot', () => {
    it('the bot\'s own plant tag is nobody\'s play of this card: nothing moves, nothing is asked', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.phase = Phase.ACTION;
      const card = new ForestryMechs();
      card.resourceCount = 1;
      human.playedCards.push(card);
      AutomaResolver.resolveTag(game, Tag.PLANT);
      runAllActions(game);
      expect(card.resourceCount).eq(1);
      expect(human.production.plants).eq(0);
    });
  });

  describe('save / reload', () => {
    it('the stored mechs and the spent action survive serialization', () => {
      owned(t, 4, 0);
      t.player.actionsThisGeneration.add(CardName.FORESTRY_MECHS);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.player.id);
      const card = again.playedCards.get(CardName.FORESTRY_MECHS) as IProjectCard | undefined;
      expect(card?.resourceCount).eq(4);
      expect(again.actionsThisGeneration.has(CardName.FORESTRY_MECHS)).is.true;
    });
  });
});

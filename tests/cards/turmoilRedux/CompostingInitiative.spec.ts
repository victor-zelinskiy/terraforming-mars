import {expect} from 'chai';
import {CompostingInitiative, HEAT_PER_ACTION, MICROBES_PER_ACTION} from '../../../src/server/cards/turmoilRedux/CompostingInitiative';
import {BiologicalSimulations} from '../../../src/server/cards/turmoilRedux/BiologicalSimulations';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {Decomposers} from '../../../src/server/cards/base/Decomposers';
import {TopsoilContract} from '../../../src/server/cards/promo/TopsoilContract';
import {Splice} from '../../../src/server/cards/promo/Splice';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {TileType} from '../../../src/common/TileType';
import {SpaceName} from '../../../src/common/boards/SpaceName';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {AltSecondaryTag} from '../../../src/common/cards/render/AltSecondaryTag';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {holderActionGoodOf} from '../../../src/server/cards/holderActionGood';
import {TILES_ON_MARS_UNIT} from '../../../src/server/behavior/countedBasis';
import {AresHazards} from '../../../src/server/ares/AresHazards';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectColony} from '../../../src/server/inputs/SelectColony';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {ICard} from '../../../src/server/cards/ICard';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {addCity, addGreenery, addOcean, runAllActions} from '../../TestingUtils';
import {recomputeRootImpact} from '../../../src/client/components/notifications/notificationModel';

/**
 * TR45 — COMPOSTING INITIATIVE: the Greens' seventh plate, a microbe holder
 * whose play is COUNTED off the board — «1 microbe for each tile on Mars», of
 * ANY player — and whose action buys 6 heat with 2 of them. The card is two
 * lines of declaration; the census it stands on (`common/boards/
 * marsTileCensus.ts`) has its own table spec. Every rule reading of the card
 * file's header is pinned here, and the preview's promise is held to the
 * play's result (the number AND its composition).
 */
const G = PartyName.GREENS;
const COST = 8;
const CI = CardName.COMPOSTING_INITIATIVE;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: CompostingInitiative};

/** A two-seat Redux table in the action phase: generation 1, nothing enacted — the Greens rule by the STARTING RULE. */
function table(options: {aresExtension?: boolean, aresHazards?: boolean} = {}): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, ...options});
  game.phase = Phase.ACTION;
  const card = new CompostingInitiative();
  player.cardsInHand.push(card);
  player.megaCredits = 20;
  return {game, player, opponent, parliament: game.parliament!, card};
}

function redsRule(t: Table): void {
  seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
  expect(t.parliament.rulingParty()).eq(PartyName.REDS);
}

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

/**
 * THE E2E BOARD (fixture `composting-initiative`): the player — a city, a
 * stack of 2, three greeneries; the rival — a city, two greeneries, a Nuclear
 * Zone; four oceans; a city on Ganymede (off Mars). → 14 = cities 4 ·
 * greeneries 5 · oceans 4 · special 1; Ganymede named and not counted.
 */
function fourteen(t: Table): void {
  const stack = addCity(t.player);
  stack.stackHeight = 2;
  addCity(t.player, t.game.board.getAvailableSpacesForCity(t.player).find((s) => s !== stack)!.id);
  for (let i = 0; i < 3; i++) {
    addGreenery(t.player);
  }
  addCity(t.opponent);
  addGreenery(t.opponent);
  addGreenery(t.opponent);
  const zone = t.game.board.getAvailableSpacesOnLand(t.opponent)[0];
  t.game.simpleAddTile(t.opponent, zone, {tileType: TileType.NUCLEAR_ZONE});
  for (let i = 0; i < 4; i++) {
    addOcean(t.opponent);
  }
  addCity(t.opponent, SpaceName.GANYMEDE_COLONY);
}

function play(t: Table, payment: Payment = Payment.of({megacredits: COST})): void {
  t.player.playCard(t.card, payment);
  runAllActions(t.game);
}

function playAsAction(t: Table): void {
  const events = t.game.events;
  events.beginAction(t.player, {kind: 'card', card: CI, owner: t.player.color}, {category: 'card-play'});
  try {
    play(t);
  } finally {
    events.endScope();
  }
}

function gainChip(t: Table) {
  return cardPlayPreview(t.player, t.card).branches[0].effects.find((e) => e.note === 'on this card');
}

describe('CompostingInitiative', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a blue card for 8, Microbe + Building, a microbe holder, the GREENS\' plate, no VP, TR45 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(CI);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(COST);
      expect(card.tags, 'the corner, in the scan\'s order').deep.eq([Tag.MICROBE, Tag.BUILDING]);
      expect(card.resourceType).eq(CardResource.MICROBE);
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(requiredPartyOf(card), 'the MIN plate holds the Greens\' emblem — a requirement, not a tag').eq(G);
      expect(card.requirements).has.length(1);
      expect(card.metadata.cardNumber).eq('TR45');
      expect(card.metadata.description).eq('Requires the Greens to be ruling or that you have 2 delegates there. Add 1 microbe resource to this card for each tile on Mars.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[CI];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left').is.undefined;
      // TWO lines of declaration — the census countable and the TR38 action class; no hook of any kind.
      expect(card.behavior).deep.eq({addResources: {tiles: {where: 'onmars'}, all: true}});
      expect(card.actionBehavior).deep.eq({spend: {resourcesHere: MICROBES_PER_ACTION}, stock: {heat: HEAT_PER_ACTION}});
      expect((card as ICard).cardPlayPreview, 'no hook — the declaration is the preview').is.undefined;
      expect((card as ICard).actionPreview).is.undefined;
      expect((card as ICard).actionUnavailableReason).is.undefined;
    });

    it('the face reads the scan: [microbe][microbe] → 6 [heat]; [microbe] / [an empty hex of ANY player with the «on Mars» corner]', () => {
      type Node = {is?: string, type?: string, amount?: number, anyPlayer?: boolean, secondaryTag?: string, resource?: string, rows?: Array<Array<Node>>};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
      expect(rows).has.length(2);
      const action = rows[0][0];
      expect(action.is).eq('effect');
      const [cost, arrow, reward] = action.rows!;
      expect(cost.map((n) => [n.type, n.amount])).deep.eq([[CardRenderItemType.RESOURCE, MICROBES_PER_ACTION]]);
      expect(arrow.length).greaterThan(0);
      expect(reward.filter((n) => typeof n === 'object').map((n) => [n.type, n.amount])).deep.eq([[CardRenderItemType.HEAT, HEAT_PER_ACTION]]);
      const onPlay = rows[1];
      expect(onPlay.map((n) => n.type ?? n.is)).deep.eq([CardRenderItemType.RESOURCE, '/', CardRenderItemType.EMPTY_TILE]);
      // The empty tile is «any player» (the frame) and «on Mars» (the corner) — the printed meaning of the row.
      expect(onPlay[2].anyPlayer, 'the hex stands in the «any player» frame').is.true;
      expect(onPlay[2].secondaryTag, 'the «on Mars» hex corner — TR14\'s').eq(AltSecondaryTag.MARS_TILE);
    });

    it('the holder\'s role is DERIVED from the declaration: 2 microbes buy 6 heat', () => {
      expect(holderActionGoodOf(t.card)).deep.eq({spend: MICROBES_PER_ACTION, good: {kind: 'stock', resource: 'heat', amount: HEAT_PER_ACTION}});
    });
  });

  describe('rule 1 — the requirement: the Greens rule (the starting rule counts), or 2 of your delegates on their resolution', () => {
    it('generation 1, nothing enacted: playable with no delegate anywhere', () => {
      expect(t.parliament.rulingParty()).eq(G);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('the Reds ruling: «0 of 2» with the named reason; one cube: «1 of 2»; two: playable', () => {
      redsRule(t);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({type: 'party', message: PARTY_REQUIREMENT_REASON, params: [G, '2'], party: G, current: 0});
      greensCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.false;
      greensCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never a REQUIREMENT\'s', () => {
      redsRule(t);
      t.player.playedCards.push(new CouncilSeat());
      greensCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.false;
    });

    it('rule 12 — the Building tag lets steel pay (2 M€ a unit)', () => {
      expect(t.player.paymentOptionsForCard(t.card).steel).is.true;
      t.player.megaCredits = 4;
      t.player.steel = 2;
      expect(t.player.canPlay(t.card)).is.true;
      play(t, Payment.of({megacredits: 4, steel: 2}));
      expect(t.player.steel).eq(0);
      expect(t.player.megaCredits).eq(0);
      expect(t.player.playedCards.get(CI)).eq(t.card);
    });
  });

  describe('rule 2 — +1 microbe per TILE ON MARS of any player: the census, its composition, its exclusions', () => {
    it('the e2e board: 14 — cities 4 (a stack counts its tiers) · greeneries 5 · oceans 4 · special 1; the city on Ganymede is named and not counted', () => {
      fourteen(t);
      const chip = gainChip(t)!;
      expect(chip).deep.include({direction: 'gain', icon: 'microbe', amount: 14, current: 0, resulting: 14, note: 'on this card'});
      expect(chip.basis).has.length(1);
      const basis = chip.basis![0];
      expect(basis.label).eq('Tiles on Mars');
      expect(basis.count).eq(14);
      expect(basis.parts!.map((p) => [p.kind, p.count])).deep.eq([['city', 4], ['greenery', 5], ['ocean', 4], ['special', 1]]);
      expect(basis.excluded!.map((p) => [p.kind, p.count, p.spaces])).deep.eq([['off-mars', 1, [SpaceName.GANYMEDE_COLONY]]]);
      play(t);
      // THE PARITY: the preview's number is the number the play pays.
      expect(t.card.resourceCount).eq(14);
    });

    it('Ares hazards are not tiles: named, not counted', () => {
      const ares = table({aresExtension: true, aresHazards: false});
      const land = ares.game.board.getAvailableSpacesOnLand(ares.player);
      AresHazards.putHazardAt(ares.game, land[0], TileType.DUST_STORM_MILD);
      AresHazards.putHazardAt(ares.game, land[8], TileType.EROSION_MILD);
      addCity(ares.player, land[16].id);
      const basis = gainChip(ares)!.basis![0];
      expect(basis.count).eq(1);
      expect(basis.excluded!.map((p) => [p.kind, p.count])).deep.eq([['hazard', 2]]);
      play(ares);
      expect(ares.card.resourceCount).eq(1);
    });

    it('rule 3 — counted ONCE, at the play: a tile placed later adds nothing', () => {
      addCity(t.opponent);
      play(t);
      expect(t.card.resourceCount).eq(1);
      addGreenery(t.opponent);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(1);
    });

    it('rule 4 — ZERO is a rule, not a loss: playable, +0, no warning in the preview, no skip event, the zero NAMED by the basis', () => {
      expect(t.player.canPlay(t.card)).is.true;
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.branches[0].steps.filter((s) => s.kind === 'note' && s.noteKind === 'warning'), 'no warning').deep.eq([]);
      const chip = gainChip(t)!;
      expect(chip).deep.include({amount: 0, current: 0, resulting: 0});
      expect(chip.basis).deep.eq([{count: 0, label: 'Tiles on Mars', parts: []}]);
      play(t);
      expect(t.card.resourceCount).eq(0);
      expect(t.game.events.events.filter((e) => e.type === 'effect-skipped')).deep.eq([]);
      expect(t.player.getWaitingFor()).is.undefined;
    });

    it('rule 4 — SOLO: the neutral cities and greeneries count from the first turn (N ≥ 4)', () => {
      const [game, solo] = testGame(1, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      // The solo set-up's own questions (a colony pick) stand in the queue first — answered, so the play's deferred gain runs.
      runAllActions(game);
      const setup = solo.popWaitingFor();
      if (setup instanceof SelectColony) {
        setup.cb(setup.colonies[0]);
        runAllActions(game);
      }
      const card = new CompostingInitiative();
      solo.cardsInHand.push(card);
      solo.megaCredits = 20;
      const n = cardPlayPreview(solo, card).branches[0].effects.find((e) => e.note === 'on this card')!.amount;
      expect(n).greaterThanOrEqual(4);
      solo.playCard(card, Payment.of({megacredits: COST}));
      runAllActions(game);
      expect(card.resourceCount).eq(n);
    });
  });

  describe('rule 6 — the action: 2 microbes from here → 6 heat, once a generation; below 2 the automatic reason', () => {
    it('3 microbes: −2 here, +6 heat; the preview names both sides', () => {
      t.player.playedCards.push(t.card);
      t.card.resourceCount = 3;
      const branch = actionPreview(t.player, t.card).branches[0];
      expect(branch.effects.map((e) => [e.direction, e.icon, e.amount, e.current, e.resulting])).deep.eq([
        ['cost', 'microbe', 2, 3, 1],
        ['gain', 'heat', 6, 0, 6],
      ]);
      expect(t.card.canAct(t.player)).is.true;
      t.card.action(t.player);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(1);
      expect(t.player.heat).eq(6);
    });

    it('1 microbe: refused with «1 of 2 microbes on this card» — the count, the need, the resource (PL-197)', () => {
      t.player.playedCards.push(t.card);
      t.card.resourceCount = 1;
      expect(t.card.canAct(t.player)).is.false;
      expect(actionUnavailableReasons(t.player, t.card)[0]).deep.include({type: 'count', message: '${0} of ${1} {microbe|microbes} on this card', params: ['1', '2'], current: 1});
    });

    it('rule 5 — ordinary microbes: «microbes to ANY card» can land here', () => {
      t.player.playedCards.push(t.card);
      expect(t.player.getResourceCards(CardResource.MICROBE)).includes(t.card);
    });
  });

  describe('rule 7 — the reactions are the engine\'s own, and the forecast names them before the press', () => {
    it('Topsoil Contract +N M€ (and +1 for Decomposers\' microbe); Decomposers +1; TR38 +1 data — forecast and live agree', () => {
      fourteen(t);
      const topsoil = new TopsoilContract();
      const decomposers = new Decomposers();
      const simulations = new BiologicalSimulations();
      t.player.playedCards.push(topsoil, decomposers, simulations);
      const facts = effectForecastForPlay(t.player, t.card, cardPlayPreview(t.player, t.card)).facts;
      expect(facts.find((f) => f.source.name === CardName.DECOMPOSERS)?.effects[0]).deep.include({icon: 'microbe', amount: 1});
      expect(facts.find((f) => f.source.name === CardName.BIOLOGICAL_SIMULATIONS)?.effects[0]).deep.include({icon: 'data', amount: 1});
      const soil = facts.filter((f) => f.source.name === CardName.TOPSOIL_CONTRACT).flatMap((f) => f.effects).filter((e) => e.icon === 'megacredits');
      expect(soil.some((e) => e.amount === 14), 'Topsoil answers the play\'s 14 microbes before the press').is.true;
      const before = t.player.megaCredits;
      play(t);
      expect(t.card.resourceCount).eq(14);
      expect(decomposers.resourceCount).eq(1);
      expect(simulations.resourceCount).eq(1);
      expect(t.player.megaCredits - (before - COST), '+14 for the card\'s microbes, +1 for Decomposers\' one').eq(15);
    });

    it('Splice: its owner +2 M€; the PLAYER is asked «a microbe on THIS card or 2 M€» — the microbe makes it N + 1', () => {
      addCity(t.opponent);
      addOcean(t.opponent);
      const splice = new Splice();
      t.opponent.playedCards.push(splice);
      const facts = effectForecastForPlay(t.player, t.card, cardPlayPreview(t.player, t.card)).facts;
      expect(facts.filter((f) => f.source.name === CardName.SPLICE).length, 'Splice is named before the press').greaterThan(0);
      const opponentBefore = t.opponent.megaCredits;
      play(t);
      expect(t.card.resourceCount).eq(2);
      const or = cast(t.player.getWaitingFor(), OrOptions);
      const microbe = or.options.findIndex((o) => cast(o, SelectOption).title === 'Add a microbe resource to this card');
      expect(microbe).greaterThan(-1);
      or.process({type: 'or', index: microbe, response: {type: 'option'}}, t.player);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(3);
      expect(t.opponent.megaCredits - opponentBefore).eq(2);
    });
  });

  describe('rule 8 — the journal carries the reason; the rival reads the gain', () => {
    it('ONE card-resource event «+N microbes · for N tiles on Mars»', () => {
      fourteen(t);
      const from = t.game.events.events.length;
      playAsAction(t);
      const gains = t.game.events.events.slice(from).filter((e) => e.type === 'card-resource-changed' && e.impact.cardResources?.[0].target === CI);
      expect(gains, 'ONE line').has.length(1);
      expect(gains[0].impact.cardResources).deep.eq([{cardResource: CardResource.MICROBE, target: CI, amount: 14, basis: {count: 14, unitKey: TILES_ON_MARS_UNIT}}]);
    });

    it('the rival\'s notification carries the microbe chip with its basis', () => {
      fourteen(t);
      play(t);
      const root = t.game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CI)!.id;
      const impact = recomputeRootImpact(t.game.events.events, root, t.player.color, t.opponent.color);
      const chips = impact.pillGroups.flatMap((g) => g.chips);
      expect(chips.map((c) => c.icon)).to.include(CardResource.MICROBE);
      // PL-195: the 14 COUNTED microbes are a pill carrying their reason.
      const microbes = chips.filter((c) => c.icon === CardResource.MICROBE);
      expect(microbes.map((c) => [c.text, c.basis?.count ?? null])).deep.eq([['+14', 14]]);
      const gain = impact.childVMs.find((vm) => vm.basis !== undefined);
      expect(gain?.basis, 'the reason rides to the rival').deep.include({count: 14, unitKey: TILES_ON_MARS_UNIT});
    });
  });

  describe('rule 9 — MarsBot', () => {
    it('the bot\'s tiles are counted (it never plays the card)', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.phase = Phase.ACTION;
      const card = new CompostingInitiative();
      human.cardsInHand.push(card);
      human.megaCredits = 20;
      addCity(bot);
      const n = cardPlayPreview(human, card).branches[0].effects.find((e) => e.note === 'on this card')!.amount;
      const onMars = game.board.spaces.filter((s) => s.tile !== undefined && s.spaceType !== 'colony').length;
      expect(n).eq(onMars);
      human.playCard(card, Payment.of({megacredits: COST}));
      runAllActions(game);
      expect(card.resourceCount).eq(n);
    });
  });

  describe('rule 10 — save / load adds nothing', () => {
    it('the microbes and the action\'s flag survive a reload as ordinary fields', () => {
      fourteen(t);
      play(t);
      t.card.action(t.player);
      runAllActions(t.game);
      t.player.actionsThisGeneration.add(CI);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.player.id);
      expect((again.playedCards.get(CI) as ICard).resourceCount).eq(12);
      expect(again.actionsThisGeneration.has(CI)).is.true;
      expect(again.heat).eq(6);
    });
  });
});

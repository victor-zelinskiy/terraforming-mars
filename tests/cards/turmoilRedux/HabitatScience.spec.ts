import {expect} from 'chai';
import {
  HABITAT_SCIENCE_DATA_COST,
  HABITAT_SCIENCE_NO_COLONIES_REASON,
  HABITAT_SCIENCE_SHORT_DATA_REASON,
  HabitatScience,
} from '../../../src/server/cards/turmoilRedux/HabitatScience';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {IColony} from '../../../src/server/colonies/IColony';
import {ICard} from '../../../src/server/cards/ICard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast} from '../../../src/common/utils/utils';
import {runAllActions} from '../../TestingUtils';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {SpaceName} from '../../../src/common/boards/SpaceName';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {ActionPreviewStep} from '../../../src/common/models/ActionPreviewModel';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {allColonyBonusesLedger} from '../../../src/server/colonies/allColonyBonuses';
import {COLONIES_IN_PLAY_UNIT} from '../../../src/server/behavior/countedBasis';
import {drainBatchTail, parkedBatchTailLength, replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {Luna} from '../../../src/server/colonies/Luna';
import {Ceres} from '../../../src/server/colonies/Ceres';
import {Titan} from '../../../src/server/colonies/Titan';
import {Miranda} from '../../../src/server/colonies/Miranda';
import {Pluto} from '../../../src/server/colonies/Pluto';
import {Dirigibles} from '../../../src/server/cards/venusNext/Dirigibles';
import {AtmoCollectors} from '../../../src/server/cards/colonies/AtmoCollectors';
import {VectorComputations} from '../../../src/server/cards/turmoilRedux/VectorComputations';
import {MartianFiber} from '../../../src/server/cards/turmoilRedux/MartianFiber';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {testAutomaGame} from '../../automa/AutomaTestGame';

/**
 * TR23 — HABITAT SCIENCE: the set's first CARD ACTION that pays «all your
 * colony bonuses». Every rule reading of the card file's header is pinned
 * here; the shared layer (who is paid, the payout, the reading's order, the
 * sums) has its own spec — tests/colonies/allColonyBonuses.
 */
const U = PartyName.UNITY;
const HS = CardName.HABITAT_SCIENCE;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: HabitatScience};

/** A Redux table with EXACTLY the given colony tiles: `[tile, the player's cubes, the rival's cubes]`. */
function table(...colonies: Array<[IColony, number, number?]>): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  game.colonies = [];
  for (const [colony, mine, theirs] of colonies) {
    game.colonies.push(colony);
    for (let i = 0; i < mine; i++) {
      colony.colonies.push(p1.id);
    }
    for (let i = 0; i < (theirs ?? 0); i++) {
      colony.colonies.push(p2.id);
    }
  }
  p1.megaCredits = 0;
  return {game, p1, p2, card: new HabitatScience()};
}

/** The same table with the card IN PLAY holding `data` data — the action's starting point. */
function inPlay(data: number, ...colonies: Array<[IColony, number, number?]>): Table {
  const t = table(...colonies);
  t.p1.playedCards.push(t.card);
  t.card.resourceCount = data;
  return t;
}

/** Three QUIET real resolutions in the voting area: Greens · Unity · Industrialists. */
function parliamentTable(): Table {
  const t = table([new Luna(), 0]);
  t.p1.megaCredits = 10;
  const parliament = t.game.parliament!;
  ([PartyName.GREENS, U, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  return t;
}

/** The play under an ACTION scope (what a real turn opens) — the events' attribution needs a root. */
function playAsAction(t: Table): void {
  const events = t.game.events;
  events.beginAction(t.p1, {kind: 'card', card: HS, owner: t.p1.color}, {category: 'card-play'});
  try {
    t.p1.playCard(t.card);
    runAllActions(t.game);
  } finally {
    events.endScope();
  }
}

/** The action under ITS scope; whatever it asks is left standing for the test to answer. */
function actAsAction(t: Table): void {
  const events = t.game.events;
  events.beginAction(t.p1, {kind: 'card', card: HS, owner: t.p1.color}, {category: 'card-action'});
  try {
    expect(t.card.action(t.p1)).is.undefined;
    runAllActions(t.game);
  } finally {
    events.endScope();
  }
}

function deal(t: Table, n: number): void {
  t.p1.cardsInHand.push(...t.game.projectDeck.drawN(t.game, n) as Array<IProjectCard>);
}

function branchOf(t: Table) {
  return actionPreview(t.p1, t.card).branches[0];
}

function inputSteps(steps: ReadonlyArray<ActionPreviewStep>) {
  return steps.filter((s): s is Extract<ActionPreviewStep, {kind: 'input'}> => s.kind === 'input');
}

describe('HabitatScience', () => {
  it('registers with source-backed metadata (the scan: 3 · Science, Space · blue · Unity · data)', () => {
    const card = new HabitatScience();
    expect(card.name).eq(HS);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(3);
    expect(card.tags, 'the corner, in the scan\'s order').deep.eq([Tag.SCIENCE, Tag.SPACE]);
    expect(card.metadata.cardNumber).eq('TR23');
    expect(card.resourceType).eq(CardResource.DATA);
    expect(requiredPartyOf(card), 'the MIN plate holds Unity\'s emblem').eq(U);
    expect(card.requirements).has.length(1);
    expect(card.victoryPoints, 'no VP badge').is.undefined;
    expect(card.behavior, 'rule 2 — the engine\'s own counter').deep.eq({addResources: {colonies: {colonies: {}}, all: true}});
    expect(HABITAT_SCIENCE_DATA_COST).eq(2);
    // The face: the action row (two data ICONS → the result as TEXT), then «[data] / [colony, any player]».
    type Node = {is?: string, type?: string, amount?: number, anyPlayer?: boolean, rows?: Array<Array<Node>>};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    expect(rows).has.length(2);
    const onPlay = rows[1].map((n) => n.type ?? n.is);
    expect(onPlay).deep.eq([CardRenderItemType.RESOURCE, '/', CardRenderItemType.COLONIES]);
    expect(rows[1][2].anyPlayer, 'the colony stands in the red «any player» frame').is.true;
    expect(card.metadata.description).eq('Requires Unity to be ruling or that you have 2 delegates there. Add 1 data resource to this card for each colony in play, owned by ANY player.');
  });

  it('is in the Turmoil Redux manifest and needs Colonies (the grey ▲), never `turmoil`', () => {
    const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
    const entry = manifest.projectCards[HS]!;
    expect(new entry.Factory().name).eq(HS);
    expect(entry.compatibility).eq('colonies');
  });

  describe('rule 1 — the requirement: Unity rules, or 2 of your delegates on its resolution', () => {
    it('neither road: unplayable with the NAMED reason — Unity\'s', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [U, '2'], party: U, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('Unity rules: playable', () => {
      const t = parliamentTable();
      seatEnacted(t.game.parliament!, quietResolutionOf(U));
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('two delegates on its resolution: playable', () => {
      const t = parliamentTable();
      const parliament = t.game.parliament!;
      parliament.placeVote(t.p1, parliament.slots[1], 'reserve');
      expect(t.p1.canPlay(t.card), 'one delegate is not two').is.false;
      parliament.placeVote(t.p1, parliament.slots[1], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
    });
  });

  describe('rule 2 — on play: 1 data here per COLONY IN PLAY, of any player', () => {
    it('no colony in play: 0 data, still played — a rule, not a loss (no skip event, no warning)', () => {
      const t = table([new Luna(), 0], [new Titan(), 0]);
      const from = t.game.events.events.length;
      playAsAction(t);
      expect(t.card.resourceCount).eq(0);
      expect(t.p1.playedCards.has(HS)).is.true;
      expect(t.game.events.events.slice(from).filter((e) => e.type === 'effect-skipped')).is.empty;
      const steps = cardPlayPreview(t.p1, new HabitatScience()).branches[0].steps;
      expect(steps.filter((s) => s.kind === 'note' && s.noteKind === 'warning')).is.empty;
    });

    it('the player\'s own and the rival\'s cubes both count; two cubes on one tile are 2', () => {
      const t = table([new Luna(), 2, 1], [new Titan(), 0, 1], [new Ceres(), 1]);
      playAsAction(t);
      expect(t.card.resourceCount).eq(5);
    });

    it('MarsBot\'s cube counts (rule 12)', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const luna = new Luna();
      const titan = new Titan();
      game.colonies = [luna, titan];
      luna.colonies.push(bot.id);
      titan.colonies.push(human.id, bot.id);
      const card = new HabitatScience();
      human.playCard(card);
      runAllActions(game);
      expect(card.resourceCount).eq(3);
    });

    it('a city ON a colony tile (TR22 Nova City) is not a colony; a tile with no cube counts nothing', () => {
      const luna = new Luna();
      const t = table([luna, 0], [new Ceres(), 1]);
      luna.tiles.push(SpaceName.GANYMEDE_COLONY);
      playAsAction(t);
      expect(t.card.resourceCount).eq(1);
    });

    it('the composer\'s chip states its BASIS — «Colonies in play: N» — a zero included', () => {
      const t = table([new Luna(), 2, 1]);
      const chip = cardPlayPreview(t.p1, new HabitatScience()).branches[0].effects.find((e) => e.icon === 'data');
      expect(chip).deep.include({direction: 'gain', amount: 3, current: 0, resulting: 3, note: 'on this card'});
      expect(chip?.basis).deep.eq([{count: 3, label: 'Colonies in play'}]);

      const empty = table([new Luna(), 0]);
      const zero = cardPlayPreview(empty.p1, new HabitatScience()).branches[0].effects.find((e) => e.icon === 'data');
      expect(zero).deep.include({amount: 0, current: 0, resulting: 0});
      expect(zero?.basis).deep.eq([{count: 0, label: 'Colonies in play'}]);
    });

    it('rule 11 — the journal\'s event carries the REASON: «for 3 colonies in play»', () => {
      const t = table([new Luna(), 2, 1]);
      const from = t.game.events.events.length;
      playAsAction(t);
      const gains = t.game.events.events.slice(from).filter((e) => e.type === 'card-resource-changed' && e.impact.cardResources?.[0].target === HS);
      expect(gains, 'ONE line').has.length(1);
      expect(gains[0].impact.cardResources).deep.eq([{cardResource: CardResource.DATA, target: HS, amount: 3, basis: {count: 3, unitKey: COLONIES_IN_PLAY_UNIT}}]);
    });
  });

  describe('rule 10 — the reactions are the engine\'s own', () => {
    it('the play is a Science tag (TR05 Vector Computations +2 data) and N data onto a card (TR18 Martian Fiber +N M€)', () => {
      const t = table([new Luna(), 2, 1]);
      const vector = new VectorComputations();
      const fiber = new MartianFiber();
      t.p1.playedCards.push(vector, fiber);
      playAsAction(t);
      expect(t.card.resourceCount).eq(3);
      expect(vector.resourceCount, 'one science tag → 2 data').eq(2);
      // Martian Fiber: 1 M€ per data added to ANY of the player's cards — 3 here, 2 on Vector Computations.
      expect(t.p1.megaCredits).eq(5);
    });
  });

  describe('rule 6 — the action is refused by ONE reason, in order', () => {
    it('fewer than 2 data: «N of 2 data on this card» — whatever the colonies', () => {
      const t = inPlay(1, [new Luna(), 1]);
      expect(t.card.canAct(t.p1)).is.false;
      expect(actionUnavailableReasons(t.p1, t.card)).deep.eq([
        {type: 'count', message: HABITAT_SCIENCE_SHORT_DATA_REASON, params: ['1'], current: 1},
      ]);
      const none = inPlay(1, [new Luna(), 0, 1]);
      expect(actionUnavailableReasons(none.p1, none.card).map((r) => r.message), 'the data come first').deep.eq([HABITAT_SCIENCE_SHORT_DATA_REASON]);
    });

    it('2 data and no colony of the player\'s: «You have no colonies» — the data are never burnt for nothing', () => {
      const t = inPlay(4, [new Luna(), 0, 2]);
      expect(t.card.canAct(t.p1)).is.false;
      expect(actionUnavailableReasons(t.p1, t.card)).deep.eq([{type: 'rule', message: HABITAT_SCIENCE_NO_COLONIES_REASON}]);
      const branch = branchOf(t);
      expect(branch.available).is.false;
      expect(branch.unavailableReason).eq(HABITAT_SCIENCE_NO_COLONIES_REASON);
      expect(branch.steps, 'a refused branch offers no steps').deep.eq([]);
      expect(t.p1.getPlayableActionCards().map((c) => c.name)).does.not.include(HS);
      expect(t.card.resourceCount).eq(4);
    });

    it('2 data and a colony: available', () => {
      const t = inPlay(2, [new Luna(), 1]);
      expect(t.card.canAct(t.p1)).is.true;
      expect(actionUnavailableReasons(t.p1, t.card)).deep.eq([]);
      expect(branchOf(t).available).is.true;
    });
  });

  describe('rules 3–4 — the action: 2 data off this card → the bonus of EVERY colony, per cube', () => {
    it('Luna: −2 data, +2 M€', () => {
      const t = inPlay(4, [new Luna(), 1, 1]);
      actAsAction(t);
      expect(t.card.resourceCount).eq(2);
      expect(t.p1.megaCredits).eq(2);
      expect(t.p2.megaCredits, 'the rival\'s cube is not the player\'s colony').eq(0);
    });

    it('two cubes on Luna: the bonus twice (+4 M€)', () => {
      const t = inPlay(2, [new Luna(), 2]);
      actAsAction(t);
      expect(t.p1.megaCredits).eq(4);
      expect(t.card.resourceCount).eq(0);
    });

    it('the bonus is the tile\'s THIRD line: Miranda pays a CARD (never its trade income\'s animal), sourced by the colony + this card', () => {
      const t = inPlay(2, [new Miranda(), 1]);
      actAsAction(t);
      expect(t.p1.cardsInHand).has.length(1);
      expect(t.p1.cardDrawReveals.map((r) => r.source)).deep.eq([{type: 'colony', colonyName: ColonyName.MIRANDA, via: HS}]);
      expect(t.p1.popWaitingFor()).is.undefined;
    });

    it('the bonus rows of the journal are sourced by their COLONY under the card\'s action', () => {
      const t = inPlay(2, [new Luna(), 1], [new Ceres(), 1]);
      const from = t.game.events.events.length;
      actAsAction(t);
      const sources = t.game.events.events.slice(from)
        .map((e) => e.source as {kind?: string, name?: string} | undefined)
        .filter((s) => s?.kind === 'colony').map((s) => s?.name);
      expect([...new Set(sources)]).deep.eq([ColonyName.LUNA, ColonyName.CERES]);
    });
  });

  describe('rule 7 — a «resource onto a card» bonus is ALWAYS a step, one per cube', () => {
    it('ONE holder: the step is asked (never auto-applied) and names the colony + this card', () => {
      const t = inPlay(2, [new Titan(), 1]);
      const dirigibles = new Dirigibles();
      t.p1.playedCards.push(dirigibles);
      actAsAction(t);
      expect(dirigibles.resourceCount, 'nothing landed silently').eq(0);
      const pick = cast(t.p1.popWaitingFor(), SelectCard<ICard>);
      expect(pick.cards).deep.eq([dirigibles]);
      expect(pick.choiceContext?.source).deep.eq({kind: 'colony', name: ColonyName.TITAN, via: HS});
      pick.cb([dirigibles]);
      runAllActions(t.game);
      expect(dirigibles.resourceCount).eq(1);
    });

    it('two holders: a choice; the preview pre-collects the SAME question', () => {
      const t = inPlay(2, [new Titan(), 1]);
      const dirigibles = new Dirigibles();
      const atmo = new AtmoCollectors();
      t.p1.playedCards.push(dirigibles, atmo);
      const steps = inputSteps(branchOf(t).steps);
      expect(steps).has.length(1);
      expect(steps[0].input.type).eq('card');
      expect(steps[0].amount).eq(1);
      expect(steps[0].cardResource).eq('floater');
      expect(steps[0].input.choiceContext?.source).deep.eq({kind: 'colony', name: ColonyName.TITAN, via: HS});
      actAsAction(t);
      const pick = cast(t.p1.popWaitingFor(), SelectCard<ICard>);
      expect(pick.cards).deep.eq([dirigibles, atmo]);
    });

    it('no holder: the action is AVAILABLE, the loss is named with its size before the press and recorded in the same words after it', () => {
      const t = inPlay(2, [new Titan(), 1], [new Luna(), 1]);
      expect(t.card.canAct(t.p1)).is.true;
      const branch = branchOf(t);
      const warnings = branch.steps.filter((s): s is Extract<ActionPreviewStep, {kind: 'note'}> => s.kind === 'note' && s.noteKind === 'warning');
      expect(warnings).has.length(1);
      expect(branch.effects.some((e) => e.icon === 'floater'), 'no chip for a resource that cannot land').is.false;
      expect(branch.colonyBonuses?.entries.find((e) => e.colony === ColonyName.TITAN)?.skipped).deep.eq({reason: 'No card can hold floaters', amount: 1});

      const from = t.game.events.events.length;
      actAsAction(t);
      const skips = t.game.events.events.slice(from).filter((e) => e.type === 'effect-skipped');
      expect(skips).has.length(1);
      const promised = warnings[0].skipped!;
      expect(skips[0].impact.skipped?.label, 'the same heading').eq(promised.label);
      expect(skips[0].impact.skipped?.effect, 'the same size').deep.eq(promised.effect);
      expect(t.p1.megaCredits, 'the rest is paid').eq(2);
      expect(t.card.resourceCount).eq(0);
    });
  });

  describe('rule 8 — Pluto\'s pair, one per cube', () => {
    it('two cubes: two pairs, «1 of 2» / «2 of 2», this card the source, `colonyRepeat` the marker; the second card waits for the first discard', () => {
      const t = inPlay(2, [new Pluto(), 2]);
      deal(t, 2);
      actAsAction(t);
      expect(t.p1.cardsInHand, 'ONE card drawn so far').has.length(3);
      const first = cast(t.p1.popWaitingFor(), SelectCard<IProjectCard>);
      expect(first.discardPrompt?.source).deep.eq({kind: 'card', card: HS});
      expect(first.discardPrompt?.colonyRepeat).deep.eq({colonyName: ColonyName.PLUTO, index: 1, total: 2});
      expect(first.discardPrompt?.colonyBonus, 'never the colony workspace\'s marker').is.undefined;
      first.cb([first.cards[0]]);
      runAllActions(t.game);
      const second = cast(t.p1.popWaitingFor(), SelectCard<IProjectCard>);
      expect(second.discardPrompt?.colonyRepeat).deep.eq({colonyName: ColonyName.PLUTO, index: 2, total: 2});
      second.cb([second.cards[0]]);
      runAllActions(t.game);
      expect(t.p1.popWaitingFor()).is.undefined;
      expect(t.p1.cardsInHand, 'two in, two out').has.length(2);
    });
  });

  describe('rule 5 — the order of payment, and the composer\'s ONE batch', () => {
    function fullTable(): Table & {dirigibles: Dirigibles} {
      const t = inPlay(4, [new Luna(), 1, 1], [new Titan(), 1], [new Miranda(), 1], [new Pluto(), 1]);
      const dirigibles = new Dirigibles();
      t.p1.playedCards.push(dirigibles);
      deal(t, 2);
      return {...t, dirigibles};
    }

    it('the ledger of the preview reads the payment\'s order: Luna · Miranda · Pluto · Titan', () => {
      const t = fullTable();
      const branch = branchOf(t);
      expect(branch.colonyBonuses).deep.eq(allColonyBonusesLedger(t.p1, {via: HS}));
      expect(branch.colonyBonuses?.entries.map((e) => [e.colony, e.asks])).deep.eq([
        [ColonyName.LUNA, undefined], [ColonyName.MIRANDA, 'draw'], [ColonyName.PLUTO, 'draw-discard'], [ColonyName.TITAN, 'card'],
      ]);
      // The cost first, then the sums: 2 data off this card, +2 M€, +1 card (Miranda), +1 floater to a card.
      expect(branch.effects[0]).deep.include({direction: 'cost', icon: 'data', amount: 2, current: 4, resulting: 2, note: 'on this card'});
      expect(branch.effects.find((e) => e.icon === 'megacredits')).deep.include({amount: 2});
      expect(branch.effects.find((e) => e.icon === 'cards')).deep.include({amount: 1});
      expect(branch.effects.find((e) => e.icon === 'floater')).deep.include({amount: 1, note: 'to a card'});
    });

    it('the supply lands before any question; the batch `[action, {card}]` lands whole — the target PARKS behind Pluto\'s discard and lands after it', () => {
      const t = fullTable();
      t.p1.takeAction();
      const menu = cast(t.p1.getWaitingFor(), OrOptions);
      const perform = menu.options.findIndex((o) => o.title === 'Perform an action from a played card');
      expect(perform, 'the action menu offers the card action').gte(0);
      const batch: Array<InputResponse> = [
        {type: 'or', index: perform, response: {type: 'card', cards: [HS]}},
        {type: 'card', cards: [t.dirigibles.name]},
      ];
      replayBatch(t.p1, batch);

      // The response the client sees: the data spent, Luna and Miranda paid, Pluto's card drawn — and its discard asking.
      expect(t.card.resourceCount).eq(2);
      expect(t.p1.megaCredits).eq(2);
      expect(t.p1.cardDrawReveals.map((r) => r.source)).deep.eq([
        {type: 'colony', colonyName: ColonyName.MIRANDA, via: HS},
        {type: 'colony', colonyName: ColonyName.PLUTO, via: HS},
      ]);
      const discard = cast(t.p1.getWaitingFor(), SelectCard<IProjectCard>);
      expect(discard.discardPrompt?.colonyRepeat).deep.eq({colonyName: ColonyName.PLUTO, index: 1, total: 1});
      expect(parkedBatchTailLength(t.p1), 'the target answer is PARKED, not dropped').eq(1);
      expect(t.dirigibles.resourceCount, 'the floater has not landed yet').eq(0);

      // The player discards (the route: process, then drain the parked tail) — the target lands on its own prompt.
      t.p1.process({type: 'card', cards: [discard.cards[0].name]});
      drainBatchTail(t.p1);
      expect(parkedBatchTailLength(t.p1)).eq(0);
      expect(t.dirigibles.resourceCount).eq(1);
      expect(t.p1.cardsInHand, '2 held + Miranda + Pluto − the discard').has.length(3);
      expect(t.p1.actionsThisGeneration.has(HS), 'rule 9 — once per generation').is.true;
      expect(t.p1.getPlayableActionCards().map((c) => c.name)).does.not.include(HS);
    });
  });

  describe('the preview promises exactly what the action pays', () => {
    const TABLES: Array<{name: string, build: () => Table}> = [
      {name: 'supply only', build: () => inPlay(2, [new Luna(), 2], [new Ceres(), 1])},
      {
        name: 'with steps',
        build: () => {
          const t = inPlay(2, [new Luna(), 1], [new Titan(), 1], [new Miranda(), 1]);
          t.p1.playedCards.push(new Dirigibles());
          return t;
        },
      },
      {name: 'with a skip', build: () => inPlay(2, [new Titan(), 1], [new Ceres(), 1])},
    ];
    for (const scenario of TABLES) {
      it(`${scenario.name}: every chip's «resulting» is what the table holds after the action`, () => {
        const t = scenario.build();
        const branch = branchOf(t);
        actAsAction(t);
        // Answer every target with its first candidate.
        for (let guard = 0; guard < 6; guard++) {
          const waiting = t.p1.getWaitingFor();
          if (waiting === undefined) {
            break;
          }
          const select = cast(waiting, SelectCard<ICard>);
          t.p1.process({type: 'card', cards: [select.cards[0].name]});
        }
        for (const effect of branch.effects) {
          if (effect.icon === 'megacredits') {
            expect(t.p1.megaCredits, 'M€').eq(effect.resulting);
          } else if (effect.icon === 'steel') {
            expect(t.p1.steel, 'steel').eq(effect.resulting);
          } else if (effect.icon === 'data') {
            expect(t.card.resourceCount, 'data on the card').eq(effect.resulting);
          } else if (effect.icon === 'cards') {
            expect(t.p1.cardsInHand.length, 'cards drawn').eq(effect.amount);
          } else if (effect.icon === 'floater') {
            expect(t.p1.playedCards.asArray().filter((c) => c.resourceType === CardResource.FLOATER).reduce((sum, c) => sum + c.resourceCount, 0), 'floaters').eq(effect.amount);
          }
        }
      });
    }

    it('read-only: the previews change nothing', () => {
      const t = inPlay(4, [new Luna(), 1], [new Titan(), 1], [new Pluto(), 1]);
      t.p1.playedCards.push(new Dirigibles());
      const before = JSON.stringify(t.game.serialize());
      const events = t.game.events.events.length;
      actionPreview(t.p1, t.card);
      cardPlayPreview(t.p1, new HabitatScience());
      t.card.actionUnavailableReason(t.p1);
      expect(JSON.stringify(t.game.serialize())).eq(before);
      expect(t.game.events.events.length).eq(events);
      expect(t.game.deferredActions.length).eq(0);
    });
  });

  describe('save / load', () => {
    it('the stored data survive serialization, and the reloaded card still acts', () => {
      const t = inPlay(3, [new Luna(), 1]);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.p1.id);
      const again = owner.playedCards.get(HS) as HabitatScience | undefined;
      expect(again?.resourceCount).eq(3);
      expect(again?.canAct(owner)).is.true;
      again!.action(owner);
      runAllActions(reloaded);
      expect(again?.resourceCount).eq(1);
      expect(owner.megaCredits).eq(2);
    });
  });
});

import {expect} from 'chai';
import {
  DATA_BRANCH, DATA_TO_ANY_CARD, InfluentialDiscovery, SCIENCE_BRANCH, SCIENCE_TO_ANY_CARD,
} from '../../../src/server/cards/turmoilRedux/InfluentialDiscovery';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {MartianCensus} from '../../../src/server/cards/turmoilRedux/MartianCensus';
import {MartianFiber} from '../../../src/server/cards/turmoilRedux/MartianFiber';
import {Supercomputer} from '../../../src/server/cards/turmoilRedux/Supercomputer';
import {VectorComputations} from '../../../src/server/cards/turmoilRedux/VectorComputations';
import {OlympusConference} from '../../../src/server/cards/base/OlympusConference';
import {MarsUniversity} from '../../../src/server/cards/base/MarsUniversity';
import {PhysicsComplex} from '../../../src/server/cards/base/PhysicsComplex';
import {SearchForLife} from '../../../src/server/cards/base/SearchForLife';
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
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {NO_HOLDER_WARNING, SKIP_REASON} from '../../../src/server/cards/actionPreviews';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {ICard} from '../../../src/server/cards/ICard';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {formatMessage, runAllActions} from '../../TestingUtils';
import {parkedBatchTailLength, replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {isActionMenuTitle} from '../../../src/common/inputs/actionMenuTitles';

/**
 * TR51 — INFLUENTIAL DISCOVERY: the Scientists' plate, and TR43 Ichtiology
 * Grant's OPTIONAL `or` of two «add to ANY card» branches as the WHOLE card —
 * 1 science OR 6 data. Every rule reading of the card file's header is pinned
 * here on the real card: the plate's two roads (TR36 does not help), the
 * holder-gated branches (both / one / none — the card playable with the loss
 * named), the target never applied silently, the three batch forms landing
 * whole through `replayBatch`, the Science tag's neighbours (Olympus
 * Conference, Mars University, TR05) and Martian Fiber's +6 M€ on the data.
 */
const S = PartyName.SCIENTISTS;
const COST = 4;
const ID = CardName.INFLUENTIAL_DISCOVERY;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: InfluentialDiscovery};

/** A two-seat Redux table in the action phase, the Scientists RULING by an enacted card, the card in hand. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(S));
  const card = new InfluentialDiscovery();
  player.cardsInHand.push(card);
  player.megaCredits = 20;
  return {game, player, opponent, parliament, card};
}

function redsRule(t: Table): void {
  seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
  expect(t.parliament.rulingParty()).eq(PartyName.REDS);
}

/** `n` of the player's own cubes on the Scientists' quiet resolution. */
function scientistsCubes(t: Table, n: number): void {
  let slot = t.parliament.slotOf(S);
  if (slot === undefined) {
    seatResolution(t.parliament, 0, quietResolutionOf(S));
    slot = t.parliament.slotOf(S)!;
  }
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(t.player, slot, t.parliament.lobby.has(t.player.id) ? 'lobby' : 'reserve');
  }
}

function holder<T extends ICard>(player: TestPlayer, card: T, count: number): T {
  card.resourceCount = count;
  player.playedCards.push(card);
  return card;
}

function play(t: Table): void {
  t.player.playCard(t.card, Payment.of({megacredits: COST}));
  runAllActions(t.game);
}

/** The action menu's «Play project card» branch — the batch's head, as the composer wraps it. */
function playHead(t: Table): InputResponse {
  t.player.takeAction();
  const menu = cast(t.player.getWaitingFor(), OrOptions);
  const index = menu.options.findIndex((o) => o.title === 'Play project card');
  expect(index).is.greaterThan(-1);
  return {type: 'or', index, response: {type: 'projectCard', card: ID, payment: Payment.of({megacredits: COST})}};
}

/** After a whole batch the player stands at the NEXT action menu — no question of the card's is left. */
function expectActionMenu(t: Table): void {
  const wf = cast(t.player.getWaitingFor(), OrOptions);
  expect(isActionMenuTitle(typeof wf.title === 'string' ? wf.title : wf.title.message), 'the next action menu, not a prompt of the card').is.true;
  expect(wf.choiceContext).is.undefined;
}

describe('InfluentialDiscovery', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a green card for 4, Science, no VP, no storage, the SCIENTISTS\' plate, TR51 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(ID);
      expect(card.type).eq(CardType.AUTOMATED);
      expect(card.cost).eq(COST);
      expect(card.tags).deep.eq([Tag.SCIENCE]);
      expect(card.resourceType).is.undefined;
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(requiredPartyOf(card), 'the MIN plate holds the Scientists\' flask — a requirement, not a tag').eq(S);
      expect(card.requirements).has.length(1);
      expect(card.metadata.cardNumber).eq('TR51');
      expect(card.metadata.description).eq('Requires the Scientists to be ruling or that you have 2 delegates there. Add 1 science resource to ANY card, OR 6 data resources to ANY card.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[ID];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left: the module is the gate').is.undefined;
      expect(SCIENCE_TO_ANY_CARD).eq(1);
      expect(DATA_TO_ANY_CARD).eq(6);
      // ONE declaration: an OPTIONAL, auto-collapsing choice of two holder-gated branches — nothing beside it.
      expect(Object.keys(card.behavior ?? {})).deep.eq(['or']);
      expect(card.behavior?.or?.optional).is.true;
      expect(card.behavior?.or?.autoSelect).is.true;
      expect(card.behavior?.or?.behaviors.map((b) => [b.title, b.addResourcesToAnyCard])).deep.eq([
        [SCIENCE_BRANCH, {type: CardResource.SCIENCE, count: 1, mustHaveCard: true}],
        [DATA_BRANCH, {type: CardResource.DATA, count: 6, mustHaveCard: true}],
      ]);
      expect((card as ICard).cardPlayPreview, 'no hook — the declaration is the preview').is.undefined;
      expect((card as ICard).cardPlayedForecast, 'no forecast of its own').is.undefined;
    });

    it('the face reads the scan: «[science]* OR 6 [data]*» — one row, the digit before the data', () => {
      type Node = {is?: string, type?: string, amount?: number, showDigit?: boolean, secondaryTag?: unknown, resource?: string};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node | string>>}).rows;
      expect(rows).has.length(1);
      const items = rows[0].filter((n): n is Node => typeof n === 'object');
      // item · asterisk («to ANY card») · OR · item · asterisk.
      expect(items.map((n) => n.is)).deep.eq(['item', 'symbol', 'symbol', 'item', 'symbol']);
      expect([items[0].type, items[0].amount], 'ONE science — the bare icon, no number (the DSL\'s −1)').deep.eq([CardRenderItemType.RESOURCE, -1]);
      expect([items[3].type, items[3].amount, items[3].showDigit]).deep.eq([CardRenderItemType.RESOURCE, 6, true]);
      expect(items[1].type, 'the asterisk').eq(items[4].type);
      expect(items[2].type, 'the OR between the branches').not.eq(items[1].type);
    });

    it('the structured text prints the requirement line and the choice', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks) ?? [];
      expect(blocks.map((b) => b.text)).deep.eq([
        'Requires Scientists to be ruling or that you have 2 delegates on its resolution.',
        'Add 1 science resource or 6 data to ANY card.',
      ]);
    });
  });

  describe('rule 1 — the requirement: the Scientists rule, or 2 of your delegates on their resolution', () => {
    it('the Scientists ruling: playable with no delegate anywhere', () => {
      expect(t.parliament.rulingParty()).eq(S);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('the Reds ruling: «0 of 2» with the named reason; one cube: «1 of 2»; two: playable', () => {
      redsRule(t);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [S, '2'], party: S, current: 0, requirement: true, requirementKey: 'req:party',
      });
      scientistsCubes(t, 1);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: S, current: 1});
      scientistsCubes(t, 1);
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never a REQUIREMENT\'s: with one cube the card still reads «1 of 2»', () => {
      redsRule(t);
      t.player.playedCards.push(new CouncilSeat());
      scientistsCubes(t, 1);
      expect(t.parliament.hasPartyEffect(t.player, S)).is.true;
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: S, current: 1, params: [S, '2']});
    });
  });

  describe('rules 2–4 — the choice: holder-gated branches, a shown target, never automatic; no holder at all — still a play', () => {
    it('holders of BOTH kinds: an OrOptions of two sourced by the card, then the target pick of the chosen kind', () => {
      const physics = holder(t.player, new PhysicsComplex(), 0);
      const census = holder(t.player, new MartianCensus(), 1);
      play(t);
      const or = cast(t.player.getWaitingFor(), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([SCIENCE_BRANCH, DATA_BRANCH]);
      expect(or.choiceContext).deep.include({mode: 'effect-choice'});
      expect(or.choiceContext?.source).deep.include({kind: 'card', card: ID});
      or.process({type: 'or', index: 1, response: {type: 'option'}}, t.player);
      runAllActions(t.game);
      const target = cast(t.player.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.MARTIAN_CENSUS]);
      expect(census.resourceCount, 'nothing lands before the pick').eq(1);
      target.process({type: 'card', cards: [CardName.MARTIAN_CENSUS]});
      expect(census.resourceCount).eq(7);
      expect(physics.resourceCount).eq(0);
    });

    it('the science branch: the pick lists EVERY own science holder — Physics Complex takes 1 and is worth 2 VP; Search for Life 0 → 1 is worth 3', () => {
      const physics = holder(t.player, new PhysicsComplex(), 0);
      const search = holder(t.player, new SearchForLife(), 0);
      // К-T2: the pick reads what the ONE science does to each candidate's points BEFORE the press — Search for Life's
      // bespoke threshold too (its own `victoryPointsAtResources`), never «storage».
      const step = cardPlayPreview(t.player, t.card).branches.find((b) => b.available)!.steps[0];
      expect(step.kind === 'input' && step.vpBox).deep.eq({
        [CardName.PHYSICS_COMPLEX]: {from: 0, to: 2},
        [CardName.SEARCH_FOR_LIFE]: {from: 0, to: 3},
      });
      play(t);
      const target = cast(t.player.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.PHYSICS_COMPLEX, CardName.SEARCH_FOR_LIFE]);
      target.process({type: 'card', cards: [CardName.SEARCH_FOR_LIFE]});
      expect(search.resourceCount).eq(1);
      expect(search.getVictoryPoints()).eq(3);
      expect(physics.resourceCount).eq(0);
    });

    it('ONE kind alive (data only): the lone branch collapses to its bare target pick — SHOWN, never applied silently', () => {
      const census = holder(t.player, new MartianCensus(), 0);
      play(t);
      const target = cast(t.player.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.MARTIAN_CENSUS]);
      expect(census.resourceCount).eq(0);
      target.process({type: 'card', cards: [CardName.MARTIAN_CENSUS]});
      expect(census.resourceCount).eq(DATA_TO_ANY_CARD);
    });

    it('«ANY card» is any of YOUR cards: an opponent\'s holder is never a candidate', () => {
      holder(t.opponent, new PhysicsComplex(), 0);
      holder(t.opponent, new Supercomputer(), 0);
      const search = holder(t.player, new SearchForLife(), 0);
      play(t);
      const target = cast(t.player.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.SEARCH_FOR_LIFE]);
      target.process({type: 'card', cards: [CardName.SEARCH_FOR_LIFE]});
      expect(search.resourceCount).eq(1);
    });

    it('NO holder of either kind: the card is PLAYABLE, nothing is asked, and each branch is skipped BY NAME', () => {
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
      play(t);
      expect(t.player.getWaitingFor()).is.undefined;
      expect(t.player.playedCards.get(ID)).eq(t.card);
      const skipped = t.game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped!);
      expect(skipped).deep.eq([
        {label: SCIENCE_BRANCH, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'science', amount: 1, note: 'to a card'}},
        {label: DATA_BRANCH, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'data', amount: 6, note: 'to a card'}},
      ]);
      const lines = t.game.gameLog.map((m) => formatMessage(m)).filter((l) => l.includes('effect skipped'));
      expect(lines).deep.eq([
        `${t.player.color} — effect skipped: ${SCIENCE_BRANCH} (${SKIP_REASON.noHolder})`,
        `${t.player.color} — effect skipped: ${DATA_BRANCH} (${SKIP_REASON.noHolder})`,
      ]);
    });
  });

  describe('the PREVIEW — what the composer promises, per holder set', () => {
    it('both kinds: two variants, runtime indices 0 / 1, each with its own gain and ONE target step', () => {
      holder(t.player, new PhysicsComplex(), 0);
      holder(t.player, new Supercomputer(), 0);
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.kind).eq('declarative');
      expect(preview.branches.map((b) => [b.index, b.title, b.available])).deep.eq([[0, SCIENCE_BRANCH, true], [1, DATA_BRANCH, true]]);
      expect(preview.branches[0].effects.map((e) => [e.icon, e.amount, e.note])).deep.eq([['science', 1, 'to a card']]);
      expect(preview.branches[1].effects.map((e) => [e.icon, e.amount, e.note])).deep.eq([['data', 6, 'to a card']]);
      for (const b of preview.branches) {
        expect(b.steps.map((s) => s.kind)).deep.eq(['input']);
      }
      const step = preview.branches[1].steps[0];
      expect(step.kind === 'input' && step.amount).eq(6);
      expect(step.kind === 'input' && step.cardResource).eq('data');
      expect(step.kind === 'input' && step.input.type === 'card' && step.input.cards.map((c) => c.name)).deep.eq([CardName.SUPERCOMPUTER]);
    });

    it('one kind: the lone branch at index −1 (no OrOptions), the other greyed with the holder reason — the row never disappears', () => {
      holder(t.player, new Supercomputer(), 0);
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.branches.map((b) => [b.index, b.title, b.available])).deep.eq([[-1, SCIENCE_BRANCH, false], [-1, DATA_BRANCH, true]]);
      expect(preview.branches[0].unavailableReason).eq('No card to add the resource to');
      expect(preview.branches[1].steps.map((s) => s.kind)).deep.eq(['input']);
    });

    it('no holder: ONE general branch with a named warning per skipped branch, both variants greyed', () => {
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.branches.map((b) => [b.index, b.title, b.available])).deep.eq([
        [-1, '', true], [-1, SCIENCE_BRANCH, false], [-1, DATA_BRANCH, false],
      ]);
      const general = preview.branches[0];
      expect(general.effects).deep.eq([]);
      expect(general.steps.map((s) => s.kind === 'note' ? [s.noteKind, s.text, s.skipped?.label] : s.kind)).deep.eq([
        ['warning', NO_HOLDER_WARNING, SCIENCE_BRANCH],
        ['warning', NO_HOLDER_WARNING, DATA_BRANCH],
      ]);
    });
  });

  describe('rule 6 — the BATCH lands WHOLE through `replayBatch`', () => {
    it('[play, {or, index 1, {option}}, {card: Supercomputer}] — both pre-selects land, nothing is asked, nothing parks', () => {
      const physics = holder(t.player, new PhysicsComplex(), 0);
      const supercomputer = holder(t.player, new Supercomputer(), 0);
      const preview = cardPlayPreview(t.player, t.card);
      const data = preview.branches.find((b) => b.title === DATA_BRANCH)!;
      expect(data.index).eq(1);
      replayBatch(t.player, [
        playHead(t),
        {type: 'or', index: data.index, response: {type: 'option'}},
        {type: 'card', cards: [CardName.SUPERCOMPUTER]},
      ]);
      expectActionMenu(t);
      expect(parkedBatchTailLength(t.player)).eq(0);
      expect(supercomputer.resourceCount).eq(6);
      expect(physics.resourceCount).eq(0);
      expect(t.player.playedCards.get(ID)).eq(t.card);
    });

    it('collapsed — [play, {card: Physics Complex}] — the bare target answer meets the bare target prompt', () => {
      const physics = holder(t.player, new PhysicsComplex(), 0);
      expect(cardPlayPreview(t.player, t.card).branches.find((b) => b.available)?.index, 'the lone branch: no OrOptions').eq(-1);
      replayBatch(t.player, [playHead(t), {type: 'card', cards: [CardName.PHYSICS_COMPLEX]}]);
      expectActionMenu(t);
      expect(parkedBatchTailLength(t.player)).eq(0);
      expect(physics.resourceCount).eq(1);
    });

    it('no holder — [play] alone — the play completes with the two skips recorded', () => {
      replayBatch(t.player, [playHead(t)]);
      expectActionMenu(t);
      expect(parkedBatchTailLength(t.player)).eq(0);
      expect(t.game.events.events.filter((e) => e.type === 'effect-skipped')).has.length(2);
    });
  });

  describe('rule 5 — the Science tag wakes the neighbours; 6 data answer Martian Fiber', () => {
    it('TR05 Vector Computations takes +2 data for the tag — and with Martian Fiber the data branch pays +6 M€ on ANY target', () => {
      const vector = holder(t.player, new VectorComputations(), 0);
      const fiber = holder(t.player, new MartianFiber(), 0);
      const census = holder(t.player, new MartianCensus(), 0);
      const facts = effectForecastForPlay(t.player, t.card, cardPlayPreview(t.player, t.card)).facts;
      expect(facts.find((f) => f.source.name === CardName.VECTOR_COMPUTATIONS)?.effects[0]).deep.include({icon: 'data', amount: 2});
      play(t);
      expect(vector.resourceCount, 'TR05 answers the Science tag').eq(2);
      const target = cast(t.player.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.VECTOR_COMPUTATIONS, CardName.MARTIAN_FIBER, CardName.MARTIAN_CENSUS]);
      const before = t.player.megaCredits;
      target.process({type: 'card', cards: [CardName.MARTIAN_CENSUS]});
      runAllActions(t.game);
      expect(census.resourceCount).eq(6);
      expect(fiber.resourceCount).eq(0);
      expect(t.player.megaCredits - before, 'Martian Fiber: +1 M€ per data added, whatever card took them').eq(6);
    });

    it('Olympus Conference at 0 science takes its science silently; the card\'s own choice then lists it as a science holder', () => {
      const olympus = holder(t.player, new OlympusConference(), 0);
      holder(t.player, new Supercomputer(), 0);
      play(t);
      expect(olympus.resourceCount, 'Olympus answers the tag before the card\'s choices').eq(1);
      const or = cast(t.player.getWaitingFor(), OrOptions);
      expect(or.choiceContext?.source).deep.include({kind: 'card', card: ID});
      or.process({type: 'or', index: 0, response: {type: 'option'}}, t.player);
      runAllActions(t.game);
      const target = cast(t.player.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.OLYMPUS_CONFERENCE]);
      target.process({type: 'card', cards: [CardName.OLYMPUS_CONFERENCE]});
      expect(olympus.resourceCount, 'an ordinary science resource — no second draw question').eq(2);
    });

    it('Olympus Conference at 1 science ASKS first (its own question, before the card\'s choice); Mars University asks after it', () => {
      holder(t.player, new OlympusConference(), 1);
      t.player.playedCards.push(new MarsUniversity());
      t.player.cardsInHand.push(new PhysicsComplex());
      const asks = effectForecastForPlay(t.player, t.card, cardPlayPreview(t.player, t.card)).facts.filter((f) => f.certainty === 'asks');
      expect(asks.map((f) => f.source.name)).deep.eq([CardName.OLYMPUS_CONFERENCE, CardName.MARS_UNIVERSITY]);
      play(t);
      const olympus = cast(t.player.getWaitingFor(), OrOptions);
      expect(olympus.options.map((o) => o.title)).deep.eq(['Remove a science resource from this card to draw a card', 'Add a science resource to this card']);
    });
  });

  describe('rule 7 — the journal names the target', () => {
    it('«added 6 data to Supercomputer» — under the card\'s own source', () => {
      holder(t.player, new Supercomputer(), 0);
      play(t);
      cast(t.player.getWaitingFor(), SelectCard).process({type: 'card', cards: [CardName.SUPERCOMPUTER]});
      const lines = t.game.gameLog.map((m) => formatMessage(m));
      expect(lines, lines.join('\n')).to.include(`${t.player.color} added 6 Data to ${CardName.SUPERCOMPUTER}`);
    });
  });

  describe('rule 8 — MarsBot, save / load', () => {
    it('the bot holds no card: with the bot as the only other seat «any card» is still the human\'s own table', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.phase = Phase.ACTION;
      seatEnacted(game.parliament!, quietResolutionOf(S));
      const card = new InfluentialDiscovery();
      const physics = new PhysicsComplex();
      human.playedCards.push(physics);
      human.cardsInHand.push(card);
      human.megaCredits = 20;
      expect(human.canPlay(card)).is.true;
      human.playCard(card, Payment.of({megacredits: COST}));
      runAllActions(game);
      const target = cast(human.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.PHYSICS_COMPLEX]);
    });

    it('the holder\'s resources survive a reload as ordinary fields', () => {
      holder(t.player, new PhysicsComplex(), 0);
      play(t);
      cast(t.player.getWaitingFor(), SelectCard).process({type: 'card', cards: [CardName.PHYSICS_COMPLEX]});
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.player.id);
      expect((again.playedCards.get(CardName.PHYSICS_COMPLEX) as IProjectCard).resourceCount).eq(1);
      expect(again.playedCards.get(ID)).is.not.undefined;
    });
  });
});

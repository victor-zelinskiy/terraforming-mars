import {expect} from 'chai';
import {
  FIGHTERS_BRANCH, FIGHTERS_TO_ANY_CARD, FLOATERS_BRANCH, FLOATERS_TO_ANY_CARD, MECHS_BRANCH, MECHS_TO_ANY_CARD, RoboticsFactory,
} from '../../../src/server/cards/turmoilRedux/RoboticsFactory';
import {ConstructionMechs} from '../../../src/server/cards/turmoilRedux/ConstructionMechs';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {SecurityFleet} from '../../../src/server/cards/base/SecurityFleet';
import {Dirigibles} from '../../../src/server/cards/venusNext/Dirigibles';
import {AerialMappers} from '../../../src/server/cards/venusNext/AerialMappers';
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
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
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
import {recomputeRootImpact} from '../../../src/client/components/notifications/notificationModel';
import {isActionMenuTitle} from '../../../src/common/inputs/actionMenuTitles';

/**
 * TR56 — ROBOTICS FACTORY: the Industrialists' fourth plate, ONE declaration
 * of TR43's optional `or` of «add to ANY card» branches — here THREE (mechs ·
 * fighters · floaters), three holder sets behind one variant row. Every rule
 * reading of the card file's header is pinned on the real card; the preview's
 * promise is held to the play's result, and both batch forms land whole.
 */
const I = PartyName.INDUSTRIALISTS;
const COST = 7;
const RF = CardName.ROBOTICS_FACTORY;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: RoboticsFactory};

/** A two-seat Redux table in the action phase, the Industrialists RULING, the card in hand and 20 M€. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(I));
  const card = new RoboticsFactory();
  player.cardsInHand.push(card);
  player.megaCredits = 20;
  return {game, player, opponent, parliament, card};
}

function play(t: Table, payment: Payment = Payment.of({megacredits: COST})): void {
  t.player.playCard(t.card, payment);
  runAllActions(t.game);
}

/** The action menu's «Play project card» branch — the batch's head, as the composer wraps it. */
function playHead(t: Table, payment: Payment = Payment.of({megacredits: COST})): InputResponse {
  t.player.takeAction();
  const menu = cast(t.player.getWaitingFor(), OrOptions);
  const index = menu.options.findIndex((o) => o.title === 'Play project card');
  expect(index).is.greaterThan(-1);
  return {type: 'or', index, response: {type: 'projectCard', card: RF, payment}};
}

function expectActionMenu(t: Table): void {
  const wf = cast(t.player.getWaitingFor(), OrOptions);
  expect(isActionMenuTitle(typeof wf.title === 'string' ? wf.title : wf.title.message), 'the next action menu, not a prompt of the card').is.true;
  expect(wf.choiceContext).is.undefined;
}

/** One holder of each kind: Construction Mechs (2 mechs — the tender), Security Fleet (1 fighter — VP), Dirigibles. */
function holders(t: Table): {mechs: ConstructionMechs, fleet: SecurityFleet, dirigibles: Dirigibles} {
  const mechs = new ConstructionMechs();
  mechs.resourceCount = 2;
  const fleet = new SecurityFleet();
  fleet.resourceCount = 1;
  const dirigibles = new Dirigibles();
  t.player.playedCards.push(mechs, fleet, dirigibles);
  return {mechs, fleet, dirigibles};
}

describe('RoboticsFactory', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a green card for 7, Building, no VP, no storage, the INDUSTRIALISTS\' plate, TR56 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(RF);
      expect(card.type).eq(CardType.AUTOMATED);
      expect(card.cost).eq(COST);
      expect(card.tags, 'the corner holds one brown disc with the house').deep.eq([Tag.BUILDING]);
      expect(card.resourceType).is.undefined;
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(requiredPartyOf(card), 'the MIN plate holds the Industrialists\' cog — a requirement, not a tag').eq(I);
      expect(card.requirements).has.length(1);
      expect(card.metadata.cardNumber).eq('TR56');
      expect(card.metadata.description).eq('Requires the Industrialists to be ruling or that you have 2 delegates there. Add 3 mech resources to ANY card, OR 3 fighter resources to ANY card, OR 6 floater resources to ANY card.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[RF];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left: the module is the gate').is.undefined;
      expect([MECHS_TO_ANY_CARD, FIGHTERS_TO_ANY_CARD, FLOATERS_TO_ANY_CARD]).deep.eq([3, 3, 6]);
      // ONE declaration: an OPTIONAL, auto-collapsing choice of three holder-gated branches, in the printed order.
      expect(card.behavior).deep.eq({
        or: {
          optional: true,
          autoSelect: true,
          behaviors: [
            {title: MECHS_BRANCH, addResourcesToAnyCard: {type: CardResource.MECH, count: 3, mustHaveCard: true}},
            {title: FIGHTERS_BRANCH, addResourcesToAnyCard: {type: CardResource.FIGHTER, count: 3, mustHaveCard: true}},
            {title: FLOATERS_BRANCH, addResourcesToAnyCard: {type: CardResource.FLOATER, count: 6, mustHaveCard: true}},
          ],
        },
      });
      expect((card as ICard).cardPlayPreview, 'no hook — the declaration is the preview').is.undefined;
    });

    it('the face reads the scan: ONE row — «3 [mech]* OR 3 [fighter]* OR 6 [floater]*», digits beside single icons', () => {
      type Node = {type?: string, resource?: string, amount?: number, showDigit?: boolean};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node | string>>}).rows;
      expect(rows).has.length(1);
      const items = rows[0].filter((n): n is Node => typeof n === 'object');
      const resources = items.filter((n) => n.type === 'resource');
      expect(resources.map((n) => [n.resource, n.amount, n.showDigit])).deep.eq([
        [CardResource.MECH, 3, true], [CardResource.FIGHTER, 3, true], [CardResource.FLOATER, 6, true],
      ]);
      expect(items.filter((n) => n.type === 'OR'), 'two printed OR between three payloads').has.length(2);
      expect(items.filter((n) => n.type === '*'), 'every payload wears the «to ANY card» asterisk').has.length(3);
    });

    it('the structured text: the requirement line, then the choice in ONE block', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks) ?? [];
      expect(blocks.map((b) => b.text)).deep.eq([
        'Requires Industrialists to be ruling or that you have 2 delegates on its resolution.',
        'Add 3 mechs, 3 fighters or 6 floaters to ANY card.',
      ]);
    });
  });

  describe('rule 1 — the requirement: the Industrialists rule, or 2 of your delegates on their resolution', () => {
    function industrialistsCubes(player: TestPlayer, n: number): void {
      let slot = t.parliament.slotOf(I);
      if (slot === undefined) {
        seatResolution(t.parliament, 0, quietResolutionOf(I));
        slot = t.parliament.slotOf(I)!;
      }
      for (let i = 0; i < n; i++) {
        t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
      }
    }

    beforeEach(() => {
      seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
      expect(t.parliament.rulingParty()).eq(PartyName.REDS);
    });

    it('the Reds ruling: «0 of 2» with the named reason; one cube: «1 of 2»; two: playable', () => {
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [I, '2'], party: I, current: 0, requirement: true, requirementKey: 'req:party',
      });
      industrialistsCubes(t.player, 1);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: I, current: 1});
      industrialistsCubes(t.player, 1);
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('the OPPONENT\'s two cubes do not open it; TR36 Council Seat lowers an EFFECT\'s threshold, never a REQUIREMENT\'s', () => {
      industrialistsCubes(t.opponent, 2);
      expect(t.player.canPlay(t.card)).is.false;
      t.player.playedCards.push(new CouncilSeat());
      industrialistsCubes(t.player, 1);
      expect(t.parliament.hasPartyEffect(t.player, I)).is.true;
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: I, current: 1, params: [I, '2']});
    });
  });

  describe('rules 2–3 — the choice: holder-gated branches in the printed order, a SHOWN target, never automatic', () => {
    it('holders of ALL kinds: an OrOptions of three sourced by the card; each branch opens ITS OWN holder set', () => {
      const {mechs, fleet, dirigibles} = holders(t);
      play(t);
      const or = cast(t.player.getWaitingFor(), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([MECHS_BRANCH, FIGHTERS_BRANCH, FLOATERS_BRANCH]);
      expect(or.choiceContext).deep.include({mode: 'effect-choice'});
      expect(or.choiceContext?.source).deep.include({kind: 'card', card: RF});
      or.process({type: 'or', index: 2, response: {type: 'option'}}, t.player);
      runAllActions(t.game);
      const target = cast(t.player.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name), 'the floater branch offers the floater holders only').deep.eq([CardName.DIRIGIBLES]);
      expect(dirigibles.resourceCount, 'nothing lands before the pick').eq(0);
      target.process({type: 'card', cards: [CardName.DIRIGIBLES]});
      expect(dirigibles.resourceCount).eq(6);
      expect([mechs.resourceCount, fleet.resourceCount], 'the other kinds untouched').deep.eq([2, 1]);
    });

    it('ONE holder of ONE kind: the lone branch collapses to its bare target pick — SHOWN, its title the payload, never «this card»', () => {
      const fleet = new SecurityFleet();
      t.player.playedCards.push(fleet);
      play(t);
      const target = cast(t.player.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.SECURITY_FLEET]);
      expect(formatMessage(target.title), 'a lone FOREIGN holder is a target: the payload names itself').eq('Select a card — Fighter: +3');
      expect(fleet.resourceCount).eq(0);
      target.process({type: 'card', cards: [CardName.SECURITY_FLEET]});
      expect(fleet.resourceCount).eq(3);
    });

    it('two floater holders: the pick lists both, in tableau order', () => {
      const dirigibles = new Dirigibles();
      const mappers = new AerialMappers();
      t.player.playedCards.push(dirigibles, mappers);
      play(t);
      const target = cast(t.player.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.DIRIGIBLES, CardName.AERIAL_MAPPERS]);
      target.process({type: 'card', cards: [CardName.AERIAL_MAPPERS]});
      expect(mappers.resourceCount).eq(6);
      expect(dirigibles.resourceCount).eq(0);
    });

    it('«ANY card» is any of YOUR cards: an opponent\'s holder is never a candidate', () => {
      t.opponent.playedCards.push(new ConstructionMechs(), new SecurityFleet());
      const dirigibles = new Dirigibles();
      t.player.playedCards.push(dirigibles);
      play(t);
      const target = cast(t.player.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.DIRIGIBLES]);
    });
  });

  describe('rule 4 — no holder of any kind: the card is still PLAYED, and each branch is skipped BY NAME', () => {
    it('playable with no holder, nothing asked, three named skips in the events and the journal', () => {
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
      play(t);
      expect(t.player.getWaitingFor()).is.undefined;
      expect(t.player.playedCards.get(RF), 'the Building tag is on the table').eq(t.card);
      expect(t.player.tags.count(Tag.BUILDING, 'raw')).eq(1);
      const skipped = t.game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped!);
      expect(skipped).deep.eq([
        {label: MECHS_BRANCH, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'mech', amount: 3, note: 'to a card'}},
        {label: FIGHTERS_BRANCH, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'fighter', amount: 3, note: 'to a card'}},
        {label: FLOATERS_BRANCH, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'floater', amount: 6, note: 'to a card'}},
      ]);
      const lines = t.game.gameLog.map((m) => formatMessage(m)).filter((l) => l.includes('effect skipped'));
      expect(lines).deep.eq([
        `${t.player.color} — effect skipped: ${MECHS_BRANCH} (${SKIP_REASON.noHolder})`,
        `${t.player.color} — effect skipped: ${FIGHTERS_BRANCH} (${SKIP_REASON.noHolder})`,
        `${t.player.color} — effect skipped: ${FLOATERS_BRANCH} (${SKIP_REASON.noHolder})`,
      ]);
    });
  });

  describe('the PREVIEW — what the composer promises, per holder set', () => {
    it('all kinds: three variants, runtime indices 0 / 1 / 2, each with its own gain and ONE target step over ITS holders', () => {
      holders(t);
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.kind).eq('declarative');
      expect(preview.branches.map((b) => [b.index, b.title, b.available])).deep.eq([
        [0, MECHS_BRANCH, true], [1, FIGHTERS_BRANCH, true], [2, FLOATERS_BRANCH, true],
      ]);
      expect(preview.branches.map((b) => b.effects.map((e) => [e.icon, e.amount, e.note]))).deep.eq([
        [['mech', 3, 'to a card']], [['fighter', 3, 'to a card']], [['floater', 6, 'to a card']],
      ]);
      const targets = preview.branches.map((b) => {
        expect(b.steps.map((s) => s.kind)).deep.eq(['input']);
        const step = b.steps[0];
        return step.kind === 'input' && step.input.type === 'card' ? step.input.cards.map((c) => c.name) : [];
      });
      expect(targets, 'each variant names its OWN destinations — the server\'s set, never the client\'s').deep.eq([
        [CardName.CONSTRUCTION_MECHS], [CardName.SECURITY_FLEET], [CardName.DIRIGIBLES],
      ]);
    });

    it('rule 7 — a holder with a ROLE: Security Fleet\'s VP reading rides the target marker («1 → 4»)', () => {
      holders(t);
      const fighters = cardPlayPreview(t.player, t.card).branches.find((b) => b.title === FIGHTERS_BRANCH)!;
      const step = fighters.steps[0];
      expect(step.kind === 'input' && step.input.type === 'card').is.true;
      const marker = step.kind === 'input' && step.input.type === 'card' ? step.input.resourceGainPrompt : undefined;
      expect(marker).deep.include({amount: 3, cardResource: 'fighter'});
      expect(marker?.vpBox?.[CardName.SECURITY_FLEET]).deep.include({from: 1, to: 4});
    });

    it('one kind: the lone branch at index −1, the other two greyed with the holder reason — the row never loses a variant', () => {
      t.player.playedCards.push(new Dirigibles());
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.branches.map((b) => [b.index, b.title, b.available])).deep.eq([
        [-1, MECHS_BRANCH, false], [-1, FIGHTERS_BRANCH, false], [-1, FLOATERS_BRANCH, true],
      ]);
      expect(preview.branches[0].unavailableReason).eq('No card to add the resource to');
      expect(preview.branches[1].unavailableReason).eq('No card to add the resource to');
    });

    it('no holder: ONE general branch (a named warning per skipped branch) and the three variants greyed', () => {
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.branches.map((b) => [b.index, b.title, b.available])).deep.eq([
        [-1, '', true], [-1, MECHS_BRANCH, false], [-1, FIGHTERS_BRANCH, false], [-1, FLOATERS_BRANCH, false],
      ]);
      expect(preview.branches[0].steps.map((s) => s.kind === 'note' ? [s.noteKind, s.text, s.skipped?.label] : s.kind)).deep.eq([
        ['warning', NO_HOLDER_WARNING, MECHS_BRANCH],
        ['warning', NO_HOLDER_WARNING, FIGHTERS_BRANCH],
        ['warning', NO_HOLDER_WARNING, FLOATERS_BRANCH],
      ]);
    });

    it('rule 10 — the preview mutates nothing: the table reads the same before and after', () => {
      const {mechs, fleet, dirigibles} = holders(t);
      const before = JSON.stringify(t.game.serialize());
      cardPlayPreview(t.player, t.card);
      expect(JSON.stringify(t.game.serialize())).eq(before);
      expect([mechs.resourceCount, fleet.resourceCount, dirigibles.resourceCount]).deep.eq([2, 1, 0]);
    });
  });

  describe('rule 5 — the BATCH lands WHOLE through `replayBatch`', () => {
    it('[play, {or, index 0, {option}}, {card: Construction Mechs}] — both pre-selects land, nothing is asked, nothing parks', () => {
      const {mechs, fleet, dirigibles} = holders(t);
      const preview = cardPlayPreview(t.player, t.card);
      const mechBranch = preview.branches.find((b) => b.title === MECHS_BRANCH)!;
      expect(mechBranch.index).eq(0);
      replayBatch(t.player, [
        playHead(t),
        {type: 'or', index: mechBranch.index, response: {type: 'option'}},
        {type: 'card', cards: [CardName.CONSTRUCTION_MECHS]},
      ]);
      expectActionMenu(t);
      expect(parkedBatchTailLength(t.player)).eq(0);
      expect([mechs.resourceCount, fleet.resourceCount, dirigibles.resourceCount]).deep.eq([5, 1, 0]);
    });

    it('collapsed — [play, {card: Dirigibles}] — the bare target answer meets the bare target prompt', () => {
      const dirigibles = new Dirigibles();
      t.player.playedCards.push(dirigibles);
      expect(cardPlayPreview(t.player, t.card).branches[2].index, 'the lone branch: no OrOptions').eq(-1);
      replayBatch(t.player, [playHead(t), {type: 'card', cards: [CardName.DIRIGIBLES]}]);
      expectActionMenu(t);
      expect(parkedBatchTailLength(t.player)).eq(0);
      expect(dirigibles.resourceCount).eq(6);
    });

    it('no holder — [play] alone — the play completes with the three skips recorded', () => {
      replayBatch(t.player, [playHead(t)]);
      expectActionMenu(t);
      expect(parkedBatchTailLength(t.player)).eq(0);
      expect(t.game.events.events.filter((e) => e.type === 'effect-skipped')).has.length(3);
    });
  });

  describe('rule 6 — the Building tag: Construction Mechs PAYS for it, and the mechs may come back onto the same card', () => {
    it('the mech lane is open for this card; the price leaves the capsule BEFORE the effect (2 → 1 → 4, never 2 → 5)', () => {
      const {mechs} = holders(t);
      expect(t.player.paymentOptionsForCard(t.card).constructionMechs).is.true;
      play(t, Payment.of({megacredits: 2, constructionMechs: 1}));
      expect(mechs.resourceCount, 'the price is taken at the play').eq(1);
      expect(t.player.megaCredits).eq(18);
      const or = cast(t.player.getWaitingFor(), OrOptions);
      or.process({type: 'or', index: 0, response: {type: 'option'}}, t.player);
      runAllActions(t.game);
      const target = cast(t.player.getWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.CONSTRUCTION_MECHS]);
      target.process({type: 'card', cards: [CardName.CONSTRUCTION_MECHS]});
      expect(mechs.resourceCount).eq(4);
    });

    it('the whole pool can pay and the factory refills it — one addressed batch', () => {
      const mechs = new ConstructionMechs();
      mechs.resourceCount = 2;
      t.player.playedCards.push(mechs);
      replayBatch(t.player, [playHead(t, Payment.of({constructionMechs: 2})), {type: 'card', cards: [CardName.CONSTRUCTION_MECHS]}]);
      expectActionMenu(t);
      expect(mechs.resourceCount, '2 → 0 at the price → 3 on the effect').eq(3);
      expect(t.player.megaCredits, 'the mechs paid the whole 7 (worth 10)').eq(20);
    });
  });

  describe('rule 8 — the journal and the rival', () => {
    it('the journal names the target («added 3 mechs to Construction Mechs»); the rival\'s notification carries the card chip', () => {
      const {mechs} = holders(t);
      t.game.events.beginAction(t.player, {kind: 'card', card: RF, owner: t.player.color}, {category: 'card-play'});
      try {
        play(t);
        cast(t.player.getWaitingFor(), OrOptions).process({type: 'or', index: 0, response: {type: 'option'}}, t.player);
        runAllActions(t.game);
        cast(t.player.getWaitingFor(), SelectCard).process({type: 'card', cards: [CardName.CONSTRUCTION_MECHS]});
      } finally {
        t.game.events.endScope();
      }
      expect(mechs.resourceCount).eq(5);
      const lines = t.game.gameLog.map((m) => formatMessage(m));
      expect(lines.some((l) => l.includes(CardName.CONSTRUCTION_MECHS) && l.includes('3')), lines.join('\n')).is.true;
      const root = t.game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === RF)!.id;
      const impact = recomputeRootImpact(t.game.events.events, root, t.player.color, t.opponent.color);
      const chips = impact.pillGroups.flatMap((g) => g.chips);
      expect(chips.some((c) => c.icon.toLowerCase() === 'mech' && c.text === '+3'), JSON.stringify(impact.pillGroups)).is.true;
    });
  });

  describe('rule 9 — MarsBot; save / load', () => {
    it('the bot holds no card: «any card» against the bot is still the human\'s own table', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.phase = Phase.ACTION;
      seatEnacted(game.parliament!, quietResolutionOf(I));
      const card = new RoboticsFactory();
      const dirigibles = new Dirigibles();
      human.playedCards.push(dirigibles);
      human.cardsInHand.push(card);
      human.megaCredits = 20;
      expect(human.canPlay(card)).is.true;
      human.playCard(card, Payment.of({megacredits: COST}));
      runAllActions(game);
      expect(cast(human.getWaitingFor(), SelectCard).cards.map((c) => c.name)).deep.eq([CardName.DIRIGIBLES]);
    });

    it('save / load adds nothing: the landed resources are ordinary fields, the card stands on the table', () => {
      holders(t);
      play(t);
      cast(t.player.getWaitingFor(), OrOptions).process({type: 'or', index: 1, response: {type: 'option'}}, t.player);
      runAllActions(t.game);
      cast(t.player.getWaitingFor(), SelectCard).process({type: 'card', cards: [CardName.SECURITY_FLEET]});
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.player.id);
      expect(again.playedCards.get(RF)).is.not.undefined;
      expect((again.playedCards.get(CardName.SECURITY_FLEET) as IProjectCard).resourceCount).eq(4);
      expect((again.playedCards.get(CardName.CONSTRUCTION_MECHS) as IProjectCard).resourceCount).eq(2);
    });
  });
});

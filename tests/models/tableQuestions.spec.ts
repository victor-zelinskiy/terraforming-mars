import {expect} from 'chai';
import {DATA_BRANCH, InfluentialDiscovery} from '../../src/server/cards/turmoilRedux/InfluentialDiscovery';
import {Supercomputer} from '../../src/server/cards/turmoilRedux/Supercomputer';
import {OlympusConference} from '../../src/server/cards/base/OlympusConference';
import {MarsUniversity} from '../../src/server/cards/base/MarsUniversity';
import {Research} from '../../src/server/cards/base/Research';
import {MartianRails} from '../../src/server/cards/base/MartianRails';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {Decomposers} from '../../src/server/cards/base/Decomposers';
import {PharmacyUnion} from '../../src/server/cards/promo/PharmacyUnion';
import {Splice} from '../../src/server/cards/promo/Splice';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Payment} from '../../src/common/inputs/Payment';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {ActionPreview, ActionPreviewStep} from '../../src/common/models/ActionPreviewModel';
import {OrOptionsModel} from '../../src/common/models/PlayerInputModel';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {cast} from '../../src/common/utils/utils';
import {isActionMenuTitle} from '../../src/common/inputs/actionMenuTitles';
import {DEFERRABLE_DRAW_NOTE, playPreviewWithTableQuestions} from '../../src/server/models/tableQuestions';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {parkedBatchTailLength, replayBatch} from '../../src/server/inputs/deferredInputBatch';
import {quietResolutionOf, seatEnacted} from '../parliament/parliamentArrange';

/**
 * THE TABLE'S QUESTIONS, ASKED IN THE COMPOSER (TR51 — `models/tableQuestions.ts`, the owner's «strictly
 * pre-select» of 2026-10-12). A reaction the play wakes that ASKS the player (Olympus Conference, Mars University,
 * Pharmacy Union, Viral Enhancers, Splice, Recyclon) is one more step of the play's preview — the SAME prompt its live
 * hook defers, addressed to the reacting card — so its answer rides the play's ONE POST and lands wherever the live
 * queue raises it (the addressee steps forward). A discard after a draw of the same play may be answered NOW or AFTER
 * THE DRAW (2026-10-15 — the step names who draws first); a question whose existence depends on an earlier answer stays
 * an honest follow-up and says why.
 */
type Table = {game: IGame, player: TestPlayer, card: IProjectCard};

function table(card: IProjectCard, party: Parameters<typeof quietResolutionOf>[0] = PartyName.SCIENTISTS): Table {
  const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  seatEnacted(game.parliament!, quietResolutionOf(party));
  player.cardsInHand.push(card);
  player.megaCredits = 40;
  return {game, player, card};
}

/** The table's questions — card-level pre-steps (branch-independent); `_pos` kept for the call sites' reading. */
const tableSteps = (preview: ActionPreview, _pos = 0): Array<ActionPreviewStep & {kind: 'input'}> =>
  (preview.preSteps ?? []).filter((s): s is ActionPreviewStep & {kind: 'input'} => s.kind === 'input' && s.reaction !== undefined);

function playHead(t: Table): InputResponse {
  t.player.takeAction();
  const menu = cast(t.player.getWaitingFor(), OrOptions);
  const index = menu.options.findIndex((o) => o.title === 'Play project card');
  return {type: 'or', index, response: {type: 'projectCard', card: t.card.name, payment: Payment.of({megacredits: t.player.getCardCost(t.card)})}};
}

/** An answer as the composer posts it: the response with the step's address. */
const addressed = (step: ActionPreviewStep & {kind: 'input'}, response: InputResponse): InputResponse =>
  ({...response, for: step.for} as unknown as InputResponse);

function expectActionMenu(t: Table): void {
  const wf = cast(t.player.getWaitingFor(), OrOptions);
  expect(isActionMenuTitle(typeof wf.title === 'string' ? wf.title : wf.title.message), 'the next action menu — no question left').is.true;
}

describe('tableQuestions — the table\'s questions are pre-collected', () => {
  it('Olympus Conference (1 science) + Pharmacy Union (no disease) on TR51: two steps after the card\'s own, each ADDRESSED to its asker', () => {
    const t = table(new InfluentialDiscovery());
    const olympus = new OlympusConference();
    olympus.resourceCount = 1;
    const union = new PharmacyUnion();
    t.player.playedCards.push(olympus, union, new Supercomputer());
    const preview = playPreviewWithTableQuestions(t.player, t.card);
    const steps = tableSteps(preview);
    expect(steps.map((s) => s.reaction?.card)).to.have.members([CardName.OLYMPUS_CONFERENCE, CardName.PHARMACY_UNION]);
    for (const step of steps) {
      expect(step.for?.role).eq('or');
      expect(step.for?.source).deep.include({card: step.reaction?.card});
      expect(step.input.type).eq('or');
    }
    // Branch-independent: the table answers the PLAY — card-level pre-steps, never a branch's own steps.
    expect(preview.branches.every((b) => b.steps.every((s) => s.kind !== 'input' || s.reaction === undefined))).is.true;
    // The forecast keeps naming them — each fact carries its step.
    const facts = preview.forecast!.facts.filter((f) => f.certainty === 'asks');
    expect(facts.every((f) => f.preselect !== undefined)).is.true;
  });

  it('the batch lands WHOLE in any order: Pharmacy Union ahead of everything, Olympus ahead of the card\'s choice, the target last — nothing asked after the press', () => {
    const t = table(new InfluentialDiscovery());
    const olympus = new OlympusConference();
    olympus.resourceCount = 1;
    const union = new PharmacyUnion();
    const supercomputer = new Supercomputer();
    t.player.playedCards.push(olympus, union, supercomputer);
    const preview = playPreviewWithTableQuestions(t.player, t.card);
    const data = preview.branches.findIndex((b) => b.title === DATA_BRANCH);
    const branch = preview.branches[data];
    expect(branch.index, 'one data holder, no science holder but Olympus — both branches live').is.greaterThan(-1);
    const target = branch.steps.find((s): s is ActionPreviewStep & {kind: 'input'} => s.kind === 'input' && s.reaction === undefined)!;
    const [olympusStep, unionStep] = [CardName.OLYMPUS_CONFERENCE, CardName.PHARMACY_UNION].map((name) => tableSteps(preview, data).find((s) => s.reaction?.card === name)!);
    // The composer's order: the card's own answers, then the table's — the live queue asks PU (SUPERPOWER), Olympus
    // (OLYMPUS_CONFERENCE), the card's `or` (DEFAULT), its target (GAIN_RESOURCE_OR_PRODUCTION).
    replayBatch(t.player, [
      playHead(t),
      {type: 'or', index: branch.index, response: {type: 'option'}, for: branch.for} as InputResponse,
      addressed(target, {type: 'card', cards: [CardName.SUPERCOMPUTER]}),
      addressed(olympusStep, {type: 'or', index: 1, response: {type: 'option'}}),
      addressed(unionStep, {type: 'or', index: 1, response: {type: 'option'}}),
    ]);
    expectActionMenu(t);
    expect(parkedBatchTailLength(t.player)).eq(0);
    expect(olympus.resourceCount, 'Olympus: «add a science resource» — the pre-selected answer').eq(2);
    expect(union.isDisabled, 'Pharmacy Union: «do nothing» — face up').is.false;
    expect(supercomputer.resourceCount).eq(6);
  });

  it('Mars University alone: its discard is pre-collected over the hand the play leaves — the card discarded, one drawn', () => {
    const t = table(new InfluentialDiscovery());
    const rails = new MartianRails();
    t.player.cardsInHand.push(rails);
    t.player.playedCards.push(new MarsUniversity(), new Supercomputer());
    const preview = playPreviewWithTableQuestions(t.player, t.card);
    const live = preview.branches.findIndex((b) => b.available);
    const [step] = tableSteps(preview, live);
    expect(step?.reaction?.card).eq(CardName.MARS_UNIVERSITY);
    const discard = (step.input as OrOptionsModel).options[0] as unknown as {cards: Array<{name: string}>};
    expect(discard.cards.map((c) => c.name), 'the played card is not a candidate').deep.eq([CardName.MARTIAN_RAILS]);
    const target = preview.branches[live].steps.find((s): s is ActionPreviewStep & {kind: 'input'} => s.kind === 'input' && s.reaction === undefined)!;
    const hand = t.player.cardsInHand.length;
    replayBatch(t.player, [
      playHead(t),
      addressed(step, {type: 'or', index: 0, response: {type: 'card', cards: [CardName.MARTIAN_RAILS]}}),
      addressed(target, {type: 'card', cards: [CardName.SUPERCOMPUTER]}),
    ]);
    expectActionMenu(t);
    expect(parkedBatchTailLength(t.player)).eq(0);
    expect(t.player.cardsInHand.some((c) => c.name === CardName.MARTIAN_RAILS), 'Martian Rails discarded').is.false;
    expect(t.player.cardsInHand.length, 'TR51 played, Martian Rails discarded, one card drawn').eq(hand - 1);
  });

  it('GATED — Mars University behind Olympus\' «remove to draw»: the discard stays a step, gated by Olympus\' answer', () => {
    const t = table(new InfluentialDiscovery());
    const olympus = new OlympusConference();
    olympus.resourceCount = 1;
    t.player.cardsInHand.push(new MartianRails());
    t.player.playedCards.push(olympus, new MarsUniversity(), new Supercomputer());
    const preview = playPreviewWithTableQuestions(t.player, t.card);
    const live = preview.branches.findIndex((b) => b.available);
    const steps = tableSteps(preview, live);
    expect(steps.map((s) => s.reaction?.card)).deep.eq([CardName.OLYMPUS_CONFERENCE, CardName.MARS_UNIVERSITY]);
    const olympusFact = preview.forecast!.facts.find((f) => f.source.name === CardName.OLYMPUS_CONFERENCE)!;
    expect(steps[1].reaction?.afterDraw, 'the discard waits on Olympus\' answer').deep.eq([olympusFact.id]);
    expect(steps[0].reaction?.afterDraw).is.undefined;
  });

  it('GATED — Olympus answered «add» (no draw): both pre-selects land, Mars University discards the card chosen before the press', () => {
    const t = table(new InfluentialDiscovery());
    const olympus = new OlympusConference();
    olympus.resourceCount = 1;
    t.player.cardsInHand.push(new MartianRails());
    t.player.playedCards.push(olympus, new MarsUniversity(), new Supercomputer());
    const preview = playPreviewWithTableQuestions(t.player, t.card);
    // Olympus holds science, Supercomputer data: both variants live — the data one, its target Supercomputer.
    const data = preview.branches.findIndex((b) => b.title === DATA_BRANCH);
    const branch = preview.branches[data];
    const [olympusStep, universityStep] = tableSteps(preview, data);
    const target = branch.steps.find((s): s is ActionPreviewStep & {kind: 'input'} => s.kind === 'input' && s.reaction === undefined)!;
    replayBatch(t.player, [
      playHead(t),
      {type: 'or', index: branch.index, response: {type: 'option'}, for: branch.for} as InputResponse,
      addressed(target, {type: 'card', cards: [CardName.SUPERCOMPUTER]}),
      addressed(olympusStep, {type: 'or', index: 1, response: {type: 'option'}}),
      addressed(universityStep, {type: 'or', index: 0, response: {type: 'card', cards: [CardName.MARTIAN_RAILS]}}),
    ]);
    expectActionMenu(t);
    expect(parkedBatchTailLength(t.player)).eq(0);
    expect(olympus.resourceCount).eq(2);
    expect(t.player.cardsInHand.some((c) => c.name === CardName.MARTIAN_RAILS)).is.false;
  });

  it('MAY WAIT — a play that DRAWS (Research, 2 cards): Mars University\'s discards are steps that may wait from the start; the second Olympus question depends on the first', () => {
    const t = table(new Research());
    const olympus = new OlympusConference();
    olympus.resourceCount = 1;
    t.player.cardsInHand.push(new MartianRails());
    t.player.playedCards.push(olympus, new MarsUniversity());
    const preview = playPreviewWithTableQuestions(t.player, t.card);
    const steps = tableSteps(preview);
    expect(steps.map((s) => s.reaction?.card), 'the first Olympus question, then both of the university\'s')
      .deep.eq([CardName.OLYMPUS_CONFERENCE, CardName.MARS_UNIVERSITY, CardName.MARS_UNIVERSITY]);
    const olympusFacts = preview.forecast!.facts.filter((f) => f.source.name === CardName.OLYMPUS_CONFERENCE);
    expect(olympusFacts.map((f) => f.preselect !== undefined)).deep.eq([true, false]);
    expect(olympusFacts[1].note).eq('Asked after this play: it depends on the answer above');
    const [first, second] = steps.slice(1);
    expect(first.reaction?.drawnBefore, 'Research draws its two before the university asks; the second Olympus question may draw too')
      .deep.eq([{card: CardName.RESEARCH, cards: 2}, {card: CardName.OLYMPUS_CONFERENCE}]);
    expect(first.reaction?.afterDraw, 'and the first Olympus answer is a gate').deep.eq([olympusFacts[0].id]);
    expect(second.reaction?.afterDraw, 'the second discard also waits on the first (its discard draws)').to.include(first.reaction!.fact);
    const universityFacts = preview.forecast!.facts.filter((f) => f.source.name === CardName.MARS_UNIVERSITY);
    expect(universityFacts.every((f) => f.preselect !== undefined && f.note === DEFERRABLE_DRAW_NOTE)).is.true;
  });

  describe('THE OWNER\'S CASE (2026-10-15) — playing Mars University under Olympus Conference holding a science', () => {
    function owners(): {t: Table, olympus: OlympusConference} {
      const t = table(new MarsUniversity());
      const olympus = new OlympusConference();
      olympus.resourceCount = 1;
      t.player.cardsInHand.push(new MartianRails());
      t.player.playedCards.push(olympus);
      return {t, olympus};
    }

    it('Olympus first, the university\'s discard after it — waiting for Olympus\' answer, never handed on', () => {
      const {t} = owners();
      const preview = playPreviewWithTableQuestions(t.player, t.card);
      const steps = tableSteps(preview);
      expect(steps.map((s) => s.reaction?.card)).deep.eq([CardName.OLYMPUS_CONFERENCE, CardName.MARS_UNIVERSITY]);
      const olympusFact = preview.forecast!.facts.find((f) => f.source.name === CardName.OLYMPUS_CONFERENCE)!;
      expect(steps[1].reaction?.afterDraw).deep.eq([olympusFact.id]);
      expect(steps[1].reaction?.drawnBefore, 'nothing draws before it whatever the answers').is.undefined;
      const discard = (steps[1].input as OrOptionsModel).options[0] as unknown as {cards: Array<{name: string}>};
      expect(discard.cards.map((c) => c.name), 'the hand the play leaves — the university itself is not a candidate').deep.eq([CardName.MARTIAN_RAILS]);
    });

    it('«remove to draw» AND the discard chosen NOW: both land — the chosen card discarded, Olympus\' card kept, nothing asked after the press', () => {
      const {t, olympus} = owners();
      const preview = playPreviewWithTableQuestions(t.player, t.card);
      const [olympusStep, universityStep] = tableSteps(preview);
      replayBatch(t.player, [
        playHead(t),
        addressed(universityStep, {type: 'or', index: 0, response: {type: 'card', cards: [CardName.MARTIAN_RAILS]}}),
        addressed(olympusStep, {type: 'or', index: 0, response: {type: 'option'}}),
      ]);
      expectActionMenu(t);
      expect(parkedBatchTailLength(t.player)).eq(0);
      expect(olympus.resourceCount, 'the science spent on the draw').eq(0);
      expect(t.player.cardsInHand.some((c) => c.name === CardName.MARTIAN_RAILS), 'Martian Rails discarded').is.false;
      expect(t.player.cardsInHand.length, 'Olympus drew one, the university swapped Martian Rails for another').eq(2);
    });

    it('«remove to draw» with the discard LEFT FOR AFTER THE DRAW: the batch carries Olympus alone — the university asks LIVE, the drawn card among its candidates', () => {
      const {t, olympus} = owners();
      const preview = playPreviewWithTableQuestions(t.player, t.card);
      const [olympusStep] = tableSteps(preview);
      replayBatch(t.player, [
        playHead(t),
        addressed(olympusStep, {type: 'or', index: 0, response: {type: 'option'}}),
      ]);
      expect(olympus.resourceCount).eq(0);
      const question = cast(t.player.getWaitingFor(), OrOptions);
      expect(question.choiceContext?.source.card, 'the university\'s own question, live').eq(CardName.MARS_UNIVERSITY);
      const drawn = t.player.cardsInHand.find((c) => c.name !== CardName.MARTIAN_RAILS)!;
      expect(drawn, 'Olympus\' card is in the hand by now').is.not.undefined;
      const pick = cast(question.options[0], SelectCard);
      expect(pick.cards.map((c) => c.name)).to.have.members([CardName.MARTIAN_RAILS, drawn.name]);
      // The player gives up the card Olympus just brought.
      t.player.process({type: 'or', index: 0, response: {type: 'card', cards: [drawn.name]}} as InputResponse);
      expectActionMenu(t);
      expect(t.player.cardsInHand.some((c) => c.name === drawn.name), 'the drawn card discarded').is.false;
      expect(t.player.cardsInHand.some((c) => c.name === CardName.MARTIAN_RAILS), 'Martian Rails kept').is.true;
    });

    it('«add a science»: no draw — the discard is an ordinary pre-select and lands over the hand the player saw', () => {
      const {t, olympus} = owners();
      const preview = playPreviewWithTableQuestions(t.player, t.card);
      const [olympusStep, universityStep] = tableSteps(preview);
      replayBatch(t.player, [
        playHead(t),
        addressed(olympusStep, {type: 'or', index: 1, response: {type: 'option'}}),
        addressed(universityStep, {type: 'or', index: 1, response: {type: 'option'}}),
      ]);
      expectActionMenu(t);
      expect(olympus.resourceCount).eq(2);
      expect(t.player.cardsInHand.map((c) => c.name), 'declined: nothing discarded, nothing drawn').deep.eq([CardName.MARTIAN_RAILS]);
    });
  });

  it('the steps stand in the LIVE QUEUE\'S order — a university played BEFORE the conference still asks after it', () => {
    const t = table(new InfluentialDiscovery());
    const olympus = new OlympusConference();
    olympus.resourceCount = 1;
    t.player.cardsInHand.push(new MartianRails());
    t.player.playedCards.push(new MarsUniversity(), olympus, new Supercomputer());
    const preview = playPreviewWithTableQuestions(t.player, t.card);
    const steps = tableSteps(preview);
    expect(steps.map((s) => s.reaction?.card)).deep.eq([CardName.OLYMPUS_CONFERENCE, CardName.MARS_UNIVERSITY]);
    const olympusFact = preview.forecast!.facts.find((f) => f.source.name === CardName.OLYMPUS_CONFERENCE)!;
    expect(steps[1].reaction?.afterDraw, 'the gate is read whatever the tableau order').deep.eq([olympusFact.id]);
  });

  it('Splice on the OPPONENT asks the card PLAYER: the question is the player\'s pre-select, addressed to Splice', () => {
    const t = table(new Decomposers(), PartyName.GREENS);
    t.game.players.find((p) => p !== t.player)!.playedCards.push(new Splice());
    t.player.playedCards.push(new Tardigrades());
    const preview = playPreviewWithTableQuestions(t.player, t.card);
    const splice = tableSteps(preview).find((s) => s.reaction?.card === CardName.SPLICE);
    expect(splice?.for).deep.eq({role: 'or', source: {kind: 'corporation', card: CardName.SPLICE}});
  });

  it('no asker on the table: the preview is the card\'s own, untouched', () => {
    const t = table(new InfluentialDiscovery());
    t.player.playedCards.push(new Supercomputer());
    const preview = playPreviewWithTableQuestions(t.player, t.card);
    expect(tableSteps(preview)).deep.eq([]);
  });
});

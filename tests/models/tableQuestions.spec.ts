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
import {HIDDEN_DRAW_NOTE, playPreviewWithTableQuestions} from '../../src/server/models/tableQuestions';
import {parkedBatchTailLength, replayBatch} from '../../src/server/inputs/deferredInputBatch';
import {quietResolutionOf, seatEnacted} from '../parliament/parliamentArrange';

/**
 * THE TABLE'S QUESTIONS, ASKED IN THE COMPOSER (TR51 — `models/tableQuestions.ts`, the owner's «strictly
 * pre-select» of 2026-10-12). A reaction the play wakes that ASKS the player (Olympus Conference, Mars University,
 * Pharmacy Union, Viral Enhancers, Splice, Recyclon) is one more step of the play's preview — the SAME prompt its live
 * hook defers, addressed to the reacting card — so its answer rides the play's ONE POST and lands wherever the live
 * queue raises it (the addressee steps forward). A question whose answer is hidden before the press (a discard after a
 * draw of the same play) or depends on an earlier answer stays an honest follow-up and says why.
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

const tableSteps = (preview: ActionPreview, pos = 0): Array<ActionPreviewStep & {kind: 'input'}> =>
  preview.branches[pos].steps.filter((s): s is ActionPreviewStep & {kind: 'input'} => s.kind === 'input' && s.reaction !== undefined);

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
    // The card's own steps come first; the table's after them, on every branch.
    const own = preview.branches[0].steps.findIndex((s) => s.kind === 'input' && s.reaction === undefined);
    const first = preview.branches[0].steps.findIndex((s) => s.kind === 'input' && s.reaction !== undefined);
    expect(own).is.lessThan(first);
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

  it('HIDDEN — Mars University behind Olympus\' «remove to draw»: the discard is NOT pre-collected and the note says why', () => {
    const t = table(new InfluentialDiscovery());
    const olympus = new OlympusConference();
    olympus.resourceCount = 1;
    t.player.cardsInHand.push(new MartianRails());
    t.player.playedCards.push(olympus, new MarsUniversity(), new Supercomputer());
    const preview = playPreviewWithTableQuestions(t.player, t.card);
    expect(tableSteps(preview).map((s) => s.reaction?.card)).deep.eq([CardName.OLYMPUS_CONFERENCE]);
    const university = preview.forecast!.facts.find((f) => f.source.name === CardName.MARS_UNIVERSITY)!;
    expect(university.certainty).eq('asks');
    expect(university.preselect).is.undefined;
    expect(university.note).eq(HIDDEN_DRAW_NOTE);
  });

  it('HIDDEN — a play that DRAWS (Research, 2 cards) keeps Mars University a follow-up; the second Olympus question depends on the first', () => {
    const t = table(new Research());
    const olympus = new OlympusConference();
    olympus.resourceCount = 1;
    t.player.cardsInHand.push(new MartianRails());
    t.player.playedCards.push(olympus, new MarsUniversity());
    const preview = playPreviewWithTableQuestions(t.player, t.card);
    expect(tableSteps(preview).map((s) => s.reaction?.card), 'only the first Olympus question').deep.eq([CardName.OLYMPUS_CONFERENCE]);
    const olympusFacts = preview.forecast!.facts.filter((f) => f.source.name === CardName.OLYMPUS_CONFERENCE);
    expect(olympusFacts.map((f) => f.preselect !== undefined)).deep.eq([true, false]);
    expect(olympusFacts[1].note).eq('Asked after this play: it depends on the answer above');
    expect(preview.forecast!.facts.filter((f) => f.source.name === CardName.MARS_UNIVERSITY).every((f) => f.preselect === undefined && f.note === HIDDEN_DRAW_NOTE)).is.true;
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

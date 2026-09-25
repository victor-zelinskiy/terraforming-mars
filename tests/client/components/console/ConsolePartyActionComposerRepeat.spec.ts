import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsolePartyActionComposer from '@/client/components/console/parliament/ConsolePartyActionComposer.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';

/**
 * THE LAW WHOSE DECISION IS ON THE TABLE (Turmoil Redux — R&D Funding: which
 * already-used card action runs a second time).
 *
 * Open IP Trade's decision is made in the HAND: its cards LEAVE, so the pick
 * belongs to the hand's own surface, hosted as a step of this stage. A REPEAT
 * spends nothing and touches only cards already on the table, so it stands in
 * this stage's own decision column — the premium-face grammar the Scientists'
 * target row uses.
 *
 * These specs pin the seam that tells the two apart: the prompt's STRUCTURAL
 * marker (`repeatActionPrompt`), never its title and never «a card pick with
 * no discard marker must be a tableau one».
 */
const LAW = 'RDX_SCIENTISTS_RD_FUNDING';

function cardModel(name: CardName) {
  return {name, resources: undefined, calculatedCost: undefined, isDisabled: false} as never;
}

function repeatPrompt(names: ReadonlyArray<CardName>, marked = true): SelectCardModel {
  return {
    title: 'Use an action on one of your cards a second time (R&D Funding)',
    buttonLabel: 'Take action',
    type: 'card',
    cards: names.map(cardModel),
    max: 1, min: 1,
    showOnlyInLearnerMode: false,
    selectBlueCardAction: false,
    showOwner: false,
    showSelectAll: false,
    ...(marked ? {repeatActionPrompt: true} : {}),
    resolutionActionPrompt: {resolution: LAW, party: PartyName.SCIENTISTS, stage: 'choose', usesLeft: 1, usesPerGeneration: 1},
  } as unknown as SelectCardModel;
}

function menu(option: PlayerInputModel): PlayerInputModel {
  return {type: 'or', title: 'Take an action', buttonLabel: 'Take action', options: [option]} as unknown as PlayerInputModel;
}

function playerView(wf: PlayerInputModel | undefined): PlayerViewModel {
  return {
    id: 'p1',
    waitingFor: wf,
    game: {gameAge: 1, parliament: {viewer: {resolutionAction: {
      resolution: LAW, party: PartyName.SCIENTISTS, hasAccess: true,
      usesLeft: 1, usesPerGeneration: 1, available: true, reason: '', preview: [],
    }}}},
    thisPlayer: {color: 'red'},
    players: [],
  } as unknown as PlayerViewModel;
}

function mountLaw(wf: PlayerInputModel | undefined) {
  return mount(ConsolePartyActionComposer, {
    // `premium-card-face` is registered globally by the app entry, not by the
    // unit runner's local Vue — the hero's own rendering is not the subject.
    global: {...globalConfig.global, stubs: {'premium-card-face': true}},
    props: {playerView: playerView(wf), party: PartyName.SCIENTISTS, resolution: LAW},
  });
}

describe('ConsolePartyActionComposer — a law whose decision is on the TABLE', () => {
  it('draws the candidates as premium faces in the stage own decision column', () => {
    const w = mountLaw(menu(repeatPrompt([CardName.TARDIGRADES, CardName.REGOLITH_EATERS])));
    const cards = w.findAll('.con-pact__card');
    expect(cards).to.have.length(2);
    expect(cards.map((c) => c.attributes('data-pact-card')))
      .to.deep.eq([CardName.TARDIGRADES, CardName.REGOLITH_EATERS]);
    // The law's face is still the hero: the source column never changes shape.
    expect(w.find('.con-pact__hero--bill').exists()).to.be.true;
    // …and the pick is SHOWN even though the decision has a single row.
    expect(w.find('[data-pact-row="0"]').exists()).to.be.true;
  });

  it('shows the pick even with ONE candidate — no hidden target', () => {
    const w = mountLaw(menu(repeatPrompt([CardName.TARDIGRADES])));
    expect(w.findAll('.con-pact__card')).to.have.length(1);
    expect(w.find('[data-pact-cta]').attributes('data-pact-ready'), 'and nothing is pre-answered').to.be.undefined;
  });

  it('the commit is a SECOND deliberate press: not ready until a card is picked', async () => {
    const w = mountLaw(menu(repeatPrompt([CardName.TARDIGRADES, CardName.REGOLITH_EATERS])));
    expect(w.find('[data-pact-cta]').attributes('data-pact-ready')).to.be.undefined;
    await w.findAll('.con-pact__card')[1].trigger('click');
    expect(w.find('[data-pact-cta]').attributes('data-pact-ready')).to.eq('');
    expect(w.emitted('confirm'), 'picking is not committing').to.be.undefined;
  });

  it('commits the PICKED card, wrapped in the menu branch the prompt stands in', async () => {
    const w = mountLaw(menu(repeatPrompt([CardName.TARDIGRADES, CardName.REGOLITH_EATERS])));
    await w.findAll('.con-pact__card')[1].trigger('click');
    await w.find('[data-pact-cta]').trigger('click');
    const emitted = w.emitted('confirm');
    expect(emitted).to.have.length(1);
    expect(emitted![0][0]).to.deep.eq({
      type: 'or', index: 0, response: {type: 'card', cards: [CardName.REGOLITH_EATERS]},
    });
    // NO expected-cards detail: a repeat draws nothing, so the host raises no
    // draw claim for it (an orphan claim would suppress the presenter).
    expect(emitted![0][1]).to.be.undefined;
  });

  it('a prompt WITHOUT the marker is not a table decision — the stage stays between steps', () => {
    const w = mountLaw(menu(repeatPrompt([CardName.TARDIGRADES], false)));
    expect(w.findAll('.con-pact__card')).to.have.length(0);
    expect(w.find('.con-pact__rule').exists(), 'the law states its rule and waits').to.be.true;
  });

  it('hands the host a real command contract — the verb, the source, the way back', async () => {
    const w = mountLaw(menu(repeatPrompt([CardName.TARDIGRADES])));
    await w.vm.$nextTick();
    const batches = w.emitted('commands');
    expect(batches, 'the bar is handed up').to.not.be.undefined;
    const last = batches![batches!.length - 1][0] as Array<{control: string, label: string}>;
    expect(last.map((c) => c.control)).to.include('confirm');
    expect(last.map((c) => c.control)).to.include('back');
  });
});

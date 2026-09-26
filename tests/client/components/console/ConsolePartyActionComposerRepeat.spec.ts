import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsolePartyActionComposer from '@/client/components/console/parliament/ConsolePartyActionComposer.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {
  cancelConsoleRepeatPick, consoleRepeatPickState, resetConsoleRepeatPick, resolveConsoleRepeatPick,
} from '@/client/console/consoleRepeatPick';
import {resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';

/**
 * THE LAW WHOSE DECISION IS A REPEAT (Turmoil Redux — R&D Funding: «use an
 * action on one of your cards a second time»).
 *
 * «Which of my already-used actions» is a question this console answers with
 * ONE surface — the ДЕЙСТВИЯ КАРТ list in repeat mode, reached through the
 * shared pick bridge (`consoleRepeatPick`), which Viron, Project Inspection
 * and the Hydronetwork already use. So the law's stage shows the repeat as a
 * SLOT, exactly as Viron's own composer does, and drawing a law-only picker
 * here would be a fourth interface for a question with one answer.
 *
 * These specs pin: the slot (never a list), the door (A opens the shared
 * bridge, with a NON-CARD source — a law is in nobody's tableau), the filled
 * slot, «a choice is not a commit», and the wire form — the head answers the
 * LIVE prompt inside its menu branch and the tail is the copied action's own
 * composed answers.
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
    // `premium-card-face` and `v-strip-action-prefix` are registered globally by
    // the app entry, not by the unit runner's local Vue — the hero's and the
    // action graphic's own rendering is not the subject here. (`v-i18n` comes
    // from the i18n plugin the shared config already installs.)
    global: {
      ...globalConfig.global,
      stubs: {'premium-card-face': true},
      directives: {...globalConfig.global.directives, 'strip-action-prefix': {}},
    },
    props: {playerView: playerView(wf), party: PartyName.SCIENTISTS, resolution: LAW},
  });
}

/** The pick bridge, answered the way `ConsoleCardActions` answers it in repeat mode. */
const NOTHING_COMPOSED = {branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: []};

describe('ConsolePartyActionComposer — a law whose decision is a REPEAT', () => {
  afterEach(() => {
    // Module state is bundle-shared in mochapack: a bridge left open (and the
    // frame it pushed) would follow every later spec.
    resetConsoleRepeatPick();
    resetWorkspaceStack();
  });

  it('shows the repeat as a SLOT — never a picker of its own', () => {
    const w = mountLaw(menu(repeatPrompt([CardName.TARDIGRADES, CardName.REGOLITH_EATERS])));
    expect(w.find('[data-pact-repeat-slot]').exists(), 'the slot stands').to.be.true;
    expect(w.findAll('.con-pact__card'), 'and no second list of candidates').to.have.length(0);
    expect(w.find('.con-pact__repeatslot-empty').exists(), 'empty, it invites').to.be.true;
    // The law's face is still the hero: the source column never changes shape.
    expect(w.find('.con-pact__hero--bill').exists()).to.be.true;
    expect(w.find('[data-pact-cta]').attributes('data-pact-ready'), 'nothing is pre-answered').to.be.undefined;
  });

  it('A on the slot opens the SHARED bridge, with the law as a NON-CARD source', async () => {
    const w = mountLaw(menu(repeatPrompt([CardName.TARDIGRADES, CardName.REGOLITH_EATERS])));
    await w.find('[data-pact-repeat-slot]').trigger('click');
    expect(consoleRepeatPickState.active, 'the shared pick is out').to.be.true;
    const request = consoleRepeatPickState.request!;
    expect(request.candidates, 'it carries the server\'s own candidates')
      .to.deep.eq([CardName.TARDIGRADES, CardName.REGOLITH_EATERS]);
    expect(request.buttonLabel, 'and the prompt\'s own verb').to.eq('Take action');
    expect(request.source.card, 'a law is in nobody\'s tableau').to.be.undefined;
    expect(request.source.label, 'so it states itself by name').to.eq('R&D Funding');
    expect(w.emitted('confirm'), 'opening the pick commits nothing').to.be.undefined;
  });

  it('the resolved pick FILLS the slot and only then arms the commit', async () => {
    const w = mountLaw(menu(repeatPrompt([CardName.TARDIGRADES])));
    await w.find('[data-pact-repeat-slot]').trigger('click');
    resolveConsoleRepeatPick({chosenCard: CardName.TARDIGRADES, nodeIndex: 0, composed: NOTHING_COMPOSED});
    await w.vm.$nextTick();
    expect(w.find('[data-pact-repeat-name]').text(), 'the slot names what will repeat').to.eq(CardName.TARDIGRADES);
    expect(w.find('[data-pact-repeat-slot]').classes(), 'and wears the shared chassis')
      .to.include('con-composer__repeatpick');
    expect(w.find('[data-pact-cta]').attributes('data-pact-ready')).to.eq('');
    expect(w.emitted('confirm'), 'filling the slot is still not committing').to.be.undefined;
  });

  it('a CANCELLED pick leaves the stage exactly as it was — the slot empty, the flow alive', async () => {
    const w = mountLaw(menu(repeatPrompt([CardName.TARDIGRADES])));
    await w.find('[data-pact-repeat-slot]').trigger('click');
    cancelConsoleRepeatPick();
    await w.vm.$nextTick();
    expect(consoleRepeatPickState.active).to.be.false;
    expect(w.find('[data-pact-repeat-slot]').exists(), 'the stage is still standing').to.be.true;
    expect(w.find('.con-pact__repeatslot-empty').exists(), 'with the slot empty').to.be.true;
    expect(w.emitted('cancel'), 'and the flow was never cancelled').to.be.undefined;
  });

  it('commits the pick inside the menu branch — a lone answer stays ONE response', async () => {
    const w = mountLaw(menu(repeatPrompt([CardName.TARDIGRADES])));
    await w.find('[data-pact-repeat-slot]').trigger('click');
    resolveConsoleRepeatPick({chosenCard: CardName.TARDIGRADES, nodeIndex: 0, composed: NOTHING_COMPOSED});
    await w.vm.$nextTick();
    await w.find('[data-pact-cta]').trigger('click');
    const emitted = w.emitted('confirm');
    expect(emitted).to.have.length(1);
    expect(emitted![0][0]).to.deep.eq({
      type: 'or', index: 0, response: {type: 'card', cards: [CardName.TARDIGRADES]},
    });
    // NO expected-cards detail: a repeat draws nothing, so the host raises no
    // draw claim for it (an orphan claim would suppress the presenter).
    expect(emitted![0][1]).to.be.undefined;
  });

  it('…and takes the copied action own composed answers with it, as a BATCH', async () => {
    const w = mountLaw(menu(repeatPrompt([CardName.REGOLITH_EATERS])));
    await w.find('[data-pact-repeat-slot]').trigger('click');
    resolveConsoleRepeatPick({
      chosenCard: CardName.REGOLITH_EATERS,
      nodeIndex: 0,
      composed: {branchIndex: 1, preResponses: [], optionResponse: undefined, stepResponses: []},
    });
    await w.vm.$nextTick();
    await w.find('[data-pact-cta]').trigger('click');
    expect(w.emitted('confirm')![0][0]).to.deep.eq([
      {type: 'or', index: 0, response: {type: 'card', cards: [CardName.REGOLITH_EATERS]}},
      {type: 'or', index: 1, response: {type: 'option'}},
    ]);
  });

  it('a prompt WITHOUT the marker is no repeat — the stage stays between steps', () => {
    const w = mountLaw(menu(repeatPrompt([CardName.TARDIGRADES], false)));
    expect(w.find('[data-pact-repeat-slot]').exists()).to.be.false;
    expect(w.find('.con-pact__rule').exists(), 'the law states its rule and waits').to.be.true;
  });

  it('hands the host a real command contract — the door verb, the source, the way back', async () => {
    const w = mountLaw(menu(repeatPrompt([CardName.TARDIGRADES])));
    await w.vm.$nextTick();
    const batches = w.emitted('commands');
    expect(batches, 'the bar is handed up').to.not.be.undefined;
    const last = batches![batches!.length - 1][0] as Array<{control: string, label: string}>;
    expect(last.map((c) => c.control)).to.include('confirm');
    expect(last.map((c) => c.control)).to.include('back');
    expect(last.map((c) => c.label), 'the row is a DOOR: A selects, it does not perform').to.include('Select');
  });
});

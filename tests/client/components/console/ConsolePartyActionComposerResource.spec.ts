import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsolePartyActionComposer from '@/client/components/console/parliament/ConsolePartyActionComposer.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel, ResolutionActionPromptMeta, SelectCardModel} from '@/common/models/PlayerInputModel';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {actionCommitState, resetActionCommit} from '@/client/console/consoleActionCommit';
import {resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';

/**
 * «A RESOURCE ONTO ONE OF YOUR CARDS» — ONE FORM, read off the PROMPT, never the party (Manufacturing Run RX37:
 * «2 floaters OR 1 fighter OR 1 mech»; the Scientists' party action asks the same shape). The law's stage draws the
 * Scientists' two rows — «РЕСУРС» (a variant per kind the seat can hold), «КАРТА-ЦЕЛЬ» (the holders with
 * `current → resulting`) — and answers with the same response inside its own menu branch; one kind is SEEDED (no
 * decision), the card never is; the commit lands its token on the chosen card's miniature (`data-composer-card` +
 * a rail half — PL-427), and the rows stand on what was pressed while the menu moves on.
 */
const LAW = 'RDX_INDUSTRIALISTS_MANUFACTURING_RUN';
const META: ResolutionActionPromptMeta = {resolution: LAW, party: PartyName.INDUSTRIALISTS, stage: 'choose', usesLeft: 2, usesPerGeneration: 2};

type Holder = {name: CardName, resources: number};

function branch(icon: string, amount: number, holders: ReadonlyArray<Holder>, vpBox?: Record<string, {from: number, to: number}>): SelectCardModel {
  return {
    title: 'Add', buttonLabel: 'Add', type: 'card',
    cards: holders.map((h) => ({name: h.name, resources: h.resources, calculatedCost: undefined, isDisabled: false})),
    max: 1, min: 1, showOnlyInLearnerMode: false, selectBlueCardAction: false, showOwner: false, showSelectAll: false,
    resourceGainPrompt: {amount, cardResource: icon, ...(vpBox === undefined ? {} : {vpBox})},
    resolutionActionPrompt: META,
  } as unknown as SelectCardModel;
}

function lawPrompt(options: ReadonlyArray<SelectCardModel>): PlayerInputModel {
  return {type: 'or', title: 'Add 2 floaters, 1 fighter or 1 mech to a card', buttonLabel: 'Add', options, resolutionActionPrompt: META} as unknown as PlayerInputModel;
}

/** The action menu with the law's option at index 1 (a party action stands before it). */
function menu(option: PlayerInputModel | undefined): PlayerInputModel | undefined {
  return option === undefined ? undefined :
    {type: 'or', title: 'Take an action', buttonLabel: 'Take action', options: [{type: 'option', title: 'Pass'}, option]} as unknown as PlayerInputModel;
}

const MECHS: Holder = {name: CardName.CONSTRUCTION_MECHS, resources: 0};
const FLEET: Holder = {name: CardName.SECURITY_FLEET, resources: 0};
const SHUTTLES: Holder = {name: CardName.TITAN_SHUTTLES, resources: 0};

const THREE = [
  branch('floater', 2, [SHUTTLES]),
  branch('fighter', 1, [FLEET], {[CardName.SECURITY_FLEET]: {from: 0, to: 1}}),
  branch('mech', 1, [MECHS]),
];

function playerView(wf: PlayerInputModel | undefined, tableau: ReadonlyArray<Holder> = [MECHS, FLEET, SHUTTLES]): PlayerViewModel {
  return {
    id: 'p1',
    waitingFor: wf,
    game: {gameAge: 1, parliament: {viewer: {partyActions: [], resolutionAction: {
      resolution: LAW, party: PartyName.INDUSTRIALISTS, hasAccess: true, usesLeft: 2, usesPerGeneration: 2, available: true, reason: '', preview: [],
    }}}},
    thisPlayer: {color: 'red', tableau: tableau.map((h) => ({name: h.name, resources: h.resources}))},
    players: [],
  } as unknown as PlayerViewModel;
}

function mountLaw(wf: PlayerInputModel | undefined, tableau?: ReadonlyArray<Holder>) {
  return mount(ConsolePartyActionComposer, {
    global: {
      ...globalConfig.global,
      stubs: {'premium-card-face': true, 'ConsoleCardFaceLite': true},
      directives: {...globalConfig.global.directives, 'strip-action-prefix': {}},
    },
    props: {playerView: playerView(wf, tableau), party: PartyName.INDUSTRIALISTS, resolution: LAW},
  });
}

describe('ConsolePartyActionComposer — «a resource onto one of your cards», the law\'s form (RX37)', () => {
  afterEach(() => {
    resetActionCommit();
    resetWorkspaceStack();
  });

  it('draws the Scientists\' two rows for the LAW: three variants, then the chosen kind\'s holders — never the hand pick', async () => {
    const w = mountLaw(menu(lawPrompt(THREE)));
    expect(w.find('.con-pact__rule').exists(), 'the law states its rule').to.be.true;
    expect(w.findAll('[data-pact-opt]'), 'a variant per kind held').to.have.length(3);
    expect(w.find('[data-pact-row="1"]').exists(), 'and the target row').to.be.true;
    expect(w.find('.con-pact__handzone').exists(), 'never the Open IP Trade hand pick').to.be.false;
    expect(w.find('[data-pact-cta]').attributes('data-pact-ready'), 'nothing chosen — the commit dims').to.be.undefined;
    await w.find('[data-pact-opt="2"]').trigger('click');
    const cards = w.findAll('[data-pact-card]');
    expect(cards.map((c) => c.attributes('data-pact-card'))).to.deep.eq([CardName.CONSTRUCTION_MECHS]);
    expect(w.find(`[data-composer-card="${CardName.CONSTRUCTION_MECHS}"]`).exists(), 'the miniature is a flight end').to.be.true;
    expect(cards[0].find('.con-pact__card-delta').text()).to.contain('0 → 1');
  });

  it('a scoring holder reads its VP; the uses text is the server\'s live count', async () => {
    const w = mountLaw(menu(lawPrompt(THREE)));
    await w.find('[data-pact-opt="1"]').trigger('click');
    expect(w.find(`[data-pact-card="${CardName.SECURITY_FLEET}"] .con-pact__card-delta em`).text()).to.match(/0 → 1/);
    expect(w.find('.con-pact__uses').text()).to.match(/2\D+2/);
  });

  it('ONE kind held is SEEDED — with TWO holders the cursor opens on the target row and the CARD is the player\'s press', async () => {
    const w = mountLaw(menu(lawPrompt([branch('mech', 1, [MECHS, FLEET])])));
    await w.vm.$nextTick();
    expect(w.findAll('[data-pact-opt]')).to.have.length(1);
    expect(w.find('[data-pact-row="0"]').classes(), 'the only kind is answered').to.include('con-pact__row--answered');
    expect(w.find('[data-pact-row="1"]').classes(), 'the cursor waits on the card').to.include('con-pact__row--focus');
    expect(w.find('.con-pact__card--picked').exists(), 'two holders: no card is chosen for the player').to.be.false;
    expect(w.find('[data-pact-row="1"]').attributes('data-seeded')).to.be.undefined;
    expect(w.find('[data-pact-cta]').attributes('data-pact-ready')).to.be.undefined;
  });

  /**
   * ONE KIND, ONE HOLDER — NOTHING TO DECIDE (T14 · ledger CC, `soleCandidateOf`): the card is SEEDED too, shown picked
   * and MARKED («единственная цель»), and the cursor ARRIVES on the commit (the ONE cursor rule); one press commits.
   */
  it('ONE kind and ONE holder: both SEEDED — the card shown picked and marked, the cursor on the commit', async () => {
    const w = mountLaw(menu(lawPrompt([branch('mech', 1, [MECHS])])));
    await w.vm.$nextTick();
    expect(w.find('[data-pact-row="0"]').classes()).to.include('con-pact__row--answered');
    expect(w.find('[data-pact-row="1"]').classes(), 'the card is answered').to.include('con-pact__row--answered');
    expect(w.find('[data-pact-row="1"]').attributes('data-seeded'), 'by the composer — the sole holder').to.eq('sole');
    expect(w.find(`.con-pact__card--picked[data-pact-card="${CardName.CONSTRUCTION_MECHS}"]`).exists()).to.be.true;
    expect(w.find('.con-pact__card--picked [data-seeded-mark]').exists(), 'the quiet mark under the card').to.be.true;
    expect(w.find('[data-pact-cta]').classes(), 'nothing left to ask: the cursor stands on the commit').to.include('con-pact__cta--focus');
    expect(w.find('[data-pact-cta]').attributes('data-pact-ready'), 'ready').to.not.be.undefined;
  });

  it('THE COMMIT: the Scientists\' answer inside the law\'s menu branch, and a RAIL half onto the chosen card (PL-427)', async () => {
    const w = mountLaw(menu(lawPrompt(THREE)));
    await w.find('[data-pact-opt="2"]').trigger('click');
    await w.find(`[data-pact-card="${CardName.CONSTRUCTION_MECHS}"]`).trigger('click');
    expect(w.find('[data-pact-cta]').attributes('data-pact-ready'), 'kind + card — ready').to.not.be.undefined;
    await w.find('[data-pact-cta]').trigger('click');
    const [response] = w.emitted('confirm')![0] as [unknown];
    expect(response).to.deep.eq({type: 'or', index: 1, response: {type: 'or', index: 2, response: {type: 'card', cards: [CardName.CONSTRUCTION_MECHS]}}});
    const plan = actionCommitState.plan;
    expect(plan?.specs, 'nothing rides the shell\'s wave (its ladder knows no composer row)').to.deep.eq([]);
    expect(plan?.rail?.reward.cause).to.deep.eq([{channel: 'card-resource', resource: 'mech', amount: 1, targetCard: CardName.CONSTRUCTION_MECHS}]);
    expect(plan?.rail?.holdsSurface, 'the stage stands to the touchdown').to.be.true;
    expect(plan?.rail?.capsules).to.deep.eq([CardName.CONSTRUCTION_MECHS]);
  });

  it('a scoring holder carries its VP on the rail (the score cell ticks with the token)', async () => {
    const w = mountLaw(menu(lawPrompt(THREE)));
    await w.find('[data-pact-opt="1"]').trigger('click');
    await w.find(`[data-pact-card="${CardName.SECURITY_FLEET}"]`).trigger('click');
    await w.find('[data-pact-cta]').trigger('click');
    expect(actionCommitState.plan?.rail?.reward.vp).to.deep.eq([1]);
  });

  it('PAST THE PRESS the rows stand on what was pressed while the menu moves on — a status, never a second commit', async () => {
    const w = mountLaw(menu(lawPrompt(THREE)));
    await w.find('[data-pact-opt="2"]').trigger('click');
    await w.find(`[data-pact-card="${CardName.CONSTRUCTION_MECHS}"]`).trigger('click');
    await w.find('[data-pact-cta]').trigger('click');
    // The answer took the law out of the menu (the last use) and the card holds its mech now.
    await w.setProps({playerView: playerView(undefined, [{name: CardName.CONSTRUCTION_MECHS, resources: 1}, FLEET, SHUTTLES])});
    expect(w.find(`[data-composer-card="${CardName.CONSTRUCTION_MECHS}"]`).exists(), 'the token still has its destination').to.be.true;
    const commands = w.emitted('commands')!.at(-1)![0] as Array<{label: string, enabled?: boolean}>;
    expect(commands.map((c) => [c.label, c.enabled])).to.deep.eq([['Performing…', false]]);
  });

  it('the Scientists\' party action is the same form and the same answer, by its own menu branch', async () => {
    const scientistsMeta = {party: PartyName.SCIENTISTS, actionId: 'scientists-lab', stage: 'choose', usesLeft: 1, usesPerGeneration: 1};
    const sci = {
      type: 'or', title: 'Add 2 data or 2 microbes to a card', buttonLabel: 'Add', partyActionPrompt: scientistsMeta,
      options: [{...branch('microbe', 2, [{name: CardName.TARDIGRADES, resources: 0}]), resolutionActionPrompt: undefined, partyActionPrompt: scientistsMeta}],
    } as unknown as PlayerInputModel;
    const w = mount(ConsolePartyActionComposer, {
      global: {...globalConfig.global, stubs: {'premium-card-face': true, 'ConsoleCardFaceLite': true, 'ConsolePartyPlaque': true}, directives: {...globalConfig.global.directives, 'strip-action-prefix': {}}},
      props: {playerView: playerView(menu(sci), [{name: CardName.TARDIGRADES, resources: 0}]), party: PartyName.SCIENTISTS},
    });
    await w.vm.$nextTick();
    expect(w.find('[data-pact-row="0"]').classes(), 'one kind — seeded').to.include('con-pact__row--answered');
    await w.find(`[data-pact-card="${CardName.TARDIGRADES}"]`).trigger('click');
    await w.find('[data-pact-cta]').trigger('click');
    const [response] = w.emitted('confirm')![0] as [unknown];
    expect(response).to.deep.eq({type: 'or', index: 1, response: {type: 'or', index: 0, response: {type: 'card', cards: [CardName.TARDIGRADES]}}});
  });
});

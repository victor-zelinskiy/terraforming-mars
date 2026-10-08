import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../components/getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {TileType} from '@/common/TileType';
import {PartyName} from '@/common/turmoil/PartyName';
import {StagedVoteModel} from '@/common/models/ActionPreviewModel';
import {SelectPartyModel} from '@/common/models/PlayerInputModel';
import {armStagedPlay, clearStagedPlay, markStagedPlayCommitting, StagedPlayArm, stagedStepHost} from '@/client/console/stagedPlay';
import {emptyParliamentView} from '@/client/console/parliament/consoleParliamentModel';
import {parliamentCommandsOf, stagedDoorVerb} from '@/client/console/parliament/parliamentCommands';
import {parliamentFlow, resetParliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {enterWorkspace, resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';
import ConsoleActionComposer from '@/client/components/console/ConsoleActionComposer.vue';

/**
 * THE STAGED ACTION VOTE — the vote's FOURTH door (Turmoil Redux TR15 Martian
 * Census: «spend 3 data from here to add a delegate to a resolution»). The
 * resolution door the play opened (TR03) now has a second FLOW: a blue card's
 * ACTION. Pinned here: where the step stands (the flow decides the host), the
 * mode's words (A is the action's own commit verb), and the composer's door —
 * «Выбрать резолюцию» sends nothing and hands the batch up with the card's
 * own cost as the locked receipt.
 */

const GRANT: SelectPartyModel = {
  type: 'party', title: 'Add 1 delegate to a resolution', buttonLabel: 'Add', parties: [PartyName.MARS, PartyName.GREENS],
  votePrompt: {source: 'grant', cost: 0, count: 1, printed: 1},
  choiceContext: {source: {kind: 'card', card: CardName.MARTIAN_CENSUS}, mode: 'reward'},
} as unknown as SelectPartyModel;
const STAGED: StagedVoteModel = {prompt: GRANT, sourceCard: CardName.MARTIAN_CENSUS};

function arm(flow: 'play' | 'action', target: StagedPlayArm['target']): StagedPlayArm {
  return {flow, cardName: CardName.MARTIAN_CENSUS, isEvent: false, batch: [], target, draws: 0, deckCheck: false, yieldedStack: false};
}

describe('stagedStepHost — the FLOW decides where a hosted staged step stands', () => {
  it('a PLAY\'s step stands in the hand; an ACTION\'s in «Действия карт»; a cell is no hosted step at all', () => {
    expect(stagedStepHost(arm('play', {kind: 'resolution', vote: STAGED}))).to.eq('hand');
    expect(stagedStepHost(arm('action', {kind: 'resolution', vote: STAGED}))).to.eq('card-actions');
    const cell = arm('action', {kind: 'cell', placement: {spaces: [], tileType: TileType.CITY, sourceCard: CardName.MARTIAN_CENSUS} as never});
    expect(stagedStepHost(cell), 'the board is not a host').to.eq(undefined);
    expect(stagedStepHost(undefined)).to.eq(undefined);
  });
});

describe('parliamentCommands — the staged ACTION door\'s bar', () => {
  beforeEach(() => {
    resetParliamentFlow();
    parliamentFlow.stage = 'vote';
  });
  afterEach(() => resetParliamentFlow());

  const base = {view: emptyParliamentView(), canVoteNow: true, partyActionStates: []};

  it('A «Подтвердить» (the action\'s own commit verb — nothing is being played) · X · L3 «Источник» · B «Назад»', () => {
    const cmds = parliamentCommandsOf({...base, grant: {count: 1, staged: true, stagedFlow: 'action', source: true}});
    expect(cmds.find((c) => c.control === 'confirm')).to.deep.include({label: 'Confirm', enabled: true});
    expect(cmds.find((c) => c.control === 'secondary')?.label).to.eq('Inspect');
    expect(cmds.find((c) => c.control === 'stickL')?.label).to.eq('Source');
    expect(cmds.find((c) => c.control === 'back')?.label, 'reversible — nothing was sent').to.eq('Back');
  });

  it('one verb per flow, read by the bar and the mode alike — the play door keeps «Разыграть карту»', () => {
    expect(stagedDoorVerb('action')).to.eq('Confirm');
    expect(stagedDoorVerb('play')).to.eq('Play card');
    expect(stagedDoorVerb(undefined)).to.eq('Play card');
    const play = parliamentCommandsOf({...base, grant: {count: 1, staged: true, source: true}});
    expect(play.find((c) => c.control === 'confirm')?.label).to.eq('Play card');
  });
});

const GlyphStub = {name: 'GamepadGlyph', props: ['control'], template: '<i class="glyph-stub" />'};

const PLAYER_VIEW: any = {
  id: 'p1',
  thisPlayer: {color: 'blue', name: 'Me', megacredits: 20, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0, actionsThisGeneration: [],
    tableau: [{name: CardName.MARTIAN_CENSUS, resources: 3}]},
  players: [{color: 'blue', name: 'Me', tableau: []}],
  game: {generation: 1},
  cardsInHand: [],
};

/** The server's own preview for Martian Census at 3 data: A +1 data, B 3 data → a delegate behind the Parliament's door. */
const CENSUS_PREVIEW: any = {
  card: CardName.MARTIAN_CENSUS,
  kind: 'bespoke',
  branches: [
    {index: 0, title: 'Add 1 data resource to this card', available: true, renderKeys: ['0'],
      effects: [{direction: 'gain', icon: 'data', amount: 1, current: 3, resulting: 4}], steps: []},
    {index: 1, title: 'Spend 3 data from here to add a delegate to a resolution', available: true, renderKeys: ['1'],
      effects: [
        {direction: 'cost', icon: 'data', amount: 3, current: 3, resulting: 0},
        {direction: 'cost', icon: 'delegate', amount: 1, current: 6, resulting: 5, note: 'from the reserve'},
      ],
      steps: [{kind: 'delegateGrant', staged: STAGED}]},
  ],
  preSteps: [],
};

function factory(repeat = false) {
  return mount(ConsoleActionComposer, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
    props: {
      playerView: PLAYER_VIEW,
      entry: {
        group: {key: CardName.MARTIAN_CENSUS, cardName: CardName.MARTIAN_CENSUS, isCorporation: false, isDisabled: false,
          nodes: [{key: 'a', actionNode: undefined, renderRoot: undefined, text: undefined}, {key: 'b', actionNode: undefined, renderRoot: undefined, text: undefined}]},
        cardName: CardName.MARTIAN_CENSUS,
        isCorporation: false,
        state: {status: 'available', activatable: true, reasons: [], softReason: undefined},
      } as any,
      preview: CENSUS_PREVIEW,
      nodeIndex: 1,
      repeatPickDisabled: repeat,
      publishCommands: !repeat,
      commitLabel: repeat ? 'Select this action' : 'Confirm action',
    },
  });
}

describe('ConsoleActionComposer — the vote door of a card\'s action', () => {
  afterEach(() => {
    clearStagedPlay();
    resetWorkspaceStack();
  });

  it('branch B is the Parliament\'s DOOR: «Выбрать резолюцию», and the next-step row names the Parliament', async () => {
    const w = factory();
    const vm = w.vm as any;
    vm.selectedPos = 1;
    await w.vm.$nextTick();
    expect(vm.voteEntryDoor).to.deep.eq(STAGED);
    expect(vm.commitVerbKey).to.eq('Choose the resolution');
    expect(vm.afterNotes.map((row: {text: string}) => row.text)).to.include('Resolution — chosen in the Parliament');
    vm.selectedPos = 0;
    await w.vm.$nextTick();
    expect(vm.voteEntryDoor, 'A is no door').to.eq(undefined);
    expect(vm.commitVerbKey).to.eq('Confirm action');
    w.unmount();
  });

  it('confirming B inside «Действия карт» sends NOTHING: the batch goes up with the card\'s cost as the receipt', async () => {
    enterWorkspace('card-actions');
    const w = factory();
    const vm = w.vm as any;
    vm.selectedPos = 1;
    await w.vm.$nextTick();
    vm.submit();
    await w.vm.$nextTick();
    expect(w.emitted('confirm'), 'no commit — nothing on the wire').to.eq(undefined);
    const staged = (w.emitted('staged-vote') as Array<Array<any>>)[0][0];
    expect(staged.branchIndex).to.eq(1);
    expect(staged.staged).to.deep.eq(STAGED);
    expect(staged.receipt, 'the card\'s own cost — never the delegate leaving the reserve').to.deep.eq({amount: 3, icon: 'data'});
    expect(vm.submitting, 'the composer stays editable — B in the mode comes back to it').to.eq(false);
    w.unmount();
  });

  it('outside the staged boundary the action commits as usual (the grant is met LIVE)', async () => {
    const w = factory();
    const vm = w.vm as any;
    vm.selectedPos = 1;
    await w.vm.$nextTick();
    vm.submit();
    await w.vm.$nextTick();
    expect(w.emitted('staged-vote')).to.eq(undefined);
    expect(w.emitted('confirm'), 'an ordinary commit').to.not.eq(undefined);
    w.unmount();
  });

  it('a REPEAT plan does not walk through the door (the copy is asked the resolution live)', async () => {
    const w = factory(true);
    const vm = w.vm as any;
    vm.selectedPos = 1;
    await w.vm.$nextTick();
    expect(vm.voteEntryDoor).to.eq(undefined);
    expect(vm.commitVerbKey).to.eq('Select this action');
    w.unmount();
  });
});

/**
 * TR34 MARS ARMY MECHS — the same door with a MECH as the price (the census module's spec {mech · 1 energy · 1}):
 * the receipt is the card's own cost chip whatever it is in, the capsule hold is the card's COUNT (named for no
 * resource), and the commit watcher is keyed by the step's KIND — a resolution target — never by the price's icon.
 */
const MECH_GRANT: SelectPartyModel = {
  ...GRANT,
  choiceContext: {source: {kind: 'card', card: CardName.MARS_ARMY_MECHS}, mode: 'reward'},
} as unknown as SelectPartyModel;
const MECH_STAGED: StagedVoteModel = {prompt: MECH_GRANT, sourceCard: CardName.MARS_ARMY_MECHS};

const MECH_PLAYER_VIEW: any = {
  ...PLAYER_VIEW,
  thisPlayer: {...PLAYER_VIEW.thisPlayer, energy: 1, tableau: [{name: CardName.MARS_ARMY_MECHS, resources: 1}]},
};

const MECH_PREVIEW: any = {
  card: CardName.MARS_ARMY_MECHS,
  kind: 'bespoke',
  branches: [
    {index: 0, title: 'Pay 1 energy to add a mech resource to this card', available: true, renderKeys: ['0'],
      effects: [
        {direction: 'cost', icon: 'energy', amount: 1, current: 1, resulting: 0},
        {direction: 'gain', icon: 'mech', amount: 1, current: 1, resulting: 2, note: 'on this card'},
      ], steps: []},
    {index: 1, title: 'Spend 1 mech from here to add a delegate to a resolution', available: true, renderKeys: ['1'],
      effects: [
        {direction: 'cost', icon: 'mech', amount: 1, current: 1, resulting: 0, note: 'on this card'},
        {direction: 'cost', icon: 'delegate', amount: 1, current: 6, resulting: 5, note: 'from the reserve'},
      ],
      steps: [{kind: 'delegateGrant', staged: MECH_STAGED}]},
  ],
  preSteps: [],
};

function mechFactory() {
  return mount(ConsoleActionComposer, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
    props: {
      playerView: MECH_PLAYER_VIEW,
      entry: {
        group: {key: CardName.MARS_ARMY_MECHS, cardName: CardName.MARS_ARMY_MECHS, isCorporation: false, isDisabled: false,
          nodes: [{key: 'a', actionNode: undefined, renderRoot: undefined, text: undefined}, {key: 'b', actionNode: undefined, renderRoot: undefined, text: undefined}]},
        cardName: CardName.MARS_ARMY_MECHS,
        isCorporation: false,
        state: {status: 'available', activatable: true, reasons: [], softReason: undefined},
      } as any,
      preview: MECH_PREVIEW,
      nodeIndex: 1,
      repeatPickDisabled: false,
      publishCommands: true,
      commitLabel: 'Confirm action',
    },
  });
}

describe('ConsoleActionComposer — the vote door of TR34 (a mech as the price)', () => {
  afterEach(() => {
    clearStagedPlay();
    resetWorkspaceStack();
    resetParliamentFlow();
  });

  it('A is no door (its energy price leaves on the rail); B is the Parliament\'s door with the receipt «Карта · 1 [mech]»', async () => {
    enterWorkspace('card-actions');
    const w = mechFactory();
    const vm = w.vm as any;
    vm.selectedPos = 0;
    await w.vm.$nextTick();
    expect(vm.voteEntryDoor, 'the paid A is an ordinary commit').to.eq(undefined);
    vm.selectedPos = 1;
    await w.vm.$nextTick();
    expect(vm.voteEntryDoor).to.deep.eq(MECH_STAGED);
    expect(vm.commitVerbKey).to.eq('Choose the resolution');
    vm.submit();
    await w.vm.$nextTick();
    expect(w.emitted('confirm'), 'nothing on the wire').to.eq(undefined);
    const staged = (w.emitted('staged-vote') as Array<Array<any>>)[0][0];
    expect(staged.receipt, 'ONE mech, in the card\'s own unit — never the delegate').to.deep.eq({amount: 1, icon: 'mech'});
    expect(staged.staged.sourceCard).to.eq(CardName.MARS_ARMY_MECHS);
    w.unmount();
  });

  it('the capsule hold is the card\'s COUNT, whatever it stores: 1 mech held from the mode\'s A until the cube lifts off the reserve', async () => {
    enterWorkspace('card-actions');
    const w = mechFactory();
    const vm = w.vm as any;
    vm.selectedPos = 1;
    await w.vm.$nextTick();
    expect(vm.displayedStoredCount, 'the live count before the press').to.eq(1);
    // The mode's A: the arm (a RESOLUTION target — the kind, not the icon, is what the watcher reads) goes committing.
    armStagedPlay({flow: 'action', cardName: CardName.MARS_ARMY_MECHS, isEvent: false, batch: [], target: {kind: 'resolution', vote: MECH_STAGED}, draws: 0, deckCheck: false, yieldedStack: false});
    markStagedPlayCommitting();
    await w.vm.$nextTick();
    expect(vm.stagedVoteSent).to.eq(true);
    expect(vm.stagedVoteCapsuleHeld, 'the count the player pressed with').to.eq(1);
    expect(vm.displayedStoredCount).to.eq(1);
    // The cube lifts off the reserve: the hold releases on that motion.
    parliamentFlow.stage = 'landed';
    parliamentFlow.sourceLeavingCount = 0;
    await w.vm.$nextTick();
    expect(vm.stagedVoteCubeGone).to.eq(true);
    expect(vm.stagedVoteCapsuleHeld, 'released with the cube').to.eq(undefined);
    w.unmount();
  });
});

describe('ConsoleActionComposer — the PRICE leaves before the cube (PL-100)', () => {
  afterEach(() => {
    clearStagedPlay();
    resetWorkspaceStack();
    resetParliamentFlow();
  });

  it('a price token in the air: the capsule holds through the Parliament\'s landing until the token has visibly LEFT the capsule — before any cube lifts', async () => {
    enterWorkspace('card-actions');
    const w = mechFactory();
    const vm = w.vm as any;
    vm.selectedPos = 1;
    await w.vm.$nextTick();
    armStagedPlay({flow: 'action', cardName: CardName.MARS_ARMY_MECHS, isEvent: false, batch: [], target: {kind: 'resolution', vote: MECH_STAGED}, draws: 0, deckCheck: false, yieldedStack: false});
    markStagedPlayCommitting();
    await w.vm.$nextTick();
    expect(vm.stagedVoteCapsuleHeld).to.eq(1);
    // The landing has started, the cube still stands on the bench, the price token is flying: the capsule holds.
    parliamentFlow.stage = 'landed';
    parliamentFlow.sourceLeavingCount = 1;
    parliamentFlow.priceStage = 'flying';
    await w.vm.$nextTick();
    expect(vm.stagedVotePriceGone).to.eq(false);
    expect(vm.stagedVoteCapsuleHeld, 'still held while the token is over the capsule').to.eq(1);
    // The token has visibly left the capsule — the count drops NOW, while the cube has not moved.
    parliamentFlow.priceStage = 'departed';
    await w.vm.$nextTick();
    expect(vm.stagedVotePriceGone).to.eq(true);
    expect(vm.stagedVoteCapsuleHeld, 'released on the price\'s departure, not on the cube\'s lift').to.eq(undefined);
    w.unmount();
  });

  it('no price token (a play\'s M€ door, reduced motion, nothing measurable): the capsule drops on the cube\'s lift, as before', async () => {
    enterWorkspace('card-actions');
    const w = mechFactory();
    const vm = w.vm as any;
    vm.selectedPos = 1;
    await w.vm.$nextTick();
    armStagedPlay({flow: 'action', cardName: CardName.MARS_ARMY_MECHS, isEvent: false, batch: [], target: {kind: 'resolution', vote: MECH_STAGED}, draws: 0, deckCheck: false, yieldedStack: false});
    markStagedPlayCommitting();
    await w.vm.$nextTick();
    parliamentFlow.stage = 'landed';
    parliamentFlow.sourceLeavingCount = 1;
    await w.vm.$nextTick();
    expect(vm.stagedVoteCapsuleHeld, 'the cube still on the bench').to.eq(1);
    parliamentFlow.sourceLeavingCount = 0;
    await w.vm.$nextTick();
    expect(vm.stagedVoteCapsuleHeld, 'the cube lifted').to.eq(undefined);
    w.unmount();
  });
});

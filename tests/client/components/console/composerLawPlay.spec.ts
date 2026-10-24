import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleActionComposer from '@/client/components/console/ConsoleActionComposer.vue';
import {PartyName} from '@/common/turmoil/PartyName';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {actionNodeOf, actionRowsOf} from '@/client/console/parliament/actionRows';
import {PoliticalActionEntry} from '@/client/components/actions/actionModel';
import {PoliticalActionPreview} from '@/common/models/ActionPreviewModel';
import {SelectCardModel, SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {ResolutionPlayModel} from '@/common/models/ParliamentModel';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {GlobalParameter} from '@/common/GlobalParameter';
import {RequirementType} from '@/common/cards/RequirementType';
import {Payment} from '@/common/inputs/Payment';
import {
  beginLawPlayLanding, clearLawPlayDraft, consolePlayPickState, ConsolePlayPickResult, endLawPlayLanding, rememberLawPlay,
  resetConsolePlayPick, resolveConsolePlayPick,
} from '@/client/console/consolePlayPick';
import {consoleRepeatPickState, resetConsoleRepeatPick} from '@/client/console/consoleRepeatPick';
import {playedHeroState} from '@/client/console/played/consolePlayedHero';
import {resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';

/*
 * «ОДИН ФРЕЙМВОРК» · С4 — a LAW's action in THE card composer (the party composer's law specs, carried over when it was
 * deleted). Live Experiments RX36 plays a card: the decision is a SLOT whose door is the hand album + the play composer
 * (`consolePlayPick`) with the law's PROMISED pick; the filled slot reads the card, its price, «✓ thanks to» the law
 * and the press's whole price; the play rides the composer's ONE commit, a reversible door goes up instead; the card
 * lands in this stage (PL-726); the slot comes back with its stage. R&D Funding RX26 copies an action through Viron's
 * repeat slot — a law is in nobody's tableau, so it states itself by name.
 */
const GlyphStub = {name: 'GamepadGlyph', props: ['control'], template: '<i class="glyph-stub" />'};
const LIVE = 'RDX_SCIENTISTS_LIVE_EXPERIMENTS';
const RD = 'RDX_SCIENTISTS_RD_FUNDING';

const PLAYER_VIEW: any = {
  id: 'p1',
  thisPlayer: {color: 'blue', name: 'Me', megacredits: 20, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0, tableau: []},
  players: [{color: 'blue', name: 'Me', tableau: []}],
  game: {generation: 2, gameAge: 1},
  cardsInHand: [],
};

function grass(decisive: boolean): CardModel {
  return {
    name: CardName.GRASS, calculatedCost: 11, resources: undefined,
    requirementEasing: [{
      key: 'req:temperature', index: 0, type: RequirementType.TEMPERATURE, parameter: GlobalParameter.TEMPERATURE, max: false,
      printed: -16, effective: 'waived', current: -30, met: true, decisive,
      sources: [{source: {kind: 'resolution', id: LIVE}, kind: 'waive', oneShot: true}],
    }],
  } as unknown as CardModel;
}

function promised(decisive = true): SelectProjectCardToPlayModel {
  return {
    type: 'projectCard', title: 'Play project card', buttonLabel: 'Play card',
    cards: [grass(decisive), {name: CardName.ADAPTED_LICHEN, calculatedCost: 9} as unknown as CardModel],
    paymentOptions: {},
  } as unknown as SelectProjectCardToPlayModel;
}

function lawEntry(id: string): PoliticalActionEntry {
  const root = actionRowsOf(getResolution(id as never)!.renderData)!;
  return {
    group: {key: `RESOLUTION_${id}`, nodes: [{key: `RESOLUTION_${id}#0`, actionNode: actionNodeOf(root), renderRoot: root, text: undefined}]},
    source: {kind: 'law', resolution: id as never},
    key: `RESOLUTION_${id}`,
    party: PartyName.SCIENTISTS as never,
    isCorporation: false,
    state: {status: 'available', activatable: true, reasons: [], softReason: undefined},
  };
}

function livePreview(play: ResolutionPlayModel): PoliticalActionPreview {
  return {
    source: {kind: 'law', resolution: LIVE as never},
    answer: 'option',
    kind: 'bespoke',
    branches: [{
      index: -1, title: 'Pay 6 M€ to play a card', available: true, renderKeys: [],
      effects: [{direction: 'cost', icon: 'megacredits', amount: 6, note: 'then play a card ignoring global requirements'}],
      steps: [{kind: 'lawPlay', resolution: LIVE as never, play}],
    }],
  };
}

const PLAY: ResolutionPlayModel = {input: promised(), reserve: 6, billAsks: false};

function composed(over: Partial<ConsolePlayPickResult> = {}): ConsolePlayPickResult {
  return {cardName: CardName.GRASS, payment: Payment.of({megacredits: 11}), branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: [], cost: 11, scene: {}, ...over};
}

function factory(entry: PoliticalActionEntry, preview: PoliticalActionPreview) {
  return mount(ConsoleActionComposer, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      stubs: {'GamepadGlyph': GlyphStub, 'ConsoleCardFaceLite': true, 'ConsolePlayedReceivingStage': true},
    },
    props: {playerView: PLAYER_VIEW, entry, preview, nodeIndex: 0},
  });
}

function slotChoice(vm: any) {
  return vm.allChoices.find((c: any) => c.kind === 'lawPlay');
}

describe('ConsoleActionComposer — a LAW\'s action (С4)', () => {
  afterEach(() => {
    resetConsolePlayPick();
    resetConsoleRepeatPick();
    endLawPlayLanding();
    clearLawPlayDraft();
    resetWorkspaceStack();
    playedHeroState.active = false;
    playedHeroState.phase = 'idle';
    playedHeroState.host = 'overlay';
    playedHeroState.card = undefined;
  });

  it('Live Experiments: the decision is a SLOT — empty, it invites; nothing is pre-answered', () => {
    const w = factory(lawEntry(LIVE), livePreview(PLAY));
    const vm = w.vm as any;
    expect(w.find('[data-law-play-slot]').exists(), 'the slot stands').to.be.true;
    expect(w.find('.con-composer__playslot-socket').exists(), 'empty, the card\'s place stands').to.be.true;
    expect(w.find('[data-law-play-total]').exists(), 'no total before a card').to.be.false;
    expect(vm.canConfirm, 'the commit waits for the card').to.eq(false);
    expect(w.find('.con-composer__actlaw').exists(), 'the law\'s face is the hero').to.be.true;
  });

  it('A on the slot hands the PROMISED pick to the play pick bridge — the bill\'s reserve and the law with it', () => {
    const w = factory(lawEntry(LIVE), livePreview(PLAY));
    const vm = w.vm as any;
    vm.openChoice(slotChoice(vm));
    expect(consolePlayPickState.active, 'the bridge is out').to.be.true;
    const request = consolePlayPickState.request!;
    expect(request.input.cards.map((c) => c.name)).to.deep.eq([CardName.GRASS, CardName.ADAPTED_LICHEN]);
    expect(request.reserve).to.eq(6);
    expect(request.resolution).to.eq(LIVE);
    expect(w.emitted('confirm'), 'opening the pick commits nothing').to.be.undefined;
  });

  it('the resolved play FILLS the slot — the card, «✓ thanks to» the law, the TOTAL — and only then arms the commit', async () => {
    const w = factory(lawEntry(LIVE), livePreview(PLAY));
    const vm = w.vm as any;
    vm.openChoice(slotChoice(vm));
    resolveConsolePlayPick(composed());
    await w.vm.$nextTick();
    expect(w.find('[data-law-play-name]').text()).to.eq(CardName.GRASS);
    expect(w.find('[data-law-play-slot]').attributes('data-law-play-card')).to.eq(CardName.GRASS);
    expect(w.find('[data-law-play-eased]').text(), 'the law is what lets it through').to.contain('Live Experiments');
    expect(w.find('[data-law-play-total]').text()).to.contain('6 M€ for the law + 11 M€ for the card = 17 M€');
    expect(vm.canConfirm).to.eq(true);
    expect(w.emitted('confirm'), 'filling the slot is not committing').to.be.undefined;
  });

  it('a card playable WITHOUT the law reads no «thanks to»', async () => {
    const w = factory(lawEntry(LIVE), livePreview({input: promised(false), reserve: 6, billAsks: false}));
    const vm = w.vm as any;
    vm.openChoice(slotChoice(vm));
    resolveConsolePlayPick(composed());
    await w.vm.$nextTick();
    expect(w.find('[data-law-play-eased]').exists()).to.be.false;
  });

  it('the commit carries the composed play — the host builds the law\'s ONE batch from it', async () => {
    const w = factory(lawEntry(LIVE), livePreview(PLAY));
    const vm = w.vm as any;
    vm.openChoice(slotChoice(vm));
    resolveConsolePlayPick(composed());
    await w.vm.$nextTick();
    vm.submit();
    const emitted = w.emitted('confirm');
    expect(emitted).to.have.length(1);
    expect((emitted![0][0] as any).lawPlay?.cardName).to.eq(CardName.GRASS);
    expect((emitted![0][0] as any).stepResponses, 'the slot is no plain step').to.deep.eq([]);
  });

  it('A PLAY WITH A REVERSIBLE DOOR (the staged cell) sends NOTHING at the law\'s commit — it hands the door up', async () => {
    const w = factory(lawEntry(LIVE), livePreview(PLAY));
    const vm = w.vm as any;
    vm.openChoice(slotChoice(vm));
    resolveConsolePlayPick(composed({composed: {staged: {sourceCard: CardName.GRASS} as never, composerDraft: {} as never}}));
    await w.vm.$nextTick();
    vm.submit();
    expect(w.emitted('confirm'), 'nothing is confirmed — the door is still ahead').to.be.undefined;
    const staged = w.emitted('staged-law-play');
    expect(staged).to.have.length(1);
    expect((staged![0][0] as any).lawPlay?.cardName).to.eq(CardName.GRASS);
  });

  it('THE CARD LANDS IN THE STAGE (PL-726): the receiving stage mounts hidden at the arm, rises with the scene, latches', async () => {
    const w = factory(lawEntry(LIVE), livePreview(PLAY));
    expect(w.find('[data-law-landing]').exists(), 'nothing before the commit').to.be.false;
    beginLawPlayLanding({card: CardName.GRASS, resolution: LIVE as never});
    playedHeroState.card = CardName.GRASS;
    playedHeroState.host = 'workspace';
    playedHeroState.active = true;
    playedHeroState.phase = 'armed';
    await w.vm.$nextTick();
    const layer = w.find('[data-law-landing]');
    expect(layer.exists(), 'mounted from the arm (the prewarm window)').to.be.true;
    expect(layer.classes()).not.to.include('con-composer__playstage--up');
    playedHeroState.phase = 'flying';
    await w.vm.$nextTick();
    expect(w.find('[data-law-landing]').classes(), 'up with the scene').to.include('con-composer__playstage--up');
    endLawPlayLanding();
    await w.vm.$nextTick();
    expect(w.find('[data-law-landing]').classes(), 'latched once it rose').to.include('con-composer__playstage--up');
  });

  it('the slot COMES BACK with its stage — a remount re-seats it from the kept play', async () => {
    rememberLawPlay(LIVE as never, composed());
    const w = factory(lawEntry(LIVE), livePreview(PLAY));
    await w.vm.$nextTick();
    expect(w.find('[data-law-play-name]').text(), 'the card stands in the slot again').to.eq(CardName.GRASS);
    expect((w.vm as any).canConfirm, 'and the commit is armed').to.eq(true);
  });

  it('R&D Funding: the copy is Viron\'s repeat SLOT — the law is in nobody\'s tableau, so it states itself by name', () => {
    const input = {type: 'card', title: 'Use an action on one of your cards a second time (R&D Funding)', buttonLabel: 'Take action',
      cards: [{name: CardName.TARDIGRADES}], repeatActionPrompt: true, min: 1, max: 1} as unknown as SelectCardModel;
    const preview: PoliticalActionPreview = {
      source: {kind: 'law', resolution: RD as never}, answer: 'direct', kind: 'bespoke',
      branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: [{kind: 'input', input, repeatAction: true}]}],
    };
    const w = factory(lawEntry(RD), preview);
    const vm = w.vm as any;
    const slot = vm.allChoices.find((c: any) => c.repeatAction === true);
    expect(slot, 'the repeat slot').to.not.eq(undefined);
    vm.openChoice(slot);
    expect(consoleRepeatPickState.active).to.be.true;
    const request = consoleRepeatPickState.request!;
    expect(request.candidates).to.deep.eq([CardName.TARDIGRADES]);
    expect(request.source.card, 'a law is in nobody\'s tableau').to.be.undefined;
    expect(request.source.label, 'so it states itself by name').to.eq('R&D Funding');
    expect(w.emitted('confirm'), 'opening the pick commits nothing').to.be.undefined;
  });
});

describe('ConsoleActionComposer — a LAW\'s hand pick names the LAW (Open IP Trade)', () => {
  it('the album\'s source is the law\'s printed name with its resolution — never a thrown «only a card has»', () => {
    const w = factory(lawEntry(LIVE), livePreview(PLAY));
    const source = (w.vm as any).handPickSource();
    expect(source?.resolution, 'L3 opens the law\'s own inspector').to.eq(LIVE);
    expect(source?.card, 'the chip names the law by its printed name').to.eq(getResolution(LIVE as never)!.text.name);
    expect(source?.kicker).to.eq('Action setup');
  });
});

import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleHydroSection from '@/client/components/console/ConsoleHydroSection.vue';
import {
  HydroCommitRecord, HydroTraversalSegmentRecord, beginHydroCommit, resetHydroFlow,
} from '@/client/console/hydroFlow/consoleHydroFlow';
import {hydroMarkerState, resetHydroMarker} from '@/client/console/hydroMarker/consoleHydroMarker';
import {hydroNetworkState, resetHydroPlan} from '@/client/components/hydronetwork/hydroNetworkState';

/**
 * THE TERMINAL STAGE FOLLOWS THE PRESENTATION CURSOR — never the rules cursor.
 *
 * The server commits the whole resolution (final position, every reward, the
 * VP) the moment the response applies; the workspace then PRESENTS it as an
 * ordered sequence. These pin the split for the terminal reward, which is
 * where it shipped broken: with the marker walking the middle of the track
 * the scene already showed «Архитектор гидросети», the 5 ПО hero, «Этап 11
 * из 11» and the «ФИНАЛЬНАЯ НАГРАДА» crumb tail — the finale standing on
 * stage before the movement had reached it.
 */
type Vm = {
  sceneKey: string,
  cereVisible: boolean,
  crumbStage: string,
  crumbSubject: string,
  presentedCommitStage: {position: number, nameKey: string} | undefined,
  ctxView: {kind: string, nameKey?: string, posText?: string, vp?: number},
};

function viewerPlayer() {
  return {
    color: 'red',
    steel: 1, plants: 2, titanium: 0, energy: 3, heat: 0, megacredits: 10,
    megacreditProduction: 0, steelProduction: 0, titaniumProduction: 0,
    plantProduction: 0, energyProduction: 1, heatProduction: 0,
    tags: {},
    tableau: [],
    deltaProject: {position: 11, stops: []},
  };
}

function mountSection() {
  return mount(ConsoleHydroSection, {
    props: {
      playerView: {
        thisPlayer: viewerPlayer(),
        players: [viewerPlayer()],
        game: {},
        waitingFor: undefined,
      } as never,
      actionAvailable: false,
      ownsPrompt: false,
    },
    global: {stubs: {ConsoleWsHead: true, ConsoleCardFaceLite: true, ConsoleSourceDock: true, ConsolePlayedTargetStep: true, GamepadGlyph: true, HydroReward: true, ConsolePaymentPanel: true}},
  });
}

function seg(position: number, kind: HydroTraversalSegmentRecord['kind'], nameKey: string): HydroTraversalSegmentRecord {
  return {position, kind, stageNameKey: nameKey, transfers: [], rewardLines: []};
}

/** A committed 1 → 11 traversal whose destination is the 5 VP ceremony. */
function terminalTraversal(): Omit<HydroCommitRecord, 'phase'> {
  return {
    kind: 'ceremony',
    fromPosition: 1,
    toPosition: 11,
    spend: 10,
    spendSteel: 0,
    rewardChoice: undefined,
    selectedCard: undefined,
    composedRepeat: false,
    targetBefore: undefined,
    rewardLines: [],
    vp: 5,
    stageNameKey: 'Hydronetwork Architect',
    traversal: [
      seg(2, 'plain', 'Pumping Nodes'),
      seg(5, 'deck-draw', 'Hydro Modeling'),
      seg(7, 'repeat', 'Microbial Fixation'),
      seg(11, 'ceremony', 'Hydronetwork Architect'),
    ],
  };
}

describe('consoleHydroSection — the terminal stage waits for the marker', () => {
  afterEach(() => {
    // Module state is BUNDLE-SHARED under mochapack.
    resetHydroFlow();
    resetHydroMarker();
    resetHydroPlan();
    hydroNetworkState.previewColor = undefined as never;
    hydroNetworkState.preview = undefined;
  });

  it('the terminal scene has NO presence while the presentation cursor is mid-track', async () => {
    const wrapper = mountSection();
    beginHydroCommit(terminalTraversal());
    // The sequence is PAUSED on the stage-5 stop: cursor points past the leg
    // it just finished (paused semantics — at = cursor − 1).
    hydroMarkerState.planCursor = 2;
    hydroMarkerState.planLength = 4;
    hydroMarkerState.planPaused = true;
    hydroMarkerState.visualPosition = 5;
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as Vm;
    // Rules cursor (server position 11) ≠ presentation cursor (stage 5) — and
    // every identity surface reads the PRESENTATION one.
    expect(vm.presentedCommitStage).deep.eq({position: 5, nameKey: 'Hydro Modeling'});
    expect(vm.ctxView.nameKey, 'the ctx column names the CURRENT cell').eq('Hydro Modeling');
    expect(vm.ctxView.posText, 'never «Этап 11 из 11» mid-walk').to.contain('5');
    expect(vm.ctxView.vp, 'no 5 ПО glyph before arrival').eq(undefined);
    expect(vm.crumbSubject).eq('Hydro Modeling');
    expect(vm.crumbStage, 'the tail may not read «Final reward» on a mid-track stop').not.eq('Final reward');
    // …and the ceremony hero is NOT in the DOM at all — no early terminal
    // scene to hide with opacity tricks.
    expect(vm.cereVisible).eq(false);
    expect(wrapper.find('.con-hydro__cere').exists()).eq(false);
    wrapper.unmount();
  });

  it('gliding between legs the tail reads «Movement», still never the finale', async () => {
    const wrapper = mountSection();
    beginHydroCommit(terminalTraversal());
    hydroMarkerState.planCursor = 3;
    hydroMarkerState.planLength = 4;
    hydroMarkerState.planPaused = false;
    hydroMarkerState.visualPosition = 7;
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as Vm;
    expect(vm.crumbStage).eq('Movement');
    expect(wrapper.find('.con-hydro__cere').exists()).eq(false);
    wrapper.unmount();
  });

  it('the ceremony seat exists exactly from the marker settling on the terminal stop', async () => {
    const wrapper = mountSection();
    beginHydroCommit(terminalTraversal());
    // The plan finished: the cursor yielded to the server truth and the
    // marker settled on the finish stop — THIS is the arrival.
    hydroMarkerState.planCursor = -1;
    hydroMarkerState.visualPosition = -1;
    hydroMarkerState.settledPosition = 11;
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as Vm;
    expect(vm.cereVisible).eq(true);
    expect(wrapper.find('.con-hydro__cere').exists()).eq(true);
    expect(vm.presentedCommitStage).deep.eq({position: 11, nameKey: 'Hydronetwork Architect'});
    expect(vm.ctxView.vp, 'the 5 ПО identity arrives WITH the marker').eq(5);
    wrapper.unmount();
  });

  it('a SINGLE terminal landing is the same rule — nothing during the glide, the seat at the settle', async () => {
    const wrapper = mountSection();
    beginHydroCommit({
      ...terminalTraversal(),
      fromPosition: 10,
      toPosition: 11,
      spend: 1,
      traversal: undefined,
    });
    // Mid-glide: the marker is airborne, nothing settled.
    hydroMarkerState.active = true;
    hydroMarkerState.settledPosition = -1;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-hydro__cere').exists(), 'no terminal scene mid-glide').eq(false);

    hydroMarkerState.active = false;
    hydroMarkerState.settledPosition = 11;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-hydro__cere').exists(), 'the seat stands at the arrival').eq(true);
    wrapper.unmount();
  });
});

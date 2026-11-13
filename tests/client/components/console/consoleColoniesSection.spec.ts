/*
 * ConsoleColoniesSection — the colony workspace of the console shell. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md). A surface this size is proven by its e2e; what this spec owns is the conversion's
 * contract: it mounts in a minimal honest state without a Vue warning (`globalConfig` promotes one to a failure),
 * the grid, the fleet dock and the status rail read its props, the cursor FOLLOWS `index`, and a parent's ref
 * reaches EXACTLY the members the shell's controllers call through the surface registry (R11 — `colonyController`,
 * `padRouterController`) and each of them still does its work: the descent into a colony / the dossier / a fleet
 * dock, the pad routed to the stage that stands (three child refs), the stage's hold and release, the completion
 * dwell (a wait of the flow kernel — the spec drives the kernel's clock) and the roster's reseat.
 *
 * The children are stand-ins by name: the tile, the header, the fleet bar and the three stages have specs of their
 * own; this one reads what the SECTION hands them and what it asks of them.
 */
import {expect} from 'chai';
import {flushPromises, mount, VueWrapper} from '@vue/test-utils';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';
import {ColonyModel} from '@/common/models/ColonyModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {
  colonyDockCursor, colonyFocusState, colonyGridLayout, ColonyFocusIntent, resetColonyDockCursor, resetColonyFocus,
} from '@/client/console/consoleColoniesModel';
import {FleetDockView} from '@/client/console/colonyTrade/fleetDockModel';
import {colonyRosterState, setColonyRosterLanding} from '@/client/console/colonyRoster/consoleColonyRoster';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import type {ConsoleColonyPick} from '@/client/components/console/consoleColoniesSectionTypes';
import ConsoleColoniesSection from '@/client/components/console/ConsoleColoniesSection.vue';

const RED: Color = 'red';
const BLUE: Color = 'blue';

const A: GamepadIntent = {kind: 'press', button: 'confirm'};

/** The sheet's MUST EXPOSE list (`node scripts/vapor/inventory.mjs --component …`) — `$el` aside (R12: step A keeps it). */
const EXPOSED = [
  'completeFlow', 'enterDockFocus', 'enterFocus', 'enterFocusFromInspect', 'handleFocusIntent', 'holdDockStage',
  'holdFocusStage', 'releaseFocusInPlace', 'releaseFocusStage', 'reseatRosterLevel', 'retargetFocusHome',
];

/** What the shell's controllers reach through the surface registry. */
type Exposed = {
  completeFlow(): void,
  enterDockFocus(): void,
  enterFocus(intent: ColonyFocusIntent): void,
  enterFocusFromInspect(intent: ColonyFocusIntent): void,
  handleFocusIntent(intent: GamepadIntent): void,
  holdDockStage(): void,
  holdFocusStage(): void,
  releaseFocusInPlace(): void,
  releaseFocusStage(): void,
  reseatRosterLevel(apply: () => void): Promise<void>,
  retargetFocusHome(name: string): boolean,
};

function colony(name: ColonyName, over: Partial<ColonyModel> = {}): ColonyModel {
  return {name, isActive: true, trackPosition: 0, visitor: undefined, colonies: [], ...over};
}

/** Luna is open to the viewer's trade; Ganymede is not in play yet; Bo's fleet stands on Titan. */
function table(): Array<ColonyModel> {
  return [
    colony(ColonyName.LUNA, {trackPosition: 2, colonies: [RED]}),
    colony(ColonyName.GANYMEDE, {isActive: false}),
    colony(ColonyName.TITAN, {visitor: BLUE}),
  ];
}

function players(): Array<PublicPlayerModel> {
  return [
    {color: BLUE, name: 'Bo', fleetSize: 1, tradesThisGeneration: 0, tableau: []} as unknown as PublicPlayerModel,
    {color: RED, name: 'Ada', fleetSize: 1, tradesThisGeneration: 0, tableau: []} as unknown as PublicPlayerModel,
  ];
}

function dock(): FleetDockView {
  return {
    card: CardName.ANTS,
    model: {name: CardName.ANTS} as unknown as CardModel,
    dockedColor: undefined,
    offer: {card: CardName.ANTS, available: true, effects: []},
  };
}

type TileStatus = {kind: string, text: string};

const TileStub = defineComponent({
  name: 'ConsoleColonyTile',
  inheritAttrs: false,
  props: {
    colony: {type: Object as PropType<ColonyModel>, required: true},
    focused: {type: Boolean, default: false},
    status: {type: Object as PropType<TileStatus>, default: () => ({kind: 'none', text: ''})},
  },
  setup(props) {
    return () => h('div', {'class': 'tile-stub', 'data-test': `con-colony-${props.colony.name}`});
  },
});

const HeadStub = defineComponent({
  name: 'ConsoleWsHead',
  inheritAttrs: false,
  props: {
    root: {type: String, default: ''},
    subject: {type: String, default: ''},
    stage: {type: String, default: ''},
    committed: {type: Boolean, default: false},
  },
  setup(_props, {slots}) {
    return () => h('header', {class: 'head-stub'}, [slots.default?.(), slots.trailing?.()]);
  },
});

const FleetBarStub = defineComponent({
  name: 'ConsoleColonyFleetBar',
  inheritAttrs: false,
  props: {
    chips: {type: Array as PropType<ReadonlyArray<unknown>>, default: () => []},
    launchingColor: {type: String, default: ''},
  },
  setup() {
    return () => h('div', {class: 'fleetbar-stub'});
  },
});

const DockTileStub = defineComponent({
  name: 'ConsoleFleetDockTile',
  inheritAttrs: false,
  props: {focused: {type: Boolean, default: false}},
  setup() {
    return () => h('div', {class: 'docktile-stub'});
  },
});

/** A stage the section stands a ref on: it exposes what the section calls and records the calls. */
function stageStub(name: string, calls: Array<string>) {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: {
      colony: {type: Object as PropType<ColonyModel | undefined>, default: undefined},
      intent: {type: String, default: ''},
      actionAvailable: {type: Boolean, default: false},
      blockReason: {type: String, default: ''},
      card: {type: String, default: ''},
      available: {type: Boolean, default: false},
    },
    setup(_props, {expose}) {
      expose({
        handleIntent: (intent: GamepadIntent) => {
          calls.push(`${name}.handleIntent(${intent.kind})`);
        },
        holdPresentation: () => {
          calls.push(`${name}.holdPresentation`);
        },
        releasePresentation: () => {
          calls.push(`${name}.releasePresentation`);
        },
      });
      return () => h('div', {class: `stage-stub stage-stub--${name}`});
    },
  });
}

function stubsFor(calls: Array<string>) {
  return {
    ConsoleColonyTile: TileStub,
    ConsoleWsHead: HeadStub,
    ConsoleColonyFleetBar: FleetBarStub,
    ConsoleFleetDockTile: DockTileStub,
    ConsoleColonyFocusStage: stageStub('ConsoleColonyFocusStage', calls),
    ConsoleColonyInspect: stageStub('ConsoleColonyInspect', calls),
    ConsoleFleetDockStage: stageStub('ConsoleFleetDockStage', calls),
    ActionEffectChip: true,
    BenefitGlyph: true,
    PlayerCube: true,
    PremiumCountGlyph: true,
  };
}

function mountSection(props: Record<string, unknown> = {}): VueWrapper<any> {
  return mount(ConsoleColoniesSection, {
    global: {...globalConfig.global, stubs: stubsFor([])},
    props: {
      colonies: table(),
      index: 0,
      tradeable: [ColonyName.LUNA],
      players: players(),
      viewerColor: RED,
      ...props,
    },
  });
}

function trackDisplay(model: ColonyModel): string {
  const max = getColony(model.name).trade.quantity.length - 1;
  return `${Math.min(model.trackPosition, max) + 1}/${max + 1}`;
}

describe('ConsoleColoniesSection — the colony workspace', () => {
  let originalTranslations: unknown;
  let clock: ManualFlowClock;
  let mounted: Array<VueWrapper<any>>;

  function keep<T extends VueWrapper<any>>(wrapper: T): T {
    mounted.push(wrapper);
    return wrapper;
  }

  beforeEach(() => {
    // No translation table: the English key is the honest answer (and the translator's hint stays quiet).
    originalTranslations = (window as any)._translations;
    (window as any)._translations = undefined;
    clock = createManualClock(0);
    setFlowClock(clock);
    mounted = [];
    resetColonyFocus();
    resetColonyDockCursor();
  });

  afterEach(async () => {
    // The section's waits are its own flow scope's: they go with it, on the clock they were armed on.
    for (const wrapper of mounted) {
      wrapper.unmount();
    }
    await flushPromises();
    setFlowClock(undefined);
    setColonyRosterLanding(false);
    resetColonyFocus();
    resetColonyDockCursor();
    (window as any)._translations = originalTranslations;
  });

  it('mounts in a minimal honest state: the workspace frame, a tile per colony, the fleet dock and the focused colony\'s rail', () => {
    const w = keep(mountSection());

    expect(w.classes()).to.include.members(['con-colonies', `con-colonies--${colonyGridLayout(3, false, 0)}`, 'con-ws']);
    expect(w.classes(), 'standalone').to.not.contain('con-colonies--embedded');
    expect(w.classes(), 'browsing').to.not.contain('con-colonies--focus');
    expect(w.attributes('data-colony-mode')).to.eq('browse');

    const head = w.findComponent(HeadStub);
    expect(head.props(), 'at depth 0 the screen is its own root and carries nothing yet').to.deep.eq({root: 'Colonies', subject: '', stage: '', committed: false});

    const tiles = w.findAllComponents(TileStub);
    expect(tiles.map((t) => t.props('colony').name)).to.deep.eq([ColonyName.LUNA, ColonyName.GANYMEDE, ColonyName.TITAN]);
    expect(tiles.map((t) => t.props('focused')), 'the cursor').to.deep.eq([true, false, false]);
    expect(tiles.map((t) => t.props('status')), 'a tile speaks only when the COLONY refuses').to.deep.eq([
      {kind: 'none', text: ''},
      {kind: 'inactive', text: 'Not active yet'},
      {kind: 'blocked', text: 'Trade fleet of Bo is currently here'},
    ]);
    expect(w.findAll('.con-colonies__slot').map((s) => s.classes().includes('con-colonies__slot--focused'))).to.deep.eq([true, false, false]);

    // The fleet dock: the viewer first; a fleet standing on a tile is not a free one.
    expect(w.findComponent(FleetBarStub).props('chips')).to.deep.eq([
      {color: RED, name: 'Ada', free: 1, total: 1, me: true},
      {color: BLUE, name: 'Bo', free: 0, total: 1, me: false},
    ]);

    const rail = w.find('footer.con-colonies__rail');
    expect(rail.find('.con-colonies__rail-name').text()).to.eq(ColonyName.LUNA);
    expect(rail.find('.con-colonies__rail-track').text()).to.eq(trackDisplay(table()[0]));
    expect(rail.find('.con-colonies__rail-reason').exists(), 'an offered colony names no blocker').to.eq(false);
  });

  it('the cursor follows `index` — the tile under it, and the rail that reads it', async () => {
    const w = keep(mountSection());

    await w.setProps({index: 2});
    expect(w.findAllComponents(TileStub).map((t) => t.props('focused'))).to.deep.eq([false, false, true]);
    expect(w.findAll('.con-colonies__slot--focused').length).to.eq(1);
    const rail = w.find('footer.con-colonies__rail');
    expect(rail.find('.con-colonies__rail-name').text()).to.eq(ColonyName.TITAN);
    const reason = rail.find('.con-colonies__rail-reason');
    expect(reason.classes()).to.contain('con-colonies__rail-reason--blocked');
    expect(reason.text()).to.contain('Trade fleet of Bo is currently here');

    await w.setProps({index: 1});
    const inactive = w.find('footer.con-colonies__rail .con-colonies__rail-reason');
    expect(inactive.classes()).to.contain('con-colonies__rail-reason--inactive');
    expect(inactive.text()).to.contain('Not active yet');
  });

  it('a server pick turns the grid into its candidates: the mode chip, the server\'s own reason on a refused tile, a host\'s frame when embedded', async () => {
    const pick: ConsoleColonyPick = {
      selectable: [ColonyName.LUNA],
      reasons: {[ColonyName.TITAN]: 'Colony is full'},
      buttonLabel: 'Select',
      labelKey: 'Select',
    };
    const w = keep(mountSection({pick, tradeable: []}));

    expect(w.attributes('data-colony-mode')).to.eq('pick');
    expect(w.find('.head-stub .con-colonies__mode-chip').text()).to.eq('Select');
    expect(w.findAllComponents(TileStub).map((t) => t.props('status'))).to.deep.eq([
      {kind: 'none', text: ''},
      {kind: 'blocked', text: 'Unavailable right now'},
      {kind: 'blocked', text: 'Colony is full'},
    ]);

    // Embedded (a step of another workspace) the shell comes off: no header, no `con-ws` marker — the host draws both.
    await w.setProps({embedded: true});
    expect(w.classes()).to.contain('con-colonies--embedded');
    expect(w.classes()).to.not.contain('con-ws');
    expect(w.findComponent(HeadStub).exists()).to.eq(false);
    expect(w.find('.con-colonies__toolbar .con-colonies__mode-chip').text()).to.eq('Select');
  });

  describe('through a parent\'s ref (the shell\'s surface registry)', () => {
    let calls: Array<string>;
    let completed: number;

    function mountUnderHost(props: Record<string, unknown> = {}) {
      calls = [];
      completed = 0;
      const Host = defineComponent({
        render: () => h('div', [h(ConsoleColoniesSection, {
          ref: 'section',
          colonies: table(),
          index: 0,
          tradeable: [ColonyName.LUNA],
          players: players(),
          viewerColor: RED,
          onFlowComplete: () => {
            completed++;
          },
          ...props,
        })]),
      });
      const host = keep(mount(Host, {global: {...globalConfig.global, stubs: stubsFor(calls)}}));
      return {host, section: host.vm.$refs.section as Exposed};
    }

    it('exposes exactly the members the controllers call', () => {
      const {section} = mountUnderHost();
      expect(Object.keys(section).sort()).to.deep.eq([...EXPOSED].sort());
      for (const name of EXPOSED) {
        expect(typeof (section as unknown as Record<string, unknown>)[name], name).to.eq('function');
      }
    });

    it('`enterFocus` descends into the colony under the cursor, and the pad, the hold and the release reach the stage that stands', async () => {
      const {host, section} = mountUnderHost();

      section.enterFocus('trade');
      expect({open: colonyFocusState.open, colony: colonyFocusState.colonyName, intent: colonyFocusState.intent})
        .to.deep.eq({open: true, colony: ColonyName.LUNA, intent: 'trade'});
      await nextTick();

      expect(host.find('.con-colonies').classes()).to.contain('con-colonies--focus');
      expect(host.find('.con-colonies__browse').classes(), 'the browse layer is parked, never unmounted').to.contain('con-colonies__browse--parked');
      const stage = host.findComponent({name: 'ConsoleColonyFocusStage'});
      expect(stage.props('colony').name).to.eq(ColonyName.LUNA);
      expect(stage.props('intent')).to.eq('trade');
      expect(stage.props('actionAvailable'), 'the server offers this trade').to.eq(true);
      expect(host.findComponent(HeadStub).props('subject'), 'the crumb gains the carried colony').to.eq(ColonyName.LUNA);

      section.handleFocusIntent(A);
      section.holdFocusStage();
      section.releaseFocusStage();
      expect(calls).to.deep.eq([
        'ConsoleColonyFocusStage.handleIntent(press)',
        'ConsoleColonyFocusStage.holdPresentation',
        'ConsoleColonyFocusStage.releasePresentation',
      ]);

      // A second press while a stage stands opens nothing else.
      section.enterFocus('inspect');
      expect(colonyFocusState.intent).to.eq('trade');
    });

    it('the dossier takes the pad while it stands, and `enterFocusFromInspect` hands the same colony over to its act', async () => {
      const {host, section} = mountUnderHost();

      section.enterFocusFromInspect('trade');
      expect(colonyFocusState.open, 'no dossier — nothing to hand over').to.eq(false);

      section.enterFocus('inspect');
      await nextTick();
      expect(host.findComponent({name: 'ConsoleColonyInspect'}).exists()).to.eq(true);
      expect(host.findComponent({name: 'ConsoleColonyFocusStage'}).exists()).to.eq(false);
      section.handleFocusIntent(A);
      expect(calls).to.deep.eq(['ConsoleColonyInspect.handleIntent(press)']);

      section.enterFocusFromInspect('trade');
      expect({open: colonyFocusState.open, colony: colonyFocusState.colonyName, intent: colonyFocusState.intent})
        .to.deep.eq({open: true, colony: ColonyName.LUNA, intent: 'trade'});
      await nextTick();
      expect(host.findComponent({name: 'ConsoleColonyInspect'}).exists()).to.eq(false);
      expect(host.findComponent({name: 'ConsoleColonyFocusStage'}).exists()).to.eq(true);
    });

    it('`enterDockFocus` descends into the dock under the cursor, and the hold and the pad reach the dock\'s stage', async () => {
      const {host, section} = mountUnderHost({docks: [dock()]});

      section.enterDockFocus();
      expect(colonyFocusState.open, 'the cursor stands on a colony — no dock to enter').to.eq(false);

      colonyDockCursor.active = true;
      colonyDockCursor.index = 0;
      await nextTick();
      expect(host.findComponent(DockTileStub).props('focused')).to.eq(true);
      expect(host.findAllComponents(TileStub).map((t) => t.props('focused')), 'one cursor: it left the tiles').to.deep.eq([false, false, false]);

      section.enterDockFocus();
      expect({open: colonyFocusState.open, colony: colonyFocusState.colonyName, dock: colonyFocusState.dock})
        .to.deep.eq({open: true, colony: '', dock: CardName.ANTS});
      await nextTick();
      const stage = host.findComponent({name: 'ConsoleFleetDockStage'});
      expect(stage.props('card')).to.eq(CardName.ANTS);
      expect(stage.props('available'), 'the server\'s own verdict, off the offer').to.eq(true);

      section.holdDockStage();
      section.handleFocusIntent(A);
      expect(calls).to.deep.eq(['ConsoleFleetDockStage.holdPresentation', 'ConsoleFleetDockStage.handleIntent(press)']);
    });

    it('`completeFlow` gives the scene its dwell, then folds the stage and tells the shell — once', async () => {
      const {section} = mountUnderHost();
      section.enterFocus('trade');
      await nextTick();

      section.completeFlow();
      section.completeFlow();
      expect(colonyFocusState.open, 'the dwell stands first').to.eq(true);
      expect(completed).to.eq(0);

      clock.advance(1000);
      expect(colonyFocusState.open).to.eq(false);
      expect(completed, 'a second ask inside the dwell arms nothing').to.eq(1);

      // Nothing to fold — nothing to tell.
      section.completeFlow();
      clock.advance(1000);
      expect(completed).to.eq(1);
    });

    it('`retargetFocusHome` refuses a tile it cannot measure, `releaseFocusInPlace` lets go, and a reseat in flight applies at once', async () => {
      const {section} = mountUnderHost();

      // Under jsdom no tile has a box: the fold then lets go where it stands.
      expect(section.retargetFocusHome(ColonyName.LUNA)).to.eq(false);
      expect(section.retargetFocusHome('Nowhere')).to.eq(false);
      expect(() => section.releaseFocusInPlace()).to.not.throw();

      // A level change while the roster's own beat holds the pad is applied without a second reseat.
      setColonyRosterLanding(true);
      let applied = 0;
      await section.reseatRosterLevel(() => {
        applied++;
      });
      expect(applied).to.eq(1);
      expect(colonyRosterState.landing, 'the beat in flight keeps its own flag').to.eq(true);
    });
  });
});

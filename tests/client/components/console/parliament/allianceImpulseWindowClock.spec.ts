/*
 * THE ALLIANCE'S IMPULSE WAITS FOR THE CHAMBER'S REST, not for a clock started at the change (FLAKE ZERO Ф4, class N).
 * The access changes the moment the government has changed places — mid-enactment — and the beat's rest after it plays
 * at the machine's pace. The owed impulse's window (6 s) ran from the change: on a slow renderer it ran out before the
 * chamber was ever at rest, and the activation was never shown in its sitting. The window counts from the rest now
 * (re-armed while a beat plays), bounded by a hard ceiling.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, PropType} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {PartyAccessModel} from '@/common/models/ParliamentModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {emptyParliamentView, ParliamentPartyVm, ParliamentViewVm, PartyActionStateVm, partyStateOf} from '@/client/console/parliament/consoleParliamentModel';
import {resetParliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {allianceImpulseState, resetAllianceImpulse, seedAllianceSeen} from '@/client/console/parliament/allianceImpulse';
import {sittingMotion} from '@/client/console/parliament/sittingDirector';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import ConsoleParliamentParties from '@/client/components/console/parliament/ConsoleParliamentParties.vue';

const BLUE: Color = 'blue';
const M: ReduxParty = PartyName.MARS;
const R: ReduxParty = PartyName.REDS;

const TeleportStub = defineComponent({
  name: 'ConsoleTeleport',
  props: {to: {type: String, required: true}, disabled: {type: Boolean, default: false}, defer: {type: Boolean, default: false}},
  setup: (_props, {slots}) => () => h('div', {class: 'teleport-stub'}, slots.default?.()),
});
/** The plaque is its own spec's subject — here it only carries the SEAL the impulse flies between. */
const PlaqueStub = defineComponent({
  name: 'ConsolePartyPlaque',
  props: {party: {type: String as PropType<ReduxParty>, required: true}},
  inheritAttrs: false,
  render: () => h('i', {class: 'plaque-stub'}, [h('span', {class: 'con-pseal__seal'})]),
});

function access(party: ReduxParty, over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return {party, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false, ...over};
}
const marsRuling = () => access(M, {ruling: true, hasEffect: true, satisfiesRequirement: true, alliances: [{partner: R, source: CardName.THARSIS_ALLIANCE}]});
const redsAllied = () => access(R, {
  allied: [{via: M, source: CardName.THARSIS_ALLIANCE, road: 'ruling'}], alliances: [{partner: M, source: CardName.THARSIS_ALLIANCE}],
  hasEffect: true, satisfiesRequirement: true,
});
const redsDormant = () => access(R, {alliances: [{partner: M, source: CardName.THARSIS_ALLIANCE}]});

function view(holds: ReadonlyArray<PartyAccessModel>): ParliamentViewVm {
  const party = (p: ReduxParty): ParliamentPartyVm => ({
    party: p, effect: undefined, rule: 'r', support: 0, inArea: false, ruling: p === M,
    access: holds.find((a) => a.party === p) ?? access(p), actionId: undefined, action: undefined, bannerCubes: [],
  });
  return {
    ...emptyParliamentView(),
    rulingParty: M,
    parties: REDUX_PARTIES.map(party),
    viewer: {
      color: BLUE, name: 'me', participates: true, lobby: true, reserve: 5, onResolutions: 0, chairman: false, agenda: 0, influence: 0,
      access: holds, partyActionUses: {}, resolutionActionUses: 0,
    } as ParliamentViewVm['viewer'],
  };
}

/** Every seal stands on screen, each in its own place, and is the topmost thing at its centre. */
function sealsOnScreen(): void {
  const seals = Array.from(document.querySelectorAll<HTMLElement>('.con-parl__party .con-pseal__seal'));
  seals.forEach((seal, i) => {
    const rect = {left: 100 + i * 120, top: 200, width: 60, height: 60};
    seal.getBoundingClientRect = () => ({...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => ({})}) as DOMRect;
  });
  document.elementsFromPoint = (x: number) => {
    const seal = seals.find((s) => {
      const r = s.getBoundingClientRect();
      return x >= r.left && x <= r.right;
    });
    return seal === undefined ? [] : [seal];
  };
}

async function microtasks(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('ConsoleParliamentParties — the alliance\'s impulse waits for the chamber\'s rest (FLAKE ZERO Ф4)', () => {
  let clock: ManualFlowClock;
  const originalFromPoint = document.elementsFromPoint;

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    resetParliamentFlow();
    resetParliamentHolds();
    resetAllianceImpulse();
    Object.defineProperty(window, 'innerWidth', {value: 1920, configurable: true});
    Object.defineProperty(window, 'innerHeight', {value: 1080, configurable: true});
    // The pose the player landed in: the pair dormant — the alliance's activation is what the chamber owes.
    seedAllianceSeen({thisPlayer: {color: BLUE}, game: {parliament: {players: [{color: BLUE, access: [marsRuling(), redsDormant()]}]}}} as unknown as PlayerViewModel);
  });

  afterEach(() => {
    sittingMotion.beat = '';
    document.elementsFromPoint = originalFromPoint;
    resetParliamentFlow();
    resetParliamentHolds();
    resetAllianceImpulse();
    setFlowClock(undefined);
  });

  it('a beat that plays past the window keeps the impulse waiting — it flies once the chamber is at rest', async () => {
    // The enactment's beat still plays when the access changes (the government has just changed places).
    sittingMotion.beat = 'enact';
    const v = view([marsRuling(), redsAllied()]);
    const wrapper = mount(ConsoleParliamentParties as any, {
      ...globalConfig,
      attachTo: document.body,
      props: {
        view: v, partyStates: v.parties.map((p) => partyStateOf(p, true)), viewerColor: BLUE,
        partyActionStates: REDUX_PARTIES.map((): PartyActionStateVm => ({kind: 'none', label: '', reason: undefined, usesLeft: 0, usesPerGeneration: 0})),
      },
      global: {...globalConfig.global, stubs: {ConsoleTeleport: TeleportStub, ConsolePartyPlaque: PlaqueStub}},
    });
    try {
      sealsOnScreen();
      expect(allianceImpulseState.pending.has(R), 'the activation is owed').is.true;
      // The beat plays on (a slow renderer): longer than the whole window counted from the change.
      clock.advance(9000);
      await microtasks();
      expect(allianceImpulseState.pending.has(R), 'not shown yet: the chamber is not at rest').is.true;
      // The beat ends: the seals stand still — the impulse leaves the partner's seal.
      sittingMotion.beat = '';
      clock.advance(200);
      await microtasks();
      expect(allianceImpulseState.pending.has(R), 'played at the chamber\'s rest — seen once').is.false;
    } finally {
      wrapper.unmount();
    }
  });
});

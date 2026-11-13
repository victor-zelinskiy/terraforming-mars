/*
 * ConsoleParliamentParties — the PARTIES tier of the chamber: six tiles, each ONE DOM instance (the ruler's teleported
 * into the government's slot), with the viewer's access state as SHOWN (the sitting's holds applied), the cursor, and
 * the one-shot pulses of an access gained / lost and of a party action used. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): it emits and exposes nothing — its contract is what it renders and hands its plaques
 * for its props, the flow's cursor and the sitting's display holds.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {PartyAccessModel} from '@/common/models/ParliamentModel';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {
  emptyParliamentView, ParliamentPartyVm, ParliamentViewVm, PartyActionStateKind, PartyActionStateVm, partyStateOf, PartyStateVm,
} from '@/client/console/parliament/consoleParliamentModel';
import {parliamentFlow, resetParliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds, resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {resetAllianceImpulse} from '@/client/console/parliament/allianceImpulse';
import ConsoleParliamentParties from '@/client/components/console/parliament/ConsoleParliamentParties.vue';

// The teleport and the plaque are their own specs' subjects; this one reads what the tier HANDS them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const TeleportStub = defineComponent({
  name: 'ConsoleTeleport',
  props: {to: {type: String, required: true}, disabled: {type: Boolean, default: false}, defer: {type: Boolean, default: false}},
  setup: (_props, {slots}) => () => h('div', {class: 'teleport-stub'}, slots.default?.()),
});
const PlaqueStub = defineComponent({
  name: 'ConsolePartyPlaque',
  props: {
    party: {type: String as PropType<ReduxParty>, required: true},
    bannerCubes: Array,
    bannerGhost: String,
    size: String,
    state: {type: Object as PropType<PartyStateVm>, required: true},
    actionState: {type: Object as PropType<PartyActionStateVm>, required: true},
    support: Number,
    viewerColor: String,
    formula: {type: Boolean, default: true},
    focused: Boolean,
    ruling: Boolean,
    rulesByCard: {type: Boolean, default: true},
    roll: String,
    pick: Object,
    supportOutgoing: Number,
    supportCounted: Number,
    reason: String,
  },
  render: () => h('i', {class: 'plaque-stub'}),
});

const RED: Color = 'red';

function access(party: ReduxParty, over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return {party, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false, ...over};
}

/** The viewer holds `party` by two delegates of their own. */
function held(party: ReduxParty): PartyAccessModel {
  return access(party, {delegates: 2, byDelegates: true, hasEffect: true});
}

function partyVm(party: ReduxParty, ruler: ReduxParty, holds: ReadonlyArray<PartyAccessModel>, support: number): ParliamentPartyVm {
  const mine = holds.find((a) => a.party === party) ?? access(party);
  return {
    party, effect: undefined, rule: 'r', support, inArea: false, ruling: party === ruler,
    access: {...mine, ruling: party === ruler}, actionId: undefined, action: undefined, bannerCubes: [],
  };
}

function view(ruler: ReduxParty, holds: ReadonlyArray<PartyAccessModel> = [], support: Partial<Record<ReduxParty, number>> = {}): ParliamentViewVm {
  return {
    ...emptyParliamentView(),
    rulingParty: ruler,
    parties: REDUX_PARTIES.map((p) => partyVm(p, ruler, holds, support[p] ?? 0)),
    viewer: {
      color: RED, name: 'me', participates: true, lobby: true, reserve: 5, onResolutions: 0, chairman: false, agenda: 0, influence: 0,
      access: holds, partyActionUses: {}, resolutionActionUses: 0,
    } as ParliamentViewVm['viewer'],
  };
}

function actionStates(used: ReadonlyArray<ReduxParty> = []): Array<PartyActionStateVm> {
  return REDUX_PARTIES.map((p) => {
    const kind: PartyActionStateKind = used.includes(p) ? 'used' : 'none';
    return {kind, label: '', reason: undefined, usesLeft: 0, usesPerGeneration: 0};
  });
}

/** The props the section hands the tier for a view (the states are the model's own reading of each party). */
function tierProps(v: ParliamentViewVm, used: ReadonlyArray<ReduxParty> = []): Record<string, unknown> {
  return {view: v, partyStates: v.parties.map((p) => partyStateOf(p, v.enacted === undefined)), partyActionStates: actionStates(used), viewerColor: RED};
}

function tier(v: ParliamentViewVm, over: Record<string, unknown> = {}) {
  return mount(ConsoleParliamentParties as any, {
    ...globalConfig,
    props: {...tierProps(v), ...over},
    global: {...globalConfig.global, stubs: {ConsoleTeleport: TeleportStub, ConsolePartyPlaque: PlaqueStub}},
  });
}

describe('ConsoleParliamentParties — the parties tier', () => {
  beforeEach(() => {
    resetParliamentFlow();
    resetParliamentHolds();
    resetAllianceImpulse();
  });
  afterEach(() => {
    resetParliamentFlow();
    resetParliamentHolds();
    resetAllianceImpulse();
  });

  it('six tiles, each ONE instance behind a teleport to the ruler\'s slot — enabled for the ruling party alone — and a medallion that reads its state', () => {
    expect(REDUX_PARTIES.length, 'the six parties of Redux (anti-vacuous)').to.eq(6);
    const v = view(PartyName.GREENS, [], {[PartyName.REDS]: 2});
    const w = tier(v);
    expect(w.classes()).to.deep.eq(['con-parl__parties']);
    expect(w.attributes('data-parl-parties')).to.not.eq(undefined);

    const teleports = w.findAllComponents(TeleportStub);
    expect(teleports.map((t) => t.props('to'))).to.deep.eq(REDUX_PARTIES.map(() => '[data-parl-ruler-slot]'));
    expect(teleports.every((t) => t.props('defer') === true)).to.eq(true);
    expect(teleports.map((t) => t.props('disabled')), 'only the ruler\'s tile leaves the row').to.deep.eq(REDUX_PARTIES.map((p) => p !== PartyName.GREENS));

    const tiles = w.findAll('.con-parl__party');
    expect(tiles.map((t) => t.attributes('data-party'))).to.deep.eq([...REDUX_PARTIES]);
    const states = v.parties.map((p) => partyStateOf(p, true));
    expect(tiles.map((t) => t.attributes('data-party-state'))).to.deep.eq(states.map((s) => s.kind));
    expect(tiles.every((t, i) => t.classes().includes('con-parl__party--' + states[i].kind))).to.eq(true);
    expect(tiles.map((t) => t.attributes('data-action-state'))).to.deep.eq(REDUX_PARTIES.map(() => 'none'));
    expect(tiles.map((t) => t.attributes('data-parl-ruler-tile')), 'the ruler\'s tile says so').to.deep.eq(REDUX_PARTIES.map((p) => (p === PartyName.GREENS ? '' : undefined)));
    expect(tiles.filter((t) => t.classes().includes('con-parl__party--ruler')).map((t) => t.attributes('data-party'))).to.deep.eq([PartyName.GREENS]);
    expect(w.find('.con-parl__party--focus').exists(), 'the cursor stands on the table at rest').to.eq(false);

    const plaques = w.findAllComponents(PlaqueStub);
    expect(plaques.map((p) => p.props('party'))).to.deep.eq([...REDUX_PARTIES]);
    expect(plaques.map((p) => p.props('size'))).to.deep.eq(REDUX_PARTIES.map((p) => (p === PartyName.GREENS ? 'ruler' : 'row')));
    expect(plaques.map((p) => p.props('ruling'))).to.deep.eq(REDUX_PARTIES.map((p) => p === PartyName.GREENS));
    expect(plaques.map((p) => p.props('state'))).to.deep.eq(states);
    expect(plaques.map((p) => p.props('support'))).to.deep.eq(REDUX_PARTIES.map((p) => (p === PartyName.REDS ? 2 : 0)));
    expect(plaques.every((p) => p.props('formula') === false), 'the overview prints no formula').to.eq(true);
    expect(plaques.every((p) => p.props('rulesByCard') === false), 'generation 1: the Greens rule by the starting rule').to.eq(true);
    expect(plaques.every((p) => p.props('viewerColor') === RED && p.props('reason') === '' && p.props('roll') === '')).to.eq(true);
    expect(plaques.every((p) => p.props('pick') === undefined && p.props('supportOutgoing') === 0 && p.props('supportCounted') === 0)).to.eq(true);
  });

  it('the cursor is the flow\'s — a row in the parties zone, the ruler\'s tile in its own, nothing past the browse layer — and the roll call\'s mark and a cube in the air are the sitting\'s', async () => {
    const w = tier(view(PartyName.GREENS, [], {[PartyName.REDS]: 2}));
    const focused = () => w.findAll('.con-parl__party--focus').map((t) => t.attributes('data-party'));
    const plaque = (party: ReduxParty) => w.findAllComponents(PlaqueStub)[REDUX_PARTIES.indexOf(party)];

    parliamentFlow.zone = 'parties';
    parliamentFlow.partyIndex = 2;
    await nextTick();
    expect(focused()).to.deep.eq([REDUX_PARTIES[2]]);
    expect(w.findAllComponents(PlaqueStub).map((p) => p.props('focused'))).to.deep.eq(REDUX_PARTIES.map((_, i) => i === 2));
    parliamentFlow.zone = 'ruler';
    await nextTick();
    expect(focused()).to.deep.eq([PartyName.GREENS]);
    parliamentFlow.stage = 'vote';
    await nextTick();
    expect(focused()).to.deep.eq([]);

    // The support scene names the parties: each medallion wears its mark; a cube still in the air is not on the plaque yet.
    parliamentHolds.rollStatus.set(PartyName.REDS, 'lost');
    parliamentHolds.supportIncoming.set(PartyName.REDS, 1);
    await nextTick();
    expect(plaque(PartyName.REDS).props('roll')).to.eq('lost');
    expect(plaque(PartyName.GREENS).props('roll')).to.eq('');
    expect(plaque(PartyName.REDS).props('support'), '2 on the model, 1 not landed').to.eq(1);
    // The delegate mode's cursor on a support area: that plaque takes the cursor and outlines the ONE figure the press takes.
    parliamentFlow.stage = 'delegate';
    await w.setProps({delegateArea: PartyName.REDS});
    expect(focused()).to.deep.eq([PartyName.REDS]);
    expect(w.findAllComponents(PlaqueStub).map((p) => p.props('supportOutgoing'))).to.deep.eq(REDUX_PARTIES.map((p) => (p === PartyName.REDS ? 1 : 0)));
  });

  it('the one-shots: an access gained pulses its tile (the access standing at mount too — its watcher hears the first write), a lost one is marked, a used action pulses — each cleared by its OWN animation\'s end', async () => {
    const w = tier(view(PartyName.GREENS, [held(PartyName.SCIENTISTS)]));
    const pulsing = () => w.findAll('.con-parl__party--pulse').map((t) => t.attributes('data-party'));
    const lost = () => w.findAll('.con-parl__party--lost').map((t) => t.attributes('data-party'));
    const tileOf = (party: ReduxParty) => w.find(`.con-parl__party[data-party="${party}"]`);
    const settle = async () => {
      await nextTick();
      await nextTick();
    };

    // The order of creation the Options component had: the watchers first, THEN the seed of the shown key — so the
    // seed is a change the watcher of `accessKeyShown` hears on the next tick (never in the first render).
    expect(pulsing(), 'nothing in the first render').to.deep.eq([]);
    await settle();
    expect(pulsing()).to.deep.eq([PartyName.SCIENTISTS]);
    expect(w.find('.con-parl__party--held').attributes('data-party')).to.eq(PartyName.SCIENTISTS);

    // Another animation's end is not this flag's; its own clears it — on its own tile only.
    await tileOf(PartyName.SCIENTISTS).trigger('animationend', {animationName: 'con-parl-access-lost'});
    expect(pulsing()).to.deep.eq([PartyName.SCIENTISTS]);
    await tileOf(PartyName.REDS).trigger('animationend', {animationName: 'con-parl-access-gain'});
    expect(pulsing()).to.deep.eq([PartyName.SCIENTISTS]);
    await tileOf(PartyName.SCIENTISTS).trigger('animationend', {animationName: 'con-parl-access-gain'});
    expect(pulsing()).to.deep.eq([]);

    // One access gained, one lost.
    await w.setProps(tierProps(view(PartyName.GREENS, [held(PartyName.REDS)])));
    await settle();
    expect(pulsing()).to.deep.eq([PartyName.REDS]);
    expect(lost()).to.deep.eq([PartyName.SCIENTISTS]);
    await tileOf(PartyName.SCIENTISTS).trigger('animationend', {animationName: 'con-parl-access-lost'});
    await tileOf(PartyName.REDS).trigger('animationend', {animationName: 'con-parl-access-gain'});
    expect([pulsing(), lost()]).to.deep.eq([[], []]);

    // A party action used this generation.
    await w.setProps(tierProps(view(PartyName.GREENS, [held(PartyName.REDS)]), [PartyName.UNITY]));
    await settle();
    expect(pulsing()).to.deep.eq([PartyName.UNITY]);
    expect(tileOf(PartyName.UNITY).attributes('data-action-state')).to.eq('used');

    // The access scene's seal LANDED: the party it brought answers then (the flow's beat, not the key's change).
    await tileOf(PartyName.UNITY).trigger('animationend', {animationName: 'con-parl-access-gain'});
    parliamentFlow.accessParty = PartyName.INDUSTRIALISTS;
    parliamentFlow.accessBeat = 'landed';
    await settle();
    expect(pulsing()).to.deep.eq([PartyName.INDUSTRIALISTS]);
  });

  it('DURING THE SITTING the tiles stand by the PREVIOUS ruler until the plaques have changed places — and the access pulses wait for that moment', async () => {
    // The response already carries Mars First ruling by an enacted card, and with it the viewer's access to Mars First.
    parliamentHolds.rulerBefore = PartyName.GREENS;
    parliamentHolds.rulerBeforeByCard = false;
    const live: ParliamentViewVm = {...view(PartyName.MARS, [access(PartyName.MARS, {ruling: true, hasEffect: true})]), enacted: {instance: 'law#1', resolutionId: 'RDX_SPEC_LAW', resolution: undefined, party: PartyName.MARS}};
    const w = tier(view(PartyName.GREENS));
    await w.setProps(tierProps(live));
    await nextTick();
    await nextTick();

    const rulerTiles = () => w.findAll('[data-parl-ruler-tile]').map((t) => t.attributes('data-party'));
    const stateOf = (party: ReduxParty): PartyStateVm => w.findAllComponents(PlaqueStub)[REDUX_PARTIES.indexOf(party)].props('state');
    const plaque = (party: ReduxParty) => w.findAllComponents(PlaqueStub)[REDUX_PARTIES.indexOf(party)];
    const pulsing = () => w.findAll('.con-parl__party--pulse').map((t) => t.attributes('data-party'));

    expect(rulerTiles(), 'the old ruler still stands on the dais').to.deep.eq([PartyName.GREENS]);
    expect(stateOf(PartyName.GREENS).kind, 'it rules by the starting rule, as it did').to.eq('ruling-default');
    expect(stateOf(PartyName.MARS).kind, 'the party whose card is being enacted is still a party in the vote').to.eq('in-area');
    expect(w.find('.con-parl__party[data-party="Mars First"]').attributes('data-party-state')).to.eq('in-area');
    expect(plaque(PartyName.GREENS).props('ruling')).to.eq(true);
    expect(plaque(PartyName.GREENS).props('rulesByCard'), 'the OLD government had no card').to.eq(false);
    expect(plaque(PartyName.MARS).props('ruling')).to.eq(false);
    expect(pulsing(), 'the gain belongs to the moment the medallions change places').to.deep.eq([]);

    // The swap is in the air: the tile already stands on the dais, and wears the ruler's state only once it has ARRIVED.
    parliamentHolds.rulerSettling = PartyName.GREENS;
    parliamentHolds.rulerBefore = undefined;
    await nextTick();
    await nextTick();
    expect(rulerTiles()).to.deep.eq([PartyName.MARS]);
    expect(plaque(PartyName.MARS).props('size')).to.eq('ruler');
    expect(plaque(PartyName.MARS).props('ruling'), 'a plaque in the air shows the state of the place it left').to.eq(false);
    expect(pulsing()).to.deep.eq([]);

    parliamentHolds.rulerSettling = undefined;
    parliamentHolds.rulerBeforeByCard = undefined;
    await nextTick();
    await nextTick();
    expect(stateOf(PartyName.MARS).kind).to.eq('ruling');
    expect(plaque(PartyName.MARS).props('ruling')).to.eq(true);
    expect(plaque(PartyName.MARS).props('rulesByCard')).to.eq(true);
    expect(pulsing(), 'now the new ruler\'s access is the viewer\'s — said once').to.deep.eq([PartyName.MARS]);
  });
});

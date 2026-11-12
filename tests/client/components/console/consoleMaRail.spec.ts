import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConsoleMaRail from '@/client/components/console/ConsoleMaRail.vue';
import {buildMaRail, maRailChipKey, MaRailInput, MaRailView} from '@/client/components/console/consoleMaRail';
import {ConsoleMaItem} from '@/client/components/console/consoleMaModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import type {Color} from '@/common/Color';

/**
 * THE MA STATUS RAIL — the workspace's ONE projected-transaction line.
 *
 * What this pins: the projection lives in the rail and nowhere else (the
 * header carries only a price), a BLOCKED item never renders a success
 * preview, money is the one blocker the shared chip states natively
 * («have / need»), and the slot economics ride the same `current → resulting`
 * grammar instead of a bespoke «останется свободных слотов».
 */
describe('consoleMaRail', () => {
  const me: Color = 'red';
  const rival: Color = 'blue';

  const item = (over: Partial<ConsoleMaItem> = {}): ConsoleMaItem => ({
    key: 'Banker',
    name: 'Banker',
    kind: 'award',
    description: '',
    scores: [],
    myColor: me,
    myScore: 0,
    myReady: false,
    myLead: false,
    leaderScore: 0,
    secondRanked: false,
    raceTone: 'empty',
    available: true,
    blocker: '',
    slotsExhausted: false,
    ...over,
  });

  const input = (over: Partial<MaRailInput> = {}): MaRailInput => ({
    item: item(),
    kind: 'awards',
    cost: 8,
    free: false,
    myMegacredits: 462,
    takenCount: 0,
    maxSlots: 3,
    ...over,
  });

  it('an available item projects the WHOLE transaction: M€ then the slot counter', () => {
    const rail = buildMaRail(input());
    expect(rail.tone).to.eq('projected');
    expect(rail.message).to.eq('');
    expect(rail.chips.length).to.eq(2);
    expect(rail.chips[0]).to.deep.include({direction: 'cost', icon: 'megacredits', amount: 8, current: 462, resulting: 454});
    expect(rail.chips[1]).to.deep.include({direction: 'gain', amount: 1, current: 0, resulting: 1, note: 'Funded'});
  });

  it('a milestone names its own counter', () => {
    const rail = buildMaRail(input({kind: 'milestones', item: item({kind: 'milestone', myReady: true})}));
    expect(rail.chips[1].note).to.eq('Claimed');
  });

  it('the slot counter never projects past the last slot', () => {
    const rail = buildMaRail(input({takenCount: 3, maxSlots: 3}));
    expect(rail.chips[1]).to.deep.include({current: 3, resulting: 3});
  });

  it('a FREE action has no money chip at all — «−0» is not a transaction', () => {
    const rail = buildMaRail(input({free: true, cost: 0}));
    expect(rail.tone).to.eq('projected');
    expect(rail.chips.length).to.eq(1);
    expect(rail.chips[0].note).to.eq('Funded');
    expect(rail.message).to.eq('Free sponsorship');
  });

  it('MONEY is the one blocker the shared chip states itself (have / need)', () => {
    const rail = buildMaRail(input({
      myMegacredits: 6,
      item: item({available: false, blocker: 'Not enough M€'}),
    }));
    expect(rail.tone).to.eq('blocked');
    expect(rail.chips.length).to.eq(1);
    // `current < amount` is what ActionEffectChip renders as «6 / 8».
    expect(rail.chips[0]).to.deep.include({direction: 'cost', current: 6, amount: 8});
    expect(rail.chips[0].resulting).to.eq(undefined); // never an impossible balance
    expect(rail.message).to.eq('');
  });

  it('a blocked item NEVER renders the success preview', () => {
    const rail = buildMaRail(input({
      item: item({available: false, blocker: 'All slots are taken'}),
    }));
    expect(rail.tone).to.eq('blocked');
    expect(rail.chips.length).to.eq(0);
    expect(rail.message).to.eq('All slots are taken');
  });

  it('a milestone short of its threshold states the GAP (its blocker is silent by design)', () => {
    const rail = buildMaRail(input({
      kind: 'milestones',
      item: item({kind: 'milestone', available: false, blocker: '', threshold: 8, myScore: 3}),
    }));
    expect(rail.tone).to.eq('blocked');
    expect(rail.chips.length).to.eq(0);
    expect(rail.message).to.eq('To the threshold: ${0}');
    expect(rail.messageParams).to.deep.eq(['5']);
  });

  it('a taken item projects nothing and REPEATS nothing (the row and the badge already name the owner — FB)', () => {
    const rail = buildMaRail(input({
      item: item({available: false, takenBy: {color: rival, name: 'Бот'}}),
    }));
    expect(rail).to.deep.eq({tone: 'owner', chips: [], message: ''});
  });

  it('an own claimed milestone reads the same way (the race is over either way)', () => {
    const rail = buildMaRail(input({
      kind: 'milestones',
      item: item({kind: 'milestone', available: false, takenBy: {color: me, name: 'Вы'}}),
    }));
    expect(rail.tone).to.eq('owner');
    expect(rail.message).to.eq('');
  });

  it('a bill the server will ask (Helion — PL-1622): the payment step named, never an M€-only projection', () => {
    const rail = buildMaRail(input({myMegacredits: 5, cost: 8, billAsks: true}));
    expect(rail).to.deep.eq({tone: 'projected', chips: [rail.chips[0]], message: 'Choose how to pay next'});
    expect(rail.chips.some((c) => c.icon === 'megacredits'), 'no M€ chip').to.eq(false);
  });

  it('NEVER the generic «Сейчас недоступно» (FB): a condition milestone not met names the condition', () => {
    const rail = buildMaRail(input({
      kind: 'milestones',
      item: item({kind: 'milestone', available: false, threshold: undefined, myReady: false, blocker: ''}),
    }));
    expect(rail).to.deep.include({tone: 'blocked', message: 'Condition not met'});
    expect(JSON.stringify(rail)).not.to.include('Unavailable right now');
  });

  it('no focused item → an empty, silent rail (the line still reserves its height)', () => {
    expect(buildMaRail(input({item: undefined}))).to.deep.eq({tone: 'none', chips: [], message: ''});
  });

  it('the chip key is stable per statement — the crossfade replaces, never re-flows', () => {
    const a = buildMaRail(input());
    const b = buildMaRail(input({myMegacredits: 200, takenCount: 1}));
    expect(a.chips.map(maRailChipKey)).to.deep.eq(b.chips.map(maRailChipKey));
  });
});

/**
 * THE RAIL'S RENDERER (`ConsoleMaRail.vue`) — it derives nothing: the tone is a class, the chips go to the SHARED
 * `ActionEffectChip` (stubbed here — it has its own specs), the one sentence is translated with its params.
 */
describe('ConsoleMaRail (the component)', () => {
  const ChipStub = defineComponent({
    name: 'ActionEffectChip',
    props: {effect: {type: Object, required: true}},
    render: () => h('i', {class: 'chip-stub'}),
  });
  const MONEY: ActionEffect = {direction: 'cost', icon: 'megacredits', amount: 8, current: 462, resulting: 454};
  const SLOT: ActionEffect = {direction: 'gain', icon: 'award', amount: 1, current: 0, resulting: 1, note: 'Funded'};

  function mountRail(props: {view: MaRailView, name?: string}) {
    return mount(ConsoleMaRail, {
      global: {...globalConfig.global, stubs: {ActionEffectChip: ChipStub}},
      props,
    });
  }

  it('a projected transaction: the tone on the root, the anchored name, every chip handed to the shared chip in order', () => {
    const rail = mountRail({view: {tone: 'projected', chips: [MONEY, SLOT], message: ''}, name: 'Banker'});
    expect(rail.classes()).to.include.members(['con-marail', 'con-marail--projected']);
    expect(rail.attributes('aria-live')).to.eq('polite');
    expect(rail.find('.con-marail__name').text()).to.eq('Banker');
    expect(rail.find('.con-marail__divider').exists()).to.eq(true);
    expect(rail.find('.con-marail__chips').exists()).to.eq(true);
    expect(rail.findAllComponents(ChipStub).map((chip) => chip.props('effect'))).to.deep.eq([MONEY, SLOT]);
    expect(rail.find('.con-marail__state').exists(), 'no sentence beside a projection').to.eq(false);
  });

  it('a blocked item with no name: no anchor, no chips — the one sentence with its params filled in', () => {
    const rail = mountRail({view: {tone: 'blocked', chips: [], message: 'To the threshold: ${0}', messageParams: ['5']}});
    expect(rail.classes()).to.include('con-marail--blocked');
    expect(rail.find('.con-marail__name').exists()).to.eq(false);
    expect(rail.find('.con-marail__divider').exists()).to.eq(false);
    expect(rail.find('.con-marail__chips').exists()).to.eq(false);
    expect(rail.find('.con-marail__state').text()).to.eq('To the threshold: 5');
  });

  it('a plain sentence is translated as it is; an empty view keeps the line and says nothing', async () => {
    const rail = mountRail({view: {tone: 'blocked', chips: [], message: 'All slots are taken'}});
    expect(rail.find('.con-marail__state').text()).to.eq('All slots are taken');
    await rail.setProps({view: {tone: 'none', chips: [], message: ''}});
    expect(rail.classes()).to.include.members(['con-marail', 'con-marail--none']);
    expect(rail.find('.con-marail__state').exists()).to.eq(false);
    expect(rail.findAllComponents(ChipStub).length).to.eq(0);
  });
});

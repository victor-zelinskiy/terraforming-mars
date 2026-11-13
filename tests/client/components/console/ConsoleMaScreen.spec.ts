import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleMaScreen from '@/client/components/console/ConsoleMaScreen.vue';
import {ConsoleMaItem, ConsoleMaKind} from '@/client/components/console/consoleMaModel';
import {maFocusState, openMaFocus, resetMaFocus} from '@/client/console/consoleMaFocus';
import {createManualClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {motionMs} from '@/client/components/motion/motionTokens';
import type {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';

/*
 * TWO WORKSPACES, ONE FAMILY (ledger FB′ — the owner, 2026-11-03: the one-screen split divided the player's attention
 * and scrolled with Venus's sixth item; two columns of three tiles read more premium and carry a bigger medallion).
 * Each kind is its own screen: a 2 × 3 grid of tiles (five and six both stand whole, an odd fifth never spans), the
 * head-tally in the workspace header, and every tile — the medallion · the name and its rule beside YOUR plate · the
 * table's FIELD at the foot.
 */
const me: Color = 'red';
const blue: Color = 'blue';
const green: Color = 'green';

function item(kind: 'milestone' | 'award', name: string, over: Partial<ConsoleMaItem> = {}): ConsoleMaItem {
  return {
    key: name, name, kind, description: 'Rule', scores: [{color: me, score: 1}, {color: blue, score: 3}], myColor: me, myScore: 1,
    myReady: false, myLead: false, leaderScore: 3, secondRanked: false, raceTone: kind === 'award' ? 'behind' : 'empty',
    threshold: kind === 'milestone' ? 4 : undefined, available: false, blocker: '', slotsExhausted: false,
    cost: kind === 'milestone' ? 8 : 14, ...over,
  };
}

const MILESTONES = ['Terraformer', 'Mayor', 'Gardener', 'Builder', 'Planner'].map((n) => item('milestone', n));
const AWARDS = ['Landlord', 'Banker', 'Scientist', 'Thermalist', 'Miner', 'Venuphile'].map((n) => item('award', n));

function mountScreen(kind: ConsoleMaKind, index: number, items: ReadonlyArray<ConsoleMaItem> = kind === 'milestones' ? MILESTONES : AWARDS) {
  return mount(ConsoleMaScreen, {
    ...globalConfig,
    props: {kind, items, index, myMegacredits: 30},
  });
}

describe('ConsoleMaScreen — two workspaces, one family (FB′)', () => {
  it('ONE kind a screen: two columns of three tiles (`--ma-rows` = half the list, rounded up)', () => {
    const w = mountScreen('milestones', 0);
    expect(w.findAll('.con-ma__card')).has.length(5);
    expect(w.find('.con-ma__scroll-host').attributes('style')).contains('--ma-rows: 3');
    expect(w.findAll('.con-ma__card').map((c) => c.attributes('data-ma-row'))).deep.eq(['Terraformer', 'Mayor', 'Gardener', 'Builder', 'Planner']);
  });

  it('Venus\'s sixth item fills the empty cell — still three rows, never a scroll target', () => {
    const w = mountScreen('awards', 0);
    expect(w.findAll('.con-ma__card')).has.length(6);
    expect(w.find('.con-ma__scroll-host').attributes('style')).contains('--ma-rows: 3');
  });

  it('the head-tally lives in the workspace header: the price of THIS kind\'s next slot', () => {
    expect(mountScreen('milestones', 0).find('.con-ma__wshead [data-ma-tally] [data-ma-price="milestones"]').text()).contains('8');
    expect(mountScreen('awards', 0).find('.con-ma__wshead [data-ma-tally] [data-ma-price="awards"]').text()).contains('14');
  });

  // PC01 · GO — the price NAMES ITS CAUSE: a waived next price is the table's price struck, 0 and the source's seal;
  // a paid one stays the number it always was; Vitor's free sponsorship keeps its word.
  it('a WAIVED price: the struck table price, the seal of the card, and the reading kind on the chip', () => {
    const items = AWARDS.map((it) => ({...it, cost: 0}));
    const w = mount(ConsoleMaScreen, {
      ...globalConfig,
      props: {kind: 'awards', items, index: 0, myMegacredits: 2,
        priceWaiver: {printed: 14, waivedBy: CardName.NIRGAL_ENTERPRISES}},
    });
    const chip = w.find('[data-ma-price="awards"]');
    expect(chip.attributes('data-ma-price-kind')).eq('waived');
    expect(chip.find('[data-ma-price-printed]').attributes('data-ma-price-printed')).eq('14');
    expect(chip.find('[data-ma-price-source]').attributes('data-ma-price-source')).eq(CardName.NIRGAL_ENTERPRISES);
    expect(chip.find('.con-maprice__printed').text()).eq('14');
    expect(chip.find('[data-req-mark="card"]').exists(), 'the seal of a standing card effect').is.true;
    expect(chip.find('.con-ma__price-free').exists(), 'never the bare «Бесплатно»').is.false;
  });

  it('a PAID price and the FREE sponsorship of Vitor keep their readings', () => {
    expect(mountScreen('awards', 0).find('[data-ma-price="awards"]').attributes('data-ma-price-kind')).eq('paid');
    const free = mount(ConsoleMaScreen, {
      ...globalConfig,
      props: {kind: 'awards', items: AWARDS.map((it) => ({...it, cost: 0})), index: 0, myMegacredits: 2, free: true,
        priceWaiver: {printed: 8, waivedBy: CardName.NIRGAL_ENTERPRISES}},
    });
    const chip = free.find('[data-ma-price="awards"]');
    expect(chip.attributes('data-ma-price-kind')).eq('free');
    expect(chip.find('.con-ma__price-free').exists()).is.true;
  });

  it('the cursor stands on ONE row, and a click picks it by index', () => {
    const w = mountScreen('awards', 2);
    const focused = w.findAll('.con-ma__card--focused');
    expect(focused).has.length(1);
    expect(focused[0].attributes('data-ma-row')).eq('Scientist');
    void w.findAll('.con-ma__card')[3].trigger('click');
    expect(w.emitted('pick')?.[0]).deep.eq([3]);
  });

  it('a milestone\'s field shows the RIVALS (you are the plate); an award\'s field every seat, the leader crowned', () => {
    const ms = mountScreen('milestones', 0).findAll('.con-ma__card')[0];
    expect(ms.findAll('[data-ma-lane]').map((l) => l.attributes('data-ma-lane'))).deep.eq([blue]);
    expect(ms.find('.con-ma__metric').exists()).eq(true);
    const aw = mountScreen('awards', 0).findAll('.con-ma__card')[0];
    expect(aw.findAll('[data-ma-lane]').map((l) => l.attributes('data-ma-lane'))).deep.eq([blue, me]);
    expect(aw.find('[data-ma-lane="blue"] .con-ma__crown').exists()).eq(true);
    expect(aw.find('[data-ma-lane="red"]').classes()).contains('con-ma__lane--me');
    expect(aw.find('.con-ma__race--behind').text()).contains('2');
  });

  it('a claimed milestone draws NO field (the race is over) and its OWNER is the plate — never repeated on the name line', () => {
    const items = [item('milestone', 'Mayor', {takenBy: {color: green, name: 'Gale'}}), ...MILESTONES.slice(1)];
    const row = mountScreen('milestones', 0, items).findAll('.con-ma__card')[0];
    expect(row.find('[data-ma-field]').exists()).eq(false);
    expect(row.find('.con-ma__nameline .con-ma__owner').exists()).eq(false);
    expect(row.find('[data-ma-seal]').text()).contains('Gale');
  });

  it('a tile reads: the name and its rule beside YOUR plate on top, the table\'s field at the foot', () => {
    const tile = mountScreen('awards', 0).findAll('.con-ma__card')[0];
    const main = tile.find('.con-ma__main');
    expect(main.element.children[0].classList.contains('con-ma__top')).eq(true);
    expect(main.element.children[1].hasAttribute('data-ma-field')).eq(true);
    expect([...main.find('.con-ma__top').element.children].map((c) => c.className)).deep.eq(['con-ma__body', 'con-ma__status']);
  });
});

/*
 * «WHAT CAN I TAKE RIGHT NOW?» answered at a glance (players spent seconds hunting for it): the claimable milestone
 * stands on its own SHELF (a geometry the cursor's ring cannot paint over — the cursor seeds onto that very tile), its
 * plate is FILLED with the «МОЖНО ВЗЯТЬ» stamp, the header counts the offers, the rest step back, and the opening plays
 * ONE roll call over the offered tiles in order. Material, never light — the glow guard holds the stylesheet.
 */
describe('ConsoleMaScreen — the claimable milestone reads at a glance', () => {
  const OFFERED = MILESTONES.map((it) => it.name === 'Mayor' || it.name === 'Planner' ?
    {...it, myReady: true, myScore: 4, available: true} : it);

  it('an offered tile wears the shelf and the stamp; a met-but-not-offered one wears neither', () => {
    const items = OFFERED.map((it) => it.name === 'Builder' ? {...it, myReady: true, myScore: 4} : it);
    const w = mountScreen('milestones', 0, items);
    const tile = (name: string) => w.find(`[data-ma-row="${name}"]`);
    expect(tile('Mayor').find('[data-ma-claimbar]').exists()).is.true;
    expect(tile('Mayor').find('.con-ma__metric--now .con-ma__avail').exists()).is.true;
    expect(tile('Builder').find('[data-ma-claimbar]').exists(), '«yours, waiting» is not an offer').is.false;
    expect(tile('Builder').find('.con-ma__metric--ready').exists()).is.true;
    expect(tile('Terraformer').find('[data-ma-claimbar]').exists()).is.false;
  });

  it('the header counts the offers; with none it renders nothing (no «0» placeholder)', () => {
    const w = mountScreen('milestones', 0, OFFERED);
    expect(w.find('.con-ma__wshead [data-ma-tally] [data-ma-offer]').text()).contains('2');
    expect(w.find('.con-ma').classes()).contains('con-ma--offer');
    const none = mountScreen('milestones', 0);
    expect(none.find('[data-ma-offer]').exists()).is.false;
    expect(none.find('.con-ma').classes()).not.contains('con-ma--offer');
  });

  it('an AWARD is never an offered tile (P29 — its accent is the header tray\'s next slot)', () => {
    const w = mountScreen('awards', 0, AWARDS.map((it) => ({...it, available: true})));
    expect(w.find('[data-ma-claimbar]').exists()).is.false;
    expect(w.find('[data-ma-offer]').exists()).is.false;
  });

  it('the opening ROLL CALL plays over the offered tiles in reading order, and only when something is offered', async () => {
    const w = mountScreen('milestones', 0, OFFERED);
    await w.vm.$nextTick();
    expect(w.find('.con-ma').classes()).contains('con-ma--rollcall');
    expect(w.find('[data-ma-row="Mayor"]').attributes('style')).contains('--ma-roll-i: 0');
    expect(w.find('[data-ma-row="Planner"]').attributes('style')).contains('--ma-roll-i: 1');
    expect(w.find('[data-ma-row="Terraformer"]').attributes('style') ?? '').not.contains('--ma-roll-i');
    const none = mountScreen('milestones', 0);
    await none.vm.$nextTick();
    expect(none.find('.con-ma').classes()).not.contains('con-ma--rollcall');
  });
});

/*
 * The screen is a `<script setup>` component (step A of docs/claude/vapor/RECIPES.md), so a parent's ref sees ONLY
 * what it exposes. The shell's MA controller reaches it through the surface registry and reads exactly one member —
 * `enterFocus()` (A on the overview: the descend into the item under the cursor). Mounted here the way the shell
 * holds it, under a host with a ref; then what the script does through its OWN template refs: the root (a
 * restore-mount parks the browse layer from it), the scroll area (a cursor step, a family switch).
 */
describe('ConsoleMaScreen — what the shell reads through its ref, and the screen\'s own refs', () => {
  // The focus stage is a MODULE (the descend outlives a park by design): every test leaves it closed, no draft kept.
  afterEach(() => resetMaFocus());

  function mountUnderHost(kind: ConsoleMaKind, index: number) {
    const items = kind === 'milestones' ? MILESTONES : AWARDS;
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleMaScreen, {ref: 'maScreen', kind, items, index, myMegacredits: 30})]),
    });
    const wrapper = mount(Host, {...globalConfig});
    return {
      wrapper,
      /** Exactly the controller's read: the surface standing under its ref. */
      reach: () => (wrapper.vm.$refs.maScreen ?? undefined) as {enterFocus(): void} | undefined,
    };
  }

  it('a PARENT\'s ref sees exactly `enterFocus` — nothing else of the script', () => {
    const {reach} = mountUnderHost('awards', 2);
    const screen = reach();
    expect(screen, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(screen!), 'the exposed list is the contract').to.deep.eq(['enterFocus']);
    for (const inner of ['startRollcall', 'onCardClick', 'revealNames', 'rollcall', 'flow', 'props']) {
      expect((screen as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }
  });

  it('`enterFocus()` descends into the item under the cursor: the stage opens on it and the browse layer is parked, never unmounted', async () => {
    const {wrapper, reach} = mountUnderHost('awards', 2);
    expect(maFocusState.open).to.eq(false);

    reach()!.enterFocus();
    await nextTick();

    expect({open: maFocusState.open, kind: maFocusState.kind, name: maFocusState.name, phase: maFocusState.phase})
      .to.deep.eq({open: true, kind: 'award', name: 'Scientist', phase: 'detail'});
    expect(wrapper.find('.con-ma').classes()).to.contain('con-ma--focus');
    expect(wrapper.find('.con-ma__browse').classes()).to.contain('con-ma__browse--parked');
    expect(wrapper.findAll('.con-ma__card'), 'the list keeps its nodes (selection and scroll survive the descent)').to.have.length(6);

    // A second press while the stage stands is nobody's: the open stage is left exactly as it stood.
    const openedAt = maFocusState.openedAt;
    reach()!.enterFocus();
    expect({name: maFocusState.name, openedAt: maFocusState.openedAt}).to.deep.eq({name: 'Scientist', openedAt});

    // Leaving under a live PRE-COMMIT detail keeps it as the suspended draft (the restore door re-seats it).
    wrapper.unmount();
    expect(maFocusState.open).to.eq(false);
    expect(maFocusState.draft).to.deep.eq({kind: 'award', name: 'Scientist'});
  });

  it('a RESTORE-mount (the stage already open) parks the browse layer at once, from the screen\'s own root — and plays no roll call', async () => {
    openMaFocus('milestone', 'Mayor');
    const w = mountScreen('milestones', 1, MILESTONES.map((it) => it.name === 'Planner' ? {...it, myReady: true, myScore: 4, available: true} : it));
    await nextTick();
    const browse = w.find('.con-ma__browse').element as HTMLElement;
    expect(browse.style.visibility, 'parked with no episode: the stage plays no enter hook on a restore').to.eq('hidden');
    expect(browse.style.opacity).to.eq('0');
    expect(w.find('.con-ma').classes()).to.contain('con-ma--focus');
    expect(w.find('.con-ma').classes(), 'an offer is standing, the opening phrase is not replayed under the stage').to.not.contain('con-ma--rollcall');
  });

  it('a cursor step hands the tile now under the cursor to the scroll area; LB/RB sends the list to its top and plays the ARRIVE beat once', async () => {
    const calls = {ensured: [] as Array<Element | null | undefined>, toStart: 0};
    // The scroll area is a primitive with a spec of its own; the stand-in renders the slot and exposes the two functions
    // the screen reads through its `ref="grid"`. (A render function: the runtime compiler is not in this build.)
    const ScrollAreaStub = defineComponent({
      name: 'ConsoleScrollArea',
      props: {contentClass: {type: String, default: ''}},
      setup(props, {slots, expose}) {
        expose({
          ensureVisible: (el: Element | null | undefined) => {
            calls.ensured.push(el);
          },
          scrollToStart: () => {
            calls.toStart++;
          },
        });
        return () => h('div', {class: 'scroll-stub'}, [h('div', {class: props.contentClass}, slots.default?.())]);
      },
    });
    const clock = createManualClock(0);
    setFlowClock(clock);
    try {
      const w = mount(ConsoleMaScreen, {
        ...globalConfig,
        props: {kind: 'milestones' as ConsoleMaKind, items: MILESTONES as ReadonlyArray<ConsoleMaItem>, index: 0, myMegacredits: 30},
        global: {...globalConfig.global, stubs: {ConsoleScrollArea: ScrollAreaStub}},
      });
      expect(calls.ensured, 'standing still asks for nothing').to.deep.eq([]);

      await w.setProps({index: 2});
      await flushPromises();
      expect(calls.ensured.length).to.eq(1);
      expect(calls.ensured[0], 'the tile that carries the cursor after the re-render').to.eq(w.find('[data-ma-row="Gardener"]').element);
      expect(calls.toStart, 'a step never resets the list').to.eq(0);

      await w.setProps({kind: 'awards', items: AWARDS, index: 0});
      await flushPromises();
      expect(calls.toStart, 'the other family\'s list starts at its top').to.eq(1);
      expect(w.find('.con-ma__browse').classes(), 'RB: the awards come in from the right').to.contain('con-ma__browse--arrive-r');
      clock.advance(motionMs(260));
      await nextTick();
      expect(w.find('.con-ma__browse').classes(), 'one beat, then the list stands').to.not.contain('con-ma__browse--arrive-r');

      await w.setProps({kind: 'milestones', items: MILESTONES, index: 0});
      expect(w.find('.con-ma__browse').classes(), 'LB: the milestones come in from the left').to.contain('con-ma__browse--arrive-l');
    } finally {
      setFlowClock(undefined);
    }
  });
});

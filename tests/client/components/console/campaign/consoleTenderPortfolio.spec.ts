/*
 * ConsoleTenderPortfolio — THE TENDER DOOR's LIST: the holder's certificates, each in its state on this page, and the
 * reading of the focused one. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders
 * for its props (the host owns the order, the focus and every verb), and what it EXPOSES — its two hosts (the start
 * scene, the carryover picker) stand it under `ref="portfolio"` and read exactly one member off it, `slotEl(instance)`:
 * the certificate's own slot, the origin the fullscreen viewer lifts it out of. It emits nothing.
 *
 * The certificate is stubbed (its own spec's subject) — this spec reads what the list HANDS it.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, reactive} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {readingText} from '@/client/console/readingText';
import {TenderPlace, TenderPortfolioEntry} from '@/client/console/campaign/tenderPortfolio';
import ConsoleTenderPortfolio from '@/client/components/console/campaign/ConsoleTenderPortfolio.vue';

/** What a host reads through its ref — exactly the parents' own cast. */
type PortfolioReach = {slotEl?: (instance: string) => HTMLElement | undefined};

// (A render function, not a template string: the runtime compiler is not in this build.)
const TenderCardStub = defineComponent({
  name: 'ConsoleTenderCard',
  props: {
    id: {type: String, required: true},
    size: {type: String, default: undefined},
    state: {type: String, default: undefined},
    focused: Boolean,
    dim: Boolean,
  },
  render() {
    return h('i', {'class': 'tender-card-stub'});
  },
});

const STUBS = {ConsoleTenderCard: TenderCardStub};

const READY: TenderPortfolioEntry = {
  instance: 't0-0', id: 'researchSubsidy', status: 'held', window: 'start', page: 'projects', state: 'ready',
  reading: {key: 'Price of a starting-hand card: ${0} → ${1} M€', params: ['3', '2']},
};
const ELSEWHERE: TenderPortfolioEntry = {
  instance: 't0-1', id: 'openCall', status: 'held', window: 'start', page: 'prelude', state: 'elsewhere',
  note: 'Executes on the prelude step',
  reading: {key: 'Preludes in the deal: ${0} → ${1}', params: ['4', '6']},
};
const EXECUTED: TenderPortfolioEntry = {
  instance: 't1-0', id: 'restructuring', status: 'executed', window: 'start', page: 'any', state: 'executed',
  reading: {key: 'Executed', params: []},
};
const ENTRIES: ReadonlyArray<TenderPortfolioEntry> = [READY, ELSEWHERE, EXECUTED];

type PortfolioProps = {
  entries: ReadonlyArray<TenderPortfolioEntry>,
  focus: number,
  place: TenderPlace,
  busy?: string,
  heldNames?: ReadonlyArray<string>,
  live?: boolean,
  embedded?: boolean,
};

function portfolio(props: PortfolioProps) {
  return mount(ConsoleTenderPortfolio, {global: {...globalConfig.global, stubs: STUBS}, props});
}

describe('ConsoleTenderPortfolio — the tender door\'s list', () => {
  it('the row: a slot per certificate in the HOST\'s order — its state, the host\'s focus, the wire, a seat held for a flight — and the face handed its own', () => {
    const w = portfolio({entries: ENTRIES, focus: 1, place: 'start', busy: 't0-0', heldNames: ['t1-0'], live: true});
    expect(w.classes()).to.deep.eq(['con-tport', 'con-tport--live']);
    expect(w.attributes('data-tender-portfolio-place')).to.eq('start');
    expect(w.attributes('data-tender-portfolio-count')).to.eq('3');
    expect(w.attributes('data-tender-portfolio-ready'), 'the ones that execute HERE').to.eq('1');

    const slots = w.findAll('[data-tport-row] > .con-tport__slot');
    expect(slots.map((s) => s.attributes('data-tport-slot'))).to.deep.eq(['t0-0', 't0-1', 't1-0']);
    expect(slots.map((s) => s.attributes('data-tport-kind'))).to.deep.eq(['researchSubsidy', 'openCall', 'restructuring']);
    expect(slots.map((s) => s.attributes('data-tport-state'))).to.deep.eq(['ready', 'elsewhere', 'executed']);
    expect(slots.map((s) => s.classes().filter((c) => c !== 'con-tport__slot'))).to.deep.eq([
      ['con-tport__slot--ready', 'con-tport__slot--busy'],
      ['con-tport__slot--focused', 'con-tport__slot--elsewhere'],
      ['con-tport__slot--executed', 'con-tport__slot--aloft'],
    ]);
    expect(slots.map((s) => s.attributes('data-tport-focused'))).to.deep.eq([undefined, 'yes', undefined]);
    expect(slots.map((s) => s.attributes('data-zoom-slot')), 'the viewer\'s origin is the focused slot alone').to.deep.eq([undefined, 't0-1', undefined]);

    const cards = w.findAllComponents(TenderCardStub);
    expect(cards.map((c) => c.props('id'))).to.deep.eq(['researchSubsidy', 'openCall', 'restructuring']);
    expect(cards.map((c) => c.props('size'))).to.deep.eq(['table', 'table', 'table']);
    expect(cards.map((c) => c.props('state')), 'the face wears the holding\'s status').to.deep.eq(['held', 'held', 'executed']);
    expect(cards.map((c) => c.props('focused'))).to.deep.eq([false, true, false]);
    expect(cards.map((c) => c.props('dim')), 'a certificate that does not go here steps back').to.deep.eq([false, true, true]);

    const embedded = portfolio({entries: [], focus: -1, place: 'threshold', embedded: true});
    expect(embedded.classes()).to.deep.eq(['con-tport', 'con-tport--embedded']);
    expect(embedded.attributes('data-tender-portfolio-place')).to.eq('threshold');
    expect(embedded.findAll('.con-tport__slot').length).to.eq(0);
  });

  it('the words: «executes here» or WHY not under each certificate, and the focused one\'s reading in live numbers — with the wire\'s word or its reason', async () => {
    const w = portfolio({entries: ENTRIES, focus: 0, place: 'start'});
    const slots = w.findAll('.con-tport__slot');
    expect(slots.map((s) => s.find('[data-tport-here]').exists())).to.deep.eq([true, false, false]);
    expect(slots[0].find('[data-tport-here]').text()).to.eq('Executes here');
    expect(slots.map((s) => s.find('[data-tport-reason]').exists()), 'a done certificate has nothing to explain').to.deep.eq([false, true, false]);
    expect(slots[1].find('[data-tport-reason]').text()).to.eq('Executes on the prelude step');

    const reading = () => w.find('[data-tport-reading]');
    expect(reading().attributes('data-tport-reading-state')).to.eq('ready');
    expect(reading().find('.con-tport__reading-text').text()).to.eq(readingText({label: READY.reading.key, params: [...READY.reading.params]}));
    expect(reading().find('.con-tport__reading-text').text(), 'the numbers are in the line — never a raw template').to.not.contain('${');
    expect(reading().find('.con-tport__reading-busy').exists()).to.eq(false);
    expect(reading().find('.con-tport__reading-note').exists(), 'a ready certificate names no reason').to.eq(false);

    await w.setProps({busy: 't0-0'});
    expect(reading().find('.con-tport__reading-busy').text()).to.eq('Executing…');

    await w.setProps({focus: 1, busy: undefined});
    expect(reading().attributes('data-tport-reading-state')).to.eq('elsewhere');
    expect(reading().find('.con-tport__reading-text').text()).to.eq(readingText({label: ELSEWHERE.reading.key, params: [...ELSEWHERE.reading.params]}));
    expect(reading().find('.con-tport__reading-note').text()).to.eq('Executes on the prelude step');

    await w.setProps({focus: -1});
    expect(reading().attributes('data-tport-reading-state'), 'no cursor — an empty line, its box kept').to.eq(undefined);
    expect((reading().element as Element).children.length).to.eq(0);
  });

  it('a PARENT\'s ref sees exactly `slotEl` — and it answers with the certificate\'s own slot, following the list', async () => {
    const props = reactive<{entries: ReadonlyArray<TenderPortfolioEntry>}>({entries: ENTRIES});
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleTenderPortfolio, {ref: 'portfolio', entries: props.entries, focus: 0, place: 'start'})]),
    });
    const host = mount(Host, {global: {...globalConfig.global, stubs: STUBS}});
    /** Exactly the parents' read: `(this.$refs.portfolio ?? undefined) as … | undefined`. */
    const reach = () => (host.vm.$refs.portfolio ?? undefined) as PortfolioReach | undefined;

    const list = reach();
    expect(list, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(list ?? {}), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['slotEl']);
    for (const inner of ['setSlotRef', 'slotEls', 'stamping', 'readingOf', 'props']) {
      expect((list as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }

    expect(list?.slotEl?.('t0-1'), 'the slot — the node itself').to.eq(host.find('[data-tport-slot="t0-1"]').element);
    expect(list?.slotEl?.('t1-0')).to.eq(host.find('[data-tport-slot="t1-0"]').element);
    expect(list?.slotEl?.('t9-9'), 'a certificate that is not in the list has no slot').to.eq(undefined);

    props.entries = [READY, EXECUTED];
    await nextTick();
    expect(reach()?.slotEl?.('t0-1'), 'a certificate that left the list leaves no slot behind').to.eq(undefined);
    expect(reach()?.slotEl?.('t1-0')).to.eq(host.find('[data-tport-slot="t1-0"]').element);
  });
});

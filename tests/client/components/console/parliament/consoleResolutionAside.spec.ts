/*
 * ConsoleResolutionAside — THE PARTY COLUMN of the resolution inspector: the party's plaque (the `aside` size, the
 * host's ONE context line) over the mechanics' sentences in the shared rules panel. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md): the shell's viewer controller reaches it through the surface registry
 * (`zoomAsidePanel`) for `scrollBody` alone — so that is ALL a parent's ref of it carries (§ R11).
 *
 * (Render functions, not template strings: the runtime compiler is not in this build.)
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {PartyName} from '@/common/turmoil/PartyName';
import {resolutionPartyAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import ConsoleResolutionAside from '@/client/components/console/parliament/ConsoleResolutionAside.vue';

// The plaque and the rules panel are their own specs' subjects; this one reads what the column HANDS them.
const PlaqueStub = defineComponent({
  name: 'ConsolePartyPlaque',
  props: ['party', 'size', 'actionState', 'note', 'formula'],
  render: () => h('i', {class: 'plaque-stub'}),
});

/** The rules panel, reduced to what the column CALLS on it — every call is recorded, the answer is the spec's. */
const scrolled: Array<number> = [];
let scrollAnswer = true;
const RulesStub = defineComponent({
  name: 'ConsoleCardRulesPanel',
  props: {embedded: Boolean, keepOrder: Boolean, tier: String, annotationsOverride: Array, nonce: Number, closing: Boolean},
  methods: {
    scrollBody(dy: number): boolean {
      scrolled.push(dy);
      return scrollAnswer;
    },
  },
  render: () => h('i', {class: 'rules-stub'}),
});
/** A rules panel with nothing to scroll by (no such member at all). */
const MuteRulesStub = defineComponent({name: 'ConsoleCardRulesPanel', render: () => h('i', {class: 'rules-stub'})});

const stubs = {ConsolePartyPlaque: PlaqueStub, ConsoleCardRulesPanel: RulesStub};

function aside(props: Record<string, unknown> = {}) {
  return mount(ConsoleResolutionAside, {
    ...globalConfig,
    props: {party: PartyName.GREENS, ...props},
    global: {...globalConfig.global, stubs},
  });
}

type AsideReach = {scrollBody?: (dy: number) => boolean};

/** The column under a PARENT that holds a ref to it — what that ref carries is what the shell's registry hands the controller. */
function underParent(rules: typeof RulesStub | typeof MuteRulesStub) {
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleResolutionAside, {ref: 'aside', party: PartyName.GREENS})]),
  });
  const host = mount(Host, {global: {...globalConfig.global, stubs: {ConsolePartyPlaque: PlaqueStub, ConsoleCardRulesPanel: rules}}});
  return {host, reach: () => (host.vm.$refs.aside ?? undefined) as AsideReach | undefined};
}

describe('ConsoleResolutionAside — the party column of the resolution inspector', () => {
  beforeEach(() => {
    scrolled.length = 0;
    scrollAnswer = true;
  });

  it('the column of ITS party: the titled box, the plaque at the `aside` size with the host\'s context line, no badge without a table', () => {
    const w = aside({contextKey: 'Its party is not in the vote'});
    // The template STARTS WITH ITS ROOT (its opening comment lives in the script now).
    expect((w.element as Element).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['con-zoom-rules-host', 'con-rinspect-aside']);
    expect(w.classes()).to.not.include('con-zoom-rules-host--closing');
    const box = w.find('aside.con-rinspect-aside__box');
    expect(box.attributes('data-party')).to.eq(PartyName.GREENS);
    expect(box.attributes('aria-label')).to.eq($t('Party of the resolution'));
    expect(w.find('.con-zoom-rules__title').text()).to.eq($t('Party of the resolution'));

    const plaque = w.findComponent(PlaqueStub);
    expect(plaque.classes()).to.include('con-rinspect-aside__plaque');
    expect(plaque.attributes('data-zoom-flank-content')).to.not.eq(undefined);
    expect(plaque.props('party')).to.eq(PartyName.GREENS);
    expect(plaque.props('size')).to.eq('aside');
    expect(plaque.props('formula')).to.eq(true);
    expect(plaque.props('note'), 'the key, translated (English is the key)').to.eq($t('Its party is not in the vote'));
    expect(plaque.props('actionState'), 'no table, no viewer — no action badge').to.eq(undefined);
  });

  it('hands the rules panel the party\'s sentences in their order, the scene\'s tier and the viewer\'s signals — and follows the props', async () => {
    const w = aside({tier: 'dense', nonce: 3});
    const rules = w.findComponent(RulesStub);
    expect(rules.classes()).to.include('con-rinspect-aside__rules');
    expect(rules.props('embedded')).to.eq(true);
    expect(rules.props('keepOrder')).to.eq(true);
    expect(rules.props('tier')).to.eq('dense');
    expect(rules.props('nonce')).to.eq(3);
    expect(rules.props('closing')).to.eq(false);
    expect(rules.props('annotationsOverride')).to.deep.eq(resolutionPartyAnnotations(PartyName.GREENS));
    expect(w.findComponent(PlaqueStub).props('note'), 'no context key — no line').to.eq(undefined);

    await w.setProps({party: PartyName.REDS, closing: true, nonce: 4});
    expect(w.classes(), 'the close flight began — the column hides at once').to.include('con-zoom-rules-host--closing');
    expect(w.find('aside').attributes('data-party')).to.eq(PartyName.REDS);
    expect(w.findComponent(PlaqueStub).props('party')).to.eq(PartyName.REDS);
    expect(rules.props('closing')).to.eq(true);
    expect(rules.props('nonce')).to.eq(4);
    expect(rules.props('annotationsOverride')).to.deep.eq(resolutionPartyAnnotations(PartyName.REDS));
  });

  it('a PARENT\'s ref sees exactly `scrollBody` — it pages the rules panel and returns the panel\'s own answer', () => {
    const {host, reach} = underParent(RulesStub);
    const column = reach();
    expect(column, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(column ?? {}), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['scrollBody']);
    for (const inner of ['rules', 'annotations', 'contextText', 'actionState', 'props']) {
      expect((column as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }

    expect(column?.scrollBody?.(48), 'the panel scrolled').to.eq(true);
    scrollAnswer = false;
    expect(column?.scrollBody?.(-48), 'the panel had nowhere to go').to.eq(false);
    expect(scrolled).to.deep.eq([48, -48]);
    host.unmount();
  });

  it('`scrollBody` answers false when the rules panel has nothing to scroll by', () => {
    const {host, reach} = underParent(MuteRulesStub);
    expect(reach()?.scrollBody?.(48)).to.eq(false);
    expect(scrolled).to.deep.eq([]);
    host.unmount();
  });
});

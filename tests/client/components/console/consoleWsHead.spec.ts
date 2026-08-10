import {mount} from '@vue/test-utils';
import {h} from 'vue';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';

// The emblem is a sprite component; this spec is about the LINE.
// (Render functions, not template strings: the runtime compiler is not in this
// build — a string slot fails with «prefixIdentifiers is not supported».)
const IconStub = {name: 'BarButtonIcon', props: ['name'], render: () => h('i', {class: 'icon-stub'})};

function head(props: Record<string, unknown>) {
  return mount(ConsoleWsHead as any, {
    ...globalConfig,
    props,
    slots: {default: () => h('span', {class: 'aux-stub'}, 'filters')},
    global: {...globalConfig.global, stubs: {BarButtonIcon: IconStub}},
  });
}

describe('ConsoleWsHead — the ONE workspace header', () => {
  it('is the ROOT alone at the browse layer — no tail, no stage', () => {
    const w = head({root: 'Cards in hand', emblem: 'cards'});
    expect(w.find('.con-wshead__root').text()).to.eq('Cards in hand');
    expect(w.find('.con-wshead__subject').exists()).to.eq(false);
    expect(w.find('.con-wshead__step').exists()).to.eq(false);
  });

  it('carries the workspace IDENTITY SYMBOL, and only when the host gives one', () => {
    expect(head({root: 'Cards in hand', emblem: 'cards'}).find('.con-wshead__emblem').exists()).to.eq(true);
    expect(head({root: 'Cards in hand'}).find('.con-wshead__emblem').exists()).to.eq(false);
  });

  /**
   * THE HEIGHT CONTRACT. The host's browse content stays in the FLOW in both
   * states (it alone sizes the zone) and the deep layer is an absolute overlay
   * — that is what lets a card name of any length grow the crumb without the
   * stage below re-assembling in a different geometry.
   */
  it('NEVER unmounts the browse layer — it crossfades, so the header height cannot move', () => {
    const w = head({root: 'Cards in hand', emblem: 'cards', subject: 'AI Central', stage: 'Playing'});
    const browse = w.find('.con-wshead__layer--browse');
    expect(browse.exists()).to.eq(true);
    expect(w.find('.aux-stub').exists()).to.eq(true);
    expect(browse.classes()).to.contain('con-wshead__layer--out');
    expect(w.find('.con-wshead__layer--deep').classes()).to.not.contain('con-wshead__layer--out');
  });

  it('GROWS a tail on descent: root › subject › stage, stable part first', () => {
    const w = head({root: 'Cards in hand', emblem: 'cards', subject: 'AI Central', stage: 'Playing'});
    expect(w.find('.con-wshead__root').text()).to.eq('Cards in hand');
    expect(w.find('.con-wshead__subject').text()).to.eq('AI Central');
    expect(w.find('.con-wshead__step').text()).to.eq('Playing');
  });

  it('renders a subject with NO stage — the crumb is honest before the step is published', () => {
    const w = head({root: 'Cards in hand', subject: 'AI Central'});
    expect(w.find('.con-wshead__subject').text()).to.eq('AI Central');
    expect(w.find('.con-wshead__step').exists()).to.eq(false);
  });

  it('dresses the stage as COMMITTED past the boundary (a statement, not an invitation)', async () => {
    const w = head({root: 'Cards in hand', subject: 'AI Central', stage: 'Playing'});
    expect(w.find('.con-wshead__step').classes()).to.not.contain('con-wshead__step--committed');
    await w.setProps({committed: true});
    expect(w.find('.con-wshead__step').classes()).to.contain('con-wshead__step--committed');
  });

  /**
   * Both words of a swap share ONE grid cell so nothing beside them shifts
   * mid-change — and the swap is a crossfade, never `mode="out-in"` (which
   * empties the slot between the words and blinks on the one line whose job is
   * to prove the flow never broke).
   */
  it('puts each animating segment in its own swap cell', () => {
    const w = head({root: 'Cards in hand', subject: 'AI Central', stage: 'Playing'});
    expect(w.findAll('.con-wshead__swap').length).to.eq(2);
  });

  it('accepts a FIXED extra root segment (a repeat source) without making it a stage', () => {
    const w = head({root: 'Repeat action', context: 'Mars Hydronetwork'});
    expect(w.find('.con-wshead__context').text()).to.eq('Mars Hydronetwork');
    expect(w.find('.con-wshead__step').exists()).to.eq(false);
  });

  it('renders a RAW subject verbatim (a proper noun already in the player language)', () => {
    const w = head({root: 'Cards in hand', subject: 'Зелёный сектор', subjectRaw: true});
    expect(w.find('.con-wshead__subject').text()).to.eq('Зелёный сектор');
  });

  /**
   * THE RESERVED RIGHT EDGE. The trailing slot must be a real, LAST element —
   * it used to be a bare `<slot>` under `display: contents`, which dissolved
   * the wrapper and left its children as direct flex participants at the
   * implicit `order: 0`, i.e. sorted BEFORE the identity (`order: 1`). The
   * colony fleet dock therefore rendered to the LEFT of «КОЛОНИИ» standalone
   * while sitting correctly on the right when the same section was embedded
   * or the header ran in flow mode. The geometry itself is a stylesheet fact
   * (guarded in e2e); what this pins is the STRUCTURE the stylesheet needs —
   * one named box, after the identity and the aux zone.
   */
  it('puts the trailing slot in its own box, LAST — the right edge is reserved', () => {
    const w = mount(ConsoleWsHead as any, {
      ...globalConfig,
      props: {root: 'Colonies', emblem: 'colonies'},
      slots: {
        default: () => h('span', {class: 'aux-stub'}, 'filters'),
        trailing: () => h('span', {class: 'fleets-stub'}, 'fleets'),
      },
      global: {...globalConfig.global, stubs: {BarButtonIcon: IconStub}},
    });
    const trailing = w.find('.con-wshead__trailing');
    expect(trailing.exists(), 'the trailing slot needs a real box to be positioned').to.eq(true);
    expect(trailing.find('.fleets-stub').exists()).to.eq(true);
    const children = Array.from(w.find('.con-wshead').element.children).map((n) => n.className);
    expect(children.indexOf('con-wshead__trailing')).to.eq(children.length - 1);
    expect(children.indexOf('con-wshead__trailing')).to.be.greaterThan(children.indexOf('con-wshead__ident'));
  });

  it('renders no trailing box when the host publishes nothing there', () => {
    expect(head({root: 'Colonies'}).find('.con-wshead__trailing').exists()).to.eq(false);
  });

  it('adds the root-connected second flow tier only for an opted-in workspace', () => {
    const plain = head({root: 'Cards in hand'});
    expect(plain.find('.con-wshead__flow').exists()).to.eq(false);
    expect(plain.find('.con-wshead').classes()).to.not.contain('con-wshead--flow');
    const w = mount(ConsoleWsHead as any, {
      ...globalConfig,
      props: {root: 'Start of the game'},
      slots: {
        default: () => h('span', {class: 'aux-stub'}, 'filters'),
        flow: () => h('span', {class: 'flow-stub'}, 'flow'),
      },
      global: {...globalConfig.global, stubs: {BarButtonIcon: IconStub}},
    });
    expect(w.find('.con-wshead').classes()).to.contain('con-wshead--flow');
    expect(w.find('.con-wshead__flow .flow-stub').text()).to.eq('flow');
    expect(w.find('.con-wshead__flow-connector').exists()).to.eq(true);
    for (const part of ['origin', 'stem', 'turn', 'run', 'handoff', 'signal']) {
      expect(w.find(`.con-wshead__flow-${part}`).exists(), `missing connector ${part}`).to.eq(true);
    }
  });
});

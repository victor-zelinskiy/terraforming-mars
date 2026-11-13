/*
 * JournalCardChip — the inline CARD token of the journal feed, the notifications, the bot's review and the endgame
 * lists. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): two props in (the card's name, the
 * log's `attrs`), nothing out, nothing exposed. What it renders for them — the chip of the card's type, with its tags
 * and its cost when the log asks for them, and beside it the ONE preview of its kind (a project card's, a standard
 * project's, the Hydronetwork's) — the hover (a wait of the flow kernel: the spec drives the kernel's clock) and the
 * click into the fullscreen viewer, which only a project card has. The previews and the viewer are stubbed by name:
 * the spec reads what the chip hands them.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';
import {CardName} from '@/common/cards/CardName';
import {LogMessageDataAttrs} from '@/common/logs/LogMessageData';
import {getCard} from '@/client/cards/ClientCardManifest';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

/** The chip's own numbers: the hover delay, and how long a hover stays blocked after the viewer closes. */
const HOVER_DELAY = 170;
const HOVER_BLOCK = 250;

// (Render functions, not template strings: the runtime compiler is not in this build.)
const anchorProp = {type: Object as PropType<DOMRect | undefined>, default: undefined};
const CardPopoverStub = defineComponent({
  name: 'CardPreviewPopover',
  props: {name: {type: String, default: ''}, visible: {type: Boolean, default: false}, anchor: anchorProp},
  render: () => h('i', {class: 'card-popover-stub'}),
});
const HydronetPopoverStub = defineComponent({
  name: 'HydronetPreviewPopover',
  props: {visible: {type: Boolean, default: false}, anchor: anchorProp},
  render: () => h('i', {class: 'hydronet-popover-stub'}),
});
const StandardPopoverStub = defineComponent({
  name: 'StandardProjectPreviewPopover',
  props: {name: {type: String, required: true}, visible: {type: Boolean, default: false}, anchor: anchorProp},
  render: () => h('i', {class: 'standard-popover-stub'}),
});

/** How many times the chip asked the viewer to show itself (the chip's one reach into its child). */
let shows = 0;
const ZoomStub = defineComponent({
  name: 'CardZoomModal',
  props: {card: {type: Object as PropType<{name: CardName}>, required: true}},
  emits: ['close'],
  methods: {
    show(): void {
      shows++;
    },
  },
  render: () => h('i', {class: 'zoom-stub'}),
});

// The teleport is stubbed so the viewer is read where it is rendered (its target is the document's body).
function chip(name: CardName, attrs?: LogMessageDataAttrs) {
  // No i18n plugin on purpose: the component imports its own `$t` and `v-i18n`. Leaning on the global registration
  // would be a Vue warning here — and the warn handler fails the spec.
  return mount(JournalCardChip, {
    props: {name, attrs},
    global: {
      config: globalConfig.global.config,
      stubs: {
        teleport: true,
        CardPreviewPopover: CardPopoverStub,
        HydronetPreviewPopover: HydronetPopoverStub,
        StandardProjectPreviewPopover: StandardPopoverStub,
        CardZoomModal: ZoomStub,
      },
    },
  });
}

/** The chip's box on screen, as it will measure it. */
function standAt(token: Element, left: number, top: number): void {
  const width = 90;
  const height = 22;
  (token as HTMLElement).getBoundingClientRect = () => ({x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({})});
}

describe('JournalCardChip — the journal\'s card token', () => {
  let clock: ManualFlowClock;

  beforeEach(() => {
    shows = 0;
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
  });

  it('a project card: a focusable button of its type, its name translated by its own v-i18n — tags and cost only when the log asks — and a closed card preview beside it', async () => {
    const w = chip(CardName.ANTS);
    const token = w.find('span.journal-chip');
    expect(token.classes()).to.deep.eq(['journal-chip', 'journal-chip--card', 'journal-chip--active', 'journal-chip--zoomable']);
    expect(token.attributes('tabindex')).to.eq('0');
    expect(token.attributes('role')).to.eq('button');
    expect(token.attributes('aria-label')).to.eq('Ants');
    const label = token.find('.journal-chip__label');
    expect(label.attributes('tm-has-i18n'), 'translated by the chip\'s own v-i18n').to.eq('true');
    expect(label.text()).to.eq('Ants');
    expect(token.find('.journal-chip__tags').exists(), 'the log did not ask for tags').to.eq(false);
    expect(token.find('.journal-chip__cost').exists(), 'the log did not ask for the cost').to.eq(false);

    // ONE preview — the project card's — and no viewer until the chip is pressed.
    expect(w.findComponent(CardPopoverStub).props()).to.deep.eq({name: CardName.ANTS, visible: false, anchor: undefined});
    expect(w.findComponent(HydronetPopoverStub).exists()).to.eq(false);
    expect(w.findComponent(StandardPopoverStub).exists()).to.eq(false);
    expect(w.find('teleport-stub').attributes('to')).to.eq('body');
    expect(w.findComponent(ZoomStub).exists()).to.eq(false);

    const ants = getCard(CardName.ANTS);
    expect(ants?.tags, 'the manifest\'s card has a tag to show').to.have.length.greaterThan(0);
    await w.setProps({attrs: {tags: true, cost: true}});
    expect(w.findAll('.journal-chip__tags > .journal-chip__tag').map((tag) => tag.classes()))
      .to.deep.eq((ants?.tags ?? []).map((tag) => ['journal-chip__tag', 'tag-' + tag]));
    expect(w.find('.journal-chip__tags').attributes('aria-hidden')).to.eq('true');
    expect(w.find('.journal-chip__cost > .journal-chip__cost-value').text()).to.eq(String(ants?.cost));
    expect(w.find('.journal-chip__cost > i').classes()).to.deep.eq(['resource_icon', 'resource_icon--megacredits']);

    // The chip follows its name: another card, another type.
    await w.setProps({name: CardName.ASTEROID, attrs: undefined});
    expect(w.find('span.journal-chip').classes()).to.deep.eq(['journal-chip', 'journal-chip--card', 'journal-chip--event', 'journal-chip--zoomable']);
    expect(w.find('.journal-chip__label').text()).to.eq('Asteroid');
    expect(w.find('.journal-chip__tags').exists()).to.eq(false);
    expect(w.findComponent(CardPopoverStub).props('name')).to.eq(CardName.ASTEROID);
  });

  it('a standard project and the Hydronetwork wear their own preview and never open the viewer', async () => {
    // A standard project: its name without the technical suffix, the compact effect preview, no fullscreen.
    const project = chip(CardName.POWER_PLANT_STANDARD_PROJECT, {cost: true, tags: true});
    const projectToken = project.find('span.journal-chip');
    expect(projectToken.classes()).to.deep.eq(['journal-chip', 'journal-chip--card', 'journal-chip--standard']);
    expect(projectToken.find('.journal-chip__label').text()).to.eq('Power Plant');
    expect(projectToken.attributes('aria-label')).to.eq('Power Plant');
    expect(projectToken.find('.journal-chip__tags').exists(), 'a standard project has no tags to show').to.eq(false);
    expect(projectToken.find('.journal-chip__cost-value').text()).to.eq(String(getCard(CardName.POWER_PLANT_STANDARD_PROJECT)?.cost));
    expect(project.findComponent(StandardPopoverStub).props()).to.deep.eq({name: CardName.POWER_PLANT_STANDARD_PROJECT, visible: false, anchor: undefined});
    expect(project.findComponent(CardPopoverStub).exists()).to.eq(false);
    expect(project.findComponent(HydronetPopoverStub).exists()).to.eq(false);
    await projectToken.trigger('click');
    await nextTick();
    expect(project.findComponent(ZoomStub).exists(), 'a standard project never zooms').to.eq(false);

    // The Delta Project is the «Hydronetwork» system: its technical card's name never reaches the screen.
    const hydro = chip(CardName.DELTA_PROJECT);
    const hydroToken = hydro.find('span.journal-chip');
    expect(hydroToken.classes()).to.include('journal-chip--system');
    expect(hydroToken.classes()).to.not.include('journal-chip--zoomable');
    expect(hydroToken.find('.journal-chip__label').text()).to.eq('Hydronetwork');
    expect(hydroToken.attributes('aria-label')).to.eq('Hydronetwork');
    expect(hydro.findComponent(HydronetPopoverStub).props()).to.deep.eq({visible: false, anchor: undefined});
    expect(hydro.findComponent(CardPopoverStub).exists()).to.eq(false);
    expect(hydro.findComponent(StandardPopoverStub).exists()).to.eq(false);
    await hydroToken.trigger('click');
    await nextTick();
    expect(hydro.findComponent(ZoomStub).exists(), 'the system chip never zooms').to.eq(false);
    expect(shows).to.eq(0);
  });

  it('a hover opens the preview after the chip\'s delay, anchored on the chip\'s own box; a leave closes it or takes the pending open back; focus and blur are the same edges', async () => {
    const w = chip(CardName.ANTS);
    const token = w.find('span.journal-chip');
    const preview = w.findComponent(CardPopoverStub);
    standAt(token.element, 600, 300);

    await token.trigger('mouseenter');
    const atEnter: DOMRect | undefined = preview.props('anchor');
    expect([atEnter?.left, atEnter?.top], 'the anchor is taken at once — the preview is placed before it shows').to.deep.eq([600, 300]);
    clock.advance(HOVER_DELAY - 1);
    await nextTick();
    expect(preview.props('visible'), 'the delay has not run out').to.eq(false);

    // The feed scrolled during the delay: the box is read again when the preview opens.
    standAt(token.element, 600, 240);
    clock.advance(1);
    await nextTick();
    expect(preview.props('visible')).to.eq(true);
    const atOpen: DOMRect | undefined = preview.props('anchor');
    expect([atOpen?.left, atOpen?.top, atOpen?.width, atOpen?.height]).to.deep.eq([600, 240, 90, 22]);

    await token.trigger('mouseleave');
    expect(preview.props('visible')).to.eq(false);

    await token.trigger('mouseenter');
    clock.advance(HOVER_DELAY - 10);
    await token.trigger('mouseleave');
    clock.advance(HOVER_DELAY);
    await nextTick();
    expect(preview.props('visible'), 'the open was taken back').to.eq(false);

    await token.trigger('focus');
    clock.advance(HOVER_DELAY);
    await nextTick();
    expect(preview.props('visible'), 'opened by focus').to.eq(true);
    await token.trigger('blur');
    expect(preview.props('visible'), 'closed by blur').to.eq(false);
  });

  it('a press opens the fullscreen viewer on the card and asks it to show; the preview stays down while it is open and for a beat after it closes', async () => {
    const w = chip(CardName.ANTS);
    const token = w.find('span.journal-chip');
    const preview = w.findComponent(CardPopoverStub);
    standAt(token.element, 600, 300);
    await token.trigger('mouseenter');
    clock.advance(HOVER_DELAY);
    await nextTick();
    expect(preview.props('visible')).to.eq(true);

    await token.trigger('click');
    await nextTick();
    expect(preview.props('visible'), 'the preview and the viewer never stack').to.eq(false);
    const viewer = w.findComponent(ZoomStub);
    expect(viewer.exists()).to.eq(true);
    expect(w.find('teleport-stub > .zoom-stub').exists(), 'bound for the body').to.eq(true);
    expect(viewer.props('card')).to.deep.eq({name: CardName.ANTS});
    expect(shows, 'the mounted viewer is asked to show itself — once').to.eq(1);

    // A hover while the viewer is open (the browser's phantom `mouseenter` included) opens nothing.
    await token.trigger('mouseenter');
    clock.advance(HOVER_DELAY);
    await nextTick();
    expect(preview.props('visible')).to.eq(false);

    viewer.vm.$emit('close');
    await nextTick();
    expect(w.findComponent(ZoomStub).exists(), 'the viewer closed').to.eq(false);

    // …nor does one in the beat after it closed; a real hover after that beat works again.
    clock.advance(HOVER_BLOCK - 1);
    await token.trigger('mouseenter');
    clock.advance(HOVER_DELAY);
    await nextTick();
    expect(preview.props('visible'), 'still blocked when the hover began').to.eq(false);
    await token.trigger('mouseleave');
    await token.trigger('mouseenter');
    clock.advance(HOVER_DELAY);
    await nextTick();
    expect(preview.props('visible'), 'the block lifted').to.eq(true);

    // The keyboard's Enter is the same press.
    await token.trigger('keydown', {key: 'Enter'});
    await nextTick();
    expect(w.findComponent(ZoomStub).exists()).to.eq(true);
    expect(shows).to.eq(2);
    expect(preview.props('visible')).to.eq(false);
  });
});

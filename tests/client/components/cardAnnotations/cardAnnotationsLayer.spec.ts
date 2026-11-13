/*
 * CardAnnotationsLayer — the fullscreen viewer's rule overlay: one floating block per rule group of the card on stage,
 * tethered to the face. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md); its content is the
 * annotation model's and its placement the layout solver's (both have specs of their own), so this one is about the
 * LAYER: it is silent until the host's settle nonce finds a laid-out stage inside the host <dialog> (reached through
 * the ref on its own root — R12), it renders the model's groups there and arms the right-stick traversal, and a card
 * that leaves the stage / a closing viewer takes every block and every mark on the face away. It exposes nothing:
 * the viewer drives it by its two props.
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {translateText} from '@/client/directives/i18n';
import {buildCardAnnotations} from '@/client/components/cardAnnotations/annotationModel';
import {solveAnnotationLayout} from '@/client/components/cardAnnotations/annotationLayout';
import {annotationTraversalState, clearAnnotationFocus, stepAnnotationFocus} from '@/client/components/cardAnnotations/annotationFocusBus';
import CardAnnotationsLayer from '@/client/components/cardAnnotations/CardAnnotationsLayer.vue';

// The parts of a premium face the layer tethers to when a row has no node of its own (its documented fallbacks).
const FACE = ['pcard-play-rail', 'pcard__reqs', 'pcard__tags', 'pcard__mech', 'pcard__vp'];
// A card standing in the middle of the jsdom window (1024 × 768): both gutters are wide enough for a readable block.
const CARD_RECT = {left: 300, right: 724, top: 60, bottom: 700, width: 424, height: 640, x: 300, y: 60, toJSON: () => ({})};
const MARKS = '.caanno-hot, .caanno-node, .caanno-target--focus';
// A reveal is measured and played across real ticks: on a loaded machine that is seconds, not mocha's 2 s of logic.
const REVEAL_BUDGET_MS = 15_000;

/** The layer where the viewer stands it: beside the stage, inside the viewer's <dialog>. */
function mountViewer(props: {cardName?: CardName, nonce: number, layer?: boolean}, laidOut = true) {
  const Viewer = defineComponent({
    props: {
      cardName: {type: String as () => CardName | undefined, default: undefined},
      nonce: {type: Number, required: true},
      layer: {type: Boolean, default: true},
    },
    render() {
      return h('dialog', [
        h('div', {class: 'card-zoom-stage'}, [h('div', {class: 'pcard'}, FACE.map((part) => h('div', {class: part})))]),
        this.layer ? h(CardAnnotationsLayer, {ref: 'layer', cardName: this.cardName, nonce: this.nonce}) : null,
      ]);
    },
  });
  const wrapper = mount(Viewer, {...globalConfig, props});
  if (laidOut) {
    // jsdom lays nothing out (every rect is 0 × 0, which the layer reads as «not on screen»): the stage gets a box.
    (wrapper.find('.pcard').element as HTMLElement).getBoundingClientRect = () => CARD_RECT as DOMRect;
  }
  return wrapper;
}

/** The reveal is measured across ticks (and, where the environment has frames, across frames): wait for its end. */
async function until(what: string, holds: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !holds(); i++) {
    await flushPromises();
    if (!holds()) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  expect(holds(), what).to.eq(true);
}

describe('CardAnnotationsLayer — the fullscreen card\'s rule overlay', () => {
  afterEach(() => {
    clearAnnotationFocus();
  });

  it('is an empty root until the card has landed, and stays one over a stage that is not laid out', async () => {
    const wrapper = mountViewer({cardName: CardName.HERBIVORES, nonce: 0}, false);
    const layer = wrapper.find('dialog > .card-annotations');

    expect(layer.exists(), 'the root is always rendered').to.eq(true);
    expect(layer.element.children.length).to.eq(0);
    expect(layer.classes()).to.deep.eq(['card-annotations']);

    await wrapper.setProps({nonce: 1});
    await flushPromises();

    expect(wrapper.findAll('.caanno').length, 'a 0 × 0 stage is no stage').to.eq(0);
    expect(wrapper.find('.card-annotations__lines').exists()).to.eq(false);
    expect(annotationTraversalState.active).to.eq(false);
    expect(wrapper.findAll(MARKS).length, 'nothing on the face was touched').to.eq(0);
  });

  it('the settle nonce over a laid-out stage reveals one block per rule group, at the solver\'s width, each tethered to the face', async () => {
    const annotations = buildCardAnnotations(getCardOrThrow(CardName.HERBIVORES));
    expect(annotations.length, 'the card has rules to explain').to.be.greaterThan(1);
    const wrapper = mountViewer({cardName: CardName.HERBIVORES, nonce: 0});

    await wrapper.setProps({nonce: 1});
    await until('the reveal armed the traversal', () => annotationTraversalState.active);

    const blocks = wrapper.findAll('.card-annotations > .caanno');
    expect(blocks.map((b) => b.find('.caanno__label').text())).to.deep.eq(annotations.map((a) => translateText(a.labelKey)));
    expect(blocks.map((b) => b.findAll('.caanno__row').length), 'a group of several rules lists them as rows').to.deep.eq(
      annotations.map((a) => (a.rows.length === 1 ? 0 : a.rows.length)));

    const probe = solveAnnotationLayout({
      items: annotations.map((a) => ({id: a.id, anchorY: 0, height: 40})),
      cardRect: CARD_RECT,
      viewport: {width: window.innerWidth, height: window.innerHeight},
      edgePad: 24,
    });
    expect(probe, 'the gutters take a block').to.not.eq(null);
    expect(blocks.map((b) => (b.element as HTMLElement).style.width)).to.deep.eq(annotations.map(() => `${probe?.width}px`));
    expect(blocks.every((b) => ['caanno--left', 'caanno--right'].some((side) => b.classes().includes(side)))).to.eq(true);

    expect(wrapper.find('.card-annotations').classes(), 'the measuring veil is lifted once the reveal starts').to.not.include('card-annotations--measuring');
    expect(wrapper.findAll('.card-annotations__lines > .cal-line').length, 'every group of this card has its element on the face').to.eq(annotations.length);
    expect(wrapper.findAll('.pcard > .caanno-hot').length, 'the tethered elements answer a hover').to.be.greaterThan(0);
    expect(wrapper.find('.pcard-play-rail').classes(), '«on play» tethers to the play rail').to.include('caanno-hot');
  }).timeout(REVEAL_BUDGET_MS);

  it('the right stick walks the blocks: one block, its tether and its element on the face carry the focus at a time', async () => {
    const wrapper = mountViewer({cardName: CardName.HERBIVORES, nonce: 0});
    await wrapper.setProps({nonce: 1});
    await until('the reveal armed the traversal', () => annotationTraversalState.active);
    const focused = () => wrapper.findAll('.caanno--focus').map((b) => b.find('.caanno__label').text());

    expect(stepAnnotationFocus(1), 'a live layer takes the flick').to.eq(true);
    await flushPromises();
    const first = focused();
    expect(first.length).to.eq(1);
    expect(wrapper.findAll('.cal-line--focus').length).to.eq(1);
    expect(wrapper.findAll('.pcard > .caanno-target--focus').length).to.eq(1);

    stepAnnotationFocus(1);
    await flushPromises();
    expect(focused().length).to.eq(1);
    expect(focused(), 'the focus moved on').to.not.deep.eq(first);
    expect(wrapper.findAll('.pcard > .caanno-target--focus').length, 'the block it left let go of its element').to.eq(1);

    clearAnnotationFocus();
    await flushPromises();
    expect(focused()).to.deep.eq([]);
    expect(wrapper.findAll('.caanno-target--focus').length).to.eq(0);
  }).timeout(REVEAL_BUDGET_MS);

  it('a card leaving the stage clears the layer at once; the next settle reveals the new card; a closing viewer dismisses it', async () => {
    const wrapper = mountViewer({cardName: CardName.HERBIVORES, nonce: 0});
    await wrapper.setProps({nonce: 1});
    await until('the reveal armed the traversal', () => annotationTraversalState.active);
    expect(wrapper.findAll('.caanno').length).to.be.greaterThan(0);

    await wrapper.setProps({cardName: CardName.ASTEROID});
    await flushPromises();
    expect(wrapper.findAll('.caanno').length, 'the old card\'s blocks never bleed into the slide').to.eq(0);
    expect(wrapper.find('.card-annotations__lines').exists()).to.eq(false);
    expect(annotationTraversalState.active).to.eq(false);
    expect(wrapper.findAll(MARKS).length, 'the face is left as it was found').to.eq(0);

    const next = buildCardAnnotations(getCardOrThrow(CardName.ASTEROID));
    await wrapper.setProps({nonce: 2});
    await until('the new card\'s reveal armed the traversal', () => annotationTraversalState.active);
    expect(wrapper.findAll('.caanno__label').map((l) => l.text())).to.deep.eq(next.map((a) => translateText(a.labelKey)));

    await wrapper.setProps({nonce: 0});
    await until('the dismissed blocks are gone', () => wrapper.findAll('.caanno').length === 0);
    expect(annotationTraversalState.active).to.eq(false);
    expect(wrapper.findAll(MARKS).length).to.eq(0);
  }).timeout(REVEAL_BUDGET_MS);

  it('a layer mounted over a card that already landed reveals it, and its unmount gives the face and the stick back', async () => {
    const wrapper = mountViewer({cardName: CardName.HERBIVORES, nonce: 3, layer: false});
    expect(wrapper.find('.card-annotations').exists()).to.eq(false);

    await wrapper.setProps({layer: true});
    await until('the reveal armed the traversal', () => annotationTraversalState.active);
    expect(wrapper.findAll('.caanno').length).to.be.greaterThan(0);
    const face = wrapper.find('.pcard').element;
    expect(face.querySelectorAll(MARKS).length).to.be.greaterThan(0);

    wrapper.unmount();

    expect(annotationTraversalState.active, 'the stick is nobody\'s').to.eq(false);
    expect(stepAnnotationFocus(1)).to.eq(false);
    expect(face.querySelectorAll(MARKS).length, 'no class of the layer outlives it').to.eq(0);
  }).timeout(REVEAL_BUDGET_MS);

  it('a parent\'s ref reaches nothing — the layer exposes no member', () => {
    const wrapper = mountViewer({cardName: CardName.HERBIVORES, nonce: 0});
    expect(wrapper.find('.card-annotations').exists()).to.eq(true);
    expect(Object.keys((wrapper.vm.$refs.layer ?? {}) as object), 'the viewer drives it by `cardName` and `nonce` alone').to.deep.eq([]);
  });
});

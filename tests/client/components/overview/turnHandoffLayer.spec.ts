/*
 * TurnHandoffLayer — the App-level driver of the turn hand-off. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): one prop (`playerView`), no emits, nothing exposed. It FEEDS the controller of
 * `turnHandoffState` from the view it is handed and DRAWS the two body-teleported surfaces a player card cannot
 * hold — the hand-off beam and the anchored idle hint — so the spec is what it tells the controller for its prop,
 * what it draws for the controller's state (measured off the real player cards), and what it takes down when it leaves.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import TurnHandoffLayer from '@/client/components/overview/TurnHandoffLayer.vue';
import {BEAM_MS, IDLE_HINT_MS, resetTurnHandoff, turnHandoffState} from '@/client/components/overview/turnHandoffState';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {reduceMotionOverrideState} from '@/client/utils/reducedMotion';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {PlayerViewModel} from '@/common/models/PlayerModel';

const RED: Color = 'red';
const BLUE: Color = 'blue';

/** The slice of a player view the layer reads: the phase, who is active, and the viewer's own colour (red). */
function view(active: Color, phase: Phase = Phase.ACTION): PlayerViewModel {
  return {
    game: {phase},
    players: [RED, BLUE].map((color) => ({color, isActive: color === active})),
    thisPlayer: {color: RED},
  } as unknown as PlayerViewModel;
}

/** A bounding rect in viewport coordinates — jsdom lays nothing out, so every measured element is lent one. */
function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({})};
}

// The teleport is stubbed so the two surfaces are read where they are rendered (their target is the document's body);
// the transition is test-utils' default stub.
function layerFor(playerView: PlayerViewModel) {
  return mount(TurnHandoffLayer, {
    props: {playerView},
    global: {config: globalConfig.global.config, stubs: {teleport: true}},
  });
}

describe('TurnHandoffLayer — the driver of the turn hand-off', () => {
  let clock: ManualFlowClock;
  let reduceMotionBefore: boolean;
  let cards: Array<HTMLElement>;

  /** A player card of the left panel, standing at `box`; `chip` is its status chip's box when it has one. */
  function standCard(color: Color, box: DOMRect, chip?: DOMRect): HTMLElement {
    const card = document.createElement('div');
    card.className = 'left-panel-card';
    card.setAttribute('data-player-color', color);
    card.getBoundingClientRect = () => box;
    if (chip !== undefined) {
      const chipEl = document.createElement('span');
      chipEl.className = 'player-status-chip';
      chipEl.getBoundingClientRect = () => chip;
      card.appendChild(chipEl);
    }
    document.body.appendChild(card);
    cards.push(card);
    return card;
  }

  beforeEach(() => {
    resetTurnHandoff();
    reduceMotionBefore = reduceMotionOverrideState.enabled;
    reduceMotionOverrideState.enabled = false;
    cards = [];
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  // Module state is BUNDLE-SHARED: the controller's store, the motion override, the kernel's clock and the cards
  // lent to the document are put back for every later spec.
  afterEach(() => {
    resetTurnHandoff();
    clock.advance(1000);
    setFlowClock(undefined);
    reduceMotionOverrideState.enabled = reduceMotionBefore;
    for (const card of cards) {
      card.remove();
    }
  });

  it('the first view SEEDS the controller with the owner and the viewer — silently: nothing is drawn', async () => {
    const layer = layerFor(view(BLUE));
    await nextTick();

    expect(turnHandoffState.seeded).to.eq(true);
    expect(turnHandoffState.currentOwner).to.eq(BLUE);
    expect(turnHandoffState.localColor).to.eq(RED);
    expect(turnHandoffState.burstColor).to.eq(undefined);
    expect(layer.find('.turn-handoff-beam').exists()).to.eq(false);
    expect(layer.find('.turn-idle-anchor-hint').exists()).to.eq(false);
  });

  it('a new view hands the turn over: the beam runs between the two cards\' centres and leaves with the controller\'s beam', async () => {
    standCard(BLUE, rect(10, 100, 200, 40));
    standCard(RED, rect(10, 200, 200, 40));
    const layer = layerFor(view(BLUE));

    await layer.setProps({playerView: view(RED)});
    await nextTick();

    expect(turnHandoffState.currentOwner).to.eq(RED);
    expect(turnHandoffState.previousOwner).to.eq(BLUE);
    const beam = layer.find('.turn-handoff-beam');
    expect(beam.exists()).to.eq(true);
    expect(beam.attributes('aria-hidden')).to.eq('true');
    expect(beam.find('.turn-handoff-beam__trace').exists()).to.eq(true);
    const style = (beam.element as HTMLElement).style;
    expect([style.top, style.left, style.height]).to.deep.eq(['120px', '13px', '100px']);

    clock.advance(BEAM_MS);
    await nextTick();
    expect(layer.find('.turn-handoff-beam').exists()).to.eq(false);
  });

  it('an untouched own turn raises the hint at the right of the viewer\'s card, level with its status chip; a resize re-anchors it after the debounce; any input takes it down', async () => {
    standCard(BLUE, rect(10, 100, 200, 40));
    const own = standCard(RED, rect(10, 200, 200, 40), rect(20, 150, 80, 20));
    const layer = layerFor(view(BLUE));
    await layer.setProps({playerView: view(RED)});
    expect(layer.find('.turn-idle-anchor-hint').exists()).to.eq(false);

    clock.advance(IDLE_HINT_MS);
    await nextTick();

    const hint = layer.find('.turn-idle-anchor-hint');
    expect(hint.exists()).to.eq(true);
    expect(hint.attributes('role')).to.eq('status');
    expect(hint.find('.turn-idle-anchor-hint__text').text()).to.eq('Choose an action');
    // 8 px to the right of the card (10 + 200), the 40 px pill centred on the chip's middle (150 + 20 / 2).
    const style = (hint.element as HTMLElement).style;
    expect([style.top, style.left]).to.deep.eq(['140px', '218px']);

    // The card moved (a resize): the hint follows once the 120 ms debounce — an owned wait of the layer — has run.
    own.getBoundingClientRect = () => rect(40, 300, 200, 40);
    window.dispatchEvent(new window.Event('resize'));
    await nextTick();
    expect(style.left).to.eq('218px');
    clock.advance(120);
    await nextTick();
    expect([style.top, style.left]).to.deep.eq(['140px', '248px']);

    // The layer installed the input tracking at its mount: the first key of the turn takes the hint down.
    window.dispatchEvent(new window.Event('keydown'));
    await nextTick();
    expect(turnHandoffState.idleHintActive).to.eq(false);
    expect(layer.find('.turn-idle-anchor-hint').exists()).to.eq(false);
  });

  it('the endgame silences the hand-off, and the layer leaving takes the state and the input tracking with it', async () => {
    const layer = layerFor(view(BLUE));
    await layer.setProps({playerView: view(RED, Phase.END)});
    expect(turnHandoffState.seeded).to.eq(false);
    expect(turnHandoffState.currentOwner).to.eq(undefined);

    await layer.setProps({playerView: view(BLUE)});
    expect(turnHandoffState.seeded).to.eq(true);
    layer.unmount();
    expect(turnHandoffState.seeded).to.eq(false);
    expect(turnHandoffState.currentOwner).to.eq(undefined);

    // A standing own turn with its hint up: with the layer gone no window listener is left to take it down.
    turnHandoffState.localColor = RED;
    turnHandoffState.currentOwner = RED;
    turnHandoffState.idleHintActive = true;
    window.dispatchEvent(new window.Event('keydown'));
    expect(turnHandoffState.idleHintActive).to.eq(true);
  });
});

/*
 * PlayerCubePlayground — the dev-only QA stand of the premium player cube and the delegate figure. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): what it renders for its one prop (`embedded`), what its toggles
 * hand to every piece, and the replay — a re-mount of every animated piece with the placement raised, lowered again
 * by an owned wait of the flow kernel (the spec drives the kernel's clock). It emits nothing and exposes nothing.
 *
 * The two pieces are stubbed by name: the spec asserts what the stand HANDS them, never how a cube is drawn.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';
import PlayerCubePlayground from '@/client/components/PlayerCubePlayground.vue';

/** A piece's stub — the cube and the figure take the same props from the stand, so both stubs are ONE shape. */
function pieceStub(name: string, mark: string) {
  return defineComponent({
    name,
    props: {
      color: {type: String, required: true},
      size: {type: Number, default: undefined},
      glow: {type: Boolean, default: true},
      shadow: {type: Boolean, default: true},
      animateIn: {type: Boolean, default: false},
      overlaySymbol: {type: Boolean, default: undefined},
      steel: {type: Boolean, default: false},
    },
    render() {
      return h('i', {'class': mark});
    },
  });
}

const CubeStub = pieceStub('PlayerCube', 'cube-stub');
const DelegateStub = pieceStub('PlayerDelegate', 'delegate-stub');

/** The colours of the cube's stands, in the component's order. */
const COLORS = ['red', 'green', 'yellow', 'blue', 'black', 'purple', 'orange', 'pink', 'bronze'];

function standOf(embedded = false) {
  return mount(PlayerCubePlayground, {
    global: {...globalConfig.global, stubs: {PlayerCube: CubeStub, PlayerDelegate: DelegateStub}},
    props: {embedded},
  });
}

type Stand = ReturnType<typeof standOf>;

/** The cube stubs standing inside `zone` (a selector of the stand's own markup). */
function cubesIn(stand: Stand, zone: string) {
  return stand.findAllComponents(CubeStub).filter((cube) => cube.element.closest(zone) !== null);
}

function buttonOf(stand: Stand, label: string) {
  const found = stand.findAll('.cube-playground__btn').find((b) => b.text().includes(label));
  if (found === undefined) {
    throw new Error(`the stand has no button «${label}»`);
  }
  return found;
}

describe('PlayerCubePlayground — the QA stand of the player cube and the delegate figure', () => {
  let clock: ManualFlowClock;
  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
  });

  it('renders the stand for its prop: every colour on every surface, every size, the figures of the hall', () => {
    const stand = standOf();
    expect(stand.classes()).to.include('cube-playground');
    expect(stand.classes(), 'a page of its own by default').to.not.include('cube-playground--embedded');
    expect(standOf(true).classes(), 'hosted in the playground hub').to.include('cube-playground--embedded');

    const surfaces = stand.findAll('.cube-playground__surfaces .cube-playground__surface');
    expect(surfaces.map((s) => s.find('.cube-playground__surface-label').text()))
      .to.deep.eq(['Dark board panel', 'Mars tile (warm)', 'Light surface', 'Glass HUD']);
    for (const surface of surfaces) {
      expect(surface.findAll('.cube-playground__swatch-name').map((n) => n.text())).to.deep.eq(COLORS);
    }
    const onSurfaces = cubesIn(stand, '.cube-playground__surfaces');
    expect(onSurfaces.map((c) => c.props('color')), 'a cube per colour per surface').to.deep.eq([...COLORS, ...COLORS, ...COLORS, ...COLORS]);
    expect(onSurfaces.every((c) => c.props('size') === 34)).to.eq(true);
    expect(cubesIn(stand, '.cube-playground__sizes').map((c) => c.props('size')), 'the scale row').to.deep.eq([14, 18, 21, 28, 40, 64]);

    // The delegate stand: three sizes of the hall × the eight players and the neutral steel. A figure's height is the
    // hall's (the floor enforced); the cube beside the 24 px figure stands at the logical size it is given.
    const figures = stand.findAllComponents(DelegateStub);
    expect(figures).to.have.length(27);
    expect([...new Set(figures.map((f) => f.props('size')))]).to.deep.eq([delegateFigurePx(18), delegateFigurePx(24), delegateFigurePx(28)]);
    expect(figures.filter((f) => f.props('steel')).map((f) => f.props('color'))).to.deep.eq(['neutral', 'neutral', 'neutral']);
    const beside = cubesIn(stand, '[data-token-row="24"]');
    expect(beside).to.have.length(9);
    expect(beside.every((c) => c.props('size') === conLogicalPx(15))).to.eq(true);
    expect(cubesIn(stand, '[data-token-row="18"]').length + cubesIn(stand, '[data-token-row="28"]').length).to.eq(0);
    expect(stand.findAll('[data-token-print]').map((p) => p.attributes('data-token-print'))).to.deep.eq(['player', 'neutral']);
  });

  it('a toggle reaches every piece, and a colour button re-colours the scale row', async () => {
    const stand = standOf();
    const pieces = () => [...stand.findAllComponents(CubeStub), ...stand.findAllComponents(DelegateStub)];

    expect(pieces().every((p) => p.props('overlaySymbol') === false && p.props('glow') === true && p.props('shadow') === true)).to.eq(true);
    await buttonOf(stand, 'Symbols: off').trigger('click');
    await buttonOf(stand, 'Glow: on').trigger('click');
    await buttonOf(stand, 'Shadow: on').trigger('click');
    expect(buttonOf(stand, 'Symbols: on').classes()).to.include('cube-playground__btn--active');
    expect(buttonOf(stand, 'Glow: off').classes()).to.not.include('cube-playground__btn--active');
    expect(buttonOf(stand, 'Shadow: off').classes()).to.not.include('cube-playground__btn--active');
    expect(pieces().every((p) => p.props('overlaySymbol') === true && p.props('glow') === false && p.props('shadow') === false)).to.eq(true);

    const scaleRow = () => [...new Set(cubesIn(stand, '.cube-playground__sizes').map((c) => c.props('color')))];
    expect(scaleRow()).to.deep.eq(['blue']);
    expect(buttonOf(stand, 'blue').classes()).to.include('cube-playground__btn--active');
    await buttonOf(stand, 'pink').trigger('click');
    expect(scaleRow()).to.deep.eq(['pink']);
    expect(buttonOf(stand, 'pink').classes()).to.include('cube-playground__btn--active');
    expect(buttonOf(stand, 'blue').classes()).to.not.include('cube-playground__btn--active');
  });

  it('the replay re-mounts every animated piece with the placement on, and lowers it 700 ms later — an owned wait', async () => {
    const stand = standOf();
    const animated = () => [...cubesIn(stand, '.cube-playground__surfaces, .cube-playground__sizes'), ...stand.findAllComponents(DelegateStub)];
    const firstCube = (): Element => stand.find('.cube-playground__surfaces .cube-stub').element;
    const compared = (): Array<Element> => stand.findAll('.cube-playground__compare-col .cube-stub').map((c) => c.element);

    expect(animated()).to.have.length(36 + 6 + 27);
    expect(animated().some((p) => p.props('animateIn'))).to.eq(false);
    const before = firstCube();
    const comparedBefore = compared();
    await buttonOf(stand, 'Replay placement').trigger('click');

    expect(animated().every((p) => p.props('animateIn')), 'the placement plays').to.eq(true);
    const replayed = firstCube();
    expect(replayed === before, 'a NEW node — the keyframe restarts only on a re-mount').to.eq(false);
    expect(compared().every((el, i) => el === comparedBefore[i]), 'the new-vs-legacy column is not part of the replay').to.eq(true);
    expect(cubesIn(stand, '.cube-playground__compare-col').some((c) => c.props('animateIn'))).to.eq(false);

    clock.advance(699);
    await nextTick();
    expect(animated().every((p) => p.props('animateIn')), 'still playing').to.eq(true);
    clock.advance(1);
    await nextTick();
    expect(animated().some((p) => p.props('animateIn')), 'the flag is lowered').to.eq(false);
    expect(firstCube() === replayed, 'lowering the flag re-mounts nothing').to.eq(true);
  });
});

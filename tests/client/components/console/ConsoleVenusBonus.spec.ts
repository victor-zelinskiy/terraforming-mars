import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleVenusBonus from '@/client/components/console/ConsoleVenusBonus.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';

const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const X: GamepadIntent = {kind: 'press', button: 'secondary'};
const B: GamepadIntent = {kind: 'press', button: 'back'};
const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});

/** Nine resource cards — more than the strip this replaced could ever show. */
const MANY: ReadonlyArray<CardName> = [
  CardName.BIRDS, CardName.TARDIGRADES, CardName.FISH, CardName.PETS, CardName.LIVESTOCK,
  CardName.ANTS, CardName.DECOMPOSERS, CardName.EXTREME_COLD_FUNGUS, CardName.SEARCH_FOR_LIFE,
];

function card(name: CardName, resources?: number): CardModel {
  return (resources === undefined ? {name} : {name, resources}) as CardModel;
}

/**
 * The FINAL-step prompt exactly as `GrantVenusAltTrackBonusDeferred` builds it:
 * `OrOptions(AndOptions(SelectCard, GainResources(base)), GainResources(base+1))`,
 * carrying the `venusBonusPrompt` marker.
 */
function finalView(
  names: ReadonlyArray<CardName>,
  opts: {baseCount?: number, resources?: Partial<Record<CardName, number>>, vp?: Record<string, {from: number, to: number}>} = {},
): PlayerViewModel {
  const base = opts.baseCount ?? 1;
  const cards = names.map((n) => card(n, opts.resources?.[n]));
  const amounts = {
    type: 'and',
    options: ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']
      .map((r) => ({type: 'amount', title: r, buttonLabel: 'Save', min: 0, max: base, maxByDefault: false})),
  };
  const waitingFor: any = {
    type: 'or',
    title: 'Choose your wild resource bonus.',
    buttonLabel: 'Save',
    options: names.length === 0 ? [amounts] : [
      {type: 'and', options: [
        {type: 'card', title: 'Add resource to card', buttonLabel: 'Add resource', cards, min: 1, max: 1},
        amounts,
      ]},
      amounts,
    ],
    venusBonusPrompt: {
      kind: 'final',
      baseCount: base,
      wildCardTargets: names,
      ...(opts.vp === undefined ? {} : {wildCardVp: opts.vp}),
    },
  };
  const tableau = names.map((n) => ({name: n}));
  return {
    id: 'p1',
    waitingFor,
    thisPlayer: {color: 'blue', name: 'Me', tableau, megacredits: 12, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0},
    players: [{color: 'blue', name: 'Me', tableau}],
  } as unknown as PlayerViewModel;
}

function mountWith(view: PlayerViewModel) {
  return mount(ConsoleVenusBonus, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {GamepadGlyph: true}},
    props: {playerView: view},
  });
}

/**
 * jsdom reports a zero rect for everything, and the selector's navigation is
 * deliberately GEOMETRIC (it walks the cards' real boxes, which is the only way
 * a wrapped grid can be walked). So the spec lays a real grid over the rendered
 * cells — 3 per row — and the assertions are then about the navigation, not
 * about jsdom's layout engine.
 */
function layOutCells(w: ReturnType<typeof mountWith>, perRow = 3): void {
  const root = w.element as HTMLElement;
  const cells = Array.from(root.querySelectorAll('[data-ptsel-cell]')) as Array<HTMLElement>;
  cells.forEach((el: HTMLElement, i: number) => {
    const left = (i % perRow) * 340;
    const top = Math.floor(i / perRow) * 460;
    el.getBoundingClientRect = () => ({
      left, top, width: 320, height: 440, right: left + 320, bottom: top + 440,
      x: left, y: top, toJSON: () => ({}),
    }) as DOMRect;
  });
}

/** Walk the wild question onto «put it on a card» and into the picker. */
async function intoPicker(w: ReturnType<typeof mountWith>) {
  (w.vm as any).handleIntent(A); // the first wild option IS «Put it on a card»
  await w.vm.$nextTick();
  return w;
}

/**
 * THE VENUS WILD RESOURCE, ON THE CANONICAL PICKER.
 *
 * The Venus-specific card strip is gone: this surface now hands the server's
 * own `SelectCard` to `ConsolePlayedTargetStep` — the same step the card-play
 * composer, the blue-action composer, the colony payout, the hydro stage and
 * the bot attack all use. What this file guards is the WIRING: that every
 * candidate arrives, that the reading is the shared one, that the pad contract
 * is the picker's, and that one decision produces one response.
 */
describe('ConsoleVenusBonus — the wild resource goes through the shared target step', () => {
  it('renders the SHARED selector and no Venus strip of its own', async () => {
    const w = await intoPicker(mountWith(finalView([CardName.BIRDS])));
    expect(w.find('.con-ptsel').exists(), 'the shared played-target step').to.be.true;
    expect(w.find('.con-venus__cards').exists(), 'the old Venus strip').to.be.false;
    expect(w.find('.con-venus__card').exists()).to.be.false;
    // The host states the ask, so the step must not restate it.
    expect(w.find('.con-ptsel__contract').exists()).to.be.false;
    w.unmount();
  });

  it('a single valid card is still SHOWN and confirmed — never auto-picked', async () => {
    const w = await intoPicker(mountWith(finalView([CardName.BIRDS], {resources: {[CardName.BIRDS]: 4}})));
    expect((w.vm as any).stage).to.eq('wildCard');
    expect(w.findAll('[data-ptsel-cell]')).to.have.length(1);
    expect((w.vm as any).wildCard).to.eq(undefined);
    w.unmount();
  });

  /** THE REPORTED BUG: nine candidates, nine reachable cells. */
  it('offers EVERY authoritative candidate, however many', async () => {
    const w = await intoPicker(mountWith(finalView(MANY)));
    expect(w.findAll('[data-ptsel-cell]')).to.have.length(MANY.length);
    expect((w.vm as any).wildModel.contract.targetCount).to.eq(MANY.length);
    w.unmount();
  });

  it('the status rail states «было → стало», and the ПО move only when it moves', async () => {
    const w = await intoPicker(mountWith(finalView([CardName.BIRDS, CardName.TARDIGRADES], {
      resources: {[CardName.BIRDS]: 2, [CardName.TARDIGRADES]: 0},
      // The server's own reading: Birds scores per animal, Tardigrades per FOUR
      // microbes (so at 0 the wild moves nothing).
      vp: {[CardName.BIRDS]: {from: 2, to: 3}, [CardName.TARDIGRADES]: {from: 0, to: 0}},
    })));
    const labels = () => (w.vm as any).wildModel.owners[0].candidates
      .map((c: any) => ({name: c.cardName, impacts: c.preview[0].impacts}));
    const birds = labels().find((c: any) => c.name === CardName.BIRDS);
    const tardi = labels().find((c: any) => c.name === CardName.TARDIGRADES);
    expect(birds.impacts[0]).to.include({from: 2, to: 3});
    expect(birds.impacts[1]).to.include({label: 'VP', from: 2, to: 3});
    expect(tardi.impacts[0]).to.include({from: 0, to: 1});
    expect(tardi.impacts, 'no fake / zero ПО delta').to.have.length(1);
    // The rail is the step's own, and it is present the whole time.
    expect(w.find('.con-ptsel__rail').exists()).to.be.true;
    w.unmount();
  });

  it('D-pad walks the candidates in TWO dimensions and A locks the focused one', async () => {
    const w = await intoPicker(mountWith(finalView(MANY)));
    layOutCells(w);
    const focused = () => (w.vm as any).focusedWildCard;
    const first = focused();
    (w.vm as any).handleIntent(nav('right'));
    await w.vm.$nextTick();
    const second = focused();
    expect(second, 'the cursor moved along the row').to.not.eq(first);
    // The strip this replaced was ONE line: down did nothing however many
    // candidates had wrapped onto the next row.
    (w.vm as any).handleIntent(nav('down'));
    await w.vm.$nextTick();
    expect(focused(), 'and onto the next row').to.not.eq(second);
    const chosen = focused();
    (w.vm as any).handleIntent(A);
    await w.vm.$nextTick();
    expect((w.vm as any).wildCard).to.eq(chosen);
    expect((w.vm as any).stage).to.eq('place');
    w.unmount();
  });

  /** B is ONE logical level, and the carried object survives it: the picker
   *  re-opens on the very card the player chose, still locked. */
  it('B from the placement re-opens the picker WITHOUT losing the pick or the focus', async () => {
    const w = await intoPicker(mountWith(finalView(MANY)));
    layOutCells(w);
    (w.vm as any).handleIntent(nav('right'));
    await w.vm.$nextTick();
    const chosen = (w.vm as any).focusedWildCard;
    (w.vm as any).handleIntent(A);
    await w.vm.$nextTick();
    expect((w.vm as any).stage).to.eq('place');

    (w.vm as any).handleIntent(B);
    await w.vm.$nextTick();
    expect((w.vm as any).stage, 'one level back, not two').to.eq('wildCard');
    expect((w.vm as any).wildCard, 'the pick survives').to.eq(chosen);
    expect((w.vm as any).focusedWildCard, 'and so does the cursor').to.eq(chosen);
    expect(w.find('.con-ptsel__slot--locked').exists(), 'shown locked').to.be.true;
    // …and B again steps out to the wild question, as it always did.
    (w.vm as any).handleIntent(B);
    await w.vm.$nextTick();
    expect((w.vm as any).stage).to.eq('wild');
    w.unmount();
  });

  it('one decision produces exactly ONE response, in the server\'s own shape', async () => {
    const w = await intoPicker(mountWith(finalView([CardName.BIRDS, CardName.FISH])));
    (w.vm as any).handleIntent(A); // choose the focused card
    await w.vm.$nextTick();
    const chosen = (w.vm as any).wildCard;
    (w.vm as any).handleIntent(A); // single-step placement: put the base resource here
    await w.vm.$nextTick();
    expect((w.vm as any).ready).to.be.true;
    (w.vm as any).handleIntent(X); // collect
    (w.vm as any).handleIntent(X); // a second press must NOT send a second answer
    await w.vm.$nextTick();
    const emitted = w.emitted('submit');
    expect(emitted, 'one submit only').to.have.length(1);
    expect(emitted?.[0][0]).to.deep.eq({
      type: 'or',
      index: 0,
      response: {
        type: 'and',
        responses: [
          {type: 'card', cards: [chosen]},
          {type: 'and', responses: [
            {type: 'amount', amount: 1}, {type: 'amount', amount: 0}, {type: 'amount', amount: 0},
            {type: 'amount', amount: 0}, {type: 'amount', amount: 0}, {type: 'amount', amount: 0},
          ]},
        ],
      },
    });
    w.unmount();
  });

  /** The tail names THIS stage, never the one after it: the picker used to
   *  inherit «Placement», so the crumb ran one stage ahead of the screen. */
  it('gives the picker its own crumb tail, and the tail only moves forward', async () => {
    const w = mountWith(finalView(MANY));
    await w.vm.$nextTick();
    expect((w.vm as any).stageKey).to.eq('Wild resource');
    (w.vm as any).handleIntent(A);
    await w.vm.$nextTick();
    expect((w.vm as any).stageKey).to.eq('Target');
    (w.vm as any).handleIntent(A);
    await w.vm.$nextTick();
    expect((w.vm as any).stageKey).to.eq('Placement');
    w.unmount();
  });

  it('publishes the picker\'s own four verbs to the ONE command bar', async () => {
    const w = await intoPicker(mountWith(finalView(MANY)));
    const cmds = (w.vm as any).footCommands.map((c: any) => c.control);
    expect(cmds).to.deep.eq(['dpad', 'confirm', 'secondary', 'back']);
    w.unmount();
  });

  /** No eligible card at all: the branch is shown DISABLED with its reason —
   *  the wild is never silently lost, and the picker never opens on nothing. */
  it('keeps the on-card branch visible and blocked when there is no host card', async () => {
    const w = mountWith(finalView([]));
    await w.vm.$nextTick();
    expect((w.vm as any).stage).to.eq('wild');
    expect((w.vm as any).wildOptions[0].disabled).to.be.true;
    (w.vm as any).handleIntent(A); // refused
    await w.vm.$nextTick();
    expect((w.vm as any).stage).to.eq('wild');
    w.unmount();
  });
});

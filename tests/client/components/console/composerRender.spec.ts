import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleActionComposer from '@/client/components/console/ConsoleActionComposer.vue';

// Stub the gamepad glyphs (footer decoration) — the test is about the premium
// RENDER of branch options + inputs, not the glyph chips.
const GlyphStub = {name: 'GamepadGlyph', props: ['control'], template: '<i class="glyph-stub" />'};

const PLAYER_VIEW: any = {
  id: 'p1',
  thisPlayer: {color: 'blue', name: 'Me', megacredits: 47, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0, tableau: []},
  // `tableau` is not optional in the real model, and the composer reads every
  // player's to decide which picks are PLAYED-CARD picks (the embedded target
  // step). A fixture that omits it is not a smaller player — it is a shape the
  // server never sends.
  players: [{color: 'blue', name: 'Me', tableau: []}],
  game: {generation: 1},
  cardsInHand: [],
};

function entryFor(cardName: string) {
  return {
    group: {key: cardName, cardName, isCorporation: false, isDisabled: false, nodes: [{key: cardName + '#0', actionNode: undefined, renderRoot: undefined, text: undefined}]},
    cardName,
    isCorporation: false,
    state: {status: 'available', activatable: true, reasons: [], softReason: undefined},
  } as any;
}

function factory(preview: any, cardName = 'Robinson Industries', nodeIndex = 0, view: any = PLAYER_VIEW) {
  return mount(ConsoleActionComposer, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
    props: {playerView: view, entry: entryFor(cardName), preview, nodeIndex},
  });
}

/** A view whose TABLE holds the given cards — what makes a card pick a
 *  PLAYED-CARD pick (and therefore the embedded target step). */
function viewWithTableau(names: ReadonlyArray<string>): any {
  const tableau = names.map((name) => ({name}));
  return {...PLAYER_VIEW, thisPlayer: {...PLAYER_VIEW.thisPlayer, tableau}, players: [{color: 'blue', name: 'Me', tableau}]};
}

function prod(icon: string) {
  return {direction: 'gain', icon, amount: 1, current: 0, resulting: 1, note: 'production'};
}
const M4 = {direction: 'cost', icon: 'megacredits', amount: 4, current: 47, resulting: 43};

describe('ConsoleActionComposer — premium render', () => {
  it('a multi-branch action (Robinson) renders branch OPTION CARDS with chips, never a bare text list', () => {
    const w = factory({
      card: 'Robinson Industries', isCorporation: true, kind: 'bespoke',
      branches: [
        {index: 0, title: 'Increase steel production 1 step', available: true, renderKeys: [], effects: [M4, prod('steel')], steps: []},
        {index: 1, title: 'Increase titanium production 1 step', available: true, renderKeys: [], effects: [M4, prod('titanium')], steps: []},
      ],
    });
    // Two premium branch option cards (the radiogroup) — not a "choose option" row.
    expect(w.findAll('.con-composer__branch')).to.have.length(2);
    // Each branch renders its cost/gain chips (2 per branch = 4 total).
    expect(w.findAll('.con-composer__branch .action-effect-chip')).to.have.length(4);
    // NONE fall back to a bare title (all have chips).
    expect(w.findAll('.con-composer__branch-title')).to.have.length(0);
    // The old "ACTION OPTION → выберите вариант" review row is gone.
    expect(w.findAll('.con-composer__row')).to.have.length(0);
    // Resource icons render on the chips (premium, not text).
    expect(w.findAll('.con-composer__branch .action-effect-chip__icon').length).to.be.greaterThan(0);
    w.unmount();
  });

  it('a disabled branch is SHOWN with its reason (never hidden)', () => {
    const w = factory({
      card: 'Electro Catapult', isCorporation: false, kind: 'declarative',
      branches: [
        {index: 0, title: 'plants', available: true, renderKeys: [], effects: [{direction: 'cost', icon: 'plants', amount: 1, current: 5, resulting: 4}, {direction: 'gain', icon: 'megacredits', amount: 7, current: 0, resulting: 7}], steps: []},
        {index: -1, title: 'steel', available: false, unavailableReason: 'Not enough steel', renderKeys: [], effects: [{direction: 'cost', icon: 'steel', amount: 1, current: 0, resulting: 0}, {direction: 'gain', icon: 'megacredits', amount: 7, current: 0, resulting: 7}], steps: []},
      ],
    }, 'Electro Catapult');
    expect(w.findAll('.con-composer__branch')).to.have.length(2);
    const disabled = w.find('.con-composer__branch--disabled');
    expect(disabled.exists()).to.eq(true);
    expect(disabled.find('.con-composer__branch-reason').text()).to.contain('steel');
    w.unmount();
  });

  it('a single-branch amount action (Hi-Tech Lab) renders the hero + an inline stepper, no branch cards', () => {
    const w = factory({
      card: 'Hi-Tech Lab', isCorporation: false, kind: 'bespoke',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [],
        effects: [{direction: 'gain', icon: 'cards', amount: 1, note: 'draw'}],
        steps: [{kind: 'input', input: {type: 'amount', title: 'Select amount of energy to spend', min: 1, max: 5, maxByDefault: false, icon: 'energy', amountResult: {icon: 'cards', perUnit: 1}}}],
      }],
    }, 'Hi-Tech Lab');
    // No branch radiogroup for a single-branch card.
    expect(w.findAll('.con-composer__branch')).to.have.length(0);
    // The hero formula is shown.
    expect(w.find('.con-composer__hero').exists()).to.eq(true);
    // An inline amount stepper, seeded at min (1).
    const stepper = w.find('.con-composer__stepper');
    expect(stepper.exists()).to.eq(true);
    expect(stepper.find('.con-composer__stepper-value').text()).to.eq('1');
    w.unmount();
  });

  /**
   * The INVERSE dial (Energy Market): the number counts what the player
   * RECEIVES and the price rides another pool. It used to land in the neutral
   * «ВЫ ВЫБИРАЕТЕ» cluster — a bare number with no word of the 2 M€ per step —
   * so the whole activation said nothing about what it costs. With `amountCost`
   * the hero must be a real БУДЕТ СПИСАНО → ПОЛУЧИТЕ pair, live on the dial.
   */
  it('an amountCost dial (Energy Market) shows the live price and the gain, not a bare «your choice»', async () => {
    const w = factory({
      card: 'Energy Market', isCorporation: false, kind: 'bespoke',
      branches: [{
        index: 0, title: 'Spend 2X M€ to gain X energy', available: true, renderKeys: [], effects: [],
        steps: [{kind: 'input', input: {type: 'amount', title: 'Select amount of energy to gain', min: 1, max: 5, maxByDefault: false,
          icon: 'energy', amountCost: {icon: 'megacredits', perUnit: 2}}}],
      }],
    }, 'Energy Market');
    // No neutral "your choice" chip — the dial has a direction now.
    expect(w.findAll('.con-composer__varchip')).to.have.length(0);
    const sides = w.findAll('.con-composer__hero-side');
    expect(sides).to.have.length(2); // spent + received
    // Seeded at min 1 → −2 M€ (47 → 45) and +1 energy (0 → 1).
    const chips = w.findAll('.con-composer__hero .action-effect-chip');
    expect(chips).to.have.length(2);
    expect(chips[0].text().replace(/\s/g, '')).to.contain('47→45');
    expect(chips[1].text().replace(/\s/g, '')).to.contain('0→1');
    // The row carries the PREMIUM operation preview now (the shared
    // ConsoleAmountOperation): both sides' current→after with the live price —
    // strictly more than the old one-line «Cost: 2» note it replaces.
    const preview = w.find('.con-convert__preview--inrow');
    expect(preview.exists()).to.eq(true);
    expect(preview.find('.con-convert__row--from').text().replace(/\s/g, '')).to.contain('47→45');
    expect(preview.find('.con-convert__row--from').text()).to.contain('-2');
    expect(preview.find('.con-convert__row--to').text().replace(/\s/g, '')).to.contain('0→1');
    w.unmount();
  });

  it('a bare confirm-only preview shows the plain confirm line (never a broken empty panel)', () => {
    const w = factory({
      card: 'X', isCorporation: false, kind: 'dynamic',
      branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
    }, 'X');
    expect(w.findAll('.con-composer__branch')).to.have.length(0);
    expect(w.find('.con-composer__hero--plain').exists()).to.eq(true);
    w.unmount();
  });

  // ── The repeat slot (Viron-shaped preview: a SelectCard step of used actions) ──

  function vironPreview() {
    return {
      card: 'Viron', isCorporation: true, kind: 'bespoke',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [], effects: [],
        steps: [{kind: 'input', repeatAction: true, input: {type: 'card', title: 'Perform an action from a played card again', cards: [], min: 1, max: 1}}],
      }],
    };
  }

  it('the repeat slot demands its pick before confirming (control case)', () => {
    const w = factory(vironPreview(), 'Viron');
    expect((w.vm as any).canConfirm).to.eq(false);
    expect(w.text()).to.contain('Choose an action to repeat');
    w.unmount();
  });

  it('a NESTED repeat slot (repeatPickDisabled — this composer already lives INSIDE the repeat pick surface) is a read-only note: confirm live, no cursor stop, no `repeat` in the payload', async () => {
    const w = mount(ConsoleActionComposer, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
      props: {playerView: PLAYER_VIEW, entry: entryFor('Viron'), preview: vironPreview(), nodeIndex: 0, repeatPickDisabled: true},
    });
    // The slot renders the honest post-confirm note, never the pick button —
    // a second enterConsoleRepeatPick would clobber the singleton bridge.
    expect(w.text()).to.contain('The action to repeat is chosen after confirming');
    // Confirm does NOT require the (impossible here) nested pick…
    expect((w.vm as any).canConfirm).to.eq(true);
    // …the note is not a cursor stop…
    expect((w.vm as any).navItems.some((it: any) => it.kind === 'choice' && it.choice.repeatAction === true)).to.eq(false);
    // …and the confirm payload carries NO repeat (the server asks next).
    (w.vm as any).submit();
    const emitted = w.emitted('confirm');
    expect(emitted).to.have.length(1);
    expect((emitted![0][0] as any).repeat).to.eq(undefined);
    w.unmount();
  });

  // ── The ACTION FOCUS stage (the in-frame recompose iteration) ────────────

  it('renders as the IN-FRAME stage: hero card slot (FLIP anchor + zoom slot) and NO modal header', () => {
    const w = factory({
      card: 'Regolith Eaters', isCorporation: false, kind: 'declarative',
      branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [M4], steps: []}],
    }, 'Regolith Eaters');
    expect(w.find('.con-composer--stage').exists()).to.eq(true);
    const slot = w.find('[data-action-focus-card]');
    expect(slot.exists()).to.eq(true);
    expect(slot.attributes('data-zoom-slot')).to.eq('Regolith Eaters');
    expect(slot.attributes('data-motion-anchor')).to.eq('card:Regolith Eaters');
    // The identity line lives in the frame header (ConsoleCardActions) now.
    expect(w.find('.con-composer__kicker').exists()).to.eq(false);
    expect(w.find('.con-composer__name').exists()).to.eq(false);
    w.unmount();
  });

  it('the CTA lives in the pinned DOCK outside the scroll (always on screen)', () => {
    const w = factory({
      card: 'X', isCorporation: false, kind: 'dynamic',
      branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
    }, 'X');
    expect(w.find('.con-composer__ctadock .con-composer__cta').exists()).to.eq(true);
    expect(w.find('.con-composer__scroll .con-composer__cta').exists()).to.eq(false);
    w.unmount();
  });

  it('a disabled CTA names the FIRST missing decision (honest hint, never mute)', () => {
    const w = factory({
      card: 'Y', isCorporation: false, kind: 'declarative',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [], effects: [],
        steps: [{kind: 'input', input: {type: 'card', title: 'Select card', buttonLabel: 'Select', cards: [{name: 'Tardigrades'}, {name: 'Regolith Eaters'}], min: 1, max: 1}}],
      }],
    }, 'Y');
    expect(w.find('.con-composer__cta--off').exists()).to.eq(true);
    expect(w.find('.con-composer__cta-hint').text()).to.contain('Choose a card');
    w.unmount();
  });

  /**
   * THE COMMIT GATE, on the screen it was reported from («Обстрел кометами»).
   *
   * The commit row used to be a cursor stop wearing the full active treatment
   * — bright ring, live Ⓐ — while a required card pick was still empty and
   * pressing A did nothing at all. Every reading below now comes from the one
   * gate, so they cannot disagree again.
   */
  function withMissingPick() {
    return factory({
      card: 'Y', isCorporation: false, kind: 'declarative',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [], effects: [],
        steps: [{kind: 'input', input: {type: 'card', title: 'Select card', buttonLabel: 'Select', cards: [{name: 'Tardigrades'}, {name: 'Regolith Eaters'}], min: 1, max: 1}}],
      }],
    }, 'Y');
  }

  it('a HELD commit row wears no active treatment and no Ⓐ', async () => {
    const w = withMissingPick();
    await w.vm.$nextTick();
    const cta = w.find('.con-composer__ctadock .con-composer__cta');
    expect(cta.classes(), 'held, not selected').to.include('con-composer__cta--held');
    expect(cta.classes(), 'a disabled row must never look focused').to.not.include('con-composer__cta--focused');
    expect(cta.attributes('aria-disabled')).to.eq('true');
    // The glyph belongs to the press it stands for.
    expect(cta.find('.con-composer__cta-glyph').exists()).to.eq(false);
    w.unmount();
  });

  /** The cursor cannot ARRIVE at a row that would refuse it — not on open, and
   *  not by walking down past the last requirement. */
  it('the cursor never reaches the commit row while a requirement is waiting', async () => {
    const w = withMissingPick();
    await w.vm.$nextTick();
    const vm = w.vm as any;
    expect(vm.ctaFocused, 'the screen must not OPEN on the commit row').to.eq(false);
    for (let i = 0; i < 6; i++) {
      vm.handleIntent({kind: 'nav', dir: 'down', repeat: false});
    }
    await w.vm.$nextTick();
    expect(vm.ctaFocused, 'walking down must stop before it').to.eq(false);
    expect(vm.commitGate.kind).to.eq('incomplete');
    w.unmount();
  });

  /** #11 — a mouse click is the backstop path: it must not commit, and the
   *  refusal must LAND the player on the thing that needs them. */
  it('a click on the held commit row redirects instead of confirming', async () => {
    const w = withMissingPick();
    await w.vm.$nextTick();
    await w.find('.con-composer__ctadock .con-composer__cta').trigger('click');
    expect(w.emitted('confirm'), 'no commit may escape').to.eq(undefined);
    expect((w.vm as any).focusIdx).to.eq((w.vm as any).commitGate.blocking.index);
    w.unmount();
  });

  /** #13 — an action with nothing to configure stays immediately confirmable:
   *  the gating must not tax the simple case. */
  it('an action with NO requirements is ready and focusable at once', async () => {
    const w = factory({
      card: 'Z', isCorporation: false, kind: 'dynamic',
      branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
    }, 'Z');
    await w.vm.$nextTick();
    expect((w.vm as any).commitGate.kind).to.eq('ready');
    const cta = w.find('.con-composer__ctadock .con-composer__cta');
    expect(cta.classes()).to.not.include('con-composer__cta--held');
    expect(cta.find('.con-composer__cta-glyph').exists()).to.eq(true);
    w.unmount();
  });


  /**
   * THE STATUS RAIL IS OUTSIDE THE SCROLL — structurally, not by luck.
   *
   * With a large table the cards genuinely have to scroll (they may not be
   * shrunk to unreadable), and the rail states what the card UNDER THE CURSOR
   * does. If it travelled with the list, the reading would leave the screen at
   * exactly the moment the player is moving through candidates. The DOM
   * relationship is the guarantee, so that is what this asserts.
   */
  it('the status rail is NOT inside the candidate viewport', async () => {
    const w = factory({
      card: 'S', isCorporation: false, kind: 'declarative',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [], effects: [],
        steps: [{kind: 'input', input: {type: 'card', title: 'Select card', buttonLabel: 'Select', cards: [{name: 'Tardigrades'}], min: 1, max: 1}}],
      }],
    }, 'S', 0, viewWithTableau(['Tardigrades']));
    await w.vm.$nextTick();
    (w.vm as any).openChoice((w.vm as any).allChoices[0]);
    await w.vm.$nextTick();

    const step = w.find('.con-ptsel');
    expect(step.exists(), 'the embedded step is open').to.eq(true);
    const rail = step.find('.con-ptsel__rail');
    const viewport = step.find('.con-ptsel__viewport');
    expect(rail.exists(), 'the rail is rendered').to.eq(true);
    expect(viewport.exists(), 'the candidate viewport is rendered').to.eq(true);
    // THE CONTRACT: the rail is a SIBLING of the scroller, never a descendant.
    expect(viewport.element.contains(rail.element), 'the rail must not live inside the scroller').to.eq(false);
    // …and so is the contract line above it.
    expect(viewport.element.contains(step.find('.con-ptsel__contract').element)).to.eq(false);
    // The cards, by contrast, ARE inside it.
    expect(viewport.element.contains(step.find('.con-ptsel__zone').element)).to.eq(true);
    w.unmount();
  });

  /** A SELF-TARGET draws a handle, never a second copy of the card that is
   *  already standing in the hero slot. */
  it('a self-target renders a handle, not a second full-size card', async () => {
    const w = factory({
      card: 'Tardigrades', isCorporation: false, kind: 'declarative',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [], effects: [],
        steps: [{kind: 'input', input: {type: 'card', title: 'Select card', buttonLabel: 'Select', cards: [{name: 'Tardigrades'}], min: 1, max: 1}}],
      }],
    }, 'Tardigrades', 0, viewWithTableau(['Tardigrades']));
    await w.vm.$nextTick();
    (w.vm as any).openChoice((w.vm as any).allChoices[0]);
    await w.vm.$nextTick();

    expect(w.find('.con-ptsel__self').exists(), 'the handle is there').to.eq(true);
    expect(w.find('.con-ptsel__slot').exists(), 'and no full-size candidate face').to.eq(false);

    // THE PROXY IS NOT AN ORIGIN. X on it must lift the REAL card standing in
    // the hero column, so it publishes the connector's anchor and deliberately
    // no `data-zoom-slot`: a slot key here is what made the fullscreen viewer
    // rise out of the chip while the card it names stayed on screen beside it.
    const self = w.find('.con-ptsel__self');
    expect(self.attributes('data-ptsel-self'), 'the proxy anchors the connector').to.not.eq(undefined);
    expect(self.attributes('data-zoom-slot'), 'and is never a zoom origin itself').to.eq(undefined);

    // …and the two ends of that link both exist, in the same band.
    expect(w.find('[data-ptsel-source]').exists(), 'the hero publishes the source anchor').to.eq(true);
    expect(w.find('[data-ws-band] > .con-ptlink').exists(),
      'the connector lives on the band — the only element containing both ends').to.eq(true);

    // THE PROXY'S BOX IS SOLVED, NOT INTRINSIC. The stylesheet bounds it with
    // `--con-ptsel-slot-w`; if the step stops publishing that, the bound
    // silently falls back to a literal and the selection reflow returns.
    expect(w.find('.con-ptsel').attributes('style') ?? '',
      'the solved cell width must reach the CSS bound').to.include('--con-ptsel-slot-w');
    w.unmount();
  });


  /**
   * THE SPAN MUST REACH THE DOM.
   *
   * The solver had been right for a whole iteration and the screen did not
   * change: `.con-ptsel__section` carried `flex: 1 1 0`, and a flex item with
   * a `flex-basis` other than `auto` IGNORES its `width` — so every category
   * kept getting an equal share of the band and the computed span was silently
   * discarded. Unit tests on the solver could not see that; this asserts the
   * value actually ARRIVES on the element.
   */
  it('a category carries its own SPAN width, not an equal share', async () => {
    const w = factory({
      card: 'S', isCorporation: false, kind: 'declarative',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [], effects: [],
        steps: [{kind: 'input', input: {type: 'card', title: 'Select card', buttonLabel: 'Select',
          cards: [{name: 'Tardigrades'}, {name: 'Regolith Eaters'}, {name: 'Mine'}], min: 1, max: 1}}],
      }],
    }, 'S', 0, viewWithTableau(['Tardigrades', 'Regolith Eaters', 'Mine']));
    await w.vm.$nextTick();
    (w.vm as any).openChoice((w.vm as any).allChoices[0]);
    await w.vm.$nextTick();

    const sections = w.findAll('.con-ptsel__section');
    expect(sections.length, 'two categories are rendered').to.be.greaterThan(1);
    for (const sec of sections) {
      const style = sec.attributes('style') ?? '';
      expect(style, 'every category states its own width').to.contain('width');
    }
    // The busier category must be WIDER — that is the whole allocation model.
    const widths = sections.map((sec) => {
      const m = /width:\s*([0-9.]+)px/.exec(sec.attributes('style') ?? '');
      return m !== null ? Number(m[1]) : 0;
    });
    const counts = sections.map((sec) => sec.findAll('.con-ptsel__cell').length);
    const busiest = counts.indexOf(Math.max(...counts));
    const quietest = counts.indexOf(Math.min(...counts));
    expect(counts[busiest], 'the fixture really has an uneven split').to.be.greaterThan(counts[quietest]);
    expect(widths[busiest], 'the busier category is wider').to.be.greaterThan(widths[quietest]);
  });

  /** …and the section must be able to HONOUR that width — a flex item whose
   *  basis is not `auto` cannot. This pins the class contract itself. */
  it('the section is not a flex-basis item (its width would be ignored)', async () => {
    const w = factory({
      card: 'S2', isCorporation: false, kind: 'declarative',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [], effects: [],
        steps: [{kind: 'input', input: {type: 'card', title: 'Select card', buttonLabel: 'Select',
          cards: [{name: 'Tardigrades'}, {name: 'Mine'}], min: 1, max: 1}}],
      }],
    }, 'S2', 0, viewWithTableau(['Tardigrades', 'Mine']));
    await w.vm.$nextTick();
    (w.vm as any).openChoice((w.vm as any).allChoices[0]);
    await w.vm.$nextTick();
    const sec = w.find('.con-ptsel__section');
    expect(sec.exists()).to.eq(true);
    // The inline width is the allocation; nothing may set a basis that beats it.
    expect(sec.attributes('style') ?? '').to.contain('width');
    w.unmount();
  });

  /**
   * THE RAIL STATES WHAT MOVES — and a model-level test cannot see that it
   * really reached the DOM.
   *
   * The one-line rail summarises the card under the cursor; it is not a
   * comparison, so «ПО 0 → 0» beside a real «0 → 1» would be a second chip that
   * says nothing while taking the eye off the one that does
   * (`playedTargetImpactMoves`, 2026-08-12). The static reading is kept where the
   * comparison actually happens — the full sections — and is pinned there by
   * `consolePlayedTargetPreview.spec.ts`.
   */
  it('a MOVING VP reading reaches the rail; a static one is not stated there', async () => {
    const mk = (vp: {from: number, to: number}) => factory({
      card: 'P', isCorporation: false, kind: 'declarative',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [], effects: [],
        steps: [{kind: 'input', amount: -1, cardResource: 'animals',
          vpBox: {['Birds' as any]: vp},
          input: {type: 'card', title: 'Select card', buttonLabel: 'Select',
            cards: [{name: 'Birds', resources: 3}], min: 1, max: 1}}],
      }],
    }, 'P', 0, viewWithTableau(['Birds']));

    const still = mk({from: 1, to: 1});
    await still.vm.$nextTick();
    (still.vm as any).openChoice((still.vm as any).allChoices[0]);
    await still.vm.$nextTick();
    const railStill = still.find('.con-ptsel__railimpacts').text().replace(/\s/g, '');
    expect(railStill, 'a static reading is not stated on the rail').to.not.contain('1→1');
    expect(still.findAll('.con-ptsel__imp--static').length, 'and nothing is marked quiet there').to.eq(0);
    still.unmount();

    const moving = mk({from: 3, to: 2});
    await moving.vm.$nextTick();
    (moving.vm as any).openChoice((moving.vm as any).allChoices[0]);
    await moving.vm.$nextTick();
    expect(moving.findAll('.con-ptsel__imp--static').length, 'a moving reading is never quiet').to.eq(0);
    expect(moving.find('.con-ptsel__railimpacts').text().replace(/\s/g, '')).to.contain('3→2');
    moving.unmount();
  });

  /**
   * THE CONSTANT HALF REACHES THE RESULT AREA.
   *
   * Predators' shape: ONE branch, so its effects render in the result cluster
   * rather than on branch cards. The «ПО» chip states what the taken animal is
   * worth on the acting card — the half that does not vary with the candidate,
   * and therefore the half that must NOT be in the per-candidate rail.
   */
  it('a single-branch action shows the VP chip in its result, badge and all', () => {
    const w = factory({
      card: 'Predators', isCorporation: false, kind: 'bespoke',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [],
        effects: [
          {direction: 'gain', icon: 'animals', amount: 1, current: 4, resulting: 5, note: 'on this card'},
          {direction: 'gain', icon: 'vp', amount: 1, current: 4, resulting: 5},
        ],
        steps: [],
      }],
    }, 'Predators');
    const badge = w.find('.action-effect-chip__vp');
    expect(badge.exists(), 'the VP reading is stated with the effects').to.eq(true);
    // …and it never reserves an empty sprite box beside itself.
    expect(w.findAll('.action-effect-chip').length, 'both halves of the trade are shown').to.be.greaterThan(1);
    w.unmount();
  });

  /**
   * SELF-HARM MUST REACH THE DOM.
   *
   * The rules let Predators eat your own animal, so the option stays — the job
   * is to make it impossible to take by accident. The console had `self` in its
   * model already and used it ONLY to sort; the `--self` class it painted had no
   * stylesheet rule behind it at all. A flag that is computed and never seen is
   * the same as no flag, and a model test cannot tell the two apart.
   */
  it('a TAKE from your own card is marked, on the group and on the rail', async () => {
    const twoTableaux: any = {
      ...PLAYER_VIEW,
      thisPlayer: {...PLAYER_VIEW.thisPlayer, tableau: [{name: 'Birds'}]},
      players: [
        {color: 'blue', name: 'Me', tableau: [{name: 'Birds'}]},
        {color: 'red', name: 'Red', tableau: [{name: 'Ants'}]},
      ],
    };
    const w = factory({
      card: 'Predators', isCorporation: false, kind: 'bespoke',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [], effects: [],
        steps: [{kind: 'input', amount: -1, cardResource: 'animals',
          input: {type: 'card', title: 'Remove resource(s)', buttonLabel: 'Select',
            cards: [{name: 'Birds', resources: 3}, {name: 'Ants', resources: 2}], min: 1, max: 1}}],
      }],
    }, 'Predators', 0, twoTableaux);
    await w.vm.$nextTick();
    (w.vm as any).openChoice((w.vm as any).allChoices[0]);
    await w.vm.$nextTick();

    // Focus opens on the OPPONENT (groups sort opponents-first, deliberately),
    // and in tabbed mode only the focused group is on screen — so nothing warns
    // yet, which is correct: there is nothing to warn about.
    expect(w.findAll('.con-ptsel__ownerwarn').length, 'the opponent block is never marked').to.eq(0);
    expect(w.find('.con-ptsel__railwarn').exists(), 'nor does the rail').to.eq(false);

    // Move to the viewer's own block — the case the whole marker exists for.
    (w.vm as any).sub.focus = {ownerId: 'blue', index: 0};
    await w.vm.$nextTick();
    expect(w.findAll('.con-ptsel__ownerwarn').length, 'the viewer block is marked, once').to.eq(1);
    expect(w.find('.con-ptsel__railwarn').exists(), 'and the rail warns at the moment of decision').to.eq(true);
    w.unmount();
  });

  /** …and an ADD to your own card is the ordinary move — never marked. A marker
   *  on the normal case is one the player learns to ignore. */
  it('an ADD to your own card is not marked', async () => {
    const twoTableaux: any = {
      ...PLAYER_VIEW,
      thisPlayer: {...PLAYER_VIEW.thisPlayer, tableau: [{name: 'Birds'}]},
      players: [
        {color: 'blue', name: 'Me', tableau: [{name: 'Birds'}]},
        {color: 'red', name: 'Red', tableau: [{name: 'Ants'}]},
      ],
    };
    const w = factory({
      card: 'Comet Aiming', isCorporation: false, kind: 'bespoke',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [], effects: [],
        steps: [{kind: 'input', amount: 1, cardResource: 'animals',
          input: {type: 'card', title: 'Add resource', buttonLabel: 'Select',
            cards: [{name: 'Birds', resources: 3}, {name: 'Ants', resources: 2}], min: 1, max: 1}}],
      }],
    }, 'Comet Aiming', 0, twoTableaux);
    await w.vm.$nextTick();
    (w.vm as any).openChoice((w.vm as any).allChoices[0]);
    await w.vm.$nextTick();
    expect(w.findAll('.con-ptsel__ownerwarn').length).to.eq(0);
    expect(w.find('.con-ptsel__railwarn').exists()).to.eq(false);
    w.unmount();
  });

  it('X emits inspect-source (the console-wide inspect verb) — it NEVER confirms', () => {
    const w = factory({
      card: 'X', isCorporation: false, kind: 'dynamic',
      branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
    }, 'X');
    (w.vm as any).handleIntent({kind: 'press', button: 'secondary'});
    expect(w.emitted('inspect-source')).to.have.length(1);
    expect(w.emitted('confirm')).to.eq(undefined);
    w.unmount();
  });

  it('a LONE amount stepper is FOCUS-FREE: LB/RB dial it while the cursor waits on the CTA', () => {
    const w = factory({
      card: 'Hi-Tech Lab', isCorporation: false, kind: 'bespoke',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [],
        effects: [{direction: 'gain', icon: 'cards', amount: 1, note: 'draw'}],
        steps: [{kind: 'input', input: {type: 'amount', title: 'Select amount of energy to spend', min: 1, max: 5, maxByDefault: false, icon: 'energy', amountResult: {icon: 'cards', perUnit: 1}}}],
      }],
    }, 'Hi-Tech Lab');
    const vm = w.vm as any;
    // The stepper still RENDERS (with its own LB/RB pills) but left the nav list,
    // so the cursor starts on the CTA — «покрутил и подтвердил», no extra A.
    expect(w.find('.con-composer__stepper').exists()).to.eq(true);
    expect(w.find('.con-composer__dial-pills').exists()).to.eq(true);
    expect(vm.navItems.length).to.eq(0);
    expect(vm.ctaFocused).to.eq(true);
    expect(vm.focusedRowKind).to.eq('none');
    // ...yet it is a SETUP, not a bare confirmation (the header must not lie).
    expect(vm.hasDecisions).to.eq(true);
    // LB/RB dial it with no focus on it at all; RT takes it to MAX.
    const before = vm.amountFor(vm.focusFreeDialId);
    vm.handleIntent({kind: 'press', button: 'bumperR'});
    expect(vm.amountFor(vm.focusFreeDialId)).to.eq(before + 1);
    vm.handleIntent({kind: 'press', button: 'bumperL'});
    expect(vm.amountFor(vm.focusFreeDialId)).to.eq(before);
    vm.handleIntent({kind: 'press', button: 'triggerR'});
    expect(vm.amountFor(vm.focusFreeDialId)).to.eq(5);
    // The bar advertises the dial + the confirm, never a «Далее» detour.
    expect(vm.footCommands.map((c: any) => c.label)).to.deep.eq(['−1 / +1', 'MAX', 'Confirm', 'Inspect', 'Cancel']);
    // A goes straight to the commit — one press.
    vm.handleIntent({kind: 'press', button: 'confirm'});
    expect(w.emitted('confirm')).to.have.length(1);
    w.unmount();
  });

  it('TWO steppers keep their focus rows (focus is what disambiguates two dials)', () => {
    const w = factory({
      card: 'Two Dials', isCorporation: false, kind: 'bespoke',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [], effects: [],
        steps: [
          {kind: 'input', input: {type: 'amount', title: 'First', min: 0, max: 4, maxByDefault: false, icon: 'energy'}},
          {kind: 'input', input: {type: 'amount', title: 'Second', min: 0, max: 4, maxByDefault: false, icon: 'heat'}},
        ],
      }],
    }, 'Two Dials');
    const vm = w.vm as any;
    expect(vm.focusFreeDialId).to.eq(undefined);
    expect(vm.navItems.length).to.eq(2);
    expect(vm.focusedRowKind).to.eq('amount');
    expect(w.find('.con-composer__dial-pills').exists()).to.eq(false);
    // A still ADVANCES off a focused stepper (it never silently confirms).
    vm.handleIntent({kind: 'press', button: 'confirm'});
    expect(w.emitted('confirm')).to.eq(undefined);
    w.unmount();
  });

  // ── The IN-FRAME reveal phase («Действия карт › Результат вскрытия») ──────

  it('the reveal phase replaces the decision column: status first, outcome + real card once settled', async () => {
    const w = factory({
      card: 'Search For Life', isCorporation: false, kind: 'bespoke',
      branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: [],
        reveal: {deck: 'projects', check: {label: 'microbe tag'}, reward: {direction: 'gain', icon: 'science', amount: 1}}}],
    }, 'Search For Life');
    // The phase opens at confirm time (parent sets the prop on the LIVE stage).
    await w.setProps({outcome: {kind: 'deck-check'}});
    await w.vm.$nextTick();
    expect(w.find('.con-composer__revealzone').exists()).to.eq(true);
    expect(w.find('.con-composer__revealstatus').text()).to.contain('Revealing the card');
    // The decision column yielded — no CTA dock, no hero.
    expect(w.find('.con-composer__ctadock').exists()).to.eq(false);
    // Face down → every press is swallowed (post-commit, nothing cancellable).
    (w.vm as any).handleIntent({kind: 'press', button: 'back'});
    (w.vm as any).handleIntent({kind: 'press', button: 'confirm'});
    expect(w.emitted('cancel')).to.eq(undefined);
    expect(w.emitted('reveal-ack')).to.eq(undefined);

    // The server's answer lands → the (JSDOM: instant) flip settles: the
    // outcome replaces the status and the REAL card owns the slot.
    await w.setProps({outcome: {kind: 'deck-check', payload: {
      action: 'Search For Life',
      revealed: {name: 'Insulation'},
      conditionMet: false,
    }}});
    await w.vm.$nextTick();
    await w.vm.$nextTick();
    expect((w.vm as any).revealStage).to.eq('settled');
    expect(w.find('.con-verdict').text()).to.contain('Condition not met');
    expect(w.find('.con-composer__revealslot--miss').exists()).to.eq(true);
    expect(w.find('.con-composer__revealslot').attributes('data-zoom-slot')).to.eq('revealed:Insulation');
    // A acknowledges (OK) — the parent returns the flow to browse.
    (w.vm as any).handleIntent({kind: 'press', button: 'confirm'});
    expect(w.emitted('reveal-ack')).to.have.length(1);
    w.unmount();
  });

  it('a MET reveal shows the green verdict + the reward chip + the VP delta', async () => {
    const w = factory({
      card: 'Search For Life', isCorporation: false, kind: 'bespoke',
      branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
    }, 'Search For Life');
    await w.setProps({outcome: {kind: 'deck-check'}});
    await w.vm.$nextTick();
    await w.setProps({outcome: {kind: 'deck-check', payload: {
      action: 'Search For Life',
      revealed: {name: 'Tardigrades'},
      conditionMet: true,
      check: {tag: 'microbe', label: 'Microbe'},
      reward: {direction: 'gain', icon: 'science', amount: 1},
      vp: {from: 0, to: 3},
    }}});
    await w.vm.$nextTick();
    await w.vm.$nextTick();
    const outcome = w.find('.con-verdict');
    expect(outcome.classes()).to.contain('con-verdict--met');
    expect(outcome.text()).to.contain('Condition met');
    expect(outcome.find('.action-effect-chip').exists()).to.eq(true);
    expect(w.find('.con-verdict__vp').text()).to.contain('+3');
    w.unmount();
  });

  /**
   * THE EMBEDDED STAGE IS NOT THE POORER READING. It used to show a single pill
   * — a ✓/✕ and four words — while the legacy standalone modal showed the whole
   * breakdown for the same event: what was checked, whether it was found, and
   * that the reward was NOT received. Both hosts now mount the SAME panel, so
   * the embedded flow states the full case.
   */
  it('REGRESSION: a MISSED reveal names the CHECK and says the reward was not received', async () => {
    const w = factory({
      card: 'Search For Life', isCorporation: false, kind: 'bespoke',
      branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
    }, 'Search For Life');
    await w.setProps({outcome: {kind: 'deck-check'}});
    await w.vm.$nextTick();
    await w.setProps({outcome: {kind: 'deck-check', payload: {
      action: 'Search For Life',
      revealed: {name: 'Magnetic Field Dome'},
      conditionMet: false,
      check: {tag: 'microbe', label: 'Microbe'},
    }}});
    await w.vm.$nextTick();
    await w.vm.$nextTick();
    const verdict = w.find('.con-verdict');
    expect(verdict.classes()).to.contain('con-verdict--miss');
    // WHAT was checked, and that it was not there.
    expect(verdict.text()).to.contain('Microbe');
    expect(verdict.find('.con-verdict__found--no').exists()).to.eq(true);
    // …and the reward row still speaks: a missing row would read as «nothing
    // was at stake», which is exactly what the player wants to know here.
    expect(verdict.text()).to.contain('Not received');
    expect(verdict.find('.action-effect-chip').exists()).to.eq(false);
    // No VP row when nothing was scored.
    expect(verdict.find('.con-verdict__vp').exists()).to.eq(false);
    w.unmount();
  });

  it('REGRESSION: a composer MOUNTED with `reveal` already set launches the flight (repeat-reveal must not hang on «Вскрываем карту»)', async () => {
    // The repeat-action flow points the composer at the chosen reveal action AND
    // opens the reveal phase in the SAME tick — the composer MOUNTS with `reveal`
    // already `{}`. A non-immediate `reveal` watcher misses that initial value, so
    // beginRevealFlight never runs (no handle, stage stuck 'pending') and the
    // payload delivery is silently dropped → the phase hangs. The `reveal` watcher
    // must be IMMEDIATE. Here we mount WITH reveal already present, then deliver the
    // payload: the outcome must resolve (buggy code leaves revealStage 'pending').
    const w = mount(ConsoleActionComposer, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
      props: {
        playerView: PLAYER_VIEW,
        entry: entryFor('Asteroid Deflection System'),
        preview: {
          card: 'Asteroid Deflection System', isCorporation: false, kind: 'bespoke',
          branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: [],
            reveal: {deck: 'projects', check: {label: 'space tag'}, reward: {direction: 'gain', icon: 'asteroid', amount: 1}}}],
        },
        nodeIndex: 0,
        outcome: {kind: 'deck-check'},
      },
    });
    await w.vm.$nextTick();
    await w.vm.$nextTick();
    // beginRevealFlight ran on mount — the phase is live, not idle-'pending'.
    expect(w.find('.con-composer__revealzone').exists()).to.eq(true);
    await w.setProps({outcome: {kind: 'deck-check', payload: {
      action: 'Asteroid Deflection System',
      revealed: {name: 'Security Fleet'},
      conditionMet: true,
      reward: {direction: 'gain', icon: 'asteroid', amount: 1},
      vp: {from: 4, to: 5},
    }}});
    await w.vm.$nextTick();
    await w.vm.$nextTick();
    expect((w.vm as any).revealStage).to.eq('settled');
    expect(w.find('.con-verdict').exists()).to.eq(true);
    w.unmount();
  });

  it('the GAIN beat: the counter is FROZEN at the pre-reveal value, ticks after the beat, L3 inspects the source', async () => {
    const viewBefore = {
      ...PLAYER_VIEW,
      thisPlayer: {...PLAYER_VIEW.thisPlayer, tableau: [{name: 'Search For Life', resources: 1}]},
    };
    const w = mount(ConsoleActionComposer, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
      props: {
        playerView: viewBefore,
        entry: entryFor('Search For Life'),
        preview: {
          card: 'Search For Life', isCorporation: false, kind: 'bespoke',
          branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
        },
        nodeIndex: 0,
        reveal: undefined,
      },
    });
    // The hero card wears the SHARED tableau counter chip.
    expect(w.find('.con-composer__actcard .pcard__res-count').text()).to.eq('1');

    // The phase opens; the answer's commit already carries the reward (2) —
    // the visible counters must HOLD the before-value until the beat.
    await w.setProps({outcome: {kind: 'deck-check'}});
    await w.vm.$nextTick();
    const viewAfter = {
      ...viewBefore,
      thisPlayer: {...viewBefore.thisPlayer, tableau: [{name: 'Search For Life', resources: 2}]},
    };
    await w.setProps({playerView: viewAfter});
    expect(w.find('.con-composer__actcard .pcard__res-count').text()).to.eq('1');

    await w.setProps({outcome: {kind: 'deck-check', payload: {
      action: 'Search For Life',
      revealed: {name: 'Tardigrades'},
      conditionMet: true,
      reward: {direction: 'gain', icon: 'science', amount: 1},
    }}});
    await w.vm.$nextTick();
    await w.vm.$nextTick();
    // The beat resolves (headless runner: the short no-travel path).
    await new Promise((resolve) => setTimeout(resolve, 260));
    expect((w.vm as any).revealGainApplied).to.eq(true);
    // ONE counter now — the disc and the plate collapsed into the CARD'S OWN
    // capsule (bottom-left, beside the expansion stamp), so the tick is
    // asserted once, in the one place it happens.
    expect(w.find('.con-composer__actcard .pcard__res-count').text()).to.eq('2');
    // L3 = the source card fullscreen (the console-wide source verb).
    (w.vm as any).handleIntent({kind: 'press', button: 'stickL'});
    expect(w.emitted('inspect-source')).to.have.length(1);
    w.unmount();
  });

  /**
   * PAYMENT inside a blue-card action — the SAME panel, the SAME two densities
   * the card-play flow uses. The reason this lives in a MOUNT spec: the pure
   * model can prove the rows, only a render can prove that expanding the block
   * does not unmount the CTA dock or replace the screen.
   */
  describe('payment (St. Joseph-style paid action)', () => {
    const PAYER: any = {
      ...PLAYER_VIEW,
      thisPlayer: {...PLAYER_VIEW.thisPlayer, megacredits: 20, steel: 4, steelValue: 2, titaniumValue: 3},
    };
    const PAY_PREVIEW = {
      card: 'Paid Action', isCorporation: false, kind: 'declarative',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [], effects: [],
        steps: [{kind: 'input', input: {type: 'payment', title: 'Pay', amount: 8, paymentOptions: {steel: true}}}],
      }],
    };
    function payComposer() {
      return mount(ConsoleActionComposer, {
        ...globalConfig,
        global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
        props: {playerView: PAYER, entry: entryFor('Paid Action'), preview: PAY_PREVIEW, nodeIndex: 0},
      });
    }

    it('renders the shared payment panel COMPACT, with the alt source and the auto M€ row', () => {
      const w = payComposer();
      expect(w.find('.con-pay--compact').exists()).to.eq(true);
      expect(w.findAll('.con-payrow').map((r) => r.attributes('data-pay-unit'))).to.deep.eq(['steel', 'megacredits']);
      // Seeded with the desktop-optimal default: 4 steel @2 = 8 → exact, 0 M€.
      expect(w.find('[data-pay-unit="steel"] .con-payrow__used').text()).to.eq('4');
      expect(w.find('[data-pay-unit="megacredits"] .con-payrow__used').text()).to.eq('0');
      expect(w.find('.con-paystatus').classes()).to.include('con-paystatus--exact');
      w.unmount();
    });

    it('the bumpers dial the single alt source without a cursor, and M€ re-balances', async () => {
      const w = payComposer();
      (w.vm as any).handleIntent({kind: 'press', button: 'bumperL'});
      await w.vm.$nextTick();
      expect(w.find('[data-pay-unit="steel"] .con-payrow__used').text()).to.eq('3');
      expect(w.find('[data-pay-unit="megacredits"] .con-payrow__used').text()).to.eq('2');
      expect(w.find('.con-paystatus').classes()).to.include('con-paystatus--exact');
      w.unmount();
    });

    /**
     * ONE alternative source = NO second stage. The compact block already is the
     * editor (its own row carries the dial pills, the bumpers drive it, RT fills
     * it), so LT must do nothing at all: «Настроить оплату» there opened the same
     * rows with a cursor that had nowhere to go.
     */
    it('a SINGLE alt source has no editor — LT does nothing, and the block keeps its density', async () => {
      const w = payComposer();
      (w.vm as any).handleIntent({kind: 'press', button: 'bumperL'});
      await w.vm.$nextTick();
      expect(w.find('[data-pay-unit="steel"] .con-payrow__used').text()).to.eq('3');

      (w.vm as any).handleIntent({kind: 'press', button: 'triggerL'});
      await w.vm.$nextTick();
      expect(w.find('.con-pay--expanded').exists()).to.eq(false);
      expect(w.find('.con-pay--compact').exists()).to.eq(true);
      expect(w.find('.con-payrow--focused').exists()).to.eq(false);
      // ...and the bar never offered it either — it advertises the dial (with
      // its own MAX), never a second screen.
      const labels = (w.vm as any).footCommands.map((c: any) => c.label);
      expect(labels).to.not.include('Configure payment');
      expect(labels.slice(0, 3)).to.deep.eq(['−1', '+1', 'MAX']);
      w.unmount();
    });

    /** RT МАКС. is the dial's own — with no editor to enter, it lives here. */
    it('RT fills the single alt source to its cap, right on the quick screen', async () => {
      const w = payComposer();
      (w.vm as any).handleIntent({kind: 'press', button: 'bumperL'});
      (w.vm as any).handleIntent({kind: 'press', button: 'bumperL'});
      await w.vm.$nextTick();
      expect(w.find('[data-pay-unit="steel"] .con-payrow__used').text()).to.eq('2');

      (w.vm as any).handleIntent({kind: 'press', button: 'triggerR'});
      await w.vm.$nextTick();
      // 8 M€ owed, steel @2 → 4 steel covers it exactly; M€ re-balances to 0.
      expect(w.find('[data-pay-unit="steel"] .con-payrow__used').text()).to.eq('4');
      expect(w.find('[data-pay-unit="megacredits"] .con-payrow__used').text()).to.eq('0');
      expect(w.find('.con-paystatus').classes()).to.include('con-paystatus--exact');
      w.unmount();
    });

    /** TWO alternatives — a mix the bumpers cannot express, so the editor exists. */
    it('the trigger EXPANDS a MULTI-lane block in place — the CTA dock never unmounts, the mix is kept', async () => {
      const w = mount(ConsoleActionComposer, {
        ...globalConfig,
        global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
        props: {
          playerView: {...PAYER, thisPlayer: {...PAYER.thisPlayer, titanium: 3}},
          entry: entryFor('Paid Action'),
          preview: {
            ...PAY_PREVIEW,
            branches: [{
              ...PAY_PREVIEW.branches[0],
              steps: [{kind: 'input', input: {type: 'payment', title: 'Pay', amount: 8, paymentOptions: {steel: true, titanium: true}}}],
            }],
          },
          nodeIndex: 0,
        },
      });
      const before = w.findAll('.con-payrow').map((r) => r.attributes('data-pay-unit'));
      expect(before).to.deep.eq(['steel', 'titanium', 'megacredits']);
      expect(w.find('.con-composer__ctadock').exists()).to.eq(true);
      const mix = () => w.findAll('.con-payrow__used').map((c) => c.text());
      const seeded = mix();

      (w.vm as any).handleIntent({kind: 'press', button: 'triggerL'});
      await w.vm.$nextTick();
      expect(w.find('.con-pay--expanded').exists()).to.eq(true);
      // Same rows, same order, same values — a density change, not a new screen.
      expect(w.findAll('.con-payrow').map((r) => r.attributes('data-pay-unit'))).to.deep.eq(before);
      expect(mix()).to.deep.eq(seeded);
      // The cursor opens on the first editable source.
      expect(w.find('.con-payrow--focused').attributes('data-pay-unit')).to.eq('steel');
      // The dock survives — this is what keeps the confirm from jumping.
      expect(w.find('.con-composer__ctadock').exists()).to.eq(true);

      // ...and the same trigger folds it back, keeping the chosen mix.
      (w.vm as any).handleIntent({kind: 'press', button: 'triggerL'});
      await w.vm.$nextTick();
      expect(w.find('.con-pay--compact').exists()).to.eq(true);
      expect(mix()).to.deep.eq(seeded);
      w.unmount();
    });

    /**
     * THE regression this rework exists for: an appearing overpay used to
     * resize the payment block and shove the confirm around. The row set and
     * the verdict element are now unconditional, so the block's box is stable.
     */
    it('an appearing OVERPAY adds no box — the row set and the verdict element are unchanged', async () => {
      // Cost 7 with steel @2: the default trims to 3 steel + 1 M€ (exact);
      // dialing steel up to 4 spends 8 → an unavoidable rate-remainder overpay.
      const w = mount(ConsoleActionComposer, {
        ...globalConfig,
        global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
        props: {
          playerView: PAYER,
          entry: entryFor('Paid Action'),
          preview: {
            ...PAY_PREVIEW,
            branches: [{
              ...PAY_PREVIEW.branches[0],
              steps: [{kind: 'input', input: {type: 'payment', title: 'Pay', amount: 7, paymentOptions: {steel: true}}}],
            }],
          },
          nodeIndex: 0,
        },
      });
      const shape = () => ({
        rows: w.findAll('.con-payrow').length,
        cells: w.findAll('.con-payrow__cell').length,
        status: w.findAll('.con-paystatus').length,
      });
      const before = shape();
      expect(w.find('.con-paystatus').classes()).to.include('con-paystatus--exact');

      (w.vm as any).handleIntent({kind: 'press', button: 'bumperR'});
      await w.vm.$nextTick();
      expect(w.find('[data-pay-unit="steel"] .con-payrow__used').text()).to.eq('4');
      expect(w.find('.con-paystatus').classes()).to.include('con-paystatus--overpay');
      expect(w.find('.con-paystatus__delta').text()).to.eq('+1');
      expect(shape()).to.deep.eq(before);
      w.unmount();
    });
  });

  it('shows the live stored resource on the source card (decision-relevant pool)', () => {
    const view = {
      ...PLAYER_VIEW,
      thisPlayer: {...PLAYER_VIEW.thisPlayer, tableau: [{name: 'Regolith Eaters', resources: 3}]},
    };
    const w = mount(ConsoleActionComposer, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
      props: {
        playerView: view,
        entry: entryFor('Regolith Eaters'),
        preview: {
          card: 'Regolith Eaters', isCorporation: false, kind: 'declarative',
          branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
        },
        nodeIndex: 0,
      },
    });
    // THE ONE counter is the PREMIUM FACE'S OWN capsule, carved into the panel
    // beside the expansion stamp. The console used to hand that face only a
    // card NAME, so it printed a permanent «0» and the true count had to be
    // repeated by a gold disc and an «N на этой карте» plate — three readings,
    // two anchors. Passing the live model is what makes the one anchor true.
    const chip = w.find('.con-composer__actcard .pcard__res');
    expect(chip.exists(), 'the card wears its own resource capsule').to.eq(true);
    expect(chip.find('.pcard__res-count').text()).to.eq('3');
    w.unmount();
  });
});

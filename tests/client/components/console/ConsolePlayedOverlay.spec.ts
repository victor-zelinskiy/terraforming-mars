import {expect} from 'chai';
import {mount, VueWrapper} from '@vue/test-utils';
import ConsolePlayedOverlay from '@/client/components/console/played/ConsolePlayedOverlay.vue';
import {consolePlayedUi, resetConsolePlayedUi} from '@/client/console/consolePlayedUi';
import {playedCategoryState, resetPlayedCategoryView} from '@/client/console/played/playedCategoryView';
import {consoleCardZoom, closeConsoleCardZoom, consoleZoomProvenance} from '@/client/console/consoleCardZoom';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Color} from '@/common/Color';
import {getCards, byType} from '@/client/cards/ClientCardManifest';
import {GamepadIntent, SemanticButton} from '@/client/gamepad/gamepadPollModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

function player(color: Color, name: string, tableau: Array<CardName>): PublicPlayerModel {
  return {color, name, tableau: tableau.map((n) => ({name: n}))} as unknown as PublicPlayerModel;
}

function press(button: SemanticButton): GamepadIntent {
  return {kind: 'press', button};
}

const RED_TABLEAU = [
  CardName.THARSIS_REPUBLIC, // corporation
  CardName.ALLIED_BANK, // prelude
  CardName.PREDATORS, // active
  CardName.TREES, // automated
  CardName.ASTEROID, // event
  CardName.BIG_ASTEROID, // event
];

/** Mount the table and let its body be measured: the content renders on the tick after `mounted()` (PL-625 — in a
 *  browser that is still before the first paint). */
async function make(players: Array<PublicPlayerModel>): Promise<VueWrapper<InstanceType<typeof ConsolePlayedOverlay>>> {
  const wrapper = mountTable(players);
  await wrapper.vm.$nextTick();
  return wrapper;
}

function mountTable(players: Array<PublicPlayerModel>): VueWrapper<InstanceType<typeof ConsolePlayedOverlay>> {
  return mount(ConsolePlayedOverlay, {
    props: {players, thisPlayerColor: 'red' as Color},
    global: {
      mocks: {$t: (s: string) => s},
      stubs: {
        ConsolePlayedCardLite: true,
        ConsolePlayedCategoryView: true,
      },
    },
  });
}

/** JSDOM has no layout: the table's BODY reports the overlay's old fallback box (1400 × 620) — the table renders its
 *  content only once the body is measured (PL-625), exactly as a browser does after `mounted()`. */
const BODY_BOX = {w: 1400, h: 620};
type OffsetKey = 'offsetWidth' | 'offsetHeight';
const offsetDescriptors = new Map<OffsetKey, PropertyDescriptor | undefined>();
function stubBodyBox(): void {
  for (const key of ['offsetWidth', 'offsetHeight'] as Array<OffsetKey>) {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, key);
    offsetDescriptors.set(key, original);
    Object.defineProperty(HTMLElement.prototype, key, {
      configurable: true,
      get(this: HTMLElement) {
        if (this.classList.contains('con-played__body')) {
          return key === 'offsetWidth' ? BODY_BOX.w : BODY_BOX.h;
        }
        return original?.get?.call(this) ?? 0;
      },
    });
  }
}
function restoreBodyBox(): void {
  for (const [key, original] of offsetDescriptors) {
    if (original !== undefined) {
      Object.defineProperty(HTMLElement.prototype, key, original);
    }
  }
  offsetDescriptors.clear();
}

describe('ConsolePlayedOverlay (category navigation)', () => {
  before(stubBodyBox);
  after(restoreBodyBox);
  afterEach(() => {
    resetConsolePlayedUi();
    resetPlayedCategoryView();
  });

  it('renders the tableau zones + the face-down events pile with its count', async () => {
    const wrapper = await make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    expect(wrapper.find('.con-played__family--corporation').exists()).to.be.true;
    expect(wrapper.find('.con-played__family--prelude').exists()).to.be.true;
    expect(wrapper.find('.con-played__family--active').exists()).to.be.true;
    expect(wrapper.find('.con-played__family--automated').exists()).to.be.true;
    expect(wrapper.find(`[data-played-key="${CardName.THARSIS_REPUBLIC}"]`).exists()).to.be.true;
    // Events are ONE face-down pile, never individual cards on the main screen.
    expect(wrapper.find('.con-played__events-count').text()).to.eq('2');
    wrapper.unmount();
  });

  it('the focusable objects are CATEGORY blocks only — no per-card cursor exists', async () => {
    const wrapper = await make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    expect(wrapper.vm.focusCategory).to.eq('corporation');
    expect(consolePlayedUi.focusCategory).to.eq('corporation');
    // The retired per-card focus API is gone from the component surface.
    expect((wrapper.vm as unknown as {focusKey?: unknown}).focusKey).to.be.undefined;
    expect(wrapper.findAll('[data-played-cat]').length).to.eq(5);
    // No slot ever renders the per-card focused state on the table.
    expect(wrapper.find('.con-played__slot--focused').exists()).to.be.false;
    wrapper.unmount();
  });

  it('B closes (emit) — the shell owns the actual open flag', async () => {
    const wrapper = await make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    wrapper.vm.handleIntent(press('back'));
    expect(wrapper.emitted('close')).to.have.length(1);
    wrapper.unmount();
  });

  it('A on a focused category ARMS the physical episode (opening state + names)', async () => {
    const wrapper = await make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    wrapper.vm.focusCategory = 'events';
    await wrapper.vm.$nextTick();
    wrapper.vm.handleIntent(press('confirm'));
    await wrapper.vm.$nextTick();
    expect(playedCategoryState.phase).to.eq('opening');
    expect(playedCategoryState.category).to.eq('events');
    expect(playedCategoryState.names).to.deep.eq([CardName.ASTEROID, CardName.BIG_ASTEROID]);
    // ANTI-BLINK: the table cards are NOT held yet — the hold flips only in
    // the same turn the director paints the proxies over them.
    expect(playedCategoryState.holdCards).to.be.false;
    expect(wrapper.find('.con-played__slot--events-out').exists()).to.be.false;
    // The category view is mounted for the episode.
    expect(wrapper.findComponent({name: 'ConsolePlayedCategoryView'}).exists()).to.be.true;
    // The proxy-paint turn (simulated — the view is stubbed here): the
    // events stack renders as the held ghost (the cards are away).
    playedCategoryState.holdCards = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-played__slot--events-out').exists()).to.be.true;
    expect(wrapper.find('.con-played__family--out').exists()).to.be.true;
    wrapper.unmount();
  });

  it('face-up categories hold their slots while lifted (one physical copy)', async () => {
    // TWO active cards: a one-card zone takes the smart fullscreen shortcut
    // (no category episode at all) — the hold contract needs a real grid.
    const wrapper = await make([player('red' as Color, 'Вы', [...RED_TABLEAU, CardName.BIRDS])]);
    wrapper.vm.openCategory('active');
    // The proxy-paint turn (view stubbed): the director spawns the FLIGHTS
    // and flips the hold in the same synchronous turn. With bounded flights
    // the visibility hold covers exactly the FLOWN cards during a transition.
    playedCategoryState.flights = playedCategoryState.names.map((name, i) => ({
      id: i + 1, name, index: i, faceDown: false,
    }));
    playedCategoryState.holdCards = true;
    await wrapper.vm.$nextTick();
    const slot = wrapper.find(`[data-played-key="${CardName.PREDATORS}"]`);
    expect(slot.classes()).to.include('con-played__slot--held-out');
    // The settled OPEN phase keeps the table held even after the handoff
    // releases the modal grid (holdCards false — the cards live in the view).
    playedCategoryState.holdCards = false;
    playedCategoryState.flights = [];
    playedCategoryState.phase = 'open';
    await wrapper.vm.$nextTick();
    expect(wrapper.find(`[data-played-key="${CardName.PREDATORS}"]`).classes()).to.include('con-played__slot--held-out');
    wrapper.unmount();
  });

  it('a GROUNDED card (beyond the flight budget) dissolves in place, never a visibility hold', async () => {
    const wrapper = await make([player('red' as Color, 'Вы', [...RED_TABLEAU, CardName.BIRDS])]);
    wrapper.vm.openCategory('active');
    // The bounded spawn: PREDATORS flies, BIRDS is grounded.
    playedCategoryState.flights = [{id: 1, name: CardName.PREDATORS, index: 0, faceDown: false}];
    playedCategoryState.groundedNames = [CardName.BIRDS];
    playedCategoryState.holdCards = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(`[data-played-key="${CardName.PREDATORS}"]`).classes()).to.include('con-played__slot--held-out');
    const grounded = wrapper.find(`[data-played-key="${CardName.BIRDS}"]`);
    expect(grounded.classes()).to.include('con-played__slot--grounded');
    expect(grounded.classes()).to.not.include('con-played__slot--held-out');
    // At the settled OPEN phase everything is away (visibility hold covers all).
    playedCategoryState.holdCards = false;
    playedCategoryState.flights = [];
    playedCategoryState.phase = 'open';
    await wrapper.vm.$nextTick();
    expect(wrapper.find(`[data-played-key="${CardName.BIRDS}"]`).classes()).to.include('con-played__slot--held-out');
    wrapper.unmount();
  });

  it('LB/RB cycles the viewed player; focus reseeds and any open category folds', async () => {
    const bot = player('green' as Color, 'MarsBot', [CardName.CREDICOR, CardName.BIRDS]);
    const wrapper = await make([player('red' as Color, 'Вы', RED_TABLEAU), bot]);
    expect(consolePlayedUi.canCyclePlayer).to.be.true;
    wrapper.vm.openCategory('active');
    await wrapper.vm.$nextTick();
    wrapper.vm.handleIntent(press('bumperR'));
    await wrapper.vm.$nextTick();
    // The category view delegates input while up — the cycle only runs from
    // the table, so re-issue after the fold.
    if (wrapper.vm.viewedPlayer.name !== 'MarsBot') {
      wrapper.vm.cycleViewedPlayer(1);
      await wrapper.vm.$nextTick();
    }
    expect(wrapper.vm.viewedPlayer.name).to.eq('MarsBot');
    expect(playedCategoryState.phase).to.eq('closed');
    expect(wrapper.vm.focusCategory).to.eq('corporation');
    wrapper.unmount();
  });

  it('an empty tableau shows the calm void state, not a bare panel', async () => {
    const wrapper = await make([player('red' as Color, 'Вы', [])]);
    expect(wrapper.find('.con-played__void').exists()).to.be.true;
    expect(consolePlayedUi.focusCategory).to.eq('');
    wrapper.unmount();
  });

  it('a corporation-only tableau shows the quiet "no projects" shelf; the events seat is a prepared place, not a zone', async () => {
    const wrapper = await make([player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC])]);
    expect(wrapper.find('.con-played__none').exists()).to.be.true;
    expect(wrapper.find('[data-played-cat="events"]').exists()).to.be.false;
    expect(wrapper.find('.con-played__seat-place--events').exists()).to.be.true;
    // A prelude is a SHELF card (the identity column is the corporation and the events).
    const withPrelude = await make([player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC, CardName.ALLIED_BANK])]);
    expect(withPrelude.find('.con-played__none').exists()).to.be.false;
    expect(withPrelude.find('[data-played-run="prelude"]').exists()).to.be.true;
    withPrelude.unmount();
    wrapper.unmount();
  });

  it('a data update that removes the focused category reseeds focus (undo / reconnect)', async () => {
    const wrapper = await make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    wrapper.vm.focusCategory = 'automated';
    await wrapper.vm.$nextTick();
    await wrapper.setProps({players: [player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC])]});
    expect(wrapper.vm.focusCategory).to.eq('corporation');
    wrapper.unmount();
  });

  it('the open category emptying out entirely folds the view (undo safety)', async () => {
    const wrapper = await make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    wrapper.vm.openCategory('events');
    await wrapper.vm.$nextTick();
    await wrapper.setProps({players: [player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC])]});
    expect(playedCategoryState.phase).to.eq('closed');
    wrapper.unmount();
  });

  // ── THE SHELF ALBUM's pages (TR65 — the table is a table) ─────────────
  describe('the shelf album — strict pages, the focus derives the page, LT/RT turn it', () => {
    // 1 corporation + 9 active + 3 automated → at the fallback box (4×2 shelves): [active 0–3][active 4–7] · [active 8 + automated ×3]
    const ACTIVE = getCards(byType(CardType.ACTIVE)).slice(0, 9).map((c) => c.name);
    const AUTOMATED = getCards(byType(CardType.AUTOMATED)).slice(0, 3).map((c) => c.name);
    const TABLEAU = [CardName.THARSIS_REPUBLIC, ...ACTIVE, ...AUTOMATED];

    it('mounts the active page and its neighbours only; the identity column stands on every page', async () => {
      const wrapper = await make([player('red' as Color, 'Вы', TABLEAU)]);
      expect(wrapper.vm.pageCount).to.eq(2);
      expect(wrapper.vm.activePage).to.eq(0);
      expect(wrapper.findAll('.con-played__page').length).to.eq(2);
      expect(wrapper.find(`.con-played__identity [data-played-key="${CardName.THARSIS_REPUBLIC}"]`).exists()).to.be.true;
      expect(wrapper.find('.con-played').attributes('data-played-pages')).to.eq('2');
      expect(consolePlayedUi.pageCount).to.eq(2);
      wrapper.unmount();
    });

    it('a zone\'s first run carries its TOTAL, a continuation its RANGE; one navigation target per zone per page', async () => {
      const wrapper = await make([player('red' as Color, 'Вы', TABLEAU)]);
      const page0 = wrapper.find('[data-played-page-index="0"]');
      const runs0 = page0.findAll('.con-played__run');
      expect(runs0.length).to.eq(2);
      expect(runs0[0].find('.con-played__caption-count').text()).to.eq('9');
      expect(runs0[1].find('.con-played__caption-count').text()).to.eq('5–8');
      expect(page0.findAll('[data-played-cat="active"]').length, 'one target for the zone on the page').to.eq(1);
      const page1 = wrapper.find('[data-played-page-index="1"]');
      expect(page1.findAll('.con-played__run').map((r) => r.attributes('data-played-run'))).to.deep.eq(['active', 'automated']);
      expect(page1.find('[data-played-run="automated"] .con-played__caption-count').text()).to.eq('3');
      wrapper.unmount();
    });

    it('focusing a zone on another page TURNS the album to it; LT/RT turn explicitly and hand the cursor on', async () => {
      const wrapper = await make([player('red' as Color, 'Вы', TABLEAU)]);
      wrapper.vm.focusCategory = 'automated';
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.activePage, 'automated lies on page 2').to.eq(1);
      wrapper.vm.handleIntent(press('triggerL'));
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.activePage).to.eq(0);
      expect(wrapper.vm.focusCategory, 'the cursor lands on the page\'s last zone').to.eq('active');
      wrapper.vm.handleIntent(press('triggerR'));
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.activePage).to.eq(1);
      expect(wrapper.vm.focusCategory, 'active continues on page 2 — the cursor keeps it').to.eq('active');
      wrapper.vm.handleIntent(press('triggerR'));
      expect(wrapper.vm.activePage, 'the last page is the edge').to.eq(1);
      wrapper.unmount();
    });

    it('the landing card\'s page: an incoming shelf card turns the album to the page it lands on', async () => {
      const wrapper = await make([player('red' as Color, 'Вы', TABLEAU)]);
      const incoming = getCards(byType(CardType.AUTOMATED))[3].name;
      await wrapper.setProps({heroIncoming: {name: incoming}, heroActive: true});
      expect(wrapper.vm.activePage).to.eq(1);
      expect(wrapper.find(`[data-played-page-index="1"] [data-played-key="${incoming}"]`).classes()).to.include('con-played__slot--incoming');
      // The landing never slides — the hero scene mounts the landing card's page ALONE (PL-625).
      expect(wrapper.findAll('[data-played-page-index]').map((w) => w.attributes('data-played-page-index'))).to.deep.eq(['1']);
      wrapper.unmount();
    });

    it('the table renders its content only against a MEASURED body — never a fallback plan first (PL-625)', async () => {
      restoreBodyBox();
      try {
        const wrapper = await make([player('red' as Color, 'Вы', TABLEAU)]);
        expect(wrapper.find('.con-played__body').exists()).to.be.true;
        expect(wrapper.find('.con-played__table').exists(), 'no faces before the body has a size').to.be.false;
        wrapper.unmount();
      } finally {
        stubBodyBox();
      }
    });

    it('a card on an unmounted page flies from its PACKET place beyond the album\'s edge (never from nowhere)', async () => {
      const BIG = [CardName.THARSIS_REPUBLIC, ...getCards(byType(CardType.ACTIVE)).slice(0, 30).map((c) => c.name)];
      const wrapper = await make([player('red' as Color, 'Вы', BIG)]);
      expect(wrapper.vm.pageCount).to.be.greaterThan(3);
      const far = getCards(byType(CardType.ACTIVE))[29].name;
      // JSDOM has no layout: the album box reads 0 → the table honestly answers undefined (the view then lets the
      // card simply appear); the derivation of WHICH side is pinned below through the page lookup.
      expect(wrapper.vm.offPageRect(far)).to.eq(undefined);
      expect(wrapper.vm.pageOfCard(far)).to.be.greaterThan(wrapper.vm.activePage + 1);
      wrapper.unmount();
    });
  });

  // ── the hero scene (play-animation mode) ──────────────────────────────
  describe('hero mode (the played-card landing scene)', () => {
    it('reserves a HIDDEN slot for a face-up incoming card; reveal turns it real + focuses its family', async () => {
      const wrapper = await make([player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC, CardName.PREDATORS])]);
      await wrapper.setProps({heroIncoming: {name: CardName.TREES}, heroActive: true});
      // The +1 layout is already FINAL: the synthetic slot exists, hidden.
      const slot = wrapper.find(`[data-played-key="${CardName.TREES}"]`);
      expect(slot.exists()).to.be.true;
      expect(slot.classes()).to.include('con-played__slot--incoming');
      // The header count stays honest until the landing commit.
      expect(wrapper.find('.con-played__total b').text()).to.eq('2');
      await wrapper.setProps({heroRevealed: true});
      expect(wrapper.find(`[data-played-key="${CardName.TREES}"]`).classes()).to.not.include('con-played__slot--incoming');
      expect(wrapper.find('.con-played__total b').text()).to.eq('3');
      expect(wrapper.vm.focusCategory).to.eq('automated');
      wrapper.unmount();
    });

    it('an incoming EVENT reserves the pile: counter ticks only after the reveal', async () => {
      const wrapper = await make([player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC])]);
      await wrapper.setProps({heroIncoming: {name: CardName.ASTEROID}, heroActive: true});
      // First-ever event: the pile is real geometry, but reserved-hidden.
      expect(wrapper.find('.con-played__family--event').exists()).to.be.true;
      expect(wrapper.find('.con-played__pile--reserved').exists()).to.be.true;
      expect(wrapper.find('.con-played__events-count').text()).to.eq('0');
      await wrapper.setProps({heroRevealed: true});
      expect(wrapper.find('.con-played__pile--reserved').exists()).to.be.false;
      expect(wrapper.find('.con-played__events-count').text()).to.eq('1');
      expect(wrapper.vm.focusCategory).to.eq('events');
      wrapper.unmount();
    });

    it('the synthetic +1 never duplicates once the commit carries the card', async () => {
      const wrapper = await make([player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC])]);
      await wrapper.setProps({heroIncoming: {name: CardName.TREES}, heroActive: true, heroRevealed: true});
      await wrapper.setProps({players: [player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC, CardName.TREES])]});
      expect(wrapper.findAll(`[data-played-key="${CardName.TREES}"]`).length).to.eq(1);
      wrapper.unmount();
    });

    it('the hero scene forces the viewer seat, folds a category and inerts clicks', async () => {
      const bot = player('green' as Color, 'MarsBot', [CardName.CREDICOR]);
      const wrapper = await make([player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC, CardName.PREDATORS]), bot]);
      wrapper.vm.cycleViewedPlayer(1);
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.viewedPlayer.name).to.eq('MarsBot');
      await wrapper.setProps({heroIncoming: {name: CardName.TREES}, heroActive: true});
      expect(wrapper.vm.viewedPlayer.name).to.eq('Вы');
      expect(playedCategoryState.phase).to.eq('closed');
      // A mouse click mid-scene neither refocuses nor opens a category.
      wrapper.vm.onFamilyPress('active');
      expect(playedCategoryState.phase).to.eq('closed');
      wrapper.unmount();
    });
  });

  // ── SMART OPEN: a one-card zone skips the grid ────────────────────────
  describe('smart category open (a lone card goes straight to fullscreen)', () => {
    afterEach(() => closeConsoleCardZoom());

    it('a ONE-card zone opens the fullscreen directly — no category episode', async () => {
      const wrapper = await make([player('red' as Color, 'Вы', RED_TABLEAU)]);
      // Corporation holds exactly one card in this tableau.
      wrapper.vm.openCategory('corporation');
      expect(playedCategoryState.phase).to.eq('closed'); // the grid never opened
      expect(consoleCardZoom.card?.name).to.eq(CardName.THARSIS_REPUBLIC);
      expect(consoleCardZoom.cards).to.have.length(1);
      // Lifted PHYSICALLY out of its table slot (returns into it on close).
      expect(consoleCardZoom.origin.kind).to.eq('physical');
      // …and it carries the provenance plate.
      expect(consoleZoomProvenance()?.category).to.eq('Corporation');
      wrapper.unmount();
    });

    it('a MULTI-card zone still opens the category grid (never the shortcut)', async () => {
      const wrapper = await make([player('red' as Color, 'Вы', RED_TABLEAU)]);
      wrapper.vm.openCategory('events'); // two events
      expect(playedCategoryState.phase).to.eq('opening');
      expect(consoleCardZoom.card).to.be.undefined;
      wrapper.unmount();
    });

    it('the plate follows the browsed card: seat · zone · N of M', async () => {
      const wrapper = await make([player('red' as Color, 'Вы', RED_TABLEAU)]);
      // The category view is stubbed here, so exercise the resolver the
      // overlay hands it (the same one both hosts use).
      const byName = wrapper.vm.provenanceByName;
      expect(byName(CardName.ASTEROID)).to.deep.include({seatName: 'Вы', category: 'Events', isBot: false});
      expect(byName(CardName.ASTEROID)?.ordinal).to.deep.eq({n: 1, total: 2});
      expect(byName(CardName.BIG_ASTEROID)?.ordinal).to.deep.eq({n: 2, total: 2});
      wrapper.unmount();
    });
  });

  // ── honest caption counts through the standalone hero scene ───────────
  describe('honest family caption counts (hero scene)', () => {
    it('captions read the PRE-play truth until the reveal, then tick at the dock', async () => {
      const wrapper = await make([player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC, CardName.PREDATORS, CardName.TREES])]);
      await wrapper.setProps({heroIncoming: {name: CardName.BIRDS}, heroActive: true});
      const active = wrapper.find('.con-played__family--active');
      // One active card lies there; the reserved slot already exists.
      expect(active.find('.con-played__caption-count').text()).to.eq('1');
      expect(wrapper.find(`[data-played-key="${CardName.BIRDS}"]`).classes()).to.include('con-played__slot--incoming');
      await wrapper.setProps({heroRevealed: true});
      expect(wrapper.find('.con-played__family--active .con-played__caption-count').text()).to.eq('2');
      wrapper.unmount();
    });
  });

  // ── the MarsBot seat + the embedded workspace mode ────────────────────
  describe('MarsBot seat + embedded (Information Workspace) mode', () => {
    const AUTOMA = {playedPile: [CardName.TREES, CardName.PREDATORS, CardName.ASTEROID]} as unknown as
      import('@/common/models/MarsBotModel').MarsBotModel;

    function botSeat(): PublicPlayerModel {
      return {color: 'green' as Color, name: 'MarsBot', isMarsBot: true, tableau: []} as unknown as PublicPlayerModel;
    }

    function makeEmbedded(forcedColor: Color) {
      return mount(ConsolePlayedOverlay, {
        props: {
          players: [player('red' as Color, 'Вы', RED_TABLEAU), botSeat()],
          thisPlayerColor: 'red' as Color,
          automa: AUTOMA, embedded: true, forcedColor,
        },
        global: {
          mocks: {$t: (s: string) => s},
          stubs: {ConsolePlayedCardLite: true, ConsolePlayedCategoryView: true},
        },
      });
    }

    it('the bot seat reads its PUBLIC played pile (its tableau is empty)', async () => {
      const wrapper = makeEmbedded('green' as Color);
      await wrapper.vm.$nextTick();
      // TREES → automated, PREDATORS → active, ASTEROID → the events pile.
      expect(wrapper.find('.con-played__family--automated').exists()).to.be.true;
      expect(wrapper.find('.con-played__family--active').exists()).to.be.true;
      expect(wrapper.find('.con-played__events-count').text()).to.eq('1');
      // The embedded table has no head of its own (the workspace's crumb is the identity) — the count is the model's.
      expect(wrapper.vm.totalCount).to.eq(3);
      wrapper.unmount();
    });

    it('the bot seat carries the honest provenance line; a human seat does not', async () => {
      const wrapper = makeEmbedded('green' as Color);
      expect(wrapper.find('.con-played__provenance').exists()).to.be.true;
      await wrapper.setProps({forcedColor: 'red' as Color});
      expect(wrapper.find('.con-played__provenance').exists()).to.be.false;
      wrapper.unmount();
    });

    it('embedded: the seat is CONTROLLED (forcedColor) — internal cycling is inert', async () => {
      const wrapper = makeEmbedded('green' as Color);
      wrapper.vm.cycleViewedPlayer(1);
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.viewedPlayer.isMarsBot).to.be.true;
      // The workspace header owns the identity — the table's own crumb yields.
      expect(wrapper.find('.con-played__head').exists()).to.be.false;
      expect(wrapper.find('.con-played').classes()).to.include('con-played--embedded');
      wrapper.unmount();
    });

    it('a forcedColor switch folds an open category (the seat changed under it)', async () => {
      const wrapper = makeEmbedded('red' as Color);
      wrapper.vm.openCategory('events'); // multi-card: a real category episode
      expect(playedCategoryState.phase).to.eq('opening');
      await wrapper.setProps({forcedColor: 'green' as Color});
      expect(playedCategoryState.phase).to.eq('closed');
      wrapper.unmount();
    });

    it('standalone (board home): the bot seat cycles in and shows the SAME premium table', async () => {
      const wrapper = mount(ConsolePlayedOverlay, {
        props: {
          players: [player('red' as Color, 'Вы', RED_TABLEAU), botSeat()],
          thisPlayerColor: 'red' as Color,
          automa: AUTOMA,
        },
        global: {
          mocks: {$t: (s: string) => s},
          stubs: {ConsolePlayedCardLite: true, ConsolePlayedCategoryView: true},
        },
      });
      wrapper.vm.cycleViewedPlayer(1);
      await wrapper.vm.$nextTick();
      // The seat is the crumb's SUBJECT, through the LOCALIZED display-name
      // resolver (participantDisplayName — «Бот» in the RU UI, never a raw fallback).
      expect(wrapper.find('.con-played__head').exists()).to.be.true;
      expect(wrapper.vm.viewedDisplayName).to.not.eq('');
      expect(wrapper.find('.con-played__total b').text()).to.eq('3');
      expect(wrapper.find('.con-played__provenance').exists()).to.be.true;
      wrapper.unmount();
    });
  });
});

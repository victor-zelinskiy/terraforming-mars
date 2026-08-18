import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsolePlayedReceivingStage from '@/client/components/console/played/ConsolePlayedReceivingStage.vue';
import {armPlayedHero, abortPlayedHero, playedHeroState} from '@/client/console/played/consolePlayedHero';
import {cardResourceLandings, resetCardResourceLandings} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {claimPlayOutcome} from '@/client/console/played/consolePlayOutcomeClaim';
import {resetWorkspaceOutcome} from '@/client/console/consoleWorkspaceOutcome';
import {descendWorkspaceFrame, pushWorkspaceFrame, resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';

function view(tableau: Array<CardName>, others: Array<{color: Color, name: string, tableau: Array<CardName>}> = []): PlayerViewModel {
  const me = {color: 'red' as Color, name: 'Вы', tableau: tableau.map((n) => ({name: n}))};
  return {
    thisPlayer: me,
    players: [me, ...others.map((o) => ({...o, tableau: o.tableau.map((n) => ({name: n}))}))],
    game: {automa: undefined},
  } as unknown as PlayerViewModel;
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function make(v: PlayerViewModel) {
  return mount(ConsolePlayedReceivingStage, {
    props: {playerView: v},
    global: {
      mocks: {$t: (s: string) => s},
      stubs: {ConsolePlayedCardLite: true},
    },
  });
}

describe('ConsolePlayedReceivingStage (the receiving & effect resolution stage)', () => {
  // Module state is BUNDLE-SHARED under mochapack: a leaked claim / frame
  // would change what every later spec's workspace believes it is holding.
  afterEach(async () => {
    abortPlayedHero();
    resetWorkspaceOutcome();
    resetWorkspaceStack();
    resetCardResourceLandings();
    await settle(5);
  });

  /** The hand workspace, descended into a play — the claim's home. */
  function standPlayFrame(card: CardName): void {
    pushWorkspaceFrame({
      kind: 'hand', subject: '', stage: '', phase: 'browse',
      serves: ['projectCard'], anchor: {type: 'always'},
    });
    descendWorkspaceFrame('hand', card, 'Playing', {type: 'cardInHand', card});
  }

  /**
   * THE COST CEILING — the user-facing budget of this whole surface: however
   * deep the tableau grows, the scene mounts the CAP (strips + front + one
   * head band per family), never the count. 100 cards and 20 must produce
   * the same order of DOM.
   */
  it('a 100-card tableau mounts a BOUNDED scene — the cost is the cap, never the count', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    playedHeroState.revealed = true;
    const names = Object.values(CardName).slice(0, 120) as Array<CardName>;
    const wrapper = make(view(names));
    await wrapper.vm.$nextTick();
    const faces = wrapper.findAllComponents({name: 'ConsolePlayedCardLite'});
    // ≤ 5 strips + prev + front + ≤ 5 family head bands (+ the emergence
    // layer would be one more) — the ceiling, independent of the 120 cards.
    expect(faces.length, 'mounted faces stay at the cap').to.be.at.most(12);
    expect(wrapper.findAll('[data-recv-strip]').length).to.be.at.most(6);
    expect(wrapper.element.querySelectorAll('*').length,
      'the scene\'s DOM is bounded by design').to.be.lessThan(420);
    wrapper.unmount();
  });

  it('is a SPECIALIZED scene — never the embedded overview layout', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    const wrapper = make(view([CardName.THARSIS_REPUBLIC, CardName.PREDATORS, CardName.BUSHES]));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-played').exists()).to.be.false;
    expect(wrapper.find('.con-played--embedded').exists()).to.be.false;
    // The destination (automated: BUSHES lies there) is the centre stack…
    expect(wrapper.find('.con-recv__dest').exists()).to.be.true;
    expect(wrapper.find('.con-recv__stack').exists()).to.be.true;
    // …and the other families are compact piles, never full columns.
    const minis = wrapper.findAll('.con-recv__mini');
    expect(minis.length).to.eq(2); // corporation + active
    expect(wrapper.find('.con-recv__mini .con-recv__mini-pile').exists()).to.be.true;
    expect(wrapper.find('.con-recv__mini .con-recv__mini-band').exists()).to.be.true;
    wrapper.unmount();
  });

  it('the SHELF is one row in canonical family order — the destination stands INLINE in its own slot', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    // corp + active + automated(dest) + events — the dest slot sits BETWEEN
    // active and events, exactly where the family lives on the table.
    const wrapper = make(view([CardName.THARSIS_REPUBLIC, CardName.PREDATORS, CardName.BUSHES, CardName.ASTEROID]));
    await wrapper.vm.$nextTick();
    const row = wrapper.find('.con-recv__row');
    expect(row.exists()).to.be.true;
    const slots = row.element.children;
    const kinds = Array.from(slots).map((el) =>
      el.classList.contains('con-recv__dest') ? 'dest' : el.getAttribute('data-recv-mini'));
    expect(kinds).to.deep.eq(['corporation', 'active', 'dest', 'events']);
    // Captions live in the fixed lane UNDER every pile — one grammar.
    expect(wrapper.find('.con-recv__dest .con-recv__caption').exists()).to.be.true;
    expect(wrapper.findAll('.con-recv__mini-caption').length).to.eq(3);
    wrapper.unmount();
  });

  it('an EVENTS mini is the sleeve\'s own top band — an aspect-true crop, never a stretched back', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    const wrapper = make(view([CardName.BUSHES, CardName.ASTEROID]));
    await wrapper.vm.$nextTick();
    const events = wrapper.find('[data-recv-mini="events"]');
    expect(events.exists()).to.be.true;
    expect(events.find('.con-recv__mini-band--sleeve').exists()).to.be.true;
    // The face-down pile mounts NO stretched `.con-card-back` box and no face.
    expect(events.find('.con-card-back').exists()).to.be.false;
    expect(events.findComponent({name: 'ConsolePlayedCardLite'}).exists()).to.be.false;
    wrapper.unmount();
  });

  it('lays out the FINAL silhouette from the first frame: front anchor reserved, previous top open', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    const wrapper = make(view([CardName.BUSHES, CardName.GRASS]));
    await wrapper.vm.$nextTick();
    const front = wrapper.find('[data-recv-front]');
    expect(front.exists()).to.be.true;
    // Pre-dock: the anchor is EMPTY room (no card, no data-played-key yet).
    expect(front.attributes('data-played-key')).to.be.undefined;
    expect(front.find('.con-recv__face').exists()).to.be.false;
    // The previous top lies OPEN (full face) on its future strip.
    const prev = wrapper.find('.con-recv__strip--prev');
    expect(prev.attributes('data-recv-strip')).to.eq(CardName.GRASS);
    expect(prev.findComponent({name: 'ConsolePlayedCardLite'}).props('peek')).to.be.false;
    wrapper.unmount();
  });

  it('TOP CARD HANDOFF at the reveal: the new card takes the front, the previous top becomes a strip, the count ticks', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    const wrapper = make(view([CardName.BUSHES, CardName.GRASS, CardName.TREES]));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-recv__caption-count').text()).to.eq('2'); // pre-dock truth
    playedHeroState.revealed = true;
    await wrapper.vm.$nextTick();
    const front = wrapper.find('[data-recv-front]');
    expect(front.attributes('data-played-key')).to.eq(CardName.TREES);
    expect(front.find('.con-recv__face').exists()).to.be.true;
    // The previous top is now a covered strip (peek face) — it never moved.
    expect(wrapper.find('.con-recv__strip--prev').findComponent({name: 'ConsolePlayedCardLite'}).props('peek')).to.be.true;
    expect(wrapper.find('.con-recv__caption-count').text()).to.eq('3');
    wrapper.unmount();
  });

  /**
   * THE SETTLED TABLEAU OUTLIVES ITS TRANSACTION. The hero ends when the card
   * has landed and its rewards have resolved — but a play that DREW cards is
   * not over there: the deck deals them only after this scene finishes, and
   * the workspace keeps the stage until that batch arrives. Read live, the
   * stage would answer «nothing is arriving» in that window: the front anchor
   * would empty and the card would jump back into the strips behind it.
   */
  it('holds the settled tableau while the play\'s DRAW is still on its way', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    const wrapper = make(view([CardName.BUSHES, CardName.GRASS, CardName.TREES]));
    await wrapper.vm.$nextTick();
    playedHeroState.revealed = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-recv-front]').attributes('data-played-key')).to.eq(CardName.TREES);

    // The transaction ENDS (it clears its own state) while the workspace is
    // still holding this play's outcome — the claim is what keeps the scene.
    standPlayFrame(CardName.TREES);
    claimPlayOutcome(CardName.TREES, 1);
    playedHeroState.active = false;
    playedHeroState.phase = 'idle';
    playedHeroState.card = undefined;
    playedHeroState.revealed = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-recv-front]').attributes('data-played-key'),
      'the arrived card stays on its pile until the drawn batch relieves the stage').to.eq(CardName.TREES);
    expect(wrapper.find('.con-recv__caption-count').text()).to.eq('3');
    wrapper.unmount();
  });

  it('an EVENT destination is the face-down pile; the landed card is a back, keyed for the reward source', async () => {
    armPlayedHero(CardName.ASTEROID, true, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    const wrapper = make(view([CardName.BIG_ASTEROID]));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-recv__backpile').exists()).to.be.true;
    expect(wrapper.find('.con-recv__stack').exists()).to.be.false;
    playedHeroState.revealed = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-recv-front]').attributes('data-played-key')).to.eq(CardName.ASTEROID);
    wrapper.unmount();
  });

  it('a FOREIGN effect target brings its owner in as a prepared mini (prewarm, before anything moves)', async () => {
    armPlayedHero(CardName.LOCAL_HEAT_TRAPPING, true, {
      manualTableOpen: false, host: 'workspace',
      rewards: [{channel: 'card-resource', resource: 'animal', amount: 2, targetCard: CardName.BIRDS}],
    });
    playedHeroState.phase = 'preparing';
    const wrapper = make(view([], [{color: 'green' as Color, name: 'Соперник', tableau: [CardName.BIRDS]}]));
    await wrapper.vm.$nextTick();
    const foreign = wrapper.find('[data-recv-mini="active:green"]');
    expect(foreign.exists()).to.be.true;
    expect(foreign.find('.con-recv__mini-owner').text()).to.contain('Соперник');
    expect(foreign.find(`[data-recv-ministrip="active:green|${CardName.BIRDS}"]`).exists()).to.be.true;
    wrapper.unmount();
  });

  it('EMERGENCE: the target comes out of its strip into the fixed layer (one visual owner), and settles back', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'showing-result';
    playedHeroState.revealed = true;
    const wrapper = make(view([CardName.TARDIGRADES, CardName.BUSHES, CardName.TREES]));
    await wrapper.vm.$nextTick();
    // TARDIGRADES is an ACTIVE-family card → it lives in a mini here.
    const promise = wrapper.vm.emergeTarget(CardName.TARDIGRADES);
    await wrapper.vm.$nextTick();
    const emerged = wrapper.find('.con-recv__emerge');
    expect(emerged.exists()).to.be.true;
    expect(emerged.attributes('data-played-key')).to.eq(CardName.TARDIGRADES);
    // Its strip holds the geometry as a quiet footprint (never a collapse).
    expect(wrapper.find('.con-recv__face--away').exists()).to.be.true;
    await promise;
    await wrapper.vm.settleTarget(CardName.TARDIGRADES);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-recv__emerge').exists()).to.be.false;
    expect(wrapper.find('.con-recv__face--away').exists()).to.be.false;
    wrapper.unmount();
  });

  /**
   * «Сколько было и сколько стало» is told BY THE CARD ITSELF: the emerged
   * target renders its real stored-resource capsule, held at `committed −
   * still in flight` — so the count the player sees changes exactly at the
   * chip's touchdown (`cardResourceLandings` is bumped at the contact beat),
   * never before the flight.
   */
  it('the target\'s capsule counts committed − in-flight, and ticks at the contact', async () => {
    armPlayedHero(CardName.IMPORTED_NITROGEN, true, {
      manualTableOpen: false, host: 'workspace',
      rewards: [{channel: 'card-resource', resource: 'microbe', amount: 2, targetCard: CardName.TARDIGRADES}],
    });
    playedHeroState.phase = 'showing-result';
    playedHeroState.revealed = true;
    // The COMMITTED view already carries the +2 (5 microbes on the target).
    const v = view([CardName.BUSHES]);
    (v.thisPlayer.tableau as Array<{name: CardName, resources?: number}>).push(
      {name: CardName.TARDIGRADES, resources: 5});
    const wrapper = make(v);
    await wrapper.vm.$nextTick();
    const promise = wrapper.vm.emergeTarget(CardName.TARDIGRADES);
    await wrapper.vm.$nextTick();
    const face = wrapper.find('.con-recv__emerge').findComponent({name: 'ConsolePlayedCardLite'});
    expect((face.props('card') as {resources?: number}).resources,
      'pre-contact: the capsule still reads the pre-gain count').to.eq(3);
    // THE CONTACT — the transfer framework bumps the landing tally.
    cardResourceLandings.by = {[CardName.TARDIGRADES]: 2};
    await wrapper.vm.$nextTick();
    expect((face.props('card') as {resources?: number}).resources,
      'at the contact: the capsule ticks to the committed count').to.eq(5);
    await promise;
    await wrapper.vm.settleTarget(CardName.TARDIGRADES);
    wrapper.unmount();
  });

  it('the OPEN previous top needs no emergence — an accent marks it and releases', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'showing-result';
    playedHeroState.revealed = true;
    const wrapper = make(view([CardName.BUSHES, CardName.GRASS, CardName.TREES]));
    await wrapper.vm.$nextTick();
    const promise = wrapper.vm.emergeTarget(CardName.GRASS);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-recv__emerge').exists()).to.be.false; // no layer — already open
    expect(wrapper.find('.con-recv__strip--accent').exists()).to.be.true;
    await promise;
    await wrapper.vm.settleTarget(CardName.GRASS);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-recv__strip--accent').exists()).to.be.false;
    wrapper.unmount();
  });
});

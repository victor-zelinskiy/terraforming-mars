import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleStartPlayedDock from '@/client/components/console/ConsoleStartPlayedDock.vue';
import {armPlayedHero, abortPlayedHero, playedHeroState} from '@/client/console/played/consolePlayedHero';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';

function view(tableau: Array<CardName>): PlayerViewModel {
  const me = {color: 'red' as Color, name: 'Вы', tableau: tableau.map((n) => ({name: n}))};
  return {
    thisPlayer: me,
    players: [me],
    game: {automa: undefined},
  } as unknown as PlayerViewModel;
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function make(v: PlayerViewModel) {
  return mount(ConsoleStartPlayedDock, {
    props: {playerView: v},
    global: {
      mocks: {$t: (s: string) => s},
      stubs: {ConsolePlayedCardLite: true},
    },
  });
}

describe('ConsoleStartPlayedDock (the compact «РАЗЫГРАНО · owner» destination)', () => {
  afterEach(async () => {
    abortPlayedHero();
    await settle(5);
  });

  it('is the COMPACT destination shelf — owner line + both start families standing, never the tableau overview', () => {
    const wrapper = make(view([]));
    // Never the full «Разыграно» overview (its layout answers a different question).
    expect(wrapper.find('.con-played').exists()).to.be.false;
    // The owner line: «РАЗЫГРАНО · <owner>».
    expect(wrapper.find('.con-splayed__title').text()).to.eq('Played');
    expect(wrapper.find('.con-splayed__owner-name').text()).to.eq('Вы');
    // Both start families stand from the first frame; an empty one shows the
    // PREPARED CARD PLACE — card-shaped, real geometry, quiet inner ring.
    const corp = wrapper.find('[data-splayed-fam="corporation"]');
    const pre = wrapper.find('[data-splayed-fam="prelude"]');
    expect(corp.exists()).to.be.true;
    expect(pre.exists()).to.be.true;
    expect(corp.find('.con-splayed__top--empty .con-splayed__place-ring').exists()).to.be.true;
    expect(pre.find('.con-splayed__top--empty .con-splayed__place-ring').exists()).to.be.true;
    // Idle: nothing is inbound — no armed front anchor.
    expect(wrapper.find('[data-start-front]').exists()).to.be.false;
    // The root keeps the legacy physical address of the transfer chains.
    expect(wrapper.classes()).to.contain('con-start__played');
    wrapper.unmount();
  });

  it('RECEIVING an empty family (the corporation play): the top slot becomes the armed front anchor, fills at the reveal, the count ticks 0 → 1', async () => {
    armPlayedHero(CardName.THARSIS_REPUBLIC, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    const wrapper = make(view([]));
    await wrapper.vm.$nextTick();
    const fam = wrapper.find('[data-splayed-fam="corporation"]');
    expect(fam.classes()).to.contain('con-splayed__fam--receiving');
    // Pre-dock: the top slot IS the front anchor — armed, card-shaped, EMPTY.
    const top = fam.find('.con-splayed__top');
    expect(top.attributes('data-start-front')).to.not.be.undefined;
    expect(top.classes()).to.contain('con-splayed__top--armed');
    expect(top.attributes('data-played-key')).to.be.undefined;
    expect(top.find('.con-splayed__face').exists()).to.be.false;
    expect(top.find('.con-splayed__place-ring').exists()).to.be.true;
    expect(fam.find('.con-splayed__cap-count').exists()).to.be.false;
    // THE DOCK: the landed card occupies the slot and STAYS; the count ticks.
    playedHeroState.revealed = true;
    await wrapper.vm.$nextTick();
    expect(top.attributes('data-start-front')).to.be.undefined;
    expect(top.attributes('data-played-key')).to.eq(CardName.THARSIS_REPUBLIC);
    expect(top.find('.con-splayed__face').exists()).to.be.true;
    // Occupied slots are never `--armed` — see the stacking note on the
    // prelude case below (that class is what parks the slot behind the pile).
    expect(top.classes()).to.not.contain('con-splayed__top--armed');
    expect(fam.find('.con-splayed__cap-count').text()).to.eq('1');
    wrapper.unmount();
  });

  it('RECEIVING onto a standing stack (a prelude): geometric Top Card Handoff — the previous top waits open on its future strip, crops at the reveal; the other family recedes aside', async () => {
    armPlayedHero(CardName.BIOLAB, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    const wrapper = make(view([CardName.THARSIS_REPUBLIC, CardName.ECOLOGY_EXPERTS]));
    await wrapper.vm.$nextTick();
    const fam = wrapper.find('[data-splayed-fam="prelude"]');
    expect(fam.classes()).to.contain('con-splayed__fam--receiving');
    // The lying top waits on its FUTURE strip slot, face still open (peek=false).
    const prev = fam.find('.con-splayed__strip--prev');
    expect(prev.attributes('data-played-key')).to.eq(CardName.ECOLOGY_EXPERTS);
    expect(prev.findComponent({name: 'ConsolePlayedCardLite'}).props('peek')).to.be.false;
    // The corporation family is context now — receded, never unmounted.
    expect(wrapper.find('[data-splayed-fam="corporation"]').classes()).to.contain('con-splayed__fam--aside');
    // The reveal: the new card covers the previous top back to a strip.
    playedHeroState.revealed = true;
    await wrapper.vm.$nextTick();
    expect(prev.findComponent({name: 'ConsolePlayedCardLite'}).props('peek')).to.be.true;
    expect(fam.find('.con-splayed__top').attributes('data-played-key')).to.eq(CardName.BIOLAB);
    expect(fam.find('.con-splayed__cap-count').text()).to.eq('2');
    /*
     * …and the landed card is now the TOP OF THE PILE. `--armed` is the only
     * state that puts the slot BEHIND the previous top (it is the empty
     * prepared place then); dropping it at the reveal is what raises the
     * landed card over that card's still-open, still-overflowing face.
     * Keep this in step with console.less (`__top` z5 vs `__strip--prev` z4)
     * — inverted, the card visibly lands on top and then sinks under the
     * older card's art.
     */
    expect(fam.find('.con-splayed__top').classes()).to.not.contain('con-splayed__top--armed');
    wrapper.unmount();
  });

  it('THE ART CANNOT BLINK: the face node of the landed card is REUSED across the receiving → idle transition (same element, no remount)', async () => {
    armPlayedHero(CardName.THARSIS_REPUBLIC, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    playedHeroState.revealed = true;
    const wrapper = make(view([CardName.THARSIS_REPUBLIC]));
    await wrapper.vm.$nextTick();
    const faceBefore = wrapper.find('[data-splayed-fam="corporation"] .con-splayed__top .con-splayed__face').element;
    // The transaction closes (hero returns to idle) — the SAME top slot now
    // presents the same card as the family's lying top.
    abortPlayedHero();
    await wrapper.vm.$nextTick();
    const faceAfter = wrapper.find('[data-splayed-fam="corporation"] .con-splayed__top .con-splayed__face').element;
    expect(faceAfter).to.eq(faceBefore);
    wrapper.unmount();
  });

  it('the docked card is addressable as `.con-start__played [data-played-key]` — the reward-source / transfer-target chain resolves on the dock', async () => {
    armPlayedHero(CardName.THARSIS_REPUBLIC, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    playedHeroState.revealed = true;
    const wrapper = make(view([]));
    await wrapper.vm.$nextTick();
    const hit = wrapper.element.matches('.con-start__played') &&
      wrapper.element.querySelector(`[data-played-key="${CardName.THARSIS_REPUBLIC}"]`) !== null;
    expect(hit).to.be.true;
    wrapper.unmount();
  });

  it('AFTER the transaction: the landed card stays physically as the open top of its stack — the shelf is compact again', async () => {
    // No live hero (the transaction closed); the tableau now carries the corp.
    const wrapper = make(view([CardName.THARSIS_REPUBLIC]));
    const fam = wrapper.find('[data-splayed-fam="corporation"]');
    expect(fam.classes()).to.not.contain('con-splayed__fam--receiving');
    expect(fam.find('[data-start-front]').exists()).to.be.false;
    const top = fam.find('.con-splayed__top');
    expect(top.attributes('data-played-key')).to.eq(CardName.THARSIS_REPUBLIC);
    // Open face (peek=false): the corporation stays readable in the tableau.
    expect(top.findComponent({name: 'ConsolePlayedCardLite'}).props('peek')).to.be.false;
    expect(fam.find('.con-splayed__cap-count').text()).to.eq('1');
    wrapper.unmount();
  });
  /**
   * THE ARTS STAY. The full tableau crops a covered card to its title band
   * (`peek`) — with dozens of piled cards their arts are pure cost. The START
   * shelf holds a handful (one corporation, a couple of preludes), so the
   * crop buys nothing and costs the card's own picture: a covered card reads
   * as a blank sliver, and every peek ↔ full swap re-mounts the art subtree
   * so the picture flashes in late. The opt-out is a FLAG, and it is set
   * HERE ONLY — the tableau and the piles keep the crop.
   */
  it('every face on the start shelf keeps its art (keepArt) — the peek crop is opted OUT of here', () => {
    // Two cards of the SAME family (both preludes) — that is what produces a
    // covered strip; SF Memorial, despite the name, is an AUTOMATED card and
    // would open its own family instead.
    const wrapper = make(view([CardName.THARSIS_REPUBLIC, CardName.BIOLAB, CardName.ACQUIRED_SPACE_AGENCY]));
    const faces = wrapper.findAllComponents({name: 'ConsolePlayedCardLite'});
    expect(faces.length, 'the shelf rendered faces').to.be.greaterThan(0);
    for (const face of faces) {
      expect(face.props('keepArt'), `${String(face.props('name'))} must keep its art`).to.be.true;
    }
    // …and a COVERED one is still a peek by geometry — the flag changes what
    // is mounted inside the band, never the band itself.
    const covered = faces.filter((f) => f.props('peek') === true);
    expect(covered.length, 'a covered card is still cropped to its strip').to.be.greaterThan(0);
    wrapper.unmount();
  });
});

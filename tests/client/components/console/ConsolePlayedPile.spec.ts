import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsolePlayedPile from '@/client/components/console/played/ConsolePlayedPile.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';

/**
 * The PEEK-PILE render contract (the played-table performance guard): a card
 * covered by the pile can only ever show its peek band, so its face renders
 * the cheap PEEK crop — no art <img> (no fetch/decode), no mechanics
 * subtree. Only the pile's TOP card (and the hero scene's reserved slot
 * pair) mounts the full premium face. The guard pins this so a refactor
 * can't silently re-mount 40 full faces for a late-game tableau.
 */

const PILE: Array<CardName> = [
  CardName.TREES, CardName.GRASS, CardName.HEATHER, CardName.LICHEN, CardName.ALGAE,
];

function cards(names: Array<CardName>): Array<CardModel> {
  return names.map((n) => ({name: n}) as CardModel);
}

function make(props: Partial<{cards: Array<CardModel>, hiddenKey: string | undefined}> = {}) {
  return mount(ConsolePlayedPile, {
    props: {
      cards: cards(PILE),
      zoom: 0.5, slotW: 160, cardH: 230, peekH: 37.5,
      ...props,
    },
  });
}

describe('ConsolePlayedPile (peek-crop faces)', () => {
  it('covered cards render the peek face: header + no art img, no mechanics', () => {
    const wrapper = make();
    const root = wrapper.element as HTMLElement;
    expect(root.querySelectorAll('.pcard').length).to.eq(PILE.length);
    // Every face keeps its header band (what actually peeks out of the pile).
    expect(root.querySelectorAll('.pcard-nameplate').length).to.eq(PILE.length);
    // Only the TOP (fully visible) card carries art + the lower section.
    expect(root.querySelectorAll('.pcard__art img').length).to.eq(1);
    expect(root.querySelectorAll('.pcard__lower').length).to.eq(1);
    const top = wrapper.find(`[data-played-key="${CardName.ALGAE}"]`);
    expect(top.find('.pcard__art img').exists()).to.eq(true);
    wrapper.unmount();
  });

  it('the hero reserved slot keeps the PREVIOUS top card full for the flight', () => {
    // The incoming card (hidden until the commit) is the LAST slot: it does
    // not paint, so the previous top card stays fully exposed — both must be
    // full faces; everything under them stays peek.
    const wrapper = make({hiddenKey: CardName.ALGAE});
    const root = wrapper.element as HTMLElement;
    expect(root.querySelectorAll('.pcard__art img').length).to.eq(2);
    const prev = wrapper.find(`[data-played-key="${CardName.LICHEN}"]`);
    expect(prev.find('.pcard__art img').exists()).to.eq(true);
    wrapper.unmount();
  });

  it('the reveal covers the previous top card — it drops to the peek face', async () => {
    const wrapper = make({hiddenKey: CardName.ALGAE});
    await wrapper.setProps({hiddenKey: undefined});
    const root = wrapper.element as HTMLElement;
    expect(root.querySelectorAll('.pcard__art img').length).to.eq(1);
    expect(wrapper.find(`[data-played-key="${CardName.LICHEN}"] .pcard__art`).exists()).to.eq(false);
    wrapper.unmount();
  });

  it('a single-card pile is simply the full face', () => {
    const wrapper = make({cards: cards([CardName.TREES])});
    expect(wrapper.findAll('.pcard__art img').length).to.eq(1);
    expect(wrapper.find('.pcard__lower').exists()).to.eq(true);
    wrapper.unmount();
  });
});

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

/*
 * THE FLEET ON A DOCK IS PART OF THE CARD ON THE TABLE TOO (docs/claude/gameplay-polish-ledger.md PL-013): the pile
 * draws name-only faces, and a docked dock read as a free one — in the owner's own «РАЗЫГРАНО» and in a rival's
 * reading of it. The docked face alone gets the minimal public model; every other face stays name-only.
 */
describe('ConsolePlayedPile — a dock\'s fleet stands on its face', () => {
  it('the TOP card of a pile, docked: the ship sits on its ▲ in the owner\'s livery', () => {
    const wrapper = make({cards: [{name: CardName.TREES} as CardModel, {name: CardName.UNMI_LINER, fleetDocked: 'blue'} as CardModel]});
    const ship = wrapper.find(`[data-played-key="${CardName.UNMI_LINER}"] .pcard-fleet--docked .colony-fleet-icon`);
    expect(ship.exists()).to.eq(true);
    expect(ship.classes()).to.include('fleet-hue--blue');
    wrapper.unmount();
  });

  it('a free dock keeps its empty mark slot; a card\'s LIVE counters still never reach the table — it stays printed', () => {
    const face = (cards: Array<CardModel>) => {
      const wrapper = make({cards});
      const html = wrapper.find(`[data-played-key="${CardName.BIRDS}"]`).html();
      const docked = wrapper.find('.pcard-fleet--docked').exists();
      wrapper.unmount();
      return {html, docked};
    };
    const printed = face([{name: CardName.WATER_HAULING} as CardModel, {name: CardName.BIRDS} as CardModel]);
    const live = face([{name: CardName.WATER_HAULING} as CardModel, {name: CardName.BIRDS, resources: 4, isDisabled: true} as CardModel]);
    expect(printed.docked, 'no fleet on a free dock').to.eq(false);
    expect(live.html, 'stored resources and availability are not the table\'s to draw').to.eq(printed.html);
  });

  it('the fleet leaving (next generation) leaves the face name-only again', async () => {
    const wrapper = make({cards: [{name: CardName.UNMI_LINER, fleetDocked: 'red'} as CardModel]});
    expect(wrapper.find('.pcard-fleet--docked').exists()).to.eq(true);
    await wrapper.setProps({cards: [{name: CardName.UNMI_LINER} as CardModel]});
    expect(wrapper.find('.pcard-fleet--docked').exists()).to.eq(false);
    expect(wrapper.find('.pcard-fleet').exists(), 'the slot stays — it is the landing anchor').to.eq(true);
    wrapper.unmount();
  });
});

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

  it('nothing live is pinned over the table — no stored-resource chip', () => {
    // Stored resources are read in «Информация» → «Доп. ресурсы» and on the
    // card's own face in the fullscreen inspector; the tableau shows cards.
    const live = cards(PILE) as Array<CardModel & {resources?: number}>;
    live[0].resources = 3;
    live[live.length - 1].resources = 5; // the fully open top card too
    const wrapper = make({cards: live});
    expect(wrapper.find('.con-played__res').exists()).to.eq(false);
    // The premium face itself stays the PRINTED one (name-only mode) — its
    // own live resource capsule is not mounted either.
    expect(wrapper.find('.pcard__res').exists()).to.eq(false);
    wrapper.unmount();
  });
});

import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsolePartyPlaque from '@/client/components/console/parliament/ConsolePartyPlaque.vue';
import {PartyName} from '@/common/turmoil/PartyName';
import {PartyStateVm} from '@/client/console/parliament/consoleParliamentModel';

/*
 * THE SUPPORT SOCKETS OF A PARTY TILE — the ruler's EMPTY places are void only when it rules BY AN ENACTED
 * CARD. Nothing can pay such a party while it rules (the proof is on the plaque), so an empty place there
 * would promise the impossible: it keeps its room (the row's box is the swap's condition) and draws nothing.
 * A STANDING CUBE is a fact and is always drawn — a card (TR03 Political Donation) can pay the party of a
 * resolution that then wins, and that stock rides into the government until the party's next card is dealt.
 * The ONE ruler without a card is generation 1's starting-rule Greens (rulebook p.8): a fourth party's
 * resolution can leave them out of the generation-1 area, the support step then pays them as «not present on
 * any card» (p.11), and their empty sockets must stay drawn for that cube to land in. The host passes the
 * fact (`rulesByCard`); the plaque only ever combines it with `ruling`.
 */
/** A tile's foot exists only with a viewer state (the foot IS the viewer's relation to the party); an absent party will do. */
const STATE: PartyStateVm = {kind: 'absent', label: 'Not in the vote', params: [], tone: 'dim', held: false, delegates: 0, effectDelegates: 2};

function make(props: Record<string, unknown> = {}) {
  return mount(ConsolePartyPlaque, {
    ...globalConfig,
    props: {party: PartyName.GREENS, state: STATE, support: 1, formula: false, ...props},
  });
}

function sockets(wrapper: ReturnType<typeof make>) {
  const block = wrapper.find('[data-parl-support]');
  expect(block.exists(), 'the support block is rendered whenever a stock is handed in').is.true;
  const places = block.findAll('[data-support-place]');
  return {
    block,
    void: block.attributes('data-support-void') !== undefined,
    voidClass: block.classes().includes('con-pseal__support--void'),
    places: places.length,
    filled: block.findAll('.con-pseal__support-place--on').length,
    voidPlaces: places.filter((p) => p.classes().includes('con-pseal__support-place--void')).map((p) => Number(p.attributes('data-support-place'))),
  };
}

describe('ConsolePartyPlaque — the support sockets and the ruler', () => {
  it('an opposition tile draws its three places and its stock', () => {
    const s = sockets(make());
    expect(s.places).eq(3);
    expect(s.filled).eq(1);
    expect(s.void).is.false;
    expect(s.voidClass).is.false;
    expect(s.voidPlaces).deep.eq([]);
  });

  it('the ruler BY AN ENACTED CARD with no stock voids its whole block — hidden, still in the flow with all three places', () => {
    const s = sockets(make({ruling: true, support: 0}));
    expect(s.void, 'the default: a ruler rules by a card').is.true;
    expect(s.voidClass).is.true;
    expect(s.places, 'the places are kept (visibility, never display — the row\'s box is the swap\'s condition)').eq(3);
    expect(s.voidPlaces).deep.eq([1, 2, 3]);
    const explicit = sockets(make({ruling: true, rulesByCard: true, support: 0}));
    expect(explicit.void).is.true;
  });

  it('the ruler BY AN ENACTED CARD holding a stock a card paid: its cubes are drawn, only its EMPTY places are void', () => {
    const s = sockets(make({ruling: true, support: 2}));
    expect(s.void, 'a standing cube is a fact — the block is not void').is.false;
    expect(s.voidClass).is.false;
    expect(s.places, 'every place keeps its room').eq(3);
    expect(s.filled, 'both cubes stand').eq(2);
    expect(s.voidPlaces, 'the one place that can never fill while it rules').deep.eq([3]);

    const full = sockets(make({ruling: true, support: 3}));
    expect(full.void).is.false;
    expect(full.filled).eq(3);
    expect(full.voidPlaces, 'a full stock has no empty place to void').deep.eq([]);
  });

  it('THE STARTING-RULE RULER holds no card: its sockets and its stock stay drawn in the government', () => {
    const s = sockets(make({ruling: true, rulesByCard: false}));
    expect(s.void).is.false;
    expect(s.voidClass).is.false;
    expect(s.places).eq(3);
    expect(s.filled, 'the cube the support step paid it as an absent party').eq(1);
    expect(s.voidPlaces, 'its empty places stay drawn — the next cube may land there').deep.eq([]);
  });

  it('`rulesByCard` alone says nothing — an opposition tile never voids', () => {
    const s = sockets(make({ruling: false, rulesByCard: true, support: 0}));
    expect(s.void).is.false;
    expect(s.filled).eq(0);
    expect(s.voidPlaces).deep.eq([]);
  });

  it('no stock handed in → no block at all (a plain identity plaque)', () => {
    const wrapper = make({support: undefined});
    expect(wrapper.find('[data-parl-support]').exists()).is.false;
  });
});

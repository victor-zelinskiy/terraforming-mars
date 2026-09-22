import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsolePartyPlaque from '@/client/components/console/parliament/ConsolePartyPlaque.vue';
import {PartyName} from '@/common/turmoil/PartyName';
import {PartyStateVm} from '@/client/console/parliament/consoleParliamentModel';

/*
 * THE SUPPORT SOCKETS OF A PARTY TILE — the ruler's are void only when it rules BY AN ENACTED CARD.
 * A party that rules by a card holds zero popular support in every legal state (the proof is on the
 * plaque), so its three places are hidden — in the flow, keeping the row's box. The ONE ruler without a
 * card is generation 1's starting-rule Greens (rulebook p.8): a fourth party's resolution can leave them
 * out of the generation-1 area, the support step then pays them as «not present on any card» (p.11), and
 * their sockets must stay drawn for that cube to land in. The host passes the fact (`rulesByCard`);
 * the plaque only ever combines it with `ruling`.
 */
/** A tile's foot exists only with a viewer state (the foot IS the viewer's relation to the party); an absent party will do. */
const STATE: PartyStateVm = {kind: 'absent', label: 'Not in the vote', params: [], tone: 'dim', held: false, delegates: 0};

function make(props: Record<string, unknown> = {}) {
  return mount(ConsolePartyPlaque, {
    ...globalConfig,
    props: {party: PartyName.GREENS, state: STATE, support: 1, formula: false, ...props},
  });
}

function sockets(wrapper: ReturnType<typeof make>) {
  const block = wrapper.find('[data-parl-support]');
  expect(block.exists(), 'the support block is rendered whenever a stock is handed in').is.true;
  return {
    block,
    void: block.attributes('data-support-void') !== undefined,
    voidClass: block.classes().includes('con-pseal__support--void'),
    places: block.findAll('[data-support-place]').length,
    filled: block.findAll('.con-pseal__support-place--on').length,
  };
}

describe('ConsolePartyPlaque — the support sockets and the ruler', () => {
  it('an opposition tile draws its three places and its stock', () => {
    const s = sockets(make());
    expect(s.places).eq(3);
    expect(s.filled).eq(1);
    expect(s.void).is.false;
    expect(s.voidClass).is.false;
  });

  it('the ruler BY AN ENACTED CARD voids its sockets — hidden, still in the flow with all three places', () => {
    const s = sockets(make({ruling: true}));
    expect(s.void, 'the default: a ruler rules by a card').is.true;
    expect(s.voidClass).is.true;
    expect(s.places, 'the places are kept (visibility, never display — the row\'s box is the swap\'s condition)').eq(3);
    const explicit = sockets(make({ruling: true, rulesByCard: true}));
    expect(explicit.void).is.true;
  });

  it('THE STARTING-RULE RULER holds no card: its sockets and its stock stay drawn in the government', () => {
    const s = sockets(make({ruling: true, rulesByCard: false}));
    expect(s.void).is.false;
    expect(s.voidClass).is.false;
    expect(s.places).eq(3);
    expect(s.filled, 'the cube the support step paid it as an absent party').eq(1);
  });

  it('`rulesByCard` alone says nothing — an opposition tile never voids', () => {
    const s = sockets(make({ruling: false, rulesByCard: true}));
    expect(s.void).is.false;
    expect(s.filled).eq(1);
  });

  it('no stock handed in → no block at all (a plain identity plaque)', () => {
    const wrapper = make({support: undefined});
    expect(wrapper.find('[data-parl-support]').exists()).is.false;
  });
});

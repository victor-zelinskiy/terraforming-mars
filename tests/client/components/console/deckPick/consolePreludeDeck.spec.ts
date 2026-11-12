/*
 * ConsolePreludeDeck — the prelude deck stood up inside the mid-game prelude pick: the pile, the «РАЗЫГРАНО» seat and
 * the discard. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): three props as PRESENTED by its
 * host, three stations a flight can end on.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {CardName} from '@/common/cards/CardName';
import ConsolePreludeDeck from '@/client/components/console/deckPick/ConsolePreludeDeck.vue';

// The played face is the premium renderer; this spec reads which card the seat HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const PlayedStub = defineComponent({name: 'ConsolePlayedCardLite', props: ['name'], render: () => h('i', {class: 'played-stub'})});

function deck(props: {deckCount: number, discardCount: number, played?: CardName}) {
  return mount(ConsolePreludeDeck, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {ConsolePlayedCardLite: PlayedStub}},
  });
}

/** The pile's backs, by the layer each one lies on. */
function pileLayers(w: ReturnType<typeof deck>): Array<string> {
  return w.findAll('[data-prelude-pile] > .con-predeck__back')
    .map((back) => (back.element as HTMLElement).style.getPropertyValue('--layer'));
}

describe('ConsolePreludeDeck — the prelude deck inside the pick', () => {
  it('three stations: the pile with its count, the empty seat, the empty discard', () => {
    const w = deck({deckCount: 12, discardCount: 0});
    expect(w.classes()).to.deep.eq(['con-predeck']);
    expect(w.attributes('data-prelude-deck')).to.not.eq(undefined);
    expect(pileLayers(w), 'a pile reads as a stack — never more than three backs').to.deep.eq(['0', '1', '2']);
    expect(w.find('[data-prelude-deck-count]').text()).to.eq('12');
    const caps = w.findAll('.con-predeck__cap').map((cap) => cap.text());
    expect(caps.length).to.eq(3);
    expect(caps[0]).to.contain($t('Preludes'));
    expect(caps[1]).to.eq($t('Played'));
    expect(caps[2]).to.contain($t('Discard pile'));

    const seat = w.find('[data-prelude-played-seat]');
    expect(seat.attributes('data-embed-source-slot'), 'the place a landed card pays from').to.not.eq(undefined);
    expect(seat.classes()).to.include.members(['con-predeck__seat', 'con-predeck__seat--empty']);
    expect(w.find('.played-stub').exists()).to.eq(false);

    expect(w.find('[data-prelude-discard]').classes()).to.contain('con-predeck__discard--empty');
    expect(w.find('[data-prelude-discard] .con-predeck__back--face').exists()).to.eq(false);
    expect(w.find('[data-prelude-discard-count]').text()).to.eq('0');
  });

  it('a thin pile shows as many backs as it has cards; an empty one is a socket', () => {
    expect(pileLayers(deck({deckCount: 2, discardCount: 0}))).to.deep.eq(['0', '1']);
    const empty = deck({deckCount: 0, discardCount: 0});
    expect(pileLayers(empty)).to.deep.eq([]);
    expect(empty.find('[data-prelude-pile]').exists(), 'the socket stays — a flight end').to.eq(true);
    expect(empty.find('[data-prelude-deck-count]').text()).to.eq('0');
  });

  it('the played prelude stands on the seat; the discard shows a face once a card landed on it', () => {
    const w = deck({deckCount: 9, discardCount: 2, played: CardName.DONATION});
    expect(w.find('[data-prelude-played-seat]').classes()).to.not.contain('con-predeck__seat--empty');
    expect(w.findComponent(PlayedStub).props('name')).to.eq(CardName.DONATION);
    expect(w.find('[data-prelude-discard]').classes()).to.not.contain('con-predeck__discard--empty');
    expect(w.find('[data-prelude-discard] > .con-predeck__back.con-predeck__back--face').exists()).to.eq(true);
    expect(w.find('[data-prelude-discard-count]').text()).to.eq('2');
  });

  it('follows the counts its host presents — the deal ticks the pile, a touchdown ticks the discard', async () => {
    const w = deck({deckCount: 3, discardCount: 0});
    await w.setProps({deckCount: 1, discardCount: 1, played: CardName.DONATION});
    expect(pileLayers(w)).to.deep.eq(['0']);
    expect(w.find('[data-prelude-deck-count]').text()).to.eq('1');
    expect(w.find('[data-prelude-discard-count]').text()).to.eq('1');
    expect(w.find('[data-prelude-discard] .con-predeck__back--face').exists()).to.eq(true);
    expect(w.find('.played-stub').exists()).to.eq(true);
  });
});

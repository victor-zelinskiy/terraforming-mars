import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {$t} from '@/client/directives/i18n';
import {CardAvailabilityView} from '@/client/console/cardAvailability';
import {DraftReading, draftWalletOf} from '@/client/console/draft/draftReadingModel';
import ConsoleDraftReading from '@/client/components/console/draft/ConsoleDraftReading.vue';

// The verdict panel and the flip counter are their own specs' subjects; this one reads what the row HANDS them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const PanelStub = defineComponent({name: 'ConsoleCardAvailabilityPanel', props: ['variant', 'view'], render: () => h('i', {class: 'panel-stub'})});
const FlipStub = defineComponent({
  name: 'ConsoleFlipValue',
  props: {value: Number, accent: String, flipOnDecrease: Boolean},
  render() {
    return h('i', {class: 'flip-stub'}, String(this.value));
  },
});

function row(props: Record<string, unknown>) {
  return mount(ConsoleDraftReading, {
    ...globalConfig,
    props: {...props},
    global: {...globalConfig.global, stubs: {ConsoleCardAvailabilityPanel: PanelStub, ConsoleFlipValue: FlipStub}},
  });
}

const VERDICT = {title: 'Requirement not met yet'} as CardAvailabilityView;

describe('ConsoleDraftReading — the packet showcase\'s reading row', () => {
  it('the card under the cursor by its NAME alone — a verdict only when there is something to say', async () => {
    const reading: DraftReading = {name: CardName.ANTS, availability: undefined};
    const w = row({reading});
    expect(w.classes()).to.contain('con-dread');
    expect(w.attributes('data-draft-reading')).to.not.eq(undefined);
    expect(w.attributes('data-draft-reading-card')).to.eq(CardName.ANTS);
    expect(w.find('.con-dread__name').text()).to.eq($t(CardName.ANTS));
    expect(w.findComponent(PanelStub).exists(), 'nothing to say — no verdict').to.eq(false);
    expect(w.find('.con-dread__idle').exists()).to.eq(false);
    expect(w.find('[data-draft-wallet]').exists(), 'no purchase — no wallet').to.eq(false);

    await w.setProps({reading: {name: CardName.BIRDS, availability: VERDICT}});
    expect(w.attributes('data-draft-reading-card')).to.eq(CardName.BIRDS);
    expect(w.find('.con-dread__name').text()).to.eq($t(CardName.BIRDS));
    const panel = w.findComponent(PanelStub);
    expect(panel.classes()).to.contain('con-dread__verdict');
    expect(panel.props('variant'), 'the hand\'s own one-line voice').to.eq('line');
    expect(panel.props('view')).to.deep.eq(VERDICT);
  });

  it('no card under the cursor: the idle line when the host has one, nothing otherwise', () => {
    const idle = row({idle: 'Waiting for the other players'});
    expect(idle.attributes('data-draft-reading-card')).to.eq(undefined);
    expect(idle.find('.con-dread__name').exists()).to.eq(false);
    expect(idle.find('.con-dread__idle').text()).to.eq($t('Waiting for the other players'));
    const silent = row({});
    expect(silent.find('.con-dread__idle').exists()).to.eq(false);
    expect(silent.text()).to.eq('');
  });

  it('on the purchase the WALLET closes the row: «N × price = −total · you have A → B»', () => {
    const w = row({reading: {name: CardName.ANTS, availability: undefined}, wallet: draftWalletOf(2, 3, 10, 'Set by a corporation')});
    const wallet = w.find('[data-draft-wallet]');
    expect(wallet.classes()).to.contain('con-dread__wallet');
    expect(wallet.classes()).to.not.contain('con-dread__wallet--over');
    expect(wallet.findAll('.con-dread__wallet-kicker').map((k) => k.text())).to.deep.eq([$t('Purchase'), $t('You have')]);
    const price = wallet.find('[data-purchase-price]');
    expect(price.classes()).to.contain('con-price-hint');
    expect(price.text()).to.eq('3');
    expect(price.attributes('data-hint'), 'who set the price — a hint, never a line').to.eq('Set by a corporation');
    // count · total · what is left — each a flip counter that also rolls DOWN; only the total wears the gold.
    // (Asked of the row's own wrapper: the wallet is the only place a flip counter stands.)
    const flips = w.findAllComponents(FlipStub);
    expect(flips.map((f) => f.props('value'))).to.deep.eq([2, 6, 4]);
    expect(flips.map((f) => f.props('flipOnDecrease'))).to.deep.eq([true, true, true]);
    expect(flips.map((f) => f.props('accent'))).to.deep.eq([undefined, 'gold', undefined]);
    expect(flips[0].classes()).to.contain('con-dread__wallet-count');
    expect(wallet.find('.con-dread__wallet-total').text()).to.eq('−6');
    expect(wallet.findAll('.con-dread__wallet-calc')[1].text().replace(/\s+/g, '')).to.eq('10→4');
    expect(wallet.findAll('i.resource_icon--megacredits.con-dread__mc')).to.have.length(2);
  });

  it('a purchase the player cannot afford marks the wallet', () => {
    const w = row({wallet: draftWalletOf(4, 3, 10)});
    expect(w.find('[data-draft-wallet]').classes()).to.contain('con-dread__wallet--over');
    expect(w.find('[data-purchase-price]').attributes('data-hint')).to.eq('');
  });
});

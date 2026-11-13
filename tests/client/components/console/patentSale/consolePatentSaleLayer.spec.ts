/*
 * ConsolePatentSaleLayer — the fixed, app-level stage of the patent sale («cards feed the trade terminal, the terminal
 * pays»): the card proxies in the well, the terminal with its kicker, and the cards the sale wakes standing beside
 * it. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): it takes no props, emits and exposes
 * nothing — it draws the module's `patentSaleState`, and the sale's director reaches its pieces through the stage
 * the layer registers while it is mounted.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowRef} from 'vue';
import {gsap} from 'gsap';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {CardName} from '@/common/cards/CardName';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {abortPatentSale, patentSaleState} from '@/client/console/patentSale/consolePatentSale';
import {PatentSaleAnswer} from '@/client/console/patentSale/patentSaleAnswers';
import {noteCardResourceLanding, resetCardResourceLandings} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import ConsolePatentSaleLayer from '@/client/components/console/patentSale/ConsolePatentSaleLayer.vue';

// The two card faces are their own specs' subjects; this one reads what the layer HANDS them. (Render functions, not
// template strings: the runtime compiler is not in this build.)
const FaceStub = defineComponent({name: 'ConsoleCardFaceLite', props: {name: String}, render: () => h('i', {class: 'face-stub'})});
const PlayedStub = defineComponent({name: 'ConsolePlayedCardLite', props: {name: String, card: Object, artTier: String}, render: () => h('i', {class: 'played-stub'})});

const global = {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceStub, ConsolePlayedCardLite: PlayedStub}};

function layer(attached = false) {
  return mount(ConsolePatentSaleLayer as any, {...globalConfig, global, ...(attached ? {attachTo: document.body} : {})});
}

/** The classes the shared resolver gives an icon key — what a gain's glyph must wear. */
const spriteOf = (key: string): Array<string> => iconClassFor(key).split(' ').filter((c) => c !== '');

const answer = (over: Partial<PatentSaleAnswer> & Pick<PatentSaleAnswer, 'key'>): PatentSaleAnswer =>
  ({source: 'a card', icon: 'data', amount: 1, channel: 'card-resource', certainty: 'exact', ...over});

/** The terminal's state as the module holds it at rest. */
function rest(): void {
  patentSaleState.active = false;
  patentSaleState.phase = 'idle';
  patentSaleState.cards = [];
  patentSaleState.payout = 0;
  patentSaleState.kicker = 'Patent sale';
  patentSaleState.flights = [];
  patentSaleState.answers = [];
  patentSaleState.receivers = [];
  patentSaleState.receiversUp = false;
  resetCardResourceLandings();
}

describe('ConsolePatentSaleLayer — the stage of the patent sale', () => {
  // The layer draws module state the whole bundle shares: every test starts from, and leaves, the terminal at rest.
  beforeEach(rest);
  afterEach(async () => {
    abortPatentSale();
    await nextTick(); // the abort lowers 'failed' → 'idle' a tick later
    rest();
  });

  it('no sale: the layer renders nothing — and stands the stage the moment a sale is armed', async () => {
    const w = layer();
    expect(w.find('.con-sale-hero').exists()).to.eq(false);
    // (No element at all — the anchor comment a runtime leaves in an absent root's place is its own business.)
    expect(w.html().replace(/<!--[\s\S]*?-->/g, '').trim(), 'nothing but an anchor').to.eq('');

    patentSaleState.flights = [{id: 1, name: CardName.TREES}];
    patentSaleState.active = true;
    await nextTick();
    // The template STARTS WITH ITS ROOT.
    const stage = w.find('.con-sale-hero');
    expect(stage.element).to.eq(w.element);
    expect(stage.attributes('aria-hidden')).to.eq('true');

    patentSaleState.active = false;
    await nextTick();
    expect(w.find('.con-sale-hero').exists()).to.eq(false);
  });

  it('the well holds one proxy per flight — a flip chassis with the card\'s face and its back — and the terminal prints the caller\'s kicker', async () => {
    patentSaleState.active = true;
    patentSaleState.flights = [{id: 3, name: CardName.TREES}, {id: 4, name: CardName.FISH}];
    const w = layer();
    const proxies = w.findAll('.con-sale-hero__well > .con-sale-hero__proxy');
    expect(proxies.length).to.eq(2);
    expect(proxies.every((p) => p.find('.con-deal-proxy__flip > .con-deal-proxy__face').exists() && p.find('.con-deal-proxy__flip > .con-deal-proxy__back .con-card-back--flyer').exists())).to.eq(true);
    expect(w.findAllComponents(FaceStub).map((f) => f.props('name'))).to.deep.eq([CardName.TREES, CardName.FISH]);

    const terminal = w.find('.con-sale-hero__terminal');
    expect(terminal.find('.con-sale-hero__kicker').text()).to.eq($t('Patent sale'));
    expect(terminal.find('.con-sale-hero__slit > .con-sale-hero__scan').exists()).to.eq(true);
    expect(terminal.find('.con-sale-hero__glow').exists()).to.eq(true);
    expect(w.find('[data-sale-receivers]').exists(), 'nothing answers: the scene is the one it always was').to.eq(false);

    // The enacted resolution's action runs the SAME terminal under its own name; the pile follows the module.
    patentSaleState.kicker = 'Open IP Trade';
    patentSaleState.flights = [{id: 4, name: CardName.FISH}];
    await nextTick();
    expect(terminal.find('.con-sale-hero__kicker').text()).to.eq($t('Open IP Trade'));
    expect(w.findAllComponents(FaceStub).map((f) => f.props('name'))).to.deep.eq([CardName.FISH]);
  });

  it('THE TABLE ANSWERS: each receiver stands with its capsule — the count at arm plus what has LANDED — and what it brings under it', async () => {
    patentSaleState.active = true;
    patentSaleState.receivers = [{card: CardName.PETS, before: 2}, {card: CardName.MARTIAN_RAILS, before: 0}];
    patentSaleState.answers = [
      answer({key: 'a', host: CardName.PETS, amount: 2}),
      answer({key: 'b', card: CardName.MARTIAN_RAILS, icon: 'megacredits', amount: 3, channel: 'stock'}),
      // A chip that lands on ANOTHER card's pool is not this card's label, and a zero is no gain.
      answer({key: 'c', card: CardName.MARTIAN_RAILS, host: CardName.PETS, amount: 0}),
      answer({key: 'd', card: CardName.PETS, icon: 'megacredits', amount: 0, channel: 'stock'}),
    ];
    const w = layer();
    const recvs = w.find('[data-sale-receivers]');
    expect(recvs.classes()).to.deep.eq(['con-sale-hero__recvs']);
    const cards = recvs.findAll('.con-sale-hero__recv-card');
    expect(cards.map((c) => [c.attributes('data-sale-receiver'), c.attributes('data-played-key')]))
      .to.deep.eq([[CardName.PETS, CardName.PETS], [CardName.MARTIAN_RAILS, CardName.MARTIAN_RAILS]]);

    const faces = () => w.findAllComponents(PlayedStub);
    expect(faces().map((f) => f.props('name'))).to.deep.eq([CardName.PETS, CardName.MARTIAN_RAILS]);
    expect(faces().map((f) => f.props('artTier'))).to.deep.eq(['thumb', 'thumb']);
    expect(faces().map((f) => f.props('card'))).to.deep.eq([{name: CardName.PETS, resources: 2}, {name: CardName.MARTIAN_RAILS, resources: 0}]);

    const gains = (i: number) => cards[i].findAll('.con-sale-hero__recv-gain');
    expect(gains(0).map((g) => [g.attributes('data-sale-gain'), g.find('b').text()])).to.deep.eq([['data', '+2']]);
    expect(gains(0)[0].find('i').classes()).to.include.members(spriteOf('data'));
    expect(gains(1).map((g) => [g.attributes('data-sale-gain'), g.find('b').text()])).to.deep.eq([['megacredits', '+3']]);

    // The capsule ticks at the CONTACT, never before: a landing on the card moves its count, and only its.
    noteCardResourceLanding({channel: 'card-resource', resource: 'data', amount: 1, targetCard: CardName.PETS});
    await nextTick();
    expect(faces().map((f) => f.props('card'))).to.deep.eq([{name: CardName.PETS, resources: 3}, {name: CardName.MARTIAN_RAILS, resources: 0}]);

    // The receivers RISE once the cards are inside the terminal.
    patentSaleState.receiversUp = true;
    await nextTick();
    expect(recvs.classes()).to.include('con-sale-hero__recvs--up');
  });

  it('the stage it registers hands the director the MOUNTED pieces — an abort takes the flights on its proxies and its terminal down', () => {
    patentSaleState.active = true;
    patentSaleState.flights = [{id: 7, name: CardName.TREES}];
    const w = layer(true);
    const el = (selector: string) => w.find(selector).element as HTMLElement;
    const pieces = ['.con-sale-hero__proxy', '.con-deal-proxy__flip', '.con-sale-hero__terminal', '.con-sale-hero__scan', '.con-sale-hero__glow'].map(el);
    // A flight in the air on every piece (paused: nothing ticks in the spec).
    pieces.forEach((piece) => gsap.to(piece, {x: 10, duration: 5, paused: true}));
    expect(pieces.map((piece) => gsap.getTweensOf(piece).length)).to.deep.eq([1, 1, 1, 1, 1]);
    abortPatentSale();
    expect(pieces.map((piece) => gsap.getTweensOf(piece).length), 'the abort reached every piece through the layer\'s stage').to.deep.eq([0, 0, 0, 0, 0]);
    expect(patentSaleState.active).to.eq(false);
  });

  it('a layer OUTSIDE the document hands the director nothing: its well is not connected, and an abort leaves a flight on its proxy alone', () => {
    // Active, but the layer is not in the document: a stage with no connected well has no pieces to hand over.
    patentSaleState.active = true;
    patentSaleState.flights = [{id: 9, name: CardName.TREES}];
    const w = layer();
    const proxy = w.find('.con-sale-hero__proxy').element as HTMLElement;
    const flight = gsap.to(proxy, {x: 10, duration: 5, paused: true});
    abortPatentSale();
    expect(gsap.getTweensOf(proxy).length).to.eq(1);
    flight.kill();
  });

  it('a PARENT\'s ref of it carries nothing — the director reaches the layer through its stage, never through a ref', () => {
    const held = shallowRef<Record<string, unknown> | null>(null);
    const Parent = defineComponent({
      name: 'PatentSaleLayerParent',
      setup: () => () => h('div', [h(ConsolePatentSaleLayer as never, {ref: held})]),
    });
    const wrapper = mount(Parent, {...globalConfig, global});
    expect(held.value, 'the parent\'s ref is set').to.not.eq(null);
    expect(Object.keys(held.value!), 'nothing is exposed').to.deep.eq([]);
    const leaked = ['capsuleOf', 'gainsOf', 'iconClass', 'setProxyRef', 'setFlipRef', 'proxyEls', 'flipEls', 'unregister', 'patentSaleState']
      .filter((key) => held.value![key] !== undefined);
    expect(leaked).to.deep.eq([]);
    wrapper.unmount();
    expect(held.value).to.eq(null);
  });
});

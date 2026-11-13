/*
 * ConsoleBannerCubeStage — «THE CORPORATION RISES, THE CUBE LEAVES IT»: the card whose effect puts a cube on a
 * party's banner, standing in the voting table's cell with one line under it (the cube → the party). A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): no prop, no emit, nothing exposed — it DRAWS
 * the module's phrase (`bannerCubeStage`, reactive module state), so the spec writes that state and reads the stage.
 * `ConsoleParliamentSection` mounts it with no ref; here it stands under a host the same way.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {$t} from '@/client/directives/i18n';
import {artTierForWidth} from '@/client/cards/cardArt';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {bannerCubeStage} from '@/client/console/parliament/bannerCubeStage';
import ConsoleBannerCubeStage from '@/client/components/console/parliament/ConsoleBannerCubeStage.vue';

// The face is the premium card and the cube is the player token — their own specs' subjects; this one reads what the
// stage HANDS them. (Render functions, not template strings: the runtime compiler is not in this build.)
const CardStub = defineComponent({
  name: 'CardFace',
  props: {card: Object, inert: Boolean, artTier: String},
  render: () => h('i', {class: 'card-stub'}),
});
const CubeStub = defineComponent({
  name: 'player-cube',
  props: {color: String, size: Number, glow: {type: Boolean, default: true}, shadow: {type: Boolean, default: true}},
  render: () => h('i', {class: 'cube-stub'}),
});

const STAGE = '[data-banner-stage]';

function mountUnderHost() {
  const Host = defineComponent({
    render: () => h('div', {class: 'host'}, [h(ConsoleBannerCubeStage)]),
  });
  return mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: {Card: CardStub, PlayerCube: CubeStub}}});
}

/** One cube's rise, as the module writes it (`playBannerCubeStage`): a new serial, the card, whose cube, onto which banner. */
function rise(card: CardName, party: typeof bannerCubeStage.party, color: typeof bannerCubeStage.color = 'blue'): void {
  bannerCubeStage.serial++;
  bannerCubeStage.card = card;
  bannerCubeStage.color = color;
  bannerCubeStage.party = party;
  bannerCubeStage.origin = 'effect';
  bannerCubeStage.phase = 'rise';
}

/** The stage's own zoom variable, as the root carries it. */
function zoomOf(el: Element): string {
  return /--bstage-zoom:\s*([^;]+)/.exec(el.getAttribute('style') ?? '')?.[1].trim() ?? '';
}

describe('ConsoleBannerCubeStage — the card that puts a cube on a banner, on the voting table', () => {
  let serialBefore = 0;

  beforeEach(() => {
    serialBefore = bannerCubeStage.serial;
  });

  afterEach(() => {
    // Module state is bundle-shared: the stage is put back exactly as it stood.
    bannerCubeStage.card = undefined;
    bannerCubeStage.color = undefined;
    bannerCubeStage.party = undefined;
    bannerCubeStage.origin = 'effect';
    bannerCubeStage.phase = '';
    bannerCubeStage.serial = serialBefore;
  });

  it('with no card on stage it renders nothing', () => {
    const w = mountUnderHost();
    expect(w.find(STAGE).exists()).to.eq(false);
    expect(w.find('.card-stub').exists()).to.eq(false);
  });

  it('a rise stands the card with its line: whose cube → which party; the phase, the origin, the card and the party are on the root', () => {
    rise(CardName.THARSIS_ALLIANCE, PartyName.MARS, 'red');
    const w = mountUnderHost();
    const stage = w.find(STAGE);
    expect(stage.classes()).to.include.members(['con-bstage', 'con-bstage--rise', 'con-bstage--from-effect']);
    expect(stage.attributes('data-banner-stage-phase')).to.eq('rise');
    expect(stage.attributes('data-banner-stage-card')).to.eq(CardName.THARSIS_ALLIANCE);
    expect(stage.attributes('data-banner-stage-party')).to.eq(PartyName.MARS);
    expect(zoomOf(stage.element), 'a cell with no layout leaves the face at its natural size').to.eq('1');

    // The face is the card by its name alone — inert, in the tier its painted width asks for.
    const face = w.findComponent(CardStub);
    expect((face.element as Element).parentElement?.getAttribute('data-banner-stage-face')).to.eq('');
    expect(face.props('card')).to.deep.eq({name: CardName.THARSIS_ALLIANCE});
    expect(face.props('inert')).to.eq(true);
    expect(face.props('artTier')).to.eq(artTierForWidth(320));

    const caption = stage.find('[data-banner-stage-caption]');
    expect(caption.find('.con-bstage__kicker').text()).to.eq($t('Party banner'));
    const cube = w.findComponent(CubeStub);
    expect(cube.props()).to.deep.eq({color: 'red', size: 20, glow: false, shadow: false});
    expect(caption.find('.con-bstage__arrow').text()).to.eq('→');
    expect(caption.find('img.con-bstage__emblem').attributes('src')).to.eq(partyEmblemUrl(PartyName.MARS));
    const party = caption.find('b.con-bstage__party');
    expect(party.text()).to.eq($t(partyNameKey(PartyName.MARS)));
    expect(party.attributes('style') ?? '', 'the name wears its party\'s accent').to.contain('color:');
    const probe = document.createElement('b');
    probe.style.color = partyAccent(PartyName.MARS);
    expect((party.element as HTMLElement).style.color).to.eq(probe.style.color);
  });

  it('FOLLOWS the module\'s phrase: a phase is a class on the same node, a second cube is a NEW rise (a new node), the end takes the stage down', async () => {
    rise(CardName.THARSIS_ALLIANCE, PartyName.MARS);
    const w = mountUnderHost();
    const first = w.find(STAGE).element;

    bannerCubeStage.phase = 'carry';
    bannerCubeStage.origin = 'play';
    await nextTick();
    expect(w.find(STAGE).element, 'a phase re-mounts nothing').to.eq(first);
    expect(w.find(STAGE).classes()).to.include.members(['con-bstage--carry', 'con-bstage--from-play']);
    expect(w.find(STAGE).classes()).to.not.contain('con-bstage--rise');
    expect(w.find(STAGE).attributes('data-banner-stage-phase')).to.eq('carry');

    rise(CardName.THARSIS_ALLIANCE, PartyName.GREENS);
    await nextTick();
    expect(w.find(STAGE).element, 'the serial is the stage\'s key').to.not.eq(first);
    expect(w.find(STAGE).attributes('data-banner-stage-party')).to.eq(PartyName.GREENS);
    expect(w.find('.con-bstage__party').text()).to.eq($t(partyNameKey(PartyName.GREENS)));

    // A cube with no colour / a banner not named yet: the line keeps its arrow and draws neither.
    bannerCubeStage.color = undefined;
    bannerCubeStage.party = undefined;
    await nextTick();
    expect(w.findComponent(CubeStub).exists()).to.eq(false);
    expect(w.find('.con-bstage__emblem').exists()).to.eq(false);
    expect(w.find('.con-bstage__party').exists()).to.eq(false);
    expect(w.find('.con-bstage__arrow').exists()).to.eq(true);

    bannerCubeStage.card = undefined;
    await nextTick();
    expect(w.find(STAGE).exists()).to.eq(false);
  });

  it('the face is SOLVED from the cell — at the mount, and again at every new rise', async () => {
    // jsdom lays nothing out: lend every element a box (the stage reads its root's), and take it back after.
    const box = {width: 800, height: 2000};
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {configurable: true, get: () => box.width});
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {configurable: true, get: () => box.height});
    try {
      rise(CardName.THARSIS_ALLIANCE, PartyName.MARS);
      const w = mountUnderHost();
      await nextTick();
      // Half the cell's width over the face's natural 320: 400 / 320 (the height leaves far more).
      expect(zoomOf(w.find(STAGE).element), 'solved at the mount').to.eq('1.25');
      expect(w.findComponent(CardStub).props('artTier')).to.eq(artTierForWidth(320 * 1.25));

      box.width = 704;
      rise(CardName.THARSIS_ALLIANCE, PartyName.GREENS);
      await nextTick();
      await nextTick();
      expect(zoomOf(w.find(STAGE).element), 'a new cube is a new rise — solved against the cell again').to.eq('1.1');
    } finally {
      delete (HTMLElement.prototype as unknown as {clientWidth?: number}).clientWidth;
      delete (HTMLElement.prototype as unknown as {clientHeight?: number}).clientHeight;
    }
  });
});

/*
 * PremiumResolutionFace — THE BILL: the face of a Turmoil Redux resolution (`PremiumCard` mounts it inside its `.pcard`
 * root for `CardType.RESOLUTION`). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). Five props in
 * (the view-model, the translated title, its length tier, the art tier, the «card numbers» switch), no emit, nothing
 * exposed; the spec is what it prints for them — the two roots, what it hands the illustration and the formula panel,
 * the quest's footnote, the stamp. (The bill inside the whole card, on every shipped resolution, is
 * `resolutionPremiumFace.spec.ts`.) No mount below hands it a translator — the face brings its own `$t` — and a Vue
 * warning fails the test.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h, toRaw} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {CardArtTier} from '@/client/cards/cardArt';
import {renderableNodes} from '@/client/components/premiumCard/mechanicsModel';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {TitleTier} from '@/client/components/premiumCard/titleFit';
import PremiumResolutionFace from '@/client/components/premiumCard/PremiumResolutionFace.vue';

// The illustration, the formula panel and a node's drawing are their own subjects; this spec reads what the bill HANDS
// them. (Render functions, not template strings: the runtime compiler is not in this build.)
const ArtStub = defineComponent({
  name: 'PremiumCardArt',
  props: ['art', 'tier'],
  render: () => h('i', {class: 'art-stub'}),
});
const PanelStub = defineComponent({
  name: 'PremiumMechanicsPanel',
  props: ['mechanics'],
  render: () => h('i', {class: 'panel-stub'}),
});
const NodeStub = defineComponent({
  name: 'PremiumMechNode',
  props: ['node'],
  render: () => h('i', {class: 'node-stub'}),
});

type Bill = PremiumCardVM & {parliament: NonNullable<PremiumCardVM['parliament']>};

/** The real face of a catalog resolution (a technical example — never dealt, only inspected), as `PremiumCard`'s hosts build it. */
function bill(): Bill {
  const vm = resolutionPremiumVmById('RDX_DEV_PASSIVE');
  if (vm === undefined || vm.parliament === undefined) {
    throw new Error('no RDX_DEV_PASSIVE in the client manifest');
  }
  return {...vm, parliament: vm.parliament};
}

function face(vm: PremiumCardVM, props: {title?: string, titleTier?: TitleTier, artTier?: CardArtTier, showCode?: boolean} = {}) {
  return mount(PremiumResolutionFace, {
    props: {vm, title: 'Закон о воде', titleTier: 2, ...props},
    global: {
      stubs: {PremiumCardArt: ArtStub, PremiumMechanicsPanel: PanelStub, PremiumMechNode: NodeStub},
      config: globalConfig.global.config,
    },
  });
}

describe('PremiumResolutionFace — the bill', () => {
  it('TWO roots and nothing beside them — the sheet and the author\'s seal over it, both decorative; the band prints the title in its tier', async () => {
    const vm = bill();
    const w = face(vm, {title: 'Закон о воде', titleTier: 3});
    const sheet = w.find('.pcard-bill__sheet');
    const seal = w.find('.pcard-bill__seal');
    expect(sheet.element.tagName).to.eq('DIV');
    expect(seal.element.tagName).to.eq('SPAN');
    expect(sheet.element.nextElementSibling, 'the seal stands right after the sheet — over its clip, never inside it').to.eq(seal.element);
    expect(sheet.element.parentElement?.children.length, 'two roots, nothing beside them').to.eq(2);
    expect([sheet.attributes('aria-hidden'), seal.attributes('aria-hidden')]).to.deep.eq(['true', 'true']);
    // The page, top to bottom — and the keyline under the folded corner.
    expect(Array.from(sheet.element.children).map((part) => part.className)).to.deep.eq([
      'pcard-bill__art', 'pcard-bill__band', 'pcard-bill__articles', 'pcard-bill__foot', 'pcard-bill__keyline', 'pcard-bill__fold',
    ]);

    const title = w.find('.pcard-bill__band > .pcard-bill__title');
    expect(title.classes()).to.include.members(['pcard__title', 'pcard__title--t3']);
    expect(title.text()).to.eq('Закон о воде');

    // THE AUTHOR'S SEAL: the tails, the rosette, the party's own emblem.
    expect(Array.from(seal.element.children).map((part) => part.className)).to.deep.eq(['pcard-bill__tails', 'pcard-bill__rosette', 'pcard__party-emblem']);
    const emblem = seal.find('img.pcard__party-emblem');
    expect(emblem.attributes('src')).to.eq(vm.parliament.emblemUrl);
    expect(emblem.attributes('alt')).to.eq('');
    expect(emblem.attributes('draggable')).to.eq('false');

    await w.setProps({title: 'Вето', titleTier: 1});
    expect(title.text(), 'the title follows its prop').to.eq('Вето');
    expect(title.classes()).to.include('pcard__title--t1');
    expect(title.classes()).to.not.include('pcard__title--t3');
  });

  it('hands the illustration the vm\'s art at the asked tier (else the party\'s emblem) and the ONE formula panel the vm\'s mechanics', async () => {
    const vm = bill();
    const w = face(vm);
    expect(w.find('.pcard-bill__art > .art-stub').exists(), 'the illustration heads the page').to.eq(true);
    expect(w.findComponent(ArtStub).props('art')).to.deep.eq(vm.art);
    expect(w.findComponent(ArtStub).props('tier'), 'the full build unless a host asks for less').to.eq('full');
    await w.setProps({artTier: 'thumb'});
    expect(w.findComponent(ArtStub).props('tier')).to.eq('thumb');
    // No art on the view-model: the seal's own emblem fills the window — never an empty frame.
    await w.setProps({vm: {...vm, art: undefined}});
    expect(w.findComponent(ArtStub).props('art')).to.deep.eq({url: vm.parliament.emblemUrl, fallback: false});

    const panels = w.findAllComponents(PanelStub);
    expect(panels).to.have.length(1);
    expect(w.find('.pcard-bill__articles > .panel-stub').exists(), 'the articles').to.eq(true);
    // (`toRaw`: the mount hands its props over as a reactive proxy — the object behind it is the model's own.)
    expect(toRaw(panels[0].props('mechanics')), 'the model\'s own object — never a copy').to.eq(vm.mechanics);
    // A prose-only render has no graphics to print: the zone stays, the panel does not.
    await w.setProps({vm: {...vm, mechanics: {...vm.mechanics, textOnly: true}}});
    expect(w.findAllComponents(PanelStub)).to.have.length(0);
    expect(w.find('.pcard-bill__articles').exists()).to.eq(true);
  });

  it('the quest is a FOOTNOTE: the chair and the goal as a graphic — its words only when no graphic exists, nothing with no quest', () => {
    const vm = bill();
    const root = vm.parliament.questRenderData;
    const sentence = vm.parliament.quest;
    if (root === undefined || sentence === undefined) {
      throw new Error('RDX_DEV_PASSIVE prints no chairman quest');
    }
    const goal = renderableNodes(root.rows[0] ?? []);
    expect(goal.length, 'the example\'s quest has a goal to draw').to.be.greaterThan(0);

    const w = face(vm);
    const quest = w.find('.pcard-bill__foot > .pcard-bill__quest');
    expect(quest.classes()).to.not.include('pcard-bill__quest--words');
    expect(quest.find('.pchair.pcard-bill__chair').exists(), 'the chair stands for the words').to.eq(true);
    expect(quest.findAll('.pcard__quest-graphic > .node-stub')).to.have.length(goal.length);
    const nodes = w.findAllComponents(NodeStub);
    expect(nodes.map((node, i) => toRaw(node.props('node')) === goal[i]), 'the goal\'s own nodes, by reference, in their order')
      .to.deep.eq(goal.map(() => true));
    expect(w.find('.pcard__quest-text').exists(), 'no sentence beside a graphic').to.eq(false);

    const words = face({...vm, parliament: {...vm.parliament, questRenderData: undefined}});
    const worded = words.find('.pcard-bill__quest');
    expect(worded.classes()).to.include('pcard-bill__quest--words');
    expect(worded.find('.pcard-bill__chair').exists()).to.eq(true);
    expect(worded.find('.pcard__quest-text').text()).to.eq($t(sentence));
    expect(words.find('.pcard__quest-graphic').exists()).to.eq(false);
    expect(words.findAllComponents(NodeStub)).to.have.length(0);

    const none = face({...vm, parliament: {...vm.parliament, quest: undefined, questRenderData: undefined}});
    expect(none.find('.pcard-bill__quest').exists(), 'no quest — no footnote').to.eq(false);
    expect(none.find('.pcard-bill__foot > .pcard-bill__stamp').exists(), 'the stamp stays').to.eq(true);
  });

  it('the stamp — the catalog code only on request, the expansion medallion, the dependencies beside it', async () => {
    const vm: PremiumCardVM = {...bill(), code: 'RX99', compatibility: ['turmoilRedux', 'venus', 'base', 'colonies']};
    const w = face(vm);
    const stamp = w.find('.pcard-bill__foot > .pcard-bill__stamp');
    expect(stamp.find('.pcard__code').exists(), '«Номера карт» is off by default').to.eq(false);
    await w.setProps({showCode: true});
    expect(stamp.find('.pcard__code').text()).to.eq('RX99');
    expect(stamp.find('.pcard__code').attributes('data-card-code')).to.eq('RX99');

    const medallion = stamp.find('.pcard__exp-medallion');
    expect(medallion.classes()).to.not.include('pcard__exp-medallion--base');
    expect(medallion.attributes('style')).to.contain('expansion_icon_turmoil.png');
    // The dependencies: every module of `compatibility` but the resolution's own — and only one that has an icon.
    const compat = stamp.findAll('.pcard__exp-compat.pcard-bill__compat');
    expect(compat.map((mark) => mark.attributes('data-bill-compat'))).to.deep.eq(['venus', 'colonies']);
    expect(compat[0].attributes('style')).to.contain('expansion_icon_venus.png');
    expect(compat[1].attributes('style')).to.contain('expansion_icon_colonies.png');

    // A view-model with no code prints none, asked or not; the base game wears the plain engraved medallion.
    await w.setProps({vm: {...vm, code: undefined, expansion: 'base', compatibility: ['base']}});
    expect(w.find('.pcard__code').exists()).to.eq(false);
    const plain = w.find('.pcard__exp-medallion');
    expect(plain.classes()).to.include('pcard__exp-medallion--base');
    expect(plain.attributes('style') ?? '').to.not.contain('background-image');
    expect(w.findAll('.pcard-bill__compat')).to.have.length(0);
  });
});

/*
 * PremiumPartyFace — THE CHARTER: the face of a Turmoil Redux party drawn as a card (`PremiumCard` mounts it inside
 * its `.pcard` root for the theme `charter`). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md).
 * Four props in (the view-model, the translated title, its length tier, the «card numbers» switch), no emit, nothing
 * exposed; the spec is what it prints for them — the banner, the cubes on it, the clauses, the foot. No mount below
 * hands it a translator — the face brings its own `$t` — and a Vue warning fails the test.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h, toRaw} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {Color} from '@/common/Color';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {$t} from '@/client/directives/i18n';
import {partyPremiumVm} from '@/client/components/premiumCard/partyPremiumVm';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {expansionIconUrl} from '@/client/components/premiumCard/premiumCardIcons';
import PremiumPartyFace from '@/client/components/premiumCard/PremiumPartyFace.vue';

// The formula renderer and the cube are their own subjects; this spec reads what the charter HANDS them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const PanelStub = defineComponent({
  name: 'PremiumMechanicsPanel',
  props: ['mechanics'],
  render: () => h('i', {class: 'panel-stub'}),
});
const CubeStub = defineComponent({
  name: 'PlayerCube',
  props: ['color', 'size', 'glow', 'shadow'],
  render: () => h('i', {class: 'cube-stub'}),
});

/** The real face of a party, as `PremiumCard`'s hosts build it. */
function charterOf(party: ReduxParty, opts: {bannerCubes?: ReadonlyArray<Color>} = {}): PremiumCardVM {
  const vm = partyPremiumVm(party, opts);
  if (vm === undefined) {
    throw new Error(`the manifest has no face for ${party}`);
  }
  return vm;
}

function face(vm: PremiumCardVM, props: {title?: string, titleTier?: number, showCode?: boolean} = {}) {
  return mount(PremiumPartyFace, {
    props: {vm, title: 'Зелёные', titleTier: 2, ...props},
    global: {
      stubs: {PremiumMechanicsPanel: PanelStub, PlayerCube: CubeStub},
      config: globalConfig.global.config,
    },
  });
}

describe('PremiumPartyFace — the charter', () => {
  const PARTY = REDUX_PARTIES[1];

  it('the sheet is ONE decorative element — the template starts with its root — headed by the banner: the crest, the title in its tier', () => {
    const vm = charterOf(PARTY);
    const w = face(vm, {title: 'Учёные', titleTier: 3});
    expect(w.element.tagName).to.eq('DIV');
    expect(w.classes()).to.include('pcard-charter__sheet');
    expect(w.attributes('aria-hidden')).to.eq('true');

    const crest = w.find('.pcard-charter__board > .pcard-charter__banner > img.pcard-charter__crest');
    expect(crest.classes()).to.include('pcard__party-emblem');
    expect(crest.attributes('src')).to.eq(vm.parliament?.emblemUrl);
    const title = w.find('.pcard-charter__banner > .pcard-charter__title');
    expect(title.classes()).to.include('pcard__title');
    expect(title.classes()).to.include('pcard__title--t3');
    expect(title.text()).to.eq('Учёные');

    // The foot prints the law of access as marks: the crown, then two delegate seats.
    const access = w.find('.pcard-charter__foot > [data-charter-access]');
    expect(access.find('.pcard-charter__crown').exists()).to.eq(true);
    expect(access.findAll('.pcard-charter__seat img').map((seat) => seat.attributes('src')))
      .to.deep.eq(['assets/misc/delegate.svg', 'assets/misc/delegate.svg']);
    expect(w.find('.pcard-charter__board > .pcard-charter__keyline').exists()).to.eq(true);
  });

  it('every party\'s clauses stand in the printed order — the effect, then the action — each under its own label, each handed its OWN mechanics', () => {
    for (const party of REDUX_PARTIES) {
      const vm = charterOf(party);
      const charter = vm.parliament?.charter;
      const kinds = [
        ...(charter?.effect !== undefined ? ['effect'] : []),
        ...(charter?.action !== undefined ? ['action'] : []),
      ];
      expect(kinds.length, `${party}: a clause to print`).to.be.greaterThan(0);

      const w = face(vm);
      expect(w.find('.pcard-charter__clauses').attributes('data-charter-clauses'), party).to.eq(String(kinds.length));
      const clauses = w.findAll('.pcard-charter__clause');
      expect(clauses.map((clause) => clause.attributes('data-charter-clause')), party).to.deep.eq(kinds);
      expect(clauses.map((clause) => clause.classes().filter((c) => c.startsWith('pcard-charter__clause--'))), party)
        .to.deep.eq(kinds.map((kind) => ['pcard-charter__clause--' + kind]));
      // The label is translated by the face's own `$t`; the effect's glyph is the «∞», the action's the bolt.
      expect(clauses.map((clause) => clause.find('.pcard-charter__label-text').text()), party)
        .to.deep.eq(kinds.map((kind) => $t(kind === 'action' ? 'Action' : 'Effect')));
      expect(clauses.map((clause) => clause.find('.pcard-charter__glyph').classes().includes('pcard-charter__glyph--effect')), party)
        .to.deep.eq(kinds.map((kind) => kind === 'effect'));

      // (`toRaw`: the mount hands its props over as a reactive proxy — the object behind it is the model's own.)
      const handed = w.findAllComponents(PanelStub).map((panel) => toRaw(panel.props('mechanics')));
      expect(handed, party).to.have.length(kinds.length);
      kinds.forEach((kind, i) => {
        expect(handed[i], `${party}: the ${kind} clause's mechanics — never a copy`).to.eq(kind === 'effect' ? charter?.effect : charter?.action);
      });
      w.unmount();
    }
  });

  it('the cubes on the banner: nothing reserved when there is none — one socket per seat, in seat order, when the host hands them in', () => {
    const bare = face(charterOf(PARTY));
    expect(bare.find('.pcard-charter__cubes').exists()).to.eq(false);
    expect(bare.findAllComponents(CubeStub)).to.have.length(0);

    const w = face(charterOf(PARTY, {bannerCubes: ['red', 'blue']}));
    const cubes = w.find('.pcard-charter__banner > .pcard-charter__cubes');
    expect(cubes.attributes('data-charter-banner-cubes')).to.eq('red blue');
    expect(cubes.findAll('.pcard-charter__cube').map((socket) => socket.attributes('data-charter-banner-cube'))).to.deep.eq(['red', 'blue']);
    const drawn = w.findAllComponents(CubeStub);
    expect(drawn.map((cube) => cube.props('color'))).to.deep.eq(['red', 'blue']);
    // Material only: a 20 px cube with no glow and no shadow.
    expect(drawn.map((cube) => [cube.props('size'), cube.props('glow'), cube.props('shadow')])).to.deep.eq([[20, false, false], [20, false, false]]);
  });

  it('the stamp: the catalog code only when the switch is on AND the face has one — the medallion wears the expansion\'s icon, or the base engraving', async () => {
    const vm = charterOf(PARTY);
    const w = face(vm);
    const medallion = () => w.find('.pcard-charter__stamp > .pcard__exp-medallion');
    const icon = () => (medallion().element as HTMLElement).style.backgroundImage;

    // A party carries no catalog code: the switch alone prints nothing.
    expect(w.find('.pcard__code').exists()).to.eq(false);
    await w.setProps({showCode: true});
    expect(w.find('.pcard__code').exists()).to.eq(false);
    await w.setProps({vm: {...vm, code: 'TR01'}});
    const code = w.find('.pcard-charter__stamp > .pcard__code');
    expect(code.text()).to.eq('TR01');
    expect(code.attributes('data-card-code')).to.eq('TR01');
    await w.setProps({showCode: false});
    expect(w.find('.pcard__code').exists()).to.eq(false);

    // The party's own module has an icon…
    const url = expansionIconUrl(vm.expansion);
    expect(url).to.not.eq(undefined);
    expect(medallion().classes()).to.not.include('pcard__exp-medallion--base');
    expect(icon()).to.contain(String(url));
    // …the base game has none: the plain engraved medallion.
    expect(expansionIconUrl('base')).to.eq(undefined);
    await w.setProps({vm: {...vm, expansion: 'base'}});
    expect(medallion().classes()).to.include('pcard__exp-medallion--base');
    expect(icon()).to.eq('');
  });
});

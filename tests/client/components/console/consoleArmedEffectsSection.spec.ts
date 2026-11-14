/*
 * ConsoleArmedEffectsSection — «ВЗВЕДЕНО НА СЛЕДУЮЩУЮ КАРТУ» of the Information mode's «ЭФФЕКТЫ». A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): what it renders for its one prop — nothing while nothing is
 * armed, else one tile per armed effect: the SOURCE's own face (a card's lite face, a law's premium face), what the
 * effect does to the next card, and when it ends. It emits nothing. The wording is the pure reading's
 * (`armedEffectsOf`) — the spec asserts that the template prints it, not how it is phrased.
 *
 * The three faces are stubbed. `<premium-card-face>` is the LAZY binding the component imports from
 * `components/asyncComponents.ts`; test-utils names a child by what the parent's setup state holds, and an import
 * from a `.ts` module stands there as a getter it does not read — so that binding answers to the async wrapper's own
 * name, and to nothing else.
 */
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {ArmedPlayEffectModel} from '@/common/models/ArmedPlayEffectModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {$t} from '@/client/directives/i18n';
import {armedEffectsOf} from '@/client/console/armedEffects';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import ConsoleArmedEffectsSection from '@/client/components/console/ConsoleArmedEffectsSection.vue';

/** RX36 Live Experiments — the law whose paid action arms a waiver. */
const LAW = 'RDX_SCIENTISTS_LIVE_EXPERIMENTS';

const LiteFaceStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {name: {type: String, required: true}, lightweight: {type: Boolean, default: false}},
  render() {
    return h('i', {'class': 'lite-face-stub'});
  },
});

const LawFaceStub = defineComponent({
  name: 'LawFaceStub',
  props: {
    vmOverride: {type: Object as PropType<PremiumCardVM>, default: undefined},
    lightweight: {type: Boolean, default: false},
    inert: {type: Boolean, default: false},
  },
  render() {
    return h('i', {'class': 'law-face-stub'});
  },
});

const PartyGlyphStub = defineComponent({
  name: 'PremiumPartyRequirementGlyph',
  render() {
    return h('i', {'class': 'party-glyph-stub'});
  },
});

type Seat = Pick<PublicPlayerModel, 'armedPlayEffects'>;

function armed(source: ArmedPlayEffectModel['source'], effect: ArmedPlayEffectModel['effect']): ArmedPlayEffectModel {
  return {source, sourceType: typeof source === 'string' ? CardType.EVENT : 'resolution', effect, expires: 'next-play'};
}

function sectionOf(player: Seat) {
  return mount(ConsoleArmedEffectsSection, {
    global: {
      ...globalConfig.global,
      stubs: {ConsoleCardFaceLite: LiteFaceStub, PremiumPartyRequirementGlyph: PartyGlyphStub, VaporAsyncComponentWrapper: LawFaceStub},
    },
    props: {player},
  });
}

function squeezed(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

describe('ConsoleArmedEffectsSection — the armed one-play effects of a seat', () => {
  it('nothing armed: the section is absent', () => {
    for (const player of [{}, {armedPlayEffects: []}] as ReadonlyArray<Seat>) {
      const w = sectionOf(player);
      expect(w.find('[data-armed-section]').exists()).to.eq(false);
      expect(w.find('.con-armsec').exists()).to.eq(false);
    }
  });

  it('a card\'s waiver: the head, then ONE tile — the card\'s own face, the struck plate with the formula, the expiry', () => {
    const player: Seat = {armedPlayEffects: [armed(CardName.CUTTING_EDGE_DESIGN, {kind: 'requirementWaiver'})]};
    const [view] = armedEffectsOf(player);
    const w = sectionOf(player);

    expect(w.element.tagName).to.eq('SECTION');
    expect(w.classes()).to.deep.eq(['con-armsec']);
    expect(w.attributes('data-armed-section')).to.eq('');
    expect(w.attributes('aria-label')).to.eq($t('Armed for your next card'));
    expect(w.find('.con-armsec__head > .con-armsec__spark').attributes('aria-hidden')).to.eq('true');
    expect(w.find('.con-armsec__head > .con-armsec__kicker').text()).to.eq($t('Armed for your next card'));
    expect(w.find('.con-armsec__head > .con-armsec__sub').text())
      .to.eq($t('Spent by the next card played this generation, lost on the pass'));

    const items = w.findAll('.con-armsec__row > .con-armsec__item');
    expect(items).to.have.lengthOf(1);
    expect(items[0].attributes('data-armed-kind')).to.eq('requirementWaiver');
    expect(items[0].attributes('data-armed-source')).to.eq(CardName.CUTTING_EDGE_DESIGN);

    // The face: the SOURCE card's own, in the thumb tier — never the law's face.
    expect(items[0].find('.con-armsec__face').attributes('aria-hidden')).to.eq('true');
    const face = w.findComponent(LiteFaceStub);
    expect(face.props()).to.deep.eq({name: CardName.CUTTING_EDGE_DESIGN, lightweight: true});
    expect(w.findComponent(LawFaceStub).exists()).to.eq(false);

    expect(items[0].find('.con-armsec__name').text()).to.eq(view.sourceName);
    const struck = items[0].find('.con-armsec__formula > .con-armed__struck');
    expect(struck.attributes('aria-hidden')).to.eq('true');
    expect(struck.text()).to.eq($t('Global requirements'));
    expect(items[0].find('.con-armed__badge').exists(), 'a waiver draws the struck plate, never a badge').to.eq(false);
    expect(squeezed(items[0].find('.con-armsec__formula').text())).to.eq(`${$t('Global requirements')} ${view.formula}`);
    expect(squeezed(items[0].find('.con-armsec__expiry').text())).to.eq(`${$t('One play')} · ${view.expiry}`);
  });

  it('one card, two effects: a tile each — the party waiver wears the struck party plate, the discount its badge', () => {
    const player: Seat = {armedPlayEffects: [
      armed(CardName.BACKROOM_DEAL, {kind: 'partyWaiver'}),
      armed(CardName.BACKROOM_DEAL, {kind: 'discount', amount: 10}),
    ]};
    const views = armedEffectsOf(player);
    const w = sectionOf(player);

    const items = w.findAll('.con-armsec__item');
    expect(items.map((i) => i.attributes('data-armed-kind'))).to.deep.eq(['partyWaiver', 'discount']);
    expect(items.map((i) => i.attributes('data-armed-source'))).to.deep.eq([CardName.BACKROOM_DEAL, CardName.BACKROOM_DEAL]);
    expect(w.findAllComponents(LiteFaceStub).map((f) => f.props('name'))).to.deep.eq([CardName.BACKROOM_DEAL, CardName.BACKROOM_DEAL]);

    const plate = items[0].find('.con-armsec__formula > .party-glyph-stub');
    expect(plate.classes()).to.include.members(['pprq--waived', 'con-armed__pprq']);
    expect(items[0].find('.con-armed__struck').exists()).to.eq(false);
    expect(items[0].find('.con-armed__badge').exists()).to.eq(false);
    expect(squeezed(items[0].find('.con-armsec__formula').text())).to.eq(views[0].formula);

    expect(items[1].find('.party-glyph-stub').exists()).to.eq(false);
    expect(items[1].find('.con-armsec__formula > .con-armed__badge').text()).to.eq(views[1].badge);
    expect(squeezed(items[1].find('.con-armsec__formula').text())).to.eq(`${views[1].badge} ${views[1].formula}`);
  });

  it('a LAW that armed it shows its own face — the lazy premium face with the law\'s view-model; an unknown law shows none', () => {
    const vm = resolutionPremiumVmById(LAW);
    expect(vm, 'the catalog knows the law').to.not.eq(undefined);

    const player: Seat = {armedPlayEffects: [armed({resolution: LAW}, {kind: 'requirementWaiver'})]};
    const [view] = armedEffectsOf(player);
    const w = sectionOf(player);
    const item = w.find('.con-armsec__item');
    expect(item.attributes('data-armed-source')).to.eq('law:' + LAW);
    expect(item.find('.con-armsec__name').text()).to.eq(view.sourceName);
    const face = w.findComponent(LawFaceStub);
    expect(face.props('vmOverride')).to.deep.eq(vm);
    expect(face.props('lightweight')).to.eq(true);
    expect(face.props('inert')).to.eq(true);
    expect(item.find('.con-armsec__face > .law-face-stub').exists()).to.eq(true);
    expect(w.findComponent(LiteFaceStub).exists(), 'a law is never a card of the table').to.eq(false);

    const unknown = sectionOf({armedPlayEffects: [armed({resolution: 'RDX_NO_SUCH_LAW'}, {kind: 'requirementWaiver'})]});
    expect(unknown.find('.con-armsec__item').attributes('data-armed-source')).to.eq('law:RDX_NO_SUCH_LAW');
    expect(unknown.find('.con-armsec__face').element.children).to.have.lengthOf(0);
  });
});

/*
 * ConsoleComposerTargetRow — THE TARGET ROW OF A COMPOSER (TR56 «КУДА ЛЯЖЕТ», П2): the question line of a «put N on
 * ANY card» pick and its answer, ONE row for both composers. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): no emits, nothing exposed — its contract is the row it draws for the props it is
 * handed: the question that never changes, the strip of the server's candidates, the answered link.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, shallowRef} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {
  PlayedTargetQuickImpact, PlayedTargetResult, PlayedTargetTag,
} from '@/client/console/played/consolePlayedTargetModel';
import {TARGET_ROW_STRIP_FACES} from '@/client/components/console/played/consoleComposerTargetRowModel';
import ConsoleComposerTargetRow from '@/client/components/console/played/ConsoleComposerTargetRow.vue';

// The lite face, the outcome tag, the printed node and the pad's badge are their own specs' subjects; this one reads
// what the row HANDS them. (Render functions, not template strings: the runtime compiler is not in this build.)
const FaceStub = defineComponent({name: 'ConsoleCardFaceLite', props: {name: String, card: Object, lightweight: Boolean}, render: () => h('i', {class: 'face-stub'})});
const TagStub = defineComponent({name: 'ConsolePlayedTargetTag', props: {tag: Object}, render: () => h('i', {class: 'tag-stub'})});
const NodeStub = defineComponent({name: 'PremiumMechNode', props: {node: Object}, render: () => h('i', {class: 'node-stub'})});
const GlyphStub = defineComponent({name: 'GamepadGlyph', props: {control: String}, render: () => h('i', {class: 'glyph-stub'})});

const global = {
  ...globalConfig.global,
  stubs: {ConsoleCardFaceLite: FaceStub, ConsolePlayedTargetTag: TagStub, PremiumMechNode: NodeStub, GamepadGlyph: GlyphStub},
};

function row(props: Record<string, unknown> = {}) {
  return mount(ConsoleComposerTargetRow as any, {...globalConfig, props, global});
}

/** The classes the shared resolver gives an icon key — what a glyph of the row must wear. */
const spriteOf = (key: string): Array<string> => iconClassFor(key).split(' ').filter((c) => c !== '');

const card = (name: CardName, resources = 0): CardModel => ({name, resources}) as CardModel;

/** Seven holders the server offers, in its order — two more than the strip has faces for. */
const CANDIDATES: ReadonlyArray<CardModel> = [
  card(CardName.TARDIGRADES), card(CardName.ANTS), card(CardName.DECOMPOSERS), card(CardName.PETS),
  card(CardName.BIRDS), card(CardName.FISH), card(CardName.LIVESTOCK),
];

/** The answer: a card in the viewer's own tableau. */
const RESULT = {
  cardName: CardName.ANTS, ownerId: 'p-blue', ownerName: 'Ada', ownerColor: 'blue', self: true,
  category: 'active', relation: 'external', slotKey: 'p-blue:Ants', preview: [], version: 'v1',
} as unknown as PlayedTargetResult;

const TAG: PlayedTargetTag = {icon: 'microbe', text: '2 → 3', tone: 'gain'};

const impact = (key: string, over: Partial<PlayedTargetQuickImpact> = {}): PlayedTargetQuickImpact =>
  ({key, entity: 'card', label: 'Enough for a delegate', ...over}) as PlayedTargetQuickImpact;

describe('ConsoleComposerTargetRow — the question of a target pick and its answer, in one row', () => {
  it('UNANSWERED with no payload: the host\'s role word, and the strip of the server\'s candidates — five faces, «ещё N», a door', () => {
    const w = row({label: 'Source card', candidates: CANDIDATES});
    expect(w.classes()).to.deep.eq(['con-tgtrow']);
    expect(w.attributes('data-composer-target-row')).to.not.eq(undefined);
    expect(w.attributes('data-tgtrow-state')).to.eq('open');
    expect(w.attributes('data-seeded')).to.eq(undefined);
    expect(w.find('.con-tgtrow__label').text()).to.eq('Source card');
    expect(w.find('[data-tgtrow-payload]').exists()).to.eq(false);

    const strip = w.find('[data-tgtrow-strip]');
    expect(strip.attributes('data-tgtrow-count'), 'the count is the server\'s, not the strip\'s').to.eq(String(CANDIDATES.length));
    const minis = strip.findAll('.con-tgtrow__mini');
    expect(minis.map((m) => m.attributes('data-tgtrow-card'))).to.deep.eq(CANDIDATES.slice(0, TARGET_ROW_STRIP_FACES).map((c) => c.name));
    const faces = strip.findAllComponents(FaceStub);
    expect(faces.length).to.eq(TARGET_ROW_STRIP_FACES);
    expect(faces[0].props('name')).to.eq(CardName.TARDIGRADES);
    expect(faces[0].props('card'), 'the face is handed the live model').to.deep.eq(CANDIDATES[0]);
    expect(faces[0].props('lightweight')).to.eq(true);
    expect(strip.find('[data-tgtrow-more]').text()).to.eq(translateTextWithParams('+${0} more', [String(CANDIDATES.length - TARGET_ROW_STRIP_FACES)]));
    expect(strip.find('.con-tgtrow__door').text()).to.eq('›');
    expect(strip.find('.con-tgtrow__handle').exists()).to.eq(false);
    expect(w.find('.con-composer__target').exists(), 'no answer is drawn').to.eq(false);
  });

  it('a strip that holds every candidate says no «ещё N» — and the card being played is a HANDLE in it, never a second face', () => {
    const w = row({candidates: CANDIDATES.slice(0, 3), sourceCard: CardName.ANTS});
    expect(w.find('[data-tgtrow-more]').exists()).to.eq(false);
    const cells = w.findAll('[data-tgtrow-card]');
    expect(cells.map((c) => [c.attributes('data-tgtrow-card'), c.classes()[0]])).to.deep.eq([
      [CardName.TARDIGRADES, 'con-tgtrow__mini'],
      [CardName.ANTS, 'con-tgtrow__handle'],
      [CardName.DECOMPOSERS, 'con-tgtrow__mini'],
    ]);
    expect(w.findAllComponents(FaceStub).map((f) => f.props('name'))).to.deep.eq([CardName.TARDIGRADES, CardName.DECOMPOSERS]);
  });

  it('a PAYLOAD turns the label into the question «КУДА: N [ресурс]» — its asker first, several kinds joined, a print handed to the one renderer', async () => {
    const w = row({label: 'Source card', payload: {amount: 3, icon: 'microbe'}});
    const label = () => w.find('.con-tgtrow__label');
    expect(label().find('.con-tgtrow__where').text()).to.eq($t('Where to') + ':');
    expect(label().text(), 'the role word yields to the payload').to.not.contain('Source card');
    expect(label().find('[data-tgtrow-asker]').exists()).to.eq(false);
    const payload = () => w.find('[data-tgtrow-payload]');
    expect(payload().attributes('data-tgtrow-payload-icon')).to.eq('microbe');
    expect(payload().find('.con-tgtrow__payload-num').text()).to.eq('3');
    expect(payload().find('.con-tgtrow__payload-icon').classes()).to.include.members(spriteOf('microbe'));
    expect(payload().find('.con-tgtrow__payload-sep').exists()).to.eq(false);

    // Somebody else than the composer's card asks: its name leads the question.
    await w.setProps({asker: 'Colony · Titan'});
    expect(label().find('[data-tgtrow-asker]').text()).to.eq('Colony · Titan');
    expect(label().find('.con-tgtrow__sep').text()).to.eq('·');

    // One unit of one of SEVERAL kinds: every kind, joined by the slant.
    await w.setProps({payload: {amount: 1, icon: '', icons: ['floater', 'microbe']}});
    expect(payload().findAll('[data-tgtrow-payload-kind]').map((k) => k.attributes('data-tgtrow-payload-kind'))).to.deep.eq(['floater', 'microbe']);
    expect(payload().findAll('.con-tgtrow__payload-sep').map((s) => s.text())).to.deep.eq(['/']);

    // The card's own PRINT speaks instead of «N [icon]».
    const printed = [{is: 'item'}, {is: 'item'}];
    await w.setProps({payload: {amount: 2, icon: 'microbe', printed}});
    expect(payload().find('.con-tgtrow__payload-num').exists()).to.eq(false);
    const nodes = w.findAllComponents(NodeStub);
    expect(nodes.length).to.eq(2);
    expect(nodes[0].props('node')).to.deep.eq(printed[0]);
  });

  it('ANSWERED: the chosen card\'s miniature is the card on this surface, with its name, its owner, the step\'s own tag — and only the readings the tag cannot print', async () => {
    const impacts = [impact('0:0', {tagSays: true, label: 'Payment'}), impact('0:1', {icon: 'delegate', from: 2, to: 3, outcome: 'opens'})];
    const w = row({candidates: CANDIDATES, result: RESULT, resultModel: card(CardName.ANTS, 2), tag: TAG, impacts});
    expect(w.attributes('data-tgtrow-state')).to.eq('answered');
    expect(w.attributes('data-seeded'), 'an answer the player gave carries no mark').to.eq(undefined);
    expect(w.find('[data-tgtrow-strip]').exists()).to.eq(false);

    const thumb = w.find('[data-composer-card]');
    expect(thumb.attributes('data-composer-card'), 'a flight end names its card').to.eq(CardName.ANTS);
    const face = w.findComponent(FaceStub);
    expect(face.props('name')).to.eq(CardName.ANTS);
    expect(face.props('card'), 'the capsule states the live count').to.deep.eq(card(CardName.ANTS, 2));
    expect(w.find('.con-composer__target-selflink').exists()).to.eq(false);
    expect(w.find('.con-composer__target-name').text()).to.eq($t(CardName.ANTS));
    expect(w.find('.con-composer__target-dot').classes()).to.include('player_bg_color_blue');
    const origin = w.find('.con-composer__target-origin');
    expect(origin.text()).to.eq('Ada');
    expect(origin.classes()).to.include('player_color_blue');

    const tag = w.find('[data-ptsel-tag]');
    expect(tag.attributes('data-ptsel-tag')).to.eq('gain');
    expect(tag.classes()).to.include.members(['con-ptsel__tag', 'con-tgtrow__tag', 'con-ptsel__tag--gain']);
    expect(w.findComponent(TagStub).props('tag')).to.deep.eq(TAG);

    // Beside a tag the row keeps the threshold's sentence and drops the reading whose numbers the tag prints whole.
    const readings = () => w.findAll('.con-ptsel__imp');
    expect(readings().length).to.eq(1);
    expect(readings()[0].classes()).to.include('con-ptsel__imp--opens');
    expect(readings()[0].classes()).to.not.include('con-ptsel__imp--down');
    expect(readings()[0].find('.con-ptsel__imp-icon').classes()).to.include.members(spriteOf('delegate'));
    expect(readings()[0].find('.con-ptsel__imp-label').text()).to.eq($t('Enough for a delegate'));
    expect(readings()[0].find('.con-ptsel__imp-delta').text().replace(/\s+/g, ' ')).to.eq('2 → 3');

    // A pick with NO tag (the source of a spend) keeps every reading.
    await w.setProps({tag: undefined});
    expect(w.find('[data-ptsel-tag]').exists()).to.eq(false);
    expect(readings().map((r) => r.find('.con-ptsel__imp-label').text())).to.deep.eq([$t('Payment'), $t('Enough for a delegate')]);

    // A SOURCE-CARD target draws no second face: the real card stands in the hero slot.
    await w.setProps({result: {...RESULT, relation: 'source-card'}});
    expect(w.find('[data-composer-card]').exists()).to.eq(false);
    expect(w.findComponent(FaceStub).exists()).to.eq(false);
    expect(w.find('.con-composer__target-selflink').text()).to.eq('↰');
  });

  it('the SOLE candidate\'s mark stands only on a seeded answer; the change affordance shows only under the cursor, its slot kept either way', async () => {
    const sole = {mark: 'only target', hint: 'The server offered one target'};
    const w = row({candidates: CANDIDATES.slice(0, 1), sole});
    expect(w.attributes('data-seeded'), 'an unanswered row is not seeded').to.eq(undefined);
    expect(w.find('[data-seeded-mark]').exists()).to.eq(false);

    await w.setProps({result: RESULT});
    expect(w.attributes('data-seeded')).to.eq('sole');
    const mark = w.find('[data-seeded-mark]');
    expect(mark.text()).to.eq($t(sole.mark));
    expect(mark.attributes('data-hint')).to.eq($t(sole.hint));

    const change = w.find('.con-composer__target-change');
    expect(change.classes()).to.not.include('con-composer__target-change--on');
    expect(w.findComponent(GlyphStub).props('control')).to.eq('confirm');
    expect(change.text()).to.eq($t('Change selection'));
    await w.setProps({focused: true});
    expect(change.classes()).to.include('con-composer__target-change--on');

    // The answer goes stale (a change of variant took it away): the strip stands again, the mark with it gone.
    await w.setProps({result: undefined});
    expect(w.attributes('data-tgtrow-state')).to.eq('open');
    expect(w.attributes('data-seeded')).to.eq(undefined);
    expect(w.find('[data-tgtrow-strip]').exists()).to.eq(true);
  });

  it('a PARENT\'s ref of it carries nothing — the row is driven by its props alone', () => {
    const held = shallowRef<Record<string, unknown> | null>(null);
    const Parent = defineComponent({
      name: 'TargetRowParent',
      setup: () => () => h('div', [h(ConsoleComposerTargetRow as never, {candidates: CANDIDATES, ref: held})]),
    });
    const wrapper = mount(Parent, {...globalConfig, global});
    expect(held.value, 'the parent\'s ref is set').to.not.eq(null);
    expect(Object.keys(held.value!), 'nothing is exposed').to.deep.eq([]);
    const leaked = ['shown', 'more', 'readings', 'moreText', 'iconClass', 'impactText', 'impactTail', 'candidates']
      .filter((key) => held.value![key] !== undefined);
    expect(leaked).to.deep.eq([]);
    wrapper.unmount();
    expect(held.value).to.eq(null);
  });
});

/*
 * ConsoleTenderActivation — THE ACTIVATION SHEET of a tender: the certificate as the hero of its own scene and, beside
 * it, the RESULT in the table's live numbers. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md):
 * what it renders for its props (the plan's rows and notes, the phases its host drives, «Целевой запрос»'s tag tiles),
 * and what it EXPOSES — its two hosts (the start scene, the carryover picker) stand it under a ref and read exactly
 * one member off it, `heroEl()`: the seat the certificate's flights land on and leave from. It emits nothing.
 *
 * The certificate is stubbed (its own spec's subject) — this spec reads what the sheet HANDS it.
 */
import {expect} from 'chai';
import {defineComponent, h} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import {Tag} from '@/common/cards/Tag';
import {$t} from '@/client/directives/i18n';
import {readingText} from '@/client/console/readingText';
import {TenderActivationPlan, tagGridCols} from '@/client/console/campaign/tenderActivation';
import {tenderMeta} from '@/client/console/campaign/tenderMeta';
import {variantOptionClasses} from '@/client/console/variantChoiceModel';
import ConsoleTenderActivation from '@/client/components/console/campaign/ConsoleTenderActivation.vue';

/** What a host reads through its ref — exactly the parents' own cast. */
type SheetReach = {heroEl?: () => HTMLElement | undefined};
/** One medallion of the chooser (the component's `ActivationTag`). */
type TagTile = {tag: Tag, label: string, count: number, iconStyle: Record<string, string>};

// (A render function, not a template string: the runtime compiler is not in this build.)
const TenderCardStub = defineComponent({
  name: 'ConsoleTenderCard',
  props: {
    id: {type: String, required: true},
    size: {type: String, default: undefined},
    state: {type: String, default: undefined},
  },
  render() {
    return h('i', {'class': 'tender-card-stub'});
  },
});

const STUBS = {ConsoleTenderCard: TenderCardStub};

const NOTE = {key: 'Executed, it no longer pays its ${0} M€ compensation', params: ['3'], tone: 'info'} as const;

const PLAN: TenderActivationPlan = {
  id: 'researchSubsidy',
  kind: 'confirm',
  verb: 'Execute the tender',
  rows: [
    {label: 'Price of a starting-hand card', from: 3, to: 2, unit: 'mc', tone: 'gain'},
    {label: 'You keep', to: 2, unit: 'prelude', tone: 'neutral'},
  ],
  notes: [NOTE],
};

const TAGS: ReadonlyArray<TagTile> = [
  {tag: Tag.SCIENCE, label: 'Science', count: 3, iconStyle: {'--tag-art': 'science'}},
  {tag: Tag.SPACE, label: 'Space', count: Infinity, iconStyle: {}},
  {tag: Tag.BUILDING, label: 'Building', count: 0, iconStyle: {}},
];

type SheetProps = {
  plan: TenderActivationPlan,
  heroHeld?: boolean,
  open?: boolean,
  committed?: boolean,
  stamping?: boolean,
  leaving?: boolean,
  busy?: boolean,
  tags?: ReadonlyArray<TagTile>,
  tagFocus?: number,
  tagPicked?: Tag,
};

function sheet(props: SheetProps) {
  return mount(ConsoleTenderActivation, {global: {...globalConfig.global, stubs: STUBS}, props});
}

describe('ConsoleTenderActivation — the activation sheet of a tender', () => {
  it('the plan: the certificate as the hero, the result\'s rows (`from → to` or a fact, each with its unit) and the notes', () => {
    const w = sheet({plan: PLAN});
    expect(w.classes(), 'at rest: not open, not leaving, not committed, no chooser').to.deep.eq(['con-tsheet']);
    expect(w.attributes('data-tender-sheet')).to.not.eq(undefined);
    expect(w.attributes('data-tender-sheet-id')).to.eq('researchSubsidy');
    expect(w.attributes('data-tender-sheet-kind')).to.eq('confirm');
    expect(w.attributes('data-tender-sheet-open')).to.eq(undefined);

    const hero = w.find('.con-tsheet__hero[data-tsheet-hero]');
    expect(hero.classes()).to.deep.eq(['con-tsheet__hero']);
    expect(w.findComponent(TenderCardStub).props()).to.deep.eq({id: 'researchSubsidy', size: 'table', state: 'held'});

    const panel = w.find('.con-tsheet__panel[data-tsheet-panel]');
    expect(panel.find('.con-tsheet__kicker').text()).to.eq($t('Result'));
    expect(panel.find('.con-tsheet__name').text()).to.eq($t(tenderMeta('researchSubsidy').nameKey));
    expect(panel.find('.con-tsheet__rule[data-tsheet-rule]').text()).to.eq($t(tenderMeta('researchSubsidy').ruleKey));

    const rows = panel.findAll('.con-tsheet__rows > .con-tsheet__row');
    expect(rows.map((r) => r.attributes('data-tsheet-row'))).to.deep.eq(['Price of a starting-hand card', 'You keep']);
    expect(rows.map((r) => r.attributes('data-tone'))).to.deep.eq(['gain', 'neutral']);
    expect(rows.map((r) => r.find('.con-tsheet__label').text())).to.deep.eq([$t('Price of a starting-hand card'), $t('You keep')]);
    expect(rows[0].find('[data-tsheet-from]').text()).to.eq('3');
    expect(rows[0].find('.con-tsheet__arrow').exists()).to.eq(true);
    expect(rows[0].find('[data-tsheet-to]').text()).to.eq('2');
    expect(rows[0].find('.resource_icon--megacredits.con-tsheet__mc').exists(), 'money wears the megacredit').to.eq(true);
    expect(rows[1].find('[data-tsheet-from]').exists(), 'a fact has no «from»').to.eq(false);
    expect(rows[1].find('.con-tsheet__arrow').exists()).to.eq(false);
    expect(rows[1].find('[data-tsheet-to]').text()).to.eq('2');
    expect(rows[1].find('.con-tsheet__unit').classes()).to.deep.eq(['con-tsheet__unit', 'con-tsheet__unit--prelude']);

    const notes = panel.findAll('.con-tsheet__notes > .con-tsheet__note');
    expect(notes.map((n) => n.text()), 'a reading with params goes through the ONE renderer').to.deep.eq([readingText({label: NOTE.key, params: [...NOTE.params]})]);
    expect(notes[0].text()).to.not.contain('${');
    expect(notes[0].attributes('data-tone')).to.eq('info');
    expect(panel.find('.con-tsheet__tags').exists()).to.eq(false);
    expect(panel.find('.con-tsheet__busy').exists()).to.eq(false);
  });

  it('the phases its host drives: the held seat, the open result, the stamp, the committed certificate, the fold', async () => {
    const w = sheet({plan: {...PLAN, rows: [], notes: []}, heroHeld: true});
    expect(w.find('.con-tsheet__hero').classes()).to.deep.eq(['con-tsheet__hero', 'con-tsheet__hero--held']);
    expect(w.find('.con-tsheet__rows').exists() || w.find('.con-tsheet__notes').exists(), 'an empty plan draws no empty list').to.eq(false);

    await w.setProps({heroHeld: false, open: true, busy: true});
    expect(w.classes()).to.deep.eq(['con-tsheet', 'con-tsheet--open']);
    expect(w.attributes('data-tender-sheet-open')).to.eq('yes');
    expect(w.find('.con-tsheet__busy').text()).to.eq($t('Executing…'));

    await w.setProps({busy: false, stamping: true, committed: true});
    expect(w.classes()).to.deep.eq(['con-tsheet', 'con-tsheet--open', 'con-tsheet--committed']);
    expect(w.find('.con-tsheet__hero').classes()).to.deep.eq(['con-tsheet__hero', 'con-tsheet__hero--stamping']);
    expect(w.findComponent(TenderCardStub).props('state'), 'the press landed: the certificate wears the stamp').to.eq('executed');

    await w.setProps({open: false, stamping: false, leaving: true});
    expect(w.classes()).to.deep.eq(['con-tsheet', 'con-tsheet--leaving', 'con-tsheet--committed']);
    expect(w.attributes('data-tender-sheet-open')).to.eq(undefined);
  });

  it('«Целевой запрос»: the tag tiles on the variant grammar — the cursor, the answer\'s seal, a refused tag shown with its mark', async () => {
    const w = sheet({plan: {...PLAN, id: 'targetedRequest', kind: 'tag'}, tags: TAGS, tagFocus: 1});
    expect(w.classes()).to.deep.eq(['con-tsheet', 'con-tsheet--tags']);
    const grid = w.find('.con-tsheet__tags.con-vchoice[data-tender-mode="tag"]');
    expect(grid.attributes('role')).to.eq('radiogroup');
    expect(grid.classes()).to.not.contain('con-vchoice--decided');
    expect((grid.element as HTMLElement).style.getPropertyValue('--tag-cols'), 'the host\'s walk reads the same columns').to.eq(String(tagGridCols(TAGS.length)));

    const tiles = () => grid.findAll('.con-vchoice__opt.con-tsheet__tag');
    const classesOf = (focus: number, picked: Tag | undefined) => TAGS.map((t, i) => {
      const facts = variantOptionClasses({focused: i === focus, selected: t.tag === picked, off: t.count === 0}, picked !== undefined);
      return ['con-vchoice__opt', 'con-tsheet__tag', ...Object.keys(facts).filter((name) => facts[name])];
    });
    expect(tiles().map((t) => t.classes())).to.deep.eq(classesOf(1, undefined));
    expect(tiles()[1].classes()).to.contain('con-vchoice__opt--focused');
    expect(tiles().map((t) => t.attributes('role'))).to.deep.eq(['radio', 'radio', 'radio']);
    expect(tiles().map((t) => t.attributes('data-tender-tag'))).to.deep.eq([Tag.SCIENCE, Tag.SPACE, Tag.BUILDING]);
    expect(tiles().map((t) => t.attributes('data-tender-tag-count')), 'an unknown count is no attribute').to.deep.eq(['3', undefined, '0']);
    expect(tiles().map((t) => t.attributes('data-tender-tag-off'))).to.deep.eq([undefined, undefined, 'yes']);
    expect(tiles().map((t) => t.attributes('aria-disabled'))).to.deep.eq(['false', 'false', 'true']);
    expect(tiles().map((t) => t.attributes('aria-checked'))).to.deep.eq(['false', 'false', 'false']);
    expect(tiles().map((t) => t.find('.con-tsheet__tag-name').text())).to.deep.eq(['Science', 'Space', 'Building']);
    expect(tiles().map((t) => t.find('.con-tsheet__tag-off').exists()), 'a tag the deck ran out of is shown refused, never hidden').to.deep.eq([false, false, true]);
    expect((tiles()[0].find('.con-tsheet__tag-icon').element as HTMLElement).style.getPropertyValue('--tag-art')).to.eq('science');

    await w.setProps({tagPicked: Tag.SCIENCE, tagFocus: 2});
    expect(grid.classes()).to.contain('con-vchoice--decided');
    expect(tiles().map((t) => t.classes())).to.deep.eq(classesOf(2, Tag.SCIENCE));
    expect(tiles().map((t) => t.attributes('aria-checked'))).to.deep.eq(['true', 'false', 'false']);
    expect(tiles().map((t) => t.attributes('data-tender-mode-picked'))).to.deep.eq(['yes', undefined, undefined]);
    expect(tiles().map((t) => t.find('.con-vchoice__seal').classes().includes('con-vchoice__seal--on')), 'the seal stays while the cursor walks on')
      .to.deep.eq([true, false, false]);
  });

  it('a PARENT\'s ref sees exactly `heroEl` — and it answers with the hero\'s seat itself', () => {
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleTenderActivation, {ref: 'sheetEl', plan: PLAN})]),
    });
    const host = mount(Host, {global: {...globalConfig.global, stubs: STUBS}});
    // Exactly the parents' read: `(this.$refs.sheetEl ?? undefined) as {heroEl?: () => HTMLElement | undefined} | undefined`.
    const reach = (host.vm.$refs.sheetEl ?? undefined) as SheetReach | undefined;
    expect(reach, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(reach!), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['heroEl']);
    for (const inner of ['hero', 'props', 'plan', 'tileClasses', 'noteText', 'nameKey']) {
      expect((reach as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }
    const seat = reach?.heroEl?.() ?? null;
    expect(seat, 'the node the flights measure — not a ref around it').to.eq(host.find('[data-tsheet-hero]').element);
    expect(seat?.querySelector('.tender-card-stub'), 'the certificate sits in it').to.not.eq(null);
  });
});

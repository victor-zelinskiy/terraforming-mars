/*
 * ConsoleDrawSearchRule — the search's rule as ONE inline phrase: each clause's word, then its object as the face's own
 * art. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): four props in, nothing out, nothing
 * exposed — the spec is what it renders for a descriptor, for several descriptors and for a ready list of clauses, and
 * the language-free signature the e2e specs read (`data-draw-search`). WHICH clauses a descriptor has is the pure
 * reading's (`drawSearchReading.ts`, spec'd on its own) — this spec asserts that the template prints them.
 */
import {expect} from 'chai';
import {DOMWrapper, mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Tag} from '@/common/cards/Tag';
import {CardType} from '@/common/cards/CardType';
import {CardResource} from '@/common/CardResource';
import {DrawSearchModel} from '@/common/models/CardDrawRevealModel';
import {DrawSearchTerm} from '@/client/console/deckDraw/drawSearchReading';
import {CARD_REQUIREMENT_ICON, NO_TAGS_ICON, cardResourceIconUrl, tagIconUrl} from '@/client/components/premiumCard/premiumCardIcons';
import ConsoleDrawSearchRule from '@/client/components/console/foundation/ConsoleDrawSearchRule.vue';

// The party plate is the premium face's own glyph — its own subject; this spec reads WHERE the rule seats it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const PartyGlyphStub = defineComponent({
  name: 'PremiumPartyRequirementGlyph',
  render: () => h('i', {class: 'party-glyph-stub'}),
});

type RuleProps = {
  search?: DrawSearchModel,
  searches?: ReadonlyArray<DrawSearchModel>,
  clauses?: ReadonlyArray<DrawSearchTerm>,
  size?: 'chip' | 'line',
};

function rule(props: RuleProps) {
  // No i18n plugin on purpose: the component imports its own `$t` — the global one is not there to lean on.
  return mount(ConsoleDrawSearchRule, {
    props,
    global: {config: globalConfig.global.config, stubs: {PremiumPartyRequirementGlyph: PartyGlyphStub}},
  });
}

/** The art an icon is painted with (its inline `background-image`). */
function art(icon: DOMWrapper<Element>): string {
  return (icon.element as HTMLElement).style.backgroundImage;
}

describe('ConsoleDrawSearchRule — the search\'s rule as one phrase', () => {
  it('one descriptor: the type in words, the tag as its medallion, the excluded tags struck — and the signature names them all', () => {
    const w = rule({search: {count: 2, type: CardType.EVENT, tag: Tag.SPACE, withoutTags: [Tag.PLANT, Tag.MICROBE]}});
    expect((w.element as HTMLElement).tagName).to.eq('SPAN');
    expect(w.classes(), 'a chip-sized rule by default').to.deep.eq(['con-dsearch', 'con-dsearch--chip']);
    expect(w.attributes('data-draw-search')).to.eq(`type:${CardType.EVENT} with:${Tag.SPACE} without:${Tag.PLANT},${Tag.MICROBE}`);

    const terms = w.findAll('.con-dsearch > .con-dsearch__term');
    expect(terms.map((term) => term.attributes('data-draw-search-term'))).to.deep.eq(['type', 'with', 'without']);
    expect(terms.map((term) => term.find('.con-dsearch__label').text()))
      .to.deep.eq([$t('event cards'), $t('with the tag'), $t('without the tags')]);

    expect(terms[0].findAll('.con-dsearch__tag, .con-dsearch__res'), 'a type is a noun — no icon').to.have.length(0);

    const medallion = terms[1].findAll('.con-dsearch__tag');
    expect(medallion).to.have.length(1);
    expect(medallion[0].attributes('data-tag')).to.eq(Tag.SPACE);
    expect(medallion[0].attributes('aria-hidden')).to.eq('true');
    expect(medallion[0].classes()).to.not.include('con-dsearch__tag--struck');
    expect(art(medallion[0])).to.contain(tagIconUrl(Tag.SPACE));

    const struck = terms[2].findAll('.con-dsearch__tag.con-dsearch__tag--struck');
    expect(struck.map((tag) => tag.attributes('data-tag')), 'in the printed rule\'s order').to.deep.eq([Tag.PLANT, Tag.MICROBE]);
    expect(art(struck[1])).to.contain(tagIconUrl(Tag.MICROBE));
  });

  it('the clauses with an icon of their own: a resource, the floater icon, the party plate, the requirement card, the blank tag', () => {
    const w = rule({search: {count: 1, resource: CardResource.MICROBE, floaterIcon: true, partyRequirement: true, requirement: true, noTags: true}});
    expect(w.attributes('data-draw-search')).to.eq(`resource:${CardResource.MICROBE} floaterIcon partyRequirement requirement noTags`);

    const terms = w.findAll('.con-dsearch__term');
    expect(terms.map((term) => term.attributes('data-draw-search-term')))
      .to.deep.eq(['resource', 'floaterIcon', 'partyRequirement', 'requirement', 'noTags']);
    expect(terms.map((term) => term.find('.con-dsearch__label').text())).to.deep.eq([
      $t('collecting'), $t('with a floater icon'), $t('with a party requirement'), $t('with a requirement'), $t('with no tags'),
    ]);

    expect(art(terms[0].find('.con-dsearch__res'))).to.contain(cardResourceIconUrl(CardResource.MICROBE));
    expect(art(terms[1].find('.con-dsearch__res')), 'the floater icon is the floater\'s own art').to.contain(cardResourceIconUrl(CardResource.FLOATER));

    const plate = terms[2].find('.party-glyph-stub');
    expect(plate.exists()).to.eq(true);
    expect(plate.classes()).to.include('con-dsearch__pprq');
    expect(w.findAllComponents(PartyGlyphStub)).to.have.length(1);

    const requirement = terms[3].find('.con-dsearch__res');
    expect(requirement.classes()).to.include('con-dsearch__req');
    expect(art(requirement)).to.contain(CARD_REQUIREMENT_ICON);

    const blank = terms[4].find('.con-dsearch__tag');
    expect(blank.attributes('data-tag')).to.eq('none');
    expect(art(blank)).to.contain(NO_TAGS_ICON);
  });

  it('several rules read as ONE phrase — a second lone tag continues the first rule\'s word; the size and the rules follow the props', async () => {
    const w = rule({searches: [{count: 1, tag: Tag.JOVIAN}, {count: 1, tag: Tag.VENUS}], size: 'line'});
    expect(w.classes()).to.deep.eq(['con-dsearch', 'con-dsearch--line']);
    expect(w.attributes('data-draw-search')).to.eq(`with:${Tag.JOVIAN} with:${Tag.VENUS}`);
    const terms = w.findAll('.con-dsearch__term');
    expect(terms.map((term) => term.find('.con-dsearch__label').exists()), 'the word is said once').to.deep.eq([true, false]);
    expect(terms.map((term) => term.find('.con-dsearch__tag').attributes('data-tag'))).to.deep.eq([Tag.JOVIAN, Tag.VENUS]);

    // The batch's rules win over a single descriptor passed beside them; without them the descriptor speaks.
    await w.setProps({search: {count: 1, tag: Tag.EARTH}});
    expect(w.attributes('data-draw-search')).to.eq(`with:${Tag.JOVIAN} with:${Tag.VENUS}`);
    await w.setProps({searches: undefined, size: 'chip'});
    expect(w.attributes('data-draw-search')).to.eq(`with:${Tag.EARTH}`);
    expect(w.classes()).to.deep.eq(['con-dsearch', 'con-dsearch--chip']);
  });

  it('a ready list of clauses is printed as given, every clause worded; nothing passed is an empty phrase', () => {
    const clauses: ReadonlyArray<DrawSearchTerm> = [{kind: 'with', tag: Tag.EARTH}, {kind: 'with', tag: Tag.SCIENCE}];
    const w = rule({clauses, search: {count: 1, tag: Tag.SPACE}});
    expect(w.attributes('data-draw-search'), 'the clauses win over a descriptor').to.eq(`with:${Tag.EARTH} with:${Tag.SCIENCE}`);
    const terms = w.findAll('.con-dsearch__term');
    expect(terms.map((term) => term.find('.con-dsearch__label').text())).to.deep.eq([$t('with the tag'), $t('with the tag')]);
    expect(terms.map((term) => term.find('.con-dsearch__tag').attributes('data-tag'))).to.deep.eq([Tag.EARTH, Tag.SCIENCE]);

    const empty = rule({});
    expect(empty.classes()).to.deep.eq(['con-dsearch', 'con-dsearch--chip']);
    expect(empty.attributes('data-draw-search')).to.eq('');
    expect(empty.findAll('.con-dsearch__term')).to.have.length(0);
  });
});

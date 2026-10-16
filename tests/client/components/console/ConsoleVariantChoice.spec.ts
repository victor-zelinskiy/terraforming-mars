import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsoleVariantChoice from '@/client/components/console/foundation/ConsoleVariantChoice.vue';
import {VariantChoiceOption} from '@/client/console/variantChoiceModel';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {ItemType} from '@/common/cards/render/Types';

/*
 * THE VARIANT CHOICE — the ONE grammar of «choose one of these» (TR51). The component renders the three facts as
 * three paints (the cursor, the answer — the ONE seal —, the rules with the reason inside the tile), the «ИЛИ»
 * medallion between mutually exclusive results only, the card's printed row when the host hands it, and the
 * radiogroup's ARIA; a click SELECTS (emits `pick`), never commits.
 */
const SCIENCE: ItemType = {is: 'item', type: CardRenderItemType.RESOURCE, amount: -1, resource: 'Science'} as unknown as ItemType;

function option(key: string, focused: boolean, selected: boolean, off: boolean, extra: Partial<VariantChoiceOption> = {}): VariantChoiceOption {
  return {key, state: {focused, selected, off}, title: key, ...extra};
}

function make(options: ReadonlyArray<VariantChoiceOption>, props: Record<string, unknown> = {}) {
  return mount(ConsoleVariantChoice, {...globalConfig, props: {options, label: 'Choose', ...props}});
}

describe('ConsoleVariantChoice', () => {
  it('«КУДА ЛЯЖЕТ» (TR56, П1): an option names its ADDRESSES — up to three holder faces and the count; one holder its name', () => {
    const holders = ['Dirigibles', 'Aerial Mappers', 'Floating Habs', 'Titan Shuttles'].map((name) => ({name, resources: 1}));
    const w = make([
      option('mechs', false, false, false, {destinations: {cards: [{name: 'Construction Mechs', resources: 2}] as never, count: 1}}),
      option('floaters', false, false, false, {destinations: {cards: holders as never, count: 4}}),
      option('fighters', false, false, true, {reason: 'No card'}),
    ]);
    const dest = w.findAll('[data-vchoice-dest]');
    expect(dest.map((d) => d.attributes('data-vchoice-dest-count')), 'a refused option has no addresses').deep.eq(['1', '4']);
    expect(dest[0].findAll('[data-vchoice-dest-card]').map((f) => f.attributes('data-vchoice-dest-card'))).deep.eq(['Construction Mechs']);
    expect(dest[0].find('[data-vchoice-dest-label]').text(), 'one holder names itself').eq('Construction Mechs');
    expect(dest[1].findAll('[data-vchoice-dest-card]'), 'the faces are capped — the count says the rest').has.length(3);
    expect(dest[1].find('[data-vchoice-dest-label]').text()).contains('4');
  });

  it('a radiogroup of radios — aria-checked is the ANSWER, aria-disabled the rules', () => {
    const w = make([option('a', true, false, false), option('b', false, true, false), option('c', false, false, true, {reason: 'No card'})]);
    expect(w.find('.con-vchoice').attributes('role')).eq('radiogroup');
    const radios = w.findAll('[role="radio"]');
    expect(radios.map((r) => r.attributes('aria-checked'))).deep.eq(['false', 'true', 'false']);
    expect(radios.map((r) => r.attributes('aria-disabled'))).deep.eq(['false', 'false', 'true']);
  });

  it('ONE mark of the answer: the seal is on the selected option only, and it is paint, not text', () => {
    const w = make([option('a', true, false, false), option('b', false, true, false)]);
    expect(w.findAll('.con-vchoice__seal--on')).has.length(1);
    expect(w.findAll('.con-vchoice__opt')[1].find('.con-vchoice__seal--on').exists()).is.true;
    expect(w.text()).not.to.contain('✓');
  });

  it('a decided group RECEDES its other live options — never the cursor\'s, never a refused one', () => {
    const w = make([option('a', false, true, false), option('b', false, false, false), option('c', true, false, false), option('d', false, false, true)]);
    const recede = w.findAll('.con-vchoice__opt').map((o) => o.classes().includes('con-vchoice__opt--recede'));
    expect(recede).deep.eq([false, true, false, false]);
  });

  it('a refused option carries its reason INSIDE the tile; a refused option without one says nothing (one loss, one voice)', () => {
    const w = make([option('a', false, false, true, {reason: 'No card to add the resource to'}), option('b', false, false, true)]);
    const reasons = w.findAll('.con-vchoice__reason');
    expect(reasons).has.length(1);
    expect(reasons[0].text()).to.contain('No card to add the resource to');
  });

  it('«ИЛИ» stands between EXCLUSIVE results only — a pick list has none', () => {
    expect(make([option('a', false, false, false), option('b', false, false, false), option('c', false, false, false)]).findAll('.con-vchoice__or')).has.length(2);
    expect(make([option('a', false, false, false), option('b', false, false, false)], {exclusive: false, layout: 'list'}).findAll('.con-vchoice__or')).has.length(0);
  });

  it('the printed row renders the face nodes it is handed; a door draws its ›; the host\'s attributes ride the tile', () => {
    const w = make([
      option('a', false, false, false, {printed: [SCIENCE], title: ''}),
      option('b', false, false, false, {door: true, attrs: {'data-branch-pos': '1'}}),
    ]);
    const [a, b] = w.findAll('.con-vchoice__opt');
    expect(a.find('[data-vchoice-print]').exists()).is.true;
    expect(a.find('.con-vchoice__head').exists(), 'no words, no head — the print speaks alone').is.false;
    expect(b.find('.con-vchoice__door').exists()).is.true;
    expect(b.attributes('data-branch-pos')).eq('1');
  });

  it('a click SELECTS — it emits the option\'s index, it never commits', async () => {
    const w = make([option('a', false, false, false), option('b', false, false, false)]);
    await w.findAll('.con-vchoice__opt')[1].trigger('click');
    expect(w.emitted('pick')).deep.eq([[1]]);
  });

  it('the layout is a class of the group (compare · column · list)', () => {
    expect(make([option('a', false, false, false)], {layout: 'column'}).classes()).to.include('con-vchoice--column');
    expect(make([option('a', false, false, false)], {layout: 'list'}).classes()).to.include('con-vchoice--list');
    expect(make([option('a', false, false, false)]).classes()).to.include('con-vchoice--compare');
  });

  describe('THE PALETTE (TR54) — the hero, the number, the quiet zero, one kicker, no medallion', () => {
    const hero = (icon: string, amount: number): Partial<VariantChoiceOption> => ({title: '', hero: {kind: 'resource', icon, amount, direction: 'gain'}});
    const six = () => [
      option('m', false, false, false, {...hero('megacredits', 0), quiet: 'production 0'}),
      option('s', true, false, false, hero('steel', 2)),
      option('t', false, false, false, {...hero('titanium', 0), quiet: 'production 0'}),
      option('p', false, true, false, hero('plants', 3)),
      option('e', false, false, false, hero('energy', 1)),
      option('h', false, false, false, hero('heat', 4)),
    ];

    it('every tile leads with the own sprite of its resource and its number — no print, no words', () => {
      const w = make(six(), {layout: 'palette', kicker: 'One of 6', emblem: 'wild'});
      expect(w.classes()).to.include('con-vchoice--palette');
      const heroes = w.findAll('[data-vchoice-hero]');
      expect(heroes.map((h) => h.attributes('data-vchoice-hero-icon'))).deep.eq(['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']);
      expect(heroes[1].find('.con-vchoice__heroicon').classes()).to.include.members(['resource_icon', 'resource_icon--steel']);
      expect(w.findAll('[data-vchoice-figure]').map((f) => f.text())).deep.eq(['0', '+2', '0', '+3', '+1', '+4']);
      expect(w.findAll('[data-vchoice-print]')).has.length(0);
      expect(w.findAll('.con-vchoice__title')).has.length(0);
    });

    it('a zero stays a full answer: quiet (its line inside), never refused, never hidden — six radios', () => {
      const w = make(six(), {layout: 'palette'});
      expect(w.findAll('[role="radio"]')).has.length(6);
      const tiles = w.findAll('.con-vchoice__opt');
      expect(tiles.map((t) => t.classes().includes('con-vchoice__opt--quiet'))).deep.eq([true, false, true, false, false, false]);
      expect(tiles.some((t) => t.classes().includes('con-vchoice__opt--off'))).is.false;
      expect(tiles[2].find('[data-vchoice-quiet]').text()).to.contain('production 0');
      expect(tiles[0].find('.con-vchoice__figure').classes()).to.include('con-vchoice__figure--zero');
    });

    it('ONE kicker with the printed «?» at its start, and no «ИЛИ» medallion between the tiles', () => {
      const w = make(six(), {layout: 'palette', kicker: 'One of 6', emblem: 'wild'});
      expect(w.findAll('[data-vchoice-kicker]')).has.length(1);
      expect(w.find('[data-vchoice-emblem="wild"]').attributes('src')).eq('assets/resources/wild.png');
      expect(w.find('[data-vchoice-kicker]').text()).eq('One of 6');
      expect(w.findAll('.con-vchoice__or')).has.length(0);
      expect(w.findAll('.con-vchoice__seal--on')).has.length(1);
    });

    it('the kicker belongs to the palette — a comparison draws none, and keeps its medallions', () => {
      const w = make([option('a', false, false, false), option('b', false, false, false)], {kicker: 'One of 2', emblem: 'wild'});
      expect(w.findAll('[data-vchoice-kicker]')).has.length(0);
      expect(w.findAll('.con-vchoice__or')).has.length(1);
    });

    it('a production hero stands on its bronze plate; a loss reads «−N»', () => {
      const w = make([
        option('a', false, false, false, {title: '', hero: {kind: 'production', icon: 'heat', amount: 1, direction: 'loss'}}),
        option('b', false, false, false, {title: '', hero: {kind: 'production', icon: 'steel', amount: 1, direction: 'loss'}}),
      ], {layout: 'palette'});
      expect(w.findAll('.con-vchoice__heroplate--prod')).has.length(2);
      expect(w.findAll('[data-vchoice-figure]').map((f) => f.text())).deep.eq(['−1', '−1']);
      expect(w.find('.con-vchoice__figure').classes()).to.include('con-vchoice__figure--loss');
    });
  });
});

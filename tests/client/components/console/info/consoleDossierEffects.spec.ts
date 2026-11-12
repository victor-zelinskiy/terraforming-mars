/*
 * ConsoleDossierEffects — the dossier's effects plate (TR60): the seat's passive effects counted per FAMILY (a
 * medallion with a symbol that reads without colour), the cards that carry them as a row of art coins, the seat's
 * quiet line under them. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). Read-only — it
 * renders its props and emits nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import ConsoleDossierEffects from '@/client/components/console/info/ConsoleDossierEffects.vue';
import {CardName} from '@/common/cards/CardName';
import {$t} from '@/client/directives/i18n';
import {cardArtUrl, cardArtUrlAtTier, CARD_ART_FALLBACK_URL} from '@/client/cards/cardArt';
import {DossierEffectFamily} from '@/client/console/infoDossierModel';

const FAMILIES: ReadonlyArray<DossierEffectFamily> = [
  {family: 'armed', label: 'Armed for your next card', count: 1},
  {family: 'triggers', label: 'Triggers', count: 4},
  {family: 'discounts', label: 'Discounts', count: 2},
  {family: 'payValue', label: 'Payment value', count: 1},
  {family: 'rules', label: 'Rules', count: 3},
];

const CARDS: ReadonlyArray<CardName> = [
  CardName.BIRDS, CardName.PETS, CardName.AI_CENTRAL, CardName.DIRIGIBLES,
  CardName.ANTS, CardName.FISH, CardName.TARDIGRADES, CardName.LIVESTOCK,
];

/** The art a coin paints: the card's own picture at the thumb tier, the shared fallback for a card with none. */
function thumbOf(name: CardName): string {
  const url = cardArtUrl(name);
  return url === undefined ? CARD_ART_FALLBACK_URL : cardArtUrlAtTier(url, 'thumb');
}

describe('ConsoleDossierEffects — the dossier\'s effects plate', () => {
  it('a medallion per family: its symbol, its count, its name — in the order the host gives', () => {
    const w = mount(ConsoleDossierEffects, {...globalConfig, props: {families: FAMILIES}});
    expect(w.classes()).to.deep.eq(['con-deffs']);
    expect(w.attributes('data-dossier-effects')).to.not.eq(undefined);
    const discs = w.findAll('[data-dossier-effect]');
    expect(discs.map((d) => [d.attributes('data-dossier-effect'), d.find('.con-deff__glyph').text(), d.find('.con-deff__count').text()])).to.deep.eq([
      ['armed', '◆', '1'],
      ['triggers', '↻', '4'],
      ['discounts', '−', '2'],
      ['payValue', '×', '1'],
      ['rules', '≡', '3'],
    ]);
    expect(discs.map((d) => d.find('.con-deff__label').text())).to.deep.eq(FAMILIES.map((f) => $t(f.label)));
    expect(discs[1].classes()).to.include.members(['con-deff', 'con-deff--triggers']);
    expect(w.find('[data-dossier-empty]').exists()).to.eq(false);
    expect(w.find('.con-deffs__cards').exists(), 'no cards handed — no coin row').to.eq(false);
    expect(w.find('.con-deffs__note').exists(), 'no note — no line').to.eq(false);
  });

  it('no passive effects: the silhouettes of the discs and one line', () => {
    const w = mount(ConsoleDossierEffects, {...globalConfig, props: {families: []}});
    expect(w.classes()).to.include.members(['con-deffs', 'con-deffs--empty']);
    expect(w.find('.con-deffs__families').exists()).to.eq(false);
    const empty = w.find('[data-dossier-empty="effects"]');
    expect(empty.findAll('.con-deff__disc--ghost')).has.length(2);
    expect(empty.find('.con-deffs__voidline').text()).to.eq($t('No passive effects'));
  });

  it('the cards that carry the effects are art coins, in tableau order — past the limit they are COUNTED', async () => {
    const w = mount(ConsoleDossierEffects, {...globalConfig, props: {families: FAMILIES, cards: CARDS, note: 'Whole game: 12'}});
    const coins = w.findAll('.con-deffs__cards .con-deffs__coin');
    expect(coins, 'six coins by default').has.length(6);
    coins.forEach((coin, i) => expect(coin.attributes('style'), `coin ${i} is the ${i}-th card's art`).to.contain(thumbOf(CARDS[i])));
    expect(w.find('.con-deffs__coinmore').text()).to.eq('+2');
    expect(w.find('.con-deffs__note').text()).to.eq('Whole game: 12');

    // The row follows its props.
    await w.setProps({maxCards: 3});
    expect(w.findAll('.con-deffs__coin')).has.length(3);
    expect(w.find('.con-deffs__coinmore').text()).to.eq('+5');
    await w.setProps({maxCards: 8});
    expect(w.findAll('.con-deffs__coin')).has.length(8);
    expect(w.find('.con-deffs__coinmore').exists(), 'everything fits — no «+K»').to.eq(false);
  });
});

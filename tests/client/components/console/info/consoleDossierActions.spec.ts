/*
 * ConsoleDossierActions — the dossier's actions plate (TR60): the seat's action cards as TILES whose state is a
 * SHAPE, the legend saying the same counts in the same shapes. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md). Read-only — it renders its props and emits nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import ConsoleDossierActions from '@/client/components/console/info/ConsoleDossierActions.vue';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {$t} from '@/client/directives/i18n';
import {cardArtUrl, cardArtUrlAtTier, CARD_ART_FALLBACK_URL} from '@/client/cards/cardArt';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {DossierActionState, DossierActionTile, dossierPlateTiles} from '@/client/console/infoDossierModel';

const tile = (name: string, state: DossierActionState): DossierActionTile => ({name, state});

/** The art a tile paints: the card's own picture at the thumb tier, the shared fallback for a card with none. */
function thumbOf(name: CardName): string {
  const url = cardArtUrl(name);
  return url === undefined ? CARD_ART_FALLBACK_URL : cardArtUrlAtTier(url, 'thumb');
}

describe('ConsoleDossierActions — the dossier\'s actions plate', () => {
  it('a tile per action card: its art, its name and its STATE as a shape — and the legend counts the same shapes', () => {
    const tiles = [tile(CardName.BIRDS, 'ready'), tile(CardName.PETS, 'ready'), tile(CardName.AI_CENTRAL, 'blocked'), tile(CardName.DIRIGIBLES, 'used')];
    const w = mount(ConsoleDossierActions, {...globalConfig, props: {tiles}});
    expect(w.classes()).to.contain('con-dacts');
    expect(w.attributes('data-dossier-actions')).to.eq('4');
    expect((w.find('.con-dacts__grid').element as HTMLElement).style.getPropertyValue('--dact-cols'), 'four columns by default').to.eq('4');

    const cells = w.findAll('[data-dossier-action]');
    expect(cells.map((c) => [c.attributes('data-dossier-action'), c.attributes('data-action-state'), c.find('.con-dact__mark').text()])).to.deep.eq([
      [CardName.BIRDS, 'ready', '▶'],
      [CardName.PETS, 'ready', '▶'],
      [CardName.AI_CENTRAL, 'blocked', '✕'],
      [CardName.DIRIGIBLES, 'used', '✓'],
    ]);
    expect(cells.map((c) => c.find('.con-dact__name').text())).to.deep.eq(tiles.map((t) => $t(t.name)));
    expect(cells[2].classes()).to.include.members(['con-dact', 'con-dact--blocked']);
    expect(cells[0].find('.con-dact__art').attributes('style')).to.contain(thumbOf(CardName.BIRDS));
    expect(w.find('[data-dossier-action-more]').exists(), 'everything fits — no «+K»').to.eq(false);
    expect(w.find('[data-dossier-empty]').exists()).to.eq(false);

    // The legend: only the states that exist, in reading order — the shape, the count, the word.
    const counts = w.findAll('[data-dossier-action-legend] [data-action-count]');
    expect(counts.map((c) => [c.attributes('data-action-count'), c.find('.con-dacts__countmark').text(), c.find('b').text(), c.find('span:last-child').text()])).to.deep.eq([
      ['ready', '▶', '2', $t('Available now')],
      ['blocked', '✕', '1', $t('Not available')],
      ['used', '✓', '1', $t('Used this generation')],
    ]);
    expect(counts[0].classes()).to.include.members(['con-dacts__count', 'con-dacts__count--ready']);
  });

  it('a PARLIAMENT action stands among the cards — the party\'s emblem in the art\'s place, its own name', () => {
    const political: DossierActionTile = {name: 'party:' + PartyName.GREENS, political: {party: PartyName.GREENS, title: 'Greens'}, state: 'idle'};
    const w = mount(ConsoleDossierActions, {...globalConfig, props: {tiles: [political], columns: 3}});
    expect((w.find('.con-dacts__grid').element as HTMLElement).style.getPropertyValue('--dact-cols')).to.eq('3');
    const cell = w.find(`[data-dossier-action="${political.name}"]`);
    expect(cell.attributes('data-action-state')).to.eq('idle');
    expect(cell.find('.con-dact__mark').text()).to.eq('○');
    expect(cell.find('.con-dact__name').text()).to.eq($t('Greens'));
    const art = cell.find('.con-dact__art.con-dact__art--party');
    expect((art.element as HTMLElement).style.getPropertyValue('--parl-accent')).to.eq(partyAccent(PartyName.GREENS));
    expect(art.find('img.con-dact__emblem').attributes('src')).to.eq(partyEmblemUrl(PartyName.GREENS));
    expect(w.find('[data-action-count="idle"] span:last-child').text()).to.eq($t('Not used yet'));
  });

  it('more tiles than the plate holds: the rest are COUNTED («+K») — and the legend still counts them all', async () => {
    const names = [CardName.BIRDS, CardName.PETS, CardName.AI_CENTRAL, CardName.DIRIGIBLES, CardName.ANTS, CardName.FISH];
    const tiles = names.map((name, i) => tile(name, i < 5 ? 'ready' : 'used'));
    const w = mount(ConsoleDossierActions, {...globalConfig, props: {tiles, max: 4}});
    const shown = dossierPlateTiles(tiles, 4).map((t) => t.name);
    expect(shown.length, 'the model keeps a cell for «+K»').to.be.lessThan(tiles.length);
    expect(w.attributes('data-dossier-actions'), 'the zone knows them all').to.eq('6');
    expect(w.findAll('[data-dossier-action]').map((c) => c.attributes('data-dossier-action'))).to.deep.eq(shown);
    expect(w.find('[data-dossier-action-more] .con-dact__morenum').text()).to.eq(`+${tiles.length - shown.length}`);
    expect(w.findAll('[data-action-count]').map((c) => [c.attributes('data-action-count'), c.find('b').text()])).to.deep.eq([['ready', '5'], ['used', '1']]);

    // The plate follows its props: with room for all of them the «+K» cell is gone.
    await w.setProps({max: 8});
    expect(w.findAll('[data-dossier-action]')).has.length(6);
    expect(w.find('[data-dossier-action-more]').exists()).to.eq(false);
  });

  it('no action cards: the silhouette of a tile and one line — no grid, no legend', () => {
    const w = mount(ConsoleDossierActions, {...globalConfig, props: {tiles: []}});
    expect(w.attributes('data-dossier-actions')).to.eq('0');
    expect(w.find('.con-dacts__grid').exists()).to.eq(false);
    const empty = w.find('[data-dossier-empty="actions"]');
    expect(empty.find('.con-dact--ghost .con-dact__art').exists()).to.eq(true);
    expect(empty.find('.con-dacts__voidline').text()).to.eq($t('No action cards on the table'));
    expect(w.find('[data-dossier-action-legend]').exists()).to.eq(false);
  });
});

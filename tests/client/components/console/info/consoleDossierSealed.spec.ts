/*
 * ConsoleDossierSealed — the SEALED score of another seat (TR60, decision 7a). A `<script setup>` component (step A
 * of docs/claude/vapor/RECIPES.md): fed `dossierSealedFacts` (which reads no score at all), it says what is sealed and
 * why, and shows what that seat has already put on the table — never a VP number. It emits and exposes nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {DossierSealedFacts} from '@/client/console/infoDossierModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {maArtPath} from '@/client/console/maArt';
import {getPreferences} from '@/client/utils/PreferencesManager';
import ConsoleDossierSealed from '@/client/components/console/info/ConsoleDossierSealed.vue';

const facts = (over: Partial<DossierSealedFacts> = {}): DossierSealedFacts => ({
  rating: 27,
  milestones: [{name: 'Terraformer', slug: 'terraformer'}, {name: 'Mayor', slug: 'mayor'}],
  awards: [],
  ...over,
});

const sealed = (props: {facts: DossierSealedFacts}) => mount(ConsoleDossierSealed, {...globalConfig, props});
const art = (slug: string) => maArtPath(slug, getPreferences().lang);

describe('ConsoleDossierSealed — another seat\'s score under its seal', () => {
  it('the sealed cell says WHAT is sealed and WHY — the shield under its mask, not one number of the score', () => {
    const w = sealed({facts: facts()});
    expect((w.element as HTMLElement).tagName, 'the template starts with its root').to.eq('DIV');
    expect(w.classes()).to.include('con-dsealed');
    expect(w.attributes('data-dossier-sealed')).to.not.eq(undefined);
    const cell = w.find('.con-dsealed__cell');
    expect(cell.find('.con-dsealed__seal .con-dsealed__shield').text(), 'the award shield, localized').to.eq($t('VP'));
    expect(cell.find('.con-dsealed__lock .vp-private').exists(), 'the privacy mask on the shield').to.eq(true);
    expect(cell.find('.con-dsealed__title').text()).to.eq($t('The score opens at the final scoring'));
    expect(cell.find('.con-dsealed__why').text()).to.eq($t('The game settings keep other players\' points hidden until the end'));
    expect(cell.text(), 'the cell prints no number at all').to.not.match(/\d/);
  });

  it('what the seat put ON THE TABLE: its rating, the milestones it claimed, the awards it funded — as objects', () => {
    const w = sealed({facts: facts()});
    expect(w.find('[data-dossier-public] .con-dsealed__kicker').text()).to.eq($t('Already on the table'));
    const fact = (key: string) => w.find(`[data-dossier-public-fact="${key}"]`);

    expect(fact('rating').find('.con-dsealed__value').text()).to.eq('27');
    expect(fact('rating').find('.con-dsealed__label').text()).to.eq($t('TR'));
    expect(fact('rating').find('i.con-dsealed__glyph').classes()).to.include.members(iconClassFor('tr').split(' ').filter((c) => c !== ''));
    expect(fact('rating').find('[data-dossier-veto]').exists(), 'no veto — no line').to.eq(false);

    const emblems = fact('milestones').findAll('img.con-dsealed__emblem');
    expect(emblems.map((img) => img.attributes('src'))).to.deep.eq([art('terraformer'), art('mayor')]);
    expect(emblems.map((img) => img.attributes('alt'))).to.deep.eq([$t('Terraformer'), $t('Mayor')]);
    expect(fact('milestones').find('.con-dsealed__glyph--none').exists()).to.eq(false);
    expect(fact('milestones').find('.con-dsealed__value').text()).to.eq('2');
    expect(fact('milestones').find('.con-dsealed__label').text()).to.eq($t('Milestones'));

    // Nothing funded: the disc keeps its quiet mark and the count reads zero.
    expect(fact('awards').findAll('img.con-dsealed__emblem')).to.have.length(0);
    expect(fact('awards').find('.con-dsealed__glyph--none').exists()).to.eq(true);
    expect(fact('awards').find('.con-dsealed__value').text()).to.eq('0');
    expect(fact('awards').find('.con-dsealed__label').text()).to.eq($t('Awards'));
  });

  it('a disc shows three emblems at most — the count beside it says how many there are', () => {
    const awards = ['banker', 'miner', 'scientist', 'thermalist'].map((slug) => ({name: slug, slug}));
    const w = sealed({facts: facts({awards})});
    const fact = w.find('[data-dossier-public-fact="awards"]');
    expect(fact.findAll('img.con-dsealed__emblem').map((img) => img.attributes('src'))).to.deep.eq([art('banker'), art('miner'), art('scientist')]);
    expect(fact.find('.con-dsealed__value').text()).to.eq('4');
  });

  it('a seat under the rating veto has the LAW named beside its rating — and the line follows the facts', async () => {
    const w = sealed({facts: facts({veto: {law: 'UNMI Veto'}})});
    const veto = () => w.find('[data-dossier-public-fact="rating"] [data-dossier-veto]');
    expect(veto().text()).to.eq(translateTextWithParams('under the veto of ${0}', [translateTextWithParams('UNMI Veto', [])]));
    expect(veto().text(), 'the law\'s name is in the line, no raw placeholder').to.not.contain('${0}');
    await w.setProps({facts: facts()});
    expect(veto().exists()).to.eq(false);
    expect(w.find('[data-dossier-public-fact="rating"] .con-dsealed__value').text()).to.eq('27');
  });
});

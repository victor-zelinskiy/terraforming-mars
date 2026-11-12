/*
 * ConsoleTargetDossierPanel — the card read AS A TARGET, beside the fullscreen viewer. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md): read-only, no children, no emits, nothing exposed — its contract is what
 * it prints for the dossier it is handed (`playedTargetDossier.ts` builds it; this draws).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {$t} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {readingLineText} from '@/client/console/readingText';
import {PlayedTargetImpact} from '@/client/console/played/consolePlayedTargetModel';
import {PlayedTargetDossier} from '@/client/console/played/playedTargetDossier';
import ConsoleTargetDossierPanel from '@/client/components/console/played/ConsoleTargetDossierPanel.vue';

function dossier(over: Partial<PlayedTargetDossier> = {}): PlayedTargetDossier {
  return {
    cardName: CardName.TARDIGRADES,
    owner: {name: 'Rival', color: 'red', self: false},
    sections: [],
    selfHarm: false,
    ...over,
  };
}

function panel(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(ConsoleTargetDossierPanel as any, {...globalConfig, props, attrs});
}

/** The classes the shared resolver gives an icon key — what a glyph of the panel must wear. */
const spriteOf = (key: string): Array<string> => iconClassFor(key).split(' ').filter((c) => c !== '');
/** The two facts of «now»: their labels, in order. */
const factLabels = (w: ReturnType<typeof panel>): Array<string> =>
  w.findAll('[data-target-dossier-now] .con-tdossier__fact-label').map((l) => l.text());

describe('ConsoleTargetDossierPanel — the card as a target', () => {
  it('names the card and WHOSE it is — a seat by its name and colour, the viewer\'s own in a word', async () => {
    const w = panel({dossier: dossier()});
    expect(w.classes()).to.include('con-tdossier');
    expect(w.classes()).to.not.include('con-tdossier--closing');
    expect(w.classes()).to.not.include('con-tdossier--blocked');
    expect(w.attributes('data-target-dossier')).to.not.eq(undefined);
    expect(w.attributes('data-target-dossier-card')).to.eq(CardName.TARDIGRADES);
    expect(w.find('.con-tdossier__kicker').text()).to.eq($t('Target'));
    expect(w.find('.con-tdossier__dot').classes()).to.include('player_bg_color_red');
    expect(w.find('.con-tdossier__owner-name').text()).to.eq('Rival');
    expect(w.find('.con-tdossier__warn').exists()).to.eq(false);

    await w.setProps({dossier: dossier({owner: {name: 'Me', color: 'blue', self: true}, selfHarm: true}), closing: true});
    expect(w.find('.con-tdossier__dot').classes()).to.include('player_bg_color_blue');
    expect(w.find('.con-tdossier__owner-name').text()).to.eq($t('Your card'));
    expect(w.find('.con-tdossier__warn').text()).to.contain($t('This is your own card'));
    expect(w.classes(), 'the zoom\'s close flight began').to.include('con-tdossier--closing');
  });

  it('what lies on it NOW and what LANDS — the landing unit is the step\'s kind, or the kind this card keeps', async () => {
    const bare = panel({dossier: dossier()});
    expect(factLabels(bare), 'a card that holds nothing, a step that names no payload').to.deep.eq([]);

    const w = panel({dossier: dossier({holding: {icon: 'microbe', count: 2}, payload: {amount: 3, icon: 'floater'}})});
    expect(factLabels(w)).to.deep.eq([$t('On this card now'), $t('Lands here')]);
    expect(w.find('[data-target-dossier-count]').text()).to.eq('2');
    const values = w.findAll('.con-tdossier__fact-value');
    expect(values[0].find('.con-tdossier__icon').classes()).to.include.members(spriteOf('microbe'));
    expect(values[1].classes()).to.include('con-tdossier__fact-value--gain');
    expect(values[1].find('b').text()).to.eq('+3');
    expect(values[1].find('.con-tdossier__icon').classes(), 'the step\'s own kind').to.include.members(spriteOf('floater'));

    // A pick of ANY kind (the payload names none): the unit that lands wears the kind THIS card keeps.
    await w.setProps({dossier: dossier({holding: {icon: 'microbe', count: 2}, payload: {amount: 1, icon: ''}})});
    expect(w.findAll('.con-tdossier__fact-value')[1].find('.con-tdossier__icon').classes()).to.include.members(spriteOf('microbe'));

    // …and with no kind on either side nothing is promised to land.
    await w.setProps({dossier: dossier({payload: {amount: 1, icon: ''}})});
    expect(factLabels(w)).to.deep.eq([]);
  });

  it('what THIS move does — every section, every impact in full: its reading, its goods, its vector', () => {
    const grows: PlayedTargetImpact = {label: 'Microbes', icon: 'microbe', from: 2, to: 3, outcome: 'gain'};
    const falls: PlayedTargetImpact = {label: 'Animals', icon: 'animal', from: 4, to: 1};
    const pays: PlayedTargetImpact = {label: 'Payment: +${0} M€', params: ['5'], tail: 'for Space cards', icons: ['steel', 'titanium'], join: 'and', amount: 5};
    const loses: PlayedTargetImpact = {label: 'Tardigrades', translate: false, icons: ['steel', 'titanium'], amount: -2};
    const w = panel({dossier: dossier({sections: [
      {key: 'card', title: 'This card', impacts: [grows, falls], note: 'Nothing else changes'},
      {key: 'you', title: 'You', impacts: [pays, loses]},
    ]})});

    const sections = w.findAll('[data-target-dossier-section]');
    expect(sections.map((s) => s.attributes('data-target-dossier-section'))).to.deep.eq(['card', 'you']);
    expect(sections.map((s) => s.find('.con-tdossier__section-title').text())).to.deep.eq([$t('This card'), $t('You')]);
    expect(sections[0].find('.con-tdossier__note').text()).to.eq($t('Nothing else changes'));
    expect(sections[1].find('.con-tdossier__note').exists()).to.eq(false);

    const [up, down] = sections[0].findAll('.con-tdossier__row');
    expect(up.attributes('data-impact-outcome')).to.eq('gain');
    expect(up.find('.con-tdossier__row-label').text()).to.eq(readingLineText(grows));
    expect(up.find('.con-tdossier__row-icons .con-tdossier__icon').classes()).to.include.members(spriteOf('microbe'));
    expect(up.find('.con-tdossier__row-delta').text().replace(/\s+/g, '')).to.eq('2→3');
    expect(up.find('.con-tdossier__row-delta').classes()).to.not.include('con-tdossier__row-delta--down');
    expect(down.attributes('data-impact-outcome')).to.eq(undefined);
    expect(down.find('.con-tdossier__row-delta').classes(), 'a count that falls').to.include('con-tdossier__row-delta--down');

    const [gain, loss] = sections[1].findAll('.con-tdossier__row');
    expect(gain.find('.con-tdossier__row-label').text(), 'ONE renderer for a reading with params — and its tail').to.eq(readingLineText(pays));
    expect(gain.find('.con-tdossier__row-label').text()).to.not.contain('${');
    expect(gain.findAll('.con-tdossier__row-icons .con-tdossier__icon').length).to.eq(2);
    expect(gain.find('.con-tdossier__row-join').text(), 'a SET of goods').to.eq('+');
    expect(gain.find('.con-tdossier__row-delta').text()).to.eq('+5');
    expect(loss.find('.con-tdossier__row-label').text(), 'a resolved name is printed as is').to.eq('Tardigrades');
    expect(loss.find('.con-tdossier__row-join').text(), 'a CHOICE of goods').to.eq('/');
    expect(loss.find('.con-tdossier__row-delta').text()).to.eq('-2');
  });

  it('a NEAR MISS says why and how far — «have / need» — and the panel wears the block', () => {
    const w = panel({dossier: dossier({blocked: {reason: 'Not enough data here', have: 1, need: 2}})}, {'data-from-host': 'yes'});
    expect((w.element as HTMLElement).tagName, 'the template starts with its root').to.eq('SECTION');
    expect(w.attributes('data-from-host')).to.eq('yes');
    expect(w.classes()).to.include('con-tdossier--blocked');
    const blocked = w.find('[data-target-dossier-blocked]');
    expect(blocked.text()).to.contain('Not enough data here');
    expect(blocked.find('b').text().replace(/\s+/g, '')).to.eq('1/2');
  });
});

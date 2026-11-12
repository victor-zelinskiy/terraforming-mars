import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsoleOvRich from '@/client/components/console/ConsoleOvRich.vue';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import type {OvSentence} from '@/client/console/endgame/consoleOverviewModel';

/*
 * THE CONSOLE RICH SENTENCE — the endgame narrative's voice: the structural tokens of a template + its typed params,
 * a player's name in their colour, a score emphasised, everything else inline. What this spec owns: which token
 * becomes a term, which class and colour it wears, and that the sentence follows its prop. (The unit runner has no
 * RU bundle — a key reads as itself.)
 */
function mountSentence(sentence: OvSentence) {
  return mount(ConsoleOvRich, {...globalConfig, props: {sentence}});
}

describe('ConsoleOvRich — the rich sentence of the console overview', () => {
  it('a sentence with no params is its text and no term', () => {
    const rich = mountSentence({key: 'A quiet game', params: []});
    expect(rich.classes()).to.include('con-ovrich');
    expect(rich.text()).to.eq('A quiet game');
    expect(rich.findAll('.con-ovrich__term').length).to.eq(0);
  });

  it('a player term wears the seat\'s colour, a score term its accent; a param with no term is inlined', () => {
    const rich = mountSentence({
      key: '${0} won by ${1} points on ${2}',
      params: [
        {t: 'raw', v: 'Alice', term: {kind: 'player', color: 'red'}},
        {t: 'raw', v: '7', term: {kind: 'score', accent: true}},
        {t: 'i18n', v: 'Tharsis'},
      ],
    });
    expect(rich.text()).to.eq('Alice won by 7 points on Tharsis');
    const terms = rich.findAll('.con-ovrich__term');
    expect(terms.map((term) => term.text())).to.deep.eq(['Alice', '7']);
    expect(terms[0].classes()).to.include('con-ovrich__term--player');
    expect(terms[0].classes()).to.not.include('con-ovrich__term--accent');
    expect((terms[0].element as HTMLElement).style.getPropertyValue('--ov-pc'), 'the seat\'s own hex').to.eq(endgamePlayerHex('red'));
    expect(terms[1].classes()).to.include.members(['con-ovrich__term--score', 'con-ovrich__term--accent']);
    expect((terms[1].element as HTMLElement).style.getPropertyValue('--ov-pc'), 'no colour on a term that names nobody').to.eq('');
  });

  it('follows its sentence', async () => {
    const rich = mountSentence({key: 'First: ${0}', params: [{t: 'raw', v: 'Bob', term: {kind: 'player', color: 'blue'}}]});
    expect(rich.text()).to.eq('First: Bob');
    await rich.setProps({sentence: {key: 'A quiet game', params: []}});
    expect(rich.text()).to.eq('A quiet game');
    expect(rich.findAll('.con-ovrich__term').length).to.eq(0);
  });
});

/*
 * EndgameWinnerReveal — the winner cinematic of the desktop end-of-game flow. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): one prop (`model`), no emits, nothing exposed — its two verbs go to the module's
 * endgame state — so the spec is what it renders for the model and what «View results» / «Skip» / Esc do to that state.
 * Mounted WITHOUT the i18n plugin on purpose: the component imports `$t` and `v-i18n` itself, and a Vue warning (an
 * unresolved directive) fails the test.
 */
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import EndgameWinnerReveal from '@/client/components/endgame/EndgameWinnerReveal.vue';
import {EndgameMode, EndgameModel, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {beginEndgameReveal, endgameState, resetEndgameState} from '@/client/components/endgame/endgameState';

/** One ranked score row — only what the reveal reads. */
function score(color: Color, name: string, place: number, total: number, extra: Partial<EndgamePlayerScore> = {}): EndgamePlayerScore {
  return {color, name, place, total, isWinner: place === 1, corporations: ['Helion'], ...extra} as EndgamePlayerScore;
}

/** The model as the reveal reads it: the mode, the ranked players, the winner, the margin, the generation. */
function model(mode: EndgameMode, players: Array<EndgamePlayerScore>, extra: Partial<EndgameModel> = {}): EndgameModel {
  return {
    mode,
    players,
    winner: players[0],
    margin: players.length > 1 ? players[0].total - players[1].total : 0,
    generation: 9,
    soloWin: false,
    ...extra,
  } as EndgameModel;
}

function reveal(m: EndgameModel) {
  return mount(EndgameWinnerReveal, {props: {model: m}, global: {config: globalConfig.global.config}});
}

describe('EndgameWinnerReveal — the winner cinematic', () => {
  // The count-up needs a frame source; this environment has none by contract (tests.md), so the score stands at once.
  // Pinned here, so a frame source another spec left behind cannot turn these reads into a race with a timer.
  const host = globalThis as unknown as {requestAnimationFrame?: unknown};
  let frames: unknown;

  beforeEach(() => {
    frames = host.requestAnimationFrame;
    delete host.requestAnimationFrame;
  });
  afterEach(() => {
    if (frames !== undefined) {
      host.requestAnimationFrame = frames;
    }
    resetEndgameState();
  });

  it('a duel names the winner — colour, corporation, the whole score, the lead — and the one opponent under it', async () => {
    const w = reveal(model('duel', [
      score('red', 'Victor', 1, 42, {corporations: ['Helion', 'Credicor']}),
      score('blue', 'Nastya', 2, 30),
    ]));
    await nextTick(); // the score is set in `onMounted` — it is on screen on the next render
    expect((w.element as HTMLElement).style.getPropertyValue('--eg-glow')).to.eq(endgamePlayerHex('red'));
    expect(w.find('.eg-reveal__stage').classes()).to.include('eg-reveal__stage--duel');
    expect(w.find('.eg-reveal__eyebrow').text()).to.include('9 ' + $t('generations'));
    const title = w.find('.eg-reveal__title');
    expect(title.text()).to.eq($t('Winner'));
    expect(title.classes()).to.deep.eq(['eg-reveal__title']);

    expect(w.find('.eg-reveal__winner-dot').classes()).to.include('player_bg_color_red');
    expect(w.find('.eg-reveal__winner-name').text()).to.eq('Victor');
    expect(w.find('.eg-reveal__corp').text(), 'the first corporation').to.eq('Helion');
    expect(w.find('.eg-reveal__score-value').text(), 'no frame source — the total at once').to.eq('42');
    expect(w.find('.eg-reveal__score-unit').text()).to.eq($t('VP'));
    expect(w.find('.eg-reveal__delta-chip').text()).to.eq($t('Lead') + ' +12');
    expect(w.find('.eg-reveal__delta-chip--tie').exists()).to.eq(false);

    const runners = w.findAll('.eg-reveal__runner');
    expect(runners).to.have.lengthOf(1);
    expect(runners[0].find('.eg-reveal__runner-place').text()).to.eq('2');
    expect(runners[0].find('.eg-reveal__runner-dot').classes()).to.include('player_bg_color_blue');
    expect(runners[0].find('.eg-reveal__runner-name').text()).to.eq('Nastya');
    expect(runners[0].find('.eg-reveal__runner-vp').text()).to.eq('30 ' + $t('VP'));
  });

  it('standings show the next TWO; a tie reads «Decided on M€»; the MarsBot seat\'s corporation rides `botCorporation`; solo reads Victory / Defeat with nobody under it', async () => {
    const bot = score('red', 'MarsBot', 1, 70, {corporations: [], botCorporation: {id: MarsBotCorpId.C01_CREDICOR, name: 'Credicor'}});
    const w = reveal(model('standings', [bot, score('blue', 'Nastya', 2, 70), score('green', 'Oleg', 3, 50), score('yellow', 'Dina', 4, 41)]));
    expect(w.find('.eg-reveal__corp').text()).to.eq('Credicor');
    expect(w.find('.eg-reveal__delta-chip--tie').text()).to.eq($t('Decided on M€'));
    expect(w.findAll('.eg-reveal__runner-name').map((r) => r.text()), 'the fourth seat is not on the reveal').to.deep.eq(['Nastya', 'Oleg']);

    await w.setProps({model: model('solo', [score('green', 'Oleg', 1, 88, {corporations: []})], {soloWin: true})});
    expect(w.find('.eg-reveal__title').text()).to.eq($t('Victory'));
    expect(w.find('.eg-reveal__title--defeat').exists()).to.eq(false);
    expect(w.find('.eg-reveal__corp').exists(), 'no corporation — no line').to.eq(false);
    expect(w.find('.eg-reveal__delta').exists(), 'solo has no margin').to.eq(false);
    expect(w.find('.eg-reveal__runners').exists()).to.eq(false);

    await w.setProps({model: model('solo', [score('green', 'Oleg', 1, 51)], {soloWin: false})});
    const title = w.find('.eg-reveal__title');
    expect(title.text()).to.eq($t('Defeat'));
    expect(title.classes()).to.include('eg-reveal__title--defeat');

    await w.setProps({model: model('duel', [], {winner: undefined})});
    expect(w.find('.eg-reveal__winner').exists(), 'no winner — no winner block').to.eq(false);
    expect((w.element as HTMLElement).style.getPropertyValue('--eg-glow')).to.eq('#6ab0e6');
  });

  it('«View results» opens the results, «Skip» and Esc leave the pill — and Esc is no longer heard once the reveal is gone', async () => {
    const duel = () => model('duel', [score('red', 'Victor', 1, 42), score('blue', 'Nastya', 2, 30)]);
    const escape = () => window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));

    beginEndgameReveal();
    const w = reveal(duel());
    await w.find('.eg-reveal__cta').trigger('click');
    expect({...endgameState}).to.include({revealActive: false, resultsOpen: true, minimized: false});

    resetEndgameState();
    beginEndgameReveal();
    await w.find('.eg-reveal__skip').trigger('click');
    expect({...endgameState}).to.include({revealActive: false, resultsOpen: true, minimized: true});

    resetEndgameState();
    beginEndgameReveal();
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
    expect(endgameState.revealActive, 'only Esc skips').to.eq(true);
    escape();
    expect({...endgameState}).to.include({revealActive: false, resultsOpen: true, minimized: true});

    w.unmount();
    resetEndgameState();
    beginEndgameReveal();
    escape();
    expect(endgameState.revealActive, 'the listener left with the component').to.eq(true);
  });
});

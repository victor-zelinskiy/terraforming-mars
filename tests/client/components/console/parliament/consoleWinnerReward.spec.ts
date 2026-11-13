/*
 * ConsoleWinnerReward — the WINNER'S PART of a resolution as ONE graphic block (Turmoil Redux): the vote surface's
 * own-effect block, the fullscreen inspector's footer, the playground, the sitting's band. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): read-only — it emits and exposes nothing; its contract is what
 * it draws for the READING it is handed (the caption, the body, the range, the TR and its breakdown) in each of its
 * three variants. Nothing here computes a rule: the readings below are written by hand, as `winnerRewardModel.ts`
 * would hand them over. The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import {Color} from '@/common/Color';
import {WinnerParameterRoom} from '@/common/parliament/winnerReward';
import {WinnerRewardReading} from '@/client/console/parliament/winnerRewardModel';
import ConsoleWinnerReward from '@/client/components/console/parliament/ConsoleWinnerReward.vue';

/** Oxygen 7 → 8 % for one greenery — the room a tile's own placement reads on the live table. */
function room(over: Partial<WinnerParameterRoom> = {}): WinnerParameterRoom {
  return {
    parameter: 'oxygen', current: 7, max: 14, steps: 1, applied: 1, rises: true, resulting: 8,
    tileAvailable: true, temperatureBonus: false, heatProductionBonus: 0, oceanBonus: false, ...over,
  };
}

/** «If you win»: a greenery whose own placement raises oxygen 7 → 8 %, worth 1 TR for the tile and 1 for the step. */
function greenery(over: Partial<WinnerRewardReading> = {}): WinnerRewardReading {
  return {
    reward: {kind: 'tile', tile: 'greenery'}, context: 'conditional', parameter: 'oxygen', room: room(),
    tr: {tile: 1, parameter: 1, temperature: 0}, ...over,
  };
}

type Props = {
  reading: WinnerRewardReading,
  viewerColor?: Color,
  nameOf?: (color: Color) => string,
  size?: 'compact' | 'normal' | 'hero',
  variant?: 'block' | 'chip' | 'inline',
  reasonElsewhere?: boolean,
};

function part(props: Props) {
  return mount(ConsoleWinnerReward, {...globalConfig, props});
}

describe('ConsoleWinnerReward — the winner\'s part', () => {
  it('a conditional greenery, as a block: the head with its caption, the tile and its name, the parameter\'s range, the TR and what it is made of', () => {
    const w = part({reading: greenery()});
    // The template starts with its root: the wrapper IS the block.
    expect(w.classes()).to.include.members(['con-wreward', 'con-wreward--normal', 'con-wreward--block', 'con-wreward--conditional', 'con-wreward--greenery']);
    expect(['con-wreward--neutral', 'con-wreward--skipped', 'con-wreward--mine'].filter((flag) => w.classes().includes(flag))).to.deep.eq([]);
    expect(w.attributes('data-winner-reward')).to.eq('');
    expect([
      w.attributes('data-winner-context'), w.attributes('data-winner-tile'), w.attributes('data-winner-rises'),
      w.attributes('data-winner-before'), w.attributes('data-winner-after'), w.attributes('data-winner-tr'),
    ]).to.deep.eq(['conditional', 'greenery', 'true', '7', '8', '2']);
    expect(w.attributes('data-winner-recipient'), 'nobody is named before the vote').to.eq(undefined);

    expect(w.find('.con-wreward__head .con-wreward__label').text()).to.eq('For the winner of the vote');
    expect(w.find('.con-wreward__head [data-winner-caption]').text()).to.eq('If you win');
    expect(w.find('.con-wreward__tile').classes()).to.include('con-wreward__tile--greenery');
    expect(w.find('.con-wreward__name').text()).to.eq('Greenery');

    const param = w.find('[data-winner-param]');
    expect(param.classes()).to.not.include('con-wreward__param--max');
    expect(param.find('.con-wreward__pico').classes()).to.include('con-wreward__pico--oxygen');
    expect([param.find('.con-wreward__from').text(), param.find('.con-wreward__to').text()]).to.deep.eq(['7%', '8%']);
    expect(w.find('[data-winner-tr-total]').text()).to.eq('+2');

    const notes = w.findAll('[data-winner-note]');
    expect(notes.map((n) => n.classes().includes('con-wreward__note--hidden')), 'a block has a line for the breakdown').to.deep.eq([false]);
    expect(notes[0].text()).to.eq('TR: Greenery tile +1 · Oxygen +1');
  });

  it('the parameter at its maximum: the tile still lands — «Max.» for a range, the note says why and what TR is left; a recorded step reads its own range', async () => {
    const w = part({
      reading: greenery({room: room({current: 14, applied: 0, rises: false, resulting: 14}), tr: {tile: 1, parameter: 0, temperature: 0}}),
      size: 'hero',
    });
    expect(w.classes()).to.include('con-wreward--hero');
    expect(w.attributes('data-winner-rises'), 'the range does not rise').to.eq('false');
    const param = w.find('[data-winner-param]');
    expect(param.classes()).to.include('con-wreward__param--max');
    expect(param.find('.con-wreward__from').exists()).to.eq(false);
    expect([param.find('.con-wreward__to').text(), param.find('.con-wreward__max').text()]).to.deep.eq(['14%', 'Max.']);
    expect(w.find('[data-winner-tr-total]').text()).to.eq('+1');
    expect(w.find('[data-winner-note]').text()).to.eq('Oxygen is at its maximum — no step · TR: Greenery tile +1');

    // APPLIED: the recorded step outranks the room — and the block follows its reading.
    await w.setProps({
      reading: greenery({context: 'applied', recipient: 'red', room: undefined, placed: {before: 9, after: 10}, generation: 4}),
      viewerColor: 'red',
    });
    expect(w.classes()).to.include.members(['con-wreward--applied', 'con-wreward--mine']);
    expect([w.attributes('data-winner-recipient'), w.attributes('data-winner-before'), w.attributes('data-winner-after'), w.attributes('data-winner-rises')])
      .to.deep.eq(['red', '9', '10', 'true']);
    expect([w.find('.con-wreward__from').text(), w.find('.con-wreward__to').text()]).to.deep.eq(['9%', '10%']);
    expect(w.find('[data-winner-caption]').text(), 'a finished phase names its generation first').to.eq('Generation 4 · You placed it');
  });

  it('WHO it is for: another seat by the name the host resolves, the viewer\'s own, a neutral winner — and a skip, whose reason a host with a plate carries elsewhere', async () => {
    const w = part({reading: greenery({context: 'pending', recipient: 'blue'}), viewerColor: 'red', nameOf: (color: Color) => 'Seat ' + color});
    expect(w.classes()).to.include('con-wreward--pending');
    expect(w.classes()).to.not.include('con-wreward--mine');
    expect(w.find('[data-winner-caption]').text()).to.eq('Placed by Seat blue');

    await w.setProps({reading: greenery({context: 'pending', recipient: 'neutral'})});
    expect(w.classes()).to.include('con-wreward--neutral');
    expect(w.find('[data-winner-caption]').text()).to.eq('Neutral winner — nobody places it');
    expect(w.find('[data-winner-note]').exists(), 'nobody places it — no breakdown').to.eq(false);

    const skipped = greenery({context: 'applied', recipient: 'blue', room: undefined, tr: undefined, skipped: 'No space is available'});
    await w.setProps({reading: skipped});
    expect(w.classes()).to.include('con-wreward--skipped');
    expect(w.attributes('data-winner-skipped')).to.eq('No space is available');
    expect(w.find('[data-winner-caption]').text(), 'no plate beside it — the caption is the reason').to.eq('No space is available');
    expect(w.find('[data-winner-tr-total]').exists(), 'no TR — no total').to.eq(false);

    await w.setProps({reasonElsewhere: true});
    expect(w.find('[data-winner-caption]').text(), 'beside a skip plate the caption says so alone').to.eq('Skipped');
  });

  it('the variants: `inline` has no head (the caption rides the body\'s line, the note stays readable but hidden), `chip` keeps the head; a colony has no parameter until it is built; a direct step shows its count off the table', async () => {
    const w = part({reading: greenery(), variant: 'inline', size: 'compact'});
    expect(w.classes()).to.include.members(['con-wreward--inline', 'con-wreward--compact']);
    expect(w.find('.con-wreward__head').exists()).to.eq(false);
    const caption = w.find('.con-wreward__body > [data-winner-caption]');
    expect(caption.classes()).to.include('con-wreward__caption--inline');
    expect(caption.text()).to.eq('If you win');
    expect(w.findAll('[data-winner-note]').map((n) => n.classes().includes('con-wreward__note--hidden'))).to.deep.eq([true]);

    // A COLONY: before the pick the body is the tile and its label; once built, the tile the cube landed on.
    await w.setProps({variant: 'chip', reading: {reward: {kind: 'colony'}, context: 'pending', recipient: 'red'}, viewerColor: 'red'});
    expect(w.classes()).to.include.members(['con-wreward--chip', 'con-wreward--colony', 'con-wreward--mine']);
    expect(w.find('.con-wreward__head [data-winner-caption]').text()).to.eq('You build it');
    expect(w.find('.con-wreward__name').text()).to.eq('Colony');
    expect(w.find('[data-winner-param]').exists()).to.eq(false);
    expect(w.attributes('data-winner-rises'), 'a colony moves no parameter').to.eq(undefined);
    await w.setProps({reading: {reward: {kind: 'colony'}, context: 'applied', recipient: 'red', built: 'Luna'}});
    const built = w.find('[data-winner-param]');
    expect(built.classes()).to.include('con-wreward__param--built');
    expect(built.text()).to.eq('Luna');
    expect(w.attributes('data-winner-built')).to.eq('Luna');

    // A DIRECT STEP off the table (a reference reading: no room, no record): the count it asks for.
    await w.setProps({reading: {reward: {kind: 'parameter', parameter: 'temperature', steps: 2}, context: 'reference', parameter: 'temperature'}});
    expect(w.classes()).to.include('con-wreward--temperature');
    expect(w.find('.con-wreward__name').text()).to.eq('Temperature');
    expect(w.find('[data-winner-param] .con-wreward__to').text()).to.eq('+2');
    expect(w.find('[data-winner-caption]').exists(), 'a reference answers no question — no caption').to.eq(false);
  });
});

/*
 * ConsoleResolutionStatus — the resolution's STANDING in the fullscreen viewer's command bar (Turmoil Redux): where the
 * card stands, and the viewer's access to its party's effect. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): read-only — it emits and exposes nothing; its contract is the two lines it draws for
 * the status it is handed, laid out once for every card the viewer pages through (`reserve`).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t, translateText} from '@/client/directives/i18n';
import {PartyName} from '@/common/turmoil/PartyName';
import {ResolutionAccessVm, ResolutionStatusVm} from '@/client/console/parliament/resolutionInspectModel';
import {delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';
import ConsoleResolutionStatus from '@/client/components/console/parliament/ConsoleResolutionStatus.vue';

// The cube is the delegate figure — its own subject; this spec reads what a filled place HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const DelegateStub = defineComponent({
  name: 'PlayerDelegate',
  props: {color: String, size: Number, glow: {type: Boolean, default: true}, shadow: {type: Boolean, default: true}},
  render: () => h('i', {class: 'delegate-stub'}),
});

const access = (over: Partial<ResolutionAccessVm> = {}): ResolutionAccessVm => ({kind: 'progress', mine: 1, threshold: 2, places: true, ...over});
const status = (over: Partial<ResolutionStatusVm> = {}): ResolutionStatusVm => ({lifecycle: 'vote', winning: false, party: PartyName.GREENS, access: access(), ...over});

function chip(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(ConsoleResolutionStatus as any, {
    ...globalConfig,
    props,
    attrs,
    global: {...globalConfig.global, stubs: {PlayerDelegate: DelegateStub}},
  });
}

const PLACE = '.con-rstatus__place';

describe('ConsoleResolutionStatus — the resolution\'s standing', () => {
  it('up for the vote, the effect not held: the viewer\'s OWN cubes toward the threshold, and one word', () => {
    const w = chip({status: status(), viewerColor: 'blue'}, {'class': 'from-host'});
    // The template STARTS WITH ITS ROOT: the host's class lands on the chip, beside the standing it carries.
    expect((w.element as HTMLElement).tagName).to.eq('SPAN');
    expect(w.classes()).to.include.members(['con-rstatus', 'from-host']);
    expect(w.attributes('data-lifecycle')).to.eq('vote');
    expect(w.attributes('data-access')).to.eq('progress');
    expect(w.attributes('data-mine')).to.eq('1');
    expect(w.attributes('data-vote-access')).to.eq(undefined);

    const life = w.find('.con-rstatus__life');
    expect(life.classes()).to.include('con-rstatus__life--vote');
    expect(life.find('.con-rstatus__life-text').text()).to.eq($t('Up for the vote'));
    expect(life.find('.con-rstatus__life-tail').exists(), 'not winning — no tail').to.eq(false);

    const line = w.find('.con-rstatus__access');
    expect(line.classes()).to.include('con-rstatus__access--progress');
    expect(line.find('.con-rstatus__access-key').text()).to.eq($t('Party effect'));
    expect(line.findAll(PLACE).map((p) => p.classes().includes('con-rstatus__place--on'))).to.deep.eq([true, false]);
    expect(line.find('.con-rstatus__count').text()).to.eq('1/2');
    expect(line.find('.con-rstatus__access-val').text()).to.eq(translateText('not available to you'));
    expect(line.find('.con-rstatus__access-basis').exists()).to.eq(false);
    expect(line.find('.con-rstatus__access-next').exists()).to.eq(false);

    const cubes = w.findAllComponents(DelegateStub);
    expect(cubes.length, 'a cube per filled place — never an empty one').to.eq(1);
    expect(cubes[0].props('color')).to.eq('blue');
    expect(cubes[0].props('size')).to.eq(delegateFigurePx(18));
    expect(cubes[0].props('glow')).to.eq(false);
    expect(cubes[0].props('shadow')).to.eq(false);
  });

  it('the winning tail, the projection of THIS vote, a held effect\'s basis and an enacted card — each said once', async () => {
    const w = chip({status: status({winning: true, access: access({unlocksWithVote: true})}), viewerColor: 'blue'});
    expect(w.find('.con-rstatus__life-tail').text()).to.eq(`· ${$t('Leading the vote')}`);
    expect(w.attributes('data-vote-access')).to.eq('unlocks');
    expect(w.find('[data-zoom-vote-access]').text()).to.include($t('effect is yours'));

    // The vote chip beside the status carries the winning state: the tail yields.
    await w.setProps({winningTail: false});
    expect(w.find('.con-rstatus__life-tail').exists()).to.eq(false);

    // Held on another basis than the places: no pair of places, the basis as one short tail.
    await w.setProps({status: status({access: access({kind: 'held', basis: 'ruling', mine: 0, places: false})})});
    expect(w.attributes('data-access')).to.eq('held');
    expect(w.find('.con-rstatus__places').exists()).to.eq(false);
    expect(w.find('.con-rstatus__access-val').text()).to.eq(translateText('available to you'));
    expect(w.find('.con-rstatus__access-basis').text()).to.eq(`· ${translateText('the party rules')}`);

    // Held BY the places: they are the basis — no tail repeats them.
    await w.setProps({status: status({access: access({kind: 'held', basis: 'delegates', mine: 3})})});
    expect(w.find('.con-rstatus__access-basis').exists()).to.eq(false);
    expect(w.find('.con-rstatus__count').text(), 'three own delegates still show a full pair').to.eq('2/2');

    // Enacted: its party rules and every player holds the effect.
    await w.setProps({status: status({lifecycle: 'enacted', access: access({kind: 'everyone', mine: 0, places: false})})});
    expect(w.attributes('data-lifecycle')).to.eq('enacted');
    expect(w.find('.con-rstatus__life').classes()).to.include('con-rstatus__life--enacted');
    expect(w.find('.con-rstatus__life-text').text()).to.eq($t('Enacted'));
    expect(w.find('.con-rstatus__access-val').text()).to.eq(translateText('for every player'));
  });

  it('a viewer with no seat gets no access line; the places need the viewer\'s colour', () => {
    const spectator = chip({status: status({access: undefined})});
    expect(spectator.findAll('.con-rstatus__cell').length, 'the lifecycle line alone').to.eq(1);
    expect(spectator.attributes('data-access')).to.eq('none');
    expect(spectator.attributes('data-mine')).to.eq('');
    expect(spectator.find('.con-rstatus__access').exists()).to.eq(false);

    const colourless = chip({status: status()});
    expect(colourless.find('.con-rstatus__access').exists()).to.eq(true);
    expect(colourless.find('.con-rstatus__places').exists(), 'no colour — no cubes to draw').to.eq(false);
    expect(colourless.find('.con-rstatus__access-val').text()).to.eq(translateText('not available to you'));
  });

  it('the RESERVE lies invisibly under the live lines — a sizer, never a second reading', () => {
    const other = status({lifecycle: 'enacted', winning: true, access: access({kind: 'held', basis: 'delegates', mine: 2, unlocksWithVote: true})});
    const w = chip({status: status({access: access({unlocksWithVote: true})}), reserve: [other], viewerColor: 'blue'});

    const lives = w.findAll('.con-rstatus__life');
    expect(lives.length).to.eq(2);
    expect(lives.map((l) => l.classes().includes('con-rstatus__sizer'))).to.deep.eq([false, true]);
    expect(lives.map((l) => l.attributes('aria-hidden'))).to.deep.eq([undefined, 'true']);
    expect(lives[1].classes()).to.include('con-rstatus__life--enacted');

    const lines = w.findAll('.con-rstatus__access');
    expect(lines.length).to.eq(2);
    expect(lines.map((l) => l.classes().includes('con-rstatus__sizer'))).to.deep.eq([false, true]);
    expect(lines[1].findAll(PLACE).map((p) => p.classes().includes('con-rstatus__place--on')), 'a place is a fixed box').to.deep.eq([true, true]);
    expect(lines[1].find('.delegate-stub').exists(), 'a reserve line needs no cube inside').to.eq(false);
    expect(w.findAllComponents(DelegateStub).length, 'only the live line\'s cube').to.eq(1);

    // The root speaks for the LIVE standing only; the vote-access hook too.
    expect(w.attributes('data-lifecycle')).to.eq('vote');
    expect(w.attributes('data-access')).to.eq('progress');
    expect(w.findAll('.con-rstatus__access-next').length).to.eq(2);
    expect(w.findAll('[data-zoom-vote-access]').length).to.eq(1);
  });
});

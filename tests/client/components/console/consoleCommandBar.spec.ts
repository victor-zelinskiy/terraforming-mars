/*
 * ConsoleCommandBar — the ONE bottom bar of the console: the live meaning of every button. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): what it renders for its props — the context, a command per entry
 * with its glyph(s), its label (a `${0}` key interpolated with its params), its badge and its registers; the HOLD ring
 * over the shared hold gate; and the BAY form (the centre socket of the hand dock — the run split around it, whole
 * low-priority commands dropped, A and B never). It emits nothing and no parent stands a ref on it. The glyph badge is
 * stubbed by name (it is its own component's subject). The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {holdConfirmState} from '@/client/console/consoleHoldConfirm';
import ConsoleCommandBar from '@/client/components/console/ConsoleCommandBar.vue';

const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: {type: String as PropType<GlyphControl>, required: true}},
  render() {
    return h('i', {'class': 'glyph-stub', 'data-control': this.control});
  },
});

const global = {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}};

function bar(commands: ReadonlyArray<ConsoleCommand>, over: {context?: string, bay?: boolean} = {}) {
  return mount(ConsoleCommandBar, {global, props: {context: over.context ?? 'Board', commands, bay: over.bay ?? false}});
}

describe('ConsoleCommandBar — the one bottom bar', () => {
  // The hold gate is a MODULE (one ring for the whole console): every test leaves it at rest.
  afterEach(() => {
    holdConfirmState.key = '';
    holdConfirmState.progress = 0;
  });

  it('the classic bar: the context, then a command per entry in its order — glyph(s), label, badge and registers; no bay, nothing on the left', () => {
    const w = bar([
      {control: 'confirm', label: 'Select'},
      {control: 'back', label: 'Back', enabled: false},
      {control: 'secondary', label: 'Claim', highlight: true, badge: 2},
      {control: 'inspect', label: 'End the game', tone: 'danger', badge: 3, badgeTone: 'neutral'},
      {control: 'bumperL', control2: 'bumperR', label: 'Bonus'},
      {control: 'stickR', label: 'Scroll', badge: 0},
    ], {context: 'Card actions'});
    // The template starts with its root: the wrapper IS the bar.
    expect(w.classes()).to.deep.eq(['con-cmdbar']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.find('.con-cmdbar__context').text()).to.eq('Card actions');
    expect(w.find('.con-cmdbar__bay').exists(), 'no bay socket').to.eq(false);
    expect(w.find('.con-cmdbar__cmds--left').exists(), 'nothing flows to the left zone').to.eq(false);
    expect(w.find('.con-cmdbar__cmds').classes(), 'the run is not the bay\'s right zone').to.deep.eq(['con-cmdbar__cmds']);

    const cmds = w.findAll('.con-cmdbar__cmds > .con-cmdbar__cmd');
    expect(cmds.map((c) => c.find('.con-cmdbar__label').text())).to.deep.eq(['Select', 'Back', 'Claim', 'End the game', 'Bonus', 'Scroll']);
    expect(cmds.map((c) => c.findAll('.glyph-stub').map((g) => g.attributes('data-control'))))
      .to.deep.eq([['confirm'], ['back'], ['secondary'], ['inspect'], ['bumperL', 'bumperR'], ['stickR']]);
    expect(cmds.map((c) => c.classes().filter((k) => k !== 'con-cmdbar__cmd')))
      .to.deep.eq([[], ['con-cmdbar__cmd--disabled'], ['con-cmdbar__cmd--hot'], ['con-cmdbar__cmd--danger'], [], []]);
    // A badge only for a count above zero; its register is «go» unless the command says `neutral`.
    const badges = cmds.map((c) => c.find('.con-cmdbar__badge'));
    expect(badges.map((b) => b.exists())).to.deep.eq([false, false, true, true, false, false]);
    expect([badges[2].text(), badges[2].attributes('data-badge-tone'), badges[2].classes().includes('con-cmdbar__badge--neutral')]).to.deep.eq(['2', 'go', false]);
    expect([badges[3].text(), badges[3].attributes('data-badge-tone'), badges[3].classes().includes('con-cmdbar__badge--neutral')]).to.deep.eq(['3', 'neutral', true]);
    // No command is a hold: no ring anywhere.
    expect(w.find('.con-cmdbar__hold').exists()).to.eq(false);
  });

  it('a `${0}` label is interpolated with its params, a SPREAD pair frames its label with the two arrows, and the run follows its props', async () => {
    const w = bar([
      {control: 'secondary', label: 'Open: ${0}', labelParams: ['Colonies']},
      {control: 'bumperL', control2: 'bumperR', spread: true, label: 'Page'},
    ]);
    const [open, page] = w.findAll('.con-cmdbar__cmd');
    expect(open.find('.con-cmdbar__label').text()).to.eq('Open: Colonies');
    // glyph · ◀ · label · ▶ · glyph — the two glyphs on the outer edges.
    expect(Array.from((page.element as Element).children).map((el) => el.className))
      .to.deep.eq(['glyph-stub', 'con-cmdbar__spread-arrow', 'con-cmdbar__label', 'con-cmdbar__spread-arrow', 'glyph-stub']);
    expect(page.findAll('.con-cmdbar__spread-arrow').map((a) => a.text())).to.deep.eq(['◀', '▶']);
    expect(page.findAll('.glyph-stub').map((g) => g.attributes('data-control'))).to.deep.eq(['bumperL', 'bumperR']);

    await w.setProps({context: 'Hand', commands: [{control: 'confirm', label: 'Play'}]});
    expect(w.find('.con-cmdbar__context').text()).to.eq('Hand');
    expect(w.findAll('.con-cmdbar__cmd').map((c) => c.find('.con-cmdbar__label').text())).to.deep.eq(['Play']);
  });

  it('a HOLD command wears the shared ring round its glyph, and the ring follows the hold gate', async () => {
    const w = bar([
      {control: 'confirm', label: 'Hold to finish', hold: true},
      {control: 'back', label: 'Back'},
    ]);
    const [hold, back] = w.findAll('.con-cmdbar__cmd');
    expect(back.find('.con-cmdbar__hold').exists(), 'a tap has no ring').to.eq(false);
    const ring = hold.find('.con-cmdbar__hold');
    expect(ring.find('.glyph-stub').attributes('data-control'), 'the ring wraps the glyph').to.eq('confirm');
    expect(hold.findAll('.glyph-stub').length, 'the glyph is drawn once').to.eq(1);
    expect((ring.element as HTMLElement).style.getPropertyValue('--con-hold-progress')).to.eq('0');
    expect(ring.classes()).to.not.include('con-cmdbar__hold--live');

    holdConfirmState.key = 'spec-hold';
    holdConfirmState.progress = 0.4;
    await nextTick();
    expect((ring.element as HTMLElement).style.getPropertyValue('--con-hold-progress')).to.eq('0.4');
    expect(ring.classes()).to.include('con-cmdbar__hold--live');

    // Nothing held: the ring is at rest whatever the last progress was.
    holdConfirmState.key = '';
    await nextTick();
    expect((ring.element as HTMLElement).style.getPropertyValue('--con-hold-progress')).to.eq('0');
    expect(ring.classes()).to.not.include('con-cmdbar__hold--live');
  });

  it('the BAY bar reserves the dock\'s socket and splits the run around it — whole commands drop, A and B never, the order kept', async () => {
    const run: Array<ConsoleCommand> = [
      {control: 'confirm', label: 'Select'},
      {control: 'back', label: 'Back'},
    ];
    for (let i = 0; i < 18; i++) {
      run.push({control: 'stickR', label: `A long hint number ${i} nobody could fit`});
    }
    const w = bar(run, {bay: true});
    // The fonts are read off the painted bar once it is mounted; the plan is re-made with them.
    await nextTick();
    expect(w.classes()).to.deep.eq(['con-cmdbar', 'con-cmdbar--bay']);
    expect(w.find('.con-cmdbar__bay').exists(), 'the reserved centre track').to.eq(true);
    // zone-left (the context + what flowed left) · the bay · the right zone.
    expect(Array.from((w.element as Element).children).map((el) => el.className.split(' ')[0]))
      .to.deep.eq(['con-cmdbar__zone-left', 'con-cmdbar__bay', 'con-cmdbar__cmds']);
    expect(w.find('.con-cmdbar > .con-cmdbar__cmds').classes()).to.include('con-cmdbar__cmds--right');

    const shown = w.findAll('.con-cmdbar__cmd').map((c) => c.find('.con-cmdbar__label').text());
    const all = run.map((c) => c.label);
    expect(shown.length, 'the run did not fit: whole commands dropped').to.be.lessThan(all.length);
    expect(shown.slice(0, 2), 'A and B are never dropped').to.deep.eq(['Select', 'Back']);
    // What is left keeps the run's order (left zone first, then the right one).
    expect(shown).to.deep.eq(all.filter((label) => shown.includes(label)));

    // The same run without the bay: every command renders (the classic bars are hint-light).
    await w.setProps({bay: false});
    expect(w.findAll('.con-cmdbar__cmd').length).to.eq(all.length);
    expect(w.find('.con-cmdbar__bay').exists()).to.eq(false);
  });
});

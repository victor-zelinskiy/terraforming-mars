/*
 * ConsoleTypePicker — the creator's «Add participant» dialog: two big plates, PLAYER and MARSBOT. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): pure presentation — the options and the cursor arrive as props,
 * a press / a pointer move goes UP as `pick` / `cursor` with the plate's index. It exposes nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {ParticipantTypeOption} from '@/client/console/menu/consoleCreateModel';
import ConsoleTypePicker from '@/client/components/console/menu/ConsoleTypePicker.vue';

// The badge is the glyph set's own subject; this spec reads the SEMANTIC control the dialog asks it for.
// (A render function, not a template string: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

const option = (id: ParticipantTypeOption['id'], over: Partial<ParticipantTypeOption> = {}): ParticipantTypeOption => ({
  id,
  labelKey: `label of ${id}`,
  descKey: `what ${id} is`,
  noteKey: undefined,
  enabled: true,
  disabledReasonKey: undefined,
  warnKey: undefined,
  ...over,
});

function picker(props: {options: ReadonlyArray<ParticipantTypeOption>, cursor: number}) {
  return mount(ConsoleTypePicker, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
  });
}

describe('ConsoleTypePicker — the creator\'s «Add participant» dialog', () => {
  it('a dialog of two plates — each its glyph, label and description, a note only where there is one; the cursor by index', () => {
    const w = picker({options: [option('human', {noteKey: 'a note for the player'}), option('bot')], cursor: 1});
    expect(w.classes()).to.include('cm-overlay');
    expect(w.attributes('role')).to.eq('dialog');
    expect(w.attributes('aria-label')).to.eq($t('Add participant'));
    expect(w.find('.cm-overlay__card.cm-overlay__card--wide .cm-overlay__title').text()).to.eq($t('Add participant'));

    const plates = w.findAll('.cm-typepick > button.cm-type');
    expect(plates).to.have.length(2);
    expect(plates.map((p) => p.classes().includes('cm-type--cursor'))).to.deep.eq([false, true]);
    expect(plates.map((p) => p.classes().includes('cm-type--bot'))).to.deep.eq([false, true]);
    expect(plates.map((p) => p.classes().includes('cm-type--disabled'))).to.deep.eq([false, false]);
    expect(plates.map((p) => p.find('.cm-type__glyph').text())).to.deep.eq(['◉', '⚙']);
    expect(plates.map((p) => p.find('.cm-type__label').text())).to.deep.eq([$t('label of human'), $t('label of bot')]);
    expect(plates.map((p) => p.find('.cm-type__desc').text())).to.deep.eq([$t('what human is'), $t('what bot is')]);
    expect(plates[0].find('.cm-type__note').text()).to.eq($t('a note for the player'));
    expect(plates[1].find('.cm-type__note').exists()).to.eq(false);
    expect(w.find('.cm-type__blocked').exists() || w.find('.cm-type__warn').exists(), 'nothing blocked, nothing warned').to.eq(false);
  });

  it('a DISABLED plate states its reason (never the warning beside it); an enabled one may warn', () => {
    const w = picker({
      options: [
        option('human', {warnKey: 'seating it shrinks the roster'}),
        option('bot', {enabled: false, disabledReasonKey: 'MarsBot is already seated', warnKey: 'never shown'}),
      ],
      cursor: 0,
    });
    const [human, bot] = w.findAll('button.cm-type');
    expect(human.find('.cm-type__warn').text()).to.eq($t('seating it shrinks the roster'));
    expect(human.find('.cm-type__blocked').exists()).to.eq(false);
    expect(bot.classes()).to.include('cm-type--disabled');
    expect(bot.find('.cm-type__blocked').text()).to.eq($t('MarsBot is already seated'));
    expect(bot.find('.cm-type__warn').exists(), 'the reason takes the warning\'s place').to.eq(false);
  });

  it('the foot names its two verbs by SEMANTIC control — confirm selects, back cancels', () => {
    const w = picker({options: [option('human'), option('bot')], cursor: 0});
    const hints = w.findAll('.cm-overlay__foot > .cm-overlay__foot-hint');
    expect(hints.map((hint) => hint.text())).to.deep.eq([$t('Select'), $t('Cancel')]);
    expect(w.findAllComponents(GlyphStub).map((glyph) => glyph.props('control'))).to.deep.eq(['confirm', 'back']);
  });

  it('a click PICKS the plate and a pointer move moves the CURSOR — each says the plate\'s index', async () => {
    const w = picker({options: [option('human'), option('bot')], cursor: 0});
    const plates = w.findAll('button.cm-type');
    await plates[1].trigger('mousemove');
    await plates[1].trigger('click');
    await plates[0].trigger('click');
    expect(w.emitted('cursor')).to.deep.eq([[1]]);
    expect(w.emitted('pick')).to.deep.eq([[1], [0]]);
  });
});

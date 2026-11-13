/*
 * BonusCardFace — one MarsBot bonus card as the player experiences it in THIS game (hosts: the fullscreen viewer, the
 * console's bot sections, the source dock). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what
 * it renders for its four props — the card's name, its fate chip and fate note, an icon-anchored line per effect
 * already resolved for the expansion set in `ctx`, the two sizing / treatment classes. It emits nothing and exposes
 * nothing. No mount below hands it a translator or a directive: the face brings its own `$t` and `v-i18n`. The unit
 * runner renders the English keys.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import BonusCardFace from '@/client/components/marsbot/BonusCardFace.vue';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BonusCardContext, buildBonusCardView} from '@/common/automa/BonusCardData';

const BASE: BonusCardContext = {venus: false, colonies: false};
const VENUS: BonusCardContext = {venus: true, colonies: false};

function face(props: {id: BonusCardId, ctx: BonusCardContext, large?: boolean, destroyed?: boolean}) {
  return mount(BonusCardFace, {props});
}

/** A line's anchor as the face draws it: the sprite's classes, else the concept glyph, else nothing. */
function anchorsOf(wrapper: ReturnType<typeof face>): Array<string> {
  return wrapper.findAll('.mb-face__line').map((line) => {
    const icon = line.find('.mb-face__icon');
    if (icon.exists()) {
      return icon.classes().filter((c) => c !== 'mb-face__icon').join(' ');
    }
    const glyph = line.find('.mb-face__glyph');
    return glyph.exists() ? glyph.text() : '';
  });
}

describe('BonusCardFace — a MarsBot bonus card', () => {
  it('the name, the fate chip (kind on the class, glyph, label) and the fate note — also as the chip\'s hint', () => {
    const view = buildBonusCardView(BonusCardId.B01_METEOR_SHOWER, BASE);
    const wrapper = face({id: BonusCardId.B01_METEOR_SHOWER, ctx: BASE});

    expect(wrapper.classes()).to.deep.eq(['mb-face']);
    expect(wrapper.find('.mb-face__name').text()).to.eq(view.name);

    const fate = wrapper.find('.mb-face__fate');
    expect(fate.classes()).to.include('mb-face__fate--conditional');
    expect(fate.find('.mb-face__fate-glyph').text()).to.eq('◈');
    const label = fate.find('span[tm-has-i18n]');
    expect(label.exists(), 'the label is translated by the face\'s own v-i18n').to.eq(true);
    expect(label.text()).to.eq('Destroyed conditionally');

    expect(wrapper.find('.mb-face__fate-note').text()).to.eq(view.fate.text);
    expect(fate.attributes('data-hint')).to.eq(view.fate.text);

    // One effect line: a shared resource sprite, the template with its param substituted.
    expect(anchorsOf(wrapper)).to.deep.eq(['resource_icon resource_icon--plants']);
    expect(wrapper.find('.mb-face__text').text()).to.eq('MarsBot\'s opponent loses up to 5 plants');
  });

  it('the lines are the ones of THIS game\'s set — and follow the context: own sprites, concept glyphs, a bare line', async () => {
    const wrapper = face({id: BonusCardId.B02_INVASIVE_SPECIES, ctx: BASE});
    expect(wrapper.findAll('.mb-face__line')).to.have.length(buildBonusCardView(BonusCardId.B02_INVASIVE_SPECIES, BASE).lines.length);
    // M€ is a shared sprite; the animal has no sprite here — its glyph stands in.
    expect(anchorsOf(wrapper)).to.deep.eq(['resource_icon resource_icon--megacredits', '◆']);
    expect(wrapper.findAll('.mb-face__text').map((t) => t.text())[0]).to.eq('MarsBot gains 5 M€');

    await wrapper.setProps({ctx: VENUS});
    // With Venus the card pays less and adds a floater — MarsBot's own sprite.
    expect(anchorsOf(wrapper)).to.deep.eq(['resource_icon resource_icon--megacredits', 'mb-ico mb-ico--floater', '◆']);
    expect(wrapper.findAll('.mb-face__text').map((t) => t.text())[0]).to.eq('MarsBot gains 2 M€');

    // A line with no icon key keeps its slot and draws nothing in it.
    await wrapper.setProps({id: BonusCardId.B06_LOBBYISTS, ctx: BASE});
    expect(wrapper.find('.mb-face__name').text()).to.eq(buildBonusCardView(BonusCardId.B06_LOBBYISTS, BASE).name);
    expect(anchorsOf(wrapper)[0]).to.eq('');
    expect(wrapper.findAll('.mb-face__icon-slot')).to.have.length(wrapper.findAll('.mb-face__line').length);
    expect(anchorsOf(wrapper)).to.include('mb-ico mb-ico--temperature');
  });

  it('a quieter clarification line is marked muted; `large` and `destroyed` are classes of the root', async () => {
    const view = buildBonusCardView(BonusCardId.B04_OVERACHIEVEMENT, BASE);
    const wrapper = face({id: BonusCardId.B04_OVERACHIEVEMENT, ctx: BASE, large: true});
    expect(wrapper.classes()).to.include('mb-face--large');
    expect(wrapper.classes()).to.not.include('mb-face--destroyed');

    const lines = wrapper.findAll('.mb-face__line');
    expect(lines.map((l) => l.classes().includes('mb-face__line--muted'))).to.deep.eq(view.lines.map((l) => l.muted === true));
    expect(anchorsOf(wrapper).slice(0, 2)).to.deep.eq(['🏆', '🏅']);
    expect(wrapper.find('.mb-face__fate').classes()).to.include('mb-face__fate--destroyOnSuccess');
    expect(wrapper.find('.mb-face__fate span[tm-has-i18n]').text()).to.eq('Destroyed on success');
    // No line of an ordinary set names an award of its own.
    expect(wrapper.find('.mb-face__award').exists()).to.eq(false);

    await wrapper.setProps({large: false, destroyed: true});
    expect(wrapper.classes()).to.not.include('mb-face--large');
    expect(wrapper.classes()).to.include('mb-face--destroyed');
  });
});

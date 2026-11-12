/*
 * ConsoleScoreDisc — a score category's medallion disc: the category's own symbol in a disc ringed in its hue. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md) with ONE prop — the glyph, a union by `kind` —
 * and five drawings, one per kind. It emits and exposes nothing; this spec reads the drawing each kind gets.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {DossierGlyph} from '@/client/console/infoDossierModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {maArtPath} from '@/client/console/maArt';
import {getPreferences} from '@/client/utils/PreferencesManager';
import ConsoleScoreDisc from '@/client/components/console/info/ConsoleScoreDisc.vue';

// The line sign is the HUD's icon set — its own subject; this spec reads the NAME the disc hands it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const IconStub = defineComponent({
  name: 'BarButtonIcon',
  props: {name: String},
  render: () => h('i', {class: 'icon-stub'}),
});

function disc(glyph: DossierGlyph, attrs: Record<string, unknown> = {}) {
  return mount(ConsoleScoreDisc, {
    ...globalConfig,
    props: {glyph},
    attrs,
    global: {...globalConfig.global, stubs: {BarButtonIcon: IconStub}},
  });
}

describe('ConsoleScoreDisc — a score category\'s medallion disc', () => {
  it('the template STARTS WITH ITS ROOT — the disc itself, wearing its kind and what a host lets fall through', () => {
    const w = disc({kind: 'mark'}, {'class': 'from-host', 'data-from-host': 'yes'});
    expect((w.element as HTMLElement).tagName).to.eq('SPAN');
    expect(w.classes()).to.include.members(['con-dscore__disc', 'from-host']);
    expect(w.attributes('data-from-host')).to.eq('yes');
    expect(w.attributes('data-score-disc')).to.eq('mark');
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.find('i.con-dscore__glyph.con-dscore__glyph--mark').exists(), 'a category with no symbol keeps the plain mark').to.eq(true);
  });

  it('an ICON is the game\'s own sprite; a TILE is the board\'s tile', () => {
    const icon = disc({kind: 'icon', icon: 'cards'});
    expect(icon.attributes('data-score-disc')).to.eq('icon');
    expect(icon.find('i.con-dscore__glyph').classes()).to.include.members(iconClassFor('cards').split(' ').filter((c) => c !== ''));
    expect(icon.find('.con-dscore__glyph--tile').exists()).to.eq(false);

    const tile = disc({kind: 'tile', tile: 'greenery'});
    expect(tile.attributes('data-score-disc')).to.eq('tile');
    expect(tile.find('i.con-dscore__glyph').classes()).to.include.members(['con-dscore__glyph--tile', 'con-dscore__glyph--greenery']);
  });

  it('EMBLEMS are the earned milestones / awards by their art; a LINE sign is handed to the HUD\'s icon by name', () => {
    const emblems = disc({kind: 'emblems', slugs: ['terraformer', 'mayor']});
    const lang = getPreferences().lang;
    expect(emblems.attributes('data-score-disc')).to.eq('emblems');
    expect(emblems.find('.con-dscore__emblems').attributes('data-emblems')).to.eq('2');
    expect(emblems.findAll('img.con-dscore__emblem').map((img) => img.attributes('src'))).to.deep.eq(
      [maArtPath('terraformer', lang), maArtPath('mayor', lang)]);

    const line = disc({kind: 'line', icon: 'awards'});
    expect(line.attributes('data-score-disc')).to.eq('line');
    const sign = line.findComponent(IconStub);
    expect(sign.props('name')).to.eq('awards');
    expect(sign.classes()).to.include.members(['con-dscore__glyph', 'con-dscore__glyph--line']);
  });

  it('follows its glyph — one disc, a new kind, the old drawing gone', async () => {
    const w = disc({kind: 'tile', tile: 'city'});
    expect(w.find('.con-dscore__glyph--city').exists()).to.eq(true);
    await w.setProps({glyph: {kind: 'emblems', slugs: ['banker']}});
    expect(w.attributes('data-score-disc')).to.eq('emblems');
    expect(w.find('.con-dscore__glyph--city').exists()).to.eq(false);
    expect(w.findAll('img.con-dscore__emblem')).to.have.length(1);
  });
});

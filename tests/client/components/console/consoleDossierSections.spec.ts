/*
 * ConsoleDossierSections — the ONE markup of the board column's sections (a placement's and an inspection's alike).
 * A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its three props — a
 * section per entry with its head and its optional total, plain rows or the recipient groups with their dot and
 * name. It is a fragment (the host's body is the container) and emits nothing. The fact row is stubbed by name: its
 * own rendering is `ConsolePlacementFactRow`'s subject. The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {DossierRecipientGroup, DossierRow, DossierSection} from '@/client/console/placementDossier';
import ConsoleDossierSections from '@/client/components/console/ConsoleDossierSections.vue';

const RowStub = defineComponent({
  name: 'ConsolePlacementFactRow',
  props: {row: {type: Object as PropType<DossierRow>, required: true}},
  render() {
    return h('i', {'class': 'row-stub', 'data-row': this.row.key});
  },
});

const PLAYERS: ReadonlyArray<Pick<PublicPlayerModel, 'color' | 'name'>> = [
  {color: 'red', name: 'Ada'},
  {color: 'blue', name: 'Bo'},
];

function row(key: string): DossierRow {
  return {key, label: key, severity: 'info', count: 1, reasons: []};
}

function group(key: string, recipient: DossierRecipientGroup['recipient'], rows: ReadonlyArray<DossierRow>): DossierRecipientGroup {
  return {key, recipient, rows};
}

function sectionsOf(sections: ReadonlyArray<DossierSection>, viewerColor: Color = 'red') {
  return mount(ConsoleDossierSections, {
    global: {...globalConfig.global, stubs: {ConsolePlacementFactRow: RowStub}},
    props: {sections, viewerColor, players: PLAYERS},
  });
}

describe('ConsoleDossierSections — the dossier\'s sections', () => {
  it('a section per entry, in order: its key on the class and the hook, its head, its rows through the fact row', () => {
    const w = sectionsOf([
      {key: 'effect', titleKey: 'Cell effect', rows: [row('toll-1'), row('toll-2')], stated: []},
      {key: 'gain', titleKey: 'You will gain', rows: [row('gain-1')], stated: []},
    ]);
    const sections = w.findAll('section.con-context__sec');
    expect(sections.map((s) => s.attributes('data-dossier-section'))).to.deep.eq(['effect', 'gain']);
    expect(sections.map((s) => s.classes().includes('con-context__sec--' + s.attributes('data-dossier-section')))).to.deep.eq([true, true]);
    expect(sections.map((s) => s.find('.con-context__sec-head > span').text())).to.deep.eq(['Cell effect', 'You will gain']);
    expect(sections.map((s) => s.findAll('.row-stub').map((r) => r.attributes('data-row')))).to.deep.eq([['toll-1', 'toll-2'], ['gain-1']]);
    expect(w.findAllComponents(RowStub).map((r) => r.props('row').key), 'each row is handed over whole').to.deep.eq(['toll-1', 'toll-2', 'gain-1']);
    expect(w.find('.con-context__sec-total').exists(), 'a section with no total prints none').to.eq(false);
    expect(w.find('.con-context__grp').exists(), 'a section with no groups draws none').to.eq(false);
  });

  it('the section\'s own total stands beside its head — signed, in VP', () => {
    const w = sectionsOf([
      {key: 'endgame', titleKey: 'End of game', rows: [row('vp-1'), row('vp-2')], stated: [], total: 3},
      {key: 'rules', titleKey: 'Field rules', rows: [row('rule-1')], stated: [], total: -2},
      {key: 'progress', titleKey: 'Progress', rows: [row('step-1')], stated: []},
    ]);
    const totals = w.findAll('section.con-context__sec').map((s) => {
      const total = s.find('.con-context__sec-head > .con-context__sec-total');
      return total.exists() ? total.text().replace(/\s+/g, ' ') : undefined;
    });
    expect(totals).to.deep.eq(['+3 VP', '−2 VP', undefined]);
  });

  it('a grouped section: its lead rows first, then a block per recipient with the dot and the name — never its flat rows', () => {
    const w = sectionsOf([{
      key: 'others',
      titleKey: 'Other players will gain',
      rows: [row('flat')],
      stated: [],
      lead: [row('lead-1')],
      groups: [
        group('g-you', {kind: 'current-player'}, [row('you-1')]),
        group('g-blue', {kind: 'player', color: 'blue'}, [row('blue-1'), row('blue-2')]),
        group('g-owner', {kind: 'tile-owner', color: 'neutral'}, [row('owner-1')]),
        group('g-field', {kind: 'neutral'}, [row('field-1')]),
        group('g-nobody', {kind: 'nobody'}, [row('nobody-1')]),
      ],
    }]);
    expect(w.findAll('.row-stub').map((r) => r.attributes('data-row')))
      .to.deep.eq(['lead-1', 'you-1', 'blue-1', 'blue-2', 'owner-1', 'field-1', 'nobody-1']);
    expect(w.find('section.con-context__sec > .row-stub').attributes('data-row'), 'the lead row stands before the groups').to.eq('lead-1');

    const groups = w.findAll('.con-context__grp');
    expect(groups.map((g) => g.findAll('.row-stub').map((r) => r.attributes('data-row'))))
      .to.deep.eq([['you-1'], ['blue-1', 'blue-2'], ['owner-1'], ['field-1'], ['nobody-1']]);
    // The name: «You» for the viewer, a seat by its name, a colour with no seat behind it through the i18n key.
    expect(groups.map((g) => g.find('.con-context__grp-head > span:last-child').text()))
      .to.deep.eq(['You', 'Bo', 'Neutral', 'Field rule', 'Reserved']);
    // The dot: the viewer's own colour, the recipient's — and none for a recipient that is no seat.
    expect(groups.map((g) => {
      const dot = g.find('.con-context__grp-dot');
      return dot.exists() ? dot.classes().filter((c) => c.startsWith('player_bg_color_')) : undefined;
    })).to.deep.eq([['player_bg_color_red'], ['player_bg_color_blue'], ['player_bg_color_neutral'], undefined, undefined]);
  });
});

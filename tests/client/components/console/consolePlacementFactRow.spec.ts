/*
 * ConsolePlacementFactRow — ONE line of the board dossier (a placement's and an inspection's alike). A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its one prop — the
 * statement through `v-i18n` with its params, the «×N», the value column (a change-vector, a signed amount, VP, a
 * milestone's micro track, a timing tag) and a landing's own lines. It emits nothing and exposes nothing. The lite
 * card face is stubbed by name (the premium renderer is not this row's subject). The unit runner renders the English
 * keys.
 */
import {expect} from 'chai';
import {defineComponent, h} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {DossierRow} from '@/client/console/placementDossier';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import ConsolePlacementFactRow from '@/client/components/console/ConsolePlacementFactRow.vue';

const FaceStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {name: String, lightweight: Boolean},
  render() {
    return h('i', {'class': 'face-stub', 'data-name': this.name, 'data-lightweight': String(this.lightweight)});
  },
});

function row(over: Partial<DossierRow> = {}): DossierRow {
  return {key: 'fact', label: 'Raises oxygen', severity: 'info', count: 1, reasons: [], ...over};
}

function rowOf(model: DossierRow) {
  return mount(ConsolePlacementFactRow, {
    global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceStub}},
    props: {row: model},
  });
}

describe('ConsolePlacementFactRow — one line of the dossier', () => {
  it('the statement: the label through `v-i18n` with its params (following a change), «×N» past one, the severity on the root', async () => {
    const w = rowOf(row({label: 'Reduce production by ${0}', params: ['1'], severity: 'danger'}));
    // The template starts with its root: the wrapper IS the row.
    expect(w.classes()).to.include.members(['con-dossier-row', 'con-dossier-row--danger']);
    expect(w.classes()).to.not.include('con-dossier-row--landing');
    const label = () => w.find('.con-dossier-row__title > span').text();
    expect(label()).to.eq('Reduce production by 1');
    expect(w.find('.con-dossier-row__count').exists(), 'one fact prints no «×N»').to.eq(false);
    // A plain row is its title and an empty value column — nothing else.
    for (const part of ['lines', 'why', 'note', 'src', 'delta', 'vp', 'prog', 'when']) {
      expect(w.find('.con-dossier-row__' + part).exists(), part).to.eq(false);
    }

    await w.setProps({row: row({label: 'Reduce production by ${0}', params: ['2'], severity: 'danger', count: 3})});
    expect(label(), 'the params are substituted again from the English template').to.eq('Reduce production by 2');
    expect(w.find('.con-dossier-row__count').text()).to.eq('×3');
  });

  it('the value: a change-vector with its unit, a signed amount, a neutral «×N» — toned by severity and direction; only a CHANGED value is a fresh node', async () => {
    const vector = (resulting: number, key: string): DossierRow => row({
      key, severity: 'positive', delta: {icon: 'megacredits', amount: 1, direction: 'gain', unit: '%', current: 2, resulting},
    });
    const w = rowOf(vector(3, 'a'));
    const delta = () => w.find('.con-dossier-row__val > .con-dossier-row__delta');
    expect(delta().classes()).to.include('con-dossier-row__delta--gain');
    expect(delta().find('.con-dossier-row__ico').classes()).to.include.members(iconClassFor('megacredits').split(' '));
    expect(delta().find('.con-dossier-row__prod').exists(), 'a stock change wears no production frame').to.eq(false);
    expect([delta().find('.con-dossier-row__cur').text(), delta().find('.con-dossier-row__res').text()]).to.deep.eq(['2%', '3%']);
    expect(delta().find('.con-dossier-row__amt').exists()).to.eq(false);

    // The value node is keyed on its rendered text: another row with the SAME value keeps it, a new value replaces it.
    const node = delta().element;
    await w.setProps({row: vector(3, 'b')});
    expect(delta().element, 'an unchanged value keeps its node — nothing animates').to.eq(node);
    await w.setProps({row: vector(4, 'b')});
    expect(delta().element, 'a changed value is a fresh node — the update flick').to.not.eq(node);
    expect(delta().find('.con-dossier-row__res').text()).to.eq('4%');

    const amount = (over: Partial<DossierRow>) => {
      const d = rowOf(row({delta: {icon: 'megacredits', amount: 3, direction: 'cost'}, ...over})).find('.con-dossier-row__delta');
      return [d.find('.con-dossier-row__amt').text(), d.classes().find((c) => c.startsWith('con-dossier-row__delta--'))];
    };
    expect(amount({})).to.deep.eq(['−3', 'con-dossier-row__delta--cost']);
    expect(amount({delta: {icon: 'megacredits', amount: 3, direction: 'gain'}})).to.deep.eq(['+3', 'con-dossier-row__delta--gain']);
    expect(amount({neutralDelta: true}), 'a quantity the cell holds, addressed to nobody').to.deep.eq(['×3', 'con-dossier-row__delta--neutral']);
    expect(amount({severity: 'danger'}), 'danger outranks the direction').to.deep.eq(['−3', 'con-dossier-row__delta--danger']);

    const production = rowOf(row({delta: {icon: 'megacredits', amount: 1, direction: 'cost', production: true}}));
    expect(production.find('.con-dossier-row__delta > .con-dossier-row__prod > .con-dossier-row__ico').exists()).to.eq(true);
  });

  it('VP as a signed badge or a vector, a milestone\'s standing with its micro track, the timing tag', () => {
    const vp = (over: Partial<DossierRow>) => {
      const badge = rowOf(row(over)).find('.con-dossier-row__vp');
      return badge.exists() ? [badge.text().replace(/\s+/g, ' '), badge.classes().includes('con-dossier-row__vp--neg')] : undefined;
    };
    expect(vp({vp: 2})).to.deep.eq(['+2 VP', false]);
    expect(vp({vp: -1}), 'the magnitude through the template\'s own `Math`').to.deep.eq(['−1 VP', true]);
    expect(vp({vp: 0}), 'a zero is no badge').to.eq(undefined);

    const vector = rowOf(row({vp: 1, vpVector: {from: 2, to: 3}})).findAll('.con-dossier-row__vp');
    expect(vector, 'the vector stands INSTEAD of the badge').to.have.length(1);
    expect(vector[0].classes()).to.include('con-dossier-row__vp--vector');
    expect(vector[0].classes()).to.not.include('con-dossier-row__vp--neg');
    expect([vector[0].find('.con-dossier-row__cur').text(), vector[0].find('.con-dossier-row__res').text()]).to.deep.eq(['2', '3']);
    expect(rowOf(row({vpVector: {from: 3, to: 2}})).find('.con-dossier-row__vp').classes()).to.include('con-dossier-row__vp--neg');

    const milestone = rowOf(row({progress: {from: 1, to: 2, target: 3}, timingKey: 'At game end'}));
    const prog = milestone.find('.con-dossier-row__prog');
    expect(prog.classes()).to.not.include('con-dossier-row__prog--reached');
    expect(prog.find('.con-dossier-row__prog-nums').text().replace(/\s+/g, '')).to.eq('1→2/3');
    expect(prog.findAll('.con-dossier-row__track > .con-dossier-row__seg').map((s) => s.classes().find((c) => c.startsWith('con-dossier-row__seg--'))))
      .to.deep.eq(['con-dossier-row__seg--filled', 'con-dossier-row__seg--gained', 'con-dossier-row__seg--empty']);
    expect(milestone.find('.con-dossier-row__when').text()).to.eq('At game end');
    expect(rowOf(row({progress: {from: 2, to: 3, target: 3}})).find('.con-dossier-row__prog').classes()).to.include('con-dossier-row__prog--reached');

    // An award's standing is a plain counter: no threshold, no track.
    const award = rowOf(row({progress: {from: 4, to: 5}})).find('.con-dossier-row__prog');
    expect(award.find('.con-dossier-row__prog-tgt').exists()).to.eq(false);
    expect(award.find('.con-dossier-row__track').exists()).to.eq(false);
  });

  it('a LANDING\'s own lines — the chosen card with its count moving, the table\'s answers — and the breakdown, the note, the source', () => {
    const landing = rowOf(row({
      delta: {icon: 'megacredits', amount: 2, direction: 'gain'},
      target: {name: CardName.BIRDS, icon: 'megacredits', from: 1, to: 3},
      reactions: [{key: 'fiber', label: 'Martian Fiber', delta: {icon: 'megacredits', amount: 4, direction: 'gain'}}],
      reasons: [{key: 'project', label: 'Standard project', amount: '+1'}, {key: 'city', label: 'Immigrant City', amount: '+1'}],
      note: {text: 'Never shown beside a breakdown'},
      source: 'Mining Guild',
    }));
    expect(landing.classes()).to.include('con-dossier-row--landing');
    const target = landing.find('.con-dossier-row__lines > [data-dossier-target]');
    expect(target.find('.face-stub').attributes('data-name')).to.eq(CardName.BIRDS);
    expect(target.find('.face-stub').attributes('data-lightweight')).to.eq('true');
    expect(target.find('.con-dossier-row__target-name').text()).to.eq(CardName.BIRDS);
    expect([target.find('.con-dossier-row__line-from').text(), target.find('.con-dossier-row__line-to').text()]).to.deep.eq(['1', '3']);
    expect(target.find('.con-dossier-row__line-ico').classes()).to.include.members(iconClassFor('megacredits').split(' '));
    const reactions = landing.findAll('.con-dossier-row__lines > [data-dossier-reaction]');
    expect(reactions.map((r) => [r.find('.con-dossier-row__react-name').text(), r.find('.con-dossier-row__react-val > b').text()]))
      .to.deep.eq([['Martian Fiber', '+4']]);
    expect(reactions[0].find('.con-dossier-row__line-ico').classes()).to.include.members(iconClassFor('megacredits').split(' '));
    expect(landing.findAll('.con-dossier-row__why > .con-dossier-row__why-term').map((t) => [t.find('span').text(), t.find('b').text()]))
      .to.deep.eq([['Standard project', '+1'], ['Immigrant City', '+1']]);
    expect(landing.find('.con-dossier-row__note').exists(), 'the breakdown stands in the note\'s place').to.eq(false);
    expect(landing.find('.con-dossier-row__src').text()).to.eq('Mining Guild');

    // With no breakdown the ONE secondary line is the note — its own params substituted.
    const noted = rowOf(row({note: {text: 'You lose ${0} production', params: ['2']}}));
    expect(noted.find('.con-dossier-row__note').text()).to.eq('You lose 2 production');
    expect(noted.find('.con-dossier-row__why').exists()).to.eq(false);
    expect(noted.find('.con-dossier-row__lines').exists(), 'no landing — no lines').to.eq(false);
  });
});

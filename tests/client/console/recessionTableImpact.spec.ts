import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {ActionPreview, ActionPreviewBranch, TableImpactStep} from '@/common/models/ActionPreviewModel';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import ConsoleTableImpact from '@/client/components/console/foundation/ConsoleTableImpact.vue';
import ConsoleTargetImpactRows from '@/client/components/console/foundation/ConsoleTargetImpactRows.vue';
import {resolvePlayGainIconEnds} from '@/client/console/consoleActionCommitMotion';
import {tableImpactOfPreview, tableImpactStepOf, tableImpactView} from '@/client/console/tableImpact/tableImpactModel';
import {Tag} from '@/common/cards/Tag';

/*
 * P59 Recession — the client half of «whom the play hits»: the read-only step's rows reach the ONE row renderer
 * verbatim (a MarsBot track row included, never re-derived), a spared part is named, and the +10 is born on the
 * printed «10» — never on the «−5» beside it.
 */
const STEP: TableImpactStep = {
  kind: 'tableImpact',
  title: 'Opponents',
  rows: [
    {color: 'red', impact: {color: 'red', changes: [
      {icon: 'megacredits', from: 30, to: 25, scope: 'stock'},
      {icon: 'megacredits', from: 1, to: 0, scope: 'production', steps: 1},
    ]}},
    {color: 'green', impact: {color: 'green', changes: [{icon: 'megacredits', from: 3, to: 0, scope: 'stock'}]},
      skipped: {scope: 'production', icon: 'megacredits', amount: 1, reason: 'Production is protected'}},
    {color: 'bronze', impact: {color: 'bronze', changes: [
      {icon: 'megacredits', from: 12, to: 7, scope: 'stock'},
      {icon: Tag.EARTH, from: 3, to: 2, scope: 'track', steps: 1},
    ]}},
  ],
};

const branch = (steps: ActionPreviewBranch['steps']): ActionPreviewBranch => ({index: -1, title: '', available: true, renderKeys: [], effects: [], steps});
const names: Record<string, string> = {red: 'Red', green: 'Green', bronze: 'MarsBot'};

describe('P59 — whom the play hits (the read-only table step)', () => {
  it('the model reads the step off a branch and names every seat; the rows are the server\'s, verbatim', () => {
    expect(tableImpactStepOf(branch([{kind: 'note', noteKind: 'generic', text: 'x'}]))).eq(undefined);
    const preview = {branches: [branch([STEP])]} as unknown as ActionPreview;
    const view = tableImpactView(tableImpactOfPreview(preview), (c) => names[c]);
    expect(view?.title).eq('Opponents');
    expect(view?.rows.map((r) => [r.color, r.name])).deep.eq([['red', 'Red'], ['green', 'Green'], ['bronze', 'MarsBot']]);
    expect(view?.rows[2].changes).eq(STEP.rows[2].impact.changes);
    expect(view?.rows[1].spared?.reason).eq('Production is protected');
    expect(tableImpactView({...STEP, rows: []}, (c) => c)).eq(undefined);
  });

  it('the block renders a line per seat — dot, name, the ONE row renderer, a spared part struck with its reason', () => {
    const view = tableImpactView(STEP, (c) => names[c])!;
    const w = mount(ConsoleTableImpact, {props: {view}, global: {mocks: {$t: (key: string) => key}}});
    const seats = w.findAll('[data-table-impact-seat]');
    expect(seats.map((s) => s.attributes('data-table-impact-seat'))).deep.eq(['red', 'green', 'bronze']);
    expect(seats[0].findComponent(ConsoleTargetImpactRows).exists()).eq(true);
    expect(seats[0].findAll('.con-impact-row').map((r) => r.find('.con-impact-row__num').text())).deep.eq(['30 → 25', '1 → 0']);
    expect(seats[0].find('.con-impact-row--prod').exists()).eq(true);
    const spared = seats[1].find('[data-table-impact-spared]');
    expect(spared.attributes('data-spared-scope')).eq('production');
    expect(spared.text()).contains('Production is protected');
    // The bot's production row is its TRACK — drawn by its tag, with the divisions it moves; no branch on the bot.
    const track = seats[2].find('[data-impact-scope="track"]');
    expect(track.find('.con-impact-row__tag').exists()).eq(true);
    expect(track.find('.con-impact-row__steps').text()).eq('−1');
    expect(w.html()).not.contains(' title=');
  });

  it('the +10 is born on the printed «10» — never on the «−5» or the production «−1» beside it', () => {
    const face = mount(PremiumCard, {props: {card: {name: CardName.RECESSION} as CardModel}, attachTo: document.body});
    const tiles = face.findAll('.pcard-mi--mc').map((t) => t.element as HTMLElement);
    expect(tiles.map((t) => t.textContent?.trim())).deep.eq(['−5', '−1', '10']);
    for (const el of [...tiles, ...face.findAll('.pcard-prod').map((p) => p.element as HTMLElement)]) {
      el.getBoundingClientRect = () => ({left: 0, top: 0, width: 20, height: 20, right: 20, bottom: 20, x: 0, y: 0, toJSON: () => ({})}) as DOMRect;
    }
    const [end] = resolvePlayGainIconEnds(face.element as HTMLElement, [{channel: 'stock', resource: 'megacredits', amount: 10}]);
    expect(end?.el).eq(tiles[2]);
    face.unmount();
  });
});

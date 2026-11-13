/*
 * ConsoleCellPortrait — the head of the board column: one cell at scene scale with its six neighbours. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md), presentation only: WHAT the portrait says is
 * the pure `cellDossier.ts`'s (spec'd under the server runner) — this spec reads what the component DRAWS for its
 * props: the square's ground and its piece or its printed bonus, the owner's cube, the water under a city, the tile's
 * own points, the ring's six fixed slots with their tones and chips, the marks. It emits nothing and exposes nothing.
 * (What its host hands it is `ConsoleContextPanel.spec.ts`'s.) The score shield is stubbed by name.
 */
import {expect} from 'chai';
import {defineComponent, h} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CellPortrait, CellPortraitPiece} from '@/common/boards/BoardInformationFacts';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SpaceType} from '@/common/boards/SpaceType';
import {TileType} from '@/common/TileType';
import {SpaceId} from '@/common/Types';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {CellMark, CellRingSlot} from '@/client/console/cellDossier';
import {cellBonusIcons} from '@/client/console/revealStageHead';
import {translateTextWithParams} from '@/client/directives/i18n';
import ConsoleCellPortrait from '@/client/components/console/ConsoleCellPortrait.vue';

const VpBadgeStub = defineComponent({
  name: 'ConsoleVpBadge',
  props: {label: {type: String, required: true}},
  render() {
    return h('i', {'class': 'vp-badge-stub'});
  },
});

function piece(space: SpaceId, more: Partial<CellPortraitPiece> = {}): CellPortraitPiece {
  return {space, spaceType: SpaceType.LAND, bonus: [], ...more};
}

function cell(more: Partial<CellPortrait> = {}): CellPortrait {
  return {...piece('05'), neighbours: [], ...more};
}

type Props = {
  portrait: CellPortrait,
  ring?: ReadonlyArray<CellRingSlot>,
  marks?: ReadonlyArray<CellMark>,
  ownVp?: number,
  aresTiles?: boolean,
};

function portraitOf(props: Props) {
  return mount(ConsoleCellPortrait, {
    global: {...globalConfig.global, stubs: {ConsoleVpBadge: VpBadgeStub}},
    props,
  });
}

function squeezed(text: string): string {
  return text.replace(/\s+/g, '');
}

describe('ConsoleCellPortrait — one cell and its six neighbours', () => {
  it('an empty square: its ground and its printed bonus as icons — no ring, no cube, no points, no marks', () => {
    const bonus = [SpaceBonus.PLANT, SpaceBonus.PLANT];
    const w = portraitOf({portrait: cell({bonus})});

    expect(w.classes()).to.deep.eq(['con-cellp']);
    expect(w.attributes('data-cell-portrait')).to.eq('');
    expect(w.attributes('data-cell-space')).to.eq('05');
    expect(w.findAll('.con-cellp__nb')).to.have.lengthOf(0);

    const hex = w.find('.con-cellp__centre > .con-cellp__hex');
    expect(hex.classes()).to.deep.eq(['con-cellp__hex', 'con-cellp__hex--c', 'con-cellp__hex--land']);
    expect(hex.attributes('aria-hidden')).to.eq('true');
    expect(hex.find('.con-cellp__art').exists(), 'no piece, no art').to.eq(false);
    expect(hex.find('.con-cellp__bonus').classes()).to.deep.eq(['con-cellp__bonus', 'con-cellp__bonus--n2']);
    expect(hex.findAll('.con-cellp__bonus-ico').map((ico) => ico.classes().filter((c) => c !== 'con-cellp__bonus-ico')))
      .to.deep.eq(cellBonusIcons(bonus).map((icon) => [icon]));

    for (const absent of ['.con-cellp__under', '.con-cellp__cube', '[data-cell-vp]', '.con-cellp__marks']) {
      expect(w.find(absent).exists(), absent).to.eq(false);
    }

    // The ground is the square's printed kind; a reserved square outranks it, a volcanic one tints its land half.
    const groundOf = (more: Partial<CellPortrait>): string => {
      const classes = portraitOf({portrait: cell(more)}).find('.con-cellp__hex--c').classes();
      return classes[classes.length - 1];
    };
    expect(groundOf({spaceType: SpaceType.OCEAN})).to.eq('con-cellp__hex--ocean');
    expect(groundOf({spaceType: SpaceType.COVE})).to.eq('con-cellp__hex--cove');
    expect(groundOf({spaceType: SpaceType.COVE, volcanic: true})).to.eq('con-cellp__hex--cove-volcanic');
    expect(groundOf({spaceType: SpaceType.DEFLECTION_ZONE})).to.eq('con-cellp__hex--deflection');
    expect(groundOf({volcanic: true})).to.eq('con-cellp__hex--volcanic');
    expect(groundOf({spaceType: SpaceType.OCEAN, reserved: 'noctis'})).to.eq('con-cellp__hex--reserved');
  });

  it('a piece on the square: the board\'s own art over the bonus, the owner\'s cube, the water under a city, the tile\'s points', () => {
    const w = portraitOf({
      portrait: cell({bonus: [SpaceBonus.STEEL], tileType: TileType.CITY, ownerColor: 'blue', under: TileType.OCEAN}),
      ownVp: 2,
    });
    const centre = w.find('.con-cellp__centre');
    expect(centre.find('.con-cellp__hex--c > .con-cellp__art').classes()).to.deep.eq(['con-cellp__art', 'con-cellp__art--c', 'board-space-tile--city']);
    expect(centre.find('.con-cellp__bonus').exists(), 'the piece covers the printed bonus').to.eq(false);
    expect(centre.find('.con-cellp__under').attributes('aria-hidden')).to.eq('true');
    expect(centre.find('.con-cellp__under > .con-cellp__art').classes()).to.deep.eq(['con-cellp__art', 'con-cellp__art--under', 'board-space-tile--ocean']);
    expect(centre.find('.con-cellp__cube').classes()).to.deep.eq(['con-cellp__cube', 'con-cellp__cube--c', 'player_bg_color_blue']);

    const vp = centre.find('[data-cell-vp]');
    expect(vp.classes()).to.deep.eq(['con-cellp__vp']);
    expect(vp.find('b').text()).to.eq('+2');
    expect(w.findComponent(VpBadgeStub).props('label')).to.eq('VP');

    const lost = portraitOf({portrait: cell({tileType: TileType.GREENERY}), ownVp: -1});
    expect(lost.find('[data-cell-vp] > b').text(), 'a loss is a true minus').to.eq('−1');
    expect(lost.find('.con-cellp__cube').exists(), 'nobody\'s piece wears no cube').to.eq(false);

    // A hazard is no one's: its colour is never drawn as a cube.
    const hazard = portraitOf({portrait: cell({tileType: TileType.GREENERY, ownerColor: 'red', hazard: true})});
    expect(hazard.find('.con-cellp__cube').exists()).to.eq(false);
  });

  it('the ring: six fixed slots — an edge draws no hex, a lit neighbour wears its tone and what it means, a bare one is quiet', () => {
    const ring: ReadonlyArray<CellRingSlot> = [
      {dir: 0},
      {dir: 1, piece: piece('06', {spaceType: SpaceType.OCEAN, tileType: TileType.OCEAN}), tone: 'ocean', chip: {delta: {icon: 'megacredits', amount: 2, direction: 'gain'}}},
      {dir: 2, piece: piece('13', {tileType: TileType.CITY, ownerColor: 'red'}), tone: 'score', chip: {vp: 1, for: 'red'}},
      {dir: 3, piece: piece('20', {tileType: TileType.GREENERY, ownerColor: 'green', hazard: true}), tone: 'penalty', chip: {delta: {icon: 'megacredits', amount: 8, direction: 'cost'}}},
      {dir: 4, piece: piece('19')},
      {dir: 5, piece: piece('12', {tileType: TileType.GREENERY, ownerColor: 'blue'}), chip: {vp: -1}},
    ];
    const w = portraitOf({portrait: cell(), ring});
    expect(w.classes()).to.deep.eq(['con-cellp', 'con-cellp--ring']);

    const slots = w.findAll('.con-cellp__stage > .con-cellp__nb');
    const poses = slots.map((slot) => slot.classes().filter((c) => c !== 'con-cellp__nb').map((c) => c.replace('con-cellp__nb--', '')).join(' '));
    expect(poses).to.deep.eq(['d0 edge', 'd1 lit ocean', 'd2 lit score', 'd3 lit penalty', 'd4 quiet', 'd5']);
    expect(slots.map((slot) => slot.attributes('data-ring-dir'))).to.deep.eq(['0', '1', '2', '3', '4', '5']);
    expect(slots.map((slot) => slot.attributes('data-ring-space'))).to.deep.eq([undefined, '06', '13', '20', '19', '12']);
    expect(slots.map((slot) => slot.attributes('data-ring-tone'))).to.deep.eq([undefined, 'ocean', 'score', 'penalty', undefined, undefined]);

    expect(slots[0].element.children, 'the board\'s edge: no hex').to.have.lengthOf(0);
    expect(slots[1].find('.con-cellp__hex').classes()).to.deep.eq(['con-cellp__hex', 'con-cellp__hex--nb', 'con-cellp__hex--ocean']);
    expect(slots[1].find('.con-cellp__art').classes()).to.deep.eq(['con-cellp__art', 'con-cellp__art--nb', 'board-space-tile--ocean']);
    expect(slots[4].find('.con-cellp__art').exists(), 'an empty neighbour').to.eq(false);
    expect(slots.map((slot) => slot.find('.con-cellp__cube').exists()), 'a cube for an owned piece that is no hazard')
      .to.deep.eq([false, false, true, false, false, true]);
    expect(slots[2].find('.con-cellp__cube').classes()).to.deep.eq(['con-cellp__cube', 'con-cellp__cube--nb', 'player_bg_color_red']);

    // A resource chip: the game's own icon, the signed amount.
    const gain = slots[1].find('[data-ring-chip]');
    expect(gain.find('.con-cellp__chip-ico').classes()).to.deep.eq(['con-cellp__chip-ico', ...iconClassFor('megacredits').split(' ')]);
    expect(squeezed(gain.text())).to.eq('+2');
    expect(squeezed(slots[3].find('[data-ring-chip]').text()), 'a cost is a true minus').to.eq('−8');

    // A points chip: whose points (another seat's — a dot in its colour), the signed count, the unit.
    const score = slots[2].find('[data-ring-chip]');
    expect(score.find('.con-cellp__chip-dot').classes()).to.deep.eq(['con-cellp__chip-dot', 'player_bg_color_red']);
    expect(score.find('.con-cellp__chip-ico').exists()).to.eq(false);
    expect(squeezed(score.text())).to.eq('+1VP');
    const own = slots[5].find('[data-ring-chip]');
    expect(own.find('.con-cellp__chip-dot').exists(), 'the viewer\'s own points wear no dot').to.eq(false);
    expect(squeezed(own.text())).to.eq('−1VP');
    expect(slots[4].find('[data-ring-chip]').exists()).to.eq(false);
  });

  it('the marks under the stage: one line each, a parameterised key filled in', () => {
    const marks: ReadonlyArray<CellMark> = [{key: 'External area'}, {key: 'Stack of ${0}', params: ['3']}];
    const w = portraitOf({portrait: cell(), marks});
    expect(w.findAll('.con-cellp__marks > .con-cellp__mark').map((mark) => mark.text()))
      .to.deep.eq(['External area', translateTextWithParams('Stack of ${0}', ['3'])]);
    expect(translateTextWithParams('Stack of ${0}', ['3']), 'the unit runner renders the English key, filled').to.eq('Stack of 3');
  });
});

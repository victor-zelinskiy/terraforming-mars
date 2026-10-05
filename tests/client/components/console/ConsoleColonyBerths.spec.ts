import {expect} from 'chai';
import {mount, VueWrapper} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import ConsoleColonyTrackInstrument from '@/client/components/console/ConsoleColonyTrackInstrument.vue';
import ConsoleColonyTile from '@/client/components/console/ConsoleColonyTile.vue';
import ConsoleColonyInspect from '@/client/components/console/ConsoleColonyInspect.vue';

const RED: Color = 'red';
const BLUE: Color = 'blue';

function luna(colonies: Array<Color>, over: Partial<ColonyModel> = {}): ColonyModel {
  return {name: ColonyName.LUNA, isActive: true, trackPosition: Math.max(1, colonies.length), visitor: undefined, colonies, ...over};
}

function players(): Array<PublicPlayerModel> {
  return [
    {color: RED, name: 'Ada', tableau: []} as unknown as PublicPlayerModel,
    {color: BLUE, name: 'Bo', tableau: []} as unknown as PublicPlayerModel,
  ];
}

/*
 * A BERTH BEYOND THE PRINTED LIMIT — one model, three hosts
 * (docs/TURMOIL_REDUX_EXCLUSIVE_COLONY.md § the places).
 *
 * What this spec owns: the fourth berth EXISTS exactly where the model has it
 * (a fourth cube, or a build door's projection), it publishes the flight's
 * anchors (`<Name>#3` + the seat), it says «beyond the limit» by its own
 * objects (the limit mark, the plate, one word) — and an ORDINARY tile renders
 * none of those nodes, in any host. The geometry is the e2e probe's.
 */
describe('a berth beyond the printed limit — the three hosts', () => {
  let originalTranslations: unknown;

  beforeEach(() => {
    originalTranslations = (window as any)._translations;
    (window as any)._translations = {};
  });

  afterEach(() => {
    (window as any)._translations = originalTranslations;
  });

  describe('the trade-track instrument (the stage and the dossier)', () => {
    function mountInstrument(colony: ColonyModel, props: Record<string, unknown> = {}): VueWrapper<any> {
      return mount(ConsoleColonyTrackInstrument, {
        global: {...globalConfig.global},
        props: {
          colony,
          metadata: getColony(colony.name),
          markerPosition: colony.trackPosition,
          effectivePosition: colony.trackPosition,
          ownerNames: colony.colonies.map((c) => (c === RED ? 'Ada' : 'Bo')),
          viewerColor: BLUE,
          ...props,
        },
      });
    }

    it('an ORDINARY tile: three berths, the owner bonus from the fourth column, and not one over-limit node', () => {
      for (const colonies of [[], [RED], [RED, BLUE], [RED, RED, BLUE]] as Array<Array<Color>>) {
        const w = mountInstrument(luna(colonies));
        expect(w.findAll('.con-colfocus__berth').length, `${colonies.length} cubes`).to.eq(3);
        expect(w.find('.con-colfocus__berths').attributes('style')).to.include('--berths: 3');
        for (const selector of [
          '[data-colony-berth-overlimit]', '.con-colfocus__berth--overlimit', '.con-colfocus__limitmark',
          '.con-colfocus__limitplate', '.con-colfocus__limitword', '.con-colfocus__berth-ghost',
        ]) {
          expect(w.find(selector).exists(), `${selector} on an ordinary tile (${colonies.length} cubes)`).to.eq(false);
        }
        expect(w.find('[data-colony-build-slot="Luna#3"]').exists()).to.eq(false);
      }
    });

    it('an ordinary BUILD PREVIEW points at the next berth and adds none', () => {
      const w = mountInstrument(luna([RED]), {buildPreview: true});
      expect(w.findAll('.con-colfocus__berth').length).to.eq(3);
      const berths = w.findAll('.con-colfocus__berth');
      expect(berths[1].classes()).to.include('con-colfocus__berth--dest');
      expect(w.find('[data-colony-berth-overlimit]').exists()).to.eq(false);
    });

    it('FOUR cubes: a fourth berth under the fourth cell, with the flight\'s anchors and its own objects', () => {
      const w = mountInstrument(luna([RED, RED, BLUE, BLUE]));
      const berths = w.findAll('.con-colfocus__berth');
      expect(berths.length).to.eq(4);
      expect(w.find('.con-colfocus__berths').attributes('style'), 'the owner bonus yields one column').to.include('--berths: 4');
      // The anchors the build hero and the owners' bonus read.
      const seat = w.find('[data-colony-build-slot="Luna#3"]');
      expect(seat.exists()).to.eq(true);
      expect(seat.attributes('data-colony-build-seat')).to.not.eq(undefined);
      expect(seat.attributes('data-colony-bonus-source')).to.eq('Luna');
      // The fourth berth alone is beyond the limit — and its limit is passed (a cube stands there).
      expect(w.findAll('[data-colony-berth-overlimit]').length).to.eq(1);
      expect(berths[3].attributes('data-colony-berth-overlimit')).to.eq('passed');
      expect(berths[3].classes()).to.include.members(['con-colfocus__berth--overlimit', 'con-colfocus__berth--taken', 'con-colfocus__berth--admitted', 'con-colfocus__berth--mine']);
      expect(berths[3].classes()).to.not.include('con-colfocus__berth--projected');
      // ONE limit mark, ONE plate, ONE word — and no text on the berth besides its owner's name.
      expect(w.findAll('.con-colfocus__limitmark').length).to.eq(1);
      expect(w.findAll('.con-colfocus__limitplate').length).to.eq(1);
      expect(w.findAll('.con-colfocus__limitword').length).to.eq(1);
      expect(w.find('.con-colfocus__limitword').text()).to.eq('Over the limit');
      expect(berths[3].find('.con-colfocus__berth-name').text()).to.eq('Bo');
      // The printed three stay exactly what they were.
      for (const i of [0, 1, 2]) {
        expect(berths[i].attributes('data-colony-berth-overlimit'), `berth ${i}`).to.eq(undefined);
        expect(berths[i].find('.con-colfocus__limitplate').exists(), `berth ${i}`).to.eq(false);
      }
      // The rule above it is read from the cubes: four cells are held, the stop stands on the fifth.
      expect(w.findAll('.con-colfocus__xcell--protected').length).to.eq(4);
      expect(w.find('.con-colfocus__trackzone').attributes('style')).to.include('--stop-col: 4');
    });

    it('a DOOR projecting beyond the limit: the berth stands BEFORE its cube — dashed, with the cube\'s ghost over the bonus it pays', () => {
      const w = mountInstrument(luna([RED, RED, BLUE]), {buildPreview: true, buildSlot: 3, projectedColor: BLUE});
      const berths = w.findAll('.con-colfocus__berth');
      expect(berths.length).to.eq(4);
      expect(berths[3].attributes('data-colony-berth-overlimit'), 'the limit still stands').to.eq('standing');
      expect(berths[3].classes()).to.include.members(['con-colfocus__berth--overlimit', 'con-colfocus__berth--projected', 'con-colfocus__berth--dest']);
      expect(berths[3].classes()).to.not.include('con-colfocus__berth--admitted');
      // The seat is a measurement slot with the bonus glyph the build will pay — the reward has a place to leave from.
      const seat = w.find('[data-colony-build-slot="Luna#3"]');
      expect(seat.find('.benefit-glyph').exists(), 'the bonus the fourth berth pays (the last printed cell)').to.eq(true);
      expect(seat.find('.con-colfocus__berth-ghost').classes()).to.include('player_translucent_bg_color_blue');
      expect(seat.attributes('data-colony-bonus-source'), 'nobody stands there yet').to.eq(undefined);
      // The preview's ghost stop stands one cell further right than the stop.
      expect(w.find('.con-colfocus__trackzone').attributes('style')).to.include('--stop-col: 3').and.include('--ghost-col: 4');
      expect(w.findAll('.con-colfocus__xcell')[3].classes()).to.include('con-colfocus__xcell--willprotect');
    });

    it('ADMISSION is one class flip: the mark is passed and the contour closes before any cube stands', () => {
      const w = mountInstrument(luna([RED, RED, BLUE]), {buildPreview: true, buildSlot: 3, projectedColor: BLUE, admitCell: 3});
      const berth = w.findAll('.con-colfocus__berth')[3];
      expect(berth.attributes('data-colony-berth-overlimit')).to.eq('passed');
      expect(berth.classes()).to.include('con-colfocus__berth--admitted');
    });

    it('a door projecting UNDER the limit (a second own colony) opens no fourth berth and no mark', () => {
      const w = mountInstrument(luna([BLUE]), {buildPreview: true, buildSlot: 1, projectedColor: BLUE});
      expect(w.findAll('.con-colfocus__berth').length).to.eq(3);
      expect(w.find('[data-colony-berth-overlimit]').exists()).to.eq(false);
      expect(w.find('.con-colfocus__berth-ghost').exists(), 'the ghost is the over-limit berth\'s').to.eq(false);
    });
  });

  describe('the grid tile', () => {
    function mountTile(colony: ColonyModel, props: Record<string, unknown> = {}): VueWrapper<any> {
      return mount(ConsoleColonyTile, {
        global: {...globalConfig.global},
        props: {colony, ...props},
      });
    }

    it('an ORDINARY tile: three slots, no compact metric, no over-limit attribute', () => {
      for (const colonies of [[], [RED, BLUE], [RED, RED, BLUE]] as Array<Array<Color>>) {
        const w = mountTile(luna(colonies));
        expect(w.findAll('.con-coltile__build-slot').length, `${colonies.length} cubes`).to.eq(3);
        expect(w.find('.con-coltile__build').classes()).to.not.include('con-coltile__build--over');
        expect(w.find('.con-coltile__build').attributes('style')).to.eq(undefined);
        expect(w.find('[data-colony-berth-overlimit]').exists()).to.eq(false);
      }
    });

    it('FOUR cubes: four slots in the same row, the fourth beyond the limit, its seat published', () => {
      const w = mountTile(luna([RED, RED, BLUE, BLUE]));
      const slots = w.findAll('.con-coltile__build-slot');
      expect(slots.length).to.eq(4);
      expect(w.find('.con-coltile__build').classes()).to.include('con-coltile__build--over');
      expect(w.find('.con-coltile__build').attributes('style')).to.include('--printed: 3');
      expect(slots[3].attributes('data-colony-build-slot')).to.eq('Luna#3');
      expect(slots[3].attributes('data-colony-berth-overlimit')).to.eq('');
      expect(slots[3].classes()).to.include.members(['con-coltile__build-slot--occupied', 'con-coltile__build-slot--overlimit']);
      expect(slots[3].find('[data-colony-build-seat]').exists()).to.eq(true);
      expect(slots.slice(0, 3).every((slot) => slot.attributes('data-colony-berth-overlimit') === undefined)).to.eq(true);
      // The track still reads the server's marker — «5/7» for a marker lifted to the fourth colony's floor.
      expect(w.find('.con-coltile__track-pos').text()).to.eq('5/7');
    });

    it('a door\'s cube projected into the FOURTH berth: the slot stands before the cube, as a ghost over its bonus', () => {
      const w = mountTile(luna([RED, RED, BLUE]), {projectedCube: BLUE, projectedCubeSlot: 3});
      const slots = w.findAll('.con-coltile__build-slot');
      expect(slots.length).to.eq(4);
      expect(w.find('.con-coltile__build').classes()).to.include('con-coltile__build--over');
      const seat = slots[3].find('[data-colony-build-seat]');
      expect(seat.classes()).to.include('con-coltile__build-seat--projected');
      expect(seat.attributes('data-colony-projected-cube')).to.eq(BLUE);
      expect(seat.find('.con-coltile__ghost-cube').exists()).to.eq(true);
      expect(seat.find('.benefit-glyph').exists(), 'the bonus the fourth berth pays').to.eq(true);
      expect(slots[3].classes()).to.not.include('con-coltile__build-slot--occupied');
    });

    it('a door\'s cube projected UNDER the limit: three slots, the ghost in its own berth, no compact metric', () => {
      const w = mountTile(luna([BLUE]), {projectedCube: BLUE, projectedCubeSlot: 1});
      const slots = w.findAll('.con-coltile__build-slot');
      expect(slots.length).to.eq(3);
      expect(w.find('.con-coltile__build').classes()).to.not.include('con-coltile__build--over');
      expect(slots[1].find('.con-coltile__ghost-cube').exists()).to.eq(true);
      expect(slots[2].find('.con-coltile__ghost-cube').exists()).to.eq(false);
    });
  });

  describe('the dossier', () => {
    function mountDossier(colony: ColonyModel): VueWrapper<any> {
      return mount(ConsoleColonyInspect, {
        global: {...globalConfig.global, stubs: {GamepadGlyph: true, BarButtonIcon: true}},
        props: {colony, players: players(), viewerColor: RED, embedded: true},
      });
    }

    it('an ordinary tile: three berths and no over-limit line', () => {
      const w = mountDossier(luna([RED, RED, BLUE]));
      expect(w.findAll('.con-colfocus__berth').length).to.eq(3);
      expect(w.find('[data-colony-over-limit]').exists()).to.eq(false);
      expect(w.find('[data-colony-berth-overlimit]').exists()).to.eq(false);
    });

    it('FOUR cubes: the same instrument draws the fourth berth, and the act column states the fact ONCE — never the rules panel', () => {
      const w = mountDossier(luna([RED, RED, BLUE, BLUE]));
      expect(w.findAll('.con-colfocus__berth').length).to.eq(4);
      expect(w.find('[data-colony-build-slot="Luna#3"]').exists()).to.eq(true);
      const line = w.findAll('[data-colony-over-limit]');
      expect(line.length).to.eq(1);
      expect(line[0].text()).to.include('Over the limit').and.include('Colony no. 4').and.include('Bo');
      expect(w.find('.con-colinspect__side [data-colony-over-limit]').exists(), 'in the act column').to.eq(true);
      expect(w.find('.con-colinspect__rules [data-colony-over-limit]').exists(), 'never in the rules panel').to.eq(false);
      // Four names for four berths.
      expect(w.findAll('.con-colfocus__berth-name').map((n) => n.text())).to.deep.eq(['Ada', 'Ada', 'Bo', 'Bo']);
    });
  });
});

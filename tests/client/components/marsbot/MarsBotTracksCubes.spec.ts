import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {MarsBotCorpModel} from '@/common/automa/MarsBotCorpData';
import {MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {Tag} from '@/common/cards/Tag';
import {trackCells} from '@/client/components/marsbot/marsBotView';
import MarsBotTracks from '@/client/components/marsbot/MarsBotTracks.vue';

const TRACK: MarsBotTrackModel = {
  tags: [Tag.BUILDING],
  position: 2,
  maxPosition: 18,
  layout: [undefined, undefined, 'ocean', undefined, undefined, 'tr2', 'temperature'],
  regressed: [],
};

const HELION: MarsBotCorpModel = {
  id: MarsBotCorpId.C03_HELION,
  original: 'Helion' as MarsBotCorpModel['original'],
  startingTags: [],
  resources: 0,
  cubes: [
    {trackIndex: 0, position: 6, cubeType: 'white', spent: false},
    {trackIndex: 0, position: 2, cubeType: 'black', spent: true},
  ],
  stats: {},
};

function mountTracks(corporation?: MarsBotCorpModel) {
  return mount(MarsBotTracks, {
    props: {tracks: [TRACK], botColor: 'red' as never, corporation},
    global: {mocks: {$t: (s: string) => s}},
  });
}

/**
 * The corporation's track cubes (RB-B special cubes) are OPEN information the
 * player browses on the bot's mat — they must be drawn there, tell live from
 * spent, and explain themselves through the corporation's own legend.
 */
describe('MarsBotTracks — corporation cubes', () => {
  it('trackCells attaches a cube to its own space only', () => {
    const cells = trackCells(TRACK, HELION.cubes);
    expect(cells[6].cube).deep.eq({cubeType: 'white', spent: false});
    expect(cells[2].cube).deep.eq({cubeType: 'black', spent: true});
    expect(cells[5].cube).is.undefined;
  });

  it('draws a cube per seeded space, marking the spent one', () => {
    const wrapper = mountTracks(HELION);
    expect(wrapper.findAll('.mb-track .mb-cell__cube--white')).has.length(1);
    expect(wrapper.findAll('.mb-track .mb-cell__cube--black')).has.length(1);
    expect(wrapper.findAll('.mb-track .mb-cell__cube--spent'), 'the black cube already fired').has.length(1);
  });

  it('renders the legend rows of the colours this corporation actually seeded', () => {
    const wrapper = mountTracks(HELION);
    const legend = wrapper.find('.mb-cubelegend');
    expect(legend.exists()).is.true;
    expect(legend.findAll('.mb-cubelegend__row')).has.length(2);
    expect(legend.text()).contains('Instead of raising the temperature');
    expect(legend.text()).contains('raises the temperature 1 step');
  });

  it('a corporation with no cubes draws neither cubes nor a legend', () => {
    const wrapper = mountTracks({...HELION, id: MarsBotCorpId.C01_CREDICOR, cubes: []});
    expect(wrapper.find('.mb-cell__cube').exists()).is.false;
    expect(wrapper.find('.mb-cubelegend').exists()).is.false;
  });

  it('a corpless bot (legacy save) renders the plain mat', () => {
    const wrapper = mountTracks(undefined);
    expect(wrapper.find('.mb-cell__cube').exists()).is.false;
    expect(wrapper.find('.mb-cubelegend').exists()).is.false;
    expect(wrapper.find('.mb-tracks').exists()).is.true;
  });
});

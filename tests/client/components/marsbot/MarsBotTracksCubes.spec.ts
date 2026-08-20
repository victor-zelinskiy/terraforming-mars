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

/**
 * C04's setup replaces the TRACKERS of two tracks with white cubes «as a
 * reminder». The digital mat owes the player the same cue: the marked track's
 * current position wears the cube, and the legend says what it reminds of.
 */
describe('MarsBotTracks — white trackers', () => {
  const CINEMATICS: MarsBotCorpModel = {
    id: MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS,
    original: 'Interplanetary Cinematics' as MarsBotCorpModel['original'],
    startingTags: [],
    resources: 0,
    cubes: [],
    whiteMarkerTracks: [0],
    stats: {},
  };

  it('paints the marked track current position — and nothing else', () => {
    const wrapper = mountTracks(CINEMATICS);
    const markers = wrapper.findAll('.mb-track .mb-cell__marker');
    expect(markers, 'one marker, on the one marked track').has.length(1);
    // TRACK.position is 2 — the marker rides the current cell, not a fixed one.
    const cells = wrapper.findAll('.mb-track .mb-cell');
    expect(cells[TRACK.position].find('.mb-cell__marker').exists()).is.true;
    expect(wrapper.find('.mb-track--whitemarker').exists()).is.true;
  });

  it('the legend names what the white trackers remind of', () => {
    const wrapper = mountTracks(CINEMATICS);
    const legend = wrapper.find('.mb-cubelegend');
    expect(legend.exists()).is.true;
    expect(legend.findAll('.mb-cubelegend__row')).has.length(1);
    expect(legend.text()).contains('Advancing this track pays MarsBot 2');
  });

  it('an UNMARKED track keeps the ordinary position outline', () => {
    const wrapper = mountTracks({...CINEMATICS, whiteMarkerTracks: [1]});
    expect(wrapper.findAll('.mb-track .mb-cell__marker'), 'track 1 does not exist here').is.empty;
    expect(wrapper.find('.mb-track--whitemarker').exists()).is.false;
  });

  it('the SILVER cube (C13) draws in its own colour with its own legend', () => {
    const silver: MarsBotCorpModel = {
      id: MarsBotCorpId.C13_CHEUNG_SHING_MARS,
      original: 'Cheung Shing MARS' as MarsBotCorpModel['original'],
      startingTags: [],
      resources: 0,
      cubes: [{trackIndex: 0, position: 4, cubeType: 'credit', spent: false}],
      stats: {},
    };
    const wrapper = mountTracks(silver);
    expect(wrapper.findAll('.mb-track .mb-cell__cube--credit')).has.length(1);
    expect(wrapper.find('.mb-cubelegend').text()).contains('5');
  });

  it('a corporation that paints no trackers draws none', () => {
    const wrapper = mountTracks(HELION);
    expect(wrapper.find('.mb-cell__marker').exists()).is.false;
  });
});

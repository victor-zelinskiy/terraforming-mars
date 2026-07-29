import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {MarsBotModel, MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {marsBotRailEconomy, marsBotRailTracks} from '@/client/components/console/marsBotRailModel';

function track(tags: Array<Tag>, position: number, maxPosition = 18): MarsBotTrackModel {
  return {tags, position, maxPosition, layout: [], regressed: []};
}

function fakeAutoma(overrides: Partial<MarsBotModel> = {}): MarsBotModel {
  return {
    difficulty: 'normal',
    tracks: [],
    actionDeckSize: 10,
    bonusDeckSize: 7,
    bonusDiscard: [],
    recurringBonusCards: [],
    destroyedBonusCards: [],
    playedPile: [],
    floaters: 0,
    ...overrides,
  } as unknown as MarsBotModel;
}

const bot = {megacredits: 42} as unknown as PublicPlayerModel;

describe('marsBotRailModel — the dedicated MarsBot rail presentation', () => {
  it('economy: the M€ supply always; floaters only once the bot holds any', () => {
    const dry = marsBotRailEconomy(bot, fakeAutoma());
    expect(dry.map((r) => r.key)).to.deep.eq(['megacredits']);
    expect(dry[0].value).to.eq(42);
    expect(dry[0].metricKey).to.eq('megacredits.stock');

    const withFloaters = marsBotRailEconomy(bot, fakeAutoma({floaters: 3}));
    expect(withFloaters.map((r) => r.key)).to.deep.eq(['megacredits', 'floaters']);
    expect(withFloaters[1].value).to.eq(3);
    expect(withFloaters[1].iconClass).to.contain('card-resource');
  });

  it('tracks: board order, EVERY mapped tag preserved (never just the first)', () => {
    const tracks = marsBotRailTracks(fakeAutoma({tracks: [
      track([Tag.BUILDING], 2),
      track([Tag.POWER, Tag.JOVIAN], 0),
      track([Tag.PLANT, Tag.ANIMAL, Tag.MICROBE], 5),
    ]}));
    expect(tracks).to.have.length(3);
    expect(tracks[1].tags).to.deep.eq([Tag.POWER, Tag.JOVIAN]);
    expect(tracks[2].tags).to.deep.eq([Tag.PLANT, Tag.ANIMAL, Tag.MICROBE]);
  });

  it('progress: fill follows the track\'s OWN max (Venus = 12) and rounds', () => {
    const tracks = marsBotRailTracks(fakeAutoma({tracks: [
      track([Tag.BUILDING], 2, 18),
      track([Tag.VENUS], 6, 12),
    ]}));
    expect(tracks[0].fillPercent).to.eq(11); // 2/18 → 11.1 → 11
    expect(tracks[1].fillPercent).to.eq(50);
    expect(tracks[1].maxPosition).to.eq(12);
  });

  it('defensive clamps: an over-max / negative position never overflows the bar', () => {
    const tracks = marsBotRailTracks(fakeAutoma({tracks: [
      track([Tag.SPACE], 25, 18),
      track([Tag.EARTH], -2, 18),
    ]}));
    expect(tracks[0].position).to.eq(18);
    expect(tracks[0].fillPercent).to.eq(100);
    expect(tracks[1].position).to.eq(0);
    expect(tracks[1].fillPercent).to.eq(0);
  });

  it('keys are stable per game (index + first tag) — metric scopes never drift', () => {
    const automa = fakeAutoma({tracks: [track([Tag.EARTH, Tag.CITY], 1)]});
    const a = marsBotRailTracks(automa);
    const b = marsBotRailTracks(fakeAutoma({tracks: [track([Tag.EARTH, Tag.CITY], 9)]}));
    expect(a[0].key).to.eq(b[0].key);
    expect(a[0].metricKey).to.eq(b[0].metricKey);
  });
});

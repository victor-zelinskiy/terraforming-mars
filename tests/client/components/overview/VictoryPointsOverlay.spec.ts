import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import VictoryPointsOverlay from '@/client/components/overview/VictoryPointsOverlay.vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {GameModel} from '@/common/models/GameModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {RecursivePartial} from '@/common/utils/utils';
import {Phase} from '@/common/Phase';

function fullBreakdown(overrides: Partial<VictoryPointsBreakdown> = {}): VictoryPointsBreakdown {
  return {
    terraformRating: 28,
    terraformRatingBreakdown: {base: 20, temperature: 3, oxygen: 2, oceans: 2, venus: 0, cards: 1},
    milestones: 5,
    awards: 2,
    greenery: 4,
    city: 6,
    escapeVelocity: 0,
    moonHabitats: 0,
    moonMines: 0,
    moonRoads: 0,
    planetaryTracks: 0,
    deltaProject: 0,
    victoryPoints: 4,
    total: 49,
    // Fake names → isCard() is false → no JournalCardChip / card manifest needed.
    detailsCards: [
      {cardName: 'ResCardX', victoryPoint: 4, kind: 'resource'},
      {cardName: 'CondCardX', victoryPoint: 5, kind: 'conditional'},
      {cardName: 'FixCardX', victoryPoint: 1, kind: 'fixed'},
      {cardName: 'PenCardX', victoryPoint: -6, kind: 'penalty'},
    ],
    detailsMilestones: [],
    detailsAwards: [],
    detailsPlanetaryTracks: [],
    negativeVP: -6,
    ...overrides,
  };
}

function mountOverlay(breakdown: VictoryPointsBreakdown, showOtherPlayersVP = true) {
  const displayedPlayer: RecursivePartial<PublicPlayerModel> = {
    color: 'blue',
    name: 'Tester',
    victoryPointsBreakdown: breakdown,
  };
  const game: RecursivePartial<GameModel> = {
    gameOptions: {showOtherPlayersVP},
    moon: undefined,
    pathfinders: undefined,
  };
  return mount(VictoryPointsOverlay, {
    ...globalConfig,
    props: {
      displayedPlayer: displayedPlayer as PublicPlayerModel,
      game: game as GameModel,
      thisPlayerColor: 'blue',
    },
  });
}

describe('VictoryPointsOverlay', () => {
  it('renders the four core breakdown bars', () => {
    const wrapper = mountOverlay(fullBreakdown());
    expect(wrapper.findAll('.vp-scale')).to.have.length(4);
  });

  it('renders card groups with penalties last', () => {
    const wrapper = mountOverlay(fullBreakdown());
    const groups = wrapper.findAll('.vp-card-group');
    expect(groups.length).eq(4);
    expect(groups[groups.length - 1].classes()).to.include('vp-card-group--penalty');
    expect(wrapper.find('.vp-card-group--resource').exists()).is.true;
    expect(wrapper.find('.vp-card-group--conditional').exists()).is.true;
    expect(wrapper.find('.vp-card-group--fixed').exists()).is.true;
  });

  it('emphasizes a big conditional scorer', () => {
    const wrapper = mountOverlay(fullBreakdown());
    // The +5 conditional card is above the threshold → emphasized.
    expect(wrapper.find('.vp-card-row--emphasized').exists()).is.true;
  });

  it('renders a penalty segment in the cards bar', () => {
    const wrapper = mountOverlay(fullBreakdown());
    expect(wrapper.find('.vp-scale__seg--penalty').exists()).is.true;
  });

  it('locks detail for other players when the option is off and the game is running', () => {
    const wrapper = mountOverlay(fullBreakdown(), false);
    // displayedPlayer (blue) === thisPlayerColor (blue) → NOT locked even off.
    expect(wrapper.find('.vp-lock').exists()).is.false;

    const other: RecursivePartial<PublicPlayerModel> = {color: 'red', name: 'Other', victoryPointsBreakdown: fullBreakdown()};
    const game: RecursivePartial<GameModel> = {gameOptions: {showOtherPlayersVP: false}};
    const wrapper2 = mount(VictoryPointsOverlay, {
      ...globalConfig,
      props: {displayedPlayer: other as PublicPlayerModel, game: game as GameModel, thisPlayerColor: 'blue'},
    });
    expect(wrapper2.find('.vp-lock').exists()).is.true;
    // The locked report shows no score bars (nothing leaks).
    expect(wrapper2.find('.vp-dashboard').exists()).is.false;
  });

  it('shows the real report once the game has ended, even with the option off', () => {
    const other: RecursivePartial<PublicPlayerModel> = {color: 'red', name: 'Other', victoryPointsBreakdown: fullBreakdown()};
    const game: RecursivePartial<GameModel> = {gameOptions: {showOtherPlayersVP: false}, phase: Phase.END};
    const wrapper = mount(VictoryPointsOverlay, {
      ...globalConfig,
      props: {displayedPlayer: other as PublicPlayerModel, game: game as GameModel, thisPlayerColor: 'blue'},
    });
    expect(wrapper.find('.vp-lock').exists()).is.false;
    expect(wrapper.find('.vp-dashboard').exists()).is.true;
  });

  it('dims every non-matching source uniformly while one is hovered', async () => {
    const wrapper = mountOverlay(fullBreakdown({
      milestones: 5,
      awards: 5,
      total: 59,
      detailsMilestones: [{message: 'Claimed ${0} milestone', messageArgs: ['Builder'], victoryPoint: 5}],
      detailsAwards: [{message: '${0} place for ${1} award (funded by ${2})', messageArgs: ['1st', 'Banker', 'red'], victoryPoint: 5}],
    }));
    await wrapper.setData({hoverKey: 'mca.awards'});

    // Card groups (a different family) all dim, none active.
    expect(wrapper.find('.vp-card-group--faded').exists()).is.true;
    expect(wrapper.find('.vp-card-group--active').exists()).is.false;
    // The TR legend rows dim too.
    expect(wrapper.find('.vp-legend__row--dim').exists()).is.true;
    // The matching award row lights up; the milestone row dims.
    const maRows = wrapper.findAll('.vp-ma-row');
    expect(maRows.some((r) => r.classes().includes('vp-ma-row--active'))).is.true;
    expect(maRows.some((r) => r.classes().includes('vp-ma-row--dim'))).is.true;
  });

  it('shows an empty state when no card VP', () => {
    const wrapper = mountOverlay(fullBreakdown({detailsCards: [], victoryPoints: 0, negativeVP: 0, total: 45}));
    expect(wrapper.find('.vp-cards-empty').exists()).is.true;
    expect(wrapper.findAll('.vp-card-group')).to.have.length(0);
  });
});

import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import EndgameResultsOverlay from '@/client/components/endgame/EndgameResultsOverlay.vue';
import {buildEndgameModel, EndgameModel} from '@/client/components/endgame/endgameModel';
import {rematchState, resetRematchState} from '@/client/components/rematch/rematchState';
import {RematchModel} from '@/common/models/RematchModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {ViewModel} from '@/common/models/PlayerModel';
import {RecursivePartial} from '@/common/utils/utils';
import {Color} from '@/common/Color';

function endgameModel(): EndgameModel {
  const breakdown: VictoryPointsBreakdown = {
    terraformRating: 25, terraformRatingBreakdown: {base: 20, temperature: 2, oxygen: 1, oceans: 2, venus: 0, cards: 0},
    milestones: 0, awards: 0, greenery: 0, city: 0, escapeVelocity: 0,
    moonHabitats: 0, moonMines: 0, moonRoads: 0, planetaryTracks: 0, deltaProject: 0, victoryPoints: 0, total: 25,
    detailsCards: [], detailsMilestones: [], detailsAwards: [], detailsPlanetaryTracks: [], negativeVP: 0,
  };
  return buildEndgameModel(
    [{color: 'red', name: 'Victor', corporations: ['Helion'], megacredits: 0, breakdown, vpByGeneration: [10, 20, 25], globalSteps: {}}],
    {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 3});
}

function view(asPlayer: boolean): ViewModel {
  const v: RecursivePartial<ViewModel> = {
    id: asPlayer ? 'p-test' : 's-test',
    game: {
      name: 'Test Game', generation: 3, moon: undefined, pathfinders: undefined,
      gameOptions: {expansions: {}, escapeVelocity: undefined, colonies: false},
      globalsPerGeneration: [],
    },
    players: [],
    thisPlayer: asPlayer ? ({color: 'red'} as never) : undefined,
  };
  return v as ViewModel;
}

function rematch(overrides: Partial<RematchModel>): RematchModel {
  return {
    status: 'none',
    votes: [{color: 'red', name: 'Victor', status: 'accepted'}, {color: 'blue', name: 'Nastya', status: 'pending'}],
    viewerIsPlayer: true,
    viewerColor: 'red',
    viewerMustVote: false,
    viewerIsOfferer: false,
    ...overrides,
  };
}

function overlay(asPlayer: boolean) {
  return mount(EndgameResultsOverlay, {...globalConfig, props: {model: endgameModel(), view: view(asPlayer), viewerColor: 'red' as Color}});
}

describe('EndgameResultsOverlay — rematch control', () => {
  afterEach(() => resetRematchState());

  it('a player with no offer sees the "Offer rematch" button', () => {
    rematchState.model = undefined;
    const w = overlay(true);
    // The offer button is a <button> with the cta class; there is no waiting / decline chip.
    expect(w.find('button.eg-results__ctl--cta').exists(), 'offer button').to.eq(true);
    expect(w.find('.eg-results__ctl--wait').exists()).to.eq(false);
    expect(w.find('.eg-results__ctl--danger').exists()).to.eq(false);
  });

  it('a player who must vote sees Accept + Decline', () => {
    rematchState.model = rematch({status: 'offered', offeredBy: 'blue', viewerMustVote: true, viewerColor: 'red'});
    const w = overlay(true);
    expect(w.find('.eg-results__ctl--danger').exists(), 'decline button').to.eq(true);
    expect(w.find('button.eg-results__ctl--cta').exists(), 'accept button').to.eq(true);
    expect(w.find('.eg-results__ctl--wait').exists()).to.eq(false);
  });

  it('the offerer waiting sees the live tally and a Cancel button', () => {
    rematchState.model = rematch({status: 'offered', offeredBy: 'red', viewerIsOfferer: true, viewerMustVote: false});
    const w = overlay(true);
    expect(w.find('.eg-results__ctl--wait').exists(), 'waiting chip').to.eq(true);
    // One of two players accepted (the offerer).
    expect(w.find('.eg-results__wait-count').text()).to.eq('1/2');
  });

  it('a created rematch links the player to their own new game', () => {
    rematchState.model = rematch({status: 'created', offeredBy: 'red', newGameId: 'g-new', joinKind: 'player', joinId: 'p-newred',
      votes: [{color: 'red', name: 'Victor', status: 'accepted'}, {color: 'blue', name: 'Nastya', status: 'accepted'}]});
    const w = overlay(true);
    const link = w.find('a.eg-results__ctl--cta');
    expect(link.exists(), 'join link').to.eq(true);
    expect(link.attributes('href')).to.eq('player?id=p-newred');
  });

  it('a spectator keeps the "New game" link when there is no rematch', () => {
    rematchState.model = undefined;
    const w = overlay(false);
    const link = w.find('a.eg-results__ctl--cta');
    expect(link.exists()).to.eq(true);
    expect(link.attributes('href')).to.eq('new-game');
  });

  it('a created rematch links a spectator to watch the new game', () => {
    rematchState.model = rematch({status: 'created', viewerIsPlayer: false, viewerColor: undefined, joinKind: 'spectator', joinId: 's-new', newGameId: 'g-new'});
    const w = overlay(false);
    expect(w.find('a.eg-results__ctl--cta').attributes('href')).to.eq('spectator?id=s-new');
  });
});

import {expect} from 'chai';
import {campaignCardView, gameCardView, showcaseGrid, showcaseStep} from '../../src/client/console/menu/lobbyCardModel';
import {waveDelays} from '../../src/client/console/menu/lobbyScreenMotion';
import {JoinableGameSummary} from '../../src/common/models/JoinableGameModel';
import {CampaignSummaryModel} from '../../src/common/campaign/CampaignSummary';
import {CampaignSourceRow} from '../../src/client/console/campaign/campaignListModel';
import {BoardName} from '../../src/common/boards/BoardName';
import {Phase} from '../../src/common/Phase';
import {GameId, PlayerId, CampaignId} from '../../src/common/Types';

/**
 * THE LOBBY CARD (TR68 «ПРЕДИГРОВОЕ — ЭТО ВИТРИНА») — the pure view of one card of «Мои партии» / «Мои кампании»:
 * the state chip by the lobby's own facts (membership by NAME — `you` / `ambiguous`), whose turn, the archive, a LAN
 * row's host and its staleness, a campaign's route and state; and the showcase's geometry — the grid from the
 * MEASURED stage (never the card count) and the cursor's walk over it.
 */
function game(over: Partial<JoinableGameSummary> = {}): JoinableGameSummary {
  return {
    id: 'g1' as GameId,
    name: 'Radiant Fusion Beam',
    createdTimeMs: 1_000,
    phase: Phase.ACTION,
    generation: 3,
    boardName: BoardName.THARSIS,
    expansions: ['venus', 'colonies'],
    players: [
      {name: 'Alice', color: 'blue', isYou: true},
      {name: 'Bruno', color: 'red', isYou: false},
    ],
    maxPlayers: 2,
    activePlayer: 'blue',
    finished: false,
    you: {id: 'p1' as PlayerId, color: 'blue'},
    ambiguous: false,
    ...over,
  };
}

function campaign(over: Partial<CampaignSummaryModel> = {}): CampaignSummaryModel {
  return {
    id: 'c1' as CampaignId,
    rev: 1,
    name: 'Distant Magnet Stream',
    createdTimeMs: 2_000,
    lastActivityMs: 2_000,
    phase: 'active',
    pointer: 1,
    missionCount: 4,
    completedMissions: 1,
    missionGamesCount: 2,
    currentBoard: BoardName.HELLAS,
    seats: [
      {seat: 0, kind: 'human', name: 'Alice', color: 'blue', trBoost: 0},
      {seat: 1, kind: 'human', name: 'Bruno', color: 'red', trBoost: 0},
    ],
    you: {seat: 0},
    isCreator: true,
    state: 'launchReady',
    yourTitlePoints: 0,
    ...over,
  } as CampaignSummaryModel;
}

function row(summary: CampaignSummaryModel, over: Partial<CampaignSourceRow> = {}): CampaignSourceRow {
  return {summary, sourceId: 'local', hostLabel: '', stale: false, ...over};
}

describe('lobbyCardModel — one card of the pregame showcase', () => {
  describe('a game of «Мои партии»', () => {
    it('the viewer to move: «Your turn» in the mint voice, the viewer\'s seat active, the board / generation / expansions / age carried', () => {
      const view = gameCardView(game());
      expect(view.state).deep.eq({key: 'Your turn', tone: 'turn'});
      expect(view.name).eq('Radiant Fusion Beam');
      expect(view.board).eq(BoardName.THARSIS);
      expect(view.generation).eq(3);
      expect(view.expansions).deep.eq(['venus', 'colonies']);
      expect(view.createdTimeMs).eq(1_000);
      expect(view.crew.map((p) => [p.name, p.isYou, p.isActive])).deep.eq([['Alice', true, true], ['Bruno', false, false]]);
      expect(view.enterable).eq(true);
      expect(view.archived).eq(false);
      expect(view.kicker, 'a plain game has no kicker').eq(undefined);
    });

    it('someone else to move: «Turn: Bruno» names WHO, in the waiting voice', () => {
      expect(gameCardView(game({activePlayer: 'red'})).state).deep.eq({key: 'Turn: ${0}', params: ['Bruno'], tone: 'wait'});
    });

    it('a finished game marks nobody\'s turn and reads «Game finished» (the archive)', () => {
      const view = gameCardView(game({finished: true}));
      expect(view.state).deep.eq({key: 'Game finished', tone: 'done'});
      expect(view.crew.some((p) => p.isActive), 'a stored active player of a finished game means nothing').eq(false);
      expect(view.archived).eq(true);
    });

    it('membership is by NAME: no seat / several seats — the reason in the chip, the card refuses entry, never hidden', () => {
      const none = gameCardView(game({you: undefined, players: [{name: 'Carol', color: 'green', isYou: false}]}));
      expect(none.state).deep.eq({key: 'No seat with your name', tone: 'note'});
      expect(none.enterable).eq(false);
      const several = gameCardView(game({you: undefined, ambiguous: true}));
      expect(several.state.key).eq('Several players share your name here');
    });

    it('a LAN row names its couch; a quiet host keeps the card, marked and refused; another build is a note', () => {
      expect(gameCardView(game(), {hostLabel: 'victor'}).hostLabel).eq('victor');
      const quiet = gameCardView(game(), {hostLabel: 'victor', stale: true});
      expect(quiet.state).deep.eq({key: 'not responding', tone: 'stale'});
      expect(quiet.enterable).eq(false);
      const other = gameCardView(game({activePlayer: 'red'}), {versionMismatch: true});
      expect(other.state).deep.eq({key: 'Host version differs from yours', tone: 'note'});
      expect(other.enterable, 'a version note warns, the row still enters').eq(true);
    });

    it('a campaign mission stands for its campaign: the campaign\'s name, «Campaign · Mission 2 of 4» as the kicker, always enterable', () => {
      const view = gameCardView(game({you: undefined, campaign: {id: 'c1' as CampaignId, name: 'Distant Magnet Stream', slot: 1, count: 4, final: false}}));
      expect(view.name).eq('Distant Magnet Stream');
      expect(view.kicker).deep.eq([{key: 'Campaign'}, {key: 'Mission ${0} of ${1}', params: ['2', '4']}]);
      expect(view.enterable, 'the map resolves the seat by name').eq(true);
    });

    it('«New» rides the lobby\'s own `newIds`', () => {
      expect(gameCardView(game(), {isNew: true}).isNew).eq(true);
      expect(gameCardView(game()).isNew).eq(false);
    });
  });

  describe('a campaign of «Мои кампании»', () => {
    it('its route as nodes (done · current · future), its progress as the kicker, the state of the viewer\'s seat', () => {
      const view = campaignCardView(row(campaign()));
      expect(view.kind).eq('campaign');
      expect(view.progress).deep.eq(['done', 'current', 'future', 'future']);
      expect(view.state).deep.eq({key: 'Mission ready to launch', tone: 'ready'});
      expect(view.board).eq(BoardName.HELLAS);
      expect(view.crew.map((p) => [p.name, p.isYou])).deep.eq([['Alice', true], ['Bruno', false]]);
    });

    it('an action required is the mint voice; a blocked campaign carries its reason; title points only when earned', () => {
      expect(campaignCardView(row(campaign({state: 'yourTurn'}))).state.tone).eq('turn');
      const blocked = campaignCardView(row(campaign({state: 'blocked', blockedReason: 'A seat left the campaign'})));
      expect(blocked.state.tone).eq('blocked');
      expect(blocked.note).deep.eq({key: 'A seat left the campaign'});
      expect(campaignCardView(row(campaign())).titlePoints).eq(undefined);
      expect(campaignCardView(row(campaign({yourTitlePoints: 3}))).titlePoints).eq(3);
    });

    it('a quiet LAN host: the card stays, «not responding», refused; a champion wears the crown', () => {
      const quiet = campaignCardView(row(campaign(), {hostLabel: 'victor', stale: true}));
      expect(quiet.state.key).eq('not responding');
      expect(quiet.enterable).eq(false);
      expect(quiet.hostLabel).eq('victor');
      const done = campaignCardView(row(campaign({phase: 'finished', state: 'finished', championSeats: [1]})));
      expect(done.archived).eq(true);
      expect(done.crew.find((p) => p.name === 'Bruno')?.champion).eq(true);
    });
  });

  describe('the showcase grid — from the MEASURED stage, never the card count', () => {
    const rem = 20;
    const bounds = {gap: 1.2 * rem, minW: 24 * rem, maxW: 34 * rem, minH: 12 * rem, maxH: 21 * rem};

    it('the logical 1920 stage: three columns, two rows filling the stage; the 4K TV is the same geometry ×2', () => {
      const fhd = showcaseGrid(1840, 820, bounds);
      expect(fhd.cols).eq(3);
      expect(fhd.cardW).within(560, 680);
      expect(fhd.rowH).eq(Math.floor((820 - bounds.gap) / 2));
      const tv = showcaseGrid(3680, 1640, {gap: 2 * bounds.gap, minW: 2 * bounds.minW, maxW: 2 * bounds.maxW, minH: 2 * bounds.minH, maxH: 2 * bounds.maxH});
      expect(tv.cols).eq(3);
      expect(Math.abs(tv.cardW - 2 * fhd.cardW)).lte(2);
    });

    it('the Deck stage: two columns; the row never shrinks under the card\'s floor (a third row is a page below)', () => {
      const deck = showcaseGrid(1210, 520, bounds);
      expect(deck.cols).eq(2);
      expect(deck.rowH).gte(bounds.minH);
      expect(showcaseGrid(1210, 200, bounds).rowH, 'a starved stage keeps the floor').eq(bounds.minH);
    });

    it('a wide stage caps the card (never a stretched banner)', () => {
      expect(showcaseGrid(4000, 820, bounds).cardW).eq(bounds.maxW);
    });
  });

  describe('the cursor\'s walk over the grid', () => {
    it('◀ ▶ walk the ring (wrapping), ▲ ▼ a row; a row that is not there is a wall; ▼ into a shorter last row lands on its last card', () => {
      // 5 cards, 3 per row: [0 1 2] [3 4]
      expect(showcaseStep(0, 'left', 5, 3)).eq(4);
      expect(showcaseStep(4, 'right', 5, 3)).eq(0);
      expect(showcaseStep(1, 'down', 5, 3)).eq(4);
      expect(showcaseStep(2, 'down', 5, 3), 'below the third card is nothing — the shorter row\'s last card').eq(4);
      expect(showcaseStep(4, 'down', 5, 3), 'the last row is a wall').eq(4);
      expect(showcaseStep(1, 'up', 5, 3), 'the first row is a wall').eq(1);
      expect(showcaseStep(4, 'up', 5, 3)).eq(1);
      expect(showcaseStep(0, 'down', 1, 3), 'one card goes nowhere').eq(0);
      expect(showcaseStep(0, 'right', 0, 3), 'an empty ring').eq(0);
    });
  });

  describe('the wave out of the centre (the reveal of the cards)', () => {
    it('the card nearest the stage\'s centre surfaces first, the farthest last', () => {
      const stage = {left: 0, top: 0, width: 900, height: 600};
      const cards = [
        {left: 0, top: 0, width: 280, height: 280},
        {left: 310, top: 160, width: 280, height: 280},
        {left: 620, top: 320, width: 280, height: 280},
      ];
      const delays = waveDelays(cards, stage, 55);
      expect(delays[1]).lt(delays[0]);
      expect(delays[1]).lt(delays[2]);
      expect(waveDelays([], stage, 55)).deep.eq([]);
      // Two cards symmetric about the centre still come in turn (the reading-order step).
      const pair = waveDelays([{left: 100, top: 160, width: 280, height: 280}, {left: 520, top: 160, width: 280, height: 280}], stage, 55, 60);
      expect(pair[1]).gt(pair[0]);
    });
  });
});

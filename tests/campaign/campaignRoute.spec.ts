import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {RandomBoardOption} from '../../src/common/boards/RandomBoardOption';
import {CAMPAIGN_MISSION_COUNT} from '../../src/common/campaign/CampaignTypes';
import {CAMPAIGN_BOARD_WEIGHTS, CAMPAIGN_FINALE_FAVOURITE} from '../../src/common/campaign/campaignConfig';
import {SeededRandom} from '../../src/common/utils/Random';
import {boardOptions} from '../../src/server/boards/randomBoard';
import {drawCampaignRoute} from '../../src/server/campaign/campaignRoute';

/**
 * THE ROUTE DRAW (the owner, 2026-11-07): Amazonis Planitia — the official large map — comes up on a campaign route
 * more often than a board's share, and as the FINALE more often still; never guaranteed, every other board still
 * drawn. Read over many seeded draws from the bot's pool (the route a campaign with MarsBot plays).
 */
describe('the campaign route — a weighted draw with a finale favourite', () => {
  const pool = boardOptions(RandomBoardOption.ALL, {automa: true});
  const favourite = CAMPAIGN_FINALE_FAVOURITE.board;
  const DRAWS = 3000;

  function routes(): Array<Array<BoardName>> {
    const out: Array<Array<BoardName>> = [];
    for (let i = 0; i < DRAWS; i++) {
      out.push(drawCampaignRoute(pool, CAMPAIGN_MISSION_COUNT, new SeededRandom((i + 1) / (DRAWS + 1))));
    }
    return out;
  }

  it('the favourite is Amazonis Planitia at twice a board\'s weight, moved to the finale at an even chance', () => {
    expect(favourite).eq(BoardName.AMAZONIS_PLANITIA);
    expect(CAMPAIGN_BOARD_WEIGHTS[favourite]).eq(2);
    expect(CAMPAIGN_FINALE_FAVOURITE.chance).eq(0.5);
    expect(pool).to.include(favourite);
  });

  it('every route is four DIFFERENT boards of the pool, and the same seed draws the same route', () => {
    for (const route of routes().slice(0, 300)) {
      expect(route).has.length(CAMPAIGN_MISSION_COUNT);
      expect(new Set(route).size).eq(CAMPAIGN_MISSION_COUNT);
      for (const board of route) {
        expect(pool).to.include(board);
      }
    }
    expect(drawCampaignRoute(pool, CAMPAIGN_MISSION_COUNT, new SeededRandom(0.4321)))
      .deep.eq(drawCampaignRoute(pool, CAMPAIGN_MISSION_COUNT, new SeededRandom(0.4321)));
  });

  it('Amazonis Planitia is on about HALF the routes — more than any other board, never all of them', () => {
    const all = routes();
    const share = (board: BoardName) => all.filter((r) => r.includes(board)).length / all.length;
    const own = share(favourite);
    expect(own, 'about half (a board\'s share is 4 / 13)').within(0.42, 0.58);
    for (const other of pool.filter((b) => b !== favourite)) {
      expect(share(other), `${other} is drawn`).greaterThan(0.15);
      expect(share(other), `${other} below the favourite`).lessThan(own);
    }
  });

  it('…and the FINALE of most routes it is on — never guaranteed', () => {
    const all = routes().filter((r) => r.includes(favourite));
    const finale = all.filter((r) => r[r.length - 1] === favourite).length / all.length;
    // The slot's own share is 1 / 4; the favourite roll (1 / 2) moves it there from any other slot.
    expect(finale).within(0.55, 0.72);
    expect(all.some((r) => r[r.length - 1] !== favourite), 'sometimes it stays where the draw put it').is.true;
  });

  it('a pool without the favourite draws plainly — a route of other boards, the finale any of them', () => {
    const others = pool.filter((b) => b !== favourite);
    const route = drawCampaignRoute(others, CAMPAIGN_MISSION_COUNT, new SeededRandom(0.17));
    expect(route).has.length(CAMPAIGN_MISSION_COUNT);
    expect(route).not.to.include(favourite);
  });
});

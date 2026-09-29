import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {resultsReadingOf} from '@/client/console/parliament/parliamentResultsModel';

/**
 * THE RESULTS' PAYOUT ROWS AND A MARSBOT SEAT (Turmoil Redux, decision D3): a seat the law never pays prints
 * no «no reward» row — it was never in the contest — but a part it DID receive (its winner's reward) is a row
 * like any seat's, so the results name the bot's ocean as one more outcome.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

function summary(outcomes: ParliamentPhaseSummaryModel['outcomes']): ParliamentPhaseSummaryModel {
  return {
    generation: 2, final: false,
    winner: {instance: 'RDX_GREENS_AQUIFER_CONTEST#0', resolution: 'RDX_GREENS_AQUIFER_CONTEST', party: PartyName.GREENS, votes: 1, player: RED},
    support: [], enacted: {instance: 'RDX_GREENS_AQUIFER_CONTEST#0', resolution: 'RDX_GREENS_AQUIFER_CONTEST', party: PartyName.GREENS},
    refreshed: [], lobbyRefilled: [], outcomes,
  };
}

describe('parliamentResultsModel — the payout rows and a MarsBot seat', () => {
  it('a bot seat with NO part of its own has no row; the human\'s row stands; the bot still counts for «who enters the next vote without a delegate»', () => {
    const reading = resultsReadingOf(
      summary([{player: BLUE, step: 'animals', part: 'effect', kind: 'skipped', reason: 'No influence'}]),
      [{player: BLUE, lobby: true, reserve: 5, enacts: true}, {player: RED, lobby: false, reserve: 0, enacts: false}],
      [],
    );
    expect(reading.payouts.map((p) => p.player)).deep.eq([BLUE]);
    expect(reading.table.noDelegate).deep.eq([RED]);
  });

  it('a bot WINNER\'s reward is a row of its own — the ocean it placed, read as any seat\'s outcome', () => {
    const reading = resultsReadingOf(
      summary([
        {player: BLUE, step: 'animals', part: 'effect', kind: 'skipped', reason: 'No influence'},
        {player: RED, step: 'ocean', part: 'winner', kind: 'ocean', space: '05', parameter: {id: 'oceans', before: 0, after: 1}},
      ]),
      [{player: BLUE, lobby: true, reserve: 5, enacts: true}, {player: RED, lobby: true, reserve: 5, enacts: false}],
      [],
    );
    expect(reading.payouts.map((p) => p.player)).deep.eq([BLUE, RED]);
    expect(reading.payouts[1].parts).lengthOf(1);
    expect(reading.payouts[1].parts[0].kind).eq('ocean');
    expect(reading.payouts[1].parts[0].tile, 'the tile family — the component picks its icon from it').eq('ocean');
    // The count the tile moved rides the row («0 → 1») — a tile has no amount, and without the parameter the row read «0».
    expect(reading.payouts[1].parts[0].parameter).deep.eq({id: 'oceans', before: 0, after: 1});
    expect(reading.payouts[1].parts[0].amount).is.undefined;
  });

  it('a fixture from before `enacts` reads every seat as a paid one', () => {
    const reading = resultsReadingOf(summary([]), [{player: BLUE, lobby: true, reserve: 5}, {player: RED, lobby: true, reserve: 5}], []);
    expect(reading.payouts.map((p) => p.player)).deep.eq([BLUE, RED]);
  });
});

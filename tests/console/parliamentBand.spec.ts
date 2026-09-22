import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {
  BandChip, BandContext, BandRewardReading, BandSitting, parliamentBandLine,
} from '@/client/console/parliament/parliamentBand';

/*
 * ЛЕНТА ЧТЕНИЯ («Заседание v5» §1–2) — the middle zone's upper strip, as DATA.
 *
 * The band exists in every mode and never disappears, so the model NEVER returns `undefined`: an empty
 * table still reads. Its one job is to say WHY what is on the table is happening — so what an object
 * already says itself (the enacted card's printed effect, a tile's own support word, the marker's step)
 * must not be repeated here, and there is no prose in it at all.
 */
const AQUIFER = 'RDX_GREENS_AQUIFER_CONTEST';
const ARCHITECTURE = 'RDX_MARS_ARCHITECTURE_AWARD';
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

function summary(over: Partial<ParliamentPhaseSummaryModel> = {}): ParliamentPhaseSummaryModel {
  return {
    generation: 3,
    final: false,
    winner: {instance: `${AQUIFER}#0`, resolution: AQUIFER, party: PartyName.GREENS, votes: 4, player: BLUE, slot: 0},
    agenda: {player: BLUE, from: 1, to: 2},
    support: [],
    enacted: {instance: `${AQUIFER}#0`, resolution: AQUIFER, party: PartyName.GREENS},
    refreshed: [],
    lobbyRefilled: [],
    ...over,
  } as ParliamentPhaseSummaryModel;
}

const NO_REWARD: BandRewardReading = {yields: [], reactions: [], skips: []};

function sitting(over: Partial<BandSitting> = {}): BandSitting {
  return {
    stage: 'verdict',
    rewardStep: 'reading',
    beat: '',
    supportWave: '',
    generation: 3,
    awaiting: [],
    summary: summary(),
    reward: NO_REWARD,
    ...over,
  };
}

function line(over: Partial<BandSitting> | undefined, standing: BandContext['standing'] = {votes: 0}) {
  return parliamentBandLine({...(over === undefined ? {} : {sitting: sitting(over)}), standing});
}

const kinds = (chips: ReadonlyArray<BandChip>): Array<string> => chips.map((c) => c.kind);

describe('parliamentBand — the reading band says the REASON, in objects', () => {
  describe('ОБЗОР — the table as it stands', () => {
    it('names the resolution that is being enacted and who would be the winner of the vote', () => {
      const band = line(undefined, {resolution: {resolution: ARCHITECTURE, party: PartyName.MARS}, player: RED, votes: 3});
      expect(band.kicker).eq('Parliament overview');
      expect(band.committed, 'nothing has been decided: the accent is pre-commit').eq(false);
      expect(kinds(band.chips)).deep.eq(['label', 'resolution', 'label', 'player']);
    });
    it('an UNTOUCHED vote says so instead of naming a winner nobody earned', () => {
      const band = line(undefined, {resolution: {resolution: ARCHITECTURE, party: PartyName.MARS}, votes: 0});
      expect(kinds(band.chips)).deep.eq(['label', 'resolution', 'label']);
      expect((band.chips[2] as {key: string}).key).eq('No delegates on the table');
    });
    it('an EMPTY voting area still has a line — the band never disappears', () => {
      const band = line(undefined, {votes: 0});
      expect(band.chips.length).eq(1);
      expect((band.chips[0] as {key: string}).key).eq('No resolution is up for a vote');
    });
  });

  describe('ВЕРДИКТ — the winner of the vote BY NAME, before the marker moves', () => {
    it('names the resolution, its delegates, the winning PLAYER and that they take an Agenda step', () => {
      const band = line({stage: 'verdict'});
      expect(band.kicker).eq('Verdict');
      expect(kinds(band.chips)).deep.eq(['resolution', 'count', 'label', 'player', 'label']);
      // The Agenda step is stated at the VERDICT — v4 moved the marker with nothing saying why.
      expect((band.chips[4] as {key: string}).key).eq('Agenda step');
      expect(band.committed, 'gate 1 stands before anything changes').eq(false);
    });
    it('the NEUTRAL player advances nothing, so nothing is claimed — the chip is the RULE, not the record', () => {
      // At gate 1 the server has not run the Agenda step yet (`summary.agenda` is undefined for every
      // verdict): a chip conditioned on the record would be absent exactly where it is needed.
      const seat = line({stage: 'verdict', summary: summary({agenda: undefined})});
      expect(kinds(seat.chips)).deep.eq(['resolution', 'count', 'label', 'player', 'label']);
      const neutral = line({stage: 'verdict', summary: summary({winner: {...summary().winner, player: 'neutral'}, agenda: undefined})});
      expect(kinds(neutral.chips)).deep.eq(['resolution', 'count', 'label', 'player']);
    });
    it('a broken TIE names the rule that broke it, and the answered gate lists who is still reading', () => {
      const band = line({
        stage: 'verdict',
        rewardStep: 'gate',
        awaiting: [RED],
        summary: summary({winner: {...summary().winner, tieBreak: 'slot-priority'}}),
      });
      expect(kinds(band.chips)).deep.eq(['resolution', 'count', 'label', 'player', 'label', 'label', 'awaiting']);
      expect((band.chips[5] as {key: string}).key).eq('Tie broken by the slot order');
    });
  });

  describe('ПОВЕСТКА · ПОДДЕРЖКА · ПРИНЯТИЕ — one line per beat of the enactment', () => {
    it('the AGENDA beat says whose step it is and what the step gave', () => {
      const band = line({stage: 'enact', beat: 'agenda', summary: summary({agenda: {player: BLUE, from: 1, to: 4, bonus: 'tr'}})});
      expect(band.kicker).eq('Agenda');
      expect(kinds(band.chips)).deep.eq(['player', 'agenda']);
      expect(band.chips[1]).deep.eq({kind: 'agenda', to: 4, bonus: 'tr'});
    });
    it('the SUPPORT beat states the rule of the wave now playing — never both rules at once', () => {
      const absent = line({stage: 'enact', beat: 'support', supportWave: 'absent'});
      const lost = line({stage: 'enact', beat: 'support', supportWave: 'lost'});
      expect(absent.kicker).eq('Popular support');
      expect((absent.chips[0] as {key: string}).key).eq('Not in the vote');
      expect((lost.chips[0] as {key: string}).key).eq('Unenacted resolutions');
      expect(absent.key, 'the two waves are two lines: the crossfade fires between them').not.eq(lost.key);
    });
    it('at REST the enactment names the law that now stands and the party that rules by it', () => {
      const band = line({stage: 'enact'});
      expect(band.kicker).eq('Enactment');
      expect(kinds(band.chips)).deep.eq(['resolution', 'label', 'party']);
      expect(band.committed, 'past the commit boundary the accent is amber').eq(true);
    });
  });

  describe('НАГРАДА — the payout formula whole, while the chips fly', () => {
    it('prints the yields, the ruling party\'s answer and a SKIP with its reason (never a silent loss)', () => {
      const band = line({
        stage: 'reward',
        rewardStep: 'received',
        reward: {
          yields: [{context: 'applied'} as never],
          reactions: [{party: PartyName.GREENS, amount: 1}],
          skips: [{id: 's', title: 'Skipped: cards', reason: 'The deck is empty'}],
          state: 'Received',
        },
      });
      expect(band.kicker).eq('Your reward');
      expect(kinds(band.chips)).deep.eq(['yield', 'reaction', 'skip']);
    });
    it('a QUIET resolution names what remains instead — and never the card\'s own wording (the government prints that)', () => {
      const band = line({stage: 'reward', rewardStep: 'received', reward: {...NO_REWARD, quiet: {kicker: 'Resolution action', kind: 'action'}}});
      expect(kinds(band.chips)).deep.eq(['label', 'label']);
      expect((band.chips[0] as {key: string}).key).eq('Resolution action');
      expect((band.chips[1] as {key: string}).key).eq('Available in Card actions');
    });
    it('a wait on ANOTHER seat is the line, and a seat with nothing at all still reads', () => {
      expect(kinds(line({stage: 'reward', reward: {...NO_REWARD, waitingFor: RED}}).chips)).deep.eq(['awaiting']);
      const empty = line({stage: 'reward', rewardStep: 'received'});
      expect((empty.chips[0] as {key: string}).key).eq('Your record is in');
    });
  });

  describe('ОБНОВЛЕНИЕ · ИТОГИ', () => {
    it('on the RENEWAL page with no event playing, the band states the renewal\'s own rule', () => {
      const band = line({stage: 'renewal'});
      expect(band.kicker).eq('Renewal');
      expect((band.chips[0] as {key: string}).key).eq('Popular support becomes votes');
    });
    it('while an EVENT of the journal plays, the band says what happens on the table — the objects and the reason, one line per event', () => {
      const leave = line({stage: 'renewal', renewal: {index: 0, kind: 'leave', resolution: 'RDX_B', party: PartyName.REDS, returned: [{owner: RED, count: 1}]}});
      expect(leave.kicker).eq('Renewal');
      expect(kinds(leave.chips)).deep.eq(['label', 'resolution', 'label', 'player']);
      expect((leave.chips[0] as {key: string}).key).eq('Leaves the table');
      const reshuffle = line({stage: 'renewal', renewal: {index: 2, kind: 'reshuffle', count: 2}});
      expect((reshuffle.chips[0] as {key: string}).key).eq('The deck is empty');
      const reject = line({stage: 'renewal', renewal: {index: 3, kind: 'reject', resolution: 'RDX_C', party: PartyName.GREENS, reason: 'party-enacted'}});
      expect(kinds(reject.chips)).deep.eq(['label', 'resolution', 'label']);
      expect((reject.chips[2] as {key: string}).key).eq('its party rules — back to the discard');
      expect((line({stage: 'renewal', renewal: {index: 3, kind: 'reject', resolution: 'RDX_C', party: PartyName.GREENS, reason: 'party-in-area'}}).chips[2] as {key: string}).key)
        .eq('its party is already on the table — back to the discard');
      const deal = line({stage: 'renewal', renewal: {index: 4, kind: 'deal', resolution: 'RDX_B', party: PartyName.REDS}});
      expect(kinds(deal.chips)).deep.eq(['label', 'resolution']);
      const support = line({stage: 'renewal', renewal: {index: 5, kind: 'support', party: PartyName.REDS, count: 2}});
      expect(kinds(support.chips)).deep.eq(['party', 'label', 'count']);
      expect(support.chips[2]).deep.eq({kind: 'count', key: 'Delegates', amount: 2});
      const empty = line({stage: 'renewal', renewal: {index: 6, kind: 'empty'}});
      expect((empty.chips[1] as {key: string}).key).eq('The deck has no resolution of another party');
      const lobby = line({stage: 'renewal', renewal: {index: 7, kind: 'lobby', player: BLUE}});
      expect(kinds(lobby.chips)).deep.eq(['label', 'player']);
      // Every event is its own line: the crossfade fires per event, never within one.
      expect(new Set([leave, reshuffle, reject, deal, support, empty, lobby].map((l) => l.key)).size).eq(7);
      expect(line({stage: 'renewal', renewal: {index: 0, kind: 'leave', resolution: 'RDX_B', party: PartyName.REDS}}).key).eq(leave.key);
    });
    it('the FINAL phase has no renewal page at all — its results line is the heading, nothing renews', () => {
      const band = line({stage: 'results', summary: summary({final: true})});
      expect(band.kicker).eq('Results');
      expect(band.chips[0]).deep.eq({kind: 'count', key: 'Generation', amount: 3});
    });
    it('the revealed panel gets its heading from the band: the generation, once', () => {
      const band = line({stage: 'results'});
      expect(band.kicker).eq('Results');
      expect(band.chips[0]).deep.eq({kind: 'count', key: 'Generation', amount: 3});
    });
  });

  it('a line is IDENTIFIED by its own key — the crossfade fires exactly when the content changes', () => {
    const a = line({stage: 'enact'});
    const b = line({stage: 'enact'});
    expect(a.key, 'the same beat is the same line: nothing animates').eq(b.key);
    expect(line({stage: 'reward', rewardStep: 'received'}).key).not.eq(a.key);
  });
});

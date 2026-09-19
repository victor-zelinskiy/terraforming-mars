import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {Color} from '../../src/common/Color';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {ParliamentPhaseSummaryModel} from '../../src/common/models/ParliamentModel';
import {sittingBeats, sittingBeatsOfStage, sittingBeatStage, sittingStageBefore} from '../../src/client/console/parliament/sittingBeats';

/*
 * THE SITTING'S BEATS — pure (docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md §13.3):
 * the order is the server's, a beat exists only for a fact the summary
 * carries, the viewer's outcomes are one beat each (a skip with its reason),
 * the final phase has no renewal, resume compacts the passed stages — and no
 * beat is keyed on a resolution's name.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

function summary(over: Partial<ParliamentPhaseSummaryModel> = {}): ParliamentPhaseSummaryModel {
  return {
    generation: 2, final: false,
    winner: {instance: 'RDX_A#0', resolution: 'RDX_A', party: PartyName.GREENS, votes: 2, player: BLUE},
    support: [],
    enacted: {instance: 'RDX_A#0', resolution: 'RDX_A', party: PartyName.GREENS},
    refreshed: [],
    lobbyRefilled: [],
    ...over,
  } as unknown as ParliamentPhaseSummaryModel;
}

describe('sittingBeats — the sitting director\'s pure list', () => {
  it('the minimal sitting is verdict → enact → closing, in that order', () => {
    expect(sittingBeats(summary(), BLUE, 'live').map((b) => b.kind)).deep.eq(['verdict', 'enact', 'closing']);
  });

  it('every fact the summary carries adds its beat, in the SERVER\'s order', () => {
    const beats = sittingBeats(summary({
      agenda: {player: BLUE, from: 2, to: 3, bonus: 'tr'},
      support: [{party: PartyName.REDS, gained: 1, total: 2, reason: 'absent'}, {party: PartyName.UNITY, gained: 0, total: 1, reason: 'absent'}],
      outcomes: [
        {player: BLUE, step: 'grant', kind: 'production', amount: 2},
        {player: RED, step: 'grant', kind: 'production', amount: 1},
        {player: BLUE, step: 'draw', kind: 'cards', amount: 2},
        {player: BLUE, step: 'grant', kind: 'reaction', party: PartyName.GREENS, amount: 2},
      ],
      refreshed: [{instance: 'RDX_B#0', resolution: 'RDX_B', party: PartyName.REDS, neutralVotes: 1}],
      lobbyRefilled: [BLUE, RED],
    }), BLUE, 'live');
    expect(beats.map((b) => b.kind)).deep.eq(['verdict', 'agenda', 'support', 'enact', 'reward', 'reward', 'renewal', 'lobby', 'closing']);
    expect(beats.map((b) => b.stage)).deep.eq(['verdict', 'enact', 'enact', 'enact', 'reward', 'reward', 'renewal', 'renewal', 'closing']);
    expect(beats[1].agenda).deep.eq({player: BLUE, from: 2, to: 3, bonus: 'tr'});
    // ONE beat per outcome of the VIEWER — never another seat's, never the ruling party's answer (it rides the step it answered).
    expect(beats.filter((b) => b.kind === 'reward').map((b) => b.outcome?.step)).deep.eq(['grant', 'draw']);
    expect(new Set(beats.map((b) => b.id)).size, 'ids are unique').eq(beats.length);
  });

  it('a skipped outcome is a reward beat that names its reason; a paying kind that paid nothing is named by its address', () => {
    const beats = sittingBeats(summary({outcomes: [
      {player: BLUE, step: 'grant', kind: 'skipped', reason: 'No influence'},
      {player: BLUE, step: 'stock', kind: 'stock', amount: 0},
      {player: BLUE, step: 'paid', kind: 'stock', amount: 3},
    ]}), BLUE, 'live').filter((b) => b.kind === 'reward');
    expect(beats.map((b) => b.skipped)).deep.eq(['No influence', 'Skipped: resources', undefined]);
  });

  it('a spectator gets no reward beats; the FINAL phase has no renewal and no lobby', () => {
    expect(sittingBeats(summary({outcomes: [{player: BLUE, step: 'g', kind: 'stock', amount: 1}]}), undefined, 'live')
      .map((b) => b.kind)).deep.eq(['verdict', 'enact', 'closing']);
    const final = sittingBeats(summary({final: true, refreshed: [{instance: 'x', resolution: 'RDX_B', party: PartyName.REDS, neutralVotes: 0}], lobbyRefilled: [BLUE]}), BLUE, 'live');
    expect(final.map((b) => b.kind)).deep.eq(['verdict', 'enact', 'closing']);
  });

  it('RESUME compacts the stages before the current one; REVIEW compacts everything; LIVE nothing', () => {
    const s = summary({refreshed: [{instance: 'x', resolution: 'RDX_B', party: PartyName.REDS, neutralVotes: 0}]});
    expect(sittingBeats(s, BLUE, 'live').map((b) => b.compact)).deep.eq([false, false, false, false]);
    expect(sittingBeats(s, BLUE, 'resume', 'renewal').map((b) => `${b.kind}:${b.compact}`)).deep.eq(['verdict:true', 'enact:true', 'renewal:false', 'closing:false']);
    expect(sittingBeats(s, BLUE, 'resume', 'verdict').every((b) => !b.compact)).is.true;
    expect(sittingBeats(s, BLUE, 'review').every((b) => b.compact)).is.true;
    expect(sittingStageBefore('enact', 'reward')).is.true;
    expect(sittingStageBefore('reward', 'reward')).is.false;
  });

  it('the beats of one stage are the page\'s own', () => {
    const beats = sittingBeats(summary({agenda: {player: BLUE, from: 0, to: 1}, refreshed: [{instance: 'x', resolution: 'RDX_B', party: PartyName.REDS, neutralVotes: 0}], lobbyRefilled: [BLUE]}), BLUE, 'live');
    expect(sittingBeatsOfStage(beats, 'enact').map((b) => b.kind)).deep.eq(['agenda', 'enact']);
    expect(sittingBeatsOfStage(beats, 'renewal').map((b) => b.kind)).deep.eq(['renewal', 'lobby']);
    for (const kind of ['verdict', 'agenda', 'support', 'enact', 'reward', 'renewal', 'lobby', 'closing'] as const) {
      expect(sittingBeatStage(kind), kind).is.a('string');
    }
  });

  it('no beat is keyed on a resolution\'s name (the module never touches the catalog)', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'client', 'console', 'parliament', 'sittingBeats.ts'), 'utf8');
    expect(src).to.not.match(/RDX_[A-Z]/);
    expect(src).to.not.match(/ClientParliamentManifest|server\/parliament\/resolutions/);
  });
});

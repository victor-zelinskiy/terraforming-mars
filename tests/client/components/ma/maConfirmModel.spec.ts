import {expect} from 'chai';
import {buildMaConfirm, MaConfirmSource} from '@/client/components/ma/maConfirmModel';
import {maArtSlug, maArtUrl, maDisplayName} from '@/client/components/ma/maArt';
import type {Color} from '@/common/Color';

/**
 * Premium Milestones/Awards confirmation view-model. Guards the mechanic
 * truth (progress / race / economy delta / slots / free-sponsorship / stale
 * "already taken") without a DOM — the desktop + console confirm surfaces
 * only render this data.
 */
describe('maConfirmModel', () => {
  const me: Color = 'red';
  const rival: Color = 'blue';
  const third: Color = 'green';

  const opts = (over: Partial<Parameters<typeof buildMaConfirm>[3]> = {}) => ({
    myColor: me,
    myMegacredits: 33,
    cost: 8,
    free: false,
    maxSlots: 3,
    playerName: (c: Color) => (c === me ? 'Me' : c === rival ? 'Riv' : 'Trd'),
    describe: () => 'rule text',
    ...over,
  });

  const milestone = (over: Partial<MaConfirmSource> = {}): MaConfirmSource => ({
    name: 'Mayor',
    playerName: undefined,
    color: undefined,
    scores: [{color: me, score: 2, claimable: false}, {color: rival, score: 1, claimable: false}],
    threshold: 3,
    ...over,
  });

  const award = (over: Partial<MaConfirmSource> = {}): MaConfirmSource => ({
    name: 'Banker',
    playerName: undefined,
    color: undefined,
    scores: [{color: me, score: 4}, {color: rival, score: 4}, {color: third, score: 2}],
    ...over,
  });

  it('milestone: progress + met threshold + M€ delta', () => {
    const v = buildMaConfirm('milestone', milestone({
      scores: [{color: me, score: 3, claimable: true}, {color: rival, score: 1, claimable: false}],
    }), [milestone()], opts());
    expect(v.kind).to.eq('milestone');
    expect(v.threshold).to.eq(3);
    expect(v.myScore).to.eq(3);
    expect(v.thresholdMet).to.eq(true);
    expect(v.mcBefore).to.eq(33);
    expect(v.mcAfter).to.eq(25);
    expect(v.cost).to.eq(8);
  });

  it('milestone: server claimable flag wins even without a threshold', () => {
    const v = buildMaConfirm('milestone', milestone({
      threshold: undefined,
      scores: [{color: me, score: 5, claimable: true}],
    }), [], opts());
    expect(v.thresholdMet).to.eq(true);
    expect(v.threshold).to.eq(undefined);
  });

  it('slots: taken count + open-after + who took the other slots', () => {
    const taken = milestone({name: 'Gardener', playerName: 'Riv', color: rival});
    const v = buildMaConfirm('milestone', milestone(), [milestone(), taken], opts());
    expect(v.takenCount).to.eq(1);
    expect(v.openAfter).to.eq(1); // 3 slots − 1 taken − this claim
    expect(v.takenBy).to.deep.eq([{maName: 'Gardener', name: 'Riv', color: rival}]);
  });

  it('award race: viewer first, leaders flagged, tie tone', () => {
    const v = buildMaConfirm('award', award(), [award()], opts());
    expect(v.race[0].viewer).to.eq(true);
    expect(v.race[0].leader).to.eq(true);
    expect(v.race.map((r) => r.color)).to.deep.eq([me, rival, third]);
    expect(v.raceTone).to.eq('tie');
    expect(v.leaderScore).to.eq(4);
  });

  it('award race: behind tone when a rival leads; empty on a 0-0 race', () => {
    const behind = buildMaConfirm('award', award({
      scores: [{color: me, score: 1}, {color: rival, score: 5}],
    }), [], opts());
    expect(behind.raceTone).to.eq('behind');
    const empty = buildMaConfirm('award', award({
      scores: [{color: me, score: 0}, {color: rival, score: 0}],
    }), [], opts());
    expect(empty.raceTone).to.eq('empty');
    expect(empty.race.every((r) => !r.leader)).to.eq(true);
  });

  it('award race: sole lead tone', () => {
    const v = buildMaConfirm('award', award({
      scores: [{color: me, score: 6}, {color: rival, score: 4}],
    }), [], opts());
    expect(v.raceTone).to.eq('lead');
  });

  it('free sponsorship: cost 0, M€ untouched', () => {
    const v = buildMaConfirm('award', award(), [award()], opts({free: true, cost: 14}));
    expect(v.free).to.eq(true);
    expect(v.cost).to.eq(0);
    expect(v.mcAfter).to.eq(33);
  });

  it('stale modal: the target taken by another player is surfaced', () => {
    const v = buildMaConfirm('milestone', milestone({playerName: 'Riv', color: rival}),
      [milestone({playerName: 'Riv', color: rival})], opts());
    expect(v.takenByOther).to.deep.eq({name: 'Riv', color: rival});
    expect(v.openAfter).to.eq(2); // already taken — this confirm no longer consumes a slot
  });

  it('server per-game description wins over the manifest fallback', () => {
    const withDesc = buildMaConfirm('milestone', milestone({description: 'per-game'}), [], opts());
    expect(withDesc.description).to.eq('per-game');
    const withoutDesc = buildMaConfirm('milestone', milestone(), [], opts());
    expect(withoutDesc.description).to.eq('rule text');
  });

  it('art helpers: slug / url / display name', () => {
    expect(maArtSlug('Rim Settler')).to.eq('rim-settler');
    expect(maArtSlug('I.B. Aces')).to.eq('ib-aces');
    expect(maArtUrl('Mayor')).to.eq('assets/ma/mayor.png');
    expect(maDisplayName('Terraformer26')).to.eq('Terraformer');
  });
});

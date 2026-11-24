import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {Ownership} from '../../src/client/console/servingOwner';
import {
  bandRungVerdict, barRungNow, barRungVerdict, derivedBandRung, measurePadPress, noteBandFallback, noteOpeningLook, noteOpeningSpan, noteOwedSpan, noteOwnerEdgeLook, noteBarRung, notePadRung, notePromptFlagsLook, noteServingOwnerLook, ownerLookVerdict, padRungVerdict,
  promptFlagsVerdict, registerOwnerNowProbe, resetServingOwnerLog, servingOwnerLog,
} from '../../src/client/console/servingOwnerMeasure';

/*
 * THE MEASURE OF THE ONE FUNCTION (FREEZE ZERO, stage 2, step ①): `servingOwnerOf` is compared with what PAINTS on
 * every look of the leak detector's pass — counted, never judged. A disagreement is a bug of the function or an
 * ambiguity of today's shell; this is how each is found.
 */
describe('servingOwnerMeasure — the function against the screen, counted', () => {
  const serves = (owner: string, host?: string): Ownership => ({asked: true, owner, basis: 'row', ...(host !== undefined ? {host} : {})} as Ownership);
  const held = (owner: string, kind: 'aside' | 'scene' | 'claim' | 'admission', by: string): Ownership => ({asked: true, owner, basis: 'row', hold: {kind, by}} as Ownership);

  beforeEach(() => resetServingOwnerLog());
  after(() => resetServingOwnerLog());

  it('how a look reads: the owner paints · it waits as said · it is missing · it paints under a hold', () => {
    expect(ownerLookVerdict({asked: false}, ['hand'], 'none')).to.eq('free');
    expect(ownerLookVerdict(serves('task'), ['card-actions', 'task'], 'agree')).to.eq('agree');
    expect(ownerLookVerdict(held('task', 'admission', 'reveal'), [], 'beat')).to.eq('held:admission');
    // The function says it serves and it does not paint: what the screen shadow made of the same look rides along.
    expect(ownerLookVerdict(serves('task'), ['parliament'], 'beat')).to.eq('MISS:beat');
    expect(ownerLookVerdict(serves('colonies'), [], 'unserved')).to.eq('MISS:unserved');
    // The function names a hold and the surface stands all the same.
    expect(ownerLookVerdict(held('decision', 'claim', 'hand'), ['decision'], 'agree')).to.eq('EXTRA:claim');
    // A STEP IN A FLOW's ZONE is seen as its host: the host painting is the step served…
    expect(ownerLookVerdict(serves('external-draw', 'parliament'), ['parliament'], 'agree:host')).to.eq('agree');
    expect(ownerLookVerdict(serves('external-draw', 'parliament'), ['hand'], 'held:reveal')).to.eq('MISS:held:reveal');
    // …but a step the FUNCTION holds is held while its host paints (the sitting's ask waiting for the field to open).
    expect(ownerLookVerdict({...held('task', 'claim', 'parliament'), host: 'parliament'} as Ownership, ['parliament'], 'agree:host')).to.eq('held:claim');
    // …and THE BOARD IS ALWAYS THERE — a held board is held as said, whatever paints.
    expect(ownerLookVerdict(held('board', 'aside', 'the player set it aside'), ['board', 'awards'], 'agree:row')).to.eq('held:aside');
  });

  it('every look is counted by its shape; a disagreement is kept ONCE per its own picture', () => {
    for (let i = 0; i < 5; i++) {
      noteServingOwnerLook('payment', serves('task'), ['task'], 'agree');
    }
    for (let i = 0; i < 3; i++) {
      noteServingOwnerLook('payment', serves('task', 'card-actions'), ['card-actions'], 'beat');
    }
    noteServingOwnerLook('colony', held('colonies', 'aside', 'the player set it aside'), [], 'held');
    // ONE look of a disagreement, then it is gone — a surface mounting across a look: unsettled, kept nowhere.
    noteServingOwnerLook('payment', serves('task', 'card-actions'), ['hand'], 'misserved');
    expect(servingOwnerLog.looks).to.eq(10);
    // THE FUNCTION IS HELD TO SETTLED LOOKS: the first look of a disagreement is `unsettled`; the same picture on the
    // very next look is the disagreement (three looks in a row → one unsettled, two counted).
    expect(servingOwnerLog.rows).to.deep.eq({
      payment: {'agree': 5, 'unsettled': 2, 'MISS:beat': 2},
      colony: {'held:aside': 1},
    });
    expect(servingOwnerLog.disagreements.map((d) => `${d.shape}|${d.verdict}|${d.owner}@${d.host}|${d.present.join(',')}`)).to.deep.eq([
      'payment|MISS:beat|task@card-actions|card-actions',
    ]);
    // …and a disagreement that comes back after an agreeing look starts unsettled again.
    noteServingOwnerLook('payment', serves('task'), ['task'], 'agree');
    noteServingOwnerLook('payment', serves('task', 'card-actions'), ['card-actions'], 'beat');
    expect(servingOwnerLog.rows.payment).to.deep.eq({'agree': 6, 'unsettled': 3, 'MISS:beat': 2});
  });
});

/*
 * THE PAD AGAINST THE FUNCTION (stage 2 ② — measured before it is wired): every press says which rung of the pad's
 * ladder took it, and that is read against who the function says serves — on the facts as they stood BEFORE the press.
 */
describe('servingOwnerMeasure — the pad\'s rung against the function, counted', () => {
  const serves = (owner: string, host?: string): Ownership => ({asked: true, owner, basis: 'row', ...(host !== undefined ? {host} : {})} as Ownership);
  const held = (owner: string, kind: 'aside' | 'scene' | 'claim' | 'admission', by: string): Ownership => ({asked: true, owner, basis: 'row', hold: {kind, by}} as Ownership);

  beforeEach(() => resetServingOwnerLog());
  after(() => resetServingOwnerLog());

  it('how a press reads: the owner\'s own rung · its section or sheet · its host\'s · a hold · another rung · nothing asked', () => {
    expect(padRungVerdict({asked: false}, 'section:board')).to.eq('pad-free');
    expect(padRungVerdict(serves('task'), 'taskHost')).to.eq('pad-agree');
    expect(padRungVerdict(serves('lanes'), 'venusBonus')).to.eq('pad-agree');
    expect(padRungVerdict(serves('parliament'), 'section:parliament')).to.eq('pad-agree');
    expect(padRungVerdict(serves('card-actions'), 'sheet:cardActions')).to.eq('pad-agree');
    expect(padRungVerdict(serves('standard-projects'), 'sheet:standardProjects')).to.eq('pad-agree');
    // A step in a flow's zone: its own rung, or its host's (which hands it the press).
    expect(padRungVerdict(serves('task', 'hand'), 'taskHost')).to.eq('pad-agree');
    expect(padRungVerdict(serves('task', 'hand'), 'section:hand')).to.eq('pad-agree');
    // The hand's own flows are the hand's: the play composer of a card taken from it, a pick its album hosts.
    expect(padRungVerdict(serves('hand'), 'pendingPlay')).to.eq('pad-agree');
    // …and a workspace that owns the question hands the pad to the steps of its flow standing above it.
    expect(padRungVerdict(serves('start'), 'section:colonies')).to.eq('pad-MISS:section:colonies');
    expect(padRungVerdict(serves('start'), 'section:colonies', ['colonies'])).to.eq('pad-agree');
    // A hold is not judged by the rung — it has its own, or the press is absorbed.
    // …but WHO took the press under it is kept: the map the ladder is to be derived from.
    expect(padRungVerdict(held('task', 'claim', 'parliament'), 'section:parliament')).to.eq('pad-held:claim:section:parliament');
    expect(padRungVerdict(held('task', 'admission', 'reveal'), 'taskHost')).to.eq('pad-held:admission:own');
    expect(padRungVerdict(held('task', 'admission', 'reveal'), 'reveal')).to.eq('pad-held:admission:beat');
    expect(padRungVerdict(held('board', 'aside', 'lateral:hand'), 'zoom')).to.eq('pad-held:aside:look');
    expect(padRungVerdict(held('start', 'aside', 'lateral:colonies'), '')).to.eq('pad-held:aside:unnamed');
    // The function says X serves and another rung took the press: a fact the ladder knows and the function does not.
    expect(padRungVerdict(serves('task'), 'section:board')).to.eq('pad-MISS:section:board');
    // …but the ladder's upper half is not the question's: a view the PLAYER opened over it, a beat that absorbs.
    expect(padRungVerdict(serves('task'), 'info')).to.eq('pad-look:info');
    expect(padRungVerdict(serves('draft'), 'zoom')).to.eq('pad-look:zoom');
    expect(padRungVerdict(serves('task'), 'cinematic')).to.eq('pad-beat:cinematic');
    expect(padRungVerdict(serves('task'), 'settle')).to.eq('pad-beat:settle');
    expect(padRungVerdict(serves('task'), '')).to.eq('pad-MISS:unnamed');
  });

  it('a press is asked BEFORE it is routed, counted under `pad:<shape>`, and a disagreement is kept once with its facts', () => {
    let asked = 0;
    registerOwnerNowProbe(() => {
      asked++;
      return {shape: 'payment', ownership: serves('task'), facts: () => 'frames [] · host hand'};
    });
    const route = (rung: string) => measurePadPress(() => {
      expect(asked, 'the function was asked before the ladder ran').to.be.greaterThan(0);
      notePadRung(rung);
      return true;
    });
    expect(route('taskHost')).to.eq(true);
    route('taskHost');
    route('section:board');
    route('section:board');
    route('info');
    expect(asked).to.eq(5);
    expect(servingOwnerLog.rows['pad:payment']).to.deep.eq({'pad-agree': 2, 'pad-MISS:section:board': 2, 'pad-look:info': 1});
    expect(servingOwnerLog.disagreements.filter((d) => d.shadow === 'pad').map((d) => `${d.shape}|${d.verdict}|${d.owner}|${d.present.join(',')}|${d.facts}`)).to.deep.eq([
      'pad:payment|pad-MISS:section:board|task|section:board|frames [] · host hand',
    ]);
    // No probe (no shell stands): the press is routed and nothing is counted.
    registerOwnerNowProbe(undefined);
    expect(measurePadPress(() => 7)).to.eq(7);
    expect(servingOwnerLog.rows['pad:payment']).to.deep.eq({'pad-agree': 2, 'pad-MISS:section:board': 2, 'pad-look:info': 1});
    // …and a probe that throws never breaks the press it rides.
    registerOwnerNowProbe(() => {
      throw new Error('a fact that could not be read');
    });
    expect(measurePadPress(() => 'routed')).to.eq('routed');
  });

  it('THE BAR against the pad: the branch the bar stood on, read against the rung that took the press', () => {
    expect(barRungVerdict('taskHost', 'taskHost')).to.eq('bar-agree');
    // The announce's bar is the section's bar plus ONE command.
    expect(barRungVerdict('announce', 'announce')).to.eq('bar-agree');
    expect(barRungVerdict('announce', 'section:board')).to.eq('bar-agree');
    // A view the press opened (or one with a strip of its own) · a beat that absorbed under a standing bar.
    expect(barRungVerdict('section:hand', 'zoom')).to.eq('bar-look:zoom');
    expect(barRungVerdict('start', 'info:open')).to.eq('bar-look:info:open');
    // A layer of the focus engine is LEARNED by the press that meets it: that press is its opening; a later one is not.
    expect(barRungVerdict('start', 'fallback:open')).to.eq('bar-look:fallback:open');
    expect(barRungVerdict('start', 'fallback')).to.eq('bar-APART:start>fallback');
    // …but a view STANDING with the bar on somebody else's commands is the two copies apart.
    expect(barRungVerdict('externalDraw', 'info')).to.eq('bar-APART:externalDraw>info');
    expect(padRungVerdict(serves('task'), 'info:open')).to.eq('pad-look:info:open');
    expect(barRungVerdict('colonyFocus', 'cinematic')).to.eq('bar-beat:colonyFocus>cinematic');
    // …and a beat the BAR shows (the research rise's «skip») whose press the surface under it handles.
    expect(barRungVerdict('cinematic', 'draft')).to.eq('bar-beat:cinematic>draft');
    // The two copies apart: the bar showed one owner's commands and another rung took the press.
    expect(barRungVerdict('taskHost', 'section:board')).to.eq('bar-APART:taskHost>section:board');
    expect(barRungVerdict('', '')).to.eq('bar-agree');

    // Counted with the press it rides, under `bar:<shape>`; a pair that parts is kept once with its facts.
    noteBarRung('taskHost');
    expect(barRungNow()).to.eq('taskHost');
    registerOwnerNowProbe(() => ({shape: 'payment', ownership: serves('task'), facts: () => 'frames []', bar: barRungNow()}));
    const route = (rung: string) => measurePadPress(() => notePadRung(rung));
    route('taskHost');
    route('section:board');
    route('section:board');
    route('zoom');
    route('cinematic');
    expect(servingOwnerLog.rows['bar:payment']).to.deep.eq({
      'bar-agree': 1, 'bar-APART:taskHost>section:board': 2, 'bar-look:zoom': 1, 'bar-beat:taskHost>cinematic': 1,
    });
    expect(servingOwnerLog.disagreements.filter((d) => d.shadow === 'bar').map((d) => `${d.shape}|${d.verdict}|${d.owner}|${d.facts}`)).to.deep.eq([
      'bar:payment|bar-APART:taskHost>section:board|task|frames []',
    ]);
    // A probe that does not read the bar counts no bar row.
    resetServingOwnerLog();
    registerOwnerNowProbe(() => ({shape: 'payment', ownership: serves('task'), facts: () => ''}));
    route('taskHost');
    expect(servingOwnerLog.rows['bar:payment']).to.eq(undefined);
  });

  it('THE SURFACES\' OWN CONDITIONS against the function: every condition that holds, read at once', () => {
    expect(promptFlagsVerdict({asked: false}, [])).to.eq('flag-free');
    expect(promptFlagsVerdict({asked: false}, ['taskHost'])).to.eq('flag-EXTRA:free:taskHost');
    expect(promptFlagsVerdict(serves('task'), ['taskHost'])).to.eq('flag-agree');
    expect(promptFlagsVerdict(serves('lanes'), ['venusBonus'])).to.eq('flag-agree');
    // A workspace that owns the question stands by its frame: no prompt condition is its own, and none holds.
    expect(promptFlagsVerdict(serves('parliament'), [])).to.eq('flag-agree');
    expect(promptFlagsVerdict(serves('parliament'), ['taskHost'])).to.eq('flag-EXTRA:serves:taskHost');
    // The owner's condition does not hold · another one holds beside it (two answers to one question).
    expect(promptFlagsVerdict(serves('task'), [])).to.eq('flag-MISS:task');
    expect(promptFlagsVerdict(serves('task'), ['taskHost', 'effectDecision'])).to.eq('flag-EXTRA:serves:effectDecision');
    // A host and its step both hold — the ladder orders them; a step above the owner's frame is the owner's too.
    // A WORKSPACE WITH A RUNG OF ITS OWN (the opening, the draft, an external draw) stands by its frame — never judged:
    // a host beside its step, the draft still on screen under a question that waits at its gate.
    expect(promptFlagsVerdict(serves('task', 'start'), ['start', 'taskHost'])).to.eq('flag-agree');
    expect(promptFlagsVerdict(held('corp-first', 'admission', 'announce-gate'), ['draft'])).to.eq('flag-held');
    expect(promptFlagsVerdict({asked: false}, ['start'])).to.eq('flag-free');
    expect(promptFlagsVerdict(serves('gov-support'), ['govSupport', 'taskHost'], ['task'])).to.eq('flag-agree:two:govSupport+taskHost');
    expect(promptFlagsVerdict(serves('start'), ['taskHost'], ['task'])).to.eq('flag-agree');
    // Under a hold no prompt condition is to hold.
    expect(promptFlagsVerdict(held('task', 'admission', 'reveal'), [])).to.eq('flag-held');
    expect(promptFlagsVerdict(held('task', 'admission', 'reveal'), ['taskHost'])).to.eq('flag-EXTRA:admission:taskHost');

    // Counted per look under `flag:<shape>`; the first look of a disagreement is unsettled, the next is kept once.
    notePromptFlagsLook('payment', serves('task'), ['taskHost']);
    notePromptFlagsLook('payment', serves('task'), []);
    notePromptFlagsLook('payment', serves('task'), [], [], () => 'frames []');
    notePromptFlagsLook('payment', serves('task'), []);
    expect(servingOwnerLog.rows['flag:payment']).to.deep.eq({'flag-agree': 1, 'flag-unsettled': 1, 'flag-MISS:task': 2});
    expect(servingOwnerLog.disagreements.map((d) => `${d.shape}|${d.verdict}|${d.owner}|${d.present.join(',')}|${d.facts}`)).to.deep.eq([
      'flag:payment|flag-MISS:task|task|no condition|frames []',
    ]);
  });

  it('THE BAND, DERIVED: the one rung the switch would name, held against the rung the ladder took', () => {
    expect(derivedBandRung({asked: false})).to.eq('free');
    expect(derivedBandRung(held('task', 'admission', 'reveal'))).to.eq('held:admission');
    expect(derivedBandRung(serves('task', 'hand'))).to.eq('own:taskHost');
    expect(derivedBandRung(serves('decision'))).to.eq('own:effectDecision');
    expect(derivedBandRung(serves('lanes'), [], 'spendHeat')).to.eq('own:spendHeat');
    expect(derivedBandRung(serves('lanes'), [], 'venusBonus')).to.eq('own:venusBonus');
    expect(derivedBandRung(serves('parliament'))).to.eq('ws');
    // A step of the owner's flow stands above it: the press is that screen's, whoever the owner is.
    expect(derivedBandRung(serves('start'), ['colonies'])).to.eq('step');

    expect(bandRungVerdict('own:taskHost', 'taskHost')).to.eq('band-agree');
    expect(bandRungVerdict('own:taskHost', 'section:hand')).to.eq('band-APART:own:taskHost>section:hand');
    expect(bandRungVerdict('ws', 'section:parliament')).to.eq('band-agree');
    expect(bandRungVerdict('step', 'section:colonies')).to.eq('band-agree');
    expect(bandRungVerdict('held:admission', 'sheet:milestones')).to.eq('band-agree');
    expect(bandRungVerdict('held:admission', 'taskHost')).to.eq('band-APART:held:admission>taskHost');
    // …the press is the PLAYER's wherever they stand — a workspace with a rung of its own, a flow of the client's:
    // any rung but a prompt surface's.
    expect(bandRungVerdict('free', 'handPick')).to.eq('band-agree');
    expect(bandRungVerdict('free', 'pendingPlay')).to.eq('band-agree');
    expect(bandRungVerdict('held:admission', 'draft')).to.eq('band-agree');
    expect(bandRungVerdict('ws', 'pendingPlay')).to.eq('band-agree');
    expect(bandRungVerdict('free', 'taskHost')).to.eq('band-APART:free>taskHost');
    expect(bandRungVerdict('free', '')).to.eq('band-APART:free>unnamed');
    // The ladder's upper half is never the band's.
    expect(bandRungVerdict('own:taskHost', 'zoom')).to.eq('band-above');
    expect(bandRungVerdict('own:taskHost', 'info:open')).to.eq('band-above');
    expect(bandRungVerdict('ws', 'cinematic')).to.eq('band-above');

    registerOwnerNowProbe(() => ({shape: 'payment', ownership: serves('task'), facts: () => 'frames []', kind: 'payment'}));
    const route = (rung: string) => measurePadPress(() => notePadRung(rung));
    route('taskHost');
    route('section:board');
    route('zoom');
    expect(servingOwnerLog.rows['band:payment']).to.deep.eq({'band-agree': 1, 'band-APART:own:taskHost>section:board': 1, 'band-above': 1});
    expect(servingOwnerLog.disagreements.filter((d) => d.shadow === 'band').map((d) => `${d.shape}|${d.verdict}|${d.facts}`)).to.deep.eq([
      'band:payment|band-APART:own:taskHost>section:board|frames []',
    ]);
    // SINCE THE SWAP the ladder says when its own order routed a press (the function named no standing surface) —
    // counted for that press only, and kept once.
    measurePadPress(() => {
      noteBandFallback('held:admission', 'taskHost');
      notePadRung('taskHost');
    });
    route('taskHost');
    expect(servingOwnerLog.rows['band:payment']).to.deep.eq({
      'band-agree': 2, 'band-APART:own:taskHost>section:board': 1, 'band-above': 1, 'band-fallback:held:admission>taskHost': 1,
    });
  });

  it('THE ANSWER AT ITS LAST REACTIVE EDGE: the same answer is a cache that holds the truth; another is a latch, kept once with the facts that moved', () => {
    const edge = (answer: string, facts: string) => ({answer, facts});
    noteOwnerEdgeLook('payment', edge('task', 'frames [] · host hand'), edge('task', 'frames [] · host hand'));
    // The facts may move with no edge — only the ANSWER is a cache's truth.
    noteOwnerEdgeLook('payment', edge('task', 'frames [] · host hand'), edge('task', 'frames [hand] · host hand'));
    noteOwnerEdgeLook('payment', edge('task', 'frames [] · host hand'), edge('task held scene:handoff', 'frames [] · host hand · handoff [draft]'));
    noteOwnerEdgeLook('payment', edge('task', 'frames [] · host hand'), edge('task held scene:handoff', 'frames [] · host hand · handoff [draft]'));
    expect(servingOwnerLog.rows['edge:payment']).to.deep.eq({'edge-agree': 2, 'edge-LATCH': 2});
    expect(servingOwnerLog.disagreements.map((d) => `${d.shape}|${d.present[0]} → ${d.owner}|${d.facts}`)).to.deep.eq([
      'edge:payment|task → task held scene:handoff|+ handoff [draft]',
    ]);
  });

  it('THE OPENING: a disagreement of the start director and the latches is a span — who was expected, who stood, the cure, how long, what ended it', () => {
    resetServingOwnerLog();
    const look = (expected: string, actual: string, verdict: 'agree' | 'disagree' | 'held' | 'out', cure = '', question = 'space:') => ({question, expected, actual, verdict, cure});
    noteOpeningLook(look('queue', 'queue', 'agree', '', 'or:preludes'), 1000);
    // The server asks a cell and the queue still stands: the director would yield — the latches do it 400 ms later.
    noteOpeningLook(look('board', 'queue', 'disagree', 'yield'), 2000);
    noteOpeningLook(look('board', 'queue', 'disagree', 'yield'), 2100); // (the same disagreement under a new prompt id)
    expect(servingOwnerLog.open).to.deep.eq([{surface: 'opening', verdict: 'space: · board>queue · yield', since: 2000}]);
    noteOpeningLook(look('board', 'board', 'agree'), 2400);
    expect(servingOwnerLog.spans['opening|space: · board>queue · yield → agree:board>board']).to.deep.eq({n: 1, ms: 400, max: 400});
    expect(servingOwnerLog.open).to.deep.eq([]);
    // A held prompt is a span of its own, named by its block; the scene leaving ends it `out`.
    noteOpeningLook(look('board', 'none', 'held', 'remote-landing'), 3000);
    noteOpeningLook(look('game', 'game', 'out'), 3900);
    expect(servingOwnerLog.spans['opening|space: · board>none · held:remote-landing → out']).to.deep.eq({n: 1, ms: 900, max: 900});
    expect(servingOwnerLog.rows['opening']).to.deep.eq({'opening-agree': 2, 'opening-disagree': 1, 'opening-held': 1, 'opening-out': 1});
    // THE STRAND is a track of its own: it rises, the net confirms it (a span ends, the healed one begins), it clears.
    noteOpeningSpan('strand', 'STRAND space: · plan queue-returned', 'cleared', 5000);
    noteOpeningSpan('strand', 'STRAND space: · plan queue-returned · HEALED queue-returned', 'confirmed', 7500);
    noteOpeningSpan('strand', '', 'cleared', 7600);
    expect(servingOwnerLog.spans['opening|STRAND space: · plan queue-returned → confirmed']).to.deep.eq({n: 1, ms: 2500, max: 2500});
    expect(servingOwnerLog.spans['opening|STRAND space: · plan queue-returned · HEALED queue-returned → cleared']).to.deep.eq({n: 1, ms: 100, max: 100});
    expect(servingOwnerLog.open).to.deep.eq([]);
  });
});

/*
 * THE MEASURE HOLDS THE FUNCTION TO WHAT A SCREEN CAN SAY (the whole suite's residue, CI run 45071347931 — nine
 * `EXTRA:admission`, four `edge-LATCH`, two `band-fallback`: fifteen looks of 1 502 tests, not one of them the
 * function being wrong about a surface that serves).
 */
describe('servingOwnerMeasure — the probe reads surfaces that SERVE, and the edge past the flush', () => {
  const read = (file: string): string => fs.readFileSync(path.resolve(__dirname, '../../src/client/console', file), 'utf8').replace(/\r\n/g, '\n');

  it('a presence that serves nothing is not «present»: the shell names it, the probe drops it — for the shadow and the measure alike', () => {
    const detector = read('consoleLeakDetector.ts');
    expect(detector).to.contain('const present = ctx.presences === undefined || ctx.presences.length === 0 ? probed.present : probed.present.filter((owner) => !ctx.presences?.includes(owner));');
    // ONE `present` for both readers: the verdict of the shadow and the look of the measure take the filtered list.
    expect(detector.indexOf('const present = ctx.presences'), 'before the shadow\'s verdict').to.be.lessThan(detector.lastIndexOf('const verdict = screenShadowVerdict({'));
    expect(detector).to.not.contain('noteServingOwnerLook(shape, ownership, probed.present');
    // …and the shell's word is the three it has: the deck pick's outgoing beat, a series' visit of either surface.
    const wiring = read('shell/wiringController.ts');
    expect(wiring).to.match(/presences: \[\s+\.\.\.\(shell\.deckPickOutgoing \? \['deck-pick' as const\] : \[\]\),\s+\.\.\.\(shell\.seriesHeldVisit !== undefined \? \['task' as const\] : \[\]\),\s+\.\.\.\(shell\.seriesHeldDecision !== undefined \? \['decision' as const\] : \[\]\),/);
    // The pure half: under a hold, a surface the probe no longer lists reads as held — never EXTRA.
    const held: Ownership = {asked: true, owner: 'deck-pick', basis: 'row', host: 'card-actions', hold: {kind: 'admission', by: 'played-hero'}} as Ownership;
    expect(ownerLookVerdict(held, ['card-actions', 'deck-pick'], 'agree:table'), 'the outgoing beat read as a surface').to.eq('EXTRA:admission');
    expect(ownerLookVerdict(held, ['card-actions'], 'held:admission'), 'the same look, the presence named').to.eq('held:admission');
  });

  it('the edge is read in a microtask of the look — behind the flush the fact\'s own move queued', () => {
    const detector = read('consoleLeakDetector.ts');
    const look = detector.slice(detector.indexOf('if (ctx.edge !== undefined) {'), detector.indexOf('if (ctx.flags !== undefined) {'));
    expect(look).to.match(/void Promise\.resolve\(\)\.then\(\(\) => \{\s+const late = screenShadowContext\?\.\(\);/);
    expect(look, 'the facts and the edge are BOTH read late — one moment').to.contain('noteOwnerEdgeLook(shape, late.edge, {answer: ownershipDigest(servingOwnerOf(lateFacts)), facts: questionFactsDigest(lateFacts)});');
    expect(look, 'never the look\'s own, synchronous, edge').to.not.contain('noteOwnerEdgeLook(shape, ctx.edge');
  });

  it('a surface standing outside the stack is a FACT of the question: the sitting\'s embedded draw', () => {
    const router = read('shell/routerController.ts');
    expect(router).to.contain('standing: shell.externalDrawEmbedded ? [\'external-draw\'] : [],');
    // (Its presence is the published zone — nothing of the function's answer: no cycle.)
    const reveal = read('shell/revealController.ts');
    const embedded = reveal.slice(reveal.indexOf('const externalDrawEmbedTarget = computed('), reveal.indexOf('const externalDrawWorkspaceMounted = computed('));
    expect(embedded).to.not.match(/ownerServes|promptOwnership|servingOwnership/);
  });
});

/*
 * THE CONCLUSION's LAST NETS, READ AGAINST THE DOORS (FREEZE ZERO, stage 2 — the tail). The reaper lets a claim go
 * whatever its stage; the claim's door needs «nothing in flight», and a claim that still awaits its answer IS a
 * flight. The ghost test and the forced teardown act under any question; the doors only over the free turn. Two
 * tracks read both cases by frame before a door is widened or a net deleted.
 */
describe('servingOwnerMeasure — an owed conclusion and a claim that is the only flight (the tracks)', () => {
  const read = (file: string): string => fs.readFileSync(path.resolve(__dirname, '../../src/client/console', file), 'utf8').replace(/\r\n/g, '\n');
  beforeEach(() => resetServingOwnerLog());
  after(() => resetServingOwnerLog());

  it('one span per state of a debt: how long it stood, and how it ended', () => {
    noteOwedSpan('hand · q:actionMenu · held:live-outcome · vouched · busy[hold:hold:played-hero]', 'moved', 1_000);
    noteOwedSpan('hand · q:actionMenu · held:live-outcome · vouched · busy[hold:hold:played-hero]', 'moved', 1_300);
    noteOwedSpan('hand · q:actionMenu · held:live-outcome · ghost · QUIET', 'moved', 1_800);
    noteOwedSpan('', 'gone', 2_400);
    expect(servingOwnerLog.spans['owed|hand · q:actionMenu · held:live-outcome · vouched · busy[hold:hold:played-hero] → moved']).to.deep.eq({n: 1, ms: 800, max: 800});
    expect(servingOwnerLog.spans['owed|hand · q:actionMenu · held:live-outcome · ghost · QUIET → gone']).to.deep.eq({n: 1, ms: 600, max: 600});
  });

  it('the owner reads a debt every frame — the flights taken UNDER the debt\'s own nodes; nothing there acts', () => {
    const outcome = read('shell/outcomeController.ts');
    const look = outcome.slice(outcome.indexOf('function measureOwedConclusion(): void {'), outcome.indexOf('function measureStandingBeat(): void {'));
    expect(look).to.contain('const flight = flightsInTheAir(Date.now(), [`conclusion:${owed.kind}`, `claim:${owed.kind}`, `surface:${owed.kind}`, OWED_CADENCE_FLIGHT]);');
    // (The debt's own cadence is a kernel wait — a `sleep` — and reads as a flight by its owner's name: asked what
    // moves UNDER the debt, it is the debt. The first reading without it said `busy[kernel:task:conclusion owed]` of
    // every debt there is.)
    expect(outcome).to.contain('const OWED_CADENCE_FLIGHT = \'kernel:task:conclusion owed\';');
    expect(read('waitGraph/flightsInTheAir.ts')).to.match(/const name = `kernel:\$\{row\.owner\.replace\(\/#\[0-9\]\+\/g, ''\)\}`;[\s\S]{0,360}if \(!asked\.includes\(name\)\) \{\s+names\.push\(name\);/);
    expect(look).to.contain('shell.stuckWorkspaceIsGhost(owed.kind) ? \'ghost\' : \'vouched\'');
    expect(look, 'a measure: no verb of a conclusion in it').to.not.match(/concludeWorkspaceFlow|releaseWorkspaceOutcome|forceRecoverStuckWorkspace|withdrawConclusionOwe/);
    expect(outcome).to.match(/function lookAtConclusionDoor\(\): void \{\s+measureStandingBeat\(\);\s+measureOwedConclusion\(\);/);
  });

  it('a candidate whose ONLY flights are its OWN waits — its claim, its debt — is named: they are the question, never its answer', () => {
    const outcome = read('shell/outcomeController.ts');
    const measure = outcome.slice(outcome.indexOf('function measureConcludeDoor()'), outcome.indexOf('const OWED_CADENCE_FLIGHT = '));
    expect(measure).to.contain('const own = [`claim:${top.kind}`, `conclusion:${top.kind}`, OWED_CADENCE_FLIGHT];');
    expect(measure).to.contain('const underOwn = flight !== \'\' && flightsInTheAir(Date.now(), own) === \'\';');
    expect(measure).to.contain('`ONLY-ITS-OWN[${flight}]${mine ? ` claim:${workspaceOutcomeState.stage}${workspaceOutcomeState.answerIn ? \'+answered\' : \'\'}` : \'\'} `');
    // …and the DOORS read the same: quiet is asked under the frame's own waits (widened on the tracks' readings —
    // the whole suite, the gate, the box: no healthy span of `ONLY-ITS-OWN`), and the claim's door only for a claim
    // that SERVES nothing.
    expect(measure).to.contain('quiet: conclusion.verdict === \'dismiss\' && look === \'\' && (flight === \'\' || underOwn),');
    expect(measure).to.match(/claimOnly: conclusion\.verdict === 'hold' && conclusion\.reason === 'live-outcome' && mine && rows\.length === 0 &&\s+!workspaceOutcomeServingNow\.value && currentRevealEvent\(\) === undefined && look === '' && \(flight === '' \|\| underOwn\),/);
  });
});

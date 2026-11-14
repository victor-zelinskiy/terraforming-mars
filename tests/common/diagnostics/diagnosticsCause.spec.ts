import {expect} from 'chai';
import {causeClass, causeDims, causeOf, causePart, cureOf, durationBucket, evidenceDelta} from '../../../src/common/diagnostics/cause';
import {DIAG_FAMILIES} from '../../../src/common/diagnostics/classify';
import {DiagEvidence} from '../../../src/common/diagnostics/DiagnosticModel';
import {DIAG_ECHO_MS, DiagJournal} from '../../../src/common/diagnostics/journal';
import {DIAG_SHAPES, quietRows, shapeOf} from '../../../src/common/diagnostics/shapes';

/**
 * THE CAUSE OF A STALL (docs/claude/console/freeze-zero/PLAN.md §2 · docs/claude/diagnostics.md) — one key for one
 * defect, wherever its line is read: the page, the hub, the e2e harvest, the monkey.
 *
 * What is pinned here: two causes are two classes and one cause is one class whatever varies between its occurrences
 * (a duration, a counter, a prompt id, a run's number, a card); the tier is the shape's; an echo is a line of what it
 * answers; an episode names who cured it and what was different after.
 */
const stall = (fields: string, rung = 'rung 0: presentation-ledger: 2 stories degraded') =>
  `[liveness] stall (unserved): 12s without progress, 0 presses; ${fields} — ${rung}`;
const NEW_LINE = 'asked: card; task: handPick; top: hand:committed; holder: block:reveal; beat: none; stranded: no; last in flight: nothing; ' +
  'claim: hand/Ganymede Colony [draw] awaiting (zone up, beat pending, arrival pending, task card); holds: card-receive[blocking]';

const evidence = (over: Partial<DiagEvidence> = {}): DiagEvidence => ({
  at: 1, question: 'asked card#12 · task handPick', holders: ['holder: block:reveal', 'hold card-receive [blocking] 11.2s of 35s'],
  tree: ['session:game#1 120.0s', '  frame:hand#3 40.1s committed', '    claim:hand#7 12.0s awaiting  ⟵ waits «the claimed answer» 12.0s/20s'],
  waits: [], graph: [], trace: [], input: '',
  ...over,
});

describe('diagnostics cause — the class is the line\'s structure, never its wording', () => {
  it('a structural word loses what varies between two occurrences of one cause', () => {
    expect(causePart('admission:host#12')).to.eq('admission:host');
    expect(causePart('«colonies»')).to.eq('colonies');
    expect(causePart('question:card#7')).to.eq('question:card');
    expect(causePart('hand:committed')).to.eq('hand:committed');
    expect(causePart('story:owed:remote-tile:05')).to.eq('story:owed:remote-tile:n');
    expect(causeClass('wait-graph/ceiling', ['played-hero:payback'])).to.eq('wait-graph/ceiling/played-hero:payback');
  });

  it('the arbiter\'s episode: reason · task · where · holder — and nothing that moves', () => {
    const a = causeOf(stall(NEW_LINE), 'warn');
    expect(a).to.deep.include({cls: 'liveness/stall/unserved/handpick/hand:committed/block:reveal', shape: 'liveness/stall', tier: 'defect'});
    expect(a?.dims).to.deep.include({reason: 'unserved', asked: 'card', task: 'handPick', where: 'hand:committed', holder: 'block:reveal', source: 'Ganymede Colony'});
    // Another duration, another prompt, other presses, another rung, another card on the claim: the SAME cause.
    const b = causeOf('[liveness] stall (unserved): 31s without progress, 4 presses; asked: card; task: handPick; top: hand:committed; holder: block:reveal; ' +
      'beat: none; stranded: no; last in flight: transport@3s; claim: hand/Pets [draw] presenting (zone up, beat done, arrival done, task card); holds: none — rung 3: stack-home: home from hand/', 'warn');
    expect(b?.cls).to.eq(a?.cls);
    expect(b?.dims.source, 'the card is a dimension').to.eq('Pets');
  });

  it('two causes of «unserved, asked card» are two classes', () => {
    const held = causeOf(stall(NEW_LINE), 'warn');
    const stranded = causeOf(stall('asked: card; task: deckPick; top: board; holder: stranded+claim:card-actions:awaiting; beat: none; stranded: card; last in flight: nothing; claim: card-actions/Hi-Tech Lab [draw,pick] awaiting (zone -, beat pending, arrival pending, task -); holds: none'), 'warn');
    const beat = causeOf(stall('asked: or; task: actionMenu; top: hydro:executing; holder: beat; beat: hydro:executing; stranded: no; last in flight: transport@13s, hydro-marker; claim: none; holds: none'), 'warn');
    expect(new Set([held?.cls, stranded?.cls, beat?.cls]).size).to.eq(3);
    expect(stranded?.cls).to.eq('liveness/stall/unserved/deckpick/board/stranded+claim:card-actions:awaiting');
    expect(beat?.cls).to.eq('liveness/stall/unserved/actionmenu/hydro:executing/beat');
  });

  it('a line written before the holder was named is still filed — by what it does say', () => {
    const old = causeOf(stall('asked: card; beat: hand:executing; stranded: no; last in flight: nothing; claim: none; holds: none'), 'warn');
    expect(old?.cls).to.eq('liveness/stall/unserved/card/hand:executing/beat');
    const bare = causeOf(stall('asked: card; beat: none; stranded: card; last in flight: nothing; claim: none; holds: none'), 'warn');
    expect(bare?.cls).to.eq('liveness/stall/unserved/card/board/stranded');
  });

  it('the wait graph: a finding is its kind and its members (a cycle has no first member), a ceiling its wait', () => {
    const cycle = causeOf('[wait-graph] cycle question:card#12 (server: card / handPick) · announce:pick#12 (consoleMandatoryGate: pending) · surface:hand (workspace:hand: committed) — every member waits, none can move — yields: announce:pick#12 — standing 3 s', 'warn');
    const again = causeOf('[wait-graph] cycle surface:hand (workspace:hand: committed) · question:card#40 (server: card / handPick) · announce:pick#40 (consoleMandatoryGate: presented) — every member waits, none can move — yields: announce:pick#40 — standing 9 s', 'warn');
    expect(cycle?.cls).to.eq('wait-graph/cycle/announce:pick/question:card/surface:hand');
    expect(again?.cls, 'the same members in another order, with other run numbers').to.eq(cycle?.cls);
    const ceiling = causeOf('[wait-graph] ceiling played-hero:payback (consolePlayedHero: paying) — «the pay-back of the play» did not come in 9000 ms — the wait ended on its ceiling', 'warn');
    expect(ceiling).to.deep.include({cls: 'wait-graph/ceiling/played-hero:payback', tier: 'defect'});
    expect(ceiling?.dims.owner).to.eq('consolePlayedHero');
  });

  it('a wait that DECLARES its ceiling as its honest end is planned — counted, never an event', () => {
    const planned = causeOf('[wait-graph] ceiling remote-placement:watchable-board (consoleRemotePlacement: kept up to 30000 ms while the keeper holds) — «a board free for the landing of another seat» did not come in 12000 ms — the wait ended on its ceiling (planned: the viewer keeps the board covered — the tile is revealed without its flight)', 'warn');
    expect(planned).to.deep.include({cls: 'wait-graph/ceiling/remote-placement:watchable-board', tier: 'planned'});
    const park = causeOf('[presentation-ledger] story «board-beat-park» degraded after 30s — the release edge never came — {"watchable":false,"pending":true,"draining":false,"sceneHeld":false}', 'warn');
    expect(park?.tier, 'the viewer kept the board covered: the honest multiplayer wait').to.eq('planned');
    const wedge = causeOf('[presentation-ledger] story «board-beat-park» degraded after 30s — the release edge never came — {"watchable":true,"pending":true,"draining":false,"sceneHeld":false}', 'warn');
    expect(wedge, 'an open board and a drain that never ran: a defect').to.deep.include({tier: 'defect', cls: park?.cls});
  });

  it('an exception, a note and a perf line have no cause class', () => {
    expect(causeOf('[vue-error] X · render: TypeError: y', 'error')).to.eq(undefined);
    expect(causeOf('[played-hero] the lift degraded', 'warn')).to.eq(undefined);
    expect(causeOf('[long-frame] 812ms — native 700ms — NATIVE', 'warn')).to.eq(undefined);
    expect(causeOf('a plain sentence', 'error')).to.eq(undefined);
  });

  it('a line of a stall family no row matches is filed by its family — never silently merged with another shape', () => {
    const odd = shapeOf('[wait-graph] something nobody declared');
    expect(odd).to.deep.include({id: 'wait-graph/unshaped', unshaped: true, tier: 'defect'});
  });

  it('every stall / integrity family has rows, every quiet row says why', () => {
    const families = [...DIAG_FAMILIES].filter(([, kind]) => kind === 'stall' || kind === 'integrity').map(([family]) => family);
    expect(families.filter((family) => DIAG_SHAPES[family] === undefined), 'a stall / integrity family with no shape rows').to.deep.eq([]);
    expect(Object.keys(DIAG_SHAPES).filter((family) => !families.includes(family)), 'shape rows of a family that is not a stall / integrity one').to.deep.eq([]);
    expect(quietRows().filter((row) => row.why === undefined || row.why === '').map((row) => row.id),
      'a `planned` / `info` row must say why its line is not a defect by itself').to.deep.eq([]);
  });

  it('the duration is a bucket, the cure is the last step that did something', () => {
    expect([1_000, 7_000, 13_000, 25_000, 90_000].map(durationBucket)).to.deep.eq(['under-5s', '5-10s', '10-20s', '20-40s', 'over-40s']);
    expect(cureOf(['rung 0: presentation-ledger: 2 stories degraded'])).to.deep.eq({by: 'presentation-ledger', did: 'presentation-ledger: 2 stories degraded'});
    expect(cureOf(['rung 0: presentation-ledger: 1 story degraded', 'rung 2: rank 10: nothing to release · rank 15: nothing to release · workspace-outcome: the claim released · colony-trade: concluded']).by)
      .to.eq('workspace-outcome+colony-trade');
    expect(cureOf(['rung 0: rank 0: nothing to release', 'rung 6: rank 31: nothing to release — the ladder is spent'])).to.deep.eq({by: '', did: ''});
  });

  it('what changed by the cure: the scopes that ended, the holders that let go, a question that moved on', () => {
    const start = evidence();
    const end = evidence({
      question: 'asked or#13 · task actionMenu', holders: ['holder: none'],
      tree: ['session:game#1 133.0s', '  frame:hand#3 53.1s committed', '  frame:card-actions#9 0.2s browse'],
    });
    const delta = evidenceDelta(start, end);
    expect(delta[0]).to.eq('question: asked card#12 · task handPick → asked or#13 · task actionMenu');
    expect(delta).to.include('ended: claim:hand#7 12.0s awaiting  ⟵ waits «the claimed answer» 12.0s/20s');
    expect(delta).to.include('let go: holder: block:reveal');
    expect(delta).to.include('let go: hold card-receive [blocking] 11.2s of 35s');
    expect(delta).to.include('opened: 1 scope(s)');
    expect(evidenceDelta(start, undefined)).to.deep.eq([]);
  });
});

describe('diagnostics cause — the journal files by it', () => {
  const journal = () => new DiagJournal({runtime: 'page', session: 's1', build: '1.2.9'});

  it('ONE CAUSE — ONE RECORD: a reworded repeat of a class is the same record; another class is another', () => {
    const j = journal();
    const first = j.ingest({at: 1_000, level: 'warn', text: '[wait-graph] ceiling played-hero:payback (consolePlayedHero: paying) — «the pay-back of the play» did not come in 9000 ms — the wait ended on its ceiling'});
    const again = j.ingest({at: 4_000, level: 'warn', text: '[wait-graph] ceiling played-hero:payback (consolePlayedHero: late) — «the pay-back of the play» did not come in 9000 ms — the wait ended on its ceiling'});
    const other = j.ingest({at: 5_000, level: 'warn', text: '[wait-graph] ceiling deck-draw:stage (consoleDeckDraw) — «a stage for the deal» did not come in 8000 ms — the wait ended on its ceiling'});
    expect(first.change).to.eq('new');
    expect(again).to.deep.include({change: 'update'});
    expect(again.entry.id).to.eq(first.entry.id);
    expect(again.entry.count).to.eq(2);
    expect(other.change).to.eq('new');
    expect(j.entries().length).to.eq(2);
  });

  it('a defect keeps what stood when it was named; a planned wait and a breadcrumb keep nothing', () => {
    const j = journal();
    const defect = j.ingest({at: 1_000, level: 'warn', text: '[workspace-stale] concluded «colonies» — it stood committed over the free turn 9s with nothing in flight (frames: colonies:committed); its flow did not end itself', evidence: evidence()});
    const planned = j.ingest({at: 2_000, level: 'warn', text: '[workspace-anchor] dropped parliament (parked) — its phase is over; it does not come back', evidence: evidence()});
    expect(defect.entry.evidence?.question).to.eq('asked card#12 · task handPick');
    expect(defect.entry.cause?.cls).to.eq('workspace-stale/concluded/colonies');
    expect(planned.entry.cause?.tier).to.eq('planned');
    expect(planned.entry.evidence).to.eq(undefined);
  });

  it('AN ECHO IS A LINE OF WHAT IT ANSWERS: the door\'s result is folded into its finding', () => {
    const j = journal();
    const finding = j.ingest({at: 1_000, level: 'warn', text: '[wait-graph] dead-end question:card#12 (server: card / handPick) — nothing accepts the press — standing 3 s'});
    const cure = j.ingest({at: 1_001, level: 'warn', text: '[wait-graph] cure dead-end at question:card#12 through «question-open» — reopened the «handPick» question in «hand»'});
    expect(cure.change).to.eq('fold');
    expect(cure.entry.id).to.eq(finding.entry.id);
    expect(cure.entry.text).to.contain('through «question-open»');
    expect(j.entries().length, 'no second record').to.eq(1);
    // A cure of ANOTHER kind does not answer this finding; with nothing to answer it is its own (quiet) record.
    const stray = j.ingest({at: 1_002 + DIAG_ECHO_MS, level: 'warn', text: '[wait-graph] cure cycle at announce:pick#3 through «announce-serve» — acknowledged'});
    expect(stray.change).to.eq('new');
    expect(stray.entry.cause?.tier).to.eq('info');
  });

  it('ONE INCIDENT — ONE RECORD: a question with no surface is named by three detectors, and is one record; the episode that follows says what it followed', () => {
    const j = journal();
    const stranded = j.ingest({at: 1_000, level: 'warn', text: '[console-leak-detector] STRANDED PROMPT: waitingFor "projectCard" (task kind "projectCard") has NO serving surface in console mode', evidence: evidence()});
    const shadow = j.ingest({at: 4_000, level: 'warn', text: '[screen-shadow] unserved — expected «hand,standard-projects», on screen «nothing» for «projectCard#12» {}'});
    const deadEnd = j.ingest({at: 4_100, level: 'warn', text: '[wait-graph] dead-end question:projectCard#12 (server: projectCard / projectCard) — nothing accepts the press — standing 3 s'});
    const cure = j.ingest({at: 4_101, level: 'warn', text: '[wait-graph] cure dead-end — the door «question-open» of question:projectCard#12 had nothing to do: a worklist row'});
    expect(stranded.entry.cause?.cls).to.eq('console-leak-detector/stranded-prompt/projectcard');
    expect([shadow.change, deadEnd.change, cure.change], 'the later detectors and the door are lines of the first').to.deep.eq(['fold', 'fold', 'fold']);
    expect(j.entries().length).to.eq(1);
    expect(stranded.entry.text).to.contain('[screen-shadow] unserved').and.to.contain('[wait-graph] dead-end').and.to.contain('had nothing to do');
    // A MISSERVED question is another defect (a foreign surface stands), and so is a dead end of anything but the question.
    expect(j.ingest({at: 5_000, level: 'warn', text: '[screen-shadow] misserved — expected «draft», on screen «sheet» for «card#3» {}'}).change).to.eq('new');
    expect(j.ingest({at: 5_100, level: 'warn', text: '[wait-graph] dead-end hold:played-hero (animationHold) — nothing moves — standing 6 s'}).change).to.eq('new');
    // The arbiter's episode a moment later is its own record — and names what it followed.
    const episode = j.ingest({at: 6_000, level: 'warn', text: stall('asked: projectCard; task: projectCard; top: board; holder: stranded; beat: none; stranded: projectCard; last in flight: nothing; claim: none; holds: none')});
    expect(episode.change).to.eq('new');
    expect(episode.entry.episode?.after).to.deep.eq([
      'console-leak-detector/stranded-prompt/projectcard', 'screen-shadow/finding/misserved/draft/sheet', 'wait-graph/dead-end/hold:played-hero',
    ]);
  });

  it('WHAT A NET SAYS INSIDE AN EPISODE IS THE EPISODE\'S: folded in, counted by its own class', () => {
    const j = journal();
    const open = j.ingest({at: 10_000, level: 'warn', text: stall(NEW_LINE), evidence: evidence()});
    const story = j.ingest({at: 10_001, level: 'warn', text: '[presentation-ledger] story «board-beat-park» degraded by the liveness arbiter after 12s'});
    const beat = j.ingest({at: 12_000, level: 'warn', text: '[workspace-stall] beat «hand:executing» torn down by the liveness arbiter'});
    j.ingest({at: 12_001, level: 'warn', text: stall(NEW_LINE, 'rung 2: workspace-beat: tore down hand:executing')});
    const error = j.ingest({at: 12_500, level: 'error', text: '[page-error] uncaught: TypeError: x', stack: 'TypeError: x\n    at f (app://bundle/main.js:1:1)'});
    expect(story.entry.id).to.eq(open.entry.id);
    expect(beat.entry.id).to.eq(open.entry.id);
    expect(error.entry.id, 'an exception is never folded: it is grouped by its stack').to.not.eq(open.entry.id);
    expect(open.entry.episode?.nets).to.deep.eq([
      {cls: 'presentation-ledger/story-degraded-by/board-beat-park', tier: 'info', n: 1},
      {cls: 'workspace-stall/beat-arbiter/hand:executing', tier: 'info', n: 1},
    ]);
    const healed = j.ingest({at: 14_000, level: 'warn', text: '[liveness] recovered after 16s, 3 rung(s) run', evidence: evidence({holders: ['holder: none'], tree: ['session:game#1 133.0s']})});
    expect(healed.change).to.eq('close');
    expect(healed.entry.episode).to.deep.include({state: 'healed', outcome: 'healed', durationMs: 16_000});
    expect(healed.entry.episode?.cure?.by).to.eq('workspace-beat');
    expect(healed.entry.episode?.cure?.changed).to.include('let go: holder: block:reveal');
    expect(causeDims(healed.entry.cause!, healed.entry.episode)).to.deep.include({outcome: 'healed', stood: '10-20s', cure: 'workspace-beat', holder: 'block:reveal'});
  });

  it('an episode nobody cured says how it ended: silence, a reload under it, the app closing', () => {
    const silent = journal();
    silent.ingest({at: 1_000, level: 'warn', text: stall(NEW_LINE)});
    expect(silent.tick(1_000 + 70_000)[0].episode).to.deep.include({state: 'unhealed', outcome: 'unhealed'});
    const left = journal();
    left.ingest({at: 1_000, level: 'warn', text: stall(NEW_LINE)});
    expect(left.closeOpenEpisodes()[0].episode).to.deep.include({state: 'unhealed', outcome: 'reload'});
    const closing = journal();
    closing.ingest({at: 1_000, level: 'warn', text: stall(NEW_LINE)});
    expect(closing.closeOpenEpisodes('quit')[0].episode?.outcome).to.eq('quit');
  });

  it('THE RENDERER\'S STOP IS AN EPISODE: opened by the watch, healed when the page answers, a reload when it is restarted — its trace folded in', () => {
    const j = new DiagJournal({runtime: 'main', session: 'm1', build: '1.2.9'});
    const stop = '[renderer-hang] the page stopped answering — the last screen (read 3s before: prompt card#12, accepting, frames hand:committed, section hand/, quiet 2s)';
    const open = j.ingest({at: 1_000, level: 'warn', text: stop});
    expect(open.entry).to.deep.include({kind: 'stall', family: 'renderer-hang'});
    expect(open.entry.cause?.cls).to.eq('renderer-hang/unresponsive/hand/hand:committed');
    expect(open.entry.episode?.state).to.eq('open');
    const healed = j.ingest({at: 4_000, level: 'warn', text: '[renderer-hang] the page answers again after 3s'});
    expect(healed.change).to.eq('close');
    expect(healed.entry.episode).to.deep.include({state: 'healed', outcome: 'healed', durationMs: 3_000});
    const trace = j.ingest({at: 5_200, level: 'warn', text: '[renderer-hang] trace of the stop (3s, the page answered again): /home/deck/Applications/renderer-hang-20261114-101500.trace.json — open it in chrome://tracing / ui.perfetto.dev'});
    expect(trace.change).to.eq('fold');
    expect(trace.entry.id).to.eq(open.entry.id);
    expect(trace.entry.cause?.dims.trace).to.contain('renderer-hang-20261114-101500.trace.json');
    // A second stop that the watch ends by restarting the renderer.
    j.ingest({at: 100_000, level: 'warn', text: stop});
    const restarted = j.ingest({at: 130_000, level: 'warn', text: '[renderer-hang] still not answering after 30s — the renderer is restarted and the page reloads (the game restores itself)'});
    expect(restarted.entry.episode).to.deep.include({state: 'unhealed', outcome: 'reload', durationMs: 30_000});
    expect(j.entries().length).to.eq(2);
  });

  it('THE LAST LINE: an episode the console session was REBUILT under says so — on the page that left, and on the page that adopts it', () => {
    const REBUILD = '[session-rebuild] page — «handPick» (card#12) — by liveness: the ladder is spent and the screen stood 16s';
    expect(causeOf(REBUILD, 'warn')).to.deep.include({cls: 'session-rebuild/page/handpick', tier: 'defect'});
    expect(causeOf(REBUILD, 'warn')?.dims).to.deep.include({by: 'liveness'});
    // The page that leaves: its `pagehide` closes the episode — the line of the last line is a net of it.
    const left = journal();
    const open = left.ingest({at: 1_000, level: 'warn', text: stall(NEW_LINE, 'the ladder is spent')});
    const folded = left.ingest({at: 5_000, level: 'warn', text: REBUILD});
    expect(folded.change, 'a line of the episode, never a record of its own').to.eq('fold');
    expect(folded.entry.id).to.eq(open.entry.id);
    const closed = left.closeOpenEpisodes()[0];
    expect(closed.episode).to.deep.include({state: 'unhealed', outcome: 'rebuilt'});
    expect(causeDims(closed.cause as NonNullable<typeof closed.cause>, closed.episode).outcome).to.eq('rebuilt');
    expect(closed.cause?.dims.by, 'the asker of the folded line is not the episode\'s').to.eq(undefined);
    // The page that comes: an episode its predecessor left OPEN (a document that died without its `pagehide`).
    const prior = journal();
    prior.ingest({at: 1_000, level: 'warn', text: stall(NEW_LINE, 'the ladder is spent')});
    prior.ingest({at: 5_000, level: 'warn', text: REBUILD});
    const next = new DiagJournal({runtime: 'page', session: 's2', build: '1.2.9'});
    next.adopt(prior.entries());
    expect(next.entries()[0].episode).to.deep.include({state: 'unhealed', outcome: 'rebuilt'});
    // …and a reload nobody asked the last line for stays a reload.
    const plain = journal();
    plain.ingest({at: 1_000, level: 'warn', text: stall(NEW_LINE)});
    expect(plain.closeOpenEpisodes()[0].episode?.outcome).to.eq('reload');
    // A refusal is a defect of its own class — and the switch that is OFF on purpose is not.
    expect(causeOf('[session-rebuild] refused (again) — «handPick» (card#12) stands unserved after the page was rebuilt for it — by liveness: the ladder is spent and the screen stood 16s', 'warn'))
      .to.deep.include({cls: 'session-rebuild/refused-again/handpick', tier: 'defect'});
    expect(causeOf('[session-rebuild] refused (rate) — «handPick» (card#12) stays as it stands: the window of rebuilds is full — by liveness: the ladder is spent', 'warn'))
      .to.deep.include({cls: 'session-rebuild/refused-rate', tier: 'defect'});
    expect(causeOf('[session-rebuild] refused (off) — «handPick» (card#12) stays as it stands: the last line is switched off (?rebuild=0) — by liveness: the ladder is spent', 'warn')?.tier).to.eq('info');
  });
});

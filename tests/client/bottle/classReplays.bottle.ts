/*
 * THE CLASSES, REPLAYED (FREEZE ZERO — docs/claude/console/freeze-zero/PLAN.md §4: every class closed gets a law, a
 * guard and a REPLAY). Each test here is one cause class the monkey or the field named, stood up in the bottle — the
 * real application against the real server, on the manual clock — by the presses that produced it, and held to the
 * property the fix established. Seconds each, no box, no chance: a class that comes back turns its replay red before
 * any monkey walks into it again.
 *
 * A replay asserts on the PRODUCT's own journal (`bottle.liveness().defects` — every defect-tier record by its cause
 * class) and on what the player has on screen (the frames, the command bar) — never on a net's wording.
 */
import {expect} from 'chai';
import {bootBottle, ConsoleBottle} from './consoleBottle';
import {bottleServer} from './bottleNode';
import {armFault, MonkeyStep, monkeyRng, monkeyWalk, replaySteps} from './monkeyWalk';
import {watchSurfaceEdges} from '@/client/console/supervisor/surfaceEdges';

describe('THE CLASSES, REPLAYED — each cause class of the worklist, in the bottle', function() {
  // A bottle boots a whole application; a budget for that, never a timing.
  // eslint-disable-next-line no-invalid-this
  this.timeout(600_000);
  let bottle: ConsoleBottle | undefined;

  afterEach(async () => {
    await bottle?.dispose();
    bottle = undefined;
  });

  const classes = (): Array<string> => (bottle?.liveness().defects ?? []).map((d) => d.cls);

  /*
   * `start-shadow/finding/disagree/firstaction/game` — the monkey's baseline, seed `fz0` · `hydro-terminal-surge`.
   * The first press of the walk was B on the start workspace standing on the corporation's first action: the player
   * MINIMIZES it («B Свернуть»), the frame leaves the stack and the board stands with the restore card. The shadow
   * of the start director read the missing frame as «the game on screen for the start's own question» and filed a
   * defect for a screen the player had asked for. The law: a question the player set aside is `parked`, whether or
   * not the start's frame is mounted (`startDirector.actualStartOwner`).
   */
  it('B on the corporation\'s first action is the player\'s own minimize: the restore card stands, nothing is filed, A returns', async () => {
    const table = await bottleServer().bootFixture('hydro-terminal-surge');
    bottle = await bootBottle(table);
    await bottle.advance(4_000);
    expect(bottle.frames(), 'the start workspace stands on the first action').to.deep.equal(['start:browse']);
    expect(bottle.bar(), 'B minimizes — the verb is on the bar').to.match(/Minimize/);

    expect(await bottle.press('Escape')).to.equal('consumed');
    // Past the shadow's own confirmation (3 s) and the arbiter's grace (10 s): whatever judges the screen has judged it.
    await bottle.advance(15_000);
    expect(bottle.frames(), 'the frame left with the minimize').to.deep.equal([]);
    expect(bottle.bar(), 'the way back is on screen').to.match(/Return to the decision/);
    expect(bottle.liveness().why, 'the player can act').to.deep.equal([]);
    expect(classes(), 'a screen the player asked for is nobody\'s finding').to.deep.equal([]);

    expect(await bottle.press('Enter')).to.equal('consumed');
    await bottle.advance(3_000);
    expect(bottle.frames(), 'A on the restore card brings the first action back').to.deep.equal(['start:browse']);
    expect(classes()).to.deep.equal([]);
  });

  /*
   * `start-shadow/finding/disagree/wizard/game` — THE FIELD's (a console export of 2026-11-14, release 1.2.3252; the
   * collector's issue behind CI finding #62; PLAN § 4b — «its own replay is owed»). A Turmoil Redux opening: the
   * player minimizes the start on its first question («B Свернуть»), opens the quick wheel and goes to the PARLIAMENT
   * to read the table before choosing a corporation. The start's frame is off the stack and `parliament:browse` is on
   * stage; the shadow of the start director read that as «the game on screen for the start's own question» and filed
   * a defect over a screen the player had walked to. The law is the first replay's, one question earlier: a question
   * the player set aside is `parked`, whatever screen they went to read meanwhile (`startDirector.actualStartOwner`).
   */
  it('the Parliament opened from the wheel over a minimized opening: the player went to read it — nothing is filed, and B, then A, bring the opening back', async () => {
    const table = bottleServer().bootNewGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true, preludeExtension: true}, '-wizard-parliament');
    bottle = await bootBottle(table);
    await bottle.advance(4_000);
    expect(bottle.liveness().asked, 'the opening\'s first question').to.equal('initialCards');
    expect(bottle.frames()).to.deep.equal(['start:browse']);

    expect(await bottle.press('Escape'), 'B minimizes the opening').to.equal('consumed');
    await bottle.advance(700);
    expect(bottle.frames()).to.deep.equal([]);
    expect(await bottle.press('Period'), 'the quick wheel').to.equal('consumed');
    await bottle.advance(700);
    expect([...document.querySelectorAll('.con-quick, [class*="wheel"]')].some((el) => /Parliament/.test(el.textContent ?? '')), 'the wheel offers the Parliament').to.equal(true);
    // (A direction of the wheel is its pick: ▼ opens the Parliament.)
    await bottle.press('ArrowDown');
    await bottle.advance(1_500);
    expect(bottle.frames(), 'the Parliament stands, the opening does not').to.deep.equal(['parliament:browse']);
    // Past the shadow's own confirmation (3 s), the start's stranded watch and the arbiter's grace (10 s).
    await bottle.advance(15_000);
    expect(bottle.frames()).to.deep.equal(['parliament:browse']);
    expect(classes().filter((cls) => cls.startsWith('start-shadow') || cls.startsWith('start-stranded')), 'a screen the player walked to is nobody\'s finding').to.deep.equal([]);
    expect(classes(), 'and nothing else is').to.deep.equal([]);

    // The way back: B leaves the Parliament, the restore card brings the opening's question.
    expect(await bottle.press('Escape')).to.equal('consumed');
    await bottle.advance(1_500);
    expect(bottle.bar(), 'the way back is on screen').to.match(/Return to selection/);
    expect(await bottle.press('Enter')).to.equal('consumed');
    await bottle.advance(3_000);
    expect(bottle.frames(), 'A on the restore card brings the opening back').to.deep.equal(['start:browse']);
    expect(classes()).to.deep.equal([]);
  });

  /*
   * `wait-graph/cycle/announce:parliament:genN/question:parliamentphase/surface:parliament` — the monkey's baseline,
   * seed `fz0` · `eden-alliance-enact-remote`. The other seat's pass is the last: the sitting reaches the viewer by
   * the poll and its PLATE «ПАРЛАМЕНТ · Заседание» is the door in. The walk did not press A on it — it opened the
   * Parliament from the quick wheel (RT → ▼). That stood a lateral Parliament BESIDE the door: the beat stayed held
   * behind the workspace that hid its plate, the question waited for the gate, the frame for its question — a dead
   * screen until the wait graph named the cycle and acknowledged the beat. The law: while a flow's plate stands,
   * every road into that flow's workspace IS the plate's door (`workspaceController.enterOrRestoreWorkspace`).
   */
  it('the sitting\'s plate stands and the Parliament is opened from the WHEEL: that press is the plate\'s door — no cycle for a net to cure', async () => {
    const table = await bottleServer().bootFixture('eden-alliance-enact-remote');
    bottle = await bootBottle(table);
    await bottle.advance(3_000);
    expect(await bottle.otherSeatMoves(1), 'the other seat passes — the last pass of the generation').to.equal('pass');
    const announced = await bottle.until(() => document.querySelectorAll('.con-mandatory').length > 0, 60_000);
    expect(announced, 'the sitting is announced: its plate stands on the board').to.equal(true);
    expect(bottle.frames(), 'nothing is open yet').to.deep.equal([]);

    // THE OTHER ROAD: RT (the quick wheel) → ▼ «Парламент» — never the plate's A.
    await bottle.press('Period');
    await bottle.advance(600);
    await bottle.press('ArrowDown');
    const opened = await bottle.until(() => bottle?.frames().some((f) => f.startsWith('parliament:')) === true, 20_000);
    expect(opened, `the Parliament opened (frames: ${bottle.frames().join(' ')})`).to.equal(true);
    // Past the graph's confirmation of a cycle and the arbiter's grace: whatever would have judged the screen has.
    await bottle.advance(20_000);
    expect(document.querySelectorAll('.con-mandatory').length, 'the plate is answered by that press').to.equal(0);
    expect(document.querySelectorAll('.con-parl[data-sitting-stage]').length, 'the Parliament that stands IS the sitting').to.equal(1);
    expect(classes().filter((cls) => !cls.startsWith('wait-graph/ceiling/') && !cls.startsWith('animation-hold/ceiling/')),
      'no cycle, no stranded question, no stall (the bottle has no layout: a ceiling of a wait for a rect is its own blind spot)').to.deep.equal([]);
  });

  /*
   * ...AND THE OTHER ORDER - the road the row above left to the net, found by a game of the owner's (the box,
   * 2026-11-18, generations 1 and 3): the Parliament is ALREADY OPEN, from the wheel, when the last pass of the
   * generation begins the political phase. The sitting's beat is born held inside its own workspace: nothing to open,
   * nowhere to show a plate - plate, surface, question, plate, until the graph's door acknowledged it seconds later.
   * The law: a flow's beat born while the flow's own workspace stands on stage is acknowledged at that edge
   * (`consoleMandatoryGate.flowBeatServedInPlace`).
   */
  it('the Parliament is ALREADY OPEN when the sitting begins: the beat is served in place at its birth - no plate, no cycle for a net to cure', async () => {
    const table = await bottleServer().bootFixture('eden-alliance-enact-remote');
    bottle = await bootBottle(table);
    await bottle.advance(3_000);
    // RT (the quick wheel), then down: the Parliament, as a view - the political phase has not begun.
    await bottle.press('Period');
    await bottle.advance(600);
    await bottle.press('ArrowDown');
    const opened = await bottle.until(() => bottle?.frames().some((f) => f.startsWith('parliament:')) === true, 20_000);
    expect(opened, `the Parliament opened as a view (frames: ${bottle.frames().join(' ')})`).to.equal(true);
    expect(document.querySelectorAll('.con-parl[data-sitting-stage]').length, 'no sitting yet').to.equal(0);
    await bottle.advance(1_500);
    expect(await bottle.otherSeatMoves(1), 'the other seat passes - the last pass of the generation').to.equal('pass');
    const sitting = await bottle.until(() => document.querySelectorAll('.con-parl[data-sitting-stage]').length === 1, 60_000);
    expect(sitting, `the Parliament that stands becomes the sitting (frames: ${bottle.frames().join(' ')})`).to.equal(true);
    // Past the graph's confirmation of a cycle and the arbiter's grace: whatever would have judged the screen has.
    await bottle.advance(20_000);
    expect(document.querySelectorAll('.con-mandatory').length, 'no plate was ever owed to a player who stands inside').to.equal(0);
    expect(bottle.lines().filter((line) => /\[wait-graph\] (cycle|cure)/.test(line)), 'the net had nothing to break').to.deep.equal([]);
    expect(classes().filter((cls) => !cls.startsWith('wait-graph/ceiling/') && !cls.startsWith('animation-hold/ceiling/')),
      'no cycle, no stranded question, no stall').to.deep.equal([]);
  });

  /*
   * …AND ONE LEVEL DEEPER — `wait-graph/dangling/deferred:n` in a real browser (the box's whole games, 2026-11-24 —
   * games 113 and 232; the pilot that walks to the question): the last pass found the player on the VOTE stage of a
   * Parliament they had walked into («A Отправить делегата»). The sitting's rise is taken from the browse layer
   * only — so the vote stage stayed, offering a delegate for a vote the server had closed, the sitting asking under
   * it and standing nowhere; B folded to an overview that offered «Открыть голосование», B again led to the board,
   * where the restore card came two seconds late, by the net's cure. The law: a vote that is not in the air ends with
   * the phase's start, and the browse layer of a Parliament in session is the sitting's — whichever edge brings it.
   */
  it('the sitting begins while the player stands on the VOTE stage of a Parliament they walked into: the stage folds, the sitting stands - no dead vote, nothing for a net to cure', async () => {
    const table = await bottleServer().bootFixture('eden-alliance-enact-remote');
    bottle = await bootBottle(table);
    const live = bottle;
    await live.advance(3_000);
    await live.press('Period');
    await live.advance(600);
    await live.press('ArrowDown');
    const opened = await live.until(() => live.frames().some((f) => f.startsWith('parliament:')), 20_000);
    expect(opened, `the Parliament opened as a view (frames: ${live.frames().join(' ')})`).to.equal(true);
    await live.advance(1_500);
    // A on the overview: the vote stage - a delegate may be sent while the generation runs.
    await live.press('Enter');
    await live.advance(1_500);
    expect(live.frames(), 'the vote stage stands').to.deep.equal(['parliament:configure']);
    expect(live.bar()).to.match(/Send the delegate/);
    expect(await live.otherSeatMoves(1), 'the other seat passes - the last pass of the generation').to.equal('pass');
    const sitting = await live.until(() => document.querySelectorAll('.con-parl[data-sitting-stage]').length === 1, 60_000);
    expect(sitting, `the vote stage folds and the sitting takes the stage (frames: ${live.frames().join(' ')} · bar «${live.bar()}»)`).to.equal(true);
    // Past the graph's confirmation and the arbiter's grace: whatever would have judged the screen has.
    await live.advance(20_000);
    expect(live.bar(), 'no verb of a vote that is over').to.not.match(/Send the delegate|Open the vote/);
    expect(document.querySelectorAll('.con-mandatory').length, 'no plate was owed to a player who stands inside').to.equal(0);
    expect(live.lines().filter((line) => /\[wait-graph\] (cycle|cure|dangling)/.test(line)), 'the net had nothing to break').to.deep.equal([]);
    expect(classes().filter((cls) => !cls.startsWith('wait-graph/ceiling/') && !cls.startsWith('animation-hold/ceiling/')),
      'no cycle, no stranded question, no stall').to.deep.equal([]);
  });

  /*
   * `animation-hold/ceiling/parliament-chairman-quest` — the monkey's baseline, seed `fz0` ·
   * `parliament-chairman-quest-last-action`. The plate's A opens the Parliament on the chairman's quest and the answer
   * rides that press; the walk pressed A AGAIN 0.9 s later — «дожать» with the answer still on the wire. The hurry
   * killed the reading's own timer and ran nothing in its place (`answered` was false), so when the answer came the
   * flow found its reading «not done» for ever: two blocking holds, the bar reading «Выполняется», until the 20 s
   * ceiling settled the chairmanship without its beats. Bisected HERE in 16 s (A alone: done in 2 s; A + ▼ / B / X:
   * done; A + A: the ceiling). The law: a cut step is never dropped — whoever kills a scheduled beat applies its
   * effect (`chairmanQuestDirector.finishChairmanQuestBeats`).
   */
  it('a second A inside the round trip of the chairman\'s quest: the chairmanship still plays to its end — no hold left for the ceiling', async () => {
    const table = await bottleServer().bootFixture('parliament-chairman-quest-last-action');
    bottle = await bootBottle(table);
    await bottle.advance(4_000);
    expect(bottle.bar(), 'the quest is announced: its plate stands').to.match(/Open the Parliament/);
    const beat = (): string => document.querySelector('.con-parl')?.getAttribute('data-quest-beat') ?? '(no parliament)';

    expect(await bottle.press('Enter')).to.equal('consumed');
    await bottle.advance(930);
    expect(bottle.frames(), 'the Parliament stands on the quest').to.deep.equal(['parliament:committed']);
    expect(await bottle.press('Enter'), 'the second A — 0.9 s in').to.equal('consumed');
    const done = await bottle.until(() => beat() === 'done', 8_000, 250);
    expect(done, `the chairmanship reached its end by itself (beat: ${beat()}, holds: ${JSON.stringify(bottle.ready().holds)})`).to.equal(true);
    // Past the ceiling the flow's hold used to reach: nothing is left for it to cut.
    await bottle.advance(22_000);
    expect(bottle.ready().holds.filter((hold) => hold.startsWith('parliament-chairman-quest')), 'the flow\'s hold is released').to.deep.equal([]);
    expect(classes(), 'no hold outlived its ceiling').to.deep.equal([]);
    expect(bottle.bar(), 'the finished chairmanship is the player\'s to close').to.match(/Close/);
  });

  /*
   * `wait-graph/ceiling/scale-step-rating:stage` · `wait-graph/ceiling/card-reaction:rating-story-quiet` — the monkey
   * in the bottle, seed `fz0` · `terraforming-deal-start-nodraw`, confirmed by the box monkey's spec in a real browser.
   * A prelude played inside the START workspace steps a scale; the step's rating is told on the board — which the
   * player keeps covered by the start workspace for as long as they read. The story is OWED, bounded by its due, and
   * at the due the rating is applied untold: the board's own bounded, ledgered story, and the ledger's line said so
   * (`planned`). The wait graph's two lines of the SAME incident were filed as DEFECTS — noise under a class's name,
   * an event of the quota for the player's own reading time. The law: a ceiling says WHY it was the wait's honest end
   * at the moment it comes (`CeilingWait.ceiling(planned)`, read from the rating's own beat —
   * `scaleStepRatingStageCovered`); with the board in plain view the same ceiling is still a defect.
   * …AND ONE DUE (the row's second half): the card that ANSWERS the rating had a clock of its own — 12 s — and ran out
   * twenty seconds before the rating it answers was applied: it paid first. Its clock no longer runs while the
   * rating's stage is covered (`ratingTouchdownStep`): the wait is the story's, the story's due ends both, and the
   * reactor's own ceiling is not reached at all — it stays what it was meant to be, a defect on a stage in plain view.
   * (The walk is the monkey's own, by its seed — `monkeyWalk.ts`.)
   */
  it('a scale step\'s rating owed under the start workspace: the story ends as PLANNED at its due — and the card that answers it waits with it', async () => {
    const table = await bottleServer().bootFixture('terraforming-deal-start-nodraw');
    bottle = await bootBottle(table);
    await bottle.advance(3_000);
    bottle = (await monkeyWalk(bottle, table.seats.length, 'fz0:terraforming-deal-start-nodraw', 60)).bottle;
    await bottle.advance(14_000);
    const waits = bottle.journal().filter((entry) => (entry.cause?.cls ?? '').startsWith('wait-graph/ceiling/scale-step-rating') ||
      (entry.cause?.cls ?? '').startsWith('wait-graph/ceiling/card-reaction:rating-story'));
    expect(waits.map((entry) => entry.cause?.cls), 'the walk reaches the wait; ONE ceiling — the story\'s own, at its due')
      .to.deep.equal(['wait-graph/ceiling/scale-step-rating:stage']);
    expect(waits.map((entry) => entry.cause?.tier), 'the player kept the board covered: an honest end, said by the line').to.deep.equal(['planned']);
    expect(waits.every((entry) => /\(planned: .*the player keeps the board covered/.test(entry.text)), 'the reason is in the line').to.equal(true);
    // The reactor waited WITH the story (no ceiling of its own, neither under its old name nor its new one) and is
    // not left waiting: the due that ended the story ended its wait.
    const graph = (window as unknown as {__conWaitGraph?: () => {nodes: Array<{id: string}>}}).__conWaitGraph?.();
    expect(graph, 'the wait graph\'s probe answers').to.not.equal(undefined);
    expect((graph?.nodes ?? []).map((node) => node.id).filter((id) => id.includes('card-reaction:rating-story')), 'no reactor wait is left standing').to.deep.equal([]);
    expect(classes(), 'nothing of this walk is a defect').to.deep.equal([]);
  });

  /*
   * `presentation-ledger/witness-heal/view-freshness` — THE FIELD (the owner's console exports: 51 lines in 14 of 47,
   * 2026-09-12 … 2026-11-09; never walked into by the monkey — it takes another seat's move on the socket while a
   * scene of the viewer's plays). The transport's freshness witness heals «the applied view is behind the server's
   * cursor» after 3 s. But the commonest reason a view is behind is honest and OWNED: the poll fetched the newer view
   * while a scene was playing, the root refused to commit it over the scene and PARKED the refresh
   * (`deferredViewRefresh.ts` — re-run on the release edge, bounded by its own ceiling). The witness did not know:
   * every 3 s of a tile's flight it «healed» (one more fetch, refused and parked again) and printed a defect line.
   * The law: a debt that has an owner is not a lie (`viewFreshness.viewLagIsALie`).
   * (The bottle has no socket: the socket's word — the cursor it advertises — is set by hand; the park is armed the
   * way the root arms it. The witness, the ledger, the transport and the journal are the application's own.)
   */
  it('a view parked behind a live scene is a debt with an owner — the freshness witness heals only the lag NOBODY holds', async () => {
    const table = await bottleServer().bootFixture('aerial-mappers');
    bottle = await bootBottle(table);
    await bottle.advance(3_000);
    // THE PAGE'S OWN MODULES. A bottle's page is evaluated anew (`consoleBottle.ts` § a pristine page): what this file
    // imports statically is the suite's instance, never the page's — so the page's are asked for while it stands.
    const {realtimeState} = bottle.pageModules.realtimeService;
    const {tradeFleetState} = bottle.pageModules.consoleTradeFleet;
    const park = bottle.pageModules.deferredViewRefresh;
    const heals = () => (bottle?.journal() ?? []).filter((entry) => entry.cause?.cls === 'presentation-ledger/witness-heal/view-freshness');
    // A SCENE OF THE VIEWER'S PLAYS (its flag, raised by hand — one of the nine the root refuses a refresh behind)…
    tradeFleetState.active = true;
    // …and THE SOCKET SAYS the server went one step ahead of the view the page applied.
    realtimeState.lastInvalidationGameAge = (bottle.view()?.game.gameAge ?? 0) + 1;
    // (Six seconds: twice the witness's grace, and inside the scene's own life — a flag raised by hand ends on the
    // scene's own safety a little later.)
    await bottle.advance(6_000);
    // The poll saw it, the root fetched the newer view, refused to commit it over the scene and PARKED the refresh —
    // by its own road, with its words. That debt has an owner: nobody is lied to, nothing is healed.
    expect(park.deferredViewRefreshParked()?.why, 'the root parked the refresh itself, naming the scene').to.equal('trade-fleet');
    expect(heals().map((entry) => entry.text), 'six seconds behind a live scene, twice the grace: not one heal').to.deep.equal([]);
    // THE SCENE ENDS: the park re-runs the refresh on that edge and is gone. The view is STILL behind the socket's word
    // (the bottle's server never moved) — a lag nobody holds: that IS the lie, healed and said with what it is made of.
    tradeFleetState.active = false;
    await bottle.advance(6_000);
    expect(park.deferredViewRefreshParked(), 'the park is paid').to.equal(undefined);
    expect(heals().length, 'a lag nobody holds is healed').to.be.greaterThan(0);
    expect(heals()[0].text, 'and the line says what it is behind by').to.match(/"behind":"age \+1 \(undo \+0\)"/);
  });

  /*
   * A FINISHED FRAME OVER THE FREE TURN — what was the class `workspace-stale/concluded/<kind>` (the owner's field
   * locks of 2026-11-07; the Parliament's of 11-06; the unexplained 01:06): a frame PAST ITS COMMIT left standing over
   * the player's free turn — nothing owed inside it, nothing in flight, the flow that should have ended it gone. The
   * player looked at a finished workspace for eight seconds, until the supervisor's reaper concluded it and named a
   * defect. The law (stage 2 — the conclusion's level door, `staleFreeTurnClock.observeConclusionDoor`): that ending
   * is its owner's decision BY LEVEL — the candidate, the guarded conclusion's `dismiss`, no look the player reads,
   * nothing in flight, for the door's frames — so the frame leaves a quarter of a second in, through the one guarded
   * conclusion. (The reaper itself is gone since 2026-11-23: this replay is what stands in its place. The class is
   * planted the way it arises: a frame's phase written past its commit with no claim, no step and no question of its
   * own — every flow that ever «forgot» its ending left exactly that.)
   */
  it('a finished frame left standing over the free turn leaves BY LEVEL — in frames, never after seconds of a dead screen; nothing is filed', async () => {
    const table = await bottleServer().bootFixture('aerial-mappers');
    bottle = await bootBottle(table);
    const live = bottle;
    await live.advance(3_000);
    const stack = live.pageModules.consoleWorkspaceStack;
    const doorLines = () => live.lines().filter((line) => line.includes('[workspace-conclusion]') && line.includes('left by the level door'));
    // The quick wheel's «Рука» over the board: a workspace the player opened, standing in `browse`.
    await live.press('Period');
    await live.advance(250);
    await live.press('Enter');
    await live.advance(800);
    expect(live.frames(), 'the hand is open').to.deep.equal(['hand:browse']);
    // A REVERSIBLE frame is the player's own time: however long it stands, the door has nothing to decide.
    await live.advance(3_000);
    expect(live.frames(), 'a browse frame is never a candidate').to.deep.equal(['hand:browse']);
    expect(doorLines()).to.deep.equal([]);
    if (live.view()?.waitingFor?.type !== 'or') {
      // (The fixture's own first question is not the free turn: the door's candidate needs it — said, never assumed.)
      expect.fail(`the table does not stand on the free turn (asked: ${live.view()?.waitingFor?.type ?? 'nothing'})`);
    }
    // THE CLASS, PLANTED: the frame is past its commit and nobody is left to end it.
    stack.setWorkspaceFramePhase('hand', 'committed');
    await live.advance(100);
    expect(live.frames(), 'inside the door\'s quiet the frame still stands').to.deep.equal(['hand:committed']);
    await live.advance(900);
    expect(live.frames(), 'the door\'s frames of quiet have passed: the frame left — a second in, not eight').to.deep.equal([]);
    expect(doorLines().length, 'said once, as the trail of which flow left its ending to the level').to.equal(1);
    expect(doorLines()[0]).to.match(/«hand» left by the level door — finished over the free turn and quiet for \d+ frames \/ \d+ ms \(frames: hand:committed\)$/);
    // Past the arbiter's grace: it had nothing to do — and the door said its line ONCE.
    await live.advance(12_000);
    expect(doorLines().length, 'the door does not open twice').to.equal(1);
    expect(live.liveness().why, 'the player can act').to.deep.equal([]);
    expect(classes(), 'the door\'s act is no defect').to.deep.equal([]);
  });

  /*
   * `workspace-outcome/claim-released-free-turn/<kind>` — what was THE REAPER's OTHER CURE (the field export of
   * 2026-11-09: «hand» stood committed over the free turn, held by `live-outcome`): a frame held by its own CLAIM
   * alone, with no batch to take and nothing moving — a claim that answers for nothing. The reaper (gone since
   * 2026-11-23) let it go after eight seconds of a dead screen. By level (`outcomeController.lookAtConclusionDoor` —
   * the claim door): quiet for the door's bar,
   * the claim is reconciled, let go if it still stands, and the frame concludes. (Planted the way it arises: a claim
   * of the hand's past its answer, presenting, with no reveal behind it — a batch that never came.)
   */
  it('a frame held by a claim that answers for nothing is let go BY LEVEL — the claim released, the frame gone, a second in', async () => {
    const table = await bottleServer().bootFixture('aerial-mappers');
    bottle = await bootBottle(table);
    const live = bottle;
    await live.advance(3_000);
    const stack = live.pageModules.consoleWorkspaceStack;
    const outcome = live.pageModules.consoleWorkspaceOutcome;
    await live.press('Period');
    await live.advance(250);
    await live.press('Enter');
    await live.advance(800);
    expect(live.frames(), 'the hand is open').to.deep.equal(['hand:browse']);
    // THE CLASS, PLANTED: the hand's play claimed a drawn batch, the answer came, the stage «presents» — and no batch
    // ever stood behind it. The frame is past its commit; the claim is all that holds it.
    outcome.claimWorkspaceOutcome('hand', 'Research', ['draw']);
    outcome.markWorkspaceOutcomeAnswerIn();
    outcome.markWorkspaceOutcomePresenting();
    stack.setWorkspaceFramePhase('hand', 'committed');
    await live.advance(100);
    expect(live.frames(), 'inside the door\'s quiet the frame still stands — held by its claim').to.deep.equal(['hand:committed']);
    expect(outcome.workspaceOutcomeClaimed(), 'the claim stands').to.equal(true);
    await live.advance(1_400);
    expect(outcome.workspaceOutcomeClaimed(), 'the claim that answered for nothing is let go').to.equal(false);
    expect(live.frames(), '…and the frame it held left — a second or so in, not eight').to.deep.equal([]);
    // Long past it: nothing else has anything to say.
    await live.advance(12_000);
    // The planted defect has ONE line — the door's own, said once: which claim it let go, and how soon.
    expect(classes(), 'the release is the planted defect — one class, its own').to.deep.equal(['workspace-outcome/claim-released-free-turn/hand']);
    const released = live.lines().filter((line) => line.includes('answered for nothing over the free turn')).map((line) => line.replace(/^warn: /, ''));
    expect(released, 'said once').to.have.length(1);
    expect(released[0]).to.match(/^\[workspace-outcome\] the claim of «hand» answered for nothing over the free turn, quiet for \d+ frames \/ \d+ ms — released by the level door$/);
  });

  /*
   * `start-stranded/confirmed` · `start-stranded/yielded` — THE WATCHDOG's CLASS (the reliability iteration of
   * 2026-10-28: Strategic Base Planning → a colony on Triton → the scene stood blank while the server waited for the
   * prelude's city). A start scene that serves NOTHING under a live question was confirmed on a timer — 2.5 s, the
   * heal, another 2.5 s, the yield: five seconds of an empty opening before the question reached a surface. The law
   * (stage 2b — the doors by level, `levelDoor.ts`): the cure is executed the moment the state stands quiet. For a
   * scene that plainly serves nothing the OPENING's door is the ONE door — the start director reads «the first action,
   * nobody serving it» and heals; the scene's doors open nothing, so it yields, in the same opening — and the
   * STRAND's door (the watchdog's own predicate: it also reads a step left standing for a question it does not
   * answer, which the director does not) does not stand for a state the director's door owns: one state — one door,
   * both on the family's bar (twelve frames and a quarter of a second). The watchdog's two
   * timers and the shadow's confirm that stood behind both are RETIRED (stage 2b → 7). (The class is planted the way
   * it arises: the scene's own answer reads `none` — its mirror, written by hand, with the stage the scene really
   * has still standing under it.)
   */
  it('a start scene that serves nothing hands its question over BY LEVEL — a fraction of a second, never the watchdog\'s five; ONE cure, said once, the defect\'s own line', async () => {
    const table = await bottleServer().bootFixture('hydro-terminal-surge');
    bottle = await bootBottle(table);
    const live = bottle;
    await live.advance(4_000);
    expect(live.frames(), 'the start workspace stands on the first action').to.deep.equal(['start:browse']);
    const said = (marker: string) => live.lines().filter((line) => line.includes(marker));
    expect([...said('[start-stranded]'), ...said('[start-shadow]')], 'a healthy opening: nothing is cured').to.deep.equal([]);
    // THE CLASS, PLANTED: the scene answers «I serve nothing» while the server asks the first action.
    const start = live.pageModules.consoleStartState.consoleStartState;
    start.serves = 'none';
    await live.advance(50);
    expect(said('[start-shadow] cure'), 'inside the door\'s quiet nothing acts').to.deep.equal([]);
    await live.advance(450);
    // Half a second in: the director's cure, by level — the heal found no door of the scene's to open, and yielded.
    expect(said('[start-shadow] cure').length, 'ONE cure').to.equal(1);
    expect(said('[start-shadow] cure')[0]).to.match(/\[start-shadow\] cure «heal» by level — expected «firstAction», on screen «none»: nothing-to-heal → yielded$/);
    // Past the bar twice over — and past where the watchdog's timers used to come (2.5 s + 2.5 s): the strand's door
    // never stood for the director's state, and the director does not cure twice.
    // (What the plant leaves behind — a scene whose mirror lies about a stage that really stands — is the arbiter's
    // to judge; this replay holds the DOORS: who acts first, how soon, and that the cure is said once.)
    await live.advance(6_000);
    expect(said('[start-shadow] cure').length, 'no second cure').to.equal(1);
    expect(said('[start-shadow]').length, 'and no other word of the director — the confirm\'s finding is retired').to.equal(1);
    expect(said('[start-stranded]'), 'the door of the strand does not act on a state the door of the director owns').to.deep.equal([]);
    expect(classes().filter((cls) => cls.startsWith('start-shadow/')), 'the cure by level is the planted defect\'s own line').to.deep.equal(['start-shadow/cure/heal/firstaction/none']);
  });

  /*
   * `screen-shadow/finding/misserved/board/hand` — the monkey in the bottle's SECOND seed (`fz1` ·
   * `parliament-skyscrapers-enact`, `parliament-biodome-enact`), confirmed in a real browser by the box monkey's spec
   * with the same seed, and cut down by the shrink from 65 steps to three: A (the placement's plate) · RT (the wheel)
   * · A (its «Рука»). The wheels keep working while a cell is picked — the player looks at the hand before placing —
   * and the hand then has the pad by the router's own rule (a section is asked before the placement). TWO readers did
   * not know that rule: the COMMAND BAR stayed the placement's («Размещение тайла · A Выбрать клетку» over an open
   * hand, where A acts in the hand), and the SCREEN SHADOW filed «expected board, on screen hand» — a defect event
   * for a look at one's own cards. The law: the placement owns the bar only while the pad is on the board
   * (`commandBarController.placementOwnsBar`), and the player's own reversible surface over a placement is a hold of
   * theirs (`ScreenShadowContext.lateral`) — B is one press back to the cells.
   */
  /*
   * `start-shadow/cure/release/game/none` — THE SECOND SEAT's STRAND (the box's duo pass on two heads, CI's `fz3` ·
   * duo · `parliament` four walks of four — run 45156087552). A start frame stood past its commit over the game's
   * menu, serving nothing, and the strand's own word said why: «stands by NOTHING» — not one term of
   * `startSceneServes` / `startFrameLive` held it. Its leave was an EDGE only (`startFrameLive` falling closes the
   * frame); a frame that comes onto the live stack AFTER that edge met none, and stood until the opening's door
   * released it and named a defect (before the doors: the shadow's three seconds). The law: the frame leaves BY
   * LEVEL — a start frame that APPEARS on the live stack while the start is not live is closed at once
   * (`startController`). (The class is planted the way it stood: the frame put on the stack of a table whose opening
   * is long over.)
   */
  it('a start frame that appears on the stack while the start is NOT live is closed at once — no door has anything to cure', async () => {
    const table = await bottleServer().bootFixture('aerial-mappers');
    bottle = await bootBottle(table);
    const live = bottle;
    await live.advance(3_000);
    expect(live.frames(), 'the board home of a game long past its opening').to.deep.equal([]);
    const said = (marker: string) => live.lines().filter((line) => line.includes(marker));
    // THE CLASS, PLANTED: the opening's frame on the live stack with nothing of the start live.
    live.pageModules.consoleWorkspaceStack.enterWorkspace('start', {anchor: {type: 'phase', phase: 'start'}});
    expect(live.frames(), 'it stands for the flush it was put in').to.deep.equal(['start:browse']);
    await live.advance(50);
    expect(live.frames(), 'closed by the frame\'s own reaction — a frame, never the door\'s quarter of a second').to.deep.equal([]);
    // Past the opening's door, the strand's door and where the shadow's confirm used to come: nobody had a strand.
    await live.advance(4_000);
    expect(live.frames()).to.deep.equal([]);
    expect([...said('[start-shadow]'), ...said('[start-stranded]')], 'no cure, no finding').to.deep.equal([]);
    expect(classes().filter((cls) => cls.startsWith('start-')), 'nothing of the start is filed').to.deep.equal([]);
  });

  /*
   * THE STRAND's DOOR ON ITS OWN CASE (`startServing.hostedStepServes` — «a strand dressed as a step», the field hang
   * of 2026-10-28: a colony grid left standing after its build while the server asked the prelude's city). The scene
   * reads `step`, the start DIRECTOR therefore reads «a step is on» and has no cure — the one case the opening's door
   * does not own. The strand's own door does, by level: quiet for the bar → the heal; the scene's doors open nothing,
   * so, quiet for the bar again → the yield, and the question reaches the shell's surfaces. Half a second, where the
   * watchdog's two timers took five; each verb said once, the director silent. (Planted the way it stands: a step
   * nested in the start that serves nothing of the live question, the start's own frame not serving it either.)
   */
  it('a hosted step left standing for a question it does not answer: the strand\'s door heals, then yields — by level, each once; the director has no word', async () => {
    const table = await bottleServer().bootFixture('hydro-terminal-surge');
    bottle = await bootBottle(table);
    const live = bottle;
    await live.advance(4_000);
    const stack = live.pageModules.consoleWorkspaceStack;
    const start = live.pageModules.consoleStartState.consoleStartState;
    const said = (marker: string) => live.lines().filter((line) => line.includes(marker));
    expect(live.frames(), 'the start stands on the first action').to.deep.equal(['start:browse']);
    expect([...said('[start-stranded]'), ...said('[start-shadow]')], 'a healthy opening').to.deep.equal([]);
    // THE CLASS, PLANTED.
    stack.workspaceStackState.frames[0].serves = [];
    stack.pushWorkspaceFrame({kind: 'colonies', phase: 'committed', serves: [], anchor: {type: 'prompt'}} as unknown as Parameters<typeof stack.pushWorkspaceFrame>[0]);
    await live.advance(100);
    expect(live.frames()).to.deep.equal(['start:browse', 'colonies:committed']);
    expect(start.serves, 'the scene says «a step is on»').to.equal('step');
    expect(said('[start-stranded]'), 'inside the door\'s quiet nothing acts').to.deep.equal([]);
    // The first bar: the heal — and it is the LEVEL's.
    await live.advance(300);
    expect(said('[start-stranded] confirmed').length, 'ONE heal').to.equal(1);
    expect(said('[start-stranded] confirmed')[0]).to.contain('"by":"level"');
    // The second bar: still a strand, still quiet — the yield.
    await live.advance(400);
    expect(said('[start-stranded] yielded to the shell').length, 'ONE yield').to.equal(1);
    expect(said('[start-stranded] yielded to the shell')[0]).to.contain('"by":"level"');
    expect(start.serves, 'the scene stands aside for the shell\'s surfaces').to.equal('yielded');
    // Past where the watchdog's timers used to come (2.5 s + 2.5 s): each verb ran once, and the director — who reads
    // «a step» there — never had a cure to say.
    await live.advance(6_000);
    expect(said('[start-stranded]').length, 'two lines, no more').to.equal(2);
    expect(said('[start-shadow]'), 'not the opening\'s door\'s state').to.deep.equal([]);
  });

  /*
   * `workspace-stall/ghost-forced` UNDER A DECISION THE PLAYER IS LOOKING AT — found by the OWED track's first reading
   * in a real browser (CI run 45201555664: `owed|hand · q:choice · held:live-outcome · ghost`, nothing in flight, for
   * exactly as long as the spec took to press). «WG Project» played from the hand deals three preludes; «Project
   * Eden» is taken and played, and its «which tile next» teleports into the HAND's zone (P58 · FS). The hand's
   * conclusion is owed, the claim holds it — and nothing said the claim was SERVING that step: the ghost test read
   * the hand a phantom while the player thought, and the escalation tore the workspace down under the decision
   * («reported finished but could not dismiss for 11s with nothing served — forcing teardown»); the step fell out of
   * the hand into a band of its own. A player needs about three seconds of thought for it — every real play. The
   * law: a prelude chain's step standing in the claim host's zone is the claim's served prompt
   * (`outcomeController.workspaceOutcomePromptServed`).
   */
  it('a prelude\'s «which tile next» in the hand\'s zone: the player thinks as long as they like — the hand is no ghost, nothing is torn down', async () => {
    const table = await bottleServer().bootFixture('project-eden-wg');
    bottle = await bootBottle(table);
    const live = bottle;
    const doc = (): Document => (globalThis as unknown as {window: {document: Document}}).window.document;
    const attr = (sel: string, name: string): string => doc().querySelector(sel)?.getAttribute(name) ?? '';
    const count = (sel: string): number => doc().querySelectorAll(sel).length;
    await live.advance(4_000);
    // The hand, from the quick wheel (its entry has no layout to ride here — it takes its bounded time).
    await live.press('Period');
    await live.advance(400);
    await live.press('Enter');
    await live.advance(12_000);
    expect(live.frames()).to.deep.equal(['hand:browse']);
    const focusedInHand = (): string => attr('.con-hand .con-hand__slot--selected[data-zoom-slot]', 'data-zoom-slot');
    for (let i = 0; i < 14 && focusedInHand() !== 'WG Project'; i++) {
      await live.press('ArrowRight');
      await live.advance(300);
    }
    expect(focusedInHand(), 'the cursor is on the card').to.equal('WG Project');
    await live.press('Enter');
    await live.advance(1_500);
    expect(count('.con-composer--play'), 'the play sheet').to.equal(1);
    await live.press('Enter');
    await live.advance(7_500);
    expect(count('.con-deckpick'), 'the pick of three preludes stands in the hand').to.equal(1);
    const focusedInPick = (): string => attr('.con-deckpick .con-cards__slot--focused', 'data-deckpick-slot');
    for (let i = 0; i < 12 && focusedInPick() !== 'Project Eden'; i++) {
      await live.press('ArrowRight');
      await live.advance(300);
    }
    expect(focusedInPick()).to.equal('Project Eden');
    await live.press('Enter');
    await live.advance(600);
    await live.press('Period');
    await live.advance(8_000);
    const stepInHand = '.con-hand [data-prelude-variant-kind="placement-order"]';
    expect(count(stepInHand), 'the order step stands in the hand\'s zone').to.equal(1);
    expect(live.frames()).to.deep.equal(['hand:committed']);
    // THE PLAYER THINKS — well past the escalation (eight seconds owed, two and a half read a ghost).
    await live.advance(20_000);
    expect(live.lines().filter((line) => line.includes('[workspace-stall]')), 'nothing is torn down under the decision').to.deep.equal([]);
    expect(live.frames(), 'the hand stands').to.deep.equal(['hand:committed']);
    expect(count(stepInHand), '…and the step is where the player was reading it').to.equal(1);
    expect(classes().filter((cls) => cls.startsWith('workspace-')), 'nothing is filed').to.deep.equal([]);
  });

  it('the hand opened from the wheel over a live placement: the bar is the hand\'s, nothing is filed, B is back at the cells', async () => {
    const table = await bottleServer().bootFixture('parliament-skyscrapers-enact');
    bottle = await bootBottle(table);
    await bottle.advance(3_000);
    await bottle.press('Enter');
    await bottle.advance(400);
    expect(bottle.bar(), 'the placement stands: the bar is its own').to.match(/^Tile placement.*Select cell/);
    await bottle.press('Period');
    await bottle.advance(250);
    await bottle.press('Enter');
    await bottle.advance(800);
    expect(bottle.frames(), 'the hand is open over the cells').to.deep.equal(['hand:browse']);
    expect(bottle.bar(), 'the pad is the hand\'s — the bar says what the pad does, never a cell').to.not.match(/Tile placement|Select cell/);
    expect(bottle.bar(), '…the hand\'s own verbs, and B names the way back').to.match(/^Hand.*To the board$/);
    await bottle.advance(8_000);
    expect(classes(), 'a look at one\'s own hand while placing is nobody\'s defect').to.deep.equal([]);
    await bottle.press('Escape');
    await bottle.advance(1_500);
    expect(bottle.frames(), 'B: one level back').to.deep.equal([]);
    expect(bottle.bar(), '…at the cells, with the placement\'s own verbs').to.match(/^Tile placement.*Select cell/);
  });

  /*
   * `screen-shadow/finding/unserved/task/nothing` (blind: announce-gate) — the monkey in the bottle's second seed
   * (`fz1 · two-player-finale-trigger`), reproduced in a real browser, cut down by the shrink to four presses:
   * → · X («Разыграно», 0.8 s) · B · LT (the wheel, held). The decision's plate stands on the board; each of the
   * player's own surfaces covers it, and the chip's beacon takes over after its dwell (1.2 s — so a plate covered
   * for a moment never flashes amber). The screen shadow judged «the announce is BLIND» by three of its 1 Hz looks —
   * and three looks are not three seconds: two covers inside the dwell with 0.6 s of plate between them, which no
   * look fell into, read as «no form for three passes». A defect event, and a «cure» that forced a beacon 0.4 s
   * from lighting by itself. The law: blindness is measured on the ANNOUNCE's own clock — how long the plate has
   * been gone continuously, stamped on the reactive edge (`consoleMandatoryGate.announceIsBlind`).
   */
  it('the plate covered twice inside the beacon\'s dwell — «Разыграно», B, the LT wheel: the announce changes form, nothing is filed, nothing is forced', async () => {
    const table = await bottleServer().bootFixture('two-player-finale-trigger');
    bottle = await bootBottle(table);
    await bottle.advance(3_000);
    const steps: ReadonlyArray<MonkeyStep> = [
      {do: 'press', key: 'ArrowRight', pauseMs: 322}, {do: 'press', key: 'KeyX', pauseMs: 843},
      {do: 'press', key: 'Escape', pauseMs: 649}, {do: 'press', key: 'Comma', pauseMs: 6_582},
    ];
    bottle = await replaySteps(bottle, table.seats.length, steps);
    const shadow = bottle.journal().filter((entry) => entry.text.startsWith('[screen-shadow]')).map((entry) => entry.text.slice(0, 160));
    expect(shadow, 'no finding, and no cure by the shadow').to.deep.equal([]);
    expect(classes(), 'flicking between one\'s own surfaces is nobody\'s defect').to.deep.equal([]);
    // The wheel has stood six seconds over the plate: the beacon carries the decision — by its own dwell.
    expect(document.querySelector('.con-status__beacon'), 'the chip\'s beacon is lit under the wheel').to.not.equal(null);
    await bottle.press('Escape');
    await bottle.advance(1_500);
    expect(document.querySelector('.con-mandatory'), 'B: the plate is back on the board').to.not.equal(null);
  });

  /*
   * THE VIEW THAT NEVER ARRIVED (1) — a scene flag that never releases (`deferred-refresh/overruled/<scene>`).
   * Not walked into by a monkey: audited in the code (2026-11-15 — every one of the nine scene flags the root parks
   * a view behind can stay raised: an end skipped by a throw, a recovery that threw before it lowered the flag). The
   * poll brings the player's question, the root fetches the view, refuses to commit it over the «scene» and parks —
   * and at the park's ceiling its own guard parked it AGAIN, for ever: the page stood on «the other seat's turn», a
   * healthy accepting screen, while the server waited for this player. The law: a scene may hold the view only
   * within a scene's own legal life (`deferredViewRefresh.VIEW_SCENE_HOLD_MAX_MS`) — past it the view is committed
   * over the flag, the flag is named, and it holds the view no longer.
   *
   * (The flag is made to stay raised the way a recovery that throws leaves it: every write of `false` is refused.)
   */
  it('a scene flag that NEVER releases while the server asks: the view is committed over it at the bound — the question is served, nothing is rebuilt', async () => {
    const table = await bottleServer().bootFixture('eden-alliance-enact-remote');
    bottle = await bootBottle(table);
    await bottle.advance(3_000);
    const {tradeFleetState} = bottle.pageModules.consoleTradeFleet;
    const {toRaw} = bottle.pageModules.vue;
    Object.defineProperty(toRaw(tradeFleetState), 'active', {configurable: true, get: () => true, set() {/* every write is refused */}});
    try {
      expect(tradeFleetState.active, 'the flag stands, and nothing lowers it').to.equal(true);
      tradeFleetState.active = false;
      expect(tradeFleetState.active).to.equal(true);

      expect(await bottle.otherSeatMoves(1), 'the other seat passes — the server now asks THIS player').to.equal('pass');
      // Twenty seconds in: the poll said so long ago, and the view is still parked behind the flag — as it lawfully may be.
      await bottle.advance(20_000);
      expect(bottle.view()?.waitingFor, 'the view is parked: the page still knows nothing of its question').to.equal(undefined);
      expect(bottle.rebuildsAsked()).to.equal(0);

      const served = await bottle.until(() => document.querySelectorAll('.con-mandatory').length > 0, 40_000);
      expect(served, 'past a scene\'s legal life the view is committed over the flag: the sitting\'s plate stands').to.equal(true);
      expect(bottle.view()?.waitingFor, 'the page holds the question').to.not.equal(undefined);
      const overruled = bottle.journal().filter((entry) => entry.cause?.cls === 'deferred-refresh/overruled/trade-fleet');
      expect(overruled.length, 'said once, by the scene\'s name').to.equal(1);
      expect(bottle.rebuildsAsked(), 'the page was not rebuilt — the road cured itself').to.equal(0);
      expect(classes().filter((cls) => cls.startsWith('liveness/') || cls.startsWith('session-rebuild/')), 'and the arbiter had nothing to judge').to.deep.equal([]);
    } finally {
      delete (toRaw(tradeFleetState) as {active?: boolean}).active;
      toRaw(tradeFleetState).active = false;
    }
  });

  /*
   * THE VIEW THAT NEVER ARRIVED (2) — ASKED IS THE SERVER'S WORD (`liveness/stall/unserved/…/view:<holder>`).
   * The arbiter read «the server asks» off the APPLIED view — so whatever kept a view from arriving left a healthy
   * screen with nobody asked, and no judge. Here the cause is one no construction closes: the view's fetch never
   * comes back (every attempt is cut at its bound and tried again by the poll). The poll's own word — GO, «you are
   * being waited on» — is kept apart from the view (`gameTransport.undeliveredQuestionSince`); while somebody
   * provably holds the debt (a fetch on the wire) it is in flight, within `VIEW_DELIVERY_BOUND_MS`; past it the
   * arbiter judges an unserved question like any other — the ladder, and past it THE LAST LINE: the page is rebuilt
   * from the server's view.
   */
  it('the server asks and the view never arrives: the arbiter judges the DELIVERY — the ladder, then the page is rebuilt', async () => {
    const table = await bottleServer().bootFixture('eden-alliance-enact-remote');
    bottle = await bootBottle(table);
    await bottle.advance(3_000);
    const host = globalThis as {fetch: typeof fetch};
    const wire = host.fetch;
    // The view's fetch leaves and never comes back (its bound cuts it; nothing else does).
    host.fetch = ((url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      if (!String(url).includes('api/player')) {
        return wire(url, init);
      }
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('The view\'s fetch was cut at its bound', 'AbortError')));
      });
    }) as typeof fetch;
    try {
      expect(await bottle.otherSeatMoves(1), 'the other seat passes — the server now asks THIS player').to.equal('pass');
      // Half a minute: the debt has a holder (a fetch on the wire, again and again) — in flight, nobody is judged.
      await bottle.advance(30_000);
      expect(bottle.view()?.waitingFor, 'the page knows nothing of its question').to.equal(undefined);
      expect(bottle.rebuildsAsked()).to.equal(0);
      expect(classes().filter((cls) => cls.startsWith('liveness/')), 'inside the bound a held debt is no stall').to.deep.equal([]);

      const rebuilt = await bottle.until(() => (bottle?.rebuildsAsked() ?? 0) > 0, 90_000);
      expect(rebuilt, 'past the bound, the grace and the spent ladder: the last line').to.equal(true);
      const stall = bottle.journal().find((entry) => entry.text.startsWith('[liveness] stall'));
      expect(stall?.text, 'the stall names what was asked and who held it').to.match(/asked: undelivered; .*holder: view:(fetch|nobody);/);
      // (The rebuild's own line is folded into the episode it ends — read off the page's console.)
      const line = bottle.lines().find((text) => text.includes('[session-rebuild] page'));
      expect(line, 'the rebuild is for the question the page was never given').to.match(/\(undelivered@\d+\) — by liveness:/);
      expect(bottle.rebuildsAsked(), 'asked once').to.equal(1);
    } finally {
      host.fetch = wire;
    }
  });

  /*
   * `liveness/oscillating/parliamentphase/board` — THE BLINKING REVEAL: the gate's seeds `fz1`
   * (`parliament-skyscrapers-enact`) and `fz3` (`parliament-marsfirst-budget-vote`), 2026-11-17 — the first loop the
   * judge ended that nobody had planted. A card drawn by the ruling party's passive arrives while the sitting's
   * question stands; the deck-draw scene claims the batch, closes the reveal's gate, finds nothing to deal from (in
   * the bottle: no deck anchor; on a real page: any abort — a deal that cannot start, a stall) and ABORTS — which
   * cleared the one thing that said «this batch has had its scene». So the batch was claimed again: the reveal band up
   * for a quarter of a second of every second or two, the deck counter flipping with it, until the last line rebuilt
   * the page. The law: a batch's arrival is decided ONCE — claimed, somebody else's, or GIVEN UP
   * (`consoleDeckDraw.gaveUp`); and the loop is counted on the picture's own edges, so no phase of a look hides it.
   *
   * (The whole walk of the gate, on the gate's seed — the loop needs its sixty presses' state, not three of them.)
   */
  it('a drawn batch whose deck scene gives it up: the reveal comes ONCE and stands — nothing turns, nothing is rebuilt', async () => {
    const fixture = 'parliament-marsfirst-budget-vote';
    const seed = `fz3:${fixture}`;
    const restoreRandom = bottleServer().seedProcessRandom(monkeyRng(`${seed}:world`)());
    try {
      const table = await bottleServer().bootFixture(fixture);
      bottle = await bootBottle(table, {query: 'coverage=1'});
      await bottle.advance(3_000);
      bottle = (await monkeyWalk(bottle, table.seats.length, seed, 60, {mode: 'plain'})).bottle;
      // Left alone past the loop's whole road: ten untouched looks to be named, ten more to be due.
      const edges = watchSurfaceEdges(document.body);
      await bottle.advance(25_000);
      const turned = edges.turned();
      edges.stop();
      expect(classes().filter((cls) => cls.startsWith('liveness/oscillating')), 'no loop is named').to.deep.equal([]);
      expect(bottle.rebuildsAsked(), 'and the last line is asked nothing').to.equal(0);
      expect(turned, 'the reveal band neither mounts nor leaves while nobody touches the pad').to.not.match(/con-reveal/);
      expect(classes(), 'the walk leaves nothing for a net').to.deep.equal([]);
    } finally {
      restoreRandom();
    }
  });

  /*
   * THE ONE-OWNER LAW's FIRST RED — `pad-MISS:section:board` · `band-APART:own:start>section:board`, the nightly gate
   * on seed `fz1` · `venus-l1-shade-start`, 2026-11-22 (issue #84). The opening entered past its summary holds no
   * lifetime hold (module state — a reload wipes it too). Between a prelude's play and the next «pick a prelude» the
   * question is held behind the play's presentation, `startTask` (admission-gated) is nothing — and the scene, ON
   * SCREEN over its own question, «served» nothing: RT went to the board's section under the queue. The function
   * says the start serves, with no hold, and it is right: a start whose frame stands keeps serving its own held
   * question (`startController.startQuestionHeld`) and absorbs the press.
   * (The whole walk of the gate, on the gate's seed: the press that parted is one of its sixty.)
   */
  it('the opening\'s own question held behind a play\'s presentation: the scene keeps the pad — no press falls to the board under it', async () => {
    const fixture = 'venus-l1-shade-start';
    const seed = `fz1:${fixture}`;
    const restoreRandom = bottleServer().seedProcessRandom(monkeyRng(`${seed}:world`)());
    try {
      const table = await bottleServer().bootFixture(fixture);
      bottle = await bootBottle(table, {query: 'coverage=1'});
      await bottle.advance(3_000);
      bottle = (await monkeyWalk(bottle, table.seats.length, seed, 60)).bottle;
      const owner = bottle.servingOwner();
      const parted = (owner?.disagreements ?? []).filter((row) => /^(pad-MISS|pad-EXTRA|band-APART|bar-APART)/.test(String(row.verdict)))
        .map((row) => `${String(row.shape)} ${String(row.verdict)} — ${String(row.facts)}`);
      expect(parted, 'the pad, the band and the bar took every press where the function said').to.deep.equal([]);
    } finally {
      restoreRandom();
    }
  });

  /*
   * `wait-graph/ceiling/deck-pick:deal` — the bottle's gate under the away perturbation, seed `fz5` ·
   * `space-lanes-wg`, 2026-11-19 (the first night the deal's ceiling was a wait of the graph — the tier audit, row 9;
   * until then its line was a note nobody read). «WG Project» played from the hand opens a pick of three preludes;
   * the stage is not measurable (here: no layout; on a real page — a zone still folded, a workspace parked under the
   * deal), so the batch arrival «hands over immediately instead of faking a flight» — and stood on its nine-second
   * safety instead, because nobody calls `notifyPayload` for a batch whose payload is already there. The deal's own
   * ceiling ended it at eight seconds: an empty row and a shut pad all that time. The law: with the payload here and
   * no stage to fly on, NOTHING IS OWED — the hand-over is the next task (`consoleBatchArrivalMotion.runBatchArrival`).
   * (The away spell of the shrunk walk is only the time the hand's own entry needs: plain time names the class too.)
   */
  it('a pick dealt onto a stage that cannot be measured is handed over at once — the pad opens, no ceiling ends the deal', async () => {
    const fixture = 'space-lanes-wg';
    const restoreRandom = bottleServer().seedProcessRandom(monkeyRng(`fz5:${fixture}:world`)());
    try {
      const table = await bottleServer().bootFixture(fixture);
      bottle = await bootBottle(table);
      await bottle.advance(3_000);
      const steps: ReadonlyArray<MonkeyStep> = [
        {do: 'press', key: 'Period', pauseMs: 451}, {do: 'press', key: 'Enter', pauseMs: 308},
        {do: 'away', ms: 11_357, hidden: true},
        {do: 'press', key: 'ArrowRight', pauseMs: 1_438}, {do: 'press', key: 'Enter', pauseMs: 1_882},
        {do: 'press', key: 'Enter', pauseMs: 249},
      ];
      bottle = await replaySteps(bottle, table.seats.length, steps);
      expect(bottle.frames(), 'the card is played — the hand hosts its pick').to.deep.equal(['hand:executing']);
      // The play's own beat, then the hand-over: three seconds are an order of magnitude under the deal's ceiling.
      await bottle.advance(3_000);
      expect(bottle.frames()).to.deep.equal(['hand:committed']);
      expect(bottle.bar(), 'the pick takes the pad').to.match(/Select/);
      // …and past the ceiling (8 s) and the arrival's safety (9 s) nothing was left to end on either.
      await bottle.advance(10_000);
      expect(classes(), 'no wait ended on a ceiling').to.deep.equal([]);
    } finally {
      restoreRandom();
    }
  });

  /*
   * `wait-graph/overdue/ceiling:remote-placement:watchable-board` — the freeze gate's seed of the day, `d20261119` ·
   * `wg-project-short-deck` (issue #76). The viewer stands on cards they have not taken yet; another seat's tile is
   * owed to the board, and a sitting has promised to yield for it — so the landing's wait is KEPT (sixty seconds
   * instead of twenty, `BOARD_WAIT_KEPT_MAX_MS`). Its node in the wait graph stood at twenty: the judge named a wait
   * that was keeping its word «overdue — past its 20 s bound, standing 22 s». The law: the node's bound is the wait's
   * own bound at every look (`CeilingWait.bound`).
   */
  it('the wait of a foreign tile, kept by the promise of a sitting, is not «overdue» at its short bound — the node carries the bound the wait keeps', async () => {
    const fixture = 'wg-project-short-deck';
    const restoreRandom = bottleServer().seedProcessRandom(monkeyRng(`d20261119:${fixture}:world`)());
    try {
      const table = await bottleServer().bootFixture(fixture);
      bottle = await bootBottle(table);
      await bottle.advance(3_000);
      const steps: ReadonlyArray<MonkeyStep> = [
        {do: 'press', key: 'Comma', pauseMs: 491}, {do: 'press', key: 'ArrowDown', pauseMs: 1_779}, {do: 'press', key: 'Enter', pauseMs: 374},
        {do: 'seats'},
        {do: 'press', key: 'Enter', pauseMs: 471}, {do: 'press', key: 'Enter', pauseMs: 400}, {do: 'press', key: 'Enter', pauseMs: 398},
        {do: 'press', key: 'Escape', pauseMs: 191}, {do: 'press', key: 'Enter', pauseMs: 475}, {do: 'press', key: 'Enter', pauseMs: 322},
        {do: 'seats'},
      ];
      bottle = await replaySteps(bottle, table.seats.length, steps);
      await bottle.advance(2_000);
      expect(bottle.bar(), 'the viewer stands on the cards they drew').to.match(/Take card/);
      // Past the short bound and the judge's own confirmation (it spoke at 22 s), with the cards still not taken.
      await bottle.advance(28_000);
      expect(classes().filter((cls) => cls.startsWith('wait-graph/overdue')), 'the kept wait is not overdue').to.deep.equal([]);
      expect(classes(), 'and nothing else of the walk is a defect').to.deep.equal([]);
    } finally {
      restoreRandom();
    }
  });

  /*
   * THE START'S SHADOW ON A PAGE NOBODY LOOKS AT (PLAN § 4 — the bottle's `hidden` pass, 2026-11-18). A card's play
   * scene holds the action menu («held by played-hero») and the page goes behind another window for twelve seconds:
   * the scene cannot end there, the shadow's ten seconds ran on the wall, and the finding it confirmed is CURED — a
   * healthy scene taken down for the player to come back to. The same on `venus-trade`: a step still leaving, read as
   * a disagreement three seconds into a hidden spell. The confirm runs on the painted clock.
   */
  for (const fixture of ['field-start-deploy-param', 'venus-trade']) {
    it(`the start's shadow does not judge a span the page did not paint through — ${fixture}, walked with the page away`, async () => {
      const seed = `fz0:${fixture}`;
      const restoreRandom = bottleServer().seedProcessRandom(monkeyRng(`${seed}:world`)());
      try {
        const table = await bottleServer().bootFixture(fixture);
        bottle = await bootBottle(table, {query: 'coverage=1'});
        await bottle.advance(3_000);
        const walked = await monkeyWalk(bottle, table.seats.length, seed, 60, {mode: 'plain', awayEvery: 30});
        bottle = walked.bottle;
        expect(walked.steps.some((step) => step.do === 'away'), 'the walk does leave the page').to.equal(true);
        await bottle.advance(25_000);
        expect(classes().filter((cls) => cls.startsWith('start-shadow')), 'the shadow names nothing').to.deep.equal([]);
        expect(classes().filter((cls) => cls.startsWith('start-stranded')), 'and nothing of the start is taken down').to.deep.equal([]);
      } finally {
        restoreRandom();
      }
    });
  }

  /*
   * `wait-graph/dead-end/question:actionmenu` · `…/surface:card-actions` — THE FAULT PASS (stage 4), `fz0` ·
   * `arwind-sitting-win-solo`, shrunk to seven steps: a card's action is set up in «Действия карт» and its submit is
   * LOST ON THE NETWORK. The composer rolls back to its setup (its own design), the system alert stands — and the
   * AWAITING HAND-OFF the press had armed («the stage holds until the answer picks the next scene») was not unwound:
   * six seconds of an inert pad under the alert, the screen reading «no surface accepts», so the wait graph's door
   * re-opened the action menu by CLOSING the workspace — the player's configured action gone while they read the
   * error. The law: a press that did not land unwinds what was armed for it AT ONCE (`pressUnwind` — the hand-off's
   * wait declares its unwind beside its arm).
   */
  it('a card action whose submit the NETWORK lost: the workspace keeps its setup under the alert — nothing is closed, nothing is filed', async () => {
    const seed = 'fz0:arwind-sitting-win-solo';
    const restoreRandom = bottleServer().seedProcessRandom(monkeyRng(`${seed}:world`)());
    try {
      const table = await bottleServer().bootFixture('arwind-sitting-win-solo');
      bottle = await bootBottle(table);
      await bottle.advance(3_000);
      const steps: Array<MonkeyStep> = [
        {do: 'press', key: 'Period', pauseMs: 354}, {do: 'press', key: 'ArrowUp', pauseMs: 1637},
        {do: 'fault', fault: 'network', target: 'submit'},
        {do: 'press', key: 'KeyX', pauseMs: 214}, {do: 'press', key: 'KeyX', pauseMs: 435},
        {do: 'press', key: 'Enter', pauseMs: 1711}, {do: 'press', key: 'Enter', pauseMs: 372},
      ];
      bottle = await replaySteps(bottle, table.seats.length, steps);
      expect(bottle.wire.faulted.map((f) => f.fault), 'the action\'s submit took the fault').to.deep.equal(['network']);
      // The player READS the alert — far longer than the hand-off's old private safety and the graph's confirm.
      await bottle.advance(30_000);
      expect(bottle.frames(), 'the workspace stands under the alert').to.deep.equal(['card-actions:browse']);
      expect(bottle.bar(), 'the alert is what the pad answers').to.match(/OK/);
      expect(bottle.liveness().beat?.accepting, 'the screen accepts — the wait for the lost answer is over').to.equal(true);
      expect(classes(), 'nothing is filed').to.deep.equal([]);
      // A dismisses the alert: the setup the player made is still theirs to confirm.
      await bottle.press('Enter');
      await bottle.advance(1_000);
      expect(bottle.frames()).to.deep.equal(['card-actions:browse']);
      expect(bottle.bar(), 'the composer is back, editable').to.match(/Confirm action/);
    } finally {
      restoreRandom();
    }
  });

  /*
   * `workspace-outcome/host-gone/card-actions/draw-pick` · `wait-graph/dead-end/claim:card-actions` — THE FAULT PASS
   * (stage 4), `fz0` · `corridors-futile`, shrunk to six steps: a card's action that DRAWS is confirmed and the server
   * NEVER ANSWERS. The hand-off's private six seconds closed the layers under a request still on the wire (the player
   * on the board, a submit in flight), the outcome's claim — orphaned — was released «host-gone», and its own twenty
   * seconds would have let it go under the same silence. The law: the server's silence is the transport's to bound
   * (its minute); the stage holds for it, and when the transport gives the request up the press's own unwind hands
   * the player their setup back — the claim falls as `press-unlanded`, which no host reads as a finished flow.
   */
  it('a drawing card action the server NEVER ANSWERS: the stage holds the transport\'s minute, then the setup is back — nothing closed, nothing filed', async () => {
    const seed = 'fz0:corridors-futile';
    const restoreRandom = bottleServer().seedProcessRandom(monkeyRng(`${seed}:world`)());
    try {
      const table = await bottleServer().bootFixture('corridors-futile');
      bottle = await bootBottle(table);
      await bottle.advance(3_000);
      const steps: Array<MonkeyStep> = [
        {do: 'press', key: 'Period', pauseMs: 1053}, {do: 'press', key: 'ArrowUp', pauseMs: 1566},
        {do: 'press', key: 'Enter', pauseMs: 185}, {do: 'press', key: 'ArrowUp', pauseMs: 4084},
        {do: 'fault', fault: 'silent', target: 'submit'},
      ];
      bottle = await replaySteps(bottle, table.seats.length, steps);
      await bottle.press('Enter');
      // Half a minute into the silence — far past the hand-off's six seconds and the claim's twenty.
      await bottle.advance(30_000);
      expect(bottle.wire.faulted.map((f) => f.fault)).to.deep.equal(['silent']);
      expect(bottle.frames(), 'the workspace holds its stage while the request is on the wire').to.deep.equal(['card-actions:browse']);
      expect(classes(), 'and nothing is filed for the server\'s silence').to.deep.equal([]);
      // The transport gives the request up at its minute: the alert, and under it the setup the player made.
      await bottle.advance(40_000);
      expect(bottle.frames()).to.deep.equal(['card-actions:browse']);
      expect(bottle.liveness().beat?.accepting, 'the screen accepts').to.equal(true);
      expect(classes().filter((cls) => cls !== 'transport/server-silent'), 'beside the transport\'s own word nothing is filed').to.deep.equal([]);
      await bottle.press('Enter');
      await bottle.advance(1_000);
      expect(bottle.bar(), 'A dismissed the alert: the composer is there, editable').to.match(/Confirm action/);
    } finally {
      restoreRandom();
    }
  });

  /*
   * `wait-graph/dead-end/question:actionmenu` · `…/surface:card-actions`, the OTHER road — `fz0` ·
   * `arwind-sitting-win-solo`, shrunk to five steps: the answer ARRIVES and does not parse. The move was MADE; the
   * truth is fetched again. Unwound as a press that never landed, the hand-off's wait was cleared and the stage
   * stood «Выполнение» with nobody left to fold it. The law: an answer that could not be read is still an answer —
   * what waits for it (`pressUnwind.unlandedPress().answered`) is resolved by the re-fetched view, as by any answer.
   */
  it('a card action whose answer ARRIVES UNREADABLE: the move was made — the flow folds on the re-fetched truth, nothing is filed', async () => {
    const seed = 'fz0:arwind-sitting-win-solo';
    const restoreRandom = bottleServer().seedProcessRandom(monkeyRng(`${seed}:world`)());
    try {
      const table = await bottleServer().bootFixture('arwind-sitting-win-solo');
      bottle = await bootBottle(table);
      await bottle.advance(3_000);
      const age = bottle.view()?.game.gameAge ?? -1;
      const steps: Array<MonkeyStep> = [
        {do: 'press', key: 'Period', pauseMs: 354}, {do: 'press', key: 'ArrowUp', pauseMs: 1637},
        {do: 'fault', fault: 'malformed', target: 'submit'},
        {do: 'press', key: 'Enter', pauseMs: 349}, {do: 'press', key: 'Enter', pauseMs: 677},
      ];
      bottle = await replaySteps(bottle, table.seats.length, steps);
      await bottle.advance(30_000);
      expect(bottle.wire.faulted.map((f) => f.fault)).to.deep.equal(['malformed']);
      expect((bottle.view()?.game.gameAge ?? -1) > age, 'the move was made, and the page knows').to.equal(true);
      expect(bottle.frames(), 'the finished flow left').to.deep.equal([]);
      expect(bottle.liveness().standing, 'the screen is served').to.deep.equal([]);
      expect(classes().filter((cls) => cls !== 'error/page-error'), 'beside the page\'s own word about the answer nothing is filed').to.deep.equal([]);
    } finally {
      restoreRandom();
    }
  });

  /*
   * `wait-graph/dead-end/claim:hand` · `claim:start` — THE FAULT PASS (stage 4): a card PLAYED from the hand, or in
   * the opening, whose submit did not land. The play's claim stood `awaiting` an answer that could not come, to its
   * twenty-second safety — and its fall then ended the play's flow under a player re-doing their move.
   */
  for (const fixture of ['ecology-experts-wg', 'field-start-deploy-leave']) {
    it(`a play whose submit did not land — ${fixture}: its claim is released with the press, nothing is filed`, async () => {
      const seed = `fz0:${fixture}`;
      const restoreRandom = bottleServer().seedProcessRandom(monkeyRng(`${seed}:world`)());
      try {
        const table = await bottleServer().bootFixture(fixture);
        bottle = await bootBottle(table);
        await bottle.advance(3_000);
        const walked = await monkeyWalk(bottle, table.seats.length, seed, 60, {mode: 'guided', faultEvery: 6});
        bottle = walked.bottle;
        expect(bottle.wire.faulted.filter((f) => f.method === 'POST').length, 'the walk does break a submit').to.be.greaterThan(0);
        await bottle.advance(86_000);
        const own = (cls: string): boolean => cls === 'transport/server-silent' || cls === 'error/page-error';
        expect(classes().filter((cls) => !own(cls)), 'beside the faults\' own words nothing is filed').to.deep.equal([]);
        expect(bottle.liveness().standing, 'and the screen is served').to.deep.equal([]);
      } finally {
        restoreRandom();
      }
    });
  }

  /*
   * `wait-graph/overdue/surface:parliament` · `animation-hold/ceiling/parliament-reward-owed` ·
   * `wait-graph/ceiling/external-draw:prompt-moved` — THE FAULT PASS (stage 4): a sitting's answer the server is
   * SILENT on for the transport's minute. Three registries each kept a clock of their own over that silence — the
   * wait graph's twelve seconds over a frame's `executing` beat, the hold registry's thirty-five over the rewards
   * the sitting owes, the external draw's grace of a second and a half for «the server moved off the prompt». The
   * law: a bound over what stands behind an unanswered submit is the submit's own — the graph books that time as it
   * books a page that does not paint, a hold's ceiling waits for the wire to go quiet and then gives the hold its
   * own bound again, and a refusal is read off the transport's settle, never off a timer.
   */
  for (const fixture of ['parliament-climate-enact', 'parliament-biodome-enact', 'parliament-climate-big']) {
    it(`a sitting's answer under a SILENT server — ${fixture}: no clock of its own runs out under the transport's minute, nothing is filed`, async () => {
      const seed = `fz0:${fixture}`;
      const restoreRandom = bottleServer().seedProcessRandom(monkeyRng(`${seed}:world`)());
      try {
        const table = await bottleServer().bootFixture(fixture);
        bottle = await bootBottle(table);
        await bottle.advance(3_000);
        const walked = await monkeyWalk(bottle, table.seats.length, seed, 60, {mode: 'guided', faultEvery: 6});
        bottle = walked.bottle;
        expect(bottle.wire.faulted.some((f) => f.method === 'POST' && (f.fault === 'silent' || f.fault === 'lost')), 'the walk does leave a submit unanswered').to.equal(true);
        await bottle.advance(86_000);
        const own = (cls: string): boolean => cls === 'transport/server-silent' || cls === 'error/page-error';
        expect(classes().filter((cls) => !own(cls)), 'beside the faults\' own words nothing is filed').to.deep.equal([]);
        expect(bottle.liveness().standing, 'and the screen is served').to.deep.equal([]);
      } finally {
        restoreRandom();
      }
    });
  }

  /*
   * `animation-hold/ceiling/parliament-chairman-quest` · `wait-graph/ceiling/parliament:submit` ·
   * `wait-graph/overdue/flow:chairman-quest` — THE FAULT PASS (stage 4), `fz0` · `arwind-chairman-quest(-solo)`: the
   * chairmanship's gate is answered and the answer is REFUSED (the solo table) or LOST (the two-seat one). The flow's
   * blocking hold, its node of the wait graph and the section's submit safety each bounded the wait for the SERVER on
   * a clock of their own — twenty, thirty and thirty seconds under the transport's sixty. The law: a hold stands over
   * what the flow PLAYS; the wait for the server is the transport's, and a submit that did not land hands the stage
   * back at its settle.
   */
  for (const fixture of ['arwind-chairman-quest', 'arwind-chairman-quest-solo']) {
    it(`the chairmanship's answer refused, stale or lost — ${fixture}: no private bound ends the wait for the server, nothing is filed`, async () => {
      const seed = `fz0:${fixture}`;
      const restoreRandom = bottleServer().seedProcessRandom(monkeyRng(`${seed}:world`)());
      try {
        const table = await bottleServer().bootFixture(fixture);
        bottle = await bootBottle(table);
        await bottle.advance(3_000);
        const walked = await monkeyWalk(bottle, table.seats.length, seed, 60, {mode: 'guided', faultEvery: 6});
        bottle = walked.bottle;
        expect(bottle.wire.faulted.filter((f) => f.method === 'POST').length, 'the walk does break a submit').to.be.greaterThan(0);
        // (The last word: the nets' graces and the server's own minute.)
        await bottle.advance(86_000);
        const own = (cls: string): boolean => cls === 'transport/server-silent' || cls === 'error/page-error';
        expect(classes().filter((cls) => !own(cls)), 'beside the faults\' own words nothing is filed').to.deep.equal([]);
        expect(bottle.liveness().standing, 'and the screen is served').to.deep.equal([]);
      } finally {
        restoreRandom();
      }
    });
  }

  /*
   * `liveness/stall/presses-no-effect/<task>/hand:configure/deaf` — A GATE THAT NEVER OPENS (FREEZE ZERO, stage 6; the
   * bottle's walk `fz1:aerospace-family`, named the hour the arbiter learned to count a press a deliberate gate
   * swallows over nothing). «X → A Разыграть» in the fullscreen viewer flies the card into the composer and raises
   * `zoomClosing`, which swallows EVERY press (`zoom-flight`); its only unwinder was the dialog's queued 'close'
   * event. The event late, or never (a dialog that was not open, a viewer that left under the flight): the composer
   * stands with «A Подтвердить» on the bar and takes nothing — B included. The law: every flight that takes the
   * viewer away unwinds it itself (`viewerController.unwindZoomFlight`), as the plain close always did.
   */
  it('a card handed off from the viewer into the composer: the pad is back the moment the card lands — no press is swallowed for good, nothing is filed', async () => {
    const seed = 'fz1:aerospace-family';
    const restoreRandom = bottleServer().seedProcessRandom(monkeyRng(`${seed}:world`)());
    try {
      const table = await bottleServer().bootFixture('aerospace-family');
      bottle = await bootBottle(table, {query: 'coverage=1'});
      await bottle.advance(3_000);
      const walked = await monkeyWalk(bottle, table.seats.length, seed, 60);
      bottle = walked.bottle;
      // The walk does go through the viewer's flight (the gate is said on the echo while it plays)…
      expect(walked.log.some((line) => line.endsWith(':absorbed:zoom-flight')), 'the walk meets the flight of the viewer').to.equal(true);
      // …and the flight ENDS: the walk's last presses are taken by a surface, never by the gate.
      expect(walked.log.filter((line) => !line.startsWith('[')).slice(-12).filter((line) => line.endsWith(':absorbed:zoom-flight')), 'the gate opened again').to.deep.equal([]);
      await bottle.advance(25_000);
      expect(classes()).to.deep.equal([]);
      expect(bottle.liveness().why, 'the player can act').to.deep.equal([]);
    } finally {
      restoreRandom();
    }
  });

  /*
   * THE RESEARCH WEDGED BY A SURFACE THAT LEFT INSIDE ITS COMPLETION (FREEZE ZERO, stage 6 — found by the autopilot's
   * FIRST whole game, `ap0:1`, generation 11): a purchase is committed, its completion latch is up
   * (`draftWorkspaceState.completion` — module state: the frame's lifetime), and the surface that plays the last beats
   * out is UNMOUNTED under it — «свернуть» parks the stack (on the pay stage of a heat / titanium corporation, in the
   * field). The latch's only finisher was that instance's own timer, armed by a flag of its own memory: the frame
   * stood for ever, parked or brought back, and every later research opened in a workspace with no verb. The law: a
   * completion holds the frame only while a workspace stands to play it out, and an instance that mounts inside one
   * arms the terminal beat itself (`draftController.draftFrameLive`, `ConsoleDraftWorkspace` § `discardsSettled`).
   * (Planted the way it arises: the stack parked inside the completion, then restored.)
   */
  it('a research surface that leaves inside its completion: the frame does not outlive the purchase — nothing stands, nothing is filed', async () => {
    const table = await bottleServer().bootFixture('draft-showcase-solo-buy');
    bottle = await bootBottle(table);
    const live = bottle;
    await live.advance(3_000);
    const stack = live.pageModules.consoleWorkspaceStack;
    const draft = live.pageModules.consoleDraftFlow.draftWorkspaceState;
    // A opens the research off its plate; RT buys — nothing marked: the purchase of zero cards, the shortest one.
    for (let i = 0; i < 4 && live.frames().length === 0; i++) {
      await live.press('Enter');
      await live.advance(1_500);
    }
    expect(live.frames(), 'the research stands').to.deep.equal(['draft:browse']);
    await live.press('Period');
    await live.advance(300);
    expect(bottleServer().seatTruth(live.seatId).waitingFor, 'the purchase is made: the server asks the turn').to.equal('or');
    expect(draft.completion, 'the completion is up — the frame lives on it').to.not.equal('none');
    // THE CLASS, PLANTED: the surface leaves inside the completion (the stack is parked — «свернуть»)…
    stack.collapseWorkspaceStack();
    await live.advance(400);
    // …and the player comes back.
    stack.restoreWorkspaceStack();
    await live.advance(12_000);
    expect(draft.completion, 'the completion has ended').to.equal('none');
    expect(live.frames(), 'no frame of the research is left on the stack').to.deep.equal([]);
    expect(live.ready().wsFrames, '…nor aside').to.deep.equal([]);
    // The turn is the player's: the board's own bar, the arbiter content, nothing filed.
    await live.advance(15_000);
    expect(live.liveness().why, 'the player can act').to.deep.equal([]);
    expect(classes()).to.deep.equal([]);
  });

  /*
   * THE AUTOPILOT, game 29 (stage 6, 2026-11-24) — `wait-graph/dangling/deferred:n`. The finale session keeps its own
   * prompt from the gate while the player stands in it, so after a landing the NEXT greenery prompt has no beat — and
   * «B Свернуть» gives it one, born by the press. That beat waited for the screen to fall quiet like an interruption
   * from elsewhere (the camera landing back, a delivery into the hand, the feed's read) and, held, it took the minimized
   * finale's own way back with it: a board with no plate at all, until the graph named the set-aside question dangling.
   * A minimized finale's prompt is presented at birth — the plate is back with the press.
   */
  it('a finale minimized under its own prompt, after a landing: the plate is back with the press — nothing waits for the screen to fall quiet, nothing is filed', async () => {
    const table = await bottleServer().bootFixture('two-player-finale-trigger');
    bottle = await bootBottle(table);
    const live = bottle;
    const other = table.seats[1].id;
    await live.advance(4_000);
    const asked = () => bottleServer().seatTruth(live.seatId).waitingFor;
    // The plate's A enters the finale: the pick is out on the board.
    for (let i = 0; i < 6 && !/Select cell|Confirm placement/.test(live.bar()); i++) {
      await live.press('Enter');
      await live.advance(1_200);
    }
    expect(live.bar(), 'the finale stands: the pick is out').to.match(/Select cell/);
    const first = bottleServer().seatTruth(live.seatId).promptId;
    // A greenery: the cell under the cursor, confirmed — it lands, and the session takes the NEXT prompt by itself.
    await live.press('Enter');
    await live.advance(500);
    expect(live.bar()).to.match(/Confirm placement/);
    await live.press('Enter');
    // THE CLASS's GROUND, PLANTED: a scene still plays when the next greenery is asked — in the game it was the bonus
    // cards on their way into the hand. The session stands with the prompt asked and its pick NOT out yet.
    const playing = live.pageModules.animationHold.beginAnimationHold('replay:a scene still playing', {maxHoldMs: 20_000, waitsFor: 'server'});
    for (let i = 0; i < 8 && (asked() !== 'or' || bottleServer().seatTruth(live.seatId).promptId === first || !/Minimize/.test(live.bar())); i++) {
      await live.advance(1_000);
      // (Philares, the other seat, is handed a pick when the greenery lands beside its own — answered plainly.)
      if (bottleServer().seatTruth(other).waitingFor !== undefined) {
        await bottleServer().otherSeatMoves(other);
      }
    }
    expect(asked(), 'the next greenery is asked').to.equal('or');
    expect(bottleServer().seatTruth(live.seatId).promptId, '…a new prompt').to.not.equal(first);
    expect(live.bar(), 'the session stands without its pick — B minimizes').to.match(/Finish your game.*Minimize/);
    const plates = (): number => (globalThis as unknown as {window: {document: {querySelectorAll(q: string): {length: number}}}}).window.document.querySelectorAll('.con-mandatory').length;
    // THE CLASS: B under the session's own prompt, on a screen that is not quiet.
    await live.press('Escape');
    await live.advance(400);
    expect(live.bar(), 'the session is minimized').to.not.match(/Minimize/);
    expect(plates(), 'the plate is on the board with the press — it does not wait for the scene').to.equal(1);
    expect(live.bar(), '…and the bar offers its A').to.match(/Place a greenery/);
    await live.advance(2_500);
    expect(plates()).to.equal(1);
    playing.release();
    // …and it stands: nothing dangling, the arbiter content, nothing filed.
    await live.advance(6_000);
    expect(live.bar()).to.match(/Place a greenery/);
    expect(live.liveness().why, 'the player can act').to.deep.equal([]);
    expect(classes()).to.deep.equal([]);
    // A on the plate: the session is back as it stood.
    await live.press('Enter');
    await live.advance(1_500);
    expect(live.bar(), 'the finale is back').to.match(/Minimize/);
    expect(classes()).to.deep.equal([]);
  });

  /*
   * THE AUTOPILOT, game 18 (stage 6, 2026-11-24) — a loop no press left, named by no net (the door answered for the
   * seat, and the one-owner measure said only «the function says the Parliament, the Colonies paint»). The sitting
   * stepped aside for the board's story; the player opened the quick wheel and walked into the Colonies; the sitting
   * came back UNDER them and asked its confirmation. B in the Colonies read «На поле» and, a shell task being live,
   * minimized the WHOLE stack; «A Вернуться к заседанию» restored it whole — the Colonies on top again. The sitting's
   * own page, where the answer is, could not be reached; the bar's title said «ПАРЛАМЕНТ» over the Colonies' commands.
   * B on a lateral screen is ONE level back to the frame under it (`workspaceLateralBackTarget` — the pad and the
   * bar's label read it), and such a screen names itself.
   */
  it('a lateral screen over a sitting that asks: B is one level back to the sitting — its answer is one press away, nothing is filed', async () => {
    const table = await bottleServer().bootFixture('parliament-aquifer-adjourn');
    bottle = await bootBottle(table);
    const live = bottle;
    const stack = live.pageModules.consoleWorkspaceStack;
    const kinds = (): Array<string> => live.frames().map((frame) => frame.split(':')[0]);
    await live.advance(4_000);
    // The plate's A opens the sitting: its page asks the confirmation.
    for (let i = 0; i < 6 && kinds().length === 0; i++) {
      await live.press('Enter');
      await live.advance(1_500);
    }
    expect(kinds(), 'the sitting stands').to.deep.equal(['parliament']);
    expect(bottleServer().seatTruth(live.seatId).waitingFor, '…and asks its confirmation').to.equal('option');
    const asked = bottleServer().seatTruth(live.seatId).promptId;
    // THE CLASS, PLANTED: a lateral move over the sitting (the quick wheel's «Колонии»).
    stack.enterWorkspace('colonies');
    await live.advance(1_500);
    expect(kinds()).to.deep.equal(['parliament', 'colonies']);
    expect(live.bar(), 'the screen names ITSELF').to.match(/^Trading/);
    expect(live.bar(), 'B says where it goes — one level').to.match(/Back/);
    expect(live.bar()).to.not.match(/To the board|Minimize/);
    await live.press('Escape');
    await live.advance(1_500);
    expect(kinds(), 'one level: the sitting stands, nothing is parked').to.deep.equal(['parliament']);
    expect(live.bar(), 'the sitting names itself again').to.match(/^Parliament/);
    // …and the answer is ONE press away: A closes the sitting, the server goes on.
    await live.press('Enter');
    await live.advance(2_500);
    expect(bottleServer().seatTruth(live.seatId).promptId, 'the confirmation was answered').to.not.equal(asked);
    await live.advance(6_000);
    expect(live.liveness().why, 'the player can act').to.deep.equal([]);
    expect(classes()).to.deep.equal([]);
  });

  /*
   * `liveness/stall/presses-no-effect/externaldraw/parliament:committed/deaf` — THE AUTOPILOT IN A REAL BROWSER, the
   * box's game 175 (stage 6, 2026-11-24; the first episode of the pilot that WALKS TO the question): «stall
   * (presses-no-effect): 5s without progress, 8 presses; task: externalDraw; top: parliament:committed; holder: deaf …
   * stack-home: home from parliament». The sitting stood on the «ПРИЁМКА» of ONE drawn card — «A Забрать карту ·
   * L3 Источник», no B on the bar — and B was pressed ten times; the arbiter judged every B a handler took on a
   * frame past its commit («it must have collapsed something»), called the screen deaf and took the Parliament home
   * under a draw that A was taking. A watchdog that folds a healthy screen is a freeze the watchdog made
   * (2026-10-31 — the same law, for X and a list's wall). B is owed only where the BAR offers it: the bar is the
   * pad's own word.
   */
  it('B hammered on a step whose bar offers no B — the one drawn card of a sitting: nothing is filed, the draw stands, A takes it', async () => {
    const table = await bottleServer().bootFixture('parliament-research-enact');
    bottle = await bootBottle(table);
    const live = bottle;
    const truth = () => bottleServer().seatTruth(live.seatId);
    const oneCardLeft = (): boolean => truth().waitingFor === 'card' && /Collect the card/.test(live.bar()) && !/Collect all/.test(live.bar());
    await live.advance(4_000);
    // The plate's A opens the sitting on its draw; A takes the cards one by one until ONE is left.
    for (let i = 0; i < 8 && !oneCardLeft(); i++) {
      await live.press('Enter');
      await live.advance(2_500);
    }
    expect(oneCardLeft(), `the last drawn card stands (bar «${live.bar()}»)`).to.equal(true);
    expect(live.bar(), 'its bar offers no way out — the card is taken with A').to.not.match(/Minimize|Back|To the board/);
    expect(live.frames()).to.deep.equal(['parliament:committed']);
    const asked = truth().promptId;
    // THE CLASS: B, ten times, on a screen that never offered it.
    for (let i = 0; i < 10; i++) {
      await live.press('Escape');
      await live.advance(700);
    }
    await live.advance(8_000);
    expect(live.frames(), 'the sitting stands where it stood').to.deep.equal(['parliament:committed']);
    expect(truth().promptId, 'the draw still asks').to.equal(asked);
    expect(classes(), 'no stall is called over a healthy screen').to.deep.equal([]);
    // …and A takes the card.
    await live.press('Enter');
    await live.advance(2_500);
    expect(truth().promptId, 'the card was taken').to.not.equal(asked);
    await live.advance(6_000);
    expect(classes()).to.deep.equal([]);
  });
});

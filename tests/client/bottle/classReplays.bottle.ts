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
});

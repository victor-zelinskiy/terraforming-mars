import {test, expect} from './consoleTest';
import {PLAIN_PLAY_CARDS, bootFixture, bootFixtureSeats, createGameWithOneOf, fetchPlayerModel, focusCard, openConsole, openQuickWheel, press, pressUntil, seedGameOverApi, settle, soloGameConfig} from './consoleStart';

/**
 * B THROUGH A PLAYED CARD's COMMITTED BEAT — the hand still concludes by its OWN ending.
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO, the autopilot's zero bar — the sixth count, games 1504 and 1656): a card played
 * from the hand, and B pressed three times while its beat ran («Выполняется…», then the played card's own story). The
 * play finished, the server asked the free turn — and the hand stood committed with nothing owed, until the guarded
 * conclusion's LEVEL DOOR closed it 250 ms later (`[workspace-conclusion] «hand» left by the level door`). The net did
 * its job; the flow did not: a finished play leaves through its own ending, whatever B did meanwhile.
 *
 * «Done» is the SERVER's word (the card on the table); the hand's leave is the page's (no workspace frame stands); the
 * level door is a line of the page's log that must not be said.
 *
 * THE FIELD CASE's ROAD, named by the level door's own trail (2026-11-26): B reached the Parliament section during the
 * hosted walk, and its stage branch FOLDED the walk (`phase:parliament executing→browse` ← `handleStageIntent`'s
 * fallthrough `closeStage`) — the walk torn, its ending never reported; the next B on the browse grid popped the step
 * (`leaveWorkspace`). B in a beat now says nothing. These fixtures never reproduced it (green before the fix too — on
 * them no B reached the walk's stage), so the cases below stand as guards of the scenario, and the field
 * seeds (1656: four doors in six replays before the fix, none in six after) are the window's proof.
 */
test.describe('a played card\'s beat under B', () => {
  test('B ×3 through the committed beat of a play: the hand leaves by its own ending — never by the level door', async ({page, request}) => {
    test.setTimeout(240_000);
    // A PLAIN PLAY — whichever the deal offers (`PLAIN_PLAY_CARDS`: production only, no target, no tile).
    const {playerId, card: CARD} = await createGameWithOneOf(request, PLAIN_PLAY_CARDS, {config: soloGameConfig()});
    await seedGameOverApi(request, playerId, {cards: [CARD], buy: 1});
    const said: Array<string> = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' || msg.type() === 'error') {
        said.push(msg.text());
      }
    });
    await openConsole(page, playerId);
    const frames = (): Promise<string> =>
      page.evaluate(() => (window as unknown as {__conReady: () => {wsFrames?: Array<string>}}).__conReady().wsFrames?.join(',') ?? '');
    // RT → A: the hand. The card focused, A: its composer; A: the play.
    await openQuickWheel(page);
    expect(await pressUntil(page, 'Enter', async () => (await frames()).startsWith('hand'), {tries: 3, settleMs: 1500}), 'RT · A opens the hand').toBe(true);
    expect(await focusCard(page, CARD), `${CARD} is focused`).toBe(true);
    expect(await pressUntil(page, 'Enter', async () => (await frames()).includes('hand:configure'), {tries: 3, settleMs: 1500}),
      'A opens the play composer').toBe(true);
    await press(page, 'Enter', 300);
    // B THROUGH THE BEAT — the player's thumb on the way out, three times.
    for (let i = 0; i < 3; i++) {
      await press(page, 'Escape', 400);
    }
    await expect.poll(async () => {
      const wire = await fetchPlayerModel(request, playerId) as unknown as {thisPlayer: {tableau?: Array<{name: string}>}};
      return (wire.thisPlayer.tableau ?? []).some((played) => played.name === CARD);
    }, {timeout: 30_000, message: 'the server played the card'}).toBe(true);
    await expect.poll(frames, {timeout: 30_000, message: 'the hand has left'}).toBe('');
    expect(said.filter((line) => line.includes('left by the level door')), 'the hand left by its own ending').toEqual([]);
  });

  // …and a play whose effect is a STEP hosted in the hand — the vote of «Делегаты Юпитера» (the sixth count's game
  // 1656: «hand:committed > parliament:executing», B three times, the level door).
  test('B ×3 through a hosted vote\'s execution: the hand leaves by its own ending — never by the level door', async ({page, request}) => {
    test.setTimeout(300_000);
    const card = 'Jovian Envoys';
    const said: Array<string> = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' || msg.type() === 'error') {
        said.push(msg.text());
      }
    });
    const posts: Array<string> = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
        posts.push(r.postData() ?? '');
      }
    });
    const id = await bootFixture(page, request, 'jovian-envoys-overtake');
    await settle(page);
    const frames = (): Promise<string> =>
      page.evaluate(() => (window as unknown as {__conReady: () => {wsFrames?: Array<string>}}).__conReady().wsFrames?.join(',') ?? '');
    for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${card}"]`).count() === 0; i++) {
      await press(page, 'Period', 600);
      await press(page, 'Enter', 1600);
    }
    await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
    await settle(page);
    expect(await focusCard(page, card, 20), `${card} is focused`).toBe(true);
    await press(page, 'Enter', 1200);
    await page.locator('.con-composer--play').waitFor({timeout: 15_000});
    expect(await pressUntil(page, 'Enter', async () => posts.length > 0, {tries: 3, settleMs: 3_000}), 'A plays the card').toBe(true);
    await page.locator('.con-hand .con-parl--embedded [data-parl-vote-door="card"]').waitFor({timeout: 60_000});
    await settle(page, {timeoutMs: 30_000}).catch(() => undefined);
    // A on the focused resolution — the vote's POST — and B three times through its execution.
    expect(await pressUntil(page, 'Enter', async () => posts.length >= 2, {tries: 4, settleMs: 1500}), 'A casts the vote').toBe(true);
    for (let i = 0; i < 3; i++) {
      await press(page, 'Escape', 400);
    }
    await expect.poll(async () => {
      const wire = await fetchPlayerModel(request, id) as unknown as {thisPlayer: {tableau?: Array<{name: string}>}};
      return (wire.thisPlayer.tableau ?? []).some((played) => played.name === card);
    }, {timeout: 30_000, message: 'the server played the card'}).toBe(true);
    await expect.poll(frames, {timeout: 30_000, message: 'the hand has left'}).toBe('');
    expect(said.filter((line) => line.includes('left by the level door')), 'the hand left by its own ending').toEqual([]);
  });

  // …and THE FIELD CASE, reproduced by the autopilot's own seed (game 1656, one replay in four): «Юристы Красных» — the
  // play walks the Career with the Parliament hosted in the hand («hand:committed > parliament:executing»); the pilot's
  // A came twice (the second a «дожать» of the walk, 230 ms later), then B three times through the walk.
  for (const fixture of ['red-lawyers-end', 'red-lawyers-tr-first'] as const) {
    test(`B ×3 through a played card's walk of the Career hosted in the hand, after a hurry (${fixture}): the hand leaves by its own ending — never by the level door`, async ({page, request}) => {
      test.setTimeout(300_000);
      const card = 'Red Lawyers';
      const said: Array<string> = [];
      page.on('console', (msg) => {
        if (msg.type() === 'warning' || msg.type() === 'error') {
          said.push(msg.text());
        }
      });
      const posts: Array<string> = [];
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push(r.postData() ?? '');
        }
      });
      const {playerId} = await bootFixtureSeats(page, request, fixture);
      const frames = (): Promise<string> =>
        page.evaluate(() => (window as unknown as {__conReady: () => {wsFrames?: Array<string>}}).__conReady().wsFrames?.join(',') ?? '');
      await press(page, 'Period', 600);
      await press(page, 'Enter', 1600);
      await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
      expect(await focusCard(page, card, 24), `${card} is focused`).toBe(true);
      await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
      await press(page, 'Enter', 1200);
      await page.locator('.con-composer--play').waitFor({timeout: 15_000});
      await settle(page);
      // A — the play — and A again 230 ms later (the field's own rhythm), then B through the walk.
      await press(page, 'Enter', 230);
      await press(page, 'Enter', 1000);
      for (let i = 0; i < 3; i++) {
        await press(page, 'Escape', 620);
      }
      expect(posts.length, 'the play was posted').toBeGreaterThan(0);
      await expect.poll(async () => {
        const wire = await fetchPlayerModel(request, playerId) as unknown as {thisPlayer: {tableau?: Array<{name: string}>}};
        return (wire.thisPlayer.tableau ?? []).some((played) => played.name === card);
      }, {timeout: 30_000, message: 'the server played the card'}).toBe(true);
      // (A card step takes its card — B on the reveal is «Взять всё» — then the flow leaves.)
      await expect.poll(async () => {
        if (await page.locator('.con-reveal').count() > 0) {
          await press(page, 'Escape', 400);
        }
        return await frames();
      }, {timeout: 60_000, message: 'the flow has left'}).toBe('');
      expect(said.filter((line) => line.includes('left by the level door')), 'the hand left by its own ending').toEqual([]);
    });
  }
});

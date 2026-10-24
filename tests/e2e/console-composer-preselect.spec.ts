import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, focusCard, openActionFocus, openCardActions, press, settle, walkFocusUntil} from './consoleStart';
import {armFocusWitness, focusWitness, focusWitnessSummary} from './focusWitness';

/**
 * «ОДИН КУРСОР ПОСЛЕ ОТВЕТА · ПРИБЫТИЕ НА КОММИТ · ЕДИНСТВЕННАЯ ЦЕЛЬ» — the pre-select stand of T14 (ledger CC,
 * `docs/claude/console/composer-preselect.md`). TIMING class: it samples the cursor's arrival and presses inside the
 * arrival window.
 *
 * The owner's words (2026-10-22): after a choice the focus must go to the next element waiting for a choice, or to the
 * play / activate button — and the player must SEE that the next press launches the move; a target with ONE candidate
 * is pre-selected, shown (where the resource goes, what changes) and marked, quietly.
 *
 * THE MATRIX — one test per cell; `preselect-sole` is one base table holding every cell, `supported-research` (T14) the
 * play that asks nothing, `parliament-actions` the party composer:
 *   K · T14 Supported Research — nothing to ask: the composer opens on the commit, the A that follows the opening press
 *       is the ARRIVAL (absorbed), the next one plays;
 *   A · Floater Prototypes — ONE floater holder: the target is seeded (`data-seeded="sole"`), the cursor arrives on the
 *       commit armed, one press plays; A on the seeded row still opens the step (one card), B keeps the seed;
 *   B · Imported Nutrients — TWO microbe holders: never seeded; the pick lands the cursor on the commit, and a press in
 *       the arrival window (a double press) sends nothing — the next one sends ONE;
 *   C · Asteroid — an OPTIONAL plant removal (one target beside the decline): never seeded, the decline plate stands;
 *   D · Aerial Mappers' action «add 1 floater to ANY card» whose only target is the hero itself: the target is seeded
 *       (the self-target handle), the cursor opens ON the commit, one press acts;
 *   F · Heat Trappers — ONE player target (red produces heat, blue none): seeded, the row reads who loses what;
 *   G · the Scientists' party action — ONE microbe holder (Tardigrades): seeded, the cursor on the commit row;
 *   H · Artificial Photosynthesis — a variant with nothing after it: A on the tile, the cursor steps onto the commit.
 *
 * Every cell writes its table (`screenshots/t14/<tag>/<profile>/<cell>.json` — where the cursor stood on open and after
 * each answer, the presses to the move, the POSTs of a double press) BEFORE any assertion, so the BEFORE run against
 * the HEAD client (`TM_E2E_SHOTS_TAG=before` on `.e2e-t14-before`) records the same table and asserts nothing.
 *
 * PROFILES: the TV row for every cell; A and B run at 1080 too — the play composer's commit row lives INSIDE the
 * column's scroll area at 1080 (it may have to scroll into view as it is arrived at), a profile-specific claim
 * (`.claude/rules/tests.md` § ONE ROW — the exception names its number: the arrival's commit row ≥ 95 % visible).
 */

const TAG = process.env.TM_E2E_SHOTS_TAG ?? 'after';
const AFTER = TAG !== 'before';
const PLAY = '.con-composer--play';
const ACTION = '.con-cardactions .con-composer';

const TV = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const FHD = {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'} as const;
type Preset = typeof TV | typeof FHD;

type Table = Record<string, unknown>;

function write(preset: Preset, cell: string, table: Table): void {
  const dir = path.resolve('screenshots', 't14', TAG, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, `${cell}.json`), JSON.stringify(table, null, 2));
}

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  const dir = path.resolve('screenshots', 't14', TAG, preset.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
async function storyboard(page: Page, preset: Preset, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.resolve('screenshots', 't14', TAG, preset.id, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

function watchPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

/**
 * Where the composer's cursor stands — read off the classes the cursor paints (the same vocabulary on the HEAD client):
 * `cta` · `variant:<i>` · `row:<kind or words>` · `step` (an embedded target step / list stands) · `none` · `absent`.
 */
async function cursorAt(page: Page, root: string): Promise<string> {
  return await page.evaluate((r) => {
    const host = document.querySelector(r);
    if (host === null) {
      return 'absent';
    }
    if (host.querySelector('.con-ptsel, .con-composer__sub-head') !== null) {
      return 'step';
    }
    if (host.querySelector('.con-composer__cta--focused, .con-pact__cta--focus') !== null) {
      return 'cta';
    }
    const tile = host.querySelector('.con-vchoice__opt--focused');
    if (tile !== null) {
      return `variant:${tile.getAttribute('data-vchoice-index') ?? tile.getAttribute('data-branch-pos') ?? '?'}`;
    }
    const row = host.querySelector('.con-composer__row--focused, .con-pact__row--focus');
    if (row !== null) {
      const kind = row.getAttribute('data-choice-kind');
      return `row:${kind ?? (row.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 28)}`;
    }
    return 'none';
  }, root);
}

/** The composer's seeded rows (`data-seeded="sole"`) and its target rows' states. */
async function seeds(page: Page, root: string): Promise<{seeded: number, marks: number, targets: Array<string>, armed: boolean}> {
  return await page.evaluate((r) => ({
    seeded: document.querySelectorAll(`${r} [data-seeded="sole"]`).length,
    marks: document.querySelectorAll(`${r} [data-seeded-mark]`).length,
    targets: Array.from(document.querySelectorAll(`${r} [data-composer-target-row]`)).map((e) => e.getAttribute('data-tgtrow-state') ?? '?'),
    armed: document.querySelector(`${r} [data-composer-armed]`) !== null,
  }), root);
}

/** The window a deciding press on an arrived commit row is still absorbed (0 on the HEAD client — no probe). */
async function arrivalLeft(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const w = window as unknown as {__conCommitArrival?: () => {leftMs: number}};
    return w.__conCommitArrival === undefined ? 0 : w.__conCommitArrival().leftMs;
  });
}

/** RT → «КАРТЫ» → the card → A: the play composer stands, nothing sent. */
async function openPlayComposer(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 4 && await page.locator(`.con-hand [data-zoom-slot="${card}"]`).count() === 0; i++) {
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
  }
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 15_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, slots * 2 + 6), `never focused «${card}» in the hand`).toBe(true);
  for (let i = 0; i < 3 && await page.locator(PLAY).count() === 0; i++) {
    await press(page, 'Enter', 900);
  }
  await expect(page.locator(PLAY), 'the play composer stands').toHaveCount(1);
  await settle(page);
}

/** «Действия карт» → the card's tile → its composer. */
async function openActionComposerOf(page: Page, card: string): Promise<void> {
  await openCardActions(page);
  const onTile = () => page.evaluate((name) =>
    document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') === name, card);
  const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 18 && !(await onTile()); i++) {
    await press(page, moves[i % moves.length], 260);
  }
  expect(await onTile(), `never focused «${card}» in «Действия карт»`).toBe(true);
  await openActionFocus(page);
  await settle(page);
  await expect(page.locator(ACTION), 'the action composer stands').toBeVisible();
}

/** «Действия карт» → a PARTY's tile (steered by geometry) → its composer — THE card composer («один фреймворк»). */
async function openPartyComposerOf(page: Page, party: string): Promise<void> {
  await openCardActions(page);
  const focused = () => page.evaluate(() => {
    const tile = document.querySelector('.con-cardactions__tile--focused');
    return tile?.getAttribute('data-action-party') ?? tile?.getAttribute('data-action-card') ?? '';
  });
  // The menu is a 2-D grid (groups flow in columns): each hop goes toward the target's measured rect (the
  // parliament-actions spec's own steering), the ring walk only as the fallback.
  for (let i = 0; i < 16 && await focused() !== party; i++) {
    const dir = await page.evaluate((target) => {
      const f = document.querySelector('.con-cardactions__tile--focused')?.getBoundingClientRect();
      const t = document.querySelector(`.con-cardactions__tile[data-action-party="${target}"]`)?.getBoundingClientRect();
      if (f === undefined || t === undefined) {
        return 'ArrowRight';
      }
      const dy = (t.top + t.height / 2) - (f.top + f.height / 2);
      const dx = (t.left + t.width / 2) - (f.left + f.width / 2);
      if (Math.abs(dy) > f.height / 2) {
        return dy > 0 ? 'ArrowDown' : 'ArrowUp';
      }
      return dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    }, party);
    await press(page, dir, 260);
  }
  if (await focused() !== party) {
    await walkFocusUntil(page, async () => await focused() === party, focused, 30);
  }
  expect(await focused(), `never focused the «${party}» party tile`).toBe(party);
  const composer = `${ACTION}[data-composer-source="party:${party}"]`;
  for (let i = 0; i < 3 && await page.locator(composer).count() === 0; i++) {
    await press(page, 'Enter', 1100);
  }
  await expect(page.locator(composer), 'the card composer stands for the party').toHaveCount(1);
  await settle(page, {timeoutMs: 8_000});
}

/**
 * THE GREEDY A — press A until the move leaves (a POST), the way a player who trusts the cursor plays: every press goes
 * where the cursor stands. Returns the presses it took and where the cursor stood before each.
 */
async function pressesToMove(page: Page, root: string, posts: Array<string>, max = 7): Promise<{presses: number, trail: Array<string>}> {
  const start = posts.length;
  const trail: Array<string> = [];
  for (let i = 0; i < max; i++) {
    if (posts.length > start) {
      return {presses: i, trail};
    }
    trail.push(await cursorAt(page, root));
    await press(page, 'Enter', 800);
    await settle(page, {timeoutMs: 6_000});
  }
  // The table is written whatever happened: «the move never left» is a finding (the HEAD client's variant kept the
  // cursor on its tile, so a player who trusts the cursor never reaches the play) — `-1`, the trail says where it stood.
  const sent = await expect.poll(() => posts.length > start, {timeout: 4_000}).toBe(true).then(() => true, () => false);
  return {presses: sent ? max : -1, trail};
}

test.describe('the composer pre-select', () => {
  test.use({viewport: TV.viewport});

  test('K · T14 asks nothing: the composer opens on the commit, the A right after the opening press is the arrival', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixtureSeats(page, request, 'supported-research', {query: TV.query});
    await settle(page);
    const posts = watchPosts(page);
    // Open by hand (the album), then press A the instant the composer exists — the rhythm of a double press.
    for (let i = 0; i < 4 && await page.locator('.con-hand [data-zoom-slot="Supported Research"]').count() === 0; i++) {
      await press(page, 'Period', 600);
      await press(page, 'Enter', 1600);
    }
    await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
    await settle(page);
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    expect(await focusCard(page, 'Supported Research', slots * 2 + 6)).toBe(true);
    await page.keyboard.press('Enter');
    await page.locator(PLAY).waitFor({timeout: 10_000});
    await page.keyboard.press('Enter');
    await cinematicBeat(page, 900, 'a double press would have sent the play by now');
    const openPosts = posts.length;
    const open = await cursorAt(page, PLAY);
    const left = await arrivalLeft(page);
    await settle(page);
    const settledAt = await cursorAt(page, PLAY);
    const table = {cell: 'K', open, settledAt, openPosts, arrivalLeftAfterDouble: left, seeds: await seeds(page, PLAY)};
    write(TV, 'K', table);
    await shoot(page, TV, 'k-01-open');
    if (!AFTER) {
      return;
    }
    expect(openPosts, 'the A that followed the opening press is the ARRIVAL — nothing sent').toBe(0);
    expect(settledAt, 'nothing to ask: the cursor stands on the commit').toBe('cta');
    await press(page, 'Enter', 900);
    await expect.poll(() => posts.length, {timeout: 10_000, message: 'the next press plays — ONE POST'}).toBe(1);
  });

  for (const preset of [TV, FHD]) {
    test(`A · one floater holder: the target is SEEDED and marked, the commit arrives armed, one press plays (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      test.skip(preset.id === 'fhd' && !AFTER, 'the BEFORE table is the TV one');
      await page.setViewportSize(preset.viewport);
      await bootFixtureSeats(page, request, 'preselect-sole', {query: preset.query});
      await settle(page);
      const posts = watchPosts(page);
      await armFocusWitness(page, {candidates: `${PLAY} .con-composer__row, ${PLAY} .con-composer__cta`});
      const stopOpen = await storyboard(page, preset, 'a-open');
      await openPlayComposer(page, 'Floater Prototypes');
      await stopOpen();
      const open = await cursorAt(page, PLAY);
      const s = await seeds(page, PLAY);
      const witness = await focusWitness(page);
      await shoot(page, preset, 'a-01-open');
      const ctaVisible = await page.evaluate((r) => {
        const cta = document.querySelector(`${r} .con-composer__cta`)?.getBoundingClientRect();
        const vp = document.querySelector(`${r} .con-composer__cta`)?.closest('.con-scroll-area__viewport')?.getBoundingClientRect();
        if (cta === undefined) {
          return 0;
        }
        const box = vp ?? {top: 0, bottom: window.innerHeight};
        const h = Math.max(0, Math.min(cta.bottom, box.bottom) - Math.max(cta.top, box.top));
        return Math.round(100 * h / Math.max(1, cta.height));
      }, PLAY);
      // A on the seeded row opens the choice — one card — and B brings the seed back untouched.
      let reopened = 'skipped';
      if (AFTER && s.seeded > 0) {
        await press(page, 'ArrowUp', 400);
        reopened = await cursorAt(page, PLAY);
        const stopReopen = await storyboard(page, preset, 'b-reopen');
        await press(page, 'Enter', 900);
        const stepCards = await page.locator(`${PLAY} .con-ptsel [data-zoom-slot], ${PLAY} .con-ptsel__self`).count();
        await shoot(page, preset, 'a-02-reopened');
        await press(page, 'Escape', 900);
        await stopReopen();
        reopened = `${reopened} → ${stepCards} card(s) → back ${await cursorAt(page, PLAY)} · seeded ${(await seeds(page, PLAY)).seeded}`;
        await press(page, 'ArrowDown', 400);
      }
      const stopCommit = await storyboard(page, preset, 'a-commit');
      const move = await pressesToMove(page, PLAY, posts);
      await stopCommit();
      const table = {cell: 'A', profile: preset.id, open, seeds: s, ctaVisible, reopened, move, witness: focusWitnessSummary(witness)};
      write(preset, 'A', table);
      if (!AFTER) {
        return;
      }
      expect(s.seeded, 'the ONE target is pre-selected').toBeGreaterThanOrEqual(1);
      expect(s.marks, 'and marked «единственная цель»').toBeGreaterThanOrEqual(1);
      expect(s.targets, 'the row reads ANSWERED (where the floaters go)').toContain('answered');
      expect(open, 'nothing left to ask: the cursor stands on the commit').toBe('cta');
      expect(ctaVisible, 'the arrived commit row stands in view').toBeGreaterThanOrEqual(95);
      expect(reopened, 'A opens the one-card step; B keeps the seed').toMatch(/1 card\(s\) → back .* · seeded [1-9]/);
      expect(move.presses, 'ONE press plays').toBe(1);
      expect(witness.snaps, 'the commit ARRIVES — never snaps').toEqual([]);
      expect(witness.bornHidden).toEqual([]);
    });

    test(`B · two holders: never seeded; the pick lands on the commit, a double press sends nothing (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      test.skip(preset.id === 'fhd' && !AFTER, 'the BEFORE table is the TV one');
      await page.setViewportSize(preset.viewport);
      await bootFixtureSeats(page, request, 'preselect-sole', {query: preset.query});
      await settle(page);
      const posts = watchPosts(page);
      await openPlayComposer(page, 'Imported Nutrients');
      const open = await cursorAt(page, PLAY);
      const s = await seeds(page, PLAY);
      await press(page, 'Enter', 900); // the row → the target step
      const inStep = await cursorAt(page, PLAY);
      await armFocusWitness(page, {candidates: `${PLAY} .con-composer__row, ${PLAY} .con-composer__cta`});
      const stopPick = await storyboard(page, preset, 'c-pick-then-inertia');
      // A on the focused candidate, and A again at once: a double press.
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await cinematicBeat(page, 1_000, 'a double press would have sent the play by now');
      await stopPick();
      const doublePosts = posts.length;
      const landed = await cursorAt(page, PLAY);
      const armed = (await seeds(page, PLAY)).armed;
      const witness = await focusWitness(page);
      await shoot(page, preset, 'b-01-landed');
      let after = doublePosts;
      if (doublePosts === 0) {
        await press(page, 'Enter', 900);
        await expect.poll(() => posts.length, {timeout: 10_000}).toBeGreaterThan(0);
        after = posts.length;
      }
      const table = {cell: 'B', profile: preset.id, open, seeds: s, inStep, landed, armedSeen: armed, doublePosts, postsAfterNextPress: after, witness: focusWitnessSummary(witness)};
      write(preset, 'B', table);
      if (!AFTER) {
        return;
      }
      expect(s.seeded, 'two candidates: nothing seeded').toBe(0);
      expect(open, 'the open question holds the cursor').toMatch(/^row:/);
      expect(landed, 'the answer lands the cursor on the commit').toBe('cta');
      expect(doublePosts, 'the press in the arrival window is the arrival — nothing sent').toBe(0);
      expect(after, 'the next press sends ONE').toBe(1);
      expect(witness.snaps).toEqual([]);
    });
  }

  test('C · an OPTIONAL removal is never seeded; its decline stands on the row', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixtureSeats(page, request, 'preselect-sole', {query: TV.query});
    await settle(page);
    await openPlayComposer(page, 'Asteroid');
    const open = await cursorAt(page, PLAY);
    const s = await seeds(page, PLAY);
    await press(page, 'Enter', 900);
    const decline = await page.locator(`${PLAY} [data-decline-plate]`).count();
    await shoot(page, TV, 'c-01-list');
    await press(page, 'Period', 900); // RT — the decline
    const declined = await cursorAt(page, PLAY);
    const table = {cell: 'C', open, seeds: s, declinePlate: decline, afterDecline: declined};
    write(TV, 'C', table);
    if (!AFTER) {
      return;
    }
    expect(s.seeded, 'an optional choice is never seeded').toBe(0);
    expect(open).toMatch(/^row:/);
    expect(decline, 'the decline is a button inside the choice').toBeGreaterThanOrEqual(1);
    expect(declined, 'a decline is an answer: the cursor goes on to the commit').toBe('cta');
  });

  test('D · the Mappers\' «add 1 floater to ANY card»: its only target is the hero itself — seeded, the commit arrives', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixtureSeats(page, request, 'preselect-sole', {query: TV.query});
    await settle(page);
    const posts = watchPosts(page);
    // Each printed row of the Mappers is its own tile in «Действия карт»; the first — «add 1 floater to ANY card» —
    // opens the composer on that branch (the aerial-mappers spec's own reading), its target row the one question.
    await armFocusWitness(page, {candidates: `${ACTION} .con-composer__row, ${ACTION} .con-composer__cta`});
    await openActionComposerOf(page, 'Aerial Mappers');
    const open = await cursorAt(page, ACTION);
    const s = await seeds(page, ACTION);
    const handle = await page.locator(`${ACTION} [data-composer-target-row] .con-composer__target-selflink`).count();
    const witness = await focusWitness(page);
    await shoot(page, TV, 'd-01-open');
    const move = await pressesToMove(page, ACTION, posts);
    const table = {cell: 'D', open, seeds: s, selfHandle: handle, move, witness: focusWitnessSummary(witness)};
    write(TV, 'D', table);
    if (!AFTER) {
      return;
    }
    expect(s.seeded, 'the self-target is seeded').toBeGreaterThanOrEqual(1);
    expect(handle, 'answered by the hero itself — the handle, never a second face').toBe(1);
    expect(open, 'nothing left to ask: the cursor stands on the commit').toBe('cta');
    expect(move.presses).toBe(1);
    expect(witness.snaps).toEqual([]);
  });

  test('F · ONE player target: seeded, the row reads who loses what', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixtureSeats(page, request, 'preselect-sole', {query: TV.query});
    await settle(page);
    const posts = watchPosts(page);
    await openPlayComposer(page, 'Heat Trappers');
    const open = await cursorAt(page, PLAY);
    const s = await seeds(page, PLAY);
    const reading = await page.evaluate((r) => (document.querySelector(`${r} [data-seeded="sole"]`)?.textContent ?? '').replace(/\s+/g, ' ').trim(), PLAY);
    await shoot(page, TV, 'f-01-open');
    const move = await pressesToMove(page, PLAY, posts);
    const table = {cell: 'F', open, seeds: s, reading, move};
    write(TV, 'F', table);
    if (!AFTER) {
      return;
    }
    expect(s.seeded).toBeGreaterThanOrEqual(1);
    expect(reading, 'the seeded row names the target and its change').toMatch(/3\s*→\s*1/);
    expect(open).toBe('cta');
    expect(move.presses).toBe(1);
  });

  test('G · the Scientists\' party action with ONE holder: seeded, the cursor on the commit row', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixtureSeats(page, request, 'parliament-actions', {query: TV.query});
    await settle(page);
    const posts = watchPosts(page);
    await openPartyComposerOf(page, 'Scientists');
    const open = await cursorAt(page, ACTION);
    const s = await seeds(page, ACTION);
    const picked = await page.locator(`${ACTION} .con-composer__row[data-seeded="sole"]`).count();
    await shoot(page, TV, 'g-01-open');
    const move = await pressesToMove(page, ACTION, posts);
    const table = {cell: 'G', open, seeds: s, picked, move};
    write(TV, 'G', table);
    if (!AFTER) {
      return;
    }
    expect(picked, 'the one holder is picked').toBe(1);
    expect(s.marks, 'and marked').toBeGreaterThanOrEqual(1);
    expect(open).toBe('cta');
    expect(move.presses).toBe(1);
  });

  /**
   * THE OWNER'S MOCKUPS (decisions 4 and 7 of the T14 prompt) — CSS over the LIVE composer, frames for the batch: the
   * mark of a seeded row in three registers (M1 the shipped word in the row's tail · M2 a «1» seal · M3 the bare
   * words, no plate) and the commit's arrival in two (A1 the shipped breath, frozen at its swell · A2 the ring alone).
   * Opt-in (`TM_E2E_T14_MOCKUPS=1`) — a mockup is not a regression.
   */
  test('M · the owner\'s mockups: three marks of a seeded row, two arrivals of the commit', async ({page, request}) => {
    test.skip(process.env.TM_E2E_T14_MOCKUPS !== '1', 'opt-in: the owner\'s batch');
    test.setTimeout(240_000);
    await bootFixtureSeats(page, request, 'preselect-sole', {query: TV.query});
    await settle(page);
    await openPlayComposer(page, 'Floater Prototypes');
    const variants: Array<[string, string]> = [
      ['m1-word', ''],
      ['m2-seal', '.con-tgtrow__sole, .con-composer__sole { font-size: 0 !important; letter-spacing: 0 !important; width: 1.5rem; height: 1.5rem; padding: 0 !important; border-radius: 50% !important; justify-content: center; } ' +
        '.con-tgtrow__sole::before, .con-composer__sole::before { content: "1"; font-size: .85rem; letter-spacing: 0; }'],
      ['m3-bare', '.con-tgtrow__sole, .con-composer__sole { box-shadow: none !important; padding: 0 !important; color: rgba(140, 240, 200, .55) !important; letter-spacing: .14rem !important; } ' +
        '.con-tgtrow__sole::before, .con-composer__sole::before { content: "◦ "; }'],
    ];
    for (const [name, css] of variants) {
      const handle = css === '' ? undefined : await page.addStyleTag({content: css});
      await shoot(page, TV, `mockup-${name}`);
      await handle?.evaluate((el) => (el as HTMLElement).remove());
    }
    // THE ARRIVAL: re-answer the row (A opens its one-card step, A picks) — the ONE rule lands on the commit and it
    // breathes; the breath is FROZEN at its swell for the frame (a 380 ms one-shot is shorter than a 4K screenshot).
    const freeze = async (atMs: number) => page.evaluate((t) => {
      const breath = document.getAnimations().find((a) => (a as CSSAnimation).animationName === 'con-commit-armed');
      if (breath !== undefined) {
        breath.pause();
        breath.currentTime = t;
      }
      return breath !== undefined;
    }, atMs);
    await press(page, 'ArrowUp', 400);
    await press(page, 'Enter', 900);
    await page.keyboard.press('Enter');
    await expect.poll(() => freeze(160), {timeout: 3_000, intervals: [25], message: 'the breath stands'}).toBe(true);
    const breathPaint = await page.evaluate(() => {
      const cta = document.querySelector('.con-composer--play .con-composer__cta');
      const breath = document.getAnimations().find((a) => (a as CSSAnimation).animationName === 'con-commit-armed');
      return {
        armed: cta?.hasAttribute('data-composer-armed') ?? false,
        layer: cta === null ? '' : getComputedStyle(cta, '::after').boxShadow,
        layerOpacity: cta === null ? '' : getComputedStyle(cta, '::after').opacity,
        progress: breath?.effect?.getComputedTiming().progress ?? null,
        pseudo: (breath?.effect as KeyframeEffect | undefined)?.pseudoElement ?? null,
      };
    });
    write(TV, 'M', {breathPaint});
    await shoot(page, TV, 'mockup-a1-breath');
    await page.evaluate(() => document.getAnimations().forEach((a) => (a as CSSAnimation).animationName === 'con-commit-armed' && a.finish()));
    const plain = await page.addStyleTag({content: '.con-composer__cta[data-composer-armed]::after { animation: none !important; }'});
    await shoot(page, TV, 'mockup-a2-ring');
    await plain.evaluate((el) => (el as HTMLElement).remove());
  });

  test('H · a variant with nothing after it: A on the tile, the cursor steps onto the commit', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixtureSeats(page, request, 'preselect-sole', {query: TV.query});
    await settle(page);
    const posts = watchPosts(page);
    await openPlayComposer(page, 'Artificial Photosynthesis');
    const open = await cursorAt(page, PLAY);
    await armFocusWitness(page, {candidates: `${PLAY} .con-vchoice__opt, ${PLAY} .con-composer__cta`});
    const stopVariant = await storyboard(page, TV, 'd-variant');
    await press(page, 'Enter', 900);
    await stopVariant();
    const afterVariant = await cursorAt(page, PLAY);
    const witness = await focusWitness(page);
    await shoot(page, TV, 'h-01-variant');
    const move = await pressesToMove(page, PLAY, posts);
    const table = {cell: 'H', open, afterVariant, move, witness: focusWitnessSummary(witness)};
    write(TV, 'H', table);
    if (!AFTER) {
      return;
    }
    expect(open, 'the open question is the variant').toMatch(/^variant:/);
    expect(afterVariant, 'the variant answered, nothing left: the cursor on the commit').toBe('cta');
    expect(move.presses).toBe(1);
    expect(witness.snaps).toEqual([]);
  });
});

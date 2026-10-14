/*
 * «НАУЧНАЯ КОЛОНИЯ» WITH «МАРСИАНСКИЙ УНИВЕРСИТЕТ» ON THE TABLE — the field lock of 2026-10-14.
 *
 * One press, three stages: the play draws 2 cards, asks for its colony (a live step hosted INSIDE the hand), and only
 * then does the university's science tag ask its discard — LEFT FOR AFTER THE DRAW (the play's own draw comes before
 * it: since 2026-10-15 the composer offers it «now, or after the draw», and the driver leaves it for after), whose one
 * answer is a card from the hand, so it stands as the hand ALBUM.
 *
 * THE LOCK (the owner's TV, 4K): the album stood on the hand's shelf while the colony step still stood INSIDE that
 * hand. The stack's projection (`consoleState.section`, the deepest frame) said «colonies», so A, RT, the d-pad and X
 * went to the hidden colony grid — only B (the pick's own minimize) answered, and the crumb named the colony
 * («… › МИРАНДА · ОСМОТР») over the discard. Three causes, guarded here as one journey:
 *  ① the pad follows the surface on screen (`padSection` / `handPickCoversSteps`);
 *  ② Miranda's build bonus (the animal, chosen on the stage with the colony) resolves WITH the build — never parked
 *    behind the university's question (`Colony.buildBonusPriority`), so the colony step is finished before it;
 *  ③ a colony claim never stays «awaiting» for a held prompt it cannot host (the reconciler), and the play takes its
 *    question back once its step is over (`adoptPlayEffectDecision`): the album is a STAGE of the play —
 *    «КАРТЫ В РУКЕ › НАУЧНАЯ КОЛОНИЯ › СБРОС КАРТЫ» — and the card it draws arrives in the same zone.
 *
 * (A) Miranda — a target asked on the stage (fhd + tv4k); (B) Luna — a build that asks nothing (fhd): the colony
 * step ends with the colony, the play does not.
 */
import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, playCardFromHand, press, pressUntil, settle, walkFocusUntil} from './consoleStart';

const OUT = path.resolve('screenshots', 'mu-colony-question');
const CARD = 'Research Colony';
const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>,
  waitingFor?: {type: string, choiceContext?: {source?: {card?: string}}},
  thisPlayer: {color: string, tableau: Array<{name: string, resources?: number}>},
  game: {colonies: Array<{name: string, colonies: Array<string>}>},
};

async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await (await request.get(`/api/player?id=${id}`)).json() as Wire;
}

/** The university's question stands — by the server's structural marker (the action menu after it is an `or` too). */
function universityAsks(wire: Wire): boolean {
  return wire.waitingFor?.choiceContext?.source?.card === 'Mars University';
}

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** Animals on the three holders the fixture seats (Pets 3 · Predators 2 · Birds 1). */
function animalsOf(wire: Wire): number {
  return wire.thisPlayer.tableau
    .filter((c) => c.name === 'Pets' || c.name === 'Predators' || c.name === 'Birds')
    .reduce((sum, c) => sum + (c.resources ?? 0), 0);
}

type Sample = {crumb: string, picking: boolean, section: string, stack: string};

/**
 * THE FLOW'S TRAIL — `setInterval` + `MutationObserver`, never rAF (a quiet screen stops the compositor's clock, and a
 * quiet screen is exactly where this lock lived). Each sample: the crumb's live tail (the LAST step of the incoming
 * layer — the outgoing one cross-fades beside it), whether the album stands, the stack's projection and its frames.
 */
async function armTrail(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__muq?: {samples: Array<Sample>}, __conColonyDiag?: () => {section?: string, stack?: Array<{kind: string, phase: string}>}};
    const trail = {samples: [] as Array<Sample>};
    w.__muq = trail;
    let last = '';
    const sample = (): void => {
      const steps = Array.from(document.querySelectorAll('.con-wshead__layer--deep:not(.con-wshead__layer--out) .con-wshead__step'))
        .map((el) => (el.textContent ?? '').trim()).filter((t) => t !== '');
      const d = w.__conColonyDiag?.();
      const s: Sample = {
        crumb: steps[steps.length - 1] ?? '',
        picking: document.querySelector('.con-hand[data-flow="picking"] [data-decline-plate]') !== null,
        section: d?.section ?? '',
        stack: (d?.stack ?? []).map((f) => `${f.kind}:${f.phase}`).join('>'),
      };
      const key = JSON.stringify(s);
      if (key !== last) {
        trail.samples.push(s);
        last = key;
      }
    };
    setInterval(sample, 50);
    new MutationObserver(sample).observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-flow']});
  });
}

function lastSample(samples: ReadonlyArray<Sample>): Sample {
  expect(samples.length, 'the trail sampled the flow').toBeGreaterThan(0);
  return samples[samples.length - 1];
}

async function trailOf(page: Page): Promise<Array<Sample>> {
  return await page.evaluate(() => (window as unknown as {__muq?: {samples: Array<Sample>}}).__muq?.samples ?? []);
}

/**
 * Play the card and walk its chain to the university's album: take every drawn card, build on `colony` (answering
 * the stage's own unanswered step when it has one), stop when the album stands. Every step is act → verify → retry.
 */
async function playToAlbum(page: Page, request: APIRequestContext, playerId: string, colony: string): Promise<void> {
  expect(await playCardFromHand(page, CARD), `${CARD} was played`).toBe(true);
  const grid = page.locator('.con-colonies .con-coltile');
  for (let i = 0; i < 12 && await grid.count() === 0; i++) {
    await page.locator('.con-reveal, .con-colonies .con-coltile').first().waitFor({timeout: 60_000});
    if (await page.locator('.con-reveal').count() > 0) {
      await press(page, 'Enter', 1200);
    }
  }
  await expect(grid.first(), 'the colony step stands (inside the hand)').toBeVisible({timeout: 60_000});
  await expect(page.locator('.con-hand .con-colonies'), 'the colonies are a step OF the hand').toHaveCount(1);
  await settle(page, {timeoutMs: 20_000});

  const focusedTile = async (): Promise<string> =>
    await page.locator('.con-coltile--focused').first().getAttribute('data-test').catch(() => null) ?? '';
  expect(await walkFocusUntil(page, async () => await focusedTile() === `con-colony-${colony}`, focusedTile, 12),
    `the cursor reached ${colony}`).toBe(true);
  expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-colfocus').count() > 0, {tries: 3, settleMs: 1200}),
    `A opens ${colony}'s build stage`).toBe(true);
  await settle(page, {timeoutMs: 20_000});

  // A build that ASKS (Miranda's animal — three holders) marks its own unanswered step: answered on the stage, then
  // X commits; a build that asks nothing (Luna) commits on A.
  const missing = page.locator('.con-colfocus__steprow--missing');
  const asks = await missing.count() > 0;
  if (asks) {
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-colfocus__targetstage').count() > 0, {tries: 3, settleMs: 900}),
      'A opens the target step inside the stage').toBe(true);
    await settle(page, {timeoutMs: 20_000});
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-colfocus__targetstage').count() === 0, {tries: 3, settleMs: 900}),
      'A picks the card and returns to the review').toBe(true);
    await expect(missing, 'the stage\'s step is answered').toHaveCount(0);
  }
  const built = async (): Promise<boolean> =>
    ((await wireOf(request, playerId)).game.colonies.find((c) => c.name === colony)?.colonies.length ?? 0) > 0;
  expect(await pressUntil(page, asks ? 'KeyX' : 'Enter', built, {tries: 3, settleMs: 1500}), `the colony stands on ${colony}`).toBe(true);
  await expect(page.locator('.con-hand[data-flow="picking"] [data-decline-plate]'),
    'the university\'s question stands as the hand album (its decline in the question line)').toBeVisible({timeout: 60_000});
}

/** A on the focused album card is the discard — answered at once; the server moves past the question. */
async function discardOnA(page: Page, request: APIRequestContext, playerId: string): Promise<void> {
  const before = await wireOf(request, playerId);
  expect(universityAsks(before), 'the university asks (its OR: discard · do nothing)').toBe(true);
  const answered = async (): Promise<boolean> => !universityAsks(await wireOf(request, playerId));
  expect(await pressUntil(page, 'Enter', answered, {tries: 2, settleMs: 2000}),
    'A in the album answered the university — the pad belongs to the album on screen').toBe(true);
}

for (const preset of PRESETS) {
  test.describe(`Research Colony × Mars University · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`(A) Miranda: the target on the stage, the album a stage of the play, A answers it, the draw arrives in the same zone (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const playerId = await bootFixture(page, request, 'mu-research-colony', {query: preset.query});
      const animals = animalsOf(await wireOf(request, playerId));
      await armTrail(page);

      await playToAlbum(page, request, playerId, 'Miranda');
      await settle(page, {timeoutMs: 20_000});
      await shoot(page, preset.id, '01-album');

      // ② The colony's own bonus resolved WITH the build — before the university asked.
      const atAlbum = await wireOf(request, playerId);
      expect(animalsOf(atAlbum), 'Miranda\'s animal landed before the university asked (never parked behind it)').toBe(animals + 1);
      expect(universityAsks(atAlbum), 'the university is what stands').toBe(true);
      // ③ The album is a stage of the play: the colony step is gone, the hand's frame stands committed.
      const standing = lastSample(await trailOf(page));
      expect(standing.stack, 'the colony step left with its colony; the play\'s hand still stands').toBe('hand:committed');
      expect(standing.section, 'the stack projects onto the album\'s own section').toBe('hand');
      expect(standing.crumb, 'the crumb names the pick').toBe('Сброс карты');

      // ① A answers.
      await discardOnA(page, request, playerId);
      const after = await wireOf(request, playerId);
      expect(after.cardsInHand?.length, 'one card left the hand and one came back').toBe(atAlbum.cardsInHand?.length);

      // The card the discard bought arrives in the SAME workspace, under the same crumb's next stage.
      await expect(page.locator('.con-hand .con-reveal'), 'the drawn card stands inside the hand workspace').toBeVisible({timeout: 60_000});
      await shoot(page, preset.id, '02-draw');
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-hand__frame').count() === 0, {tries: 4, settleMs: 1500}),
        'the take ends the play — the workspace leaves').toBe(true);

      // THE CRUMB ONLY MOVES FORWARD: from the colony stage on it never falls back to the play's own stage, and the
      // album's tail is «СБРОС КАРТЫ» on every frame it stands.
      const trail = await trailOf(page);
      const colonyAt = trail.findIndex((s) => s.crumb.startsWith('Миранда'));
      expect(colonyAt, 'the colony stage named itself').toBeGreaterThan(-1);
      const later = trail.slice(colonyAt).map((s) => s.crumb).filter((c) => c !== '');
      expect(later.filter((c) => c === 'Розыгрыш' || c === 'Разыграно'), `the tail never stepped back: ${later.join(' → ')}`).toEqual([]);
      expect(trail.filter((s) => s.picking && s.crumb !== 'Сброс карты').map((s) => s.crumb),
        'while the album stands the tail is the pick').toEqual([]);
      const seq = later.filter((c, i) => c !== later[i - 1]);
      expect(seq.slice(-2), `the tail ends «СБРОС КАРТЫ → ДОБОР КАРТ»: ${seq.join(' → ')}`).toEqual(['Сброс карты', 'Добор карт']);
    });

    if (preset.id === 'fhd') {
      test(`(B) Luna: the colony step ends with the colony, the play does not — the album stands inside it (${preset.id})`, async ({page, request}) => {
        test.setTimeout(420_000);
        const playerId = await bootFixture(page, request, 'mu-research-colony', {query: preset.query});
        await armTrail(page);

        await playToAlbum(page, request, playerId, 'Luna');
        await settle(page, {timeoutMs: 20_000});
        await shoot(page, preset.id, '11-luna-album');
        const standing = lastSample(await trailOf(page));
        expect(standing.stack, 'the play\'s hand stands committed — never a fresh album over the board').toBe('hand:committed');
        expect(standing.crumb, 'the crumb names the pick').toBe('Сброс карты');
        await expect(page.locator('.con-wshead'), 'the play\'s subject stays in the crumb').toContainText(/Научная колония/i);
        expect((await trailOf(page)).filter((s) => s.picking && s.stack !== 'hand:committed').map((s) => s.stack),
          'the album never stood outside the play\'s own workspace').toEqual([]);

        // RT is the decline, inside the album.
        const declined = async (): Promise<boolean> => !universityAsks(await wireOf(request, playerId));
        expect(await pressUntil(page, 'Period', declined, {tries: 2, settleMs: 2000}), 'RT declined the university').toBe(true);
        await expect(page.locator('.con-hand__frame'), 'nothing left to show — the workspace leaves').toHaveCount(0, {timeout: 60_000});
      });
    }
  });
}

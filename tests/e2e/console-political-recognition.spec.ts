import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, press, pressUntil, settle} from './consoleStart';

/**
 * TR68 «ПОЛИТИЧЕСКОЕ ПРИЗНАНИЕ» — the set's first card on the requirement kind «cards with requirements PLAYED» and
 * TR04's walk at THREE steps (docs/TURMOIL_REDUX_POLITICAL_RECOGNITION.md). The walk itself is the ONE phrase TR04 /
 * TR37 pinned (`console-red-lawyers` holds its order frame by frame); what is new, end to end against a real server:
 *
 *   A. THE NEW KIND IN THE HAND (`-short`, four cards on the table): the card's blocker chip reads the kind's GLYPH and
 *      «4/5» (never a label doubled beside it), the verdict bar the same, the face's MIN plate draws the glyph, the
 *      corner draws the WILD tag; the server refuses the play with the count reason «now 4».
 *   B. THE WALK (6 → ⑦ CARD → ⑧ → ⑨ TR): the composer names three steps before the press; ONE POST; the step's card
 *      is taken in the middle of the walk; the flow leaves; the server: the marker on 9, influence 4, +1 TR, the
 *      card's 8 M€ paid and the ruling Greens' +2 M€ for the walked TR, one record with the three steps.
 *   C. THE CUT (11 → ⑫): «1 из 3 · конец трека» before the press; one step recorded.
 *
 * Fixtures `political-recognition` / `-short` / `-end` (tests/e2e/fixtures/generate.ts).
 */

const CARD = 'Political Recognition';
const OUT = path.resolve('screenshots', 'political-recognition');
const composer = '.con-composer--play';

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {color: string, megacredits: number, terraformRating: number, tableau: Array<{name: string}>, cardsInHandNbr: number};
  cardsInHand?: Array<{name: string, unplayableReasons?: Array<{message: string, current?: number}>}>;
  game: {
    parliament: {
      players: Array<{color: string, agenda: number, influence: number}>;
      lastAdvance?: {from: number, to: number, steps: Array<{to: number, bonus?: string}>, reason: string, card?: string};
    };
  };
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
}

/** The wheel → the hand (the album stands, nothing in transit). */
async function openHand(page: Page): Promise<void> {
  await press(page, 'Period', 600); // RT → the quick wheel
  await press(page, 'Enter', 1600); // centre slot → the hand
  await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
}

/** The hand → the card → its composer. */
async function openCardComposer(page: Page): Promise<void> {
  await openHand(page);
  expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
  await press(page, 'Enter', 1200);
  await page.locator(composer).waitFor({timeout: 15_000});
  await settle(page);
}

/** A: the play's ONE POST (act → verify → retry: a press may be absorbed). */
async function pressPlay(page: Page, posts: Array<string>): Promise<void> {
  for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
    await press(page, 'Enter', 300);
    await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
  }
  expect(posts.length, 'the play is ONE POST').toBe(1);
  expect(posts[0], 'the POST is the card\'s play').toContain(CARD);
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

async function waitFlowLeft(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => ({
    hand: document.querySelectorAll('.con-hand').length,
    parl: document.querySelectorAll('.con-parl').length,
    ws: document.querySelectorAll('.con-ws').length,
  })), {timeout: 60_000, message: 'the finished flow leaves for the board'}).toEqual({hand: 0, parl: 0, ws: 0});
  await settle(page, {timeoutMs: 30_000});
}

for (const preset of PRESETS) {
  test.describe(`TR68 Political Recognition · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A — the new kind in the hand: «[card] 4/5» on the chip and the bar, the glyph on the plate, the wild tag (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const {playerId} = await bootFixtureSeats(page, request, 'political-recognition-short', {query: preset.query});
      const wire = await wireOf(request, playerId);
      const inHand = wire.cardsInHand?.find((c) => c.name === CARD);
      expect(inHand?.unplayableReasons?.[0], 'the server refuses the play with the count reason and its honest «now»').toMatchObject({message: 'Requires ${0} played cards with requirements', current: 4});

      await openHand(page);
      const slot = page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).first();
      const chip = slot.locator('.con-hand__chip--emblem');
      await expect(slot.locator('img[src*="card-requirement.svg"]').first(), 'the face\'s MIN plate draws the kind\'s glyph').toBeVisible();
      await expect(slot.locator('img[src*="tags/wild"], [style*="tags/wild"]').first(), 'the corner draws the WILD tag').toBeAttached();
      await expect(chip.locator('.con-hand__chip-emblem[src*="card-requirement.svg"]'), 'the chip reads the glyph').toHaveCount(1);
      await expect(chip, 'and the counter alone — the glyph names the subject').toContainText('4/5');
      expect(await focusCard(page, CARD, 24)).toBeTruthy();
      const bar = page.locator('.con-hand__reason--bar').filter({has: page.locator('[data-reason-emblem][src*="card-requirement.svg"]')});
      await expect(bar, 'the verdict bar speaks the same reading').toContainText('4/5');
      await shoot(page, preset.id, 'a-hand-short');
    });

    test(`B — 6 → ⑦ CARD → ⑧ → ⑨ TR: three steps named, one POST, the card step in the middle, the server agrees (${preset.id})`, async ({page, request}) => {
      test.setTimeout(480_000);
      const posts = watchPosts(page);
      const {playerId} = await bootFixtureSeats(page, request, 'political-recognition', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const me = (w: Wire) => w.game.parliament.players.find((p) => p.color === viewer)!;
      expect([me(before).agenda, me(before).influence], 'the fixture: blue on step 6, influence 3').toEqual([6, 3]);

      await openCardComposer(page);
      const trackChip = page.locator(`${composer} .action-effect-chip`).filter({has: page.locator('.resource_icon--agenda-step')});
      await expect(trackChip, 'the track chip reads the walk «6 → 9»').toContainText('6');
      await expect(trackChip).toContainText('9');
      await expect(page.locator(composer).getByText('Карьера — маркер пройдёт 3 шага в Парламенте'), 'the coming stage is named once').toHaveCount(1);
      await shoot(page, preset.id, 'b-composer');

      await pressPlay(page, posts);
      await page.locator('.con-hand .con-parl--embedded[data-walk-beat]').waitFor({timeout: 40_000});
      // ⑦ — the card step's card stands in the received-cards scene; A takes it.
      await expect(page.locator('.con-reveal--scene:not(.con-reveal--bonus-held):not(.con-reveal--bonus-veiled) [data-zoom-slot]'),
        'the step\'s card stands in the scene').toHaveCount(1, {timeout: 40_000});
      await shoot(page, preset.id, 'b-card-step');
      expect(await pressUntil(page, 'Enter', async () => await page.locator('dialog.con-zoom[open], .con-reveal').count() === 0, {tries: 6, settleMs: 1500}), 'A takes the card').toBe(true);
      await waitFlowLeft(page);
      expect(posts.length, 'nothing else was sent').toBe(1);
      await shoot(page, preset.id, 'b-after');

      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the card is on the table').toContain(CARD);
      expect(me(after).agenda, 'the marker walked to 9').toBe(9);
      expect(me(after).influence, 'influence 4').toBe(4);
      expect(after.thisPlayer.terraformRating, 'the walked TR').toBe(before.thisPlayer.terraformRating + 1);
      expect(after.thisPlayer.megacredits, 'the card cost 8 M€; the ruling Greens paid 2 M€ for the walked TR').toBe(before.thisPlayer.megacredits - 8 + 2);
      expect(after.thisPlayer.cardsInHandNbr, 'the played card left, the step\'s card came').toBe(before.thisPlayer.cardsInHandNbr);
      expect(after.game.parliament.lastAdvance, 'ONE record, the card\'s, with the three steps')
        .toMatchObject({from: 6, to: 9, reason: 'card', card: CARD, steps: [{to: 7, bonus: 'card'}, {to: 8}, {to: 9, bonus: 'tr'}]});
    });

    test(`C — 11 → ⑫: «1 из 3 · конец трека» before the press, one step recorded (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const posts = watchPosts(page);
      const {playerId} = await bootFixtureSeats(page, request, 'political-recognition-end', {query: preset.query});
      const before = await wireOf(request, playerId);
      const viewer = before.thisPlayer.color;
      const me = (w: Wire) => w.game.parliament.players.find((p) => p.color === viewer)!;
      expect(me(before).agenda).toBe(11);

      await openCardComposer(page);
      await expect(page.locator(composer).getByText('1 из 3 · конец трека'), 'the cut is NAMED before the press').toHaveCount(1);
      await expect(page.locator(composer).getByText('Карьера — маркер пройдёт 1 шаг в Парламенте')).toHaveCount(1);
      await shoot(page, preset.id, 'c-composer-cut');
      await pressPlay(page, posts);
      await page.locator('.con-hand .con-parl--embedded[data-walk-beat]').waitFor({timeout: 40_000});
      await waitFlowLeft(page);
      const after = await wireOf(request, playerId);
      expect(me(after).agenda).toBe(12);
      expect(after.game.parliament.lastAdvance).toMatchObject({from: 11, to: 12, reason: 'card', card: CARD, steps: [{to: 12}]});
    });
  });
}

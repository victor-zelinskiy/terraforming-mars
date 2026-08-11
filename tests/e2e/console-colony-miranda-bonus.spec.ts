import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, playCardFromHand, press, soloGameConfig} from './consoleStart';

/**
 * MIRANDA — THE OWNER BONUS THAT IS A PLAIN DRAW.
 *
 * Pluto's owner bonus is «draw 1, then discard 1», and the console renders that
 * per-colony sequence in its own ZONE. Miranda's is just «возьмите карту» — no
 * discard, no sequence, no zone — and that is exactly what broke: the reveal
 * split the batch's bonus wave out of the strip unconditionally, so a bonus
 * card with no zone to receive it rendered in NEITHER place. No slot meant no
 * landing target for the trade covers and nowhere for the take to fly from:
 * the player saw an empty stage with a card name under it and «Взять» did
 * nothing.
 *
 * This probe is the fence. It plays an animal card (Miranda's activation
 * gate), builds a colony there, trades with it, and asserts the payout is a
 * REAL card on the stage that can actually be taken.
 */

const OUT = path.resolve('screenshots', 'colony-miranda');

/** Pets: an animal card cheap enough to buy in the initial deal, and the
 *  activation Miranda waits for. `customProjectCards` puts it on TOP of the
 *  deck, so the deal always offers it (a seed search is a coin flip). */
const PETS = 'Pets';

const CFG = soloGameConfig({
  expansions: {colonies: true},
  customProjectCards: [PETS],
  // Miranda plus resource colonies: the solo setup removal can take one and
  // Miranda still survives into the action phase (`keepColony`).
  customColoniesList: ['Miranda', 'Luna', 'Triton', 'Callisto'],
  // A calm corporation with money and no colony/animal interference.
  customCorporationsList: ['CrediCor'],
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: CFG});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return model.players[0].id;
}

async function openColoniesAndFocus(page: Page, target: string): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  expect(await colonies.count(), 'colonies section did not open').toBeGreaterThan(0);
  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${target}"]`);
  for (let i = 0; i < 10 && await focused.count() === 0; i++) {
    await press(page, 'ArrowRight', 380);
  }
  for (let i = 0; i < 4 && await focused.count() === 0; i++) {
    await press(page, 'ArrowDown', 380);
    for (let j = 0; j < 5 && await focused.count() === 0; j++) {
      await press(page, 'ArrowLeft', 320);
    }
  }
  expect(await focused.count(), `could not focus ${target}`).toBeGreaterThan(0);
}

test.describe.configure({mode: 'serial'});

test('Miranda OWNER BONUS: the drawn card is on the stage and can be taken', async ({page, request}) => {
  test.setTimeout(480_000);
  await bootSeededGame(page, request, await createGame(request), {cards: [PETS], buy: 2, keepColony: 'Miranda'});

  // ── 1 · Activate Miranda (an animal card must be in play). ───────────────
  expect(await playCardFromHand(page, PETS), 'Pets was never played (Miranda stays inactive)').toBeTruthy();
  await page.waitForTimeout(1500);

  // ── 2 · Build a colony on Miranda (the standard project) — the viewer must
  //      OWN a settlement there for the trade to pay them an owner bonus. ──
  await press(page, 'Comma', 1200);
  await press(page, 'Enter', 1400);
  expect(await page.locator('.con-stdp').count(), 'standard projects did not open').toBeGreaterThan(0);
  const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
  const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < 18 && !/колони/i.test(await focusedName()); i++) {
    await press(page, walk[i % walk.length], 300);
  }
  expect(/колони/i.test(await focusedName()), 'could not focus the colony standard project').toBeTruthy();
  await press(page, 'Enter', 1800);
  await page.waitForSelector('.con-colonies', {timeout: 15_000});
  await openColoniesAndFocus(page, 'Miranda');
  await press(page, 'Enter', 2000);
  await press(page, 'Enter', 2600); // A = build confirm
  // The build bonus is an ANIMAL onto Pets — no reveal, no cards. Let it settle.
  await page.waitForTimeout(3500);
  await shoot(page, '01-built');

  // ── 3 · Trade with Miranda: income = animals onto Pets, owner bonus = the
  //      card this probe is about. ───────────────────────────────────────────
  await openColoniesAndFocus(page, 'Miranda');
  await press(page, 'Enter', 2000);
  expect(await page.locator('.con-colfocus').count(), 'the trade stage did not open').toBeGreaterThan(0);
  await page.keyboard.press('KeyX'); // confirm the trade

  // THE CARD MUST BE ON THE STAGE. The bug rendered a reveal with a title, a
  // status line naming the card — and nothing in the strip.
  //
  // ⚠️ The verdict is the FOCUSED slot, not a visible node: a held card (the
  // covers are still flying, the reveal is veiled) has a box and passes
  // `toBeVisible` while the pad is still locked — pressing A there is
  // swallowed and reads as «the take is dead».
  await page.waitForSelector('.con-reveal .con-cards__slot--focused', {timeout: 30_000});
  const revealCard = page.locator('.con-reveal [data-zoom-slot] :is(.card-container, .pcard)');
  await expect(revealCard.first(), 'the owner-bonus card never rendered in the reveal')
    .toBeVisible({timeout: 30_000});
  // …and the cover flight must have HANDED OVER before the take: while the
  // covers are airborne the real cards are held invisible under them and the
  // pad is deliberately absorbing presses (the beat-in-flight contract), so
  // pressing here would be swallowed and read as «the take is dead».
  await expect(page.locator('.con-reveal--bonus-held'), 'the covers never released the real card')
    .toHaveCount(0, {timeout: 30_000});
  await shoot(page, '02-bonus-reveal');

  const box = await revealCard.first().boundingBox();
  expect(box, 'the bonus card has no box').not.toBeNull();
  expect(box?.width ?? 0, 'the bonus card rendered collapsed').toBeGreaterThan(60);
  // …and it presents INSIDE the colony workspace, like every other payout.
  expect(await page.locator('.con-colonies .con-reveal, .con-colfocus .con-reveal').count(),
    'the payout did not present inside the colony workspace').toBeGreaterThan(0);

  // ── 4 · «Взять» must actually take it: the card leaves the reveal and the
  //      dock's count grows (the take used to be a dead press — with no slot
  //      the intake flight had no origin and never committed). ──────────────
  const handCount = async (): Promise<number> => {
    const txt = (await page.locator('.con-handdock__count, .con-handdock').first().textContent().catch(() => '')) ?? '';
    const m = /(\d+)\s*\/\s*(\d+)/.exec(txt.replace(/\s+/g, ' '));
    return m === null ? -1 : Number(m[2]);
  };
  const before = await handCount();
  const diag = async () => page.evaluate(() => {
    const fn = (window as unknown as {__conColonyDiag?: () => Record<string, unknown>}).__conColonyDiag;
    return fn === undefined ? {} : fn();
  });
  console.log('── before the take ──', JSON.stringify(await diag()));
  await press(page, 'Enter', 3200); // A = take
  console.log('── after the take ──', JSON.stringify(await diag()));
  await page.waitForTimeout(2500);
  await shoot(page, '03-after-take');
  await expect(page.locator('.con-reveal'), 'the reveal never closed after the take')
    .toHaveCount(0, {timeout: 20_000});
  const after = await handCount();
  if (before >= 0 && after >= 0) {
    expect(after, `the taken card never reached the hand (${before} → ${after})`).toBeGreaterThan(before);
  }

  // ── 5 · …and the resolution closes itself: the track glide is the last beat
  //      and the workspace goes home on its own. ──────────────────────────────
  await expect(page.locator('.con-colonies'), 'the colony workspace never closed after the payout')
    .toHaveCount(0, {timeout: 25_000});
  await shoot(page, '04-closed');
});

import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, bootFixtureSeats, closeZoomViewer, crumbText, fetchPlayerModel, openCardActions, openMandatoryAnnounce, openQuickWheel, openZoomViewer, press,
  pressUntil, reloadConsole, sendPlayerInput, settle, takeRevealCards, waitForBoardHome, walkFocusUntil,
} from './consoleStart';

/**
 * THE PARLIAMENT v2 (Turmoil Redux) — the reworked overview and the ONE
 * execution point of every party action:
 *
 *   · the overview shows OBJECTS and STATES, never rule paragraphs: no voting
 *     note, no «effect for everyone» sentence, no Agenda legend, no party
 *     detail zone — six party PLAQUES in one row with the mechanic on the
 *     plaque, the chairman quest as its own block;
 *   · the fullscreen inspector (X) of a party shows the PLAQUE as its own
 *     subject beside a rules panel that FITS without a scroll;
 *   · A on a party opens the action workspace INSIDE the Parliament
 *     («ПАРЛАМЕНТ › <партия> › НАСТРОЙКА»); B returns to the Parliament with
 *     the focus on that very party; the same composer opens from the action
 *     menu («ДЕЙСТВИЯ КАРТ › <партия> › НАСТРОЙКА»);
 *   · the Industrialists' TOTAL row reads the whole operation on one pool;
 *   · the Reds: draw → the embedded reveal in the action workspace → the
 *     mandatory discard as a HAND STEP of the same workspace → the payout
 *     beat → the flow leaves.
 */

const OUT_ROOT = path.resolve('screenshots', 'parliament-v2');

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

const parliament = (page: Page) => page.locator('.con-parl');
const pact = (page: Page, kind: string) => page.locator(`.con-pact[data-pact="${kind}"]`);

/** Open the Parliament from the wheel (RT → down). */
async function openParliament(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await parliament(page).count() === 0; i++) {
    await openQuickWheel(page);
    await press(page, 'ArrowDown', 1400);
  }
  await expect(parliament(page)).toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 15_000});
}

const partyFocused = (page: Page) => page.evaluate(() => document.querySelector('.con-parl__party--focus')?.getAttribute('data-party') ?? '');

/** In «ДЕЙСТВИЯ КАРТ»: steer the cursor onto a PARTY's action tile by geometry (the menu is a 2-D grid). */
async function focusPartyTile(page: Page, party: string): Promise<void> {
  const focused = () => page.evaluate(() => {
    const tile = document.querySelector('.con-cardactions__tile--focused');
    return tile?.getAttribute('data-action-party') ?? tile?.getAttribute('data-action-card') ?? '';
  });
  await expect(page.locator(`.con-cardactions__tile[data-action-party="${party}"]`), `the «${party}» tile is in the menu`).toHaveCount(1);
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
}

/** Walk the parties row onto `party` (positive witness on every step). */
async function focusParty(page: Page, party: string): Promise<void> {
  const zone = () => parliament(page).getAttribute('data-zone');
  if (await zone() !== 'parties') {
    await press(page, 'ArrowDown', 400);
  }
  expect(await walkFocusUntil(page, async () => await partyFocused(page) === party, () => partyFocused(page), 14),
    `never focused the «${party}» plaque`).toBeTruthy();
}

/** Nothing readable is cut, no block spills, nothing leaves the viewport. */
async function expectFits(page: Page, label: string): Promise<void> {
  const problems = await page.evaluate(() => {
    const root = document.querySelector('.con-parl');
    if (root === null) {
      return ['no root'];
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out: Array<string> = [];
    const name = (el: Element) => el.className.toString().split(' ')[0];
    const visible = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const blocks = '.con-parl__gov, .con-parl__slot, .con-parl__tally, .con-parl__rail, .con-parl__party, .con-parl__pline, .con-parl__agenda, .con-parl__stage, .con-parl__quest';
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(blocks))) {
      if (!visible(el)) {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) {
        out.push(`off-screen ${name(el)} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)}`);
      }
      if (el.scrollHeight > el.clientHeight + 2 && !el.classList.contains('con-parl__stage')) {
        out.push(`spills ${name(el)} ${el.scrollHeight}>${el.clientHeight}`);
      }
    }
    const reading = '.con-pseal__name, .con-pseal__state, .con-parl__tally-row, .con-parl__tally-note, .con-parl__rail-row, ' +
      '.con-parl__quest-text, .con-parl__quest-reward, .con-parl__slot-win, .con-parl__kicker, .con-parl__pline-text, ' +
      '.con-parl__recap-item, .con-parl__txn-row, .con-parl__consequences li';
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(reading))) {
      if (!visible(el)) {
        continue;
      }
      if (el.scrollWidth > el.clientWidth + 1) {
        out.push(`cut ${name(el)}: ${(el.textContent ?? '').trim().slice(0, 48)}`);
      }
      const tier = el.closest<HTMLElement>('.con-parl__gov, .con-parl__stage, .con-parl__party, .con-parl__slot, .con-parl__rail, .con-parl__pline');
      if (tier !== null) {
        const t = tier.getBoundingClientRect();
        const e = el.getBoundingClientRect();
        if (e.bottom > t.bottom + 2 || e.top < t.top - 2 || e.right > t.right + 1) {
          out.push(`clipped ${name(el)} in ${name(tier)}: ${(el.textContent ?? '').trim().slice(0, 48)}`);
        }
      }
    }
    return out;
  });
  expect(problems, `${label}: every parliament block fits, nothing read is cut`).toEqual([]);
}

/** The inspector's rules body needs no scroll (the panel's whole point). */
async function expectRulesFit(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const scroll = document.querySelector<HTMLElement>('.con-zoom-rules__scroll');
    if (scroll === null) {
      return 'no rules panel';
    }
    const inner = scroll.querySelector<HTMLElement>('.con-zoom-rules__body') ?? scroll;
    return inner.scrollHeight > scroll.clientHeight + 2 ? `${inner.scrollHeight} > ${scroll.clientHeight}` : '';
  });
  expect(overflow, `${label}: the rules panel fits without a scroll`).toBe('');
}

/** The overview carries NO rule paragraphs. */
async function expectNoRuleProse(page: Page): Promise<void> {
  const text = (await parliament(page).textContent() ?? '').replace(/\s+/g, ' ');
  for (const fragment of ['Побеждает больше делегатов', 'Эффект есть у всех', 'Пронумерованные шаги', 'У вас есть:', 'Раз за поколение']) {
    expect(text, `no rule prose on the overview: «${fragment}»`).not.toContain(fragment);
  }
  await expect(page.locator('.con-parl__pdetail'), 'the detail zone is gone').toHaveCount(0);
}

/** The nested composer fits: nothing of it leaves the viewport; the commit row and every decision row stand inside it. */
async function expectComposerFits(page: Page, label: string): Promise<void> {
  const problems = await page.evaluate(() => {
    const out: Array<string> = [];
    const root = document.querySelector('.con-pact')?.getBoundingClientRect();
    const cta = document.querySelector('[data-pact-cta]')?.getBoundingClientRect();
    if (root === undefined || cta === undefined) {
      return ['missing composer / commit row'];
    }
    if (root.bottom > window.innerHeight + 1 || root.right > window.innerWidth + 1 || root.top < -1 || root.left < -1) {
      out.push(`composer off-screen ${Math.round(root.left)},${Math.round(root.top)} ${Math.round(root.right)},${Math.round(root.bottom)}`);
    }
    if (cta.bottom > root.bottom + 1 || cta.top < root.top - 1) {
      out.push(`commit row ${Math.round(cta.top)}..${Math.round(cta.bottom)} outside the composer ${Math.round(root.top)}..${Math.round(root.bottom)}`);
    }
    for (const row of Array.from(document.querySelectorAll<HTMLElement>('.con-pact__row'))) {
      const r = row.getBoundingClientRect();
      if (r.bottom > root.bottom + 1 || r.top < root.top - 1) {
        out.push(`a decision row runs past the composer (${Math.round(r.top)}..${Math.round(r.bottom)})`);
      }
    }
    return out;
  });
  expect(problems, `${label}: the party action composer fits`).toEqual([]);
}

type Seat = {megacredits: number, cardsInHandNbr: number, megacreditProduction: number, energyProduction: number, tableau: Array<{name: string, resources?: number}>};

async function seatOf(request: APIRequestContext, playerId: string): Promise<{seat: Seat, uses: Record<string, number>, waitingFor?: {type?: string, options?: Array<{title: string}>}}> {
  const model = await fetchPlayerModel(request, playerId) as unknown as {
    thisPlayer: Seat, game: {parliament: {viewer: {partyActions: Array<{id: string, usesLeft: number}>}}}, waitingFor?: {type?: string, options?: Array<{title: string}>},
  };
  const uses: Record<string, number> = {};
  for (const a of model.game.parliament.viewer.partyActions) {
    uses[a.id] = a.usesLeft;
  }
  return {seat: model.thisPlayer, uses, waitingFor: model.waitingFor};
}

async function passSeat(request: APIRequestContext, playerId: string): Promise<void> {
  const {waitingFor} = await seatOf(request, playerId);
  const options = waitingFor?.options ?? [];
  const index = options.findIndex((o) => String(o.title).startsWith('Pass for this generation'));
  expect(index, 'the opponent holds the action menu with a pass option').toBeGreaterThanOrEqual(0);
  await sendPlayerInput(request, playerId, {type: 'or', index, response: {type: 'option'}});
}

for (const preset of [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const) {
  test.describe(`parliament v2 · overview · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});
    test(`the overview is objects and states; the party inspector fits; the Parliament door nests the action workspace (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixture(page, request, 'parliament', {query: preset.query});
      await openParliament(page);
      await expect(page.locator('.con-parl__party .con-pseal'), 'six plaques').toHaveCount(6);
      await expect(page.locator('[data-parl-tally]')).toHaveCount(3);
      await expect(page.locator('[data-parl-quest] .con-parl__quest-cond .pcard__mech'), 'the quest condition is a graphic').toHaveCount(1);
      await expect(page.locator('[data-parl-quest-reward]')).toContainText(/Кресло/);
      await expectNoRuleProse(page);
      await expectFits(page, preset.id);
      await shoot(page, preset.id, '01-browse');

      // The focus rail: the forecast of the next delegate (state + consequence).
      await press(page, 'ArrowRight', 500);
      await expect(page.locator('[data-parl-rail] .con-parl__rail-row')).not.toHaveCount(0);
      await expectFits(page, preset.id);
      await shoot(page, preset.id, '02-focus-forecast');

      // The vote stage.
      await press(page, 'Enter', 900);
      await expect(page.locator('.con-parl__stage')).toHaveCount(1);
      await expect(page.locator('[data-parl-consequences] .con-parl__consequences-kicker')).toContainText(/Прогноз/i);
      await expectFits(page, preset.id);
      await shoot(page, preset.id, '03-vote-stage');
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-parl__stage').count() === 0, {tries: 3, settleMs: 700})).toBeTruthy();

      // The parties: the Scientists' plaque (held by two delegates in this fixture).
      await focusParty(page, 'Scientists');
      await expect(page.locator('.con-parl__party--focus .con-pseal--delegates'), 'the state ring reads «your effect»').toHaveCount(1);
      await expectFits(page, preset.id);
      await shoot(page, preset.id, '04-party-focus');

      // X: the party is its own subject in the viewer, beside a rules panel that fits.
      await openZoomViewer(page);
      await expect(page.locator('.con-zoom .con-pseal--full'), 'the party plaque is the subject').toHaveCount(1);
      await expect(page.locator('.con-zoom-rules').first()).toBeVisible({timeout: 10_000});
      await expect(page.locator('.con-zoom-rules'), 'no English inside the Russian rules').not.toContainText(/Add 2 data|Scientists —|Reds —/);
      await expectRulesFit(page, `${preset.id} party`);
      await shoot(page, preset.id, '05-inspect-party');
      await closeZoomViewer(page);
      expect(await partyFocused(page), 'the inspector returns the focus where it was').toBe('Scientists');

      // The resolution inspector fits too.
      await press(page, 'ArrowUp', 500);
      await openZoomViewer(page);
      await expect(page.locator('.con-zoom .pcard')).not.toHaveCount(0);
      await expect(page.locator('.con-zoom-rules'), 'a dummy states its one fact calmly').not.toContainText(/нулевой итерации|тестовая/i);
      await expectRulesFit(page, `${preset.id} resolution`);
      await shoot(page, preset.id, '06-inspect-resolution');
      await closeZoomViewer(page);

      // THE DOOR, BLOCKED: in this fixture the Scientists' action has no
      // target («no card stores data or microbes») — the row's line names
      // the reason, A says it again as a notice, and nothing opens.
      await focusParty(page, 'Scientists');
      await expect(page.locator('[data-parl-pline]'), 'the reason stands under the row').not.toHaveText('');
      await press(page, 'Enter', 700);
      await expect(page.locator('.con-cardactions'), 'a blocked action opens nothing').toHaveCount(0);
      await expect(page.locator('.con-notice'), 'the notice names the reason').toBeVisible();
      await shoot(page, preset.id, '07-blocked-door');
    });

    test(`the Parliament's door nests the action workspace; B returns to the party (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'parliament-actions', {query: preset.query});
      await openParliament(page);
      await focusParty(page, 'Scientists');
      expect(await pressUntil(page, 'Enter', async () => await pact(page, 'scientists').count() > 0, {tries: 3, settleMs: 1200}),
        'A on the party opens its composer').toBeTruthy();
      await settle(page, {timeoutMs: 10_000});
      const crumb = (await crumbText(page)).toUpperCase();
      expect(crumb, `one crumb rooted at the Parliament (${crumb})`).toContain('ПАРЛАМЕНТ');
      expect(crumb).toContain('НАСТРОЙКА');
      await expect(page.locator('.con-cardactions'), 'the action workspace stands inside the Parliament').toHaveCount(1);
      await expect(page.locator('.con-pact .con-pseal--hero'), 'the party plaque is the hero').toHaveCount(1);
      await expectComposerFits(page, preset.id);
      await shoot(page, preset.id, '08-party-action-from-parliament');
      // B: back into the Parliament, focus untouched.
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-cardactions').count() === 0, {tries: 3, settleMs: 1000}),
        'B leaves the nested action workspace').toBeTruthy();
      await settle(page, {timeoutMs: 10_000});
      await expect(parliament(page)).toBeVisible();
      expect(await partyFocused(page), 'the focus is on the party the player came from').toBe('Scientists');
      await shoot(page, preset.id, '09-back-in-parliament');
    });
  });
}

test.describe('parliament v2 · one execution point, two doors · the Reds in full', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('Industrialists (menu: total row) · Scientists (Parliament door, returns to the Parliament) · Reds (draw → embedded reveal → hand step → payout)', async ({page, request}) => {
    test.setTimeout(480_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-actions', {query: '&consoleProfile=auto'});
    const opponent = seats[1];
    const preset = 'flow-1080';

    // ── INDUSTRIALISTS from the action menu ──
    await openCardActions(page);
    await focusPartyTile(page, 'Industrialists');
    const before = (await seatOf(request, playerId)).seat;
    expect(await pressUntil(page, 'Enter', async () => await pact(page, 'industrialists').count() > 0, {tries: 3, settleMs: 1100})).toBeTruthy();
    await settle(page, {timeoutMs: 8_000});
    expect((await crumbText(page)).toUpperCase()).toContain('ДЕЙСТВИЯ КАРТ');
    await expect(page.locator('[data-pact-cta][data-pact-ready]'), 'the commit row is not ready before the decisions').toHaveCount(0);
    await shoot(page, preset, '10-industrialists-open');
    // Pick M€ decrease (the first option), then M€ increase (the first option): ONE pool → ONE total chip.
    await press(page, 'Enter', 500);
    await expect(page.locator('.con-pact__opt--picked')).toHaveCount(1);
    await press(page, 'Enter', 500);
    await expect(page.locator('.con-pact__opt--picked')).toHaveCount(2);
    await expect(page.locator('[data-pact-total] .action-chip, [data-pact-total] [class*="chip"]').first(), 'the total row is on screen').toBeVisible();
    const total = (await page.locator('[data-pact-total]').textContent() ?? '').replace(/\s+/g, ' ');
    expect(total, `the total reads the net result of one pool (${total})`).toMatch(/→/);
    await expect(page.locator('[data-pact-cta][data-pact-ready]'), 'the commit row is ready now').toHaveCount(1);
    await shoot(page, preset, '11-industrialists-total');
    await press(page, 'Enter', 900);
    await expect.poll(async () => (await seatOf(request, playerId)).uses['industrialists-shift'], {timeout: 20_000}).toBe(0);
    const after = (await seatOf(request, playerId)).seat;
    expect(after.megacreditProduction + after.energyProduction - before.megacreditProduction - before.energyProduction).toBe(1);
    await waitForBoardHome(page, 30);
    await expect(page.locator('.con-cardactions')).toHaveCount(0);

    // ── SCIENTISTS from the Parliament — the flow ends back in the Parliament ──
    await openParliament(page);
    await focusParty(page, 'Scientists');
    expect(await pressUntil(page, 'Enter', async () => await pact(page, 'scientists').count() > 0, {tries: 3, settleMs: 1200})).toBeTruthy();
    await settle(page, {timeoutMs: 8_000});
    expect((await crumbText(page)).toUpperCase()).toContain('ПАРЛАМЕНТ');
    await press(page, 'Enter', 500); // the resource under the cursor → the target row
    await press(page, 'Enter', 500); // the target card → the commit row
    await expect(page.locator('.con-pact__opt--picked, .con-pact__card--picked')).toHaveCount(2);
    await shoot(page, preset, '12-scientists-from-parliament');
    await press(page, 'Enter', 900);
    await expect.poll(async () => (await seatOf(request, playerId)).seat.tableau.find((c) => c.name === 'Tardigrades')?.resources ?? -1, {timeout: 20_000}).toBe(2);
    await expect.poll(async () => await page.locator('.con-cardactions').count(), {timeout: 20_000, message: 'the action workspace leaves'}).toBe(0);
    await settle(page, {timeoutMs: 10_000});
    await expect(parliament(page), 'a flow opened from the Parliament ends in the Parliament').toBeVisible();
    await expect(page.locator('.con-parl__party[data-party="Scientists"][data-action-state="used"]'), 'the plaque reads «used»').toHaveCount(1);
    await shoot(page, preset, '13-back-in-parliament-used');
    expect(await pressUntil(page, 'Escape', async () => await parliament(page).count() === 0, {tries: 4, settleMs: 900})).toBeTruthy();
    await settle(page);

    // Two actions spent — the opponent passes; blue is back on.
    await passSeat(request, opponent);
    await expect.poll(async () => (await seatOf(request, playerId)).waitingFor?.type, {timeout: 20_000}).toBe('or');
    await settle(page, {timeoutMs: 15_000});

    // ── REDS from the action menu: ONE workspace from the draw to the payout ──
    await openCardActions(page);
    const beforeReds = (await seatOf(request, playerId)).seat;
    await focusPartyTile(page, 'Reds');
    expect(await pressUntil(page, 'Enter', async () => await pact(page, 'reds').count() > 0, {tries: 3, settleMs: 1100})).toBeTruthy();
    await settle(page, {timeoutMs: 8_000});
    await shoot(page, preset, '14-reds-open');
    await press(page, 'Enter', 1500); // the commit row: the draw happens now
    await expect.poll(async () => (await seatOf(request, playerId)).uses['reds-recycle'], {timeout: 20_000, message: 'the Reds action is spent at the draw'}).toBe(0);
    // The reveal presents INSIDE the action workspace, in the composer's zone.
    await expect(page.locator('.con-cardactions .con-pact__revealzone .con-reveal'), 'the drawn cards land in the composer zone').toHaveCount(1, {timeout: 20_000});
    await settle(page, {timeoutMs: 15_000});
    await expect(page.locator('.con-reveal:not(.con-reveal--embedded)'), 'never a standalone reveal').toHaveCount(0);
    await shoot(page, preset, '15-reds-embedded-reveal');
    await takeRevealCards(page);
    // The discard is a HAND STEP of the same workspace — the hand mounts inside the composer zone.
    await expect(page.locator('.con-cardactions .con-pact__handzone .con-hand--discard'), 'the mandatory discard stands inside the action workspace').toHaveCount(1, {timeout: 30_000});
    await settle(page, {timeoutMs: 15_000});
    const crumbDiscard = (await crumbText(page)).toUpperCase();
    expect(crumbDiscard, `the crumb names the step (${crumbDiscard})`).toContain('СБРОС');
    await expect(page.locator('.con-hand__discard')).toContainText(/Красные/);
    await shoot(page, preset, '16-reds-hand-step');
    await press(page, 'Enter', 300);
    await press(page, 'ArrowRight', 250);
    await press(page, 'Enter', 300);
    await press(page, 'Period', 1200); // RT — confirm the set
    await expect.poll(async () => (await seatOf(request, playerId)).waitingFor?.type, {timeout: 30_000}).not.toBe('card');
    // The payout beat, then the flow leaves.
    await expect(page.locator('[data-pact-result]'), 'the closing beat reads the payout').toHaveCount(1, {timeout: 20_000});
    await shoot(page, preset, '17-reds-payout');
    await waitForBoardHome(page, 40);
    await expect(page.locator('.con-cardactions')).toHaveCount(0);
    const afterReds = (await seatOf(request, playerId)).seat;
    expect(afterReds.cardsInHandNbr, 'drew 2, discarded 2').toBe(beforeReds.cardsInHandNbr);
    expect(afterReds.megacredits).toBeGreaterThanOrEqual(beforeReds.megacredits);
    await shoot(page, preset, '18-after-reds');
  });

  test('the Reds flow survives a collapse (B → board → A) and a reload mid-discard: the workspace resumes around the hand step', async ({page, request}) => {
    test.setTimeout(360_000);
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-actions', {query: '&consoleProfile=auto'});
    const preset = 'restore-1080';
    await openCardActions(page);
    const before = (await seatOf(request, playerId)).seat;
    await focusPartyTile(page, 'Reds');
    expect(await pressUntil(page, 'Enter', async () => await pact(page, 'reds').count() > 0, {tries: 3, settleMs: 1100})).toBeTruthy();
    await settle(page, {timeoutMs: 8_000});
    await press(page, 'Enter', 1500); // the draw
    await expect.poll(async () => (await seatOf(request, playerId)).uses['reds-recycle'], {timeout: 20_000}).toBe(0);
    await expect(page.locator('.con-cardactions .con-pact__revealzone .con-reveal')).toHaveCount(1, {timeout: 20_000});
    await settle(page, {timeoutMs: 15_000});
    await takeRevealCards(page);
    const handStep = page.locator('.con-cardactions .con-pact__handzone .con-hand--discard');
    await expect(handStep, 'the discard stands inside the action workspace').toHaveCount(1, {timeout: 30_000});
    await settle(page, {timeoutMs: 15_000});

    // COLLAPSE: B on the mandatory step parks the WHOLE workspace (the decision
    // stays owed); the board-home card is the one way back.
    expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-cardactions').count() === 0, {tries: 3, settleMs: 1000}),
      'B collapses the workspace').toBeTruthy();
    await settle(page, {timeoutMs: 10_000});
    await expect(page.locator('.con-mandatory'), 'the deferred decision stands on the board home').toBeVisible({timeout: 15_000});
    await shoot(page, preset, '20-collapsed');
    // RESTORE: A brings the same stage back — the hand step inside the composer, the crumb's tail intact.
    expect(await pressUntil(page, 'Enter', async () => await handStep.count() > 0, {tries: 3, settleMs: 1500}),
      'A restores the hand step inside the workspace').toBeTruthy();
    await settle(page, {timeoutMs: 10_000});
    expect((await crumbText(page)).toUpperCase()).toContain('СБРОС');
    await shoot(page, preset, '21-restored');

    // RELOAD mid-discard: the server still owes the discard. After the reload
    // nothing of the workspace exists on the client, so the plate announces
    // the decision; A RESUMES the action workspace around the hand step.
    await reloadConsole(page);
    expect(await openMandatoryAnnounce(page), 'the discard is announced after the reload; A opens it').toBeTruthy();
    await expect(handStep, 'the workspace resumed around the hand step').toHaveCount(1, {timeout: 30_000});
    await settle(page, {timeoutMs: 15_000});
    const crumb = (await crumbText(page)).toUpperCase();
    expect(crumb, `the resumed workspace's crumb (${crumb})`).toContain('ДЕЙСТВИЯ КАРТ');
    expect(crumb).toContain('СБРОС');
    await shoot(page, preset, '22-resumed-after-reload');
    await press(page, 'Enter', 300);
    await press(page, 'ArrowRight', 250);
    await press(page, 'Enter', 300);
    await press(page, 'Period', 1200); // RT — confirm the set
    await expect.poll(async () => (await seatOf(request, playerId)).waitingFor?.type, {timeout: 30_000}).not.toBe('card');
    await expect(page.locator('[data-pact-result]'), 'the closing beat plays in the resumed workspace').toHaveCount(1, {timeout: 20_000});
    await shoot(page, preset, '23-payout-after-resume');
    await waitForBoardHome(page, 40);
    await expect(page.locator('.con-cardactions')).toHaveCount(0);
    expect((await seatOf(request, playerId)).seat.cardsInHandNbr, 'drew 2, discarded 2').toBe(before.cardsInHandNbr);
  });
});

import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, bootFixtureSeats, closeZoomViewer, crumbText, fetchPlayerModel, openCardActions, openQuickWheel, openZoomViewer, press,
  pressUntil, reloadConsole, sendPlayerInput, settle, takeRevealCards, waitForBoardHome, walkFocusUntil,
} from './consoleStart';

/**
 * THE PARLIAMENT v2 (Turmoil Redux) — the reworked overview, the VOTE STEP
 * and the ONE execution point of every party action:
 *
 *   · the overview shows OBJECTS and STATES: the government (the enacted
 *     card as the main object — an honest empty seat before the first
 *     political phase — and the ruler's badge), the voting area in tie order
 *     with a tally per card (no V-labels), the SEATS ledger (every player's
 *     lobby socket and reserve), six party PLAQUES in one row, the Agenda;
 *   · X on a resolution lifts THAT card into the fullscreen viewer (the slot
 *     is held empty — never a source under the dim beside a copy) and offers
 *     the same «Голос» verb the overview's A has;
 *   · A (from the overview OR from the viewer) opens the VOTE STEP — a phase
 *     descent: the pressed card is CARRIED into the hero column, the decision
 *     surface beside it states the delegate's source and cost, the card's
 *     delegates with the place the new one takes, and ONLY what changes;
 *     B folds the same phrase back with the card and the focus restored;
 *   · A sends the delegate from its real place (the lobby's socket or the
 *     reserve) onto the card, the counters tick on the landing, the flow
 *     LEAVES; a double press cannot send two;
 *   · a PAID vote's bill stands INSIDE the step (never a band), survives a
 *     collapse → restore and a reload, and the second own delegate unlocks
 *     the party effect (the forecast says so before, the plaque after);
 *   · off the viewer's turn the Parliament reads and A names why it cannot
 *     vote; the parties' door nests the action workspace (the actions spec
 *     drives the flows in full).
 */

const OUT_ROOT = path.resolve('screenshots', 'parliament-v2');
const VIDEO = process.env.PARL_VIDEO === '1';
// Recordings of the motion (PARL_VIDEO=1): Playwright allows the video option only at the file's top level.
if (VIDEO) {
  test.use({video: {mode: 'on', size: {width: 1920, height: 1080}}});
}

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

const parliament = (page: Page) => page.locator('.con-parl');
const voteStep = (page: Page) => page.locator('.con-parl__vote');
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
const slotFocused = (page: Page) => page.evaluate(() => document.querySelector('.con-parl__slot--focus')?.getAttribute('data-instance') ?? '');

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
  for (let i = 0; i < 3 && await zone() !== 'parties'; i++) {
    await press(page, 'ArrowDown', 400);
  }
  expect(await walkFocusUntil(page, async () => await partyFocused(page) === party, () => partyFocused(page), 14),
    `never focused the «${party}» plaque`).toBeTruthy();
}

/** Walk the voting area onto slot `index` (0 = closest to the government). */
async function focusSlot(page: Page, index: number): Promise<void> {
  const zone = () => parliament(page).getAttribute('data-zone');
  for (let i = 0; i < 3 && await zone() !== 'voting'; i++) {
    await press(page, 'ArrowUp', 400);
  }
  const at = () => page.evaluate(() => {
    const slots = Array.from(document.querySelectorAll('.con-parl__slot'));
    return slots.findIndex((s) => s.classList.contains('con-parl__slot--focus'));
  });
  for (let i = 0; i < 6 && await at() !== index; i++) {
    await press(page, (await at()) < index ? 'ArrowRight' : 'ArrowLeft', 300);
  }
  expect(await at(), `never focused voting slot ${index}`).toBe(index);
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
    const blocks = '.con-parl__gov, .con-parl__slot, .con-parl__tally, .con-parl__seats, .con-parl__party, .con-parl__pline, .con-parl__agenda, ' +
      '.con-parl__stage, .con-parl__quest, .con-parl__vote-surface, .con-parl__vote-hero, .con-parl__vote-row, .con-parl__vote-forecast';
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
    const reading = '.con-pseal__name, .con-pseal__state-text, .con-parl__tally-row, .con-parl__tally-note, .con-parl__seat, .con-parl__ruler-name, ' +
      '.con-parl__quest-text, .con-parl__quest-reward, .con-parl__slot-win, .con-parl__slot-party, .con-parl__kicker, .con-parl__pline-text, ' +
      '.con-parl__recap-item, .con-parl__txn-row, .con-parl__vote-fact-key, .con-parl__vote-fact-val, .con-parl__vote-source-text, .con-parl__vote-key';
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(reading))) {
      if (!visible(el)) {
        continue;
      }
      if (el.scrollWidth > el.clientWidth + 1) {
        out.push(`cut ${name(el)}: ${(el.textContent ?? '').trim().slice(0, 48)}`);
      }
      const tier = el.closest<HTMLElement>('.con-parl__gov, .con-parl__stage, .con-parl__party, .con-parl__slot, .con-parl__seats, .con-parl__pline, .con-parl__vote-surface');
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

/** The overview carries NO rule paragraphs and no V-labels. */
async function expectNoRuleProse(page: Page): Promise<void> {
  const text = (await parliament(page).textContent() ?? '').replace(/\s+/g, ' ');
  for (const fragment of ['Побеждает больше делегатов', 'Эффект есть у всех', 'Пронумерованные шаги', 'У вас есть:', 'Раз за поколение', 'Прогноз при текущем']) {
    expect(text, `no rule prose on the overview: «${fragment}»`).not.toContain(fragment);
  }
  expect(text, 'no V1/V2/V3 labels').not.toMatch(/\bV[123]\b/);
  await expect(page.locator('.con-parl__rail'), 'the forecast rail is gone').toHaveCount(0);
}

/** How many copies of the resolution's face are VISIBLE on the whole page (the viewer's included). */
async function visibleFacesOf(page: Page, resolutionId: string): Promise<number> {
  return page.evaluate((id) => {
    const faces = Array.from(document.querySelectorAll<HTMLElement>(`[data-zoom-slot="resolution:${id}"] .pcard, .con-zoom .pcard`));
    let n = 0;
    for (const face of faces) {
      const r = face.getBoundingClientRect();
      const cs = getComputedStyle(face);
      if (r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05) {
        let hidden = false;
        for (let el: HTMLElement | null = face; el !== null; el = el.parentElement) {
          if (getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') {
            hidden = true;
            break;
          }
        }
        if (!hidden) {
          n++;
        }
      }
    }
    return n;
  }, resolutionId);
}

type Seat = {megacredits: number, heat: number, cardsInHandNbr: number, megacreditProduction: number, energyProduction: number, tableau: Array<{name: string, resources?: number}>};
type ParlWire = {
  slots: Array<{party: string, resolution: string, totalVotes: number, viewerVotes: number, leader?: string, isWinning: boolean, votes: Array<{owner: string}>}>,
  rulingParty: string, enacted?: {resolutionId: string},
  players: Array<{color: string, lobby: boolean, reserve: number, participates: boolean, access: Array<{party: string, hasEffect: boolean}>}>,
  viewer?: {vote: {available: boolean, source: string, cost: number}, partyActions: Array<{id: string, usesLeft: number}>},
};

async function seatOf(request: APIRequestContext, playerId: string): Promise<{seat: Seat, parl: ParlWire, color: string, waitingFor?: {type?: string, options?: Array<{title: string}>}}> {
  const model = await fetchPlayerModel(request, playerId) as unknown as {
    thisPlayer: Seat & {color: string}, game: {parliament: ParlWire}, waitingFor?: {type?: string, options?: Array<{title: string}>},
  };
  return {seat: model.thisPlayer, parl: model.game.parliament, color: model.thisPlayer.color, waitingFor: model.waitingFor};
}

async function passSeat(request: APIRequestContext, playerId: string): Promise<void> {
  const {waitingFor} = await seatOf(request, playerId);
  const options = waitingFor?.options ?? [];
  const index = options.findIndex((o) => String(o.title).startsWith('Pass for this generation'));
  expect(index, 'the opponent holds the action menu with a pass option').toBeGreaterThanOrEqual(0);
  await sendPlayerInput(request, playerId, {type: 'or', index, response: {type: 'option'}});
}

const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

for (const preset of PRESETS) {
  test.describe(`parliament v2 · the overview and the vote step · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`overview → X → back · A → prep · X inside prep · B restores · X → A → the same prep · the free vote lands and the flow leaves (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const playerId = await bootFixture(page, request, 'parliament', {query: preset.query});
      await openParliament(page);
      const before = (await seatOf(request, playerId)).parl;
      const slot0 = before.slots[0];

      // ── THE OVERVIEW: objects and states.
      await expect(page.locator('.con-parl__party .con-pseal'), 'six plaques').toHaveCount(6);
      await expect(page.locator('[data-parl-tally]')).toHaveCount(3);
      await expect(page.locator('[data-parl-gov-empty]'), 'an honest empty seat before the first political phase').toHaveCount(1);
      await expect(page.locator('[data-parl-ruler]'), 'the ruler\'s badge').toContainText(/Зелёные/);
      await expect(page.locator('[data-parl-seats] .con-parl__seat'), 'the seats ledger: one row per player').toHaveCount(2);
      await expect(page.locator(`[data-parl-seat-lobby="${before.players[0].color}"] .player-cube, [data-parl-seat-lobby="${before.players[1].color}"] .player-cube`),
        'a free delegate stands in a lobby socket').not.toHaveCount(0);
      await expect(page.locator('[data-parl-quest] .con-parl__quest-cond .pcard__mech'), 'the quest condition is a graphic').toHaveCount(1);
      await expect(page.locator('[data-parl-quest-reward]')).toContainText(/Кресло/);
      await expect(page.locator('[data-parl-reward-step]'), 'the reward names the viewer\'s next Agenda step').toHaveCount(1);
      await expect(page.locator('.con-parl__slot.con-parl__slot--winning .con-parl__slot-win'), 'exactly one card reads «побеждает»').toHaveCount(1);
      await expectNoRuleProse(page);
      await expectFits(page, preset.id);
      await shoot(page, preset.id, '01-browse');

      // ── X: the card lifts out of its slot (the slot is held empty), the
      //    viewer offers the vote verb, the rules panel fits; back restores.
      const focusedBefore = await slotFocused(page);
      await openZoomViewer(page);
      await expect(page.locator('.con-zoom .pcard')).not.toHaveCount(0);
      await expect(page.locator('.con-parl__slot--focus .con-zoom-hold'), 'the slot\'s own card is held while it is in the viewer').toHaveCount(1);
      expect(await visibleFacesOf(page, slot0.resolution), 'one physical card: the viewer\'s, never a copy beside the source').toBe(1);
      await expect(page.locator('.con-zoom__btn--play'), 'the viewer offers the vote').toContainText(/Голос/i);
      await expectRulesFit(page, `${preset.id} resolution`);
      await shoot(page, preset.id, '02-inspect-resolution');
      await closeZoomViewer(page);
      await settle(page, {timeoutMs: 8_000});
      await expect(page.locator('.con-parl .con-zoom-hold'), 'the hold is released on the way back').toHaveCount(0);
      expect(await slotFocused(page), 'the focus is where it was').toBe(focusedBefore);

      // ── A: the VOTE STEP — the card carried, the decision beside it.
      await press(page, 'Enter', 1200);
      await expect(voteStep(page), 'the vote step stands').toHaveCount(1);
      await settle(page, {timeoutMs: 8_000});
      expect((await crumbText(page)).toUpperCase(), 'the crumb names the step').toContain('ГОЛОС');
      await expect(page.locator('.con-parl__slot--carried'), 'the pressed slot keeps its place, its card carried').toHaveCount(1);
      await expect(page.locator('[data-parl-vote-card] .pcard'), 'the hero is the card').toHaveCount(1);
      expect(await visibleFacesOf(page, slot0.resolution), 'one physical card in the step').toBe(1);
      await expect(page.locator('[data-parl-vote-source]'), 'the delegate\'s real source').toContainText(/лобби/i);
      await expect(page.locator('[data-parl-fact="votes"]')).toContainText(new RegExp(`${slot0.totalVotes}\\s*→\\s*${slot0.totalVotes + 1}`));
      await expect(page.locator('[data-parl-fact="mine"]')).toContainText(/0\s*→\s*1/);
      await expect(page.locator('[data-parl-vote-place]'), 'the place the delegate will take').toHaveCount(1);
      await expect(page.locator('.con-parl__stage'), 'no second vote surface (the old stage is gone)').toHaveCount(0);
      await expectFits(page, `${preset.id} prep`);
      await shoot(page, preset.id, '03-vote-prep');

      // ── X INSIDE THE PREP: the hero lifts into the viewer and comes back; the prepared context is untouched.
      await openZoomViewer(page);
      await expect(page.locator('[data-parl-vote-card] .con-zoom-hold'), 'the hero is the held source').toHaveCount(1);
      await expect(page.locator('.con-zoom__btn--play'), 'no second vote verb inside the vote').toHaveCount(0);
      await shoot(page, preset.id, '04-inspect-in-prep');
      await closeZoomViewer(page);
      await settle(page, {timeoutMs: 8_000});
      await expect(voteStep(page), 'the prep survives the inspector').toHaveCount(1);
      await expect(page.locator('[data-parl-fact="votes"]')).toContainText(new RegExp(`${slot0.totalVotes}\\s*→\\s*${slot0.totalVotes + 1}`));

      // ── B: the same phrase folds back — the card returns to its slot, the focus is where it was.
      expect(await pressUntil(page, 'Escape', async () => await voteStep(page).count() === 0, {tries: 3, settleMs: 900}), 'B folds the vote step').toBeTruthy();
      await settle(page, {timeoutMs: 8_000});
      await expect(page.locator('.con-parl__slot--carried'), 'the slot\'s card is back').toHaveCount(0);
      expect(await visibleFacesOf(page, slot0.resolution), 'one card, back in its slot').toBe(1);
      expect(await slotFocused(page), 'the focus is where it was').toBe(focusedBefore);
      expect(await parliament(page).getAttribute('data-stage')).toBe('browse');
      await shoot(page, preset.id, '05-prep-cancelled');

      // ── X → A: the SAME prep from the fullscreen — the card flies from the viewer into the hero slot.
      await openZoomViewer(page);
      await press(page, 'Enter', 1500);
      await expect(voteStep(page), 'A in the viewer opens the vote step').toHaveCount(1, {timeout: 10_000});
      await expect(page.locator('dialog.con-zoom[open]'), 'the viewer has handed the card over').toHaveCount(0, {timeout: 10_000});
      await settle(page, {timeoutMs: 8_000});
      await expect(page.locator('[data-parl-vote-card] .pcard')).toHaveCount(1);
      expect(await visibleFacesOf(page, slot0.resolution), 'one physical card after the handoff').toBe(1);
      await expect(page.locator('[data-parl-fact="votes"]')).toContainText(new RegExp(`${slot0.totalVotes}\\s*→\\s*${slot0.totalVotes + 1}`));
      await shoot(page, preset.id, '06-prep-from-viewer');

      // ── A: the delegate leaves the lobby, lands on the card, the counters
      //    tick, the flow leaves. A second press in the same beat sends nothing.
      const me = (await seatOf(request, playerId)).color;
      // Two presses in one beat: the second lands while the first is in flight (the step absorbs it by phase).
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await expect(page.locator('.con-parl__vote--landed, .con-parl__vote--committed'), 'the step commits').toHaveCount(1, {timeout: 10_000});
      await expect.poll(async () => (await seatOf(request, playerId)).parl.slots[0].viewerVotes, {timeout: 20_000, message: 'the delegate landed on slot 1'}).toBe(slot0.viewerVotes + 1);
      const landed = page.locator('.con-parl__vote--landed');
      if (await landed.count() > 0) {
        await shoot(page, preset.id, '07-landed');
      }
      await waitForBoardHome(page, 40);
      await expect(parliament(page), 'a finished vote leaves the workspace').toHaveCount(0);
      const after = (await seatOf(request, playerId)).parl;
      expect(after.slots[0].totalVotes, 'exactly ONE delegate was sent (the double press sent nothing)').toBe(slot0.totalVotes + 1);
      expect(after.players.find((p) => p.color === me)?.lobby, 'the lobby delegate was spent').toBe(false);
      await shoot(page, preset.id, '08-after-vote');

      // ── The overview after the vote: the ledger reads the empty lobby socket.
      await openParliament(page);
      await expect(page.locator(`[data-parl-seat-lobby="${me}"] .player-cube`), 'the viewer\'s lobby socket is empty now').toHaveCount(0);
      await expect(page.locator('.con-parl__slot').nth(0)).toHaveAttribute('data-votes', String(slot0.totalVotes + 1));
      await expectFits(page, `${preset.id} after`);
      await shoot(page, preset.id, '09-overview-after-vote');
    });
  });
}

test.describe('parliament v2 · the paid vote · the bill inside the step · the second delegate unlocks the effect', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('reserve source and cost · lead + effect forecast · the bill embedded · collapse → restore · reload · pay → the delegate lands from the reserve → the plaque reads «yours»', async ({page, request}) => {
    test.setTimeout(420_000);
    const playerId = await bootFixture(page, request, 'parliament-paid', {query: '&consoleProfile=auto'});
    const preset = 'paid-1080';
    await openParliament(page);
    const before = await seatOf(request, playerId);
    const slot0 = before.parl.slots[0];
    expect(before.parl.viewer?.vote.source, 'the free delegate is spent: the vote comes from the reserve').toBe('reserve');
    expect(slot0.viewerVotes, 'one own delegate stands on the first card').toBe(1);
    const party0 = slot0.party;

    // The plaque states: «1 of 2» on the first card's party, «yours» on the second's.
    await expect(page.locator(`.con-parl__party[data-party="${party0}"][data-party-state="progress"]`), 'the party reads «1 of 2»').toHaveCount(1);
    await expect(page.locator(`.con-parl__party[data-party="${party0}"] .con-pseal__place--on`), 'one of the two places holds the viewer\'s cube').toHaveCount(1);
    await expect(page.locator(`.con-parl__party[data-party="${before.parl.slots[1].party}"][data-party-state="delegates"]`), 'the second card\'s party is held').toHaveCount(1);
    await expect(page.locator(`[data-parl-seat-lobby="${before.color}"] .player-cube`), 'the lobby socket is empty').toHaveCount(0);
    await expectFits(page, preset);
    await shoot(page, preset, '10-browse');

    // ── A: the prep reads the reserve, the cost, the lead change and the effect unlock.
    await focusSlot(page, 0);
    await press(page, 'Enter', 1200);
    await expect(voteStep(page)).toHaveCount(1);
    await settle(page, {timeoutMs: 8_000});
    await expect(page.locator('[data-parl-vote-source]')).toContainText(/резерва/i);
    await expect(page.locator('[data-parl-vote-source] .con-parl__vote-cost'), 'the cost chip').toHaveCount(1);
    await expect(page.locator('[data-parl-fact="votes"]')).toContainText(/2\s*→\s*3/);
    await expect(page.locator('[data-parl-fact="mine"]')).toContainText(/1\s*→\s*2/);
    await expect(page.locator('[data-parl-fact="lead"]'), 'the lead changes hands').toHaveCount(1);
    await expect(page.locator('[data-parl-fact="access"]'), 'the party effect becomes the viewer\'s').toHaveCount(1);
    await expectFits(page, `${preset} prep`);
    await shoot(page, preset, '11-paid-prep');

    // ── A: the bill stands INSIDE the step — never a band over it.
    await press(page, 'Enter', 1500);
    const bill = page.locator('.con-parl__vote [data-embed-slot="parliament-vote"] .con-task-host--embedded');
    await expect(bill, 'the payment panel stands in the step\'s zone').toHaveCount(1, {timeout: 20_000});
    await expect(page.locator('.con-task-host:not(.con-task-host--embedded)'), 'never a standalone payment band').toHaveCount(0);
    await expect(parliament(page)).toHaveAttribute('data-stage', 'paying');
    expect((await crumbText(page)).toUpperCase()).toContain('ОПЛАТА');
    await settle(page, {timeoutMs: 8_000});
    await expectFits(page, `${preset} bill`);
    await shoot(page, preset, '12-bill-inside-step');

    // ── B: the bill is owed — the whole workspace COLLAPSES to the board; A brings the same step back.
    expect(await pressUntil(page, 'Escape', async () => !await parliament(page).isVisible(), {tries: 3, settleMs: 1000}), 'B collapses the Parliament around the bill').toBeTruthy();
    await settle(page, {timeoutMs: 10_000});
    await expect(page.locator('.con-mandatory'), 'the owed bill stands on the board home').toBeVisible({timeout: 15_000});
    await shoot(page, preset, '13-bill-collapsed');
    expect(await pressUntil(page, 'Enter', async () => await bill.count() > 0, {tries: 3, settleMs: 1500}), 'A restores the step with its bill').toBeTruthy();
    await settle(page, {timeoutMs: 10_000});
    await expect(parliament(page)).toHaveAttribute('data-stage', 'paying');
    await expect(page.locator('.con-parl__slot--carried'), 'the card is still carried').toHaveCount(1);
    await shoot(page, preset, '14-bill-restored');

    // ── RELOAD mid-bill: the server still owes the payment; the step re-forms around it.
    await reloadConsole(page);
    await expect(bill, 'the Parliament re-opens around the bill by itself; the vote step resumed').toHaveCount(1, {timeout: 30_000});
    await expect(page.locator('.con-task-host:not(.con-task-host--embedded)'), 'never a standalone band after the reload').toHaveCount(0);
    await settle(page, {timeoutMs: 10_000});
    await expect(page.locator('[data-parl-vote-card] .pcard'), 'the carried card is back in the hero column').toHaveCount(1);
    await expect(page.locator('[data-parl-fact="votes"]')).toContainText(/2\s*→\s*3/);
    await shoot(page, preset, '15-bill-after-reload');

    // ── PAY: the delegate leaves the reserve, lands, the flow leaves; the plaque reads «yours».
    await press(page, 'KeyX', 1500);
    await expect.poll(async () => (await seatOf(request, playerId)).parl.slots[0].viewerVotes, {timeout: 30_000, message: 'the second delegate landed'}).toBe(2);
    const paid = await seatOf(request, playerId);
    expect(paid.seat.megacredits + paid.seat.heat, 'the bill was settled from the viewer\'s pools').toBeLessThan(before.seat.megacredits + before.seat.heat);
    expect(paid.parl.players.find((p) => p.color === before.color)?.reserve, 'one delegate left the reserve').toBe((before.parl.players.find((p) => p.color === before.color)?.reserve ?? 0) - 1);
    expect(paid.parl.players.find((p) => p.color === before.color)?.access.find((a) => a.party === party0)?.hasEffect, 'the party effect is the viewer\'s now').toBe(true);
    await waitForBoardHome(page, 40);
    await openParliament(page);
    await expect(page.locator(`.con-parl__party[data-party="${party0}"][data-party-state="delegates"]`), 'the plaque reads «yours»').toHaveCount(1);
    await expect(page.locator('.con-parl__slot').nth(0)).toHaveAttribute('data-votes', '3');
    await shoot(page, preset, '16-after-paid-vote');
  });
});

test.describe('parliament v2 · a crowded table · the vote that is not possible', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the Parliament reads a crowded table: ties, a neutral majority, the winner, the seats — and A names why the vote is not possible', async ({page, request}) => {
    test.setTimeout(180_000);
    const playerId = await bootFixture(page, request, 'parliament-dense', {query: '&consoleProfile=auto'});
    await openParliament(page);
    const stage = page.locator('.con-parl__stage');
    if (await stage.count() > 0) {
      expect(await pressUntil(page, 'Enter', async () => await stage.count() === 0, {tries: 3, settleMs: 800}), 'the results let the player through').toBeTruthy();
      await settle(page, {timeoutMs: 10_000});
    }
    const model = await seatOf(request, playerId);
    expect(model.parl.viewer?.vote.available, 'no delegate of the viewer is left to send').toBe(false);
    const preset = 'dense-1080';
    // Neutral delegates and players' delegates: one system — cubes; the neutral ones in steel.
    await expect(page.locator('.con-parl__ribbon .player-cube--steel, .con-parl__vote-stack .player-cube--steel'), 'neutral delegates read as steel cubes').not.toHaveCount(0);
    await expect(page.locator('.con-parl__slot.con-parl__slot--winning'), 'one winning card').toHaveCount(1);
    await expect(page.locator('.con-parl__slot--winning .con-parl__tally-note--win'), 'the tie is explained on the card').toHaveCount(1);
    await expect(page.locator('[data-parl-gov] .con-parl__gov-card .pcard'), 'the enacted card is the government\'s main object').toHaveCount(1);
    await expect(page.locator('[data-parl-seats] .con-parl__seat')).toHaveCount(5);
    await expect(page.locator('[data-parl-seat-chair]'), 'the chairman\'s seat is on the ledger').toHaveCount(1);
    await expectFits(page, preset);
    await shoot(page, preset, '20-dense-offturn');
    // A on a card off-turn: nothing opens; the reason is named once.
    await press(page, 'Enter', 800);
    await expect(voteStep(page), 'no vote step without a delegate to send').toHaveCount(0);
    await expect(page.locator('.con-notice'), 'the notice names the reason').toBeVisible();
    await shoot(page, preset, '21-dense-blocked-vote');
    // The parties: several effects held at once; the used action stamped on its badge.
    await press(page, 'ArrowDown', 500);
    expect(await page.locator('.con-parl__party--held').count(), 'several party effects at once').toBeGreaterThanOrEqual(3);
    await expect(page.locator('.con-parl__party[data-action-state="used"] .con-pseal__action-mark'), 'the used action is stamped').toHaveCount(1);
    await expectFits(page, preset);
    await shoot(page, preset, '22-dense-parties');
  });
});

test.describe('parliament v2 · the parties\' door', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('A on a party nests the action workspace inside the Parliament; B returns to the party', async ({page, request}) => {
    test.setTimeout(180_000);
    await bootFixtureSeats(page, request, 'parliament-actions', {query: '&consoleProfile=auto'});
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
    await shoot(page, 'door-1080', '30-party-action-from-parliament');
    expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-cardactions').count() === 0, {tries: 3, settleMs: 1000}),
      'B leaves the nested action workspace').toBeTruthy();
    await settle(page, {timeoutMs: 10_000});
    await expect(parliament(page)).toBeVisible();
    expect(await partyFocused(page), 'the focus is on the party the player came from').toBe('Scientists');
    await shoot(page, 'door-1080', '31-back-in-parliament');
  });
});

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
    await shoot(page, preset, '40-industrialists-open');
    await press(page, 'Enter', 500);
    await expect(page.locator('.con-pact__opt--picked')).toHaveCount(1);
    await press(page, 'Enter', 500);
    await expect(page.locator('.con-pact__opt--picked')).toHaveCount(2);
    const total = (await page.locator('[data-pact-total]').textContent() ?? '').replace(/\s+/g, ' ');
    expect(total, `the total reads the net result of one pool (${total})`).toMatch(/→/);
    await expect(page.locator('[data-pact-cta][data-pact-ready]'), 'the commit row is ready now').toHaveCount(1);
    await shoot(page, preset, '41-industrialists-total');
    await press(page, 'Enter', 900);
    const usesOf = async (id: string) => (await seatOf(request, playerId)).parl.viewer?.partyActions.find((a) => a.id === id)?.usesLeft;
    await expect.poll(async () => await usesOf('industrialists-shift'), {timeout: 20_000}).toBe(0);
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
    await press(page, 'Enter', 500);
    await press(page, 'Enter', 500);
    await expect(page.locator('.con-pact__opt--picked, .con-pact__card--picked')).toHaveCount(2);
    await shoot(page, preset, '42-scientists-from-parliament');
    await press(page, 'Enter', 900);
    await expect.poll(async () => (await seatOf(request, playerId)).seat.tableau.find((c) => c.name === 'Tardigrades')?.resources ?? -1, {timeout: 20_000}).toBe(2);
    await expect.poll(async () => await page.locator('.con-cardactions').count(), {timeout: 20_000, message: 'the action workspace leaves'}).toBe(0);
    await settle(page, {timeoutMs: 10_000});
    await expect(parliament(page), 'a flow opened from the Parliament ends in the Parliament').toBeVisible();
    await expect(page.locator('.con-parl__party[data-party="Scientists"][data-action-state="used"]'), 'the plaque reads «used»').toHaveCount(1);
    await shoot(page, preset, '43-back-in-parliament-used');
    expect(await pressUntil(page, 'Escape', async () => await parliament(page).count() === 0, {tries: 4, settleMs: 900})).toBeTruthy();
    await settle(page);

    // ── OFF THE VIEWER'S TURN (two actions spent): the Parliament reads, A names why it cannot vote.
    await openParliament(page);
    await expect(page.locator('.con-parl__party[data-party="Scientists"][data-action-state="used"]'), 'the plaque keeps the used state').toHaveCount(1);
    await focusSlot(page, 0);
    await press(page, 'Enter', 800);
    await expect(voteStep(page), 'no vote step off-turn').toHaveCount(0);
    await expect(page.locator('.con-notice'), 'the notice names the turn').toContainText(/ход/i);
    await shoot(page, preset, '43b-off-turn');
    expect(await pressUntil(page, 'Escape', async () => await parliament(page).count() === 0, {tries: 4, settleMs: 900})).toBeTruthy();
    await settle(page);

    await passSeat(request, opponent);
    await expect.poll(async () => (await seatOf(request, playerId)).waitingFor?.type, {timeout: 20_000}).toBe('or');
    await settle(page, {timeoutMs: 15_000});

    // ── REDS from the action menu: ONE workspace from the draw to the payout ──
    await openCardActions(page);
    const beforeReds = (await seatOf(request, playerId)).seat;
    await focusPartyTile(page, 'Reds');
    expect(await pressUntil(page, 'Enter', async () => await pact(page, 'reds').count() > 0, {tries: 3, settleMs: 1100})).toBeTruthy();
    await settle(page, {timeoutMs: 8_000});
    await shoot(page, preset, '44-reds-open');
    await press(page, 'Enter', 1500);
    await expect.poll(async () => await usesOf('reds-recycle'), {timeout: 20_000, message: 'the Reds action is spent at the draw'}).toBe(0);
    await expect(page.locator('.con-cardactions .con-pact__revealzone .con-reveal'), 'the drawn cards land in the composer zone').toHaveCount(1, {timeout: 20_000});
    await settle(page, {timeoutMs: 15_000});
    await expect(page.locator('.con-reveal:not(.con-reveal--embedded)'), 'never a standalone reveal').toHaveCount(0);
    await shoot(page, preset, '45-reds-embedded-reveal');
    await takeRevealCards(page);
    await expect(page.locator('.con-cardactions .con-pact__handzone .con-hand--discard'), 'the mandatory discard stands inside the action workspace').toHaveCount(1, {timeout: 30_000});
    await settle(page, {timeoutMs: 15_000});
    expect((await crumbText(page)).toUpperCase()).toContain('СБРОС');
    await shoot(page, preset, '46-reds-hand-step');
    await press(page, 'Enter', 300);
    await press(page, 'ArrowRight', 250);
    await press(page, 'Enter', 300);
    await press(page, 'Period', 1200);
    await expect.poll(async () => (await seatOf(request, playerId)).waitingFor?.type, {timeout: 30_000}).not.toBe('card');
    await expect(page.locator('[data-pact-result]'), 'the closing beat reads the payout').toHaveCount(1, {timeout: 20_000});
    await shoot(page, preset, '47-reds-payout');
    await waitForBoardHome(page, 40);
    await expect(page.locator('.con-cardactions')).toHaveCount(0);
    const afterReds = (await seatOf(request, playerId)).seat;
    expect(afterReds.cardsInHandNbr, 'drew 2, discarded 2').toBe(beforeReds.cardsInHandNbr);
    expect(afterReds.megacredits).toBeGreaterThanOrEqual(beforeReds.megacredits);
  });
});

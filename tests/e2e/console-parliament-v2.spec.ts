import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, bootFixtureSeats, closeZoomViewer, crumbText, fetchPlayerModel, openCardActions, openQuickWheel, openZoomViewer, press,
  pressUntil, reloadConsole, sendPlayerInput, settle, takeRevealCards, waitForBoardHome, walkFocusUntil,
} from './consoleStart';

/**
 * THE PARLIAMENT v4 (Turmoil Redux) — the overview with ONE voting focus zone,
 * the VOTE MODE (three cards compared inside one screen) and the ONE
 * execution point of every party action:
 *
 *   · the overview shows OBJECTS and STATES: the government (the enacted
 *     card as the main object — an honest empty seat before the first
 *     political phase — the ruler's readable effect), the voting area as ONE
 *     focus zone with the three cards in tie order and a tally per card, the
 *     SEATS ledger (every player's lobby socket and reserve — counted once),
 *     six party PLAQUES with their mechanic, the read-only Agenda;
 *   · X on the voting area lifts the cards into the fullscreen viewer (the
 *     shown card's slot is held empty — never a copy beside the source) and
 *     offers the same «Голос» verb the overview's A has;
 *   · A (from the overview OR from the viewer) opens the VOTE MODE: the SAME
 *     three slot elements travel into a row (one physical card each), the
 *     viewer's lobby socket and reserve stack come up onto the BENCH, and the
 *     info surface explains the SELECTED card — its own effect, what enacting
 *     it changes, its quest — apart from what THIS VOTE changes; ◀ ▶ switch
 *     the card without reordering the row, X inspects it in place, B folds the
 *     same phrase back with every object home and the focus restored;
 *   · A sends the delegate: its cube leaves the bench's real socket, lands on
 *     the card's ribbon, the counters tick, the flow LEAVES; a double press
 *     cannot send two;
 *   · a PAID vote's bill stands INSIDE the mode (never a band), survives a
 *     collapse → restore and a reload, and the second own delegate unlocks
 *     the party effect (the facts say so before, the plaque after);
 *   · off the viewer's turn the mode still opens for READING and names why
 *     the vote is not possible; the parties' door nests the action workspace.
 */

const OUT_ROOT = path.resolve('screenshots', 'parliament-v5');
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
const voteMode = (page: Page) => page.locator('.con-parl__vote.con-parl__vote--up');
const rowSlots = (page: Page) => page.locator('.con-parl__vrow .con-parl__slot');
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
const selectedInstance = (page: Page) => page.evaluate(() => document.querySelector('.con-parl__slot--selected')?.getAttribute('data-instance') ?? '');
const rowOrder = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll('.con-parl__vrow .con-parl__slot')).map((s) => s.getAttribute('data-instance')));
const infoName = (page: Page) => page.evaluate(() => (document.querySelector('.con-parl__info-res [data-parl-vote-body] .con-parl__info-name')?.textContent ?? '').trim());
/** The footer at rest: the plate and each group's box (left + width) — a page turn may change their text, never these. */
const footerGeometry = (page: Page) => page.evaluate(() => ['.card-zoom-actions__panel', '.con-rstatus', '.con-zoom__vote', '.con-zoom__cmd--flip', '.con-zoom__bar > .con-zoom__btn:last-child'].map((sel) => {
  const r = document.querySelector(`dialog.con-zoom[open] ${sel}`)?.getBoundingClientRect();
  return r === undefined ? `${sel}: none` : `${sel}: ${Math.round(r.left)}+${Math.round(r.width)}`;
}));
/** The card the fullscreen viewer is showing (its face's resolution slug). */
const viewerCard = (page: Page) => page.evaluate(() => {
  const face = document.querySelector('dialog.con-zoom[open] .card-zoom-stage .pcard');
  return face === null ? '' : Array.from(face.classList).find((c) => c.startsWith('pcard--rdx-')) ?? '';
});

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

/** Put the cursor on the voting area (one zone). */
async function focusVoting(page: Page): Promise<void> {
  const zone = () => parliament(page).getAttribute('data-zone');
  for (let i = 0; i < 4 && await zone() !== 'voting'; i++) {
    await press(page, (await zone()) === 'government' ? 'ArrowRight' : 'ArrowUp', 400);
  }
  expect(await zone(), 'the voting area is the focus zone').toBe('voting');
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
    const blocks = '.con-parl__gov, .con-parl__slot, .con-parl__slot-empty, .con-parl__tally, .con-parl__seats, .con-parl__seat, .con-parl__party, .con-parl__pline, .con-parl__agenda, ' +
      '.con-parl__stage, .con-parl__quest, .con-parl__info, .con-parl__info-block, .con-parl__fact, .con-parl__cta, ' +
      // The bill inside the mode: the shared payment panel must stand whole in the vote column (it once ran past it on the right).
      '.con-parl__vote .con-task-host--embedded .con-pay';
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(blocks))) {
      if (!visible(el)) {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) {
        out.push(`off-screen ${name(el)} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)}`);
      }
      if (el.scrollHeight > el.clientHeight + 2 && !el.classList.contains('con-parl__stage') && !el.classList.contains('con-parl__info-body')) {
        out.push(`spills ${name(el)} ${el.scrollHeight}>${el.clientHeight}`);
      }
      if (el.classList.contains('con-pay') && el.scrollWidth > el.clientWidth + 2) {
        out.push(`spills-x ${name(el)} ${el.scrollWidth}>${el.clientWidth}`);
      }
    }
    const reading = '.con-pseal__name, .con-pseal__state-text, .con-parl__tally-row, .con-parl__seat, .con-parl__ruler-name, .con-parl__ruler-scope, .con-parl__info-scope, .con-parl__cta-cost, ' +
      '.con-parl__quest-text, .con-parl__quest-reward, .con-parl__slot-win, .con-parl__slot-party, .con-parl__kicker, .con-parl__pline-text, ' +
      '.con-parl__recap-item, .con-parl__txn-row, .con-parl__fact-key, .con-parl__fact-val, .con-parl__info-name, .con-parl__info-kicker, ' +
      '.con-parl__seat-name, .con-parl__seat-key, .con-parl__info-src-text, .con-parl__cta-label, .con-parl__slot-empty-reason';
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(reading))) {
      if (!visible(el)) {
        continue;
      }
      if (el.scrollWidth > el.clientWidth + 1) {
        out.push(`cut ${name(el)}: ${(el.textContent ?? '').trim().slice(0, 48)}`);
      }
      const tier = el.closest<HTMLElement>('.con-parl__gov, .con-parl__stage, .con-parl__party, .con-parl__slot, .con-parl__slot-empty, .con-parl__seats, .con-parl__pline, .con-parl__info');
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

/**
 * The three slots share ONE grid: every row (label · card · ribbon · tally)
 * starts at the same y in every slot, whatever the count or the words — a
 * card never moves because its neighbour's line wrapped.
 */
async function expectUniformGrid(page: Page, label: string): Promise<void> {
  const rows = await page.evaluate(() => {
    const slots = Array.from(document.querySelectorAll<HTMLElement>('.con-parl__slot'));
    const tops = (sel: string) => slots.map((s) => Math.round(s.querySelector(sel)?.getBoundingClientRect().top ?? -1));
    const heights = (sel: string) => slots.map((s) => Math.round(s.querySelector(sel)?.getBoundingClientRect().height ?? -1));
    return {label: tops('.con-parl__slot-label'), card: tops('.con-parl__card .pcard'), ribbon: tops('.con-parl__ribbon'), tally: tops('.con-parl__tally'), cardH: heights('.con-parl__card .pcard')};
  });
  for (const [row, tops] of Object.entries(rows)) {
    expect(new Set(tops).size, `${label}: the ${row} row stands at one y in every slot (${tops.join(', ')})`).toBe(1);
  }
}

/** The inspector's reading bodies need no scroll (the panels' whole point) — the party column's text block included. */
async function expectRulesFit(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const scrolls = Array.from(document.querySelectorAll<HTMLElement>('dialog.con-zoom[open] .con-zoom-rules__scroll'));
    if (scrolls.length === 0) {
      return 'no rules panel';
    }
    const out: Array<string> = [];
    for (const scroll of scrolls) {
      const inner = scroll.querySelector<HTMLElement>('.con-zoom-rules__body') ?? scroll;
      if (inner.scrollHeight > scroll.clientHeight + 2) {
        out.push(`${inner.scrollHeight} > ${scroll.clientHeight}`);
      }
    }
    // …and every column stands INSIDE the viewport: two columns beside the
    // card once overran the Deck's edges by 30 px each (the fit engine and the
    // stylesheet disagreed about the column width there).
    for (const column of Array.from(document.querySelectorAll<HTMLElement>('dialog.con-zoom[open] .card-zoom-aside, dialog.con-zoom[open] .card-zoom-side'))) {
      const r = column.getBoundingClientRect();
      if (r.left < -1 || r.right > window.innerWidth + 1) {
        out.push(`off-screen ${column.className}: ${Math.round(r.left)}..${Math.round(r.right)} of ${window.innerWidth}`);
      }
    }
    return out.join('; ');
  });
  expect(overflow, `${label}: every reading panel fits without a scroll and inside the viewport`).toBe('');
}

/** A resolution id as its face's class slug. */
const slug = (resolution: string) => resolution.toLowerCase().replaceAll('_', '-');

/**
 * THE RESOLUTION SCENE in the viewer: every reading body fits; both side
 * columns stand CENTRED on the card (the project card's composition — or
 * fill the band when they are that long); and no reading block draws a
 * graphic (the card prints it; only the party plaque carries its formula).
 */
async function expectInspectorScene(page: Page, label: string): Promise<void> {
  // A RESTING property: a browse step slides the card (translate + rotate +
  // scale) and lifts the columns in, so the read is polled until it holds.
  const read = () => page.evaluate(() => {
    const out: Array<string> = [];
    const card = document.querySelector('dialog.con-zoom[open] .card-zoom-stage .pcard')?.getBoundingClientRect();
    if (card === undefined || card.height < 2) {
      return 'no card on the stage';
    }
    const mid = card.top + card.height / 2;
    for (const sel of ['.con-zoom-asidecol', '.con-zoom-sidecol']) {
      const col = document.querySelector<HTMLElement>(`dialog.con-zoom[open] ${sel}`);
      if (col === null) {
        out.push(`no ${sel}`);
        continue;
      }
      const kids = Array.from(col.children).map((k) => k.getBoundingClientRect()).filter((r) => r.height > 0);
      if (kids.length === 0) {
        out.push(`${sel} is empty`);
        continue;
      }
      const top = Math.min(...kids.map((r) => r.top));
      const bottom = Math.max(...kids.map((r) => r.bottom));
      const fills = bottom - top >= col.getBoundingClientRect().height - 2;
      const off = Math.abs((top + bottom) / 2 - mid);
      if (!fills && off > Math.max(4, card.height * 0.02)) {
        out.push(`${sel} centre is ${Math.round(off)} px off the card's (content ${Math.round(top)}..${Math.round(bottom)}, card ${Math.round(card.top)}..${Math.round(card.bottom)})`);
      }
    }
    // THE FOOTER: every item INSIDE its bar (an overflow of a centred or
    // right-anchored row goes past an edge `scrollWidth` never reports), the
    // bar as wide as its items plus the gaps between them (no empty stretch),
    // the plate centred on the screen and clear of the card above it.
    const bar = document.querySelector('dialog.con-zoom[open] .con-zoom__bar');
    const panel = document.querySelector('dialog.con-zoom[open] .card-zoom-actions__panel');
    if (bar !== null && panel !== null) {
      const box = bar.getBoundingClientRect();
      const kids = Array.from(bar.children).map((kid) => ({kid, r: kid.getBoundingClientRect()})).filter((k) => k.r.width > 0);
      // …and nothing spills out of a reading plate the row squeezed (a caption
      // that overflows paints over its neighbour — the bar's own rect never shows it).
      const plates = Array.from(bar.querySelectorAll<HTMLElement>('.con-iyield__reading'));
      for (const plate of plates) {
        if (plate.scrollWidth > plate.clientWidth + 1) {
          out.push(`a footer reading spills (${plate.scrollWidth} > ${plate.clientWidth}): ${(plate.textContent ?? '').trim().slice(0, 40)}`);
        }
      }
      // …and no two plates overlap (a squeezed column lets its plates run into the next one).
      const rects = plates.map((plate) => plate.getBoundingClientRect());
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) {
            out.push(`footer readings ${i} and ${j} overlap`);
          }
        }
      }
      for (const {kid, r} of kids) {
        if (r.left < box.left - 1 || r.right > box.right + 1) {
          out.push(`footer item ${kid.className.toString().split(' ')[0]} outside the bar (${Math.round(r.left)}..${Math.round(r.right)} of ${Math.round(box.left)}..${Math.round(box.right)})`);
        }
      }
      const gap = parseFloat(getComputedStyle(bar).columnGap) || 0;
      const content = kids.reduce((sum, k) => sum + k.r.width, 0) + Math.max(0, kids.length - 1) * gap;
      if (box.width > content + 2) {
        out.push(`footer bar ${Math.round(box.width)} px wide for ${Math.round(content)} px of items and gaps`);
      }
      const plate = panel.getBoundingClientRect();
      const offCentre = Math.abs((plate.left + plate.right) / 2 - window.innerWidth / 2);
      if (offCentre > 2) {
        out.push(`footer plate ${Math.round(offCentre)} px off the screen centre`);
      }
      if (plate.top < card.bottom - 1) {
        out.push(`footer plate (top ${Math.round(plate.top)}) overlaps the card (bottom ${Math.round(card.bottom)})`);
      }
    }
    const graphics = document.querySelectorAll('dialog.con-zoom[open] .card-zoom-side .pcard__mech, dialog.con-zoom[open] .con-rinspect-aside__rules .pcard__mech');
    if (graphics.length > 0) {
      out.push(`${graphics.length} graphic(s) redrawn in the reading blocks`);
    }
    return out.join('; ');
  });
  await expect.poll(read, {timeout: 8_000, message: `${label}: the scene is centred and draws nothing twice`}).toBe('');
  await expectRulesFit(page, label);
}

/** The overview carries NO rule paragraphs, no V-labels, no second ledger of the viewer's delegates. */
async function expectNoRuleProse(page: Page): Promise<void> {
  const text = (await parliament(page).textContent() ?? '').replace(/\s+/g, ' ');
  for (const fragment of ['Побеждает больше делегатов', 'Эффект есть у всех', 'Пронумерованные шаги', 'У вас есть:', 'Раз за поколение', 'Прогноз при текущем', 'ближайшая к правительству — первая']) {
    expect(text, `no rule prose on the overview: «${fragment}»`).not.toContain(fragment);
  }
  expect(text, 'no V1/V2/V3 labels').not.toMatch(/\bV[123]\b/);
  await expect(page.locator('.con-parl__head [data-parl-delegates]'), 'the header counts no delegates — the ledger does, once').toHaveCount(0);
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
          const s = getComputedStyle(el);
          if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) < 0.05) {
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
  slots: Array<{instance: string, party: string, resolution: string, totalVotes: number, viewerVotes: number, leader?: string, isWinning: boolean, votes: Array<{owner: string}>}>,
  rulingParty: string, enacted?: {resolution: string},
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

/** Every carried object is ONE instance: no face is painted twice, no cube of the ribbons is doubled. */
async function expectOneOfEach(page: Page, parl: ParlWire, label: string): Promise<void> {
  for (const slot of parl.slots) {
    expect(await visibleFacesOf(page, slot.resolution), `${label}: one physical card for ${slot.resolution}`).toBe(1);
  }
  const ribbon = await page.evaluate(() => Array.from(document.querySelectorAll('.con-parl__slot')).map((s) => s.querySelectorAll('.con-parl__ribbon [data-seq]').length));
  expect(ribbon, `${label}: every delegate on its card, once`).toEqual(parl.slots.map((s) => s.votes.length));
}

const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

for (const preset of PRESETS) {
  test.describe(`parliament v4 · the overview and the vote mode · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`overview → X (three cards) → back · A → the mode · ◀ ▶ · X inside · B restores · X → A on the shown card · the free vote lands and the flow leaves (${preset.id})`, async ({page, request}) => {
      test.setTimeout(360_000);
      const playerId = await bootFixture(page, request, 'parliament', {query: preset.query});
      await openParliament(page);
      const before = (await seatOf(request, playerId)).parl;
      const slot0 = before.slots[0];
      const slot1 = before.slots[1];

      // ── THE OVERVIEW: objects and states, three focus zones.
      await expect(page.locator('.con-parl__party .con-pseal'), 'six plaques').toHaveCount(6);
      await expect(page.locator('.con-parl__party .con-pformula__mech'), 'every plaque prints its mechanic (every profile)').toHaveCount(6);
      await expect(page.locator('[data-parl-tally]')).toHaveCount(3);
      await expect(page.locator('[data-parl-gov-empty]'), 'an honest empty seat before the first political phase').toHaveCount(1);
      await expect(page.locator('[data-parl-ruler]'), 'the ruler\'s identity').toContainText(/Зелёные/);
      await expect(page.locator('[data-parl-ruler] .con-pformula__mech'), 'the ruling effect is a GRAPHIC here').toHaveCount(1);
      await expect(page.locator('[data-parl-ruler] .con-parl__ruler-rule'), 'no rule paragraph in the government — the inspector has the sentences').toHaveCount(0);
      await expect(page.locator('.con-parl__voting-lead'), 'the winner is named ONCE — on its slot, never a second line over the voting area').toHaveCount(0);
      expect((await crumbText(page)).toUpperCase(), 'the overview names itself on the head line').toContain('ОСМОТР');
      await expect(page.locator('[data-parl-seats] .con-parl__seat[data-parl-seat]'), 'the delegates zone: one group per player').toHaveCount(2);
      await expect(page.locator(`[data-parl-seat-lobby="${before.players[0].color}"] .player-cube, [data-parl-seat-lobby="${before.players[1].color}"] .player-cube`),
        'a free delegate stands in a lobby socket').not.toHaveCount(0);
      await expect(page.locator('[data-parl-quest] .con-parl__quest-cond .pcard__mech'), 'the quest condition is a graphic').toHaveCount(1);
      await expect(page.locator('[data-parl-quest-reward]')).toContainText(/Кресло/);
      await expect(page.locator('[data-parl-reward-step]'), 'the reward names the viewer\'s next Agenda step').toHaveCount(1);
      await expect(page.locator('.con-parl__slot.con-parl__slot--winning .con-parl__slot-win'), 'exactly one card reads «побеждает»').toHaveCount(1);
      await expect(page.locator('.con-parl__slot .pcard__quest-reward'), 'no reward marks repeated on the faces').toHaveCount(0);
      await expect(page.locator('.con-parl__voting--focus'), 'the voting area is ONE focus zone').toHaveCount(1);
      await expect(page.locator('.con-parl__slot--focus'), 'no per-card focus in the overview').toHaveCount(0);
      await expectNoRuleProse(page);
      await expectFits(page, preset.id);
      await expectOneOfEach(page, before, `${preset.id} overview`);
      await shoot(page, preset.id, '01-browse');

      // ── The Agenda is read-only: walking down from the parties never lands on it.
      await press(page, 'ArrowDown', 400);
      expect(await parliament(page).getAttribute('data-zone')).toBe('parties');
      for (let i = 0; i < 3; i++) {
        await press(page, 'ArrowDown', 250);
      }
      expect(await parliament(page).getAttribute('data-zone'), 'the Agenda is never a focus stop').toBe('parties');
      await focusVoting(page);

      // ── THE DELEGATES ZONE on the head line: every player's lobby socket and
      //    reserve stack, the neutral supply at its edge — and NO ledger row
      //    of its own between the voting area and the parties any more.
      await expect(page.locator('.con-wshead [data-parl-zone]'), 'the zone lives on the head line in the overview').toHaveCount(1);
      // THE FIXED HEAD LINE: the crumb's reserve and the zone's coordinates are measured here and compared inside the mode.
      const headGeometry = () => page.evaluate(() => {
        const box = (el: Element | null) => {
          const r = el?.getBoundingClientRect();
          return r === undefined ? 'none' : `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
        };
        return {
          aux: box(document.querySelector('.con-parl__head .con-wshead__aux')),
          zone: box(document.querySelector('[data-parl-zone]')),
          seats: Array.from(document.querySelectorAll('[data-parl-zone] .con-parl__seat')).map(box),
        };
      });
      const headBefore = await headGeometry();
      await expect(page.locator('[data-parl-zone] .con-parl__seat[data-parl-seat]'), 'one group per player').toHaveCount(before.players.filter((p) => p.participates).length);
      await expect(page.locator('[data-parl-zone] [data-parl-neutral-cube]'), 'the neutral supply is a group of the zone').toHaveCount(1);
      await expect(page.locator('.con-parl__body [data-parl-seats], .con-parl__body .con-parl__seat'), 'no ledger row in the body').toHaveCount(0);
      const overviewCard = await page.locator('.con-parl__slot .pcard').first().boundingBox();
      expect(overviewCard, 'the overview card is measurable').not.toBeNull();

      // ── X on the voting AREA does nothing: it is ONE zone with no card of its
      //    own selected (the inspector belongs to the mode's selected card) —
      //    the bar offers no X here and the press opens no viewer.
      await expect(page.locator('.con-cmdbar'), 'no X verb on the voting area').not.toContainText(/ОСМОТРЕТЬ/i);
      await page.keyboard.press('KeyX');
      await settle(page, {timeoutMs: 4_000});
      await expect(page.locator('dialog.con-zoom[open]'), 'X on the area opens no viewer').toHaveCount(0);
      expect(await parliament(page).getAttribute('data-zone'), 'the focus is where it was').toBe('voting');

      // ── A: the VOTE MODE — three cards in a row, the zone above, the info below.
      //    It opens on the FIRST card (the tie order's head); the crumb is the
      //    mode's one stable name.
      await press(page, 'Enter', 1400);
      await expect(voteMode(page), 'the vote mode stands').toHaveCount(1);
      await settle(page, {timeoutMs: 8_000});
      expect(await selectedInstance(page), 'the mode opens on the first card').toBe(slot0.instance);
      const crumbInMode = (await crumbText(page)).toUpperCase();
      expect(crumbInMode, 'the crumb names the mode, not the card').toContain('ГОЛОСОВАНИЕ');
      expect(crumbInMode, 'the resolution\'s name is in its description, never in the crumb').not.toContain(slot0.resolution.toUpperCase());
      // The SAME card reads a size up inside the mode — the cards are the event.
      const modeCard = await page.locator('.con-parl__slot--selected .pcard').boundingBox();
      expect(modeCard, 'the selected card is measurable').not.toBeNull();
      expect((modeCard?.height ?? 0) / (overviewCard?.height ?? 1), `the mode's card is visibly larger than the overview's (${Math.round(overviewCard?.height ?? 0)} → ${Math.round(modeCard?.height ?? 0)})`).toBeGreaterThan(1.15);
      await expectUniformGrid(page, `${preset.id} mode`);
      await expect(rowSlots(page), 'the three slots stand in the row — the same instances').toHaveCount(3);
      expect(await rowOrder(page), 'the tie order is kept').toEqual(before.slots.map((s) => s.instance));
      await expect(page.locator('.con-parl__slot-home .con-parl__slot'), 'no slot is left in the overview').toHaveCount(0);
      await expect(page.locator('[data-parl-vote-card] .pcard'), 'the selected card').toHaveCount(1);
      await expectOneOfEach(page, before, `${preset.id} mode`);
      await expect(page.locator('.con-wshead [data-parl-zone]'), 'the zone stays on the head line inside the mode (one instance)').toHaveCount(1);
      await expect(page.locator('.con-parl__vote [data-parl-zone]'), '…and never travels into the layer').toHaveCount(0);
      expect(await headGeometry(), 'the crumb reserve, the zone and every seat group keep their exact screen coordinates in the mode').toEqual(headBefore);
      await expect(page.locator('.con-parl__seat--me [data-parl-seat-lobby] .player-cube'), 'the viewer\'s free delegate stands in their lobby socket on the zone').toHaveCount(1);
      await expect(page.locator('.con-parl__seat--me [data-parl-seat-place="lobby"].con-parl__seat-place--source'), 'the viewer\'s lobby is marked as the source').toHaveCount(1);
      await expect(page.locator('[data-parl-vote-source]'), 'the delegate\'s real source').toContainText(/лобби/i);
      await expect(page.locator('[data-parl-cta-cost][data-cost-kind="free"]'), 'the confirm says the lobby delegate is free').toContainText(/бесплатно/i);
      await expect(page.locator('.con-parl__vote .con-parl__cta'), 'no «a full action» filler on the confirm').not.toContainText(/Полное действие/i);
      // ONE NUMBER (docs/TURMOIL_REDUX_PARLIAMENT_VOTE_ONE_NUMBER.md): the count is the ribbon under
      // the card, the first delegate's 0 → 1 is the places under it — neither is a panel fact.
      await expect(page.locator('[data-parl-fact="votes"], [data-parl-fact="mine"]'), 'the delegate count is not a panel fact').toHaveCount(0);
      await expect(page.locator('[data-parl-fact="access"]'), 'the party effect is a fact only on the edge (0 → 1 is not it)').toHaveCount(0);
      await expect(page.locator('[data-parl-fact="lead"]'), 'the leader').toHaveCount(1);
      await expect(page.locator('[data-parl-fact="win"]'), 'the winning state').toHaveCount(1);
      await expect(page.locator('[data-parl-kicker]'), 'two kickers — the reading\'s and the vote\'s').toHaveCount(2);
      await expect(page.locator('.con-parl__slot--selected [data-parl-vote-place]'), 'the place the delegate will take, on the selected card').toHaveCount(1);
      await expect(page.locator('[data-parl-info="own"]'), 'the resolution\'s own effect block').toHaveCount(1);
      await expect(page.locator('[data-parl-vote-reading]'), 'ONE reading — the viewer\'s number').toHaveCount(1);
      await expect(page.locator('[data-parl-info="own"] .con-parl__info-part'), 'no printed sentence on the panel — the inspector has them').toHaveCount(0);
      await expect(page.locator('[data-parl-info="party"], [data-parl-info="quest"]'), 'the party and the quest left the panel for the inspector').toHaveCount(0);
      await expect(page.locator('.con-parl__stage'), 'no second surface').toHaveCount(0);
      await expectFits(page, `${preset.id} mode`);
      await shoot(page, preset.id, '03-vote-mode');

      // ── ◀ ▶: the selection moves, the row does not.
      const surfaceBox = await page.locator('[data-parl-vote-surface]').boundingBox();
      await press(page, 'ArrowRight', 700);
      expect(await selectedInstance(page), 'the second card is selected').toBe(slot1.instance);
      expect(await rowOrder(page), 'the row never reorders').toEqual(before.slots.map((s) => s.instance));
      await expect.poll(() => infoName(page), {timeout: 4_000}).not.toBe('');
      await expect(page.locator('.con-parl__slot--selected [data-parl-vote-place]'), 'the place follows the selection').toHaveCount(1);
      await expect(page.locator('[data-parl-vote-place]')).toHaveCount(1);
      const surfaceBox2 = await page.locator('[data-parl-vote-surface]').boundingBox();
      expect(surfaceBox2, 'the info surface keeps its geometry').toEqual(surfaceBox);
      expect((await crumbText(page)).toUpperCase(), 'the crumb does not move with the selection').toBe(crumbInMode);
      await expectUniformGrid(page, `${preset.id} mode 2`);
      await expectFits(page, `${preset.id} mode 2`);
      await shoot(page, preset.id, '04-vote-mode-second');
      await press(page, 'ArrowLeft', 700);
      expect(await selectedInstance(page)).toBe(slot0.instance);

      // ── X INSIDE THE MODE: the selected card lifts into the viewer (one
      //    physical card, its slot held). Opened from the mode, the viewer is
      //    the vote's SECOND DOOR: one vote verb reading the delegate's source
      //    and price, the position in the footer (no counter plate over the card).
      await openZoomViewer(page);
      await expect(page.locator('[data-parl-vote-card] .con-zoom-hold'), 'the selected card is the held source').toHaveCount(1);
      await expect.poll(() => viewerCard(page), {timeout: 6_000, message: 'the viewer shows the SELECTED card'}).toContain(slug(slot0.resolution));
      expect(await visibleFacesOf(page, slot0.resolution), 'one physical card: the viewer\'s, never a copy beside the source').toBe(1);
      const verb = page.locator('dialog.con-zoom[open] .con-zoom__vote');
      await expect(verb, 'ONE vote verb in the viewer').toHaveCount(1);
      await expect(verb).toHaveAttribute('data-vote-available', 'yes');
      await expect(verb, 'the free delegate leaves the lobby').toHaveAttribute('data-vote-source', 'lobby');
      await expect(verb.locator('.con-zoom__vote-detail')).toContainText(/лобби/i);
      await expect(page.locator('dialog.con-zoom[open] .con-zoom__btn--play'), 'no other primary verb').toHaveCount(0);
      await expect(page.locator('[data-zoom-position]'), 'the position rides the footer').toHaveText(/1\s*\/\s*3/);
      await expect(page.locator('dialog.con-zoom[open] .card-zoom-topbar'), 'no counter plate above the card').toHaveCount(0);
      await expectInspectorScene(page, `${preset.id} resolution`);
      await shoot(page, preset.id, '05-inspect-in-mode');

      // ── RB / LB page the THREE proposals in their physical order: the card,
      //    both columns, the footer and the mode's selection move together.
      const plaque = () => page.evaluate(() => (document.querySelector('dialog.con-zoom[open] .con-rinspect-aside .con-pseal__name')?.textContent ?? '').trim());
      const plaque0 = await plaque();
      const footer0 = await footerGeometry(page);
      await press(page, 'KeyE', 900);
      await expect.poll(() => viewerCard(page), {timeout: 6_000, message: 'RB shows the second proposal'}).toContain(slug(slot1.resolution));
      await expect(page.locator('[data-zoom-position]')).toHaveText(/2\s*\/\s*3/);
      await expect.poll(plaque, {timeout: 10_000, message: 'the party column follows the card'}).not.toBe(plaque0);
      expect(await selectedInstance(page), 'the mode\'s selection follows the viewer').toBe(slot1.instance);
      await expect(page.locator('[data-parl-vote-card] .con-zoom-hold'), 'the held slot follows the shown card').toHaveCount(1);
      expect(await visibleFacesOf(page, slot1.resolution), 'one physical card after paging').toBe(1);
      await expectInspectorScene(page, `${preset.id} resolution 2`);
      expect(await footerGeometry(page), 'a page turn moves no footer control and resizes no group').toEqual(footer0);
      await shoot(page, preset.id, '05b-inspect-paged');
      await press(page, 'KeyQ', 900);
      await expect.poll(() => viewerCard(page), {timeout: 6_000, message: 'LB pages back'}).toContain(slug(slot0.resolution));
      await expect(page.locator('[data-zoom-position]')).toHaveText(/1\s*\/\s*3/);
      await expect.poll(plaque, {timeout: 10_000, message: 'the first card\'s party again'}).toBe(plaque0);
      // ── B after paging: the card flies home into the LAST viewed slot, which stays selected.
      await press(page, 'KeyE', 900);
      await expect.poll(() => viewerCard(page), {timeout: 6_000}).toContain(slug(slot1.resolution));
      await closeZoomViewer(page);
      await settle(page, {timeoutMs: 8_000});
      await expect(voteMode(page), 'the mode survives the inspector').toHaveCount(1);
      expect(await selectedInstance(page), 'B returns to the LAST viewed card').toBe(slot1.instance);
      await expectOneOfEach(page, before, `${preset.id} after the inspector`);
      await press(page, 'ArrowLeft', 700);
      expect(await selectedInstance(page)).toBe(slot0.instance);
      await expect(page.locator('[data-parl-vote-reading]'), 'the panel reads the selected card again').toHaveCount(1);

      // ── B: the same phrase folds back — every card home, the focus where it was.
      expect(await pressUntil(page, 'Escape', async () => await voteMode(page).count() === 0, {tries: 3, settleMs: 1100}), 'B folds the vote mode').toBeTruthy();
      await settle(page, {timeoutMs: 8_000});
      await expect(page.locator('.con-parl__slot-home .con-parl__slot'), 'every slot is home').toHaveCount(3);
      await expect(rowSlots(page)).toHaveCount(0);
      await expectOneOfEach(page, before, `${preset.id} after B`);
      expect(await parliament(page).getAttribute('data-zone'), 'the focus is where it was').toBe('voting');
      expect(await parliament(page).getAttribute('data-stage')).toBe('browse');
      await expectFits(page, `${preset.id} after B`);
      await shoot(page, preset.id, '06-mode-cancelled');

      // ── RE-ENTRY: A again opens the same mode the same way — the zone
      //    travels again, the cards grow again, the selection is where it was.
      await expect(page.locator('.con-wshead [data-parl-zone]'), 'the zone is on the head line').toHaveCount(1);
      expect(await headGeometry(), 'the head line is exactly where it was after B').toEqual(headBefore);
      await press(page, 'Enter', 1400);
      await expect(voteMode(page), 'the mode stands again').toHaveCount(1);
      await settle(page, {timeoutMs: 8_000});
      expect(await selectedInstance(page), 'the selection survives the round trip').toBe(slot0.instance);
      await expect(page.locator('.con-wshead [data-parl-zone]'), 'the zone still stands on the head line').toHaveCount(1);
      expect(await headGeometry(), 'the head line does not move on re-entry either').toEqual(headBefore);
      await expectOneOfEach(page, before, `${preset.id} re-entry`);
      await expectUniformGrid(page, `${preset.id} re-entry`);
      await shoot(page, preset.id, '07-mode-reentered');

      // ── A: the delegate leaves the bench's lobby socket, lands on the card, the counters
      //    tick, the flow leaves. A second press in the same beat sends nothing.
      const me = (await seatOf(request, playerId)).color;
      let flightSeen = false;
      const probe = setInterval(() => {
        void page.locator('.con-parl__flight').count().then((n) => {
          if (n > 0) {
            flightSeen = true;
          }
        }).catch(() => undefined);
      }, 40);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await expect(page.locator('.con-parl__vote--landed, .con-parl__vote--committed'), 'the mode commits').toHaveCount(1, {timeout: 10_000});
      await expect.poll(async () => (await seatOf(request, playerId)).parl.slots[0].viewerVotes, {timeout: 20_000, message: 'the delegate landed on slot 1'}).toBe(slot0.viewerVotes + 1);
      const landed = page.locator('.con-parl__vote--landed');
      if (await landed.count() > 0) {
        await shoot(page, preset.id, '08-landed');
      }
      await waitForBoardHome(page, 40);
      clearInterval(probe);
      expect(flightSeen, 'the delegate\'s cube physically flew (a proxy was on screen)').toBeTruthy();
      await expect(parliament(page), 'a finished vote leaves the workspace').toHaveCount(0);
      await expect(page.locator('.con-parl__flight'), 'no proxy is left behind').toHaveCount(0);
      const after = (await seatOf(request, playerId)).parl;
      expect(after.slots[0].totalVotes, 'exactly ONE delegate was sent (the double press sent nothing)').toBe(slot0.totalVotes + 1);
      expect(after.players.find((p) => p.color === me)?.lobby, 'the lobby delegate was spent').toBe(false);
      await shoot(page, preset.id, '09-after-vote');

      // ── The overview after the vote: the ledger reads the empty lobby socket.
      await openParliament(page);
      await expect(page.locator(`[data-parl-seat-lobby="${me}"] .player-cube`), 'the viewer\'s lobby socket is empty now').toHaveCount(0);
      await expect(page.locator('.con-parl__slot').nth(0)).toHaveAttribute('data-votes', String(slot0.totalVotes + 1));
      await expectOneOfEach(page, after, `${preset.id} after the vote`);
      await expectFits(page, `${preset.id} after`);
      await shoot(page, preset.id, '10-overview-after-vote');
    });
  });
}

test.describe('parliament v4 · the paid vote · the bill inside the mode · the second delegate unlocks the effect', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('reserve source and cost · lead + effect facts · the bill embedded · collapse → restore · reload · pay → the delegate leaves the reserve stack → the plaque reads «yours»', async ({page, request}) => {
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

    // ── A: the mode reads the reserve as the source, the cost, the lead change and the effect unlock.
    await focusVoting(page);
    await press(page, 'Enter', 1400);
    await expect(voteMode(page)).toHaveCount(1);
    await settle(page, {timeoutMs: 8_000});
    expect(await selectedInstance(page)).toBe(slot0.instance);
    await expect(page.locator(`.con-wshead [data-parl-seat-lobby="${before.color}"] .player-cube`), 'the viewer\'s lobby socket on the head line is empty').toHaveCount(0);
    await expect(page.locator(`.con-wshead [data-parl-seat-reserve="${before.color}"] .con-parl__stack-cube`), 'the reserve stack on the head line shows its cubes').not.toHaveCount(0);
    await expect(page.locator('.con-parl__seat--me [data-parl-seat-place="reserve"].con-parl__seat-place--source'), 'the reserve is marked as the source').toHaveCount(1);
    await expect(page.locator('[data-parl-vote-source]')).toContainText(/резерва/i);
    await expect(page.locator('[data-parl-cta-cost][data-cost-kind="cost"] .con-parl__cta-cost-num'), 'the price stands on the confirm — the server\'s own').toHaveText(String(before.parl.viewer?.vote.cost ?? -1));
    await expect(page.locator('[data-parl-fact="votes"], [data-parl-fact="mine"]'), 'the count is the ribbon under the card, not a panel fact').toHaveCount(0);
    await expect(page.locator('[data-parl-fact="lead"].con-parl__fact--gain'), 'the lead changes hands').toHaveCount(1);
    // THE EDGE: this very delegate (1 → 2) grants the party effect — the one case the third fact stands on the panel.
    await expect(page.locator('[data-parl-fact="access"].con-parl__fact--gain'), 'the party effect becomes the viewer\'s').toHaveCount(1);
    await expect(page.locator('[data-parl-fact="access"]')).toContainText(/ваш/i);
    await expect(page.locator('[data-parl-fact]'), 'three facts on the edge').toHaveCount(3);
    await expectFits(page, `${preset} mode`);
    await shoot(page, preset, '11-paid-mode');

    // ── A: the bill stands INSIDE the mode — never a band over it.
    await press(page, 'Enter', 1500);
    const bill = page.locator('.con-parl__vote [data-embed-slot="parliament-vote"] .con-task-host--embedded');
    await expect(bill, 'the payment panel stands in the mode\'s zone').toHaveCount(1, {timeout: 20_000});
    await expect(page.locator('.con-task-host:not(.con-task-host--embedded)'), 'never a standalone payment band').toHaveCount(0);
    await expect(parliament(page)).toHaveAttribute('data-stage', 'paying');
    expect((await crumbText(page)).toUpperCase()).toContain('ОПЛАТА');
    await settle(page, {timeoutMs: 8_000});
    await expectFits(page, `${preset} bill`);
    await shoot(page, preset, '12-bill-inside-mode');

    // ── B: the bill is owed — the whole workspace COLLAPSES to the board; A brings the same mode back.
    expect(await pressUntil(page, 'Escape', async () => !await parliament(page).isVisible(), {tries: 3, settleMs: 1000}), 'B collapses the Parliament around the bill').toBeTruthy();
    await settle(page, {timeoutMs: 10_000});
    await expect(page.locator('.con-mandatory'), 'the owed bill stands on the board home').toBeVisible({timeout: 15_000});
    await shoot(page, preset, '13-bill-collapsed');
    expect(await pressUntil(page, 'Enter', async () => await bill.count() > 0, {tries: 3, settleMs: 1500}), 'A restores the mode with its bill').toBeTruthy();
    await settle(page, {timeoutMs: 10_000});
    await expect(parliament(page)).toHaveAttribute('data-stage', 'paying');
    await expect(rowSlots(page), 'the cards are still in the row').toHaveCount(3);
    await shoot(page, preset, '14-bill-restored');

    // ── RELOAD mid-bill: the server still owes the payment; the mode re-forms around it.
    await reloadConsole(page);
    await expect(bill, 'the Parliament re-opens around the bill by itself; the vote mode resumed').toHaveCount(1, {timeout: 30_000});
    await expect(page.locator('.con-task-host:not(.con-task-host--embedded)'), 'never a standalone band after the reload').toHaveCount(0);
    await settle(page, {timeoutMs: 10_000});
    await expect(page.locator('[data-parl-vote-card] .pcard'), 'the selected card is back in the row').toHaveCount(1);
    await expect(rowSlots(page)).toHaveCount(3);
    await shoot(page, preset, '15-bill-after-reload');

    // ── PAY: the delegate leaves the reserve stack, lands, the flow leaves; the plaque reads «yours».
    let flightSeen = false;
    const probe = setInterval(() => {
      void page.locator('.con-parl__flight').count().then((n) => {
        if (n > 0) {
          flightSeen = true;
        }
      }).catch(() => undefined);
    }, 40);
    await press(page, 'KeyX', 1500);
    await expect.poll(async () => (await seatOf(request, playerId)).parl.slots[0].viewerVotes, {timeout: 30_000, message: 'the second delegate landed'}).toBe(2);
    const paid = await seatOf(request, playerId);
    expect(paid.seat.megacredits + paid.seat.heat, 'the bill was settled from the viewer\'s pools').toBeLessThan(before.seat.megacredits + before.seat.heat);
    expect(paid.parl.players.find((p) => p.color === before.color)?.reserve, 'one delegate left the reserve').toBe((before.parl.players.find((p) => p.color === before.color)?.reserve ?? 0) - 1);
    expect(paid.parl.players.find((p) => p.color === before.color)?.access.find((a) => a.party === party0)?.hasEffect, 'the party effect is the viewer\'s now').toBe(true);
    await waitForBoardHome(page, 40);
    clearInterval(probe);
    expect(flightSeen, 'the paid delegate\'s cube physically flew from the reserve').toBeTruthy();
    await openParliament(page);
    await expect(page.locator(`.con-parl__party[data-party="${party0}"][data-party-state="delegates"]`), 'the plaque reads «yours»').toHaveCount(1);
    await expect(page.locator('.con-parl__slot').nth(0)).toHaveAttribute('data-votes', '3');
    await shoot(page, preset, '16-after-paid-vote');
  });
});

test.describe('parliament · the fullscreen inspector is the vote\'s second door', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('X in the mode → RB → A: the delegate goes to the VIEWED card — the viewer flies home first, then the cube flies; a doubled A sends one', async ({page, request}) => {
    test.setTimeout(240_000);
    const playerId = await bootFixture(page, request, 'parliament', {query: '&consoleProfile=auto'});
    const preset = 'door-inspect-1080';
    await openParliament(page);
    const before = (await seatOf(request, playerId)).parl;
    const [slot0, slot1] = before.slots;
    await focusVoting(page);
    await press(page, 'Enter', 1400);
    await expect(voteMode(page)).toHaveCount(1);
    await settle(page, {timeoutMs: 8_000});
    await openZoomViewer(page);
    await press(page, 'KeyE', 900);
    await expect.poll(() => viewerCard(page), {timeout: 6_000, message: 'RB shows the second proposal'}).toContain(slug(slot1.resolution));
    await expect(page.locator('dialog.con-zoom[open] .con-zoom__vote')).toHaveAttribute('data-vote-available', 'yes');
    await shoot(page, preset, '40-inspect-second-card');
    // The ORDER of the two motions, sampled in the page (an interval and a
    // mutation observer — never rAF): no sample holds an open viewer AND a
    // flying cube.
    await page.evaluate(() => {
      const state = {samples: 0, overlap: 0, viewerGoneAt: -1, flightAt: -1};
      (window as unknown as {__voteDoor: typeof state}).__voteDoor = state;
      const t0 = performance.now();
      const sample = () => {
        state.samples++;
        const open = document.querySelector('dialog.con-zoom[open]') !== null;
        const flight = document.querySelector('.con-parl__flight') !== null;
        const now = Math.round(performance.now() - t0);
        if (!open && state.viewerGoneAt < 0) {
          state.viewerGoneAt = now;
        }
        if (flight && state.flightAt < 0) {
          state.flightAt = now;
        }
        if (open && flight) {
          state.overlap++;
        }
      };
      const timer = window.setInterval(sample, 16);
      const observer = new MutationObserver(sample);
      observer.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'class']});
      window.setTimeout(() => {
        window.clearInterval(timer);
        observer.disconnect();
      }, 20_000);
    });
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await seatOf(request, playerId)).parl.slots[1].viewerVotes, {timeout: 20_000, message: 'the delegate landed on the VIEWED card'}).toBe(slot1.viewerVotes + 1);
    await waitForBoardHome(page, 40);
    const probe = await page.evaluate(() => (window as unknown as {__voteDoor: {samples: number, overlap: number, viewerGoneAt: number, flightAt: number}}).__voteDoor);
    expect(probe.samples, `the sampler ran (${JSON.stringify(probe)})`).toBeGreaterThan(5);
    expect(probe.flightAt, `the cube physically flew (${JSON.stringify(probe)})`).toBeGreaterThanOrEqual(0);
    expect(probe.overlap, `the viewer was home before the cube flew (${JSON.stringify(probe)})`).toBe(0);
    const after = (await seatOf(request, playerId)).parl;
    expect(after.slots[1].totalVotes, 'exactly ONE delegate (the doubled A sent nothing)').toBe(slot1.totalVotes + 1);
    expect(after.slots[0].totalVotes, 'the first card is untouched').toBe(slot0.totalVotes);
    await expect(parliament(page), 'a finished vote leaves the workspace').toHaveCount(0);
    await shoot(page, preset, '41-after-inspector-vote');
  });

  test('a RESERVE delegate from the viewer: the verb reads the server\'s source and price; A closes into the mode\'s own bill; paying lands the cube', async ({page, request}) => {
    test.setTimeout(240_000);
    const playerId = await bootFixture(page, request, 'parliament-paid', {query: '&consoleProfile=auto'});
    const preset = 'door-inspect-paid-1080';
    await openParliament(page);
    const before = await seatOf(request, playerId);
    expect(before.parl.viewer?.vote.source, 'the vote comes from the reserve').toBe('reserve');
    const cost = before.parl.viewer?.vote.cost ?? -1;
    await focusVoting(page);
    await press(page, 'Enter', 1400);
    await expect(voteMode(page)).toHaveCount(1);
    await settle(page, {timeoutMs: 8_000});
    await openZoomViewer(page);
    const verb = page.locator('dialog.con-zoom[open] .con-zoom__vote');
    await expect(verb).toHaveAttribute('data-vote-available', 'yes');
    await expect(verb).toHaveAttribute('data-vote-source', 'reserve');
    await expect(verb.locator('.con-zoom__vote-detail')).toContainText(/резерв/i);
    await expect(verb.locator('.con-zoom__vote-detail .con-zoom__vote-cost b'), 'the price is the server\'s own').toHaveText(String(cost));
    await expectInspectorScene(page, `${preset} verb`);
    await shoot(page, preset, '42-inspect-paid-verb');
    await page.keyboard.press('Enter');
    await expect(page.locator('dialog.con-zoom[open]'), 'the viewer flew home').toHaveCount(0, {timeout: 8_000});
    const bill = page.locator('.con-parl__vote [data-embed-slot="parliament-vote"] .con-task-host--embedded');
    await expect(bill, 'the mode\'s own bill stands inside the mode').toHaveCount(1, {timeout: 20_000});
    await expect(page.locator('.con-task-host:not(.con-task-host--embedded)'), 'never a standalone payment band').toHaveCount(0);
    await settle(page, {timeoutMs: 8_000});
    await shoot(page, preset, '43-inspect-paid-bill');
    await press(page, 'KeyX', 1500);
    await expect.poll(async () => (await seatOf(request, playerId)).parl.slots[0].viewerVotes, {timeout: 30_000, message: 'the reserve delegate landed'}).toBe(before.parl.slots[0].viewerVotes + 1);
    await waitForBoardHome(page, 40);
    await shoot(page, preset, '44-after-paid-inspector-vote');
  });
});

test.describe('parliament v4 · a crowded table · the vote that is not possible', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the Parliament reads a crowded table: ties, a neutral majority, the winner, the seats — the mode opens for READING and names why the vote is not possible; the tie is explained in the inspector', async ({page, request}) => {
    test.setTimeout(360_000);
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
    await expect(page.locator('[data-parl-gov] .con-parl__gov-card .pcard'), 'the enacted card is the government\'s main object').toHaveCount(1);
    await expect(page.locator('[data-parl-seats] .con-parl__seat[data-parl-seat]'), 'five groups on the zone — one per seat').toHaveCount(5);
    await expect(page.locator('[data-parl-seat-chair]'), 'the chairman\'s seat is in the government').toHaveCount(1);
    await expectFits(page, `${preset} zone`);
    await expectFits(page, preset);
    await shoot(page, preset, '20-dense-offturn');
    // A off-turn: the mode OPENS for reading; the confirm names the reason; the bench says no delegate is left.
    await focusVoting(page);
    await press(page, 'Enter', 1400);
    await expect(voteMode(page), 'the mode opens for reading even when no vote is possible').toHaveCount(1);
    await settle(page, {timeoutMs: 8_000});
    await expect(page.locator('.con-parl__cta--blocked'), 'the confirm carries the reason').toHaveCount(1);
    await expect(page.locator('.con-parl__seat-place--source'), 'no place on the zone is marked as a source when nothing can be sent').toHaveCount(0);
    await expect(page.locator('[data-parl-vote-place]'), 'no place is promised without a delegate').toHaveCount(0);
    await expectFits(page, `${preset} reading`);
    await shoot(page, preset, '21-dense-mode-reading');
    await press(page, 'Enter', 800);
    await expect(page.locator('.con-notice'), 'A names the reason once').toBeVisible();
    // The tie is explained where the player asks: the inspector of the winning card.
    const winner = model.parl.slots.findIndex((s) => s.isWinning);
    for (let i = 0; i < 6; i++) {
      const selected = await selectedInstance(page);
      const at = model.parl.slots.findIndex((s) => s.instance === selected);
      if (at === winner) {
        break;
      }
      await press(page, at < winner ? 'ArrowRight' : 'ArrowLeft', 500);
    }
    expect(await selectedInstance(page), 'the winning card is selected').toBe(model.parl.slots[winner].instance);
    // The inspector of the winning card: the footer says it stands in the vote
    // AND wins right now; the party column and the own-rules column both fit.
    await openZoomViewer(page);
    await expect(page.locator('.con-rstatus[data-lifecycle="vote"]')).toContainText(/побеждает/i);
    await expect(page.locator('.card-zoom-aside .con-rinspect-aside')).toHaveCount(1);
    await expectInspectorScene(page, `${preset} tie`);
    // No vote possible: the verb stays in place, calm, with the server's
    // reason; A nudges that reason — the viewer neither closes nor sends.
    const blocked = page.locator('dialog.con-zoom[open] .con-zoom__vote');
    await expect(blocked, 'the vote verb stands, blocked').toHaveAttribute('data-vote-available', 'no');
    await expect(blocked.locator('.con-zoom__vote-detail .con-zoom__vote-reason'), 'with its reason').toHaveText(/\S/);
    const votesBefore = (await seatOf(request, playerId)).parl.slots.map((s) => s.totalVotes);
    await page.keyboard.press('Enter');
    await expect(page.locator('dialog.con-zoom[open] .con-zoom__vote-detail--nudge'), 'A on the blocked verb nudges the reason').toHaveCount(1);
    await page.keyboard.press('Enter');
    await settle(page, {timeoutMs: 6_000});
    await expect(page.locator('dialog.con-zoom[open]'), 'a blocked A never closes the viewer').toHaveCount(1);
    expect((await seatOf(request, playerId)).parl.slots.map((s) => s.totalVotes), 'no delegate was sent').toEqual(votesBefore);
    await shoot(page, preset, '22-dense-winner-in-inspector');
    // Browsing stays open while voting is not — across as many cards as the area holds.
    await press(page, 'KeyE', 900);
    await expect(page.locator('[data-zoom-position]')).toHaveText(new RegExp(`2\\s*/\\s*${model.parl.slots.length}`));
    await closeZoomViewer(page);
    await settle(page, {timeoutMs: 8_000});
    expect(await pressUntil(page, 'Escape', async () => await voteMode(page).count() === 0, {tries: 3, settleMs: 1100})).toBeTruthy();
    await settle(page, {timeoutMs: 8_000});
    // THE ENACTED CARD (the government): its own context — «enacted», the
    // party effect every player's, no vote verb and no paging.
    expect(await pressUntil(page, 'ArrowLeft', async () => await parliament(page).getAttribute('data-zone') === 'government', {tries: 3, settleMs: 400}), 'the government zone').toBeTruthy();
    await openZoomViewer(page);
    await expect(page.locator('.con-rstatus[data-lifecycle="enacted"]'), 'the enacted standing').toHaveCount(1);
    await expect(page.locator('.con-rstatus[data-access="everyone"]'), 'the party effect is every player\'s').toHaveCount(1);
    await expect(page.locator('dialog.con-zoom[open] .con-zoom__vote'), 'no vote verb over the enacted card').toHaveCount(0);
    await expect(page.locator('[data-zoom-position]'), 'one card, no paging').toHaveCount(0);
    await expectInspectorScene(page, `${preset} enacted`);
    await shoot(page, preset, '22b-dense-enacted-in-inspector');
    await closeZoomViewer(page);
    await settle(page, {timeoutMs: 8_000});
    await focusVoting(page);
    // The parties: several effects held at once; the used action stamped on its badge.
    await press(page, 'ArrowDown', 500);
    expect(await page.locator('.con-parl__party--held').count(), 'several party effects at once').toBeGreaterThanOrEqual(3);
    await expect(page.locator('.con-parl__party[data-action-state="used"] .con-pseal__action-mark'), 'the used action is stamped').toHaveCount(1);
    await expectFits(page, preset);
    await shoot(page, preset, '23-dense-parties');
  });
});

test.describe('parliament v4 · the parties\' door', () => {
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

test.describe('parliament v4 · one execution point, two doors · the Reds in full', () => {
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

    // ── OFF THE VIEWER'S TURN (two actions spent): the mode opens for reading, the confirm names the turn.
    await openParliament(page);
    await expect(page.locator('.con-parl__party[data-party="Scientists"][data-action-state="used"]'), 'the plaque keeps the used state').toHaveCount(1);
    await focusVoting(page);
    await press(page, 'Enter', 1400);
    await expect(voteMode(page), 'the mode opens for reading off-turn').toHaveCount(1);
    await settle(page, {timeoutMs: 8_000});
    await expect(page.locator('.con-parl__cta--blocked'), 'the confirm names the turn').toContainText(/ход/i);
    await press(page, 'Enter', 800);
    await expect(page.locator('.con-notice'), 'the notice names the turn').toContainText(/ход/i);
    await shoot(page, preset, '43b-off-turn-reading');
    expect(await pressUntil(page, 'Escape', async () => await voteMode(page).count() === 0, {tries: 3, settleMs: 1100})).toBeTruthy();
    await settle(page, {timeoutMs: 8_000});
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

import {test, expect, Locator, Page} from './consoleTest';
import {bootFixtureSeats, press, settle} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness} from './witness';

/**
 * THE JOURNAL's NAMED-OBJECT CHIPS UNDER A POINTER — a played CARD, a COLONY, an AWARD in a line of the journal
 * (`JournalCardChip` · `JournalColonyChip` · `JournalMaChip`): the pointer rests on the name and the object itself
 * comes up beside it (the card's face, the colony's tile, the award's rule); it leaves and the preview is gone; a
 * click on a card opens it full screen.
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO, stage 4 — «the state space is walked, not sampled»): `surface:journal-card-chip`,
 * `surface:journal-colony-chip` and `surface:journal-ma-chip` stood on the ledger of the UNWALKED
 * (`tests/client/bottle/kernelUnwalked.json`). Each is armed by a pointer hover or a click — which the pad never
 * makes: so no walk of the monkey, no whole game of the autopilot and no spec of the suite had ever run one, on a
 * build whose desktop players hold a mouse.
 *
 * The table is fixture `journal-chips`: two seats, the colonies; blue has played Mine, built a colony and funded an
 * award, so generation 1 of the journal holds a line with each chip.
 *
 * Every hover is act → verify → retry (the preview is a STATE: it stands, it is laid out, it holds its object); the
 * one transient — the preview that must NOT come back by itself when the full-screen card closes over a resting
 * pointer — is RECORDED from before the close (`armWitness`).
 */
const JOURNAL = '.con-journal';
const CARD_CHIP = `${JOURNAL} .journal-chip--card.journal-chip--zoomable`;
const COLONY_CHIP = `${JOURNAL} .journal-token--colony`;
const AWARD_CHIP = `${JOURNAL} .journal-token--award`;
const CARD_PREVIEW = '.journal-card-preview';
const COLONY_PREVIEW = '.journal-colony-preview';
const MA_PREVIEW = '.journal-ma-preview';
const ZOOM = 'dialog.card-zoom-dialog[open]';

async function openJournal(page: Page): Promise<void> {
  for (let i = 0; i < 4 && await page.locator(JOURNAL).count() === 0; i++) {
    await press(page, 'KeyR', 900);
  }
  await expect(page.locator(JOURNAL), 'the journal stands').toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 15_000});
}

type Beside = {chip: {left: number, right: number, cy: number}, box: {left: number, right: number, top: number, bottom: number}, vw: number, vh: number};

/** The chip's rect and the preview's on-screen box (`box` — the node whose rect IS the preview), read at rest. */
async function beside(page: Page, chip: string, box: string, label: string): Promise<Beside | undefined> {
  return readSettled(page, () => page.evaluate(({chipSel, boxSel}) => {
    const c = document.querySelector(chipSel)?.getBoundingClientRect();
    const b = document.querySelector(boxSel)?.getBoundingClientRect();
    if (c === undefined || b === undefined) {
      return undefined;
    }
    const r = Math.round;
    return {
      chip: {left: r(c.left), right: r(c.right), cy: r(c.top + c.height / 2)},
      box: {left: r(b.left), right: r(b.right), top: r(b.top), bottom: r(b.bottom)},
      vw: window.innerWidth, vh: window.innerHeight,
    };
  }, {chipSel: chip, boxSel: box}), {message: `${label}: the chip and its preview`});
}

type Gutters = {blocks: number, outside: Array<string>, overCard: Array<string>, card: boolean};

/**
 * The full-screen card's RULE BLOCKS (`CardAnnotationsLayer` — one floating block per rule, tethered to the element of
 * the card it explains), read at rest: how many stand, which lie outside the screen, which lie over the card itself.
 */
async function ruleBlocks(page: Page, label: string): Promise<Gutters> {
  return readSettled(page, () => page.evaluate((zoom) => {
    const card = document.querySelector(`${zoom} .card-zoom-stage .pcard`)?.getBoundingClientRect();
    const outside: Array<string> = [];
    const overCard: Array<string> = [];
    const blocks = Array.from(document.querySelectorAll<HTMLElement>(`${zoom} .caanno`));
    for (const [i, el] of blocks.entries()) {
      const r = el.getBoundingClientRect();
      const name = `#${i} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`;
      if (r.left < -1 || r.top < -1 || r.right > window.innerWidth + 1 || r.bottom > window.innerHeight + 1) {
        outside.push(name);
      }
      if (card !== undefined && r.right > card.left + 1 && r.left < card.right - 1 && r.bottom > card.top + 1 && r.top < card.bottom - 1) {
        overCard.push(name);
      }
    }
    return {blocks: blocks.length, outside, overCard, card: card !== undefined};
  }, ZOOM), {message: `${label}: the rule blocks around the full-screen card`});
}

/** Rest the pointer on the chip until its preview stands (a hover is an act: verified, repeated only without its effect). */
async function hoverUntilPreview(page: Page, chip: Locator, preview: string, label: string): Promise<void> {
  await chip.scrollIntoViewIfNeeded();
  await expect.poll(async () => {
    if (await page.locator(preview).count() === 0) {
      // (Off the chip first: a pointer already resting on it makes no new `mouseenter`.)
      await page.mouse.move(2, 2);
      await chip.hover();
    }
    return await page.locator(preview).count();
  }, {timeout: 20_000, message: `${label}: the preview never came up under the pointer`}).toBe(1);
}

async function leaveUntilGone(page: Page, preview: string, label: string): Promise<void> {
  await expect.poll(async () => {
    await page.mouse.move(2, 2);
    return await page.locator(preview).count();
  }, {timeout: 20_000, message: `${label}: the preview stayed after the pointer left`}).toBe(0);
}

test.describe('the journal — a card, a colony and an award named in a line, under a pointer', () => {
  test('the pointer rests on the name: the object comes up beside it, whole and inside the screen; it leaves with the pointer; a click opens the card full screen', async ({page, request}) => {
    test.setTimeout(180_000);
    const broken: Array<string> = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (/vue-error|page-error/.test(text)) {
        broken.push(text.slice(0, 240));
      }
    });
    await bootFixtureSeats(page, request, 'journal-chips');
    await openJournal(page);

    // ── EACH CHIP: its preview stands, laid out inside the screen, holding its object — and leaves with the pointer.
    const chips = [
      {label: 'the played card', chip: CARD_CHIP, preview: CARD_PREVIEW, holds: `${CARD_PREVIEW} .pcard`, box: `${CARD_PREVIEW}__inner`},
      {label: 'the colony', chip: COLONY_CHIP, preview: COLONY_PREVIEW, holds: `${COLONY_PREVIEW} > *`, box: COLONY_PREVIEW},
      {label: 'the award', chip: AWARD_CHIP, preview: MA_PREVIEW, holds: `${MA_PREVIEW} > *`, box: MA_PREVIEW},
    ] as const;
    for (const {label, chip, preview, holds, box: boxSel} of chips) {
      const el = page.locator(chip).first();
      await expect(el, `${label}: the journal holds its chip`).toBeVisible({timeout: 15_000});
      await hoverUntilPreview(page, el, preview, label);
      await expect.poll(() => page.locator(holds).count(), {timeout: 15_000, message: `${label}: the preview holds its object`}).toBeGreaterThan(0);
      await expect(page.locator(holds).first(), `${label}: the object in the preview is drawn`).toBeVisible({timeout: 15_000});
      // BESIDE THE NAME THAT RAISED IT: a gap's width from the chip (left of it — or right, with no room on the left),
      // and centred on the chip's line unless a screen edge holds it. (The colony's preview once stood 150 px above
      // its name: it was placed by a size its tile no longer has.)
      const at = await beside(page, chip, boxSel, label);
      expect(at, `${label}: the chip and its preview are on screen`).not.toBe(undefined);
      if (at !== undefined) {
        const w = at.box.right - at.box.left;
        const h = at.box.bottom - at.box.top;
        expect(w > 80 && h > 40, `${label}: the preview has a size to read (${JSON.stringify(at)})`).toBe(true);
        expect(at.box.left >= 0 && at.box.top >= 0 && at.box.right <= at.vw && at.box.bottom <= at.vh, `${label}: the preview lies inside the screen (${JSON.stringify(at)})`).toBe(true);
        const gap = at.box.right <= at.chip.left ? at.chip.left - at.box.right : at.box.left - at.chip.right;
        expect(gap >= 8 && gap <= 22, `${label}: the preview stands a gap from its chip, never over it or far from it (gap ${gap} — ${JSON.stringify(at)})`).toBe(true);
        const centre = (at.box.top + at.box.bottom) / 2;
        const heldByEdge = at.box.top <= 10 || at.box.bottom >= at.vh - 10;
        expect(Math.abs(centre - at.chip.cy) <= 4 || heldByEdge, `${label}: the preview is centred on its chip's line (${JSON.stringify(at)})`).toBe(true);
        expect(at.chip.cy >= at.box.top && at.chip.cy <= at.box.bottom, `${label}: the chip's line lies within the preview's height (${JSON.stringify(at)})`).toBe(true);
      }
      await leaveUntilGone(page, preview, label);
    }

    // ── THE CARD, FULL SCREEN: a click opens it, the hover preview steps down for it.
    const card = page.locator(CARD_CHIP).first();
    await hoverUntilPreview(page, card, CARD_PREVIEW, 'the played card (again)');
    await card.click();
    await expect(page.locator(ZOOM), 'the click opens the card full screen').toHaveCount(1, {timeout: 15_000});
    await expect(page.locator(CARD_PREVIEW), 'the preview never stands under the full-screen card').toHaveCount(0, {timeout: 15_000});
    await expect(page.locator(`${ZOOM} .pcard`).first(), 'the full-screen view holds the card').toBeVisible({timeout: 15_000});

    // ── ITS RULES STAND AROUND IT (`surface:card-annotations-layer` — the one viewer that does not suppress the layer):
    //    each rule a block of its own in the gutters, inside the screen, never over the card it explains.
    const blocks = page.locator(`${ZOOM} .caanno`);
    await expect.poll(() => blocks.count(), {timeout: 20_000, message: 'the card\'s rules never came up around it'}).toBeGreaterThan(0);
    await expect(page.locator(`${ZOOM} .card-annotations--measuring`), 'the layer is past its measuring pass').toHaveCount(0, {timeout: 20_000});
    await expect(blocks.first(), 'a rule block is drawn').toBeVisible({timeout: 20_000});
    const stood = await ruleBlocks(page, 'opened');
    expect(stood.card, 'the card is on its stage').toBe(true);
    expect(stood.outside, 'every rule block lies inside the screen').toEqual([]);
    expect(stood.overCard, 'no rule block lies over the card').toEqual([]);
    // The pointer on a rule lights the element of the card it explains (block ↔ card, the same id).
    await expect.poll(async () => {
      await page.mouse.move(2, 2);
      await blocks.first().hover();
      return await page.locator(`${ZOOM} .caanno--focus`).count();
    }, {timeout: 20_000, message: 'a rule under the pointer never took the focus'}).toBe(1);
    await expect(page.locator(`${ZOOM} .caanno-target--focus`), 'the card\'s own element answers the rule under the pointer').toHaveCount(1, {timeout: 15_000});
    await page.mouse.move(2, 2);
    // …AND A WINDOW RESIZED UNDER IT (the desktop's window, a display change): the blocks are laid out again for the
    // new room — the same claims, at rest.
    const view = page.viewportSize() ?? {width: 1280, height: 720};
    await page.setViewportSize({width: Math.round(view.width * 0.84), height: view.height});
    const narrowed = await ruleBlocks(page, 'narrowed');
    expect(narrowed.blocks, 'the rules still stand after the resize').toBe(stood.blocks);
    expect(narrowed.outside, 'after the resize every rule block lies inside the screen').toEqual([]);
    expect(narrowed.overCard, 'after the resize no rule block lies over the card').toEqual([]);
    await page.setViewportSize(view);
    const restored = await ruleBlocks(page, 'restored');
    expect(restored.outside, 'back at its size every rule block lies inside the screen').toEqual([]);
    expect(restored.overCard, 'back at its size no rule block lies over the card').toEqual([]);

    // ── …AND CLOSED OVER A RESTING POINTER, the preview does not come back by itself (recorded from before the close).
    const after = await armWitness<{preview: boolean, zoom: boolean}, {preview: string, zoom: string}>(page, 'journal-chip-close', ({preview, zoom}) => ({
      preview: document.querySelector(preview) !== null,
      zoom: document.querySelector(zoom) !== null,
    }), {args: {preview: CARD_PREVIEW, zoom: ZOOM}});
    await page.keyboard.press('Escape');
    await expect(page.locator(ZOOM), 'Esc closes the full-screen card').toHaveCount(0, {timeout: 15_000});
    await settle(page, {timeoutMs: 15_000});
    expect(await after.ever((v) => v.preview), 'the preview came back by itself over a pointer that never moved').toBe(false);
    await after.stop();
    await expect(page.locator(JOURNAL), 'the journal still stands under it').toHaveCount(1);

    // ── A REAL HOVER AFTER THAT WORKS AGAIN (the block lifts by itself).
    await hoverUntilPreview(page, card, CARD_PREVIEW, 'the played card (after the full screen)');
    await leaveUntilGone(page, CARD_PREVIEW, 'the played card (after the full screen)');
    expect(broken, 'no component threw').toEqual([]);
  });
});

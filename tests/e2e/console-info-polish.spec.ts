import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, focusInfoZone, press, pressUntil, pressUntilVisible, settle} from './consoleStart';

/**
 * «ИНФОРМАЦИЯ — СДЕРЖАННО И ДОРОГО» (the Information polish of 2026-10-19, the owner's 4K report). On the WORST honest
 * table of every zone at once (`info-dossier-rich`: two humans and MarsBot, the Hydronetwork, card penalties,
 * generation 10, blue with 40 played cards):
 *
 *   (A) NOTHING STANDS OUTSIDE ITS PLATE — for the seat's own dossier, a rival's and the bot's, every painted object of
 *       every zone lies inside the zone, no ledger name is cut, no two pile names overlap;
 *   (B) THE TOTAL IS THE HERO — the score's total is the zone's largest type by a clear step over every category value;
 *   (C) THE BOT IS ONE MORE PLAYER on the summary — its door speaks the players' plate grammar (the effects plate's
 *       medallions), never its own (no card backs, no mat) — its own presentation lives inside the door;
 *   (D) INSIDE THE DOOR every plate of «Экран бота» holds its content (the prose steps down, never past the plate), the
 *       printed board stands at the scene's scale with the three rules that read it, the bonus piles hold their faces.
 */
const FIXTURE = 'info-dossier-rich';
const OUT = path.resolve(__dirname, '..', '..', 'screenshots', 'info-polish', 'final');

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv', handheld: false},
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto', handheld: false},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld', handheld: true},
] as const;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

/**
 * Names whose FULL text is wider than their box — measured on a hidden clone in the label's own font, because Chromium
 * reports an ellipsized box's `scrollWidth` as its client width plus a pixel (a cut «Сброс бонусных ка…» read 424 / 423).
 */
const cutNames = (page: Page, selector: string) => page.evaluate((sel): Array<string> => {
  const out: Array<string> = [];
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
    if (el.clientWidth === 0) {
      continue;
    }
    const cs = getComputedStyle(el);
    const probe = document.createElement('span');
    probe.textContent = el.textContent ?? '';
    probe.style.cssText = `position:fixed;left:-99999px;top:0;visibility:hidden;white-space:nowrap;font:${cs.font};` +
      `letter-spacing:${cs.letterSpacing};text-transform:${cs.textTransform};font-variant-numeric:${cs.fontVariantNumeric}`;
    document.body.appendChild(probe);
    const full = probe.getBoundingClientRect().width;
    probe.remove();
    const room = el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (full > room + 1) {
      out.push(`${el.textContent ?? ''} (${Math.round(full)} > ${Math.round(room)})`);
    }
  }
  return out;
}, selector);

type ZoneAudit = {zone: string, escapes: Array<string>};
/** Every painted descendant of every dossier zone against the zone's own box (1 px of rounding). */
const auditZones = (page: Page) => page.evaluate((): {zones: Array<ZoneAudit>, overlappingNames: Array<string>} => {
  const painted = (el: Element): boolean => {
    let node: Element | null = el;
    while (node !== null) {
      const cs = getComputedStyle(node);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) {
        return false;
      }
      node = node.parentElement;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const zones: Array<ZoneAudit> = [];
  for (const zone of Array.from(document.querySelectorAll<HTMLElement>('.con-info [data-dossier] .con-dossier__zone'))) {
    const z = zone.getBoundingClientRect();
    const escapes: Array<string> = [];
    for (const el of Array.from(zone.querySelectorAll('*'))) {
      if (!painted(el)) {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.left < z.left - 1 || r.right > z.right + 1 || r.top < z.top - 1 || r.bottom > z.bottom + 1) {
        escapes.push(`${el.className.toString().split(' ')[0] || el.tagName} [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}]`);
      }
    }
    zones.push({zone: zone.dataset.zone ?? '?', escapes: escapes.slice(0, 6)});
  }
  const names = Array.from(document.querySelectorAll<HTMLElement>('.con-info .con-dcards__label')).map((l) => ({t: l.textContent ?? '', r: l.getBoundingClientRect()}));
  const overlappingNames: Array<string> = [];
  for (let i = 1; i < names.length; i++) {
    if (names[i].r.left < names[i - 1].r.right - 1) {
      overlappingNames.push(`${names[i - 1].t} / ${names[i].t}`);
    }
  }
  return {zones, overlappingNames};
});

/** The score's hierarchy: the total's type against every ledger value's. */
const heroRatio = (page: Page) => page.evaluate(() => {
  const size = (el: Element | null) => (el === null ? 0 : parseFloat(getComputedStyle(el).fontSize));
  const total = size(document.querySelector('.con-info [data-dossier-total]'));
  const values = Array.from(document.querySelectorAll('.con-info .con-dscore__value')).map(size);
  return {total, maxValue: Math.max(0, ...values), rows: document.querySelector('.con-info [data-dossier-score]')?.getAttribute('data-dscore-rows') ?? ''};
});

async function expectSeatClean(page: Page, preset: string, seat: string): Promise<void> {
  const audit = await auditZones(page);
  expect(audit.zones.length, `${seat}: the dossier stands`).toBeGreaterThanOrEqual(3);
  for (const z of audit.zones) {
    expect(z.escapes, `${preset} · ${seat} · zone «${z.zone}»: nothing stands outside the plate`).toEqual([]);
  }
  expect(await cutNames(page, '.con-info .con-dscore__label'), `${preset} · ${seat}: no ledger name is cut`).toEqual([]);
  expect(await cutNames(page, '.con-info .con-dcards__label'), `${preset} · ${seat}: no pile name is cut`).toEqual([]);
  expect(await cutNames(page, '.con-info .con-deff__label'), `${preset} · ${seat}: no medallion name is cut`).toEqual([]);
  expect(audit.overlappingNames, `${preset} · ${seat}: no two pile names overlap`).toEqual([]);
  const hero = await heroRatio(page);
  if (hero.total > 0) {
    expect(hero.total, `${preset} · ${seat}: the total (${hero.total}px) is the zone's hero over every category value (${hero.maxValue}px)`)
      .toBeGreaterThanOrEqual(hero.maxValue * 2.5);
  }
}

for (const preset of PRESETS) {
  test.describe(`Information polish · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`(A–D) the dossier holds every zone, the total leads, the bot is one more player, its screen holds its plates (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const pageErrors: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      await bootFixtureSeats(page, request, FIXTURE, {query: preset.query});
      await settle(page);
      expect(await pressUntil(page, 'KeyY', async () => await page.locator('.con-info [data-dossier]').count() > 0, {tries: 4, settleMs: 1100}),
        'Y opens the Information dossier').toBe(true);
      await settle(page, {timeoutMs: 20_000});

      // ── (A)(B) the seat's own dossier, then a rival's ──
      await expectSeatClean(page, preset.id, 'own');
      expect((await heroRatio(page)).rows, 'eight categories (the Hydronetwork, a penalty) → four rows of two').toBe('4');
      await shoot(page, preset.id, '01-own');
      const seatName = () => page.locator('.con-info__head').first().innerText();
      let botSeen = false;
      for (let hop = 0; hop < 2; hop++) {
        await press(page, 'KeyE', 900);
        await settle(page, {timeoutMs: 20_000});
        const isBot = await page.locator('.con-info [data-zone="botdoor"]').count() > 0;
        await expectSeatClean(page, preset.id, isBot ? 'bot' : `rival «${(await seatName()).split('\n')[0]}»`);
        await shoot(page, preset.id, isBot ? '03-bot' : '02-rival');
        if (!isBot) {
          continue;
        }
        botSeen = true;
        // ── (C) the bot's door in the players' grammar ──
        const door = page.locator('.con-info [data-zone="botdoor"]');
        await expect(door.locator('[data-dossier-door] .con-deff'), 'the door\'s four medallions (its decks)').toHaveCount(4);
        await expect(door.locator('.con-card-back, .mb-tracks'), 'no bot-only objects on the summary (no card backs, no mat)').toHaveCount(0);
        if (preset.id === 'tv4k') {
          // The owner's decision (2026-10-19, «крупнее на TV»): on the couch the door's one plate is filled by its medallions.
          const fill = await door.evaluate((zone) => {
            const z = zone.getBoundingClientRect();
            const disc = zone.querySelector('.con-deff__disc')!.getBoundingClientRect();
            return {disc: disc.height / z.height};
          });
          expect(fill.disc, `tv4k: the door's medallions stand at the tier's scale (disc ${Math.round(fill.disc * 100)} % of the plate)`).toBeGreaterThan(0.22);
        }

        // ── (D) inside the door ──
        expect(await focusInfoZone(page, 'botdoor'), 'the ring reaches the bot door').toBe(true);
        await pressUntilVisible(page, 'Enter', '[data-bot-entry="botBoard"]', {tries: 3, settleMs: 900});
        await settle(page, {timeoutMs: 20_000});
        await expect(page.locator('.con-botscr__entry'), 'the hub\'s two doors').toHaveCount(2);
        const plates = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.con-botscr__plate')).map((p) => ({
          cls: p.className.toString().split(' ').find((c) => c.startsWith('con-botscr__plate--')) ?? '',
          over: p.scrollHeight - p.clientHeight,
          wide: p.scrollWidth - p.clientWidth,
        })));
        expect(plates.length, 'the hub\'s plates').toBeGreaterThanOrEqual(5);
        for (const p of plates) {
          expect(p.over, `${preset.id}: «${p.cls}» holds its content (overflow ${p.over}px)`).toBeLessThanOrEqual(1);
          expect(p.wide, `${preset.id}: «${p.cls}» holds its width`).toBeLessThanOrEqual(1);
        }
        await shoot(page, preset.id, '04-bot-hub');
        // The printed board at the scene's scale + the three rules that read it.
        await pressUntilVisible(page, 'Enter', '.con-botboard .mb-tracks', {tries: 3, settleMs: 900});
        await settle(page, {timeoutMs: 20_000});
        await expect(page.locator('.con-botboard__rule'), 'the three rules that read the board').toHaveCount(3);
        await expect(page.locator('.con-botboard .mb-guide'), 'the teaching layer stands beside the board').toHaveCount(1);
        if (!preset.handheld) {
          const board = await page.evaluate(() => {
            const tracks = document.querySelector('.con-botboard .mb-tracks')!.getBoundingClientRect();
            const frame = document.querySelector('.con-botboard')!.getBoundingClientRect();
            const rules = Array.from(document.querySelectorAll('.con-botboard__rule')).map((r) => r.getBoundingClientRect().bottom);
            return {share: tracks.width / frame.width, rulesBottom: Math.max(...rules), frameBottom: frame.bottom};
          });
          expect(board.share, `${preset.id}: the board spans the opening (${Math.round(board.share * 100)} %)`).toBeGreaterThan(0.8);
          expect(board.rulesBottom, `${preset.id}: the rules stand inside the opening`).toBeLessThanOrEqual(board.frameBottom + 1);
        }
        await shoot(page, preset.id, '05-bot-board');
        // The bonus piles — one level back, the second door.
        await press(page, 'Escape', 900);
        await pressUntil(page, 'ArrowDown', async () => await page.locator('[data-bot-entry="botBonus"].con-botscr__entry--focused').count() > 0, {tries: 3, settleMs: 500});
        await pressUntilVisible(page, 'Enter', '.con-botbonus', {tries: 3, settleMs: 900});
        await settle(page, {timeoutMs: 20_000});
        const piles = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.con-botbonus__pile')).map((p) => ({
          key: p.dataset.bonusPile ?? '',
          faces: p.querySelectorAll('.mb-face').length,
          over: p.scrollHeight - p.clientHeight,
        })));
        expect(piles.map((p) => p.key), 'the discard and the destroyed piles').toEqual(expect.arrayContaining(['discard', 'destroyed']));
        expect(piles.find((p) => p.key === 'discard')?.faces, 'the discard pile shows its two faces').toBe(2);
        if (!preset.handheld) {
          for (const p of piles) {
            expect(p.over, `${preset.id}: the «${p.key}» pile holds its faces (overflow ${p.over}px)`).toBeLessThanOrEqual(1);
          }
        }
        await shoot(page, preset.id, '06-bot-bonus');
        break;
      }
      expect(botSeen, 'the bot seat was reached with RB').toBe(true);
      expect(pageErrors, 'no page error').toEqual([]);
    });
  });
}

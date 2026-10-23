import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixture, bootFixtureSeats, fetchPlayerModel, press, sendPlayerInput, settle} from './consoleStart';
import {JournalMock, applyJournalMock, journalArtIndex} from './journalChronicleMockups';

/**
 * CH · «ЖУРНАЛ — ХРОНИКА, НЕ ЛОГ» — the first e2e stand of the console journal (fixture `journal-chronicle`: a two-seat
 * base table whose generation 1 was PLAYED through the real doors — a play with two NAMED skips, a card action, another
 * seat's turn with an attack on blue's plants, a SEARCH draw, the income; generation 2 open with blue on the move).
 *
 *   (а) the panel on the rich generation — the probe's table: the share of ink, texts under the TV floor, clipped
 *       elements, the event art's size, how many times stand per group — and the frame;
 *   (б) ПОДРОБНО / СВОДКА and the generation pager are alive (LB / RB, LT / RT);
 *   (в) X inspects the focused event (the inspect card), B closes it;
 *   (г) the live feed: a new entry appears with the panel open, the scroll does not jump;
 *   (д) the notifications' token sizes are the same before and after (the chips are shared with the toasts);
 *   (е) reduced motion: the panel opens and reads.
 *
 * `TM_E2E_SHOTS_TAG=before|after` keeps two runs' frames and tables apart (the A/B of the polish);
 * `TM_E2E_JOURNAL_MOCKS=1` (or a list «M2,M3») also paints the mockups over the live panel and shoots them.
 * Three profiles on purpose: the journal's line-length cap and the couch floor are per-profile numbers.
 */

const TAG = process.env.TM_E2E_SHOTS_TAG ?? 'after';
const OUT = path.resolve('screenshots', 'journal-chronicle', TAG);
/** `TM_E2E_JOURNAL_MOCKS=M1,M2,M3` (or `1` for all three) — the mockups painted over the live panel. */
const MOCK_ENV = process.env.TM_E2E_JOURNAL_MOCKS ?? '';
const MOCKS: ReadonlyArray<JournalMock> = MOCK_ENV === '1' ? ['M1', 'M2', 'M3'] :
  (['M1', 'M2', 'M3'] as const).filter((m) => MOCK_ENV.split(',').includes(m));

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: ''},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=auto'},
] as const;

async function shot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
}

async function openJournal(page: Page): Promise<void> {
  for (let i = 0; i < 4 && await page.locator('.con-journal').count() === 0; i++) {
    await press(page, 'KeyR', 900);
  }
  await page.locator('.con-journal').waitFor({timeout: 15_000});
  await expect.poll(() => page.locator('.con-journal__node').count(), {timeout: 15_000}).toBeGreaterThan(3);
  await settle(page, {timeoutMs: 15_000});
}

type JournalProbe = {
  panel: {w: number, h: number};
  nodes: number;
  groups: number;
  times: number;
  timesPerGroup: number;
  /** The share of the visible list's area covered by glyph ink (text ranges) — the density of the wall of words. */
  ink: number;
  chips: number;
  arrows: number;
  belowFloor: Array<string>;
  clipped: Array<string>;
  artPx: Array<number>;
  /** Native `title` attributes inside the panel (banned in new UI). */
  titles: number;
};

/** The panel's honest reading, measured on the live DOM. */
async function probeJournal(page: Page): Promise<JournalProbe> {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('.con-journal')!;
    const viewport = panel.querySelector<HTMLElement>('.con-journal__scroll') ?? panel;
    const vr = viewport.getBoundingClientRect();
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.bottom < vr.top || r.top > vr.bottom) {
        return false;
      }
      for (let n: Element | null = el; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) {
          return false;
        }
      }
      return true;
    };
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const floor = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--con-t-floor')) * rem;
    let inkArea = 0;
    const walker = document.createTreeWalker(viewport, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if ((node.textContent ?? '').trim() === '' || node.parentElement === null || !shown(node.parentElement)) {
        continue;
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) {
        const top = Math.max(r.top, vr.top);
        const bottom = Math.min(r.bottom, vr.bottom);
        if (bottom > top) {
          inkArea += r.width * (bottom - top);
        }
      }
    }
    const texts = Array.from(panel.querySelectorAll<HTMLElement>('*'))
      .filter((el) => Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== ''))
      .filter((el) => el.closest('.pcard, svg, .gp-glyph') === null && shown(el));
    const label = (el: Element) => `${el.className.toString().split(' ')[0]} «${(el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 28)}»`;
    const groups = Array.from(viewport.querySelectorAll('.journal-group')).filter(shown);
    const times = Array.from(viewport.querySelectorAll('.journal-group__time, .journal-entry__time')).filter(shown);
    return {
      panel: {w: Math.round(panel.getBoundingClientRect().width), h: Math.round(panel.getBoundingClientRect().height)},
      nodes: Array.from(viewport.querySelectorAll('.con-journal__node')).filter(shown).length,
      groups: groups.length,
      times: times.length,
      timesPerGroup: groups.length === 0 ? 0 : Math.round(times.length / groups.length * 100) / 100,
      ink: Math.round(inkArea / Math.max(1, vr.width * vr.height) * 1000) / 1000,
      chips: Array.from(viewport.querySelectorAll('.journal-chip, .journal-player, .journal-child-row__chip, .journal-token')).filter(shown).length,
      arrows: Array.from(viewport.querySelectorAll('.journal-child-row__arrow')).filter(shown).length,
      belowFloor: texts.filter((el) => parseFloat(getComputedStyle(el).fontSize) + 0.5 < floor).map(label).slice(0, 40),
      clipped: texts.filter((el) => {
        const cs = getComputedStyle(el);
        return (cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) || cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
      }).map(label).slice(0, 40),
      artPx: Array.from(viewport.querySelectorAll<HTMLElement>('.journal-group__art')).filter(shown).map((el) => Math.round(el.getBoundingClientRect().width)),
      titles: panel.querySelectorAll('[title]').length,
    };
  });
}

function keep(preset: string, name: string, data: unknown): void {
  fs.mkdirSync('test-results', {recursive: true});
  fs.writeFileSync(path.join('test-results', `journal-chronicle-${TAG}-${preset}-${name}.json`), JSON.stringify(data, null, 1));
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  fs.writeFileSync(path.join(OUT, preset, `${name}.json`), JSON.stringify(data, null, 1));
}

/** The notifications' token sizes (the chips shared with the toasts) — the same numbers before and after the polish. */
async function notificationTokenStyle(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const host = document.createElement('div');
    host.className = 'con-notif__tokens';
    host.style.position = 'fixed';
    host.style.left = '-9999px';
    host.innerHTML = '<span class="journal-text">x</span><span class="journal-player"><span class="journal-player__name">p</span></span>' +
      '<span class="journal-chip journal-chip--card"><span class="journal-chip__label">c</span></span><span class="journal-res"><i class="journal-res__icon"></i></span>';
    document.body.appendChild(host);
    const out: Record<string, string> = {};
    host.querySelectorAll<HTMLElement>('*').forEach((el) => {
      const cs = getComputedStyle(el);
      out[el.className] = `${cs.fontSize} ${cs.fontWeight} ${cs.width}x${cs.height} ${cs.padding} ${cs.borderRadius} ${cs.backgroundColor}`;
    });
    host.remove();
    return out;
  });
}

for (const preset of PRESETS) {
  test.describe(`CH · the journal's chronicle stand · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`(а–д) the rich generation: the probe, the modes, the pager, the inspect, the live feed (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const pageErrors: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      const {seats} = await bootFixtureSeats(page, request, 'journal-chronicle', {query: preset.query});
      const tokensBefore = await notificationTokenStyle(page);

      // ── (а) the panel on the rich generation ──
      await openJournal(page);
      const detail = await probeJournal(page);
      keep(preset.id, 'probe-detail', detail);
      await shot(page, preset.id, '01-detail');
      expect(detail.groups, 'the generation reads as event groups').toBeGreaterThan(0);

      // ── (б) the modes and the pager ──
      await press(page, 'KeyE', 700);
      await expect(page.locator('.journal-group--summary').first(), 'RB → СВОДКА').toBeVisible({timeout: 8_000});
      keep(preset.id, 'probe-summary', await probeJournal(page));
      await shot(page, preset.id, '02-summary');
      await press(page, 'KeyQ', 700);
      await expect(page.locator('.journal-group--summary'), 'LB → ПОДРОБНО').toHaveCount(0, {timeout: 8_000});
      const genLabel = () => page.locator('.con-journal__gen-label').innerText();
      const genNow = await genLabel();
      await press(page, 'Comma', 900);
      await expect.poll(genLabel, {timeout: 8_000, message: 'LT pages to the previous generation'}).not.toBe(genNow);
      await settle(page, {timeoutMs: 10_000});
      keep(preset.id, 'probe-gen1', await probeJournal(page));
      await shot(page, preset.id, '03-generation-1');
      await press(page, 'Period', 900);
      await expect.poll(genLabel, {timeout: 8_000, message: 'RT pages back'}).toBe(genNow);

      // ── (в) X inspects the focused event — a card's event opens the card's viewer (the zoom), B gives the journal back ──
      const zoomOpen = () => page.evaluate(() => document.body.classList.contains('con-zoom-open'));
      for (let i = 0; i < 6 && !await zoomOpen(); i++) {
        await press(page, 'ArrowUp', 300);
        await press(page, 'KeyX', 900);
      }
      expect(await zoomOpen(), 'X on an event with a card opens its viewer').toBe(true);
      await shot(page, preset.id, '04-inspect');
      await press(page, 'Escape', 900);
      await expect.poll(zoomOpen, {timeout: 8_000, message: 'B closes the viewer'}).toBe(false);
      await expect(page.locator('.con-journal'), 'the journal stands behind it').toHaveCount(1);

      // ── (г) the live feed: a pass of the seat on the move (blue — red passed already), posted while the panel stands ──
      const before = await page.locator('.con-journal__node').count();
      const scrollBefore = await page.locator('.con-journal__scroll').evaluate((el) => el.scrollTop);
      type Menu = {waitingFor?: {options?: Array<{title?: unknown}>}};
      const models = await Promise.all(seats.map(async (id) => ({id, model: await fetchPlayerModel(request, id) as unknown as Menu})));
      const mover = models.find((m) => (m.model.waitingFor?.options ?? []).some((o) => JSON.stringify(o.title ?? '').includes('Pass for this generation')));
      expect(mover, 'a seat is on the move and can pass').toBeDefined();
      const passIndex = (mover!.model.waitingFor?.options ?? []).findIndex((o) => JSON.stringify(o.title ?? '').includes('Pass for this generation'));
      await sendPlayerInput(request, mover!.id, {type: 'or', index: passIndex, response: {type: 'option'}});
      await expect.poll(() => page.locator('.con-journal__node').count(), {timeout: 30_000, message: 'the new entry arrives live'}).toBeGreaterThan(before);
      const scrollAfter = await page.locator('.con-journal__scroll').evaluate((el) => el.scrollTop);
      expect(scrollAfter, 'the scroll never jumps back over the feed').toBeGreaterThanOrEqual(scrollBefore - 2);
      await shot(page, preset.id, '05-live');

      // ── (д) the toasts' tokens are untouched ──
      expect(await notificationTokenStyle(page), 'the notification chips keep their paint').toEqual(tokensBefore);
      keep(preset.id, 'notification-tokens', tokensBefore);

      expect(pageErrors, 'no page errors').toEqual([]);
    });

    if (preset.id === 'tv4k') {
      for (const mock of MOCKS) {
        test(`mockup ${mock} over the live panel (${preset.id})`, async ({page, request}) => {
          test.setTimeout(180_000);
          await bootFixture(page, request, 'journal-chronicle', {query: preset.query});
          await openJournal(page);
          await applyJournalMock(page, mock, journalArtIndex());
          await settle(page, {timeoutMs: 10_000});
          keep(preset.id, `probe-mock-${mock}`, await probeJournal(page));
          await shot(page, preset.id, `mock-${mock}`);
          await press(page, 'Comma', 900);
          await settle(page, {timeoutMs: 10_000});
          await applyJournalMock(page, mock, journalArtIndex());
          await shot(page, preset.id, `mock-${mock}-gen1`);
        });
      }
    }

    test(`(е) reduced motion: the panel opens and reads (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await page.emulateMedia({reducedMotion: 'reduce'});
      await bootFixture(page, request, 'journal-chronicle', {query: preset.query});
      await openJournal(page);
      const probe = await probeJournal(page);
      expect(probe.groups, 'the groups read under reduced motion').toBeGreaterThan(0);
    });
  });
}

import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, cinematicBeat, press, soloGameConfig} from './consoleStart';

/**
 * DIAGNOSTICS — the premium journal, «Сообщить о проблеме», the connection check and the developer's notice
 * (docs/claude/diagnostics.md), on the TV profile.
 *
 * What it guards:
 *  · the developer's notice raises for a REAL uncaught error of the page (thrown here on purpose) and for a record
 *    the hub pushes (a stall); hold X opens the record in full; a tap stays the screen's own X;
 *  · the surface is ONE card that never moves: across cursor moves, filter changes and every step of every flow the
 *    card's box and the body cell's box are identical (the system surface's layout-shift contract);
 *  · the crumb only ever GAINS a tail; B is one logical level; a finished report LEAVES;
 *  · the report: category → review → one commit → the beat → the code — with a hub that delivers, a hub that queues
 *    (no network) and a hub that does not answer (the refusal speaks, the draft survives);
 *  · the connection check answers per runtime;
 *  · reduced motion: a step arrives by opacity alone.
 *
 * The hub is a STAND (`window.__tmDiagTransport`, set by an init script): a browser has no main process, and the
 * subject here is the surface. The hub itself is unit-tested against a recording collector
 * (`tests/server/diagnostics/diagnosticsHub.spec.ts`); the real road is proven on the release build
 * («Проверка связи» on the box — the developer's guide).
 *
 * It also takes the 4K screenshots of every state (`screenshots/console-diagnostics/`) — the guides use them.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'console-diagnostics');

type Box = {x: number, y: number, width: number, height: number};

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** The stand's hub: answers the page's protocol from memory, and lets the spec push records and change its mood. */
async function installStandHub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Stand = {
      mode: 'sent' | 'queued' | 'limited' | 'silent',
      consent: boolean,
      calls: Array<{verb: string, request: unknown}>,
      lines: Array<unknown>,
      listeners: Array<(push: unknown) => void>,
      push(push: unknown): void,
    };
    const stand: Stand = {
      mode: 'sent', consent: true, calls: [], lines: [], listeners: [],
      push(push) {
        this.listeners.forEach((l) => l(push));
      },
    };
    const status = () => ({
      environment: 'box', release: 'terraforming-mars@e2e', appMode: 'host', sendingOff: stand.consent ? '' : 'consent', consent: stand.consent,
      queued: stand.mode === 'queued' || stand.mode === 'limited' ? 1 : 0, lastDeliveredAt: stand.mode === 'sent' ? Date.now() : 0,
      lastError: stand.mode === 'limited' ? 'the collector is not taking events — its limit is reached (usage_exceeded)' : '',
      limitedWhat: stand.mode === 'limited' ? 'events' : '', limitedReason: stand.mode === 'limited' ? 'usage_exceeded' : '',
      reportsDir: '/home/deck/.config/terraforming-mars/diagnostics/reports',
    });
    const later = <T>(ms: number, value: T): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));
    (window as unknown as {__diagStand: Stand}).__diagStand = stand;
    (window as unknown as {__tmDiagTransport: unknown}).__tmDiagTransport = {
      invoke(verb: string, request: unknown) {
        stand.calls.push({verb, request});
        switch (verb) {
        case 'journal': return Promise.resolve([]);
        case 'status': return Promise.resolve(status());
        case 'set-consent':
          stand.consent = request === true;
          return Promise.resolve(status());
        case 'report':
          if (stand.mode === 'silent') {
            return later(900, undefined);
          }
          return later(2600, {
            code: 'TM-K7QW3D', state: stand.mode === 'sent' ? 'sent' : 'queued',
            waits: stand.mode === 'sent' ? '' : (stand.mode === 'limited' ? 'limit' : 'network'), filesRefused: false,
            folder: '/home/deck/.config/terraforming-mars/diagnostics/reports/TM-K7QW3D',
            parts: [
              {name: 'report.json', bytes: 2100, truncated: false}, {name: 'journal.json', bytes: 48_000, truncated: false},
              {name: 'field_record.json', bytes: 21_000, truncated: false}, {name: 'console_export.txt', bytes: 910_000, truncated: false},
              {name: 'screen.jpg', bytes: 640_000, truncated: false}, {name: 'save.json', bytes: 1_300_000, truncated: false},
            ],
          });
        case 'selftest':
          if (stand.mode === 'limited') {
            const reason = 'the collector is not taking events — its limit is reached (usage_exceeded)';
            return later(1200, {tookMs: 1200, rows: [
              {runtime: 'page', state: 'failed', eventId: '', reason, limited: true},
              {runtime: 'main', state: 'failed', eventId: '', reason, limited: true},
              {runtime: 'server', state: 'failed', eventId: '', reason, limited: true},
            ]});
          }
          return later(1800, {tookMs: 1800, rows: [
            {runtime: 'page', state: 'delivered', eventId: 'a'.repeat(32), reason: '', limited: false},
            {runtime: 'main', state: 'delivered', eventId: 'b'.repeat(32), reason: '', limited: false},
            {runtime: 'server', state: stand.mode === 'queued' ? 'failed' : 'delivered', eventId: '', reason: stand.mode === 'queued' ? 'no connection (net::ERR_INTERNET_DISCONNECTED)' : '', limited: false},
          ]});
        case 'copy': return Promise.resolve(true);
        default: return Promise.resolve(true);
        }
      },
      send(line: unknown) {
        stand.lines.push(line);
      },
      onPush(listener: (push: unknown) => void) {
        stand.listeners.push(listener);
      },
    };
    // The developer's notice is an opt-in: this spec turns it on before the page boots.
    localStorage.setItem('tm_diag_dev_notices', 'all');
  });
}

/** A record «born outside the page»: the arbiter's episode as the journal keeps it (pushed — printing the arbiter's own line would be this harness's red). */
function stallEntry(): Record<string, unknown> {
  const at = Date.now();
  return {
    id: 'main-e2e-1', at, lastAt: at + 3000, kind: 'stall', family: 'liveness', level: 'warn', runtime: 'page', count: 1, build: 'e2e',
    title: 'stall (unserved): 10s without progress, 0 presses; asked: card',
    text: [
      '[liveness] stall (unserved): 10s without progress, 0 presses; asked: card; beat: executing; stranded: no; last in flight: nothing; claim: hand/Ganymede Colony [draw] awaiting (zone up, beat pending, arrival pending, task card); holds: card-receive[blocking] — rung 0: presentation stories degraded',
      '[liveness] stall (unserved): 12s without progress, 0 presses; asked: card; beat: executing; stranded: no; last in flight: nothing; claim: none; holds: none — rung 2: a claim released with force',
      '[liveness] recovered after 13s, 2 rung(s) run',
    ].join('\n'),
    episode: {state: 'healed', durationMs: 13_000, lines: 3, steps: ['rung 0: presentation stories degraded', 'rung 2: a claim released with force']},
    screen: {screen: 'player-home', section: 'hand/', prompt: 'card#12', accepting: false, inFlight: [], frames: ['hand:committed'], quietS: 12, block: 'reveal', profile: 'tv', viewport: '3840×2160@1'},
    delivery: {state: 'sent', eventId: 'c'.repeat(32)},
  };
}

async function boxOf(page: Page, selector: string): Promise<Box> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${selector} has a box`).not.toBeNull();
  return box as Box;
}

const step = (page: Page) => page.locator('.con-sys--diag').getAttribute('data-diag-step');
const crumb = (page: Page) => page.locator('[data-diag-crumb]').evaluateAll((els) => els.map((el) => el.getAttribute('data-diag-crumb')));

test.describe('diagnostics — the journal, the report, the connection check, the developer\'s notice', () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1});

  test('the whole surface on the TV: one card that never moves, every state photographed', async ({page, request}) => {
    test.setTimeout(420_000);
    await installStandHub(page);
    await bootIntoGame(page, request, {config: soloGameConfig(), buy: 2, query: PRESET.query});

    // ── THE NOTICE: a real uncaught error of the page ────────────────────────────────────────────────────────────
    await page.evaluate(() => {
      setTimeout(() => {
        const hand = undefined as unknown as {cards: Array<unknown>};
        // The real thing: a TypeError out of an async beat, caught by nobody.
        return hand.cards.length;
      }, 0);
    });
    const notice = page.locator('.con-devnote');
    const plate = page.locator('.con-devnote__plate');
    await expect(plate).toBeVisible();
    await expect(notice).toHaveAttribute('data-dev-notice', 'plate');
    await expect(notice).toHaveAttribute('data-dev-notice-kind', 'error');
    await expect(notice.locator('.con-devnote__raw')).toContainText('[page-error] uncaught: TypeError');
    // IT COVERS NOTHING: inside the central opening's one free corner — clear of both bars and both rails, of the
    // hand's dock, of every scale of the board and of every cell of the planet.
    const noticeBox = await boxOf(page, '.con-devnote__plate');
    const covered = await page.evaluate((box) => {
      const hits = (sel: string): Array<string> => Array.from(document.querySelectorAll(sel)).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.left < box.x + box.width && r.right > box.x && r.top < box.y + box.height && r.bottom > box.y;
      }).map((el) => `${sel} (${el.className.toString().slice(0, 60)})`);
      return [
        ...hits('.con-res'), ...hits('.con-strat'), ...hits('.con-cmdbar'), ...hits('.con-status'), ...hits('.con-handdock'),
        // (A scale's SVG box is far larger than its ink — what is painted there is asked of its numerals.)
        ...hits('.global-numbers-shell text'), ...hits('.board-space'), ...hits('.con-notif'),
      ];
    }, noticeBox);
    expect(covered, 'the plate stands over nothing of the game').toEqual([]);
    await cinematicBeat(page, 500, 'the plate\'s one-shot entry settles before its photograph');
    await shoot(page, '01-notice-plate');

    // A second record, from the hub: a stall of the screen, cured — the plate takes it.
    await page.evaluate((entry) => (window as unknown as {__diagStand: {push(p: unknown): void}}).__diagStand.push({kind: 'entry', entry}), stallEntry());
    await expect(notice).toHaveAttribute('data-dev-notice-kind', 'stall');
    await cinematicBeat(page, 500, 'the plate\'s one-shot entry settles before its photograph');
    await shoot(page, '02-notice-stall');
    // …and folds into the chip that keeps the count.
    await expect(notice).toHaveAttribute('data-dev-notice', 'chip', {timeout: 20_000});
    await expect(page.locator('.con-devnote__chip')).toBeVisible();
    await expect(notice.locator('.con-devnote__tally--errors')).toContainText('1');
    await expect(notice.locator('.con-devnote__tally--stalls')).toContainText('1');
    await cinematicBeat(page, 400, 'the fold\'s crossfade ends');
    await shoot(page, '03-notice-chip');

    // ── HOLD X opens the record in full ──────────────────────────────────────────────────────────────────────────
    await page.keyboard.down('KeyX');
    await cinematicBeat(page, 900, 'the X-hold fills (500 ms) and the surface rises');
    await page.keyboard.up('KeyX');
    await expect(page.locator('.con-sys--diag')).toHaveCount(1);
    await expect.poll(() => step(page)).toBe('entry');
    expect(await crumb(page)).toEqual(['entry']);
    await expect(page.locator('[data-diag-episode]')).toContainText('a claim released with force');
    await expect(page.locator('[data-diag-text]')).toContainText('[liveness] recovered after 13s, 2 rung(s) run');
    await expect(notice, 'the notice is seen: it steps away while the journal is open').toHaveCount(0);
    await cinematicBeat(page, 600, 'the step\'s reveal ends');
    await shoot(page, '04-entry-stall');

    const card = await boxOf(page, '.con-sys__card');
    const cell = await boxOf(page, '.con-diag');
    // (Read through a poll: a member of the system surface that has just RISEN is still on its entry's scale for a
    // few frames — the claim is about where the card STANDS, on every step.)
    const sameFrame = async (where: string): Promise<void> => {
      await expect.poll(() => boxOf(page, '.con-sys__card'), {message: `the card did not move — ${where}`, timeout: 5_000}).toEqual(card);
      await expect.poll(() => boxOf(page, '.con-diag'), {message: `the body cell did not move — ${where}`, timeout: 5_000}).toEqual(cell);
    };

    // ── BROWSE: B is one level; the journal under its filters ────────────────────────────────────────────────────
    await press(page, 'Escape');
    await expect.poll(() => step(page)).toBe('browse');
    expect(await crumb(page)).toEqual([]);
    // (The journal also holds whatever the game itself said on this run — a slow frame at boot is a record too — so
    // the rows are asked for by family, never counted.)
    await expect(page.locator('[data-diag-row="liveness"]')).toHaveCount(1);
    await expect(page.locator('[data-diag-row="page-error"]')).toHaveCount(1);
    await expect(page.locator('.con-diag__row').first(), 'newest first').toHaveAttribute('data-diag-row', 'liveness');
    await sameFrame('entry → browse');
    await cinematicBeat(page, 500, 'the step\'s reveal ends');
    await shoot(page, '05-journal');
    await press(page, 'ArrowDown');
    await expect(page.locator('.con-diag__row--cursor')).toHaveAttribute('data-diag-row', 'page-error');
    await sameFrame('a cursor move');
    // The filters (RB): errors → stalls → other (empty) → system.
    await page.locator('[data-diag-tab="errors"]').click();
    await expect(page.locator('[data-diag-row]')).toHaveCount(1);
    await expect(page.locator('[data-diag-row="page-error"]')).toHaveCount(1);
    await sameFrame('filter: errors');
    await page.locator('[data-diag-tab="stalls"]').click();
    await expect(page.locator('[data-diag-row="liveness"]')).toHaveCount(1);
    await sameFrame('filter: stalls');
    await page.locator('[data-diag-tab="system"]').click();
    await expect(page.locator('[data-diag-system]')).toBeVisible();
    await expect(page.locator('[data-diag-group="Reports"]')).toContainText('Машина разработчика');
    await sameFrame('the system readout');
    await shoot(page, '07-system');

    // ── THE CONNECTION CHECK ─────────────────────────────────────────────────────────────────────────────────────
    await press(page, 'Enter');
    await expect.poll(() => step(page)).toBe('selftest');
    expect(await crumb(page)).toEqual(['selftest']);
    await expect(page.locator('[data-diag-check-row]')).toHaveCount(3);
    await sameFrame('the connection check, running');
    await shoot(page, '08-check-running');
    await expect(page.locator('[data-diag-check="done"]')).toHaveCount(1, {timeout: 15_000});
    await expect(page.locator('.con-diagcheck__row--delivered')).toHaveCount(3);
    await expect(page.locator('.con-diagcheck__summary')).toHaveText('Всё доходит до разработчика');
    await sameFrame('the connection check, answered');
    await shoot(page, '09-check-done');
    await press(page, 'Escape');
    await expect.poll(() => step(page)).toBe('browse');

    // ── THE FRAMES OF OUR OWN CODE ARE READABLE ──────────────────────────────────────────────────────────────────
    // The check's own record was born INSIDE the bundle, so its frames are minified positions of `main.js` — and the
    // journal reads them back to the sources (the error thrown below comes out of this spec's `evaluate`: it has no
    // frame of the bundle to read).
    await page.locator('[data-diag-tab="other"]').click();
    await page.locator('[data-diag-row="selftest"]').first().click();
    await expect.poll(() => step(page)).toBe('entry');
    await expect(page.locator('[data-diag-stack]')).toHaveAttribute('data-diag-resolved', 'yes', {timeout: 15_000});
    await expect(page.locator('[data-diag-stack] .con-diagentry__frame-at').first()).toHaveText(/^src\/client\/diagnostics\/diagnosticsSurface\.ts:\d+$/);
    await sameFrame('a record with its frames read back');
    await cinematicBeat(page, 600, 'the step reveals');
    await shoot(page, '21-entry-frames');
    await press(page, 'Escape');
    await expect.poll(() => step(page)).toBe('browse');

    // ── THE ERROR in full, and the report opened FROM it ─────────────────────────────────────────────────────────
    await page.locator('[data-diag-tab="errors"]').click();
    await press(page, 'Enter');
    await expect.poll(() => step(page)).toBe('entry');
    await expect(page.locator('[data-diag-stack] .con-diagentry__message')).toContainText('TypeError');
    await expect(page.locator('[data-diag-stack] .con-diagentry__frame').first()).toBeVisible();
    // No sideways scroll anywhere on a reading surface: every line wraps.
    const sideways = await page.locator('.con-diagentry__scroll .con-scroll-area__viewport, .con-diagentry__text').evaluateAll(
      (els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).length);
    expect(sideways, 'nothing scrolls sideways').toBe(0);
    await sameFrame('the error in full');
    await cinematicBeat(page, 600, 'the step\'s reveal ends');
    await shoot(page, '10-entry-error');
    await press(page, 'KeyX');
    await expect(page.locator('[data-diag-foot]')).toContainText('Скопировано');

    await press(page, 'Enter');
    await expect.poll(() => step(page)).toBe('category');
    expect(await crumb(page)).toEqual(['report']);
    await expect(page.locator('[data-diag-category]')).toHaveCount(5);
    await sameFrame('the report: what happened');
    await cinematicBeat(page, 600, 'the step\'s reveal ends');
    await shoot(page, '11-report-category');
    await press(page, 'Enter');
    await expect.poll(() => step(page)).toBe('review');
    expect((await crumb(page)).length, 'the crumb gained the category').toBe(2);
    await expect(page.locator('.con-diagrep__attach')).toHaveCount(5);
    await expect(page.locator('[data-diag-commit]')).toHaveClass(/con-diagrep__commit--cursor/);
    await sameFrame('the report: review');
    await cinematicBeat(page, 600, 'the step\'s reveal ends');
    await shoot(page, '12-report-review');

    // THE COMMIT: the beat stands, the pad is absorbed, the code is revealed in the cells that waited for it.
    await press(page, 'Enter', 300, {absorbed: 'allow'});
    await expect.poll(() => step(page)).toBe('sending');
    expect((await crumb(page)).pop()).toBe('sending');
    await sameFrame('the report: sending');
    await press(page, 'Enter', 300, {absorbed: 'allow'});
    await press(page, 'Escape', 300, {absorbed: 'allow'});
    await expect.poll(() => step(page), {message: 'a beat is not a destination of B, and A sends nothing twice'}).toBe('sending');
    await shoot(page, '13-report-sending');
    await expect.poll(() => step(page), {timeout: 20_000}).toBe('done');
    await expect(page.locator('[data-diag-code]')).toHaveAttribute('aria-label', 'TM-K7QW3D');
    await expect(page.locator('.con-diagsend__cell--lit')).toHaveCount(6);
    await expect(page.locator('.con-diagsend__title')).toHaveText('Отчёт уже у разработчика');
    await expect(page.locator('[data-diag-folder]')).toContainText('TM-K7QW3D');
    await sameFrame('the report: the code');
    const reports = await page.evaluate(() => (window as unknown as {__diagStand: {calls: Array<{verb: string, request: {category: string, entryId: string, journal: Array<unknown>}}>}}).__diagStand.calls.filter((c) => c.verb === 'report'));
    expect(reports, 'one press — one report').toHaveLength(1);
    expect(reports[0].request.entryId, 'the report carries the record it was opened from').not.toBe('');
    expect(reports[0].request.journal.length).toBeGreaterThanOrEqual(2);
    await cinematicBeat(page, 900, 'the code\'s cells finish their reveal');
    await shoot(page, '14-report-code');
    // A FINISHED FLOW LEAVES: A closes the whole overlay — the board is back.
    await press(page, 'Enter');
    await expect(page.locator('.con-sys')).toHaveCount(0);

    // ── NO NETWORK: the same flow from the system menu — queued, never lost ──────────────────────────────────────
    await page.evaluate(() => {
      (window as unknown as {__diagStand: {mode: string}}).__diagStand.mode = 'queued';
    });
    await press(page, 'KeyM');
    await expect(page.locator('.con-sys--menu')).toHaveCount(1);
    await page.locator('.con-sysact__plate', {hasText: 'Сообщить о проблеме'}).click();
    await expect.poll(() => step(page)).toBe('category');
    await sameFrame('the report from the system menu');
    await press(page, 'Enter');
    await press(page, 'Enter', 300, {absorbed: 'allow'});
    await expect.poll(() => step(page), {timeout: 20_000}).toBe('done');
    await expect(page.locator('.con-diagsend__title')).toHaveText('Отчёт уйдёт, когда появится сеть');
    await cinematicBeat(page, 900, 'the code\'s cells finish their reveal');
    await shoot(page, '15-report-queued');
    await press(page, 'Enter');
    await expect(page.locator('.con-sys')).toHaveCount(0);

    // ── THE RECEIVING SERVICE IS FULL: its limit is not the player's network, and no screen says «сеть» ───────────
    await page.evaluate(() => {
      (window as unknown as {__diagStand: {mode: string}}).__diagStand.mode = 'limited';
    });
    await press(page, 'KeyM');
    await expect(page.locator('.con-sys--menu')).toHaveCount(1);
    await page.locator('.con-sysact__plate', {hasText: 'Сообщить о проблеме'}).click();
    await expect.poll(() => step(page)).toBe('category');
    await press(page, 'Enter');
    await press(page, 'Enter', 300, {absorbed: 'allow'});
    await expect.poll(() => step(page), {timeout: 20_000}).toBe('done');
    await expect(page.locator('.con-diagsend__title')).toHaveText('Отчёт сохранён и уйдёт позже');
    await expect(page.locator('.con-diagsend')).toContainText('ваш интернет ни при чём');
    await expect(page.locator('.con-diagsend'), 'a limit is never told as a missing network').not.toContainText('сеть');
    await sameFrame('the report: the service is full');
    await cinematicBeat(page, 900, 'the cells of the code finish their reveal');
    await shoot(page, '22-report-limited');
    await press(page, 'Enter');
    await expect(page.locator('.con-sys')).toHaveCount(0);
    // The developer reads the same truth on the system readout — with the collector's own word for the reason…
    await press(page, 'KeyM');
    await page.locator('.con-sysact__plate', {hasText: 'Диагностика'}).click();
    await expect.poll(() => step(page)).toBe('browse');
    await page.locator('[data-diag-tab="system"]').click();
    const sendingRow = page.locator('[data-diag-group="Reports"] .con-set__ro').first();
    await expect(sendingRow).toContainText('Служба приёма переполнена');
    await expect(page.locator('[data-diag-group="Reports"] .con-set__ro-note')).toContainText('usage_exceeded');
    // The words changed in a row that already stood: it is as tall as the row under it (one line), not a line taller.
    const rowHeights = await page.locator('[data-diag-group="Reports"] .con-set__ro').evaluateAll((rows) => rows.map((row) => Math.round(row.getBoundingClientRect().height)));
    expect(new Set(rowHeights).size, `every row of the group is one line tall — ${rowHeights.join(', ')}`).toBe(1);
    await sameFrame('the system readout: the service is full');
    await shoot(page, '23-system-limited');
    // …and the connection check does not send them to check the internet.
    await press(page, 'Enter');
    await expect.poll(() => step(page)).toBe('selftest');
    await expect(page.locator('[data-diag-check="done"]')).toHaveCount(1, {timeout: 15_000});
    await expect(page.locator('.con-diagcheck__summary')).toHaveText('Служба приёма переполнена');
    await expect(page.locator('.con-diagcheck__hint')).toContainText('Связь в порядке');
    await sameFrame('the connection check: the service is full');
    await shoot(page, '24-check-limited');
    await press(page, 'Escape');
    await press(page, 'Escape');
    await press(page, 'Escape');
    await expect(page.locator('.con-sys')).toHaveCount(0);

    // ── A HUB THAT DOES NOT ANSWER: the refusal speaks; B returns to the draft ───────────────────────────────────
    await page.evaluate(() => {
      (window as unknown as {__diagStand: {mode: string}}).__diagStand.mode = 'silent';
    });
    await press(page, 'KeyM');
    await page.locator('.con-sysact__plate', {hasText: 'Сообщить о проблеме'}).click();
    await expect.poll(() => step(page)).toBe('category');
    await press(page, 'Enter');
    await press(page, 'Enter', 300, {absorbed: 'allow'});
    await expect.poll(() => step(page), {timeout: 20_000}).toBe('failed');
    await expect(page.locator('.con-diagsend__title')).toHaveText('Не удалось собрать отчёт');
    await sameFrame('the report: refused');
    await shoot(page, '16-report-failed');
    await press(page, 'Escape');
    await expect.poll(() => step(page)).toBe('review');
    // B walks back one level at a time: review → category → the system list → the board.
    await press(page, 'Escape');
    await expect.poll(() => step(page)).toBe('category');
    await press(page, 'Escape');
    await expect(page.locator('.con-sys--menu')).toHaveCount(1);
    await press(page, 'Escape');
    await expect(page.locator('.con-sys')).toHaveCount(0);
  });

  test('from the main menu: «Сообщить о проблеме» opens the report; an empty filter says what to do next', async ({page}) => {
    test.setTimeout(120_000);
    await installStandHub(page);
    await page.goto('/?console=1&consoleProfile=tv');
    await page.waitForSelector('.cm-menu', {timeout: 45_000});
    // (The menu is mounted under the boot's curtain: what is measured and photographed is the menu the player sees.)
    await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000});
    await expect(page.locator('.cm-item', {hasText: 'Сообщить о проблеме'})).toBeVisible();
    // THE COLUMN HOLDS THE APP'S FULL SET. This page (a browser) shows the menu's shortest list; the desktop app adds
    // «Продолжить» and «Выйти» — nine plates on the box every day — and, at most, the Steam plate and an admin's
    // «Полигон»: eleven. The plates give way together (flex) down to their minimum height, so the claim is measured,
    // never budgeted: eleven fit at that floor, and the everyday nine keep both lines of text inside the plate.
    const column = await page.evaluate(() => {
      const items = document.querySelector('.cm-menu__items') as HTMLElement;
      const plates = [...items.querySelectorAll<HTMLElement>('.cm-item')];
      const style = getComputedStyle(items);
      return {
        count: plates.length,
        columnH: items.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
        gap: parseFloat(style.rowGap),
        minH: Math.max(...plates.map((el) => parseFloat(getComputedStyle(el).minHeight))),
        textH: Math.max(...plates.map((el) => (el.querySelector('.cm-item__text') as HTMLElement).getBoundingClientRect().height)),
        overflow: items.scrollHeight - items.clientHeight,
      };
    });
    test.info().annotations.push({type: 'menu-column', description: JSON.stringify(column)});
    expect(column.overflow, 'the column as it stands holds its plates').toBeLessThanOrEqual(1);
    expect(Math.floor((column.columnH + column.gap) / (column.minH + column.gap)), `eleven plates fit the column at their floor — ${JSON.stringify(column)}`).toBeGreaterThanOrEqual(11);
    expect((column.columnH - 8 * column.gap) / 9, `nine plates keep their two lines inside — ${JSON.stringify(column)}`).toBeGreaterThanOrEqual(column.textH);
    await shoot(page, '20-main-menu');
    await page.locator('.cm-item', {hasText: 'Сообщить о проблеме'}).first().click();
    await expect(page.locator('.con-sys--diag')).toHaveCount(1);
    await expect.poll(() => step(page)).toBe('category');
    await cinematicBeat(page, 600, 'the surface\'s rise ends');
    await shoot(page, '17-report-from-main-menu');
    // No system list stands behind it here: B closes the whole overlay, and the menu is back.
    await press(page, 'Escape');
    await expect(page.locator('.con-sys')).toHaveCount(0);
    await expect(page.locator('.cm-menu')).toBeVisible();
    // …and the developer's key opens the journal — here through the same push the main process makes on F12.
    await page.evaluate(() => (window as unknown as {__diagStand: {push(p: unknown): void}}).__diagStand.push({kind: 'open-journal'}));
    await expect.poll(() => step(page)).toBe('browse');
    await page.locator('[data-diag-tab="stalls"]').click();
    await expect(page.locator('[data-diag-empty]')).toBeVisible();
    await expect(page.locator('.con-diag__empty-title')).toHaveText('Экран ни разу не зависал');
    await expect(page.locator('[data-diag-foot]')).toContainText('Сообщить о проблеме');
    await shoot(page, '06-journal-empty');
    // A on an empty journal goes to the one thing it can offer.
    await press(page, 'Enter');
    await expect.poll(() => step(page)).toBe('category');
    await press(page, 'Escape');
    await expect.poll(() => step(page)).toBe('browse');
    await page.evaluate(() => (window as unknown as {__diagStand: {push(p: unknown): void}}).__diagStand.push({kind: 'open-journal'}));
    await expect(page.locator('.con-sys'), 'the developer\'s key closes what it opened').toHaveCount(0);
  });

  test('the two doors on the TV: the system menu\'s plates and the settings\' own category', async ({page, request}) => {
    test.setTimeout(240_000);
    await installStandHub(page);
    await bootIntoGame(page, request, {config: soloGameConfig(), buy: 2, query: PRESET.query});

    // THE SYSTEM MENU stays a fixed list of ACTIONS: two of its plates lead here, neither is a setting.
    await press(page, 'KeyM');
    await expect(page.locator('.con-sys--menu')).toHaveCount(1);
    await expect(page.locator('.con-sysact__plate', {hasText: 'Сообщить о проблеме'})).toHaveCount(1);
    await expect(page.locator('.con-sysact__plate', {hasText: 'Диагностика'})).toContainText('Журнал ошибок, система, проверка связи');
    await cinematicBeat(page, 600, 'the menu\'s rise ends');
    await shoot(page, '19-system-menu');

    // THE SETTINGS of diagnostics are rows of the settings console — with a hub behind the page, both of them.
    await page.locator('.con-sysact__plate', {hasText: 'Настройки'}).click();
    await expect(page.locator('.con-sys--settings')).toHaveCount(1);
    await page.locator('.con-set__tab', {hasText: 'Диагностика'}).click();
    await expect(page.locator('.con-set__tab', {hasText: 'Диагностика'})).toHaveClass(/con-set__tab--current/);
    // THE STRIP HOLDS ALL SIX in-game categories between its two bumper chips — the sixth is this one.
    await expect(page.locator('.con-set__tab')).toHaveCount(6);
    const crowded = await page.evaluate(() => {
      const chips = [...document.querySelectorAll('.con-sys--settings .con-sys__tabs-chip')].map((el) => el.getBoundingClientRect());
      const left = Math.min(...chips.map((r) => r.right));
      const right = Math.max(...chips.map((r) => r.left));
      return [...document.querySelectorAll('.con-sys--settings .con-set__tab')]
        .map((el) => ({name: (el.textContent ?? '').trim(), box: el.getBoundingClientRect()}))
        .filter((tab) => tab.box.left < left - 0.5 || tab.box.right > right + 0.5)
        .map((tab) => tab.name);
    });
    expect(crowded, 'every category stands clear of the two bumper chips').toEqual([]);
    const auto = page.locator('.con-set__row', {hasText: 'Автоотчёты об ошибках'});
    const notices = page.locator('.con-set__row', {hasText: 'Уведомления разработчика'});
    await expect(auto).toHaveCount(1);
    await expect(notices).toHaveCount(1);
    // A category has EITHER rows OR a readout — the readout lives on the diagnostics surface now.
    await expect(page.locator('.con-set__ro')).toHaveCount(0);
    await cinematicBeat(page, 600, 'the category\'s pane settles');
    await shoot(page, '18-settings-diagnostics');

    // The player's opt-out reaches the HUB (the one that sends), not a flag of the page.
    await auto.locator('.con-set__arrow').first().click();
    await expect.poll(() => page.evaluate(() => (window as unknown as {__diagStand: {calls: Array<{verb: string}>}}).__diagStand.calls
      .filter((call) => call.verb === 'set-consent').length), {message: 'the consent is the hub\'s'}).toBeGreaterThanOrEqual(1);
    await press(page, 'Escape');
    await press(page, 'Escape');
    await expect(page.locator('.con-sys')).toHaveCount(0);
  });

  test('a TAP of X stays the screen\'s own; reduced motion arrives by opacity alone', async ({page, request}) => {
    test.setTimeout(240_000);
    await installStandHub(page);
    await page.emulateMedia({reducedMotion: 'reduce'});
    await bootIntoGame(page, request, {config: soloGameConfig(), buy: 2, query: PRESET.query});
    await page.evaluate((entry) => (window as unknown as {__diagStand: {push(p: unknown): void}}).__diagStand.push({kind: 'entry', entry}), stallEntry());
    await expect(page.locator('.con-devnote__plate')).toBeVisible();
    // A tap: the notice gives the press back — the board's own X («Разыграно») answers it, the journal does not open.
    await press(page, 'KeyX');
    await expect(page.locator('.con-sys--diag')).toHaveCount(0);
    await expect(page.locator('.con-devnote')).toHaveCount(1);
    await press(page, 'Escape');
    // Reduced motion: the step's entry carries no rise.
    await expect(page.locator('html')).toHaveClass(/con-reduced-motion/);
    await page.keyboard.down('KeyX');
    await cinematicBeat(page, 900, 'the X-hold fills (500 ms) and the surface rises');
    await page.keyboard.up('KeyX');
    await expect(page.locator('.con-sys--diag')).toHaveCount(1);
    const riseRule = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.className = 'con-diag-step-enter-from';
      document.body.appendChild(probe);
      const transform = getComputedStyle(probe).transform;
      probe.remove();
      return transform;
    });
    expect(riseRule, 'no rise under reduced motion').toBe('none');
    await press(page, 'Escape');
    await press(page, 'Escape');
    await expect(page.locator('.con-sys')).toHaveCount(0);
  });
});

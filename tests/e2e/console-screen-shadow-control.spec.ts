import {test, expect, Page} from './consoleTest';
import {bootFixture, pressUntilVisible, settle} from './consoleStart';

/**
 * THE SCREEN SHADOW'S LIVE CONTROL (`src/client/console/screenDirector.ts`, phase 0 — the owner, 2026-11-01: «надо всё
 * хорошо проверить, чтобы механизм был реально рабочим и в будущем могли на него перейти полностью»).
 *
 * A whole suite that files no `[screen-shadow]` finding proves the product right only if the shadow, in the REAL build,
 * on the REAL screen, catches a defect when there is one. This spec puts one in: a live question (the draft pick —
 * `cardSelect:draft`, served by the draft workspace) and the surface that serves it taken off the screen behind the
 * product's back, with a foreign surface standing instead — then the bare version, nothing standing. Each must be named
 * by the shadow within its confirmation window, with the owners it expected and what it saw; and before the defect, the
 * same question must be judged AGREED with the draft as its observed owner. The defect is lifted within seconds, and it
 * is DECLARED to the liveness arbiter for exactly that window (`__conScreenControl.declareDefect` — the boot's
 * `?screenControl=1` seam): a stranded question is judged at 4 s since 5d700e61a5, so an undeclared control was cured
 * (and the run reddened by the harness's `livenessGuard`) before the shadow's own 3-pass confirmation could name it.
 *
 * Functional class: it reads the shadow's own record (`window.__conScreenShadow()`), never a frame.
 */

const TV = {width: 3840, height: 2160};
const QUERY = '&consoleProfile=tv';

type Readout = {
  judged: number,
  findings: Array<{kind: string, expected: Array<string>, present: Array<string>, prompt: string}>,
  stats: {verdicts: Record<string, number>, owners: Record<string, Record<string, number>>},
};

async function readout(page: Page): Promise<Readout> {
  return page.evaluate(() => (window as unknown as {__conScreenShadow: () => Readout}).__conScreenShadow());
}

/** Hide the draft workspace's root and, optionally, stand a FOREIGN surface of its own (`.con-sheet`) over the opening. */
async function breakScreen(page: Page, foreign: boolean): Promise<void> {
  await page.evaluate((withForeign) => {
    (window as unknown as {__conScreenControl: {declareDefect: (ms: number) => void}}).__conScreenControl.declareDefect(12_000);
    for (const el of document.querySelectorAll<HTMLElement>('.con-draftws')) {
      el.dataset.shadowControl = el.style.display;
      el.style.display = 'none';
    }
    if (withForeign) {
      const fake = document.createElement('div');
      fake.className = 'con-sheet';
      fake.dataset.shadowControlFake = '';
      Object.assign(fake.style, {position: 'fixed', left: '40%', top: '40%', width: '20%', height: '20%', pointerEvents: 'none'});
      document.body.appendChild(fake);
    }
  }, foreign);
}

async function healScreen(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as {__conScreenControl: {declareDefect: (ms: number) => void}}).__conScreenControl.declareDefect(0);
    for (const el of document.querySelectorAll<HTMLElement>('.con-draftws')) {
      el.style.display = el.dataset.shadowControl ?? '';
      delete el.dataset.shadowControl;
    }
    document.querySelectorAll('[data-shadow-control-fake]').forEach((el) => el.remove());
  });
}

test.describe('the screen shadow — live positive control', () => {
  test.use({viewport: TV});

  test('a live question: AGREED while served, MISSERVED under a foreign surface, UNSERVED with nothing — each named', async ({page, request}) => {
    test.setTimeout(240_000);
    const lines: Array<string> = [];
    page.on('console', (m) => {
      if (m.text().startsWith('[screen-shadow]')) {
        lines.push(m.text());
      }
    });
    await bootFixture(page, request, 'draft-showcase-pick', {query: QUERY + '&screenControl=1', landing: 'prompt'});
    if (!await page.locator('.con-draftws').isVisible()) {
      await pressUntilVisible(page, 'Enter', '.con-draftws', {settleMs: 1500});
    }
    await settle(page, {timeoutMs: 30_000});

    // 1. SERVED — judged, agreed, the draft workspace the observed owner of the shape.
    await expect.poll(async () => (await readout(page)).stats.owners['cardSelect:draft']?.draft ?? 0,
      {timeout: 15_000, message: 'the shadow judges the live draft pick as served by the draft workspace'}).toBeGreaterThan(1);
    const before = await readout(page);
    expect(before.findings, 'a served question files nothing').toEqual([]);

    // 2. MISSERVED — the draft's root taken off the screen, a foreign surface standing.
    await breakScreen(page, true);
    await expect.poll(async () => (await readout(page)).findings.map((f) => f.kind),
      {timeout: 8_000, message: 'the shadow names a foreign surface over the live question'}).toContain('misserved');
    await healScreen(page);
    const mis = (await readout(page)).findings.find((f) => f.kind === 'misserved');
    expect(mis?.present).toEqual(['sheet']);
    expect(mis?.expected).toContain('draft');
    expect(mis?.prompt).toMatch(/^cardSelect:draft#\d+$/);

    // …and the screen heals: agreement resumes.
    const agreedBefore = (await readout(page)).stats.verdicts.agree ?? 0;
    await expect.poll(async () => (await readout(page)).stats.verdicts.agree ?? 0, {timeout: 6_000}).toBeGreaterThan(agreedBefore);

    // 3. UNSERVED — nothing standing at all.
    await breakScreen(page, false);
    await expect.poll(async () => (await readout(page)).findings.map((f) => f.kind),
      {timeout: 8_000, message: 'the shadow names a live question nobody serves'}).toContain('unserved');
    await healScreen(page);

    // The console lines the harness files are the same findings, once each.
    expect(lines.filter((l) => l.startsWith('[screen-shadow] misserved'))).toHaveLength(1);
    expect(lines.filter((l) => l.startsWith('[screen-shadow] unserved'))).toHaveLength(1);
    await expect(page.locator('.con-draftws')).toBeVisible();
  });
});

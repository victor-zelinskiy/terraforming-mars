import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, openQuickWheel, press, settle} from './consoleStart';
import {openParliament, parliament, PARLIAMENT_PRESETS} from './parliamentDrive';

/*
 * THE PARLIAMENT STANDS ON THE SAME CHASSIS AS EVERY OTHER WORKSPACE
 * (ПОЛИРОВКА — «паритет шасси»). «ПАРЛАМЕНТ › …» is one screen of one console:
 * the shared header's CRUMB ROW (`ConsoleWsHead` → `.con-wshead__ident`) must
 * stand at the same place, the same height and the same type as under every
 * other workspace the quick wheel opens; the command bar and the central
 * opening's insets must be the same numbers. Measured on every profile, every
 * workspace opened from the SAME boot, so nothing but the workspace differs.
 *
 * The crumb ROW, not the header box: the parliament's header legitimately
 * carries a second member — the delegate seats strip in its trailing slot
 * (v5: «зона делегатов в шапке») — so its box is taller by design (76 vs 40 px
 * at 1080); the crumb's own row, type and placement are the shared chassis.
 */
/** The reference host's crumb sits this much LOWER than the parliament's on these profiles (measured 2026-09-19; 1080 is exact). */
const KNOWN_TOP_RESIDUAL: Record<string, number> = {'tv-4k': 5, 'deck-handheld': 10};

type Chassis = {
  name: string,
  identTop: number, identLeft: number, identH: number,
  rootFont: string, contextFont: string,
  cmdbarH: number, stage: string,
};

async function chassisOf(page: Page, headSelector: string): Promise<Chassis> {
  return page.evaluate((sel) => {
    const head = document.querySelector<HTMLElement>(sel);
    // The crumb's ROOT WORD is what the eye lines up across workspaces (its box is the type's,
    // never a host's row geometry).
    const ident = head?.querySelector<HTMLElement>('.con-wshead__root') ?? head ?? null;
    const r = ident?.getBoundingClientRect();
    const font = (s: string) => {
      const el = head?.querySelector<HTMLElement>(s) ?? null;
      return el === null ? '' : `${getComputedStyle(el).fontSize}/${getComputedStyle(el).fontWeight}/${getComputedStyle(el).letterSpacing}`;
    };
    const cmdbar = document.querySelector<HTMLElement>('.con-cmdbar');
    const root = document.querySelector<HTMLElement>('.con-root');
    const cs = root === null ? undefined : getComputedStyle(root);
    return {
      name: (head?.querySelector<HTMLElement>('.con-wshead__root')?.textContent ?? '?').trim(),
      identTop: r === undefined ? -1 : Math.round(r.top), identLeft: r === undefined ? -1 : Math.round(r.left), identH: r === undefined ? -1 : Math.round(r.height),
      rootFont: font('.con-wshead__root'), contextFont: font('.con-wshead__context'),
      cmdbarH: cmdbar === null ? -1 : Math.round(cmdbar.getBoundingClientRect().height),
      stage: cs === undefined ? '' : ['--con-stage-t', '--con-stage-b', '--con-stage-l', '--con-stage-r-eff'].map((p) => cs.getPropertyValue(p).trim()).join(' '),
    };
  }, headSelector);
}

/** Every workspace the quick wheel's other arms open (up · left · right), measured and closed again. */
async function referenceChassis(page: Page): Promise<Array<Chassis>> {
  const out: Array<Chassis> = [];
  for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowRight']) {
    await openQuickWheel(page);
    await press(page, key, 1400);
    const head = page.locator('.con-wshead:not(.con-parl__head)');
    try {
      await expect(head.first()).toBeVisible({timeout: 6000});
    } catch {
      // Not a workspace (a drawer, a mode, a disabled arm) — close whatever opened and move on.
      await press(page, 'Escape', 600);
      continue;
    }
    await settle(page, {timeoutMs: 20_000});
    out.push(await chassisOf(page, '.con-wshead:not(.con-parl__head)'));
    for (let i = 0; i < 4 && await page.locator('.con-wshead').count() > 0; i++) {
      await press(page, 'Escape', 900);
    }
    await expect(page.locator('.con-wshead')).toHaveCount(0, {timeout: 15_000});
  }
  return out;
}

for (const preset of PARLIAMENT_PRESETS) {
  test.describe(`parliament chassis parity (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    test('the crumb row, the command bar and the opening measure the same under «Парламент» and every other workspace', async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixtureSeats(page, request, 'parliament-dense', {query: preset.query, landing: 'board'});
      const refs = await referenceChassis(page);
      expect(refs.length, `${preset.id}: at least one other workspace opened from the wheel`).toBeGreaterThan(0);

      await openParliament(page);
      await expect(parliament(page).locator('.con-parl__head'), 'the parliament head stands').toHaveCount(1, {timeout: 20_000});
      await settle(page, {timeoutMs: 20_000});
      const parl = await chassisOf(page, '.con-parl__head');
      const table = [parl, ...refs].map((c) => `${c.name}: ident top ${c.identTop} left ${c.identLeft} h ${c.identH} · root ${c.rootFont} · context ${c.contextFont} · cmdbar ${c.cmdbarH} · stage ${c.stage}`).join('\n');

      // «Действия карт» is THE reference (the brief's reference workspace); the other wheel
      // workspaces are printed beside it — they do not agree among themselves on the TV and the
      // Deck (colonies: +7 / −4 px), which is a console-wide observation, not the parliament's.
      const reference = refs.find((r) => r.name === 'Действия карт') ?? refs[0];
      for (const ref of refs) {
        expect(parl.identH, `${preset.id}: crumb row height vs «${ref.name}»\n${table}`).toBe(ref.identH);
        expect(parl.rootFont, `${preset.id}: root type vs «${ref.name}»\n${table}`).toBe(ref.rootFont);
        expect(parl.cmdbarH, `${preset.id}: command bar height vs «${ref.name}»\n${table}`).toBe(ref.cmdbarH);
        expect(parl.stage, `${preset.id}: the central opening's insets vs «${ref.name}»\n${table}`).toBe(ref.stage);
      }
      expect(Math.abs(parl.identLeft - reference.identLeft), `${preset.id}: crumb row left vs «${reference.name}»\n${table}`).toBeLessThanOrEqual(1);
      // The TOP: exact at 1080. On the TV and the Deck the reference host's own head sits a
      // measured 5 / 10 px lower than the shared 2rem line the parliament centres on — a
      // residual OUTSIDE the parliament (registry R-17), pinned here as a RATCHET: it may only
      // shrink, and any drift in either direction is a red.
      const residual = KNOWN_TOP_RESIDUAL[preset.id] ?? 0;
      expect(reference.identTop - parl.identTop, `${preset.id}: crumb row top vs «${reference.name}» (known residual ${residual})\n${table}`).toBeLessThanOrEqual(residual);
      expect(reference.identTop - parl.identTop, `${preset.id}: crumb row top vs «${reference.name}» — the residual shrank; re-pin KNOWN_TOP_RESIDUAL\n${table}`).toBeGreaterThanOrEqual(residual - 1);
    });
  });
}

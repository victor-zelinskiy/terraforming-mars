import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, settle} from './consoleStart';
import {mandatoryPlate, PARLIAMENT_PRESETS} from './parliamentDrive';

/*
 * THE SITTING'S ANNOUNCE PLATE stands in the prompt band and covers no board
 * object (final polish A.5 / registry R-35). The plate is the console's ONE
 * mandatory-announce chassis: its position is the shared token
 * (`top: calc(var(--con-hud-h) + 1.75rem)`, centred on the root) and this
 * spec pins that the parliament's plate carries NO position of its own — the
 * fix was the plate's CONTENT (the ask says the sitting once under the
 * «ПАРЛАМЕНТ» kicker; the verb is the family's own «Открыть») and the Deck's
 * missing density ladder, never a parliament-specific offset. Measured on
 * every profile: the plate intersects no `.board-space` (the off-Mars spaces
 * Phobos and Luna stand exactly in that band — at 1280 the old 676 px plate
 * covered both).
 */
type Rect = {x: number, y: number, w: number, h: number};

async function measure(page: Page) {
  return page.evaluate(() => {
    const r = (el: Element | null): {x: number, y: number, w: number, h: number} | null => {
      if (el === null) {
        return null;
      }
      const b = el.getBoundingClientRect();
      return {x: b.left, y: b.top, w: b.width, h: b.height};
    };
    const plate = document.querySelector<HTMLElement>('.con-mandatory');
    const root = document.querySelector<HTMLElement>('.con-root');
    const cs = root === null ? null : getComputedStyle(root);
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const hud = cs === null ? '' : cs.getPropertyValue('--con-hud-h').trim();
    const hudPx = hud.endsWith('rem') ? parseFloat(hud) * rem : parseFloat(hud);
    const spaces = Array.from(document.querySelectorAll<HTMLElement>('.board-space')).map((el) => ({id: el.className.toString().split(' ').find((c) => /^board-space-\d+$/.test(c)) ?? '?', rect: r(el)!}));
    return {
      plate: r(plate), plateTop: plate === null ? '' : getComputedStyle(plate).top, hudPx, rem,
      rootW: root === null ? 0 : root.getBoundingClientRect().width,
      ask: plate?.querySelector('.con-mandatory__ask')?.textContent?.trim() ?? '',
      open: plate?.querySelector('.con-mandatory__open')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      spaces,
    };
  });
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

for (const preset of PARLIAMENT_PRESETS) {
  test.describe(`parliament announce plate (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    test('the plate covers no board space, stands on the shared chassis position and says the sitting once', async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'parliament-climate-assembly', {query: preset.query, landing: 'prompt'});
      await expect(mandatoryPlate(page), 'the sitting is announced').toBeVisible({timeout: 30_000});
      await settle(page, {timeoutMs: 20_000});
      const m = await measure(page);
      expect(m.plate, 'the plate is laid out').not.toBeNull();
      const plate = m.plate!;
      // The SHARED position: the token's own arithmetic, centred on the root — no parliament offset.
      expect(Math.abs(parseFloat(m.plateTop) - (m.hudPx + 1.75 * m.rem)), `${preset.id}: the plate's top is the chassis token (hud ${m.hudPx} + 1.75rem), got ${m.plateTop}`).toBeLessThanOrEqual(1);
      expect(Math.abs((plate.x + plate.w / 2) - m.rootW / 2), `${preset.id}: the plate is centred on the root (${plate.x + plate.w / 2} vs ${m.rootW / 2})`).toBeLessThanOrEqual(1);
      // The content: the kicker names the Parliament; the ask names the sitting ONCE; the verb is the family's.
      expect(m.ask, 'the ask names the sitting, once').toMatch(/^Заседание$|^Sitting$/);
      expect(m.ask, 'the ask does not repeat the kicker\'s noun or the HUD\'s generation').not.toMatch(/Парламент|поколение/i);
      expect(m.open, 'the plate opens with the family\'s own verb').toMatch(/Открыть|Open/);
      expect(m.open).not.toMatch(/заседание|sitting/i);
      // No board object under the plate — the off-Mars spaces above the planet included.
      const covered = m.spaces.filter((s) => s.rect.w > 0 && intersects(plate, s.rect)).map((s) => `${s.id} ${Math.round(s.rect.x)},${Math.round(s.rect.y)} ${Math.round(s.rect.w)}×${Math.round(s.rect.h)}`);
      expect(covered, `${preset.id}: the plate (${Math.round(plate.x)},${Math.round(plate.y)} ${Math.round(plate.w)}×${Math.round(plate.h)}) covers no board space`).toEqual([]);
    });
  });
}

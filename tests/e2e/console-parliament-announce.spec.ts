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
      // P51 · FG — the two facts under the ask, each cut (if at all) in its OWN box; the plate holds no standing light.
      facts: Array.from(plate?.querySelectorAll<HTMLElement>('[data-invitation-fact]') ?? []).map((el) => {
        const name = el.querySelector<HTMLElement>('.con-mandatory__fact-name');
        const pb = plate!.getBoundingClientRect();
        const b = el.getBoundingClientRect();
        return {
          kind: el.dataset.invitationFact ?? '',
          text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
          name: name?.textContent?.trim() ?? '',
          inside: b.left >= pb.left - 0.5 && b.right <= pb.right + 0.5,
          nameCut: name === null ? false : name.scrollWidth > name.clientWidth + 1,
          nameEllipsis: name === null ? '' : getComputedStyle(name).textOverflow,
        };
      }),
      light: plate === null ? [] : [plate, ...Array.from(plate.querySelectorAll<HTMLElement>('*'))].flatMap((el) => {
        const st = getComputedStyle(el);
        const out: Array<string> = [];
        if (st.animationIterationCount === 'infinite' && st.animationName !== 'none') {
          out.push(`${el.className}: infinite ${st.animationName}`);
        }
        if (st.textShadow !== 'none') {
          out.push(`${el.className}: text-shadow ${st.textShadow}`);
        }
        // An OUTER blurred shadow in a light colour (a halo); an inset kant and the plate's dark drop are not light.
        for (const part of st.boxShadow === 'none' ? [] : st.boxShadow.split(/,(?![^(]*\))/)) {
          const rgb = /rgba?\(([^)]*)\)/.exec(part)?.[1].split(',').map((v) => parseFloat(v)) ?? [0, 0, 0];
          const nums = part.replace(/rgba?\([^)]*\)/, '').trim().split(/\s+/).map(parseFloat).filter((n) => !Number.isNaN(n));
          const bright = (rgb[0] + rgb[1] + rgb[2]) / 3 > 60;
          if (!part.includes('inset') && (nums[2] ?? 0) > 0 && bright) {
            out.push(`${el.className}: halo ${part.trim()}`);
          }
        }
        return out;
      }),
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
      await bootFixtureSeats(page, request, 'parliament-climate-adjourn', {query: preset.query, landing: 'prompt'});
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
      // THE FACTS (P51 · FG — the owner): the resolution and the winner of the vote stand under the ask, ALWAYS.
      expect(m.facts.map((f) => f.kind), `${preset.id}: the resolution and the winner of the vote — ${JSON.stringify(m.facts)}`).toEqual(['resolution', 'winner']);
      expect(m.facts[0].text, 'the resolution line reads «принимается» / «принята» and the law\'s name').toMatch(/^(Принимается|Принята|Being enacted|Enacted) \S/);
      expect(m.facts[1].text, 'the winner line reads «победитель голосования» and the seat').toMatch(/^(Победитель голосования|Winner of the vote) \S/);
      for (const f of m.facts) {
        expect(f.name.length, `${f.kind}: the fact names its object`).toBeGreaterThan(0);
        expect(f.inside, `${preset.id}: the ${f.kind} fact stands inside the plate`).toBe(true);
        expect(f.text, 'a fact never repeats the kicker\'s noun or the HUD\'s generation').not.toMatch(/Парламент|поколение/i);
        if (f.nameCut) {
          expect(f.nameEllipsis, `${preset.id}: a cut name is an ellipsis in its own box`).toBe('ellipsis');
        }
      }
      expect(m.light, `${preset.id}: the plate holds no standing light (invariant 15)`).toEqual([]);
      expect(m.open, 'the plate opens with the family\'s own verb').toMatch(/Открыть|Open/);
      expect(m.open).not.toMatch(/заседание|sitting/i);
      // No board object under the plate — the off-Mars spaces above the planet included.
      const covered = m.spaces.filter((s) => s.rect.w > 0 && intersects(plate, s.rect)).map((s) => `${s.id} ${Math.round(s.rect.x)},${Math.round(s.rect.y)} ${Math.round(s.rect.w)}×${Math.round(s.rect.h)}`);
      expect(covered, `${preset.id}: the plate (${Math.round(plate.x)},${Math.round(plate.y)} ${Math.round(plate.w)}×${Math.round(plate.h)}) covers no board space`).toEqual([]);
      // The bar under the plate cuts no verb (P-15: four labels were cut to «ОТКРЫ…» / «ИНФОРМАЦ…» at 1080 — the fit plan now measures the painted text).
      const cut = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.con-cmdbar__label'))
        .filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => (el.textContent ?? '').trim()));
      expect(cut, `${preset.id}: no command label is cut on the board home`).toEqual([]);
    });
  });
}

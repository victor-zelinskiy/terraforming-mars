import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, press, pressUntil, settle} from './consoleStart';
import {focusParliamentZone, openParliament} from './parliamentDrive';

/**
 * «ЗАДАНИЕ ПРЕДСЕДАТЕЛЯ» — THE PLATE HOLDS ITS FORMULA (the owner's 4K frame of 2026-10-24: «кресло непропорционально
 * большое, и задания с большим количеством графики — повысить 3 тепла — задевают зону кресла»).
 *
 * The plate at the head of the career row reads ONE formula: chair · condition · arrow · «+1 [career]». The condition is
 * the quest's printed graphic, and its width is the quest's — so this probe walks the catalog's SHAPES (the starter's
 * «3 [heat production]» is the widest; space cities, cards of a type, tags, delegates, trades, colonies), each seated
 * into the same generated table by ONE declared difference (`arrange`), on the three profiles whose tokens size the
 * plate. For every one: no element of the condition reaches the chair, the arrow or the reward; the formula stays
 * inside the plate; the chair is a MEMBER of the formula (a fifth of the quest's room at most — the plate is content-sized since P70 · K4), never its hero. Every plate
 * is shot for the eye (`screenshots/parliament-quest-plate/<profile>/`).
 *
 * The three profiles are kept on purpose (tests.md § TV only): the plate's width, the chair and the formula's scale are
 * profile TOKENS, and the fit this probe guards is solved per profile.
 */
type Box = {l: number, t: number, r: number, b: number};
type PlateRead = {
  plate: Box,
  /** The room the tier gives the quest (`--con-parl-quest-w`, px) — the plate is content-sized since P70 · K4. */
  room: number,
  throne: Box,
  chair: Box,
  cond: Box | undefined,
  arrow: Box | undefined,
  step: Box | undefined,
  fit: string,
  text: string,
  name: Box | undefined,
  race: Box | undefined,
};

const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: ''},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

/**
 * EVERY quest SHAPE the catalog prints, read off the client manifest (`genfiles/parliament.json` — the drawing a plate
 * shows is chosen by the quest's SOURCE, the resolution that set it, never by its definition alone): one resolution per
 * distinct goal × count, the starter first. A new resolution with a new shape joins the walk by itself.
 */
type QuestShape = {id: string, source: string, definition: Record<string, unknown>};
const QUESTS: ReadonlyArray<QuestShape> = (() => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'genfiles', 'parliament.json'), 'utf8')) as {
    resolutions: Array<{id: string, quest?: Record<string, unknown>}>,
    starterQuest: {quest: Record<string, unknown>},
  };
  const out: Array<QuestShape> = [{id: 'starter', source: 'starter', definition: manifest.starterQuest.quest}];
  const seen = new Set<string>([JSON.stringify(manifest.starterQuest.quest)]);
  for (const r of manifest.resolutions) {
    if (r.quest === undefined || /^RDX_(TEST|DEV)_/.test(r.id) || seen.has(JSON.stringify(r.quest))) {
      continue;
    }
    seen.add(JSON.stringify(r.quest));
    out.push({id: r.id.toLowerCase(), source: r.id, definition: r.quest});
  }
  return out;
})();

/** The plate's geometry, read as the browser lays it out — the condition as the UNION of every element inside it. */
async function readPlate(page: Page): Promise<PlateRead> {
  return page.evaluate(() => {
    const box = (el: Element | null): {l: number, t: number, r: number, b: number} | undefined => {
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width === 0 && r.height === 0 ? undefined : {l: r.left, t: r.top, r: r.right, b: r.bottom};
    };
    const plate = document.querySelector<HTMLElement>('[data-parl-engine]');
    if (plate === null) {
      throw new Error('no quest plate');
    }
    const cond = plate.querySelector('.con-parl__engine-cond');
    let union: {l: number, t: number, r: number, b: number} | undefined;
    if (cond !== null) {
      for (const el of [cond, ...Array.from(cond.querySelectorAll('*'))]) {
        const b = box(el);
        if (b === undefined || el === cond) {
          continue;
        }
        union = union === undefined ? b : {l: Math.min(union.l, b.l), t: Math.min(union.t, b.t), r: Math.max(union.r, b.r), b: Math.max(union.b, b.b)};
      }
    }
    return {
      plate: box(plate)!,
      room: parseFloat(getComputedStyle(plate.closest('.con-parl') ?? document.documentElement).getPropertyValue('--con-parl-quest-w')) *
        parseFloat(getComputedStyle(document.documentElement).fontSize),
      throne: box(plate.querySelector('.con-parl__throne'))!,
      chair: box(plate.querySelector('[data-parl-chair]'))!,
      cond: union,
      arrow: box(plate.querySelector('.con-parl__engine-arrow')),
      step: box(plate.querySelector('[data-parl-quest-reward]')),
      fit: plate.style.getPropertyValue('--con-parl-engine-fit'),
      name: plate.querySelector('[data-parl-chair-name]:not(.con-parl__chair-name--empty)') === null ? undefined : box(plate.querySelector('[data-parl-chair-name]')),
      race: box(plate.querySelector('[data-parl-quest-progress]')),
      text: plate.getAttribute('data-parl-quest-text') ?? '',
    };
  });
}

/** Two equal reads in a row — the fit and the fonts have settled (a comparison is as settled as its least settled side). */
async function settledPlate(page: Page): Promise<PlateRead> {
  let last = '';
  await expect.poll(async () => {
    const now = JSON.stringify(await readPlate(page));
    const same = now === last;
    last = now;
    return same;
  }, {message: 'the quest plate settles', intervals: [150], timeout: 6_000}).toBe(true);
  return JSON.parse(last) as PlateRead;
}

for (const preset of PROFILES) {
  test.describe(`the chairman quest's plate · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});
    test(`every quest shape reads chair · condition · arrow · reward, none over another (${preset.id})`, async ({page, request}) => {
      test.setTimeout(900_000);
      expect(QUESTS.length, 'anti-vacuous: the catalog prints many quest shapes').toBeGreaterThan(15);
      for (const [index, quest] of QUESTS.entries()) {
        // Half the shapes with the office HELD (the seated figure and the holder's name), half with the chair empty.
        const seated = index % 2 === 1;
        await bootFixtureSeats(page, request, 'council-seat', {
          query: preset.query,
          arrange: (serialized) => {
            const parliament = serialized.parliament as Record<string, unknown>;
            const questState = parliament.quest as Record<string, unknown>;
            questState.definition = quest.definition;
            questState.source = quest.source;
            questState.progress = {};
            if (seated) {
              const players = serialized.players as Array<{id: string}>;
              parliament.chairman = players[0].id;
            }
          },
        });
        await openParliament(page);
        await settle(page, {timeoutMs: 15_000});
        const read = await settledPlate(page);
        const tag = `${preset.id} · ${quest.id}${seated ? ' · seated' : ''} (${JSON.stringify(read)})`;
        await page.locator('[data-parl-engine]').screenshot({path: `screenshots/parliament-quest-plate/${preset.id}/${quest.id}${seated ? '-seated' : ''}.png`});

        expect(read.cond, `the condition is drawn — ${tag}`).toBeDefined();
        expect(read.arrow, `the arrow is drawn — ${tag}`).toBeDefined();
        expect(read.step, `the reward is drawn — ${tag}`).toBeDefined();
        const cond = read.cond!;
        const arrow = read.arrow!;
        const step = read.step!;
        // THE ORDER OF THE FORMULA, with no member reaching another (half a px for subpixel layout).
        expect(cond.l, `the condition never reaches the chair — ${tag}`).toBeGreaterThanOrEqual(read.throne.r - 0.5);
        expect(arrow.l, `the arrow stands after the condition — ${tag}`).toBeGreaterThanOrEqual(cond.r - 0.5);
        expect(step.l, `the reward stands after the arrow — ${tag}`).toBeGreaterThanOrEqual(arrow.r - 0.5);
        // …and the whole formula inside the plate.
        expect(read.throne.l, `the chair inside the plate — ${tag}`).toBeGreaterThanOrEqual(read.plate.l - 0.5);
        expect(step.r, `the reward inside the plate — ${tag}`).toBeLessThanOrEqual(read.plate.r + 0.5);
        expect(cond.t, `the condition under the plate's top — ${tag}`).toBeGreaterThanOrEqual(read.plate.t - 0.5);
        expect(cond.b, `the condition above the plate's foot — ${tag}`).toBeLessThanOrEqual(read.plate.b + 0.5);
        // THE CHAIR STANDS ON THE FORMULA'S CENTRE LINE (an empty name never lifts it) and the holder's name hangs above
        // the race, inside the plate.
        const mid = (b: Box) => (b.t + b.b) / 2;
        expect(Math.abs(mid(read.chair) - mid(cond)), `the chair and the condition share one centre line — ${tag}`).toBeLessThanOrEqual((read.chair.b - read.chair.t) * 0.12);
        if (read.name !== undefined && read.race !== undefined) {
          expect(read.name.b, `the holder's name stands above the race — ${tag}`).toBeLessThanOrEqual(read.race.t + 0.5);
        }
        // THE CHAIR IS A MEMBER, NOT THE HERO.
        // P70 · K4: the plate is sized by its CONTENT, so «a fifth» is measured against the ROOM the tier gives the quest
        // (the plate's profile cap) — the law's subject (a chair that is a member, never the hero) is unchanged.
        const plateW = Math.max(read.plate.r - read.plate.l, read.room);
        expect(read.chair.r - read.chair.l, `the chair is at most a fifth of the quest's room — ${tag}`).toBeLessThanOrEqual(plateW * 0.21);
        // A fit, when the plate solved one, never under its floor.
        if (read.fit !== '') {
          expect(Number(read.fit), `the condition's fit stays readable — ${tag}`).toBeGreaterThanOrEqual(0.55);
        }
      }
    });
  });
}

/**
 * «ВАШИ ЭФФЕКТЫ» SPEAKS RUSSIAN — the owner's frames of 2026-10-24 read the Greens' two effects in English
 * («2 M€ per TR step you gain.», «Raising your plant or heat production…»): the explorer captions an N-block passive one
 * sentence per block, and it split the ENGLISH key, whose halves have no translation. Walks every effect tile of the
 * step and refuses an English phrase anywhere in it (the guard `parliamentTextLocalization.spec` holds the keys).
 */
test.describe('the Parliament «ВАШИ ЭФФЕКТЫ» · tv4k', () => {
  test.use({viewport: {width: 3840, height: 2160}});
  test('every effect tile and its reading are Russian', async ({page, request}) => {
    await bootFixtureSeats(page, request, 'council-seat', {query: '&consoleProfile=tv'});
    await openParliament(page);
    await focusParliamentZone(page, 'effects');
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl-fxhost').count() > 0), 'A opens «ВАШИ ЭФФЕКТЫ»').toBe(true);
    await settle(page, {timeoutMs: 15_000});
    const host = page.locator('.con-parl-fxhost');
    const english = /[A-Za-z]{3,}[ ,.]+[A-Za-z]{2,}[ ,.]+[A-Za-z]{2,}/;
    const seen: Array<string> = [];
    for (let i = 0; i < 4; i++) {
      // EVERY TILE READS WHOLE: its head's words (the ordinal, the family) never cut, its printed formula inside the tile.
      const cut = await page.evaluate(() => {
        const out: Array<string> = [];
        document.querySelectorAll<HTMLElement>('.con-parl-fxhost .con-efx__tile').forEach((tile) => {
          const t = tile.getBoundingClientRect();
          tile.querySelectorAll<HTMLElement>('.con-efx__tile-variant, .con-efx__tile-fam').forEach((word) => {
            if (word.scrollWidth > word.clientWidth + 1) {
              out.push(`head «${word.textContent ?? ''}» ${word.scrollWidth}>${word.clientWidth}`);
            }
          });
          // …and its caption has a reading MEASURE — never a column a word or a letter wide.
          tile.querySelectorAll<HTMLElement>('.con-efx__desc').forEach((desc) => {
            const em = parseFloat(getComputedStyle(desc).fontSize) || 16;
            if (desc.getBoundingClientRect().width < em * 6) {
              out.push(`caption «${desc.textContent ?? ''}» ${Math.round(desc.getBoundingClientRect().width)}px wide`);
            }
          });
          tile.querySelectorAll<HTMLElement>('.con-efx__graphic *').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && (r.left < t.left - 0.5 || r.right > t.right + 0.5)) {
              out.push(`formula ${el.className} [${Math.round(r.left)}, ${Math.round(r.right)}] past [${Math.round(t.left)}, ${Math.round(t.right)}]`);
            }
          });
        });
        return out;
      });
      expect(cut, `every effect tile reads whole (step ${i})`).toEqual([]);
      const text = (await host.innerText()).replace(/s+/g, ' ');
      seen.push(text);
      expect(english.test(text), `no English phrase in «ВАШИ ЭФФЕКТЫ» (step ${i}: ${text})`).toBe(false);
      await page.screenshot({path: `screenshots/parliament-quest-plate/tv4k/effects-${i}.png`});
      await press(page, 'ArrowRight');
    }
    expect(seen.some((text) => /[А-Яа-яЁё]{4,}/.test(text)), 'anti-vacuous: the step printed Russian at all').toBe(true);
  });
});

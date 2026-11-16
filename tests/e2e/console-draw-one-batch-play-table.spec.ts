/*
 * «ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» · Ф-А «розыгрыш + стол» (the owner's own example, 2026-10-26; contract
 * `docs/claude/console/card-intake-one-batch.md`).
 *
 * Mars University is played under Olympus Conference holding a science; both table questions are answered in the
 * composer («remove the science to draw» · «discard a card to draw»). ONE press, TWO draws from TWO cards — and the
 * server now merges them into ONE batch (`card:Olympus ×1 · card:MarsU ×1`), the console presents ONE scene:
 *  ① ONE reveal, ONE take — never two `.con-reveal`s, never a second batch on the wire for this press;
 *  ② THE HEAD NAMES EVERY CAUSE with its share («ПОЛУЧЕНО 2 · Конференция на Олимпе +1 · Марсианский университет +1»);
 *  ③ THE TRIGGER SURFACES — the Olympus Conference's face stands beside the row while its card is dealt (the ASSEMBLY
 *     scene: the stage card's own run comes off the deck, another card's run from the card itself), and no frame shows
 *     the trigger over a slot;
 *  ④ THE CRUMB STANDS STILL for the whole scene — the batch is a stage of the play, in the hand workspace.
 * Fixture `mu-olympus` (two seats, 100 M€, Mars University + 10 in hand, Olympus with 1 science on blue's table).
 */
import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {answerTableQuestions, bootFixture, cinematicBeat, crumbText, press, pressUntil, settle, takeRevealCard} from './consoleStart';
import {armWitness, Witness} from './witness';

const OUT = path.resolve('screenshots', 'draw-one-batch');
const OLYMPUS = 'Olympus Conference';
const MU = 'Mars University';
const OLYMPUS_RU = 'Конференция на Олимпе';
const MU_RU = 'Марсианский университет';
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

type Wire = {
  cardsInHand?: Array<{name: string}>,
  cardDrawReveals?: Array<{id: number, actionId?: number, cards: Array<{name: string}>, segments?: Array<{source?: {type: string, cardName?: string}, count: number}>}>,
  waitingFor?: {type: string, choiceContext?: {source?: {card?: string}}},
};

async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await (await request.get(`/api/player?id=${id}`)).json() as Wire;
}
const handOf = (wire: Wire): Array<string> => (wire.cardsInHand ?? []).map((c) => c.name);

type Sample = {
  t: number,
  reveals: number,
  slots: number,
  received: string,
  sources: Array<string>,
  /** The trigger faces standing on the deck-draw layer, with their painted opacity. */
  triggers: Array<{name: string, opacity: number, overSlot: boolean}>,
  run: string,
  viewer: boolean,
  crumb: string,
};

/** One recorded state — the sample without its clock (the recording stamps the page's time). */
type Seen = Omit<Sample, 't'>;
const WATCH = 'one-batch-scene';

/**
 * THE WATCH — armed before the press, RECORDED (FLAKE ZERO — `armWitness`, settled: «never two reveals at once», «the
 * trigger never over a slot» and «one crumb» are claims about the states a frame can paint).
 */
async function installWatch(page: Page): Promise<Witness<Seen>> {
  return armWitness<Seen>(page, WATCH, () => {
    const rectOf = (el: Element) => el.getBoundingClientRect();
    const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const sample = (): Seen => {
      const reveals = document.querySelectorAll('.con-reveal');
      const slotEls = Array.from(document.querySelectorAll('.con-reveal .con-cards__slot'));
      const slotRects = slotEls.map(rectOf);
      const triggers = Array.from(document.querySelectorAll<HTMLElement>('.con-deckdraw [data-dd-trigger]')).map((el) => {
        const cs = getComputedStyle(el);
        const r = rectOf(el);
        const visible = cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5 && r.width > 2;
        return {
          name: el.getAttribute('data-dd-trigger') ?? '',
          opacity: cs.visibility === 'hidden' ? 0 : Number(cs.opacity),
          overSlot: visible && slotRects.some((s) => overlaps(r, s)),
        };
      });
      return {
        reveals: reveals.length,
        slots: slotEls.length,
        received: document.querySelector('[data-reveal-received] .con-ws-stage-badge__num')?.textContent?.trim() ?? '',
        sources: Array.from(document.querySelectorAll('[data-reveal-source]')).map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()),
        triggers,
        run: document.querySelector('.con-deckdraw')?.getAttribute('data-dd-run') ?? '',
        viewer: document.querySelector('.con-zoom') !== null,
        crumb: (() => {
          // The STABLE part of the deepest visible head — root › the carried card (the stage tail may advance, the
          // browse layer's counters live in the same head and tick with every take: neither is the crumb's identity).
          const heads = Array.from(document.querySelectorAll('.con-wshead'))
            .filter((el) => (el as HTMLElement).offsetParent !== null && getComputedStyle(el).visibility !== 'hidden');
          const head = heads[heads.length - 1];
          if (head === undefined) {
            return '';
          }
          const root = head.querySelector('.con-wshead__root')?.textContent ?? '';
          const subject = head.querySelector('.con-wshead__subject')?.textContent ?? '';
          return `${root} › ${subject}`.replace(/\s+/g, ' ').trim();
        })(),
      };
    };
    return sample();
  }, {settled: true, max: 20_000});
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${PRESET.id}-${name}.png`)});
}

test.describe('one press, two table draws — ONE batch, ONE scene, every cause named', () => {
  test.setTimeout(300_000);

  test(`Mars University under Olympus Conference, both answered now · ${PRESET.id}`, async ({page, request}) => {
    await page.setViewportSize(PRESET.viewport);
    const id = await bootFixture(page, request, 'mu-olympus', {query: PRESET.query});
    const before = handOf(await wireOf(request, id));

    // RT → «КАРТЫ» → Mars University → A: its play composer, nothing sent.
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
    await page.locator(`.con-hand [data-zoom-slot="${MU}"]`).waitFor({timeout: 15_000});
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-hand__stage .con-composer--play').count() > 0, {tries: 3, settleMs: 900}),
      'A opens the play composer').toBe(true);
    await settle(page);
    // Olympus: remove the science to draw (the first answer); the university: discard a card now (the album).
    await answerTableQuestions(page, {[OLYMPUS]: 'first', [MU]: 'discard'});
    await settle(page);
    await expect(page.locator('.con-composer__cta--focused'), 'the cursor stands on «Разыграть карту»').toHaveCount(1);
    await shoot(page, 'A0-composer-ready');

    const recording = await installWatch(page);
    await page.keyboard.press('Enter');

    // ONE reveal rises in the play's zone…
    await expect(page.locator('.con-reveal').first(), 'the batch is presented').toBeVisible({timeout: 60_000});
    await expect(page.locator('.con-hand__outcome .con-reveal, .con-hand__stage .con-reveal').first(), 'inside the hand workspace').toBeVisible({timeout: 15_000});
    // …with every cause named and its share counted.
    await expect(page.locator('[data-reveal-received] .con-ws-stage-badge__num'), '«ПОЛУЧЕНО 2»').toHaveText('2', {timeout: 30_000});
    await expect(page.locator('[data-reveal-source]'), 'two causes named').toHaveCount(2, {timeout: 15_000});
    const sources = () => page.locator('[data-reveal-source]').allTextContents();
    await expect.poll(async () => (await sources()).join(' | '), {message: 'Olympus named with its share'}).toContain(OLYMPUS_RU);
    await expect.poll(async () => (await sources()).join(' | '), {message: 'the university named with its share'}).toContain(MU_RU);
    await expect.poll(async () => (await sources()).map((s) => s.replace(/\s+/g, ' ')).join(' | ')).toMatch(/\+1/);
    // The server's own queue: ONE batch for this press, two segments, one action root.
    const wire = await wireOf(request, id);
    const batches = wire.cardDrawReveals ?? [];
    expect(batches.length, `ONE batch on the wire (${JSON.stringify(batches.map((b) => b.cards.map((c) => c.name)))})`).toBe(1);
    expect(batches[0].cards.length).toBe(2);
    expect(batches[0].actionId, 'the batch knows its action root').toBeDefined();
    expect((batches[0].segments ?? []).map((s) => s.source?.cardName), 'the causes in the queue\'s order').toEqual([OLYMPUS, MU]);
    // Let the assembly finish (the trigger recedes, the frame stands) before the take.
    await cinematicBeat(page, 1800, 'the assembly scene settles — the trigger surfaced, dealt and receded');
    await shoot(page, 'A1-batch-assembled');

    // The take: A per card — one surface, two presses, then the workspace lets go. Each take is act → verify (the
    // reveal's own `data-take` edge, `takeRevealCard`), never a press and a pause.
    const crumbAtTake = await crumbText(page);
    for (let i = 0; i < 6 && await page.locator('.con-reveal').count() > 0; i++) {
      await takeRevealCard(page);
    }
    await expect(page.locator('.con-reveal'), 'the batch is taken').toHaveCount(0, {timeout: 30_000});
    // «Done» is the SERVER moving on: the reveal leaving the screen is the client's half — the take's acknowledgement
    // may still be in flight (the old 700 ms pause after each press hid that), so the queue is POLLED, never read once.
    await expect.poll(async () => ((await wireOf(request, id)).cardDrawReveals ?? []).length, {message: 'the queue is acknowledged', timeout: 15_000}).toBe(0);
    const after = await wireOf(request, id);
    expect(handOf(after).includes(MU), 'the university left the hand').toBe(false);
    expect(handOf(after).length, 'one discarded, two drawn').toBe(before.length - 1 - 1 + 2);

    const watch = (await recording.stop()).map((s) => s.v);
    // Anti-vacuous floors: only a DEAD recorder (or a reveal never recorded) fails them — the record keeps distinct
    // states, never frames.
    expect(watch.length, 'the probe sampled the episode').toBeGreaterThan(0);
    const withReveal = watch.filter((s) => s.reveals > 0);
    expect(withReveal.length, 'the reveal stood in the samples').toBeGreaterThan(0);
    expect(Math.max(...watch.map((s) => s.reveals)), 'never two reveals at once').toBe(1);
    expect(Math.max(...withReveal.map((s) => s.slots)), 'one row of the whole batch').toBe(2);
    expect(withReveal.some((s) => s.viewer), 'never the fullscreen viewer').toBe(false);
    // ③ the trigger SURFACED beside the row while the reveal stood — and never over a slot.
    const triggerSeen = withReveal.filter((s) => s.triggers.some((t) => t.name === OLYMPUS && t.opacity > 0.5));
    expect(triggerSeen.length, `the Olympus face surfaced beside the row (runs seen: ${[...new Set(watch.map((s) => s.run))].join(',')})`).toBeGreaterThan(0);
    expect(withReveal.some((s) => s.triggers.some((t) => t.overSlot)), 'the trigger never covers a slot').toBe(false);
    expect(withReveal.some((s) => s.triggers.some((t) => t.name === MU && t.opacity > 0.5)), 'the stage card never surfaces a copy of itself').toBe(false);
    // ④ the crumb's root and card stood still for the whole scene (only the stage tail may advance).
    const crumbs = [...new Set(withReveal.map((s) => s.crumb).filter((c) => c !== ''))];
    expect(crumbs.length, `one crumb for the whole scene: ${crumbs.join(' || ')}`).toBe(1);
    expect(crumbs[0]).toContain(MU_RU);
    expect(crumbAtTake).toContain(MU_RU);
  });
});

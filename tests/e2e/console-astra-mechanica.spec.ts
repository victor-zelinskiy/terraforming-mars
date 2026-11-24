import {test, expect} from './consoleTest';
import {bootFixture, fetchPlayerModel, handCount, openHandPlayComposer, press, pressUntil, settle} from './consoleStart';
import {armWitness} from './witness';

/**
 * X51 ASTRA MECHANICA — «return up to 2 of your played event cards to your hand» (`src/server/cards/promo/
 * AstraMechanica.ts`), and THE CARDS-RETURN BEAT it ends with (`console/played/playedCardReturn.ts`): the closing
 * movement of the played-card hero — the returned events RISE out of the table, turn face to the camera, are read,
 * and the standard intake carries them into the dock.
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO, stage 4 — «the state space is walked, not sampled»): `scene:played-card-return`
 * stood on the ledger of the UNWALKED (`tests/client/bottle/kernelUnwalked.json`). No test of the suite, no walk of
 * the monkey and none of four hundred whole games of the autopilot had ever played this card with events on the
 * table: a scene with a hold, a dock withheld from the commit and a safety of its own that nothing had ever run.
 *
 * The table is fixture `astra-mechanica-return`: a solo action phase, the card in hand with 60 M€, and two plain
 * events on the table — Release of Inert Gases and Mining Expedition.
 *
 * THE FLOW IS ONE (the play sheet pre-collects the pick — the live play is a single `SelectCard`):
 *   the hand → the play sheet → «выбрать карты на столе» → the table's selector (A takes / drops, RT confirms)
 *   → the sheet again, the commit → the card lands → the two events rise and are carried into the dock.
 * «Done» is the SERVER's word (both events in the hand, the card on the table); the beat itself is RECORDED from
 * before the press (`armWitness`) — it lasts a second or two and no look after the fact can know it stood.
 */
const CARD = 'Astra Mechanica';
const EVENTS = ['Release of Inert Gases', 'Mining Expedition'] as const;

type Wire = {
  thisPlayer: {tableau: Array<{name: string}>},
  cardsInHand: Array<{name: string}>,
};
type Beat = {
  /** The hero's phase, as the layer says it (`data-hero-phase`; '' — no hero on stage). */
  phase: string,
  /** The return proxies on stage — one physical card per returned event. */
  rising: number,
  /** The hand's total, by the dock's own word. */
  dock: number,
};

test.describe('Astra Mechanica — the cards-return beat', () => {
  test('two played events come back to the hand: picked on the table, risen out of it, carried into the dock — one play, nothing skipped', async ({page, request}) => {
    // (A whole play with its scene: the server's round trips, the landing, the beat, the intake — never a timing.)
    test.setTimeout(120_000);
    const viewer = await bootFixture(page, request, 'astra-mechanica-return');
    const server = async (): Promise<Wire> => await fetchPlayerModel(request, viewer) as unknown as Wire;
    const handNames = async (): Promise<Array<string>> => (await server()).cardsInHand.map((card) => card.name);
    const before = await handNames();
    expect(before, 'the card is in hand').toContain(CARD);
    expect(before.filter((name) => (EVENTS as ReadonlyArray<string>).includes(name)), 'the events lie on the table, not in the hand').toEqual([]);
    const handBefore = await handCount(page);

    await openHandPlayComposer(page, CARD);
    const composer = page.locator('.con-composer--play');
    const selector = page.locator('.con-ptsel');

    // THE PICK — the sheet's row opens the table's selector; A takes (or drops) the focused event, RT confirms the set.
    await pressUntil(page, 'Enter', async () => await selector.count() > 0, {tries: 4, settleMs: 900});
    const focused = (): Promise<string> => page.evaluate(() => document.querySelector('.con-ptsel__slot--focused')?.getAttribute('data-zoom-slot') ?? '');
    const taken = (name: string): Promise<boolean> => page.evaluate(
      (card) => document.querySelector(`.con-ptsel__slot--locked[data-zoom-slot="${card}"]`) !== null, name);
    for (const event of EVENTS) {
      // (Two candidates in one row: the other one is one step away, whichever holds the cursor.)
      await pressUntil(page, 'ArrowRight', async () => await focused() === event, {tries: 3, settleMs: 500});
      expect(await focused(), `the cursor stands on «${event}»`).toBe(event);
      // A TOGGLES: it is pressed only while the event is not taken (a second press would drop it again).
      for (let tries = 0; tries < 4 && !await taken(event); tries++) {
        await press(page, 'Enter', 700);
      }
      expect(await taken(event), `«${event}» is taken`).toBe(true);
    }
    await pressUntil(page, 'Period', async () => await selector.count() === 0, {tries: 4, settleMs: 900});
    await expect(selector, 'RT confirms the two events and the selector folds').toHaveCount(0);
    await expect(composer, 'the play sheet stands again, the pick answered').toHaveCount(1);

    // THE BEAT IS RECORDED FROM BEFORE THE COMMIT: the hero's phase, the return proxies, the dock's own count.
    const beat = await armWitness<Beat>(page, 'astra-return', () => ({
      phase: document.querySelector('.con-played-hero')?.getAttribute('data-hero-phase') ?? '',
      rising: document.querySelectorAll('.con-played-hero__ret').length,
      dock: Number(document.querySelector('.con-handdock')?.getAttribute('data-hand-total') ?? -1),
    }));

    // THE COMMIT — the sheet's own button: walked to, then A; «done» is the server's word.
    const cta = page.locator('.con-composer__cta--focused');
    await pressUntil(page, 'ArrowDown', async () => await cta.count() > 0, {tries: 6, settleMs: 500});
    const played = async (): Promise<boolean> => (await server()).thisPlayer.tableau.some((card) => card.name === CARD);
    for (let tries = 0; tries < 3 && await composer.count() > 0 && await cta.count() > 0 && !await played(); tries++) {
      await press(page, 'Enter', 1200);
    }
    await expect.poll(played, {timeout: 30_000, message: 'the server played the card'}).toBe(true);
    await expect.poll(async () => (await handNames()).filter((name) => (EVENTS as ReadonlyArray<string>).includes(name)).sort(),
      {timeout: 30_000, message: 'both events are in the hand, by the server'}).toEqual([...EVENTS].sort());

    // THE SCENE PLAYS OUT: two cards rose, and the dock took them only after.
    await beat.waitFor((v) => v.rising === EVENTS.length, {timeoutMs: 45_000, message: 'the two returned events never stood on the stage as cards of their own'});
    await settle(page, {timeoutMs: 60_000});
    await expect.poll(() => handCount(page), {timeout: 30_000, message: 'the dock holds the hand: the card left it, the two events came'})
      .toBe(handBefore - 1 + EVENTS.length);
    expect(await beat.ever((v) => v.phase === 'returning'), 'the hero went through its «returning» phase').toBe(true);
    expect(await beat.happenedInOrder((v) => (v.rising > 0 ? 'rising' : v.dock >= handBefore - 1 + EVENTS.length ? 'docked' : 'before'), ['rising', 'docked']),
      'the dock took the events only AFTER they rose — never a card in the pack before it physically flew there').toBe(true);
    await beat.stop();

    // …and the play left nothing behind: no hero on stage, no workspace, the board home.
    await expect(page.locator('.con-played-hero'), 'the hero\'s stage is gone with its transaction').toHaveCount(0, {timeout: 20_000});
    await expect(composer).toHaveCount(0);
  });
});

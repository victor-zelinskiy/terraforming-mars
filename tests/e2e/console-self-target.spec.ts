import {test, expect, Page} from '@playwright/test';
import {
  press, bootWithCards, soloGameConfig, focusCard,
  closeZoomViewer, openCardActions, openActionFocus,
} from './consoleStart';

/**
 * «ЭТА КАРТА» — the SELF-TARGET of a played-card target step.
 *
 * A card that is a legal target of its own effect (Titan Floating Launch-pad is
 * a Jovian card and adds two floaters to ANY Jovian card) must not be drawn a
 * second time inside the selector: it is already standing in the workspace's
 * hero column. It gets a compact PROXY instead — «ИСТОЧНИК · ЭТА КАРТА» over the
 * card's name — wired to the real card by a measured connector.
 *
 * WHAT THIS PROBE DEFENDS, and why each one needs a real layout engine:
 *
 *  ① THE ROW NEVER RE-FLOWS. The proxy and the physical target stand in ONE
 *    horizontal row, and they keep the SAME boxes through focus, selection,
 *    deselection and repeated switching. This shipped broken: the proxy's width
 *    was intrinsic and its ✓ badge was an in-flow child, so choosing the
 *    self-target grew the chip past a card width, `flex-wrap` broke the row, and
 *    a horizontal pair became a vertical stack AT THE MOMENT OF SELECTION. No
 *    unit test could see it — the solver's arithmetic stayed right the whole
 *    time and the stylesheet overruled it.
 *
 *  ② X INSPECTS THE REAL CARD. On the proxy, the fullscreen viewer must lift the
 *    HERO card and hold ITS slot empty. It used to resolve the origin to the
 *    proxy chip, so the viewer rose out of a text box while the card it names
 *    went on standing in the hero column — two copies of one object.
 *
 *  ③ BOTH ENTRY POINTS. A card can self-target while it is being PLAYED and
 *    while its blue ACTION runs, and those are two different hosts
 *    (`ConsolePlayCardConfirm` / `ConsoleActionComposer`). The behaviour is one
 *    mechanism, so it is asserted on both.
 *
 * Geometry is read from `getBoundingClientRect`, never from a screenshot diff:
 * the claim is «these boxes did not move», which is a number.
 */

/** Both cards are Jovian floater holders, so each is a legal target of the
 *  other AND of itself — which is the whole subject. */
const LAUNCHPAD = 'Titan Floating Launch-pad';
const SHUTTLES = 'Titan Shuttles';

/**
 * FORCE the deal. `createGameWithCards` searches SEEDS for a deal that happens
 * to offer what a spec needs, and that is a ~1-in-10 shot PER CARD: for two
 * named cards its 80 attempts are a coin flip, and this probe lost it on the
 * first real run («80 deals, none offering …») after passing on the scratch.
 * `customProjectCards` is the dev knob that puts them on TOP of the project
 * deck instead, so the first game is always the right one.
 */
const CFG = soloGameConfig({
  expansions: {colonies: true},
  customProjectCards: [SHUTTLES, LAUNCHPAD],
  // …and PIN the corporation. The default picks any calm one, and a colonies
  // deal is full of Jovian floater corps — Stormcraft Incorporated turned the
  // action test's two candidates into three and opened ITS action instead of
  // the card's. (The layout held perfectly across the two category sections
  // that produced, which is how the run stayed readable; the ASSERTION was the
  // thing that had described one deal rather than the contract.)
  customCorporationsList: ['CrediCor'],
});
/** CrediCor: no Jovian tag, holds nothing — so the candidate set is exactly the
 *  two cards this probe plays, on every run. */
const CORP = 'CrediCor';

type Readout = {
  /** The proxy's box, or null when the step is not up. */
  proxy: Box | null,
  /** Every measured candidate cell, in DOM order. */
  cells: ReadonlyArray<Box>,
  /** The candidate row's own box — its height is what a wrap changes. */
  row: Box | null,
  /** The hero card in the composer's own column. */
  hero: Box | null,
  /** The connector, when it resolved. */
  wire: Box | null,
  proxyFocused: boolean,
  proxyLocked: boolean,
  heroFocused: boolean,
  heroLocked: boolean,
  /** How many elements the zoom choreography is holding empty. */
  held: number,
  /** …and whether the held one is inside the hero. */
  heldInHero: boolean,
  heroOpacity: string,
  zoomOpen: boolean,
  /** Every scroll rail the composer is ADVERTISING (one per real overflow). */
  rails: number,
  /** How far the step's status line sticks out of the box that clips it. */
  railClippedBy: number,
  /** The resource chip text on each candidate cell, in DOM order. */
  chips: ReadonlyArray<string>,
  /** …and whether each carries a real sprite rather than a bare number. */
  chipsHaveSprite: boolean,
  /** The «ВЫ ПОЛУЧИТЕ» chip's capsule height and its label's line box. */
  gainChipH: number,
  gainLabelH: number,
};

type Box = {left: number, top: number, width: number, height: number};

async function readout(page: Page): Promise<Readout> {
  return page.evaluate(() => {
    const box = (el: Element | null): Box | null => {
      if (el === null) {
        return null;
      }
      const r = el.getBoundingClientRect();
      return {
        left: Math.round(r.left), top: Math.round(r.top),
        width: Math.round(r.width), height: Math.round(r.height),
      };
    };
    const proxy = document.querySelector('.con-ptsel__self');
    const hero = document.querySelector('[data-ptsel-source]');
    const held = document.querySelectorAll('.con-zoom-hold');
    return {
      proxy: box(proxy),
      cells: Array.from(document.querySelectorAll('[data-ptsel-cell]')).map((c) => box(c) as Box),
      row: box(document.querySelector('.con-ptsel__cards')),
      hero: box(hero),
      wire: box(document.querySelector('.con-ptlink__wire')),
      proxyFocused: proxy?.classList.contains('con-ptsel__self--focused') === true,
      proxyLocked: proxy?.classList.contains('con-ptsel__self--locked') === true,
      heroFocused: hero?.className.includes('--targetfocus') === true,
      heroLocked: hero?.className.includes('--targetlock') === true,
      held: held.length,
      heldInHero: hero !== null && hero.querySelector('.con-zoom-hold') !== null,
      heroOpacity: hero === null ? '' : getComputedStyle(hero).opacity,
      zoomOpen: document.querySelector('dialog.con-zoom[open]') !== null,
      rails: document.querySelectorAll('.con-composer .con-scroll-area__rail').length,
      railClippedBy: (() => {
        const line = document.querySelector('.con-ptsel__rail');
        if (line === null) {
          return 0;
        }
        // The box that would actually cut it: the nearest scroll viewport.
        const clip = line.closest('.con-scroll-area__viewport');
        if (clip === null) {
          return 0;
        }
        return Math.max(0, Math.round(
          line.getBoundingClientRect().bottom - clip.getBoundingClientRect().bottom));
      })(),
      chips: Array.from(document.querySelectorAll('[data-ptsel-cell] .con-cardres'))
        .map((c) => (c as HTMLElement).innerText.trim()),
      chipsHaveSprite: Array.from(document.querySelectorAll('[data-ptsel-cell] .con-cardres__icon'))
        .every((i) => /card-resource-\w|resource_icon--\w/.test(i.className)),
      gainChipH: Math.round(
        document.querySelector('.con-composer__hero .action-effect-chip')?.getBoundingClientRect().height ?? 0),
      gainLabelH: Math.round(
        document.querySelector('.con-composer__hero-label')?.getBoundingClientRect().height ?? 0),
    };
  });
}

/**
 * Open the fullscreen viewer and read the state WHILE IT IS OPEN.
 *
 * The retry exists to keep a harness problem from being reported as a product
 * one. At 4K the console buffers presses that land on a busy frame, and a
 * buffered X can arrive after the viewer has already opened — the dialog then
 * closes again between `openZoomViewer`'s verdict and the read, and the hold
 * count is legitimately 0 because nothing is lifted any more. So: re-open while
 * the dialog is gone, and the moment it IS open, return that reading whatever
 * it says. «Open but nothing held» is a real failure and reaches the assertion
 * unchanged.
 */
async function inspectAndRead(page: Page, tries = 3): Promise<Readout> {
  const zoom = page.locator('dialog.con-zoom[open]');
  let last = await readout(page);
  for (let i = 0; i < tries; i++) {
    const started = Date.now();
    while (Date.now() - started < 20_000 && await zoom.count() === 0) {
      await press(page, 'KeyX', 1200);
    }
    await page.waitForTimeout(1100);
    last = await readout(page);
    if (last.zoomOpen) {
      // OPEN is not SETTLED. `showModal` fires at the open flight's touchdown,
      // and at 4K that flight is long enough to read the state between the
      // dialog appearing and the origin hold being in place. Poll for the hold
      // rather than assert on a frame that is still mid-choreography — and
      // return regardless once the budget is spent, so «open but nothing held»
      // still reaches the assertion as the real failure it would be.
      for (let w = 0; w < 6 && last.held === 0; w++) {
        await page.waitForTimeout(500);
        last = await readout(page);
      }
      return last;
    }
    // Not up: give whatever is still holding input room to finish, then nudge
    // again. Never `openZoomViewer` here — it ASSERTS, so its first miss would
    // end the test before the retry this function exists for.
    await page.waitForTimeout(2500);
  }
  const state = await page.evaluate(() => ({
    bodyClass: document.body.className,
    step: document.querySelectorAll('.con-ptsel').length,
    focusedSlot: document.querySelectorAll('.con-ptsel__slot--focused, .con-ptsel__self--focused').length,
  }));
  expect(last.zoomOpen, `X must open the fullscreen viewer — ${JSON.stringify(state)}`).toBe(true);
  return last;
}

/**
 * Close the viewer and wait for the zoom to be genuinely IDLE.
 *
 * `dialog[open]` going away is not the same fact: the shell clears the module
 * state (and `body.con-zoom-open` with it) on the dialog's own `close` event,
 * and the next open is driven by an `undefined → defined` watcher. Pressing X
 * inside that window sets an already-defined value, the watcher does not fire,
 * and no dialog opens — which is exactly what a second inspect hit at 4K, where
 * the close beat is long enough to press into.
 */
async function closeZoomAndSettle(page: Page): Promise<void> {
  await closeZoomViewer(page);
  await page.locator('body:not(.con-zoom-open)').waitFor({state: 'attached', timeout: 10_000});
  await page.waitForTimeout(1200);
}

/** Same box, to the pixel — the whole point of ① is that nothing moved. */
function sameBox(a: Box | null, b: Box | null, what: string): void {
  expect(a, `${what}: left box missing`).not.toBeNull();
  expect(b, `${what}: right box missing`).not.toBeNull();
  expect(a, what).toEqual(b);
}

/**
 * EVERY PRESS HERE IS VERIFIED, and that is not defensive style — a press that
 * lands on a busy frame is deliberately consumed by the console's commit guard,
 * and at 4K that is the common case rather than the rare one. This probe first
 * failed at `tv4k` while `fhd` passed, with the hand screen still up and the A
 * that should have opened the composer simply gone.
 */
async function openPlayComposer(page: Page, tries = 5): Promise<void> {
  const composer = page.locator('.con-composer--play');
  for (let i = 0; i < tries && await composer.count() === 0; i++) {
    await press(page, 'Enter', 1400);
  }
  await expect(composer, 'A on the focused hand card opens the play composer')
    .toHaveCount(1, {timeout: 8000});
}

/**
 * Open the embedded target step from the composer.
 *
 * ⚠️ The CTA CHECK IS INSIDE THE LOOP, and it is what makes retrying safe: on
 * FIRST entry the cursor already stands on the unanswered choice row (one A
 * opens it), but once the choice is ANSWERED the cursor sits on the CTA — where
 * A plays the card and ends the probe's subject several assertions early. So
 * every iteration re-asks where the cursor is instead of assuming the last
 * press landed.
 */
async function openTargetStep(page: Page, tries = 4): Promise<void> {
  const step = page.locator('.con-ptsel');
  for (let i = 0; i < tries && await step.count() === 0; i++) {
    if (await page.locator('.con-composer__cta--focused').count() > 0) {
      await press(page, 'ArrowUp', 900);
    }
    await press(page, 'Enter', 1400);
  }
  await expect(step, 'the embedded played-target step must open').toHaveCount(1, {timeout: 8000});
  await page.waitForTimeout(500);
}

/** A on the focused candidate answers the choice, which CLOSES the step — so
 *  the step's absence is the verdict, never the press count. */
async function confirmChoice(page: Page, tries = 4): Promise<void> {
  const step = page.locator('.con-ptsel');
  for (let i = 0; i < tries && await step.count() > 0; i++) {
    await press(page, 'Enter', 1300);
  }
  await expect(step, 'A on a candidate answers the choice').toHaveCount(0, {timeout: 6000});
}

/** RT wheel → centre slot → the hand screen, verified and settled. */
async function openHand(page: Page, tries = 5): Promise<void> {
  const hand = page.locator('.con-hand');
  for (let i = 0; i < tries && await hand.count() === 0; i++) {
    await press(page, 'Period', 800);
    await press(page, 'Enter', 1600);
  }
  await expect(hand, 'the hand screen must open').toHaveCount(1, {timeout: 12_000});
  // The cards are rendered before the dock-to-hand reveal releases input.
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 20_000});
}

/**
 * Play a card ALL THE WAY, with a verified press at every beat.
 *
 * The shared `playCardFromHand` answers a composer by pressing A up to five
 * times — fine for a card with nothing to ask, and the launch-pad asks the very
 * question this probe is about. At 4K that walk lost the hand screen mid-flight
 * («waiting for .con-hand:not(.con-hand--transit)»), failing the SETUP of a test
 * whose subject is two screens later, and it failed intermittently, which is
 * worse than failing.
 */
async function playCardVerified(page: Page, card: string, opts: {answersTarget?: boolean} = {}): Promise<void> {
  await openHand(page);
  expect(await focusCard(page, card, 16), `${card} must be reachable in hand`).toBe(true);
  await openPlayComposer(page);
  if (opts.answersTarget === true) {
    await openTargetStep(page);
    await confirmChoice(page);
  }
  const composer = page.locator('.con-composer--play');
  for (let i = 0; i < 6 && await composer.count() > 0; i++) {
    await press(page, 'Enter', 1500);
  }
  await expect(composer, `${card} must commit`).toHaveCount(0, {timeout: 25_000});
  await page.waitForTimeout(2500);
}

/** Walk the cursor onto the self-target proxy (D-pad only — the same axis the
 *  player has). Returns once the proxy reports the focus class. */
async function focusProxy(page: Page, tries = 6): Promise<void> {
  const proxy = page.locator('.con-ptsel__self--focused');
  for (let i = 0; i < tries && await proxy.count() === 0; i++) {
    await press(page, 'ArrowLeft', 700);
  }
  await expect(proxy, 'the proxy is a full navigation stop').toHaveCount(1, {timeout: 6000});
}

/** …and onto the ordinary card candidate beside it. */
async function focusCardTarget(page: Page, tries = 6): Promise<void> {
  const card = page.locator('.con-ptsel__slot--focused');
  for (let i = 0; i < tries && await card.count() === 0; i++) {
    await press(page, 'ArrowRight', 700);
  }
  await expect(card, 'the physical target is reachable from the proxy').toHaveCount(1, {timeout: 6000});
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

for (const profile of PROFILES) {
  test.describe(`console — self-target «ЭТА КАРТА» · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('the row is horizontal and immovable through every state, and X lifts the real card', async ({page, request}) => {
      test.setTimeout(360_000);
      await bootWithCards(page, request, {
        config: CFG,
        cards: [SHUTTLES, LAUNCHPAD],
        corporation: CORP,
        query: profile.query,
      });

      // A second Jovian floater card ON THE TABLE is what makes the step a
      // CHOICE — «эта карта» beside a physical one — instead of a lone handle.
      await playCardVerified(page, SHUTTLES);

      // ── PLAY-TIME self-target: the on-play «add 2 floaters to ANY jovian
      //    card» of the card currently being played. Host: the play composer.
      await openHand(page);
      expect(await focusCard(page, LAUNCHPAD, 16), `${LAUNCHPAD} must be reachable in hand`).toBe(true);
      await openPlayComposer(page);
      await openTargetStep(page);

      // ① NEUTRAL — one horizontal row, proxy first, card second.
      const neutral = await readout(page);
      expect(neutral.proxy, 'the self-target renders as a proxy').not.toBeNull();
      expect(neutral.cells.length, 'two targets: the proxy and one physical card').toBe(2);
      // ONE ROW — stated over every cell, not over a chosen pair: the claim is
      // «the composition is horizontal», and a pair-wise check happens to be
      // true for half of a two-row grid.
      expect(new Set(neutral.cells.map((c) => c.top)).size,
        'every candidate shares one row (horizontal composition)').toBe(1);
      expect(neutral.cells[0].left, 'the proxy is the FIRST slot')
        .toBeLessThan(neutral.cells[1].left);
      expect(neutral.proxy!.width, 'the proxy never exceeds the solved cell width')
        .toBeLessThanOrEqual(neutral.cells[1].width + 1);
      expect(neutral.proxy!.height, 'and stays compact — never a full card')
        .toBeLessThan(neutral.cells[1].height * 0.5);

      // The CONNECTOR is a real, measured link between the two real boxes.
      expect(neutral.wire, 'the connector resolved').not.toBeNull();
      expect(neutral.hero, 'the hero publishes the source anchor').not.toBeNull();
      const heroRight = neutral.hero!.left + neutral.hero!.width;
      expect(Math.abs(neutral.wire!.left - heroRight),
        'the wire starts on the source card\'s right edge').toBeLessThanOrEqual(3);
      expect(Math.abs((neutral.wire!.left + neutral.wire!.width) - neutral.proxy!.left),
        'and ends on the proxy\'s left edge').toBeLessThanOrEqual(3);

      // ② FOCUS ON THE PROXY — paint changes, geometry does not, and the REAL
      //    card answers.
      await focusProxy(page);
      const onProxy = await readout(page);
      expect(onProxy.proxyFocused).toBe(true);
      expect(onProxy.heroFocused, 'the card the proxy points at must answer').toBe(true);
      sameBox(onProxy.proxy, neutral.proxy, 'focus on the proxy moved the proxy');
      sameBox(onProxy.cells[1], neutral.cells[1], 'focus on the proxy moved the card target');
      sameBox(onProxy.row, neutral.row, 'focus on the proxy re-flowed the row');

      // ③ FOCUS ON THE PHYSICAL CARD — both elements keep their positions.
      await focusCardTarget(page);
      const onCard = await readout(page);
      expect(onCard.proxyFocused).toBe(false);
      expect(onCard.heroFocused, 'the temporary lift leaves with the cursor').toBe(false);
      sameBox(onCard.proxy, neutral.proxy, 'focus on the card moved the proxy');
      sameBox(onCard.cells[1], neutral.cells[1], 'focus on the card moved the card');

      // ④ SELECT THE SELF-TARGET — the reported bug. Proxy and hero light
      //    together; NOTHING re-flows.
      await focusProxy(page);
      await confirmChoice(page);
      await openTargetStep(page);
      await focusProxy(page);
      const chosenSelf = await readout(page);
      expect(chosenSelf.proxyLocked, 'the proxy shows the selection').toBe(true);
      expect(chosenSelf.heroLocked, 'and so does the physical card it stands for').toBe(true);
      sameBox(chosenSelf.proxy, neutral.proxy, 'SELECTING the self-target resized the proxy');
      sameBox(chosenSelf.cells[0], neutral.cells[0], 'selection moved the proxy cell');
      sameBox(chosenSelf.cells[1], neutral.cells[1], 'selection pushed the card target');
      sameBox(chosenSelf.row, neutral.row, 'selection re-flowed the candidate row');
      expect(new Set(chosenSelf.cells.map((c) => c.top)).size,
        'the row is STILL horizontal after choosing «эта карта»').toBe(1);

      // ⑤ SELECT THE OTHER CARD — the emerald state moves; the composition does not.
      await focusCardTarget(page);
      await confirmChoice(page);
      await openTargetStep(page);
      await focusCardTarget(page);
      const chosenCard = await readout(page);
      expect(chosenCard.proxyLocked, 'the proxy returns to neutral').toBe(false);
      expect(chosenCard.heroLocked, 'and the source stops reading as the chosen target').toBe(false);
      sameBox(chosenCard.proxy, neutral.proxy, 'switching target resized the proxy');
      sameBox(chosenCard.cells[1], neutral.cells[1], 'switching target moved the card');
      sameBox(chosenCard.row, neutral.row, 'switching target re-flowed the row');

      // ⑥ REPEATED SWITCHING — the acceptance criterion is «many times», so it
      //    is pressed many times.
      for (let i = 0; i < 3; i++) {
        await focusProxy(page);
        await confirmChoice(page);
        await openTargetStep(page);
        await focusCardTarget(page);
        await confirmChoice(page);
        await openTargetStep(page);
      }
      // The loop above is the busiest sequence in the probe (six commits and
      // six re-entries, each with its own beat). At 4K the console absorbs
      // presses that land on a busy frame BY DESIGN, so the next press is given
      // a settle rather than being fired into the tail of that work — without
      // it this spec failed only in the full-file run, where tv4k follows the
      // fhd pair on the same worker.
      await page.waitForTimeout(2500);
      const settled = await readout(page);
      sameBox(settled.proxy, neutral.proxy, 'repeated switching drifted the proxy');
      sameBox(settled.cells[1], neutral.cells[1], 'repeated switching drifted the card');
      sameBox(settled.row, neutral.row, 'repeated switching changed the row height');

      // ⑦ X ON THE PROXY — the REAL card lifts, and it is the only thing held.
      await focusProxy(page);
      const zoomed = await inspectAndRead(page);
      expect(zoomed.zoomOpen).toBe(true);
      expect(zoomed.heldInHero, 'the fullscreen lifts the HERO card, not the proxy chip').toBe(true);
      expect(zoomed.held, 'exactly one slot is held — never two copies on screen').toBe(1);
      expect(zoomed.heroOpacity, 'and the source seat is empty while its card is in hand').toBe('0');

      // ⑧ CLOSING RETURNS EVERYTHING — same boxes, same cursor.
      await closeZoomAndSettle(page);
      const back = await readout(page);
      expect(back.held, 'the hold is released on close').toBe(0);
      expect(back.heroOpacity, 'the card is back in its seat').not.toBe('0');
      expect(back.proxyFocused, 'and the cursor survived the trip').toBe(true);
      sameBox(back.proxy, neutral.proxy, 'inspect drifted the proxy');
      sameBox(back.cells[1], neutral.cells[1], 'inspect drifted the card target');
      // …against the reading taken IN THE SAME FOCUS STATE. The hero's focus
      // lift is intended movement, so comparing a focused hero with an unfocused
      // one asks it to be in two places at once — which is what this line did
      // first, and it failed by exactly the height of the lift.
      sameBox(back.hero, onProxy.hero, 'inspect drifted the hero card');

      // ⑨ X ON AN ORDINARY CARD TARGET still lifts its own slot — no regression.
      await focusCardTarget(page);
      const zoomedCard = await inspectAndRead(page);
      expect(zoomedCard.zoomOpen, 'the viewer must be open to say anything about it').toBe(true);
      expect(zoomedCard.held, 'one slot held for an ordinary target too').toBe(1);
      expect(zoomedCard.heldInHero, 'and it is NOT the hero — the target has its own slot').toBe(false);
      await closeZoomViewer(page);
    });

    /**
     * ③ THE OTHER ENTRY POINT — the same self-target from the blue ACTION of a
     * card that is already on the table (Titan Shuttles adds two floaters to any
     * Jovian card, and it is one). Different host, different hero markup, same
     * mechanism: the fix is a shared component plus two marker attributes, so
     * the invariants must hold here WITHOUT a line of per-host wiring. This is
     * the assertion that would fail if the behaviour had been hardcoded into the
     * play composer.
     */
    test('the same self-target works from a played card\'s action', async ({page, request}) => {
      test.setTimeout(360_000);
      await bootWithCards(page, request, {
        config: CFG,
        cards: [SHUTTLES, LAUNCHPAD],
        corporation: CORP,
        query: profile.query,
      });
      await playCardVerified(page, SHUTTLES);
      await playCardVerified(page, LAUNCHPAD, {answersTarget: true});

      await openCardActions(page);
      await openActionFocus(page);
      await openTargetStep(page);

      const neutral = await readout(page);
      expect(neutral.cells.length, 'the acting card and the other Jovian card').toBe(2);
      expect(new Set(neutral.cells.map((c) => c.top)).size,
        'horizontal here too — one component, one behaviour').toBe(1);
      expect(neutral.cells[0].left).toBeLessThan(neutral.cells[1].left);
      expect(neutral.proxy!.width).toBeLessThanOrEqual(neutral.cells[1].width + 1);

      // The connector found the action composer's OWN hero markup — a different
      // element in a different column, reached by the same marker.
      expect(neutral.wire, 'the connector resolved in the action host').not.toBeNull();
      expect(Math.abs(neutral.wire!.left - (neutral.hero!.left + neutral.hero!.width)),
        'the wire starts on the acting card\'s right edge').toBeLessThanOrEqual(3);

      await focusProxy(page);
      const onProxy = await readout(page);
      expect(onProxy.heroFocused, 'the acting card answers its own proxy').toBe(true);
      sameBox(onProxy.cells[1], neutral.cells[1], 'focus re-flowed the action host\'s row');

      // Selecting the self-target: same emerald pair, same immovable row.
      await confirmChoice(page);
      await openTargetStep(page);
      await focusProxy(page);
      const chosen = await readout(page);
      expect(chosen.proxyLocked).toBe(true);
      expect(chosen.heroLocked).toBe(true);
      sameBox(chosen.proxy, neutral.proxy, 'selection resized the proxy in the action host');
      sameBox(chosen.cells[1], neutral.cells[1], 'selection moved the card in the action host');
      expect(new Set(chosen.cells.map((c) => c.top)).size,
        'still one horizontal row after choosing «эта карта»').toBe(1);

      // …and X lifts the ACTING card out of its own seat, never a second copy.
      const zoomed = await inspectAndRead(page);
      expect(zoomed.zoomOpen).toBe(true);
      expect(zoomed.heldInHero, 'the acting card is what rises').toBe(true);
      expect(zoomed.held, 'exactly one slot held').toBe(1);
      expect(zoomed.heroOpacity, 'and its seat is empty meanwhile').toBe('0');
      await closeZoomAndSettle(page);
      const back = await readout(page);
      expect(back.held).toBe(0);
      expect(back.proxyFocused, 'navigation survived the inspect').toBe(true);
      sameBox(back.cells[1], neutral.cells[1], 'inspect drifted the action host\'s row');
    });
  });
}

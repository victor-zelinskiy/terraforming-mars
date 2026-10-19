import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, closeZoomViewer, fetchPlayerModel, focusCard, openCardActions, openConsole, openMandatoryAnnounce, openZoomViewer, press, pressUntil,
  reloadConsole, settle, waitForBoardHome,
} from './consoleStart';
import {
  answerGateAs, answerGateOnScreen, armLeakWitness, focusParliamentZone, focusParty, mandatoryPlate, openParliament, parliament, sittingStage,
  strandedReports, waitSittingAtRest,
} from './parliamentDrive';

/**
 * TR62 «АЛЬЯНС ТАРСИСА» — THE LAW OF ACCESS'S FOURTH ROAD (docs/TURMOIL_REDUX_THARSIS_ALLIANCE.md).
 *
 * «While Mars First is ruling or you have 2 delegates there, you may also use the Reds' effect and cards. And vice
 * versa. Draw a card when either of those parties becomes ruling.» The contract under test, against a real server,
 * on the TV and at 1080:
 *
 *   A. BEFORE the play: the Reds' seal wears no badge and no borrowed ring; the Reds' action is absent from «Действия
 *      карт»; Reds News Outlet (the Reds' plate) is refused in the hand.
 *   B. The composer names what opens NOW («Откроет сейчас: эффект и карты «Красные» …») and the draw at a change of
 *      power; A → exactly ONE POST, an ordinary landing.
 *   C. AFTER: the server reads the Reds by the ALLIANCE road; the Parliament shows it as OBJECTS — the badge on BOTH
 *      seals (active), the Reds' BORROWED ring (`data-pseal-ring="allied"`, the link at the seam), the Reds' tile in
 *      «ВАШИ ЭФФЕКТЫ» with the alliance as its WHY; the Reds' dossier names the alliance, Mars First's names the pair;
 *      the Reds' action is in «Действия карт»; the Outlet plays — its plate, its cassette and its composer's row read
 *      the requirement met THROUGH Mars First.
 *   D. STABILITY: the palata's party rows keep their boxes across the play (the badge is absolute in its seal).
 *   E. THE VOTE (`tharsis-alliance-council` — one cube on Mars First under Council Seat): Mars First's slot names the
 *      ally the second cube opens («АЛЬЯНС · Красные → эффект и карты ваши») before the press.
 *   F. THE ENACTMENT (`tharsis-alliance-enact` — Mars First wins the sitting): after the seals change places, the card
 *      the alliance owes leaves the project deck for the hand dock — never a reveal over the sitting; the server's hand
 *      grew by one; the Reds are the viewer's by the alliance.
 *   G. RED, on its own console: no badge on its seals (the alliance is a property of the SEAT).
 *   H. A reload keeps it all: the law is read off the tableau again.
 */

const CARD = 'Tharsis Alliance';
const OUTLET = 'Reds News Outlet';
const REDS = 'Reds';
const MARS = 'Mars First';
const OUT = path.resolve('screenshots', 'tr62');
const COMPOSER = '.con-composer--play';

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

type Access = {party: string, delegates: number, byDelegates: boolean, hasEffect: boolean, satisfiesRequirement: boolean,
  allied?: Array<{via: string, source: string, road: string}>, alliances?: Array<{partner: string, source: string}>};
type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {color: string, megacredits: number, tableau: Array<{name: string}>};
  players: Array<{color: string, tableau: Array<{name: string}>}>;
  game: {
    parliament: {
      rulingParty: string;
      slots: Array<{instance: string, party: string, viewerVotes: number}>;
      players: Array<{color: string, access: Array<Access>}>;
    };
  };
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  try {
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  } catch (err) {
    if (!/ECONNRESET|socket hang up/.test(String(err))) {
      throw err;
    }
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  }
}

const accessOf = (wire: Wire, color: string, party: string): Access | undefined =>
  wire.game.parliament.players.find((p) => p.color === color)?.access.find((a) => a.party === party);

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
}

/** The seal of `party` on the chamber (a bench or the dais) as the viewer reads it. */
type Seal = {ring: string | null, ally: string | null, partner: string | null, link: boolean, allyArcs: number, badge: boolean};
async function sealOf(page: Page, party: string): Promise<Seal> {
  return page.evaluate((p) => {
    const seal = document.querySelector(`.con-parl__party[data-party="${p}"] .con-pseal`);
    return {
      ring: seal?.getAttribute('data-pseal-ring') ?? null,
      ally: seal?.getAttribute('data-pseal-ally') ?? null,
      partner: seal?.getAttribute('data-pseal-ally-partner') ?? null,
      link: seal?.querySelector('[data-pseal-ring-link]') !== null && seal?.querySelector('[data-pseal-ring-link]') !== undefined,
      allyArcs: seal?.querySelectorAll('.con-pseal__place--ally').length ?? -1,
      badge: seal?.querySelector('.con-pseal__ally') !== null && seal?.querySelector('.con-pseal__ally') !== undefined,
    };
  }, party);
}

/** The palata's party rows' boxes — the stability witness (the badge may move nothing). */
async function rowBoxes(page: Page): Promise<Array<string>> {
  return page.evaluate(() => Array.from(document.querySelectorAll('.con-parl__party')).map((el) => {
    const r = el.getBoundingClientRect();
    return `${el.getAttribute('data-party')}:${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
  }));
}

async function leaveParliament(page: Page): Promise<void> {
  for (let i = 0; i < 5 && await parliament(page).count() > 0; i++) {
    await press(page, 'Escape', 900);
  }
  await waitForBoardHome(page);
}

/** RT → «КАРТЫ»: the hand album, settled. */
async function openHand(page: Page, first: string): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${first}"]`).waitFor({timeout: 20_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
}

/** The hand album → `card` → A: its play composer, nothing sent. */
async function openComposer(page: Page, card: string): Promise<void> {
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, slots * 2 + 6), `the cursor reached ${card} in the hand`).toBe(true);
  expect(await pressUntil(page, 'Enter', async () => await page.locator(COMPOSER).count() > 0, {tries: 3, settleMs: 900}),
    `A opens ${card}'s play composer`).toBe(true);
  await settle(page);
}

async function closeHand(page: Page): Promise<void> {
  for (let i = 0; i < 4 && (await page.locator(COMPOSER).count() > 0 || await page.locator('.con-hand').count() > 0); i++) {
    await press(page, 'Escape', 900);
  }
  await waitForBoardHome(page);
}

/** The dossier's text (the «ДОСТУП» object and the rules), opened with X over the focused party. */
async function dossierText(page: Page, preset: string, name: string): Promise<string> {
  await openZoomViewer(page);
  await expect(page.locator('.con-zoom-rules').first()).toBeVisible({timeout: 10_000});
  await settle(page, {timeoutMs: 8_000});
  await shoot(page, preset, name);
  const text = await page.evaluate(() => Array.from(document.querySelectorAll('dialog.con-zoom[open] [data-parl-access-panel], dialog.con-zoom[open] .con-zoom-rules'))
    .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | '));
  await closeZoomViewer(page);
  return text;
}

for (const preset of PRESETS) {
  test.describe(`TR62 Tharsis Alliance · the law of access's fourth road · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A–D, G, H: before → the play → the alliance as objects, on the requirements, stable; red sees nothing (${preset.id})`, async ({page, request, context}) => {
      test.setTimeout(480_000);
      const pageErrors: Array<string> = [];
      const overflow: Array<string> = [];
      const posts: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('console', (m) => {
        if (m.text().includes('[console-overflow]')) {
          overflow.push(m.text().slice(0, 200));
        }
      });
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push(r.postData() ?? '');
        }
      });

      const {playerId, seats} = await bootFixtureSeats(page, request, 'tharsis-alliance', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const blue = before.thisPlayer.color;
      expect(before.cardsInHand?.map((c) => c.name), 'the fixture: TR62 and the Outlet in hand').toEqual(expect.arrayContaining([CARD, OUTLET]));
      expect(accessOf(before, blue, REDS), 'before: the Reds are not blue\'s').toMatchObject({hasEffect: false, satisfiesRequirement: false});

      // ── A. BEFORE: no badge, no borrowed ring; no Reds tile in «Действия карт»; the Outlet refused ──
      await openParliament(page);
      expect(await sealOf(page, REDS), 'the Reds\' seal: nothing of an alliance yet').toMatchObject({ally: null, badge: false, link: false});
      expect((await sealOf(page, MARS)).ring, 'Mars First\'s ring: blue\'s own two cubes').toBe('own');
      const boxesBefore = await rowBoxes(page);
      await shoot(page, preset.id, '01-parliament-before');
      await leaveParliament(page);
      await openCardActions(page);
      await expect(page.locator(`.con-cardactions__tile[data-action-party="${REDS}"]`), 'no access — no Reds tile').toHaveCount(0);
      for (let i = 0; i < 4 && await page.locator('.con-cardactions').count() > 0; i++) {
        await press(page, 'Escape', 900);
      }
      await waitForBoardHome(page);

      // ── B. the composer: what opens NOW; then ONE POST ──
      await openHand(page, CARD);
      await expect(page.locator(`.con-hand__slot[data-zoom-slot="${OUTLET}"] [data-hand-ease]`), 'the Outlet carries no easing before the play').toHaveCount(0);
      await openComposer(page, CARD);
      await expect(page.locator(COMPOSER), 'the play\'s verb').toContainText('Разыграть карту');
      await expect(page.locator(`${COMPOSER} .con-composer__next`).first(), 'the Reds open NOW, by the alliance').toContainText(/Откроет сейчас: эффект и карты «Красные»/);
      await expect(page.locator(COMPOSER), 'the draw at a change of power is named before the press').toContainText(/приходят к власти/);
      expect(posts.length, 'nothing sent before A').toBe(0);
      await shoot(page, preset.id, '02-composer');
      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        for (let i = 0; i < 8 && await page.locator('.con-composer__cta--focused').count() === 0; i++) {
          await press(page, 'ArrowDown', 300);
        }
        await press(page, 'Enter', 300);
        await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.length, 'the play is ONE POST').toBe(1);
      await waitForBoardHome(page, 25);
      await settle(page, {timeoutMs: 30_000});

      // ── C. AFTER: the server's road, then the objects ──
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the card is on the table').toContain(CARD);
      const reds = accessOf(after, blue, REDS);
      expect(reds, 'the Reds by the alliance: effect AND requirement').toMatchObject({hasEffect: true, satisfiesRequirement: true, byDelegates: false});
      expect(reds?.allied?.[0], 'the road is the partner\'s two cubes').toMatchObject({via: MARS, source: CARD, road: 'delegates'});

      await armImpulseProbe(page);
      const capturePlay = captureImpulse(page, preset.id, 'story-impulse-play');
      await openParliament(page);
      // The road opened in the HAND, where the chamber was not on screen: its impulse was owed to this first open.
      await expectImpulsePlayed(page, 'the alliance opened by the play: the impulse plays on the chamber\'s first open');
      await capturePlay();
      await expect.poll(() => sealOf(page, REDS), {timeout: 15_000, message: 'the Reds\' seal: the borrowed ring, the active badge, the link'})
        .toMatchObject({ring: 'allied', ally: 'active', partner: MARS, link: true, allyArcs: 2, badge: true});
      expect(await sealOf(page, MARS), 'Mars First\'s seal: its own ring, the active badge').toMatchObject({ring: 'own', ally: 'active', partner: REDS, badge: true});
      const redsRow = page.locator(`.con-parl__effects-row[data-party="${REDS}"]`);
      await expect(redsRow, '«ВАШИ ЭФФЕКТЫ» holds the Reds').toHaveCount(1);
      await expect(redsRow.locator('[data-parl-effects-why]')).toHaveAttribute('data-parl-effects-why', 'alliance');
      await expect(redsRow.locator('[data-parl-effects-via]')).toHaveAttribute('data-parl-effects-via', MARS);
      // ── D. stability: the badge moved nothing ──
      expect(await rowBoxes(page), 'the palata\'s rows keep their boxes across the play').toEqual(boxesBefore);
      await shoot(page, preset.id, '03-parliament-after');
      if (process.env.TM_E2E_MOCKUPS === '1') {
        await allianceMockups(page, preset.id);
      }
      await focusParty(page, REDS);
      const redsText = await dossierText(page, preset.id, '04-dossier-reds');
      expect(redsText, 'the Reds\' dossier: held by the alliance, the card named').toMatch(/Доступен · по альянсу: два ваших делегата на резолюции партии «Марс вперёд» \(«Альянс Тарсиса»\)/);
      expect(redsText, '…and the requirement met THROUGH the partner').toMatch(/выполнено по альянсу через «Марс вперёд»/);
      await focusParty(page, MARS);
      const marsText = await dossierText(page, preset.id, '05-dossier-mars');
      expect(marsText, 'the partner\'s dossier knows the pair').toMatch(/Альянс \(«Альянс Тарсиса»\): ваш доступ к этой партии открывает и партию «Красные»/);
      await leaveParliament(page);
      await openCardActions(page);
      await expect(page.locator(`.con-cardactions__tile[data-action-party="${REDS}"]`), 'the Reds\' action is blue\'s now').toHaveCount(1);
      await expect(page.locator(`.con-cardactions__group:has(.con-cardactions__tile[data-action-party="${REDS}"]) [data-action-ally-via]`),
        'its plate names the road: the partner\'s emblem and the link').toHaveAttribute('data-action-ally-via', MARS);
      await shoot(page, preset.id, '06-actions-after');
      for (let i = 0; i < 4 && await page.locator('.con-cardactions').count() > 0; i++) {
        await press(page, 'Escape', 900);
      }
      await waitForBoardHome(page);

      // ── C'. the requirement under the alliance: the plate, the cassette, the composer's row ──
      await openHand(page, OUTLET);
      const slot = page.locator(`.con-hand__slot[data-zoom-slot="${OUTLET}"]`);
      await expect(slot.locator('[data-hand-ease]'), 'the plate: the alliance, a check').toHaveAttribute('data-hand-ease', 'ally ✓');
      await expect(slot.locator('[data-req-state="allied"]').first(), 'the cassette: the printed party stays, the seal names the partner').toBeVisible();
      await expect(slot.locator('[data-req-mark="ally"]').first()).toHaveAttribute('data-req-mark-via', MARS);
      await shoot(page, preset.id, '07-hand-outlet');
      await openComposer(page, OUTLET);
      const req = page.locator(`${COMPOSER} [data-composer-req]`);
      await expect(req).toHaveAttribute('data-req-state', 'allied');
      await expect(req, 'through Mars First').toContainText('через «Марс вперёд»');
      await expect(req, 'the card that made the pair').toContainText('Альянс Тарсиса');
      // The row reads WHOLE — the partner's road on the source line, nothing cut by the row's own clip (the 4K row once
      // ended «· «Ма…»).
      const clipped = await req.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(clipped, 'the requirement row is not cut').toBeLessThanOrEqual(1);
      // …and the «Сработает» chip names the party it opens — the partner's mark, then that party's emblem (no number).
      await expect(page.locator(`${COMPOSER} .con-forecast__chip--modifier .con-armed__opens`), 'the chip shows the party the alliance opens').toHaveCount(1);
      await shoot(page, preset.id, '08-outlet-composer');
      await closeHand(page);
      expect(await strandedReports(page), 'the leak witness saw nothing').toEqual([]);

      // ── G. RED: no badge on its seals ──
      const redPage = await context.newPage();
      const redErrors: Array<string> = [];
      redPage.on('pageerror', (e) => redErrors.push(e.message));
      await openConsole(redPage, seats[1], preset.query);
      await settle(redPage, {timeoutMs: 30_000});
      await openParliament(redPage);
      expect((await sealOf(redPage, REDS)).badge, 'red\'s chamber: the alliance is blue\'s, never red\'s').toBe(false);
      expect((await sealOf(redPage, MARS)).badge).toBe(false);
      await shoot(redPage, preset.id, '09-red-parliament');
      expect(redErrors).toEqual([]);
      await redPage.close();

      // ── H. a reload keeps it all ──
      await reloadConsole(page);
      await settle(page, {timeoutMs: 30_000});
      await openParliament(page);
      await expect.poll(() => sealOf(page, REDS), {timeout: 15_000, message: 'after a reload the Reds still read the alliance'})
        .toMatchObject({ring: 'allied', ally: 'active'});
      expect(overflow, 'no overflow').toEqual([]);
      expect(pageErrors, 'no page error').toEqual([]);
    });

    test(`E: the vote names the ally the second cube opens; the dormant pair reads its second road (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId} = await bootFixtureSeats(page, request, 'tharsis-alliance-council', {query: preset.query});
      await settle(page);
      const before = await wireOf(request, playerId);
      expect(accessOf(before, before.thisPlayer.color, MARS), 'Mars First by ONE cube (Council Seat)').toMatchObject({delegates: 1, hasEffect: true, satisfiesRequirement: false});
      expect(accessOf(before, before.thisPlayer.color, REDS), 'the Reds NOT (FAQ p.19)').toMatchObject({hasEffect: false});
      await openParliament(page);
      expect(await sealOf(page, REDS), 'a dormant pair: the outlined badge on the Reds').toMatchObject({ally: 'dormant', ring: 'none'});
      await focusParliamentZone(page, 'voting');
      await press(page, 'Enter', 1200);
      await expect(page.locator('.con-parl__vote.con-parl__vote--up'), 'the vote mode opens').toHaveCount(1);
      for (let i = 0; i < 6 && await page.locator('.con-parl__slot--selected').first().getAttribute('data-party') !== MARS; i++) {
        await press(page, i < 3 ? 'ArrowRight' : 'ArrowLeft', 500);
      }
      await settle(page, {timeoutMs: 8_000});
      const ally = page.locator('[data-parl-fact="ally"]');
      await expect(ally, 'Mars First\'s second cube names the ally it opens').toHaveCount(1);
      await expect(ally).toHaveAttribute('data-parl-fact-tone', 'gain');
      await expect(ally).toContainText(/Красные.*эффект и карты ваши/i);
      await shoot(page, preset.id, '10-vote-mars-ally');

      // ── THE ACTIVATION (decision 5a): A sends the second cube — Mars First by the viewer's delegates, the Reds by the
      // alliance. The vote panel stands over the benches, so the impulse is OWED: nothing flies over the panel; the next
      // time the chamber is seen, ONE impulse leaves Mars First's seal for the Reds', and the Reds' ring answers on its
      // ARRIVAL, never with the change.
      await armImpulseProbe(page);
      const color = before.thisPlayer.color;
      const redsAllied = async () => accessOf(await wireOf(request, playerId), color, REDS)?.hasEffect === true;
      expect(await pressUntil(page, 'Enter', redsAllied, {tries: 2, settleMs: 2_000}),
        'A sends the second cube — the Reds become the viewer\'s by the alliance').toBe(true);
      await settle(page, {timeoutMs: 20_000});
      expect((await impulseProbe(page)).sparks, 'no impulse over the vote panel that covers both seals — it is owed').toBe(0);
      await answerNothing(page);
      await waitForBoardHome(page);
      const captureVote = captureImpulse(page, preset.id, 'story-impulse-vote');
      await openParliament(page);
      await expectImpulsePlayed(page, 'the owed impulse plays the first time the chamber is seen');
      await captureVote();
      await shoot(page, preset.id, '10b-chamber-after-vote');
      await answerNothing(page);
    });

    test(`F: the enactment of Mars First deals the alliance's card from the deck into the dock — never a reveal (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'tharsis-alliance-enact', {query: preset.query, landing: 'prompt'});
      const red = seats[1];
      const before = await wireOf(request, playerId);
      const hand = before.cardsInHand?.length ?? 0;
      await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
      expect(await openMandatoryAnnounce(page)).toBe(true);
      await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
      await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
      await waitSittingAtRest(page, 30_000);
      // A probe of the reveal surfaces across the enactment (MutationObserver + setInterval — never rAF).
      await page.evaluate(() => {
        const w = window as unknown as {__tr62: {reveal: boolean, proxies: number, samples: number, bandWithCard: boolean, bandWhileFlying: boolean}};
        w.__tr62 = {reveal: false, proxies: 0, samples: 0, bandWithCard: false, bandWhileFlying: false};
        const sample = () => {
          w.__tr62.samples++;
          if (document.querySelector('.con-reveal, .con-deckdraw') !== null) {
            w.__tr62.reveal = true;
          }
          const flying = document.querySelectorAll('.con-handdelivery-layer .con-deal-proxy').length;
          w.__tr62.proxies = Math.max(w.__tr62.proxies, flying);
          // THE BAND names the enactment's tail while the card is in the air (the card, the party come to power).
          const band = document.querySelector('[data-parl-band-zone]')?.getAttribute('data-parl-band') ?? '';
          if (band.startsWith('enact:ruling-draw:')) {
            w.__tr62.bandWithCard = true;
            if (flying > 0) {
              w.__tr62.bandWhileFlying = true;
            }
          }
        };
        new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true});
        window.setInterval(sample, 40);
      });
      await answerGateOnScreen(page, request, playerId, 'assembly');
      await answerGateAs(request, red, 'assembly');
      // THE STORYBOARD of the enactment (TM_E2E_STORYBOARD=1, acceptance on the GPU): the tact from the gate's answer to
      // the card's touchdown in the dock — the seals changing places, then the card off the deck under the band's line.
      if (process.env.TM_E2E_STORYBOARD === '1') {
        // Back to back, as JPEG (a 4K PNG costs more than the card's whole flight): the frames are evidence, not art.
        fs.mkdirSync(path.join(OUT, preset.id), {recursive: true});
        for (let frame = 0; frame < 28; frame++) {
          await page.screenshot({path: path.join(OUT, preset.id, `story-enact-${String(frame).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 70});
        }
      }
      await expect.poll(async () => (await wireOf(request, playerId)).game.parliament.rulingParty, {timeout: 60_000}).toBe(MARS);
      const after = await wireOf(request, playerId);
      expect(after.cardsInHand?.length, 'the server: ONE card for the change of power').toBe(hand + 1);
      expect(accessOf(after, after.thisPlayer.color, REDS)?.allied?.[0], 'the Reds by the alliance — Mars First rules').toMatchObject({via: MARS, road: 'ruling'});
      await expect.poll(() => page.evaluate(() => (window as unknown as {__tr62: {proxies: number}}).__tr62.proxies), {timeout: 60_000, message: 'the card flew into the dock'})
        .toBeGreaterThan(0);
      await waitSittingAtRest(page, 30_000);
      await shoot(page, preset.id, '11-enact-after');
      const probe = await page.evaluate(() => (window as unknown as {__tr62: {reveal: boolean, samples: number, bandWithCard: boolean, bandWhileFlying: boolean}}).__tr62);
      expect(probe.samples, 'the probe ran').toBeGreaterThan(20);
      expect(probe.reveal, 'no reveal and no deck-draw scene over the sitting — the intake carries the card').toBe(false);
      expect(probe.bandWithCard, 'the band names the tail of the enactment — the card that answered the change of power').toBe(true);
      expect(probe.bandWhileFlying, '…while the card is in the air').toBe(true);
      await expect.poll(() => page.evaluate(() => Number(document.querySelector('[data-hand-total]')?.getAttribute('data-hand-total') ?? NaN)), {timeout: 20_000})
        .toBe(hand + 1);
      expect(await strandedReports(page)).toEqual([]);
    });
  });
}

/**
 * THE OWNER'S MOCKUPS for decision 5 (TM_E2E_MOCKUPS=1 — acceptance material, never a product path): over the LIVE
 * chamber after the play, (a) is the shipped object (badge + borrowed ring + the one impulse); (b) adds a static
 * BRACKET in the benches' left margin joining the two seals while both sit in the opposition; (c) draws a LINE between
 * the seals, always, routed around the dais. Drawn as an overlay of measured rects, removed after the shot.
 */
async function allianceMockups(page: Page, preset: string): Promise<void> {
  await shoot(page, preset, 'mock-5a-badge-ring');
  for (const variant of ['b', 'c'] as const) {
    await page.evaluate(({v, mars, reds}) => {
      const seal = (party: string) => document.querySelector(`.con-parl__party[data-party="${party}"] .con-pseal__seal`)?.getBoundingClientRect();
      const a = seal(mars);
      const b = seal(reds);
      if (a === undefined || b === undefined) {
        return;
      }
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('data-tr62-mock', v);
      svg.setAttribute('style', 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99999');
      const ay = a.top + a.height / 2;
      const by = b.top + b.height / 2;
      const gold = '#ffd27a';
      if (v === 'b') {
        // THE BRACKET: a vertical stave in the left margin, a tick into each seal, the link at its middle.
        const x = Math.min(a.left, b.left) - 0.55 * rem;
        svg.innerHTML = `<path d="M ${a.left - 0.1 * rem} ${ay} H ${x} V ${by} H ${b.left - 0.1 * rem}" fill="none" stroke="${gold}" stroke-width="${0.1 * rem}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>` +
          `<circle cx="${x}" cy="${(ay + by) / 2}" r="${0.42 * rem}" fill="#0d0b07" stroke="${gold}" stroke-width="${0.06 * rem}"/>`;
      } else {
        // THE LINE: seal to seal, always — a curve bulging out past the benches (it would go round the dais when one rules).
        const x = Math.min(a.left, b.left) - 1.4 * rem;
        svg.innerHTML = `<path d="M ${a.left + a.width / 2} ${ay} C ${x} ${ay}, ${x} ${by}, ${b.left + b.width / 2} ${by}" fill="none" stroke="${gold}" stroke-width="${0.09 * rem}" stroke-dasharray="${0.35 * rem} ${0.22 * rem}" opacity="0.85"/>`;
      }
      document.body.appendChild(svg);
    }, {v: variant, mars: MARS, reds: REDS});
    await shoot(page, preset, `mock-5${variant}-${variant === 'b' ? 'bracket' : 'line'}`);
    await page.evaluate(() => document.querySelectorAll('[data-tr62-mock]').forEach((el) => el.remove()));
  }
}

type Box = {l: number, t: number, r: number, b: number};
type ImpulseProbe = {sparks: number, maxSparks: number, samples: number, pulseBeforeSpark: boolean, pulseAfterSpark: boolean,
  path: Array<[number, number]>, from?: Box, to?: Box};

/**
 * THE IMPULSE PROBE (decision 5a): counts the alliance impulses in the air and whether the Reds' plaque answered BEFORE
 * or AFTER one left — a MutationObserver + setInterval sampler (never rAF: it stops sampling exactly when the screen
 * goes quiet).
 */
async function armImpulseProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    type B = {l: number, t: number, r: number, b: number};
    type ImpulseProbeShape = {sparks: number, maxSparks: number, samples: number, pulseBeforeSpark: boolean, pulseAfterSpark: boolean,
      path: Array<[number, number]>, from?: B, to?: B};
    const w = window as unknown as {__tr62i?: ImpulseProbeShape, __tr62iTimer?: number};
    w.__tr62i = {sparks: 0, maxSparks: 0, samples: 0, pulseBeforeSpark: false, pulseAfterSpark: false, path: []};
    const boxOf = (party: string): B | undefined => {
      const r = document.querySelector(`.con-parl__party[data-party="${party}"] .con-pseal__seal`)?.getBoundingClientRect();
      return r === undefined ? undefined : {l: r.left, t: r.top, r: r.right, b: r.bottom};
    };
    let inAir = false;
    const sample = () => {
      const probe = w.__tr62i;
      if (probe === undefined) {
        return;
      }
      probe.samples++;
      const sparks = document.querySelectorAll('.con-parl__flight--spark');
      const n = sparks.length;
      if (n > 0 && !inAir) {
        probe.sparks++;
        const from = boxOf('Mars First');
        const to = boxOf('Reds');
        if (from !== undefined) {
          probe.from = from;
        }
        if (to !== undefined) {
          probe.to = to;
        }
      }
      if (n > 0) {
        const r = sparks[0].getBoundingClientRect();
        const cs = getComputedStyle(sparks[0]);
        // a proxy is born INVISIBLE and positioned on the next tick (parliament law 14): only a PAINTED spark is a sample
        if (r.width > 0 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05) {
          probe.path.push([r.left + r.width / 2, r.top + r.height / 2]);
        }
      }
      inAir = n > 0;
      probe.maxSparks = Math.max(probe.maxSparks, n);
      if (document.querySelector('.con-parl__party--pulse[data-party="Reds"]') !== null) {
        if (probe.sparks > 0) {
          probe.pulseAfterSpark = true;
        } else {
          probe.pulseBeforeSpark = true;
        }
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true});
    if (w.__tr62iTimer !== undefined) {
      window.clearInterval(w.__tr62iTimer);
    }
    w.__tr62iTimer = window.setInterval(sample, 30);
  });
}

async function impulseProbe(page: Page): Promise<ImpulseProbe> {
  return page.evaluate(() => (window as unknown as {__tr62i: ImpulseProbe}).__tr62i);
}

async function expectImpulsePlayed(page: Page, message: string): Promise<void> {
  await expect.poll(async () => (await impulseProbe(page)).pulseAfterSpark, {timeout: 20_000, message}).toBe(true);
  const probe = await impulseProbe(page);
  expect(probe.samples, 'the probe ran').toBeGreaterThan(20);
  expect(probe.sparks, 'ONE impulse').toBe(1);
  expect(probe.maxSparks, 'never two objects in the air').toBe(1);
  expect(probe.pulseBeforeSpark, 'nothing answers before the impulse leaves (only what was touched reacts)').toBe(false);
  // BOTH ENDS: the impulse is born on the partner's seal and lands on the ally's (a visible source, a visible destination).
  const near = (pt: [number, number] | undefined, box: Box | undefined): boolean => pt !== undefined && box !== undefined &&
    pt[0] >= box.l - 24 && pt[0] <= box.r + 24 && pt[1] >= box.t - 24 && pt[1] <= box.b + 24;
  expect(probe.path.length, `the impulse was sampled in the air (${probe.path.length} samples)`).toBeGreaterThan(1);
  expect(near(probe.path[0], probe.from), `born on Mars First's seal: ${JSON.stringify(probe.path[0])} vs ${JSON.stringify(probe.from)}`).toBe(true);
  expect(near(probe.path[probe.path.length - 1], probe.to), `lands on the Reds' seal: ${JSON.stringify(probe.path[probe.path.length - 1])} vs ${JSON.stringify(probe.to)}`).toBe(true);
}

/**
 * THE STORYBOARD of the impulse (TM_E2E_STORYBOARD=1): a capture loop that runs WHILE the chamber opens (the impulse
 * flies inside the open's own settle), the chamber's half of the screen clipped so a 4K frame costs less than the
 * impulse's flight. Returns the stop.
 */
function captureImpulse(page: Page, preset: string, name: string): () => Promise<void> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => undefined;
  }
  const viewport = page.viewportSize() ?? {width: 1920, height: 1080};
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  let stopped = false;
  const loop = (async () => {
    for (let frame = 0; frame < 40 && !stopped; frame++) {
      await page.screenshot({path: path.join(OUT, preset, `${name}-${String(frame).padStart(2, '0')}.png`),
        clip: {x: 0, y: 0, width: Math.round(viewport.width * 0.55), height: Math.round(viewport.height * 0.72)}}).catch(() => undefined);
    }
  })();
  return async () => {
    stopped = true;
    await loop;
  };
}

/** Leave whatever mode stands without answering it. */
async function answerNothing(page: Page): Promise<void> {
  for (let i = 0; i < 5 && await parliament(page).count() > 0; i++) {
    await press(page, 'Escape', 900);
  }
}

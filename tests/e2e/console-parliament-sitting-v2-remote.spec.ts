import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, press, settle} from './consoleStart';
import {
  armLeakWitness, awaitSittingUp, closeSitting, closeSittingAs, expectParliamentFits, hotVerb, openParliament, parliament, parliamentWire, passAs,
  sittingStage, strandedReports, waitSittingAtRest,
} from './parliamentDrive';
import {armSittingProbe, beatOrder, beatStart, readSittingProbe} from './parliamentDriveV2';


/**
 * «ЗАСЕДАНИЕ v2» — the SPECTATOR's path (the soft gates): the pass that runs the sitting is NOT this client's own
 * submit — it is sent over the API — so the viewer's client learns the whole chain through the POLL / WS frame:
 * the same walk, the same seeds, the same beats as for an own submit (the pre-v2 door was closed on exactly this
 * path: the wave never flew for a record that arrived while the section's stage read `submitting`). Architecture Award: RED wins from the middle slot, the government CHANGES (the Greens'
 * starting rule → Mars First), blue is paid +1 M€ production — the plaques change places by a FLIP, the
 * opposition row never moves, the wave flies for the spectator.
 */
const OUT = path.resolve('screenshots', 'parliament-sitting-v2', 'remote');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

test.describe('the sitting v2 · the spectator (standard-1080)', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the pass that runs the sitting arrives by the poll: the beats play from the diffs, the government changes by a FLIP, the wave flies', async ({page, request}) => {
    test.setTimeout(420_000);
    // ONE PASS before its sitting (the soft gates): red has passed, blue holds its action menu.
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-architecture-assembly', {query: '&consoleProfile=auto'});
    const red = seats[1];
    await armLeakWitness(page);
    const before = await parliamentWire(request, playerId);
    expect(before.game.parliament?.phase, 'no sitting yet').toBeUndefined();
    const redColor = (await parliamentWire(request, red)).thisPlayer.color;
    const mcProdBefore = before.thisPlayer.megacreditProduction;

    // The overview as it stands before the sitting: the Greens rule by the starting rule, five opposition tiles.
    await openParliament(page);
    await expect(page.locator('[data-parl-ruler] .con-parl__party[data-party="Greens"]'), 'the Greens rule by the starting rule').toHaveCount(1);
    const tilesBefore = await page.locator('.con-parl__parties .con-parl__party').evaluateAll((els) => els.map((el) => el.getAttribute('data-party')));
    expect(tilesBefore, 'five opposition tiles, the Greens not among them').toHaveLength(5);
    expect(tilesBefore).not.toContain('Greens');
    for (let i = 0; i < 4 && await parliament(page).count() > 0; i++) {
      await press(page, 'Escape', 900);
    }
    await expect(parliament(page), 'back on the board').toHaveCount(0, {timeout: 15_000});

    // ── THE PASS OVER THE API — not this client's submit: the chain runs on the server, the client learns it by the
    //    socket / the poll, and the sitting comes up on this screen.
    await armSittingProbe(page);
    await passAs(request, playerId);
    await awaitSittingUp(page);
    expect((await parliamentWire(request, playerId)).game.parliament?.phase?.summary?.winner.player, 'RED won the vote').toBe(redColor);
    await shoot(page, '01-sitting-up');
    await expect.poll(async () => (await readSittingProbe(page)).samples.some((s) => s.chips.length > 0), {timeout: 60_000, message: 'the wave left the card for the spectator'}).toBe(true);
    await waitSittingAtRest(page, 40_000);
    const s = (await readSittingProbe(page)).samples;
    const order = beatOrder(s);
    console.log(`[remote] beats: ${order.join(' → ')}`);
    expect(order.filter((b) => ['agenda', 'support', 'enact'].includes(b)), 'ПОВЕСТКА → ПОДДЕРЖКА → ПРИНЯТИЕ, in turn — from the poll').toEqual(['agenda', 'support', 'enact']);

    // ── THE GOVERNMENT CHANGED BY A FLIP: the ruler's tile read Greens until the enactment beat, Mars First after; the row kept five tiles and its boxes.
    const enactAt = beatStart(s, 'enact');
    expect(enactAt).toBeGreaterThanOrEqual(0);
    const earlyRuler = s.slice(0, enactAt).filter((st) => st.ruler !== '' && st.ruler !== 'Greens');
    expect(earlyRuler.length, 'the ruler\'s tile stayed the Greens\' until the enactment beat').toBe(0);
    const rest = s[s.length - 1];
    expect(rest.ruler, 'Mars First rules at rest').toBe('Mars First');
    const tilesAfter = await page.locator('.con-parl__parties .con-parl__party').evaluateAll((els) => els.map((el) => el.getAttribute('data-party')));
    expect(tilesAfter, 'five tiles in the row, the Greens back among them, Mars First gone up').toHaveLength(5);
    expect(tilesAfter).toContain('Greens');
    expect(tilesAfter).not.toContain('Mars First');
    // The tiles are ONE chassis: every tile the same height, the row's tiles at one y — read as a STATE, never off
    // the probe's last sample: past the wave the walk goes on BY ITSELF (a quiet card's adjourn rode the record),
    // and the body swap's downward stagger is a legitimate mid-motion pose (measured: ys 807 → 767 in one frame).
    const chassis = () => page.evaluate(() => {
      // v8: the ROW is one chassis; the dais seats the ruler's own (larger) medallion — the swap FLIPs between the two sizes.
      const heights = Array.from(document.querySelectorAll('.con-parl__parties .con-parl__party[data-party]')).map((el) => Math.round(el.getBoundingClientRect().height));
      // v8: the benches are a COLUMN beside the dais — one left edge (v5's row was one line).
      const rowXs = Array.from(document.querySelectorAll('.con-parl__parties .con-parl__party')).map((el) => Math.round(el.getBoundingClientRect().left));
      return {heights: [...new Set(heights)], rowXs: [...new Set(rowXs)]};
    });
    await expect.poll(async () => (await chassis()).heights.length, {timeout: 15_000, message: 'every tile of the row keeps one height'}).toBe(1);
    await expect.poll(async () => (await chassis()).rowXs.length, {timeout: 15_000, message: 'the benches stand in one column'}).toBe(1);
    // The old law's seat: the government kept the EMPTY seat until the enactment beat, the winner's card stands there at rest.
    const earlyGov = s.slice(0, enactAt).filter((st) => st.govCard !== '');
    expect(earlyGov.length, 'no card in the government before the enactment beat').toBe(0);
    // v8: past the wave the walk goes on to the results, whose card stands OVER the chamber (the government is out of
    // sight, so not «painted») — the winner's card is read on the last frame the chamber was in view.
    const chamberRest = [...s].reverse().find((st) => st.stage !== 'results') ?? rest;
    expect(chamberRest.govCard, 'the winner\'s card stands in the government').toMatch(/rdx-/);
    // The marker: red's, not the viewer's — it moved on the agenda beat and never before.
    const agendaAt = beatStart(s, 'agenda');
    const redTo = (await parliamentWire(request, playerId)).game.parliament?.phase?.summary?.agenda?.to;
    if (agendaAt >= 0 && redTo !== undefined) {
      const early = s.slice(0, agendaAt).filter((st) => (st.markers[redColor] ?? []).includes(redTo));
      expect(early.length, `red's marker never stood on step ${redTo} before the agenda beat`).toBe(0);
    }
    // THE WAVE for the spectator: +1 M€ production, born in the card's mechanic, the counter ticking at the landing.
    const chip = s.map((st, i) => ({i, st, c: st.chips.find((c) => c.res === 'megacredits')})).filter((x) => x.c !== undefined);
    expect(chip.length, 'the M€ production chip flew').toBeGreaterThan(0);
    const first = chip[0];
    expect(first.c!.x >= (first.st.mech?.x ?? 0) - 8 && first.c!.x <= (first.st.mech?.x ?? 0) + (first.st.mech?.w ?? 0) + 8, `born inside the card's mechanic (${JSON.stringify({chip: first.c, mech: first.st.mech})})`).toBe(true);
    // The rail prints production SIGNED («+1»), so the baseline is the rail's own first reading, never the wire's number.
    const prodBefore = s[0].rail.megacredits.prod;
    const tickAt = s.findIndex((st) => st.rail.megacredits.prod !== prodBefore);
    expect(tickAt, `the production counter ticked (was «${prodBefore}», wire ${mcProdBefore})`).toBeGreaterThan(0);
    expect(tickAt, 'never before the chip left').toBeGreaterThanOrEqual(first.i);
    expect(s.some((st) => st.deltas.megacredits > 0), 'the delta chip fired').toBe(true);
    await expectParliamentFits(page, 'remote after the wave');
    await shoot(page, '02-after-wave');

    // ── A quiet card: the adjourn arrived WITH the record — the RESULTS follow the wave in the same walk; one A, the other seat, the phase ends.
    await expect.poll(() => sittingStage(page), {timeout: 60_000}).toBe('results');
    await waitSittingAtRest(page, 40_000);
    await expect(page.locator('[data-sit-results-hidden]')).toHaveCount(0);
    expect(await hotVerb(page)).toMatch(/Закрыть заседание|Close the sitting/i);
    await expectParliamentFits(page, 'remote results');
    await shoot(page, '03-results');
    await closeSitting(page, request, playerId);
    await expect(parliament(page), 'the sitting leaves with its close').toHaveCount(0, {timeout: 30_000});
    await closeSittingAs(request, red);
    await settle(page, {timeoutMs: 20_000});
    expect(await strandedReports(page)).toEqual([]);
  });
});

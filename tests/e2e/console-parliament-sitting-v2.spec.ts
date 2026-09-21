import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, crumbText, openMandatoryAnnounce, placementState, placeTile, press, settle} from './consoleStart';
import {
  answerGateAs, armLeakWitness, expectParliamentFits, hotVerb, mandatoryPlate, parliament, PARLIAMENT_PRESETS, parliamentWire, sittingStage, sittingStep, strandedReports, waitSittingAtRest,
} from './parliamentDrive';
import {armSittingProbe, beatOrder, beatStart, readSittingProbe} from './parliamentDriveV2';

/**
 * «ЗАСЕДАНИЕ v2» — ONE press, the whole sequence (docs/TURMOIL_REDUX_PARLIAMENT_SITTING_V2.md).
 * The fixture stands at the ASSEMBLY gate BEFORE anything changed (v2): the winner in its slot with its
 * delegate, the government the previous one, the marker on its old step. The OTHER seat answers its gate
 * over the API first, so the viewer's A is the LAST answer — the response of the viewer's OWN submit
 * carries the whole chain, and the client plays it from the old state to the new:
 *
 *   · the order of the beats: ПОВЕСТКА → ПОДДЕРЖКА → ПРИНЯТИЕ → the reward's wave — no press in between;
 *   · NOT ONE FRAME shows the new state before its beat: the marker stays on its old step (and the
 *     influence at its old level) until the agenda beat, the support places stay dark until the support
 *     beat, the government keeps its empty seat and the closed quest until the enactment beat, the rail's
 *     counter does not tick before the wave's chip has landed;
 *   · the wave's proxy is BORN inside the carrier card's printed mechanic, the counter ticks IN the
 *     landing's frame;
 *   · the winner's tile: the reward page STOPS with the door plate and «К полю» — the board is NOT live
 *     until that press; after the landing the frame comes back to the reward page in its «received» pose;
 *   · the RESULTS are ONE stage: the renewal's beats, then the card revealed in the same panel; one A
 *     («Закрыть заседание») — the other seat's API answer ends the phase and the workspace leaves.
 * Three profiles; the probe is `setInterval` + `MutationObserver`, never rAF.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-sitting-v2');

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

const inside = (p: {x: number, y: number}, r: {x: number, y: number, w: number, h: number} | undefined, slack: number): boolean =>
  r !== undefined && p.x >= r.x - slack && p.x <= r.x + r.w + slack && p.y >= r.y - slack && p.y <= r.y + r.h + slack;

for (const preset of PARLIAMENT_PRESETS) {
  test.describe(`the sitting v2 (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    test('ONE A: ПОВЕСТКА → ПОДДЕРЖКА → ПРИНЯТИЕ → the wave, nothing early; «К полю» is the only door to the tile; the RESULTS are one stage', async ({page, request}) => {
      test.setTimeout(480_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-biodome-assembly', {query: preset.query, landing: 'prompt'});
      const red = seats[1];
      await armLeakWitness(page);
      const before = await parliamentWire(request, playerId);
      expect(before.game.parliament?.phase?.step).toBe('assembly');
      const viewer = before.thisPlayer.color;
      const summary = before.game.parliament?.phase?.summary;
      expect(summary?.winner.player, 'the viewer won the vote').toBe(viewer);
      const agenda = summary?.agenda;
      expect(agenda, 'v2: no Agenda step at the gate').toBeUndefined();
      const plantsBefore = before.thisPlayer.plants;

      // ── The plate, A opens the sitting on its VERDICT: the table exactly as voted.
      await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
      expect(await openMandatoryAnnounce(page)).toBe(true);
      await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
      await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
      await waitSittingAtRest(page, 20_000);
      const winnerInstance = summary?.winner.instance ?? '';
      await expect(page.locator(`.con-parl__slot--lit[data-instance="${winnerInstance}"]`), 'the winning card lights IN ITS SLOT').toHaveCount(1);
      await expect(page.locator(`.con-parl__slots .con-parl__slot[data-instance="${winnerInstance}"] .con-parl__ribbon [data-seq]`), 'its delegate is still on it').not.toHaveCount(0);
      await expect(page.locator('[data-parl-gov-empty]'), 'the government is the previous one (the empty seat)').toHaveCount(1);
      await expect(page.locator('.con-parl__gov-basis')).toHaveText(/Стартовое правило|Starting rule/i);
      await expect(page.locator('[data-parl-ruler] .con-parl__party[data-party="Greens"]'), 'the ruling party\'s tile stands in the government').toHaveCount(1);
      await expect(page.locator('.con-parl__parties .con-parl__party'), 'five opposition tiles in the row').toHaveCount(5);
      const markerBefore = await page.locator(`[data-agenda-markers] [data-agenda-cube="${viewer}"]`).first().evaluate((el) => el.closest('[data-agenda-markers]')?.getAttribute('data-agenda-markers'));
      const influenceBefore = await page.locator('[data-parl-influence]').textContent();
      const questBefore = await page.locator('[data-parl-quest] .con-parl__quest-text').textContent();
      expect(await hotVerb(page)).toMatch(/Продолжить|Continue/i);
      await expectParliamentFits(page, `${preset.id} verdict`);
      await shoot(page, preset.id, '01-verdict');

      // ── The OTHER seat answers first over the API: the viewer's A is the LAST answer (the own-submit path).
      await answerGateAs(request, red, 'assembly');
      expect((await parliamentWire(request, playerId)).game.parliament?.phase?.step, 'one answer moves nothing').toBe('assembly');

      // ── ONE A. Then the walk: ПОВЕСТКА → ПОДДЕРЖКА → ПРИНЯТИЕ → the wave.
      await armSittingProbe(page);
      const t0 = Date.now();
      await press(page, 'Enter', 300);
      await expect.poll(async () => (await parliamentWire(request, playerId)).game.parliament?.phase?.step, {timeout: 20_000}).not.toBe('assembly');
      await expect.poll(async () => (await readSittingProbe(page)).samples.some((s) => s.chips.length > 0), {timeout: 40_000, message: 'the wave left the card'}).toBe(true);
      const waveAt = Date.now() - t0;
      await waitSittingAtRest(page, 40_000);
      const probe = await readSittingProbe(page);
      const s = probe.samples;
      expect(s.length, 'the sampler lived').toBeGreaterThan(50);
      const order = beatOrder(s);
      console.log(`[${preset.id}] beats: ${order.join(' → ')} · the wave ${waveAt} ms after A`);
      // The beats, in the server's order — every one that the summary has a fact for.
      const after = await parliamentWire(request, playerId);
      const sum = after.game.parliament?.phase?.summary;
      const expected: Array<string> = [];
      if (sum?.agenda !== undefined && sum.agenda.from !== sum.agenda.to) {
        expected.push('agenda');
      }
      expected.push('support', 'enact');
      expect(order.filter((b) => expected.includes(b)), 'ПОВЕСТКА → ПОДДЕРЖКА → ПРИНЯТИЕ, in turn').toEqual(expected);
      expect(s.some((st) => st.stage === 'enact'), 'the enactment page was on screen').toBe(true);
      expect(waveAt, `the wave came within the budget (${waveAt} ms)`).toBeLessThan(preset.id === 'tv-4k' ? 12_000 : 9_000);

      // ── NOTHING EARLY. Every witness of the new state appears only from its own beat on.
      const agendaAt = beatStart(s, 'agenda');
      const supportAt = beatStart(s, 'support');
      const enactAt = beatStart(s, 'enact');
      if (sum?.agenda !== undefined && sum.agenda.from !== sum.agenda.to) {
        expect(agendaAt).toBeGreaterThanOrEqual(0);
        const early = s.slice(0, agendaAt).filter((st) => (st.markers[viewer] ?? []).includes(sum.agenda!.to));
        expect(early.length, `the marker never stood on step ${sum.agenda.to} before the agenda beat (${early.length} frames did; before A it stood on ${markerBefore})`).toBe(0);
        const earlyInfluence = s.slice(0, agendaAt).filter((st) => st.influence !== '' && st.influence !== (influenceBefore ?? '').trim());
        expect(earlyInfluence.length, 'the influence kept its old level until the agenda beat').toBe(0);
        expect(s[s.length - 1].markers[viewer], 'the marker rests on the new step').toContain(sum.agenda.to);
      }
      const gained = (sum?.support ?? []).filter((e) => e.gained > 0);
      if (gained.length > 0) {
        expect(supportAt).toBeGreaterThanOrEqual(0);
        const base = s[0].support;
        const earlySupport = s.slice(0, supportAt).filter((st) => gained.some((g) => (st.support[g.party] ?? 0) > (base[g.party] ?? 0)));
        expect(earlySupport.length, 'no support place lit before the support beat').toBe(0);
      }
      expect(enactAt).toBeGreaterThanOrEqual(0);
      const earlyGov = s.slice(0, enactAt).filter((st) => st.govCard !== '' || !st.govEmpty);
      expect(earlyGov.length, 'the government kept its empty seat until the enactment beat').toBe(0);
      const earlyQuest = s.slice(0, enactAt).filter((st) => st.questText !== '' && st.questText !== (questBefore ?? '').trim() && !st.questClosed);
      expect(earlyQuest.length, 'the new quest never showed before the enactment beat').toBe(0);
      const rest = s[s.length - 1];
      expect(rest.govCard, 'the winner stands in the government at rest').toMatch(/rdx-/);
      expect(rest.govEmpty).toBe(false);
      expect(rest.questClosed, 'the new quest unfolded').toBe(false);
      expect(rest.slots.split('|').filter((h) => h.endsWith('!')).length, 'the winner\'s slot stands vacated in its own place (the row never re-ordered)').toBe(1);
      expect(rest.slots.split('|')[0], 'the vacated slot is the winner\'s, in the first place').toBe(`${winnerInstance}!`);

      // ── THE WAVE: born inside the carrier card's printed mechanic; the counter ticks in the landing's frame.
      const plantsChip = s.map((st, i) => ({i, st, c: st.chips.find((c) => c.res === 'plants')})).filter((x) => x.c !== undefined);
      expect(plantsChip.length, 'a plants chip flew').toBeGreaterThan(0);
      const first = plantsChip[0];
      expect(inside(first.c!, first.st.mech, preset.id === 'tv-4k' ? 14 : 8), `the chip is BORN inside the card's mechanic (${JSON.stringify({chip: first.c, mech: first.st.mech})})`).toBe(true);
      const last = plantsChip[plantsChip.length - 1];
      let restAt = plantsChip.length - 1;
      while (restAt > 0 && Math.hypot(plantsChip[restAt - 1].c!.x - last.c!.x, plantsChip[restAt - 1].c!.y - last.c!.y) <= 1) {
        restAt--;
      }
      const landedIndex = plantsChip[restAt].i;
      const tickAt = s.findIndex((st) => st.rail.plants.stock !== '' && st.rail.plants.stock !== String(plantsBefore));
      expect(tickAt, 'the plants counter ticked').toBeGreaterThan(0);
      expect(tickAt, 'the counter never moved before the chip left the card').toBeGreaterThanOrEqual(first.i);
      const lag = s[tickAt].t - s[landedIndex].t;
      expect(lag, `the tick rides the touchdown (${Math.round(lag)} ms after the chip's rest)`).toBeGreaterThanOrEqual(-34);
      expect(lag, `the tick rides the touchdown (${Math.round(lag)} ms after the chip's rest)`).toBeLessThanOrEqual(400);
      expect(s.some((st) => st.deltas.plants > 0), 'the delta chip fired').toBe(true);
      await shoot(page, preset.id, '02-after-wave');

      // ── THE DOOR: the reward page stops on the tile; the board is NOT live; «К полю» is the verb.
      await expect.poll(() => sittingStep(page), {timeout: 20_000}).toBe('placement');
      // v5: the winner's tile reads as a chip of the BAND; the DOOR is still the command bar's own «К полю».
      await expect(page.locator('.con-band [data-parl-band-chip="tile"]'), 'the band names the tile').toHaveCount(1);
      expect((await crumbText(page)).toUpperCase()).toMatch(/РАЗМЕЩЕНИЕ|PLACEMENT/);
      expect(await hotVerb(page)).toMatch(/К полю|Onto the board/i);
      await settle(page, {timeoutMs: 20_000});
      expect(await placementState(page), 'the board waits for the press').toBe('none');
      expect((await parliamentWire(request, playerId)).waitingFor?.type, 'the server\'s placement stands').toBe('space');
      await expectParliamentFits(page, `${preset.id} door`);
      // R-30 was about the reward page's READINGS COLUMN — one left edge for a stack of chips. v5 retired that
      // column outright: the reward's whole reading is the BAND's single line, so the law it enforced is now
      // structural (a line has one left edge by construction) and what is left to check is that the line is
      // THERE and reads on ONE row, never wrapped inside a strip of fixed height.
      const r30 = await page.evaluate(() => {
        const band = document.querySelector<HTMLElement>('.con-band');
        const line = document.querySelector<HTMLElement>('.con-band__line');
        const lefts = Array.from(document.querySelectorAll<HTMLElement>('.con-band__yield .con-iyield__reading')).map((el) => Math.round(el.getBoundingClientRect().left));
        return {lefts, bandH: Math.round(band?.getBoundingClientRect().height ?? -1), lineH: Math.round(line?.getBoundingClientRect().height ?? -1)};
      });
      expect(r30.lefts.length, 'the reward\'s payout reads in the band').toBeGreaterThan(0);
      expect(r30.lineH, `the line is ONE line inside the band (${r30.lineH} of ${r30.bandH})`).toBeLessThanOrEqual(r30.bandH);
      expect(Math.max(...r30.lefts) - Math.min(...r30.lefts), `${preset.id}: a wandering left edge is impossible on one line (${r30.lefts.join(', ')})`).toBeLessThanOrEqual(1);
      await shoot(page, preset.id, '03-door');
      await press(page, 'Enter', 800);
      await expect.poll(() => placementState(page), {timeout: 30_000, message: 'the board is live after the press'}).not.toBe('none');
      await expect(parliament(page), 'the sitting stepped aside for the board').toHaveCount(0, {timeout: 20_000});
      await shoot(page, preset.id, '04-board');
      let placed = 0;
      for (let i = 0; i < 4; i++) {
        const now = (await parliamentWire(request, playerId)).waitingFor;
        if (now?.type !== 'space') {
          break;
        }
        await expect.poll(() => placementState(page), {timeout: 40_000}).not.toBe('none');
        expect(await placeTile(page), `tile ${i + 1} placed`).toBe(true);
        placed++;
        await expect.poll(async () => (await parliamentWire(request, playerId)).waitingFor?.promptId, {timeout: 30_000}).not.toBe(now.promptId);
      }
      expect(placed).toBeGreaterThan(0);
      await expect(parliament(page), 'the sitting is back').toHaveCount(1, {timeout: 60_000});
      await expect.poll(async () => (await readSittingProbe(page)).samples.some((st) => st.parl && st.stage === 'reward' && st.step !== 'placement'), {timeout: 30_000, message: 'the reward page\'s «received» pose on the way back'}).toBe(true);
      await shoot(page, preset.id, '05-received');

      // ── THE RESULTS, one stage: the renewal's beats, then the card; ONE A closes the sitting.
      await expect.poll(async () => (await parliamentWire(request, playerId)).game.parliament?.phase?.step, {timeout: 60_000}).toBe('adjourn');
      await expect.poll(() => sittingStage(page), {timeout: 60_000}).toBe('results');
      await waitSittingAtRest(page, 40_000);
      await expect(page.locator('[data-sit-results]'), 'the results card').toHaveCount(1);
      await expect(page.locator('[data-sit-results-hidden]'), 'revealed at rest').toHaveCount(0);
      const hiddenWhilePlaying = (await readSittingProbe(page)).samples.filter((st) => st.motion === 'results' && st.stage === 'results');
      expect(hiddenWhilePlaying.length, 'the results stage played').toBeGreaterThan(0);
      expect(hiddenWhilePlaying[0].resultsHidden, 'the card was HIDDEN while the renewal\'s beats played').toBe(true);
      expect((await crumbText(page)).toUpperCase()).toMatch(/ИТОГИ|RESULTS/);
      expect(await hotVerb(page)).toMatch(/Закрыть заседание|Close the sitting/i);
      await expect(page.locator('[data-sit-results] [data-sit-fresh]'), 'the new resolutions with their parties').not.toHaveCount(0);
      await expectParliamentFits(page, `${preset.id} results`);
      // The card never covers the Agenda track PARTIALLY (reviewed on the first run's frames: the track's label row
      // hidden under the plate, its nodes peeking below — on every profile). The stage grows out of its tier by
      // content, so the honest states are two: the card INSIDE the tier (1080 / TV), or the stage taking the
      // track WHOLE (the Deck, by its own rule) — never a half.
      const agendaCover = () => page.evaluate(() => {
        const stage = document.querySelector('.con-parl__stage')?.getBoundingClientRect();
        const agenda = document.querySelector('.con-parl__agenda')?.getBoundingClientRect();
        if (stage === undefined || agenda === undefined) {
          return {overlap: -1, track: 0};
        }
        return {overlap: Math.max(0, Math.min(stage.bottom, agenda.bottom) - Math.max(stage.top, agenda.top)), track: agenda.height};
      });
      const expectWholeOrNone = async (label: string) => {
        const c = await agendaCover();
        expect(c.overlap === 0 || c.overlap >= c.track - 1, `${label}: the stage never half-covers the Agenda track (covered ${Math.round(c.overlap)} of ${Math.round(c.track)} px)`).toBe(true);
        expect(c.overlap === 0 || preset.id === 'deck-handheld', `${label}: the results fit their tier on this profile (covered ${Math.round(c.overlap)} px of the track)`).toBe(true);
      };
      await expectWholeOrNone('results');
      await shoot(page, preset.id, '06-results');
      await press(page, 'Enter', 1200);
      await expect.poll(async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt, {timeout: 20_000}).toBeUndefined();
      await expect(page.locator('.con-band [data-sit-awaiting]'), 'the results wait for the other seat').toHaveCount(1, {timeout: 15_000});
      // …and the wait adds NO row: the answered gate keeps the card inside the tier too.
      await expectParliamentFits(page, `${preset.id} results · waiting`);
      await expectWholeOrNone('results · waiting');
      await shoot(page, preset.id, '06b-results-waiting');
      await answerGateAs(request, red, 'adjourn');
      await expect.poll(async () => (await parliamentWire(request, playerId)).game.phase, {timeout: 60_000}).not.toBe('parliament');
      await expect(parliament(page), 'the sitting leaves with the phase').toHaveCount(0, {timeout: 30_000});
      expect(await strandedReports(page)).toEqual([]);
      await shoot(page, preset.id, '07-after');
    });
  });
}

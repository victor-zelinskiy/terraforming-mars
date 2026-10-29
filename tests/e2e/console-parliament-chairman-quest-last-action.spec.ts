import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, openMandatoryAnnounce, playCardFromHand, press, settle} from './consoleStart';

/**
 * «ПРЕДСЕДАТЕЛЬСТВО» ON THE LAST ACTION OF THE TURN — the field freeze of 2026-10-29.
 *
 * The player closed the chairman quest with their SECOND action: the gate's answer ends the turn, so the response
 * that carries the office and the Agenda step hands the turn to the other seat — a human (the viewer is left with NO
 * prompt) or MarsBot (its turn rides the very response and flies its delegate over the open Parliament). The report:
 * the plate's A brought the player into the Parliament, no beat played, A did nothing and «B На поле» did nothing —
 * only a reload let them out.
 *
 * What this asserts is the JOURNEY, not the frames (the frames are `console-parliament-chairman-quest`'s): the flow
 * reaches its end by itself, the bar never advertises a verb the flow does not honour (no bare «На поле» fallback
 * while it plays), A closes it, and the workspace leaves.
 */
type FlowSample = {t: number, section: boolean, stage: string, beat: string, bar: string};

const FIXTURES = [
  // Two humans: the answer hands the turn on and leaves the viewer NO prompt.
  'parliament-chairman-quest-last-action',
  // Against MarsBot: the bot's turn (a delegate onto the table) rides the very response and flies over the open flow.
  'parliament-chairman-quest-bot',
] as const;

async function armFlowProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__qf: Array<FlowSample>};
    w.__qf = [];
    window.setInterval(() => {
      const root = document.querySelector<HTMLElement>('.con-parl');
      const bar = Array.from(document.querySelectorAll<HTMLElement>('.con-cmdbar .con-cmdbar__cmd'))
        .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | ');
      w.__qf.push({
        t: Math.round(performance.now()),
        section: root !== null,
        stage: root?.getAttribute('data-stage') ?? '',
        beat: root?.getAttribute('data-quest-beat') ?? '',
        bar,
      });
    }, 60);
  });
}

async function readFlowProbe(page: Page): Promise<Array<FlowSample>> {
  return await page.evaluate(() => (window as unknown as {__qf: Array<FlowSample>}).__qf);
}

/** The timeline in one line per change — what a red names. */
function timeline(samples: ReadonlyArray<FlowSample>): string {
  let last = '';
  const rows: Array<string> = [];
  for (const s of samples) {
    const key = `${s.section ? 1 : 0} ${s.stage} ${s.beat} «${s.bar}»`;
    if (key !== last) {
      rows.push(`${s.t} ${key}`);
      last = key;
    }
  }
  return rows.join('\n');
}

test.describe('«ПРЕДСЕДАТЕЛЬСТВО» — the gate that ends the turn', () => {
  for (const fixture of FIXTURES) {
    test(`${fixture}: the flow plays to its end, the bar never lies, and A closes it`, async ({page, request}) => {
      await bootFixtureSeats(page, request, fixture, {landing: 'prompt'});
      await expect(page.locator('.con-mandatory'), 'the gate is announced').toHaveCount(1, {timeout: 25_000});

      await armFlowProbe(page);
      expect(await openMandatoryAnnounce(page), 'A on the plate opens the Parliament').toBeTruthy();

      // The flow ends BY ITSELF — the director's last beat — whatever the answer left the viewer.
      try {
        await expect.poll(async () => await page.locator('.con-parl').getAttribute('data-quest-beat'), {
          timeout: 25_000,
          message: 'the chairmanship flow reached its end',
        }).toBe('done');
      } catch (err) {
        throw new Error(`${String(err)}\n${timeline(await readFlowProbe(page))}`);
      }

      const samples = await readFlowProbe(page);
      const flowing = samples.filter((s) => s.section && s.stage !== 'browse' && s.stage !== '');
      expect(flowing.length, `the sampler saw the flow (${samples.length} samples)`).toBeGreaterThan(3);
      // The bar never offers the shell's bare fallback over a flow that absorbs B.
      const lying = flowing.filter((s) => /На поле/i.test(s.bar));
      expect(lying.length, `no «На поле» over the flow\n${timeline(samples)}`).toBe(0);

      await press(page, 'Enter', 900);
      await settle(page, {timeoutMs: 20_000});
      expect(await page.locator('.con-parl').count(), 'the finished flow LEAVES').toBe(0);
    });
  }

  test('the field case whole: the PLAY from the hand closes the quest, its gate rides the landing, the gate ends the turn', async ({page, request}) => {
    await bootFixtureSeats(page, request, 'parliament-chairman-quest-by-play');
    expect(await playCardFromHand(page, 'Power Plant'), 'Power Plant was played from the hand').toBe(true);
    await expect(page.locator('.con-mandatory'), 'the gate is announced after the landing').toHaveCount(1, {timeout: 30_000});

    await armFlowProbe(page);
    expect(await openMandatoryAnnounce(page), 'A on the plate opens the Parliament').toBeTruthy();
    try {
      await expect.poll(async () => await page.locator('.con-parl').getAttribute('data-quest-beat'), {
        timeout: 25_000,
        message: 'the chairmanship flow reached its end',
      }).toBe('done');
    } catch (err) {
      throw new Error(`${String(err)}\n${timeline(await readFlowProbe(page))}`);
    }
    const samples = await readFlowProbe(page);
    const lying = samples.filter((s) => s.section && s.stage !== 'browse' && s.stage !== '' && /На поле/i.test(s.bar));
    expect(lying.length, `no «На поле» over the flow\n${timeline(samples)}`).toBe(0);
    await press(page, 'Enter', 900);
    await settle(page, {timeoutMs: 20_000});
    expect(await page.locator('.con-parl').count(), 'the finished flow LEAVES').toBe(0);
  });
});

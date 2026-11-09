import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, cinematicBeat, fetchPlayerModel, openActionFocus, openCardActions, press, settle} from './consoleStart';

/**
 * HI-TECH LAB — «spend X energy, draw X cards, keep one» (the owners' field freeze of 2026-11-09: the action's «keep 1»
 * deck pick read «Этот запрос пока недоступен в консольном режиме» until a reload — «Действия карт» claimed the pick for
 * its stage, the workspace left, the claim stood and suppressed the pick's own surface). The journey a player makes: the
 * action from «Действия карт», 3 energy dialled, the commit — and the «keep 1» question is SERVED (never the stranded
 * plate, never a stall), one card is taken, the energy is spent.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const COMPOSER = '.con-cardactions__stagewrap .con-composer--stage';

type Wire = {thisPlayer: {energy: number}, cardsInHand?: Array<{name: string}>, waitingFor?: {type?: string}};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}

async function focusHiTechLab(page: Page): Promise<void> {
  await openCardActions(page);
  const focused = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
  const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
  for (let i = 0; i < 18 && await focused() !== 'Hi-Tech Lab'; i++) {
    await press(page, moves[i % moves.length], 260);
  }
  expect(await focused(), 'the cursor stands on Hi-Tech Lab').toBe('Hi-Tech Lab');
  await openActionFocus(page);
  await settle(page);
}

test.describe('Hi-Tech Lab — the «keep 1» question is served, never stranded', () => {
  test.use({viewport: PRESET.viewport});

  test('3 energy → three cards drawn → «keep 1» stands on a surface → one card taken', async ({page, request}) => {
    test.setTimeout(240_000);
    const lines: Array<string> = [];
    page.on('console', (m) => {
      if (/STRANDED PROMPT|\[workspace-outcome\]|\[liveness\]/.test(m.text())) {
        lines.push(m.text().slice(0, 300));
      }
    });
    const id = await bootFixture(page, request, 'hi-tech-lab', {query: PRESET.query});
    await settle(page);
    const handBefore = (await wireOf(request, id)).cardsInHand?.length ?? 0;
    await focusHiTechLab(page);
    await expect(page.locator(COMPOSER), 'the action composer stands').toHaveCount(1, {timeout: 15_000});
    // The amount dial: RB +1, twice (1 → 3).
    await press(page, 'KeyE', 300);
    await press(page, 'KeyE', 300);
    for (let i = 0; i < 8 && await page.locator(`${COMPOSER} .con-composer__cta--focused`).count() === 0; i++) {
      await press(page, 'ArrowDown', 200);
    }
    await press(page, 'Enter', 400);
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.energy, {timeout: 20_000, message: 'the energy was spent'}).toBe(0);
    await expect.poll(async () => (await wireOf(request, id)).waitingFor?.type, {timeout: 20_000, message: 'the server asks «keep 1»'}).toBe('card');
    // SERVED: a deck pick stands for it within the beat — never the stranded plate.
    await expect(page.locator('.con-deckpick'), `the «keep 1» pick stands (${lines.join(' | ')})`).toHaveCount(1, {timeout: 20_000});
    await cinematicBeat(page, 3_000, 'the pick settles; a stranded plate would rise in this window');
    await expect(page.locator('.con-stranded'), `no stranded plate (${lines.join(' | ')})`).toHaveCount(0);
    // A — take the focused card (the pick commits one).
    for (let i = 0; i < 4 && (await wireOf(request, id)).waitingFor?.type === 'card'; i++) {
      await press(page, 'Enter', 900);
      await press(page, 'Period', 900);
    }
    await expect.poll(async () => (await wireOf(request, id)).cardsInHand?.length ?? 0, {timeout: 20_000, message: 'one card kept'}).toBe(handBefore + 1);
    expect(lines.filter((l) => l.includes('STRANDED')), 'never stranded').toEqual([]);
  });
});

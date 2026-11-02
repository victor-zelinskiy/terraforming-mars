import {test, expect, Page} from './consoleTest';
import {NO_PAYMENT, bootFixtureSeats, fetchPlayerModel, openMandatoryAnnounce, reloadConsole} from './consoleStart';

/**
 * THE SCREEN DIRECTOR'S CURE — STEP 4, PREPARED (`docs/claude/console/screen-director.md` § Step 4; the owner,
 * 2026-11-02: «начинаем подготовку шага 4»). A confirmed finding is answered by a PLAN through the owner's existing door
 * (`planScreenCure`); the plan is EXECUTED only for a verb the URL arms (`?screenCure=open,yield`) — by default it is a
 * DRY RUN: named (`[screen-shadow] cure-plan …`), filed on the finding, and nothing on the screen changes.
 *
 * The stand puts a LATCH BUG in on purpose, through the shell's control seam (`?screenControl=1` — never in a game):
 * a live colony pick (Exclusive Colony played over the API, the server asking `SelectColony` on its own) served by the
 * colonies workspace. The routing heals a dropped stack and a foreign milestones / hand screen by ITSELF (no finding —
 * pinned here); the card centre stood up over it strands the question (the stack ends empty — UNSERVED → `open`
 * through the router's door). Dry run: the plan is named and the screen stays broken (the director touched nothing).
 * Armed: the same defect is cured — the colonies stand again and the shadow agrees. MISSERVED (`yield`) has no live
 * seam today (every foreign screen tried was healed by the routing) — its plan is guarded by the unit controls.
 *
 * Functional class: it reads the shadow's own record (`window.__conScreenShadow()`) and the console lines.
 */

const TV = {width: 3840, height: 2160};
const QUERY = '&consoleProfile=tv&screenControl=1';

type Finding = {kind: string, expected: Array<string>, present: Array<string>, prompt: string, cure?: string};
type Readout = {
  findings: Array<Finding>,
  stats: {verdicts: Record<string, number>, owners: Record<string, Record<string, number>>},
  cure: {armed: Array<string>, standing: string | null},
};

async function readout(page: Page): Promise<Readout> {
  return page.evaluate(() => (window as unknown as {__conScreenShadow: () => Readout}).__conScreenShadow());
}

async function control(page: Page, verb: 'dropStack' | 'standWorkspace', arg?: string): Promise<void> {
  await page.evaluate(([v, a]) => {
    const seam = (window as unknown as {__conScreenControl?: Record<string, (x?: string) => void>}).__conScreenControl;
    if (seam === undefined) {
      throw new Error('no control seam — the stand needs ?screenControl=1');
    }
    seam[v](a);
  }, [verb, arg] as const);
}

const colonies = '.con-colonies';

/** Exclusive Colony over the API (no batch): the server asks the colony on its own; the console reloads onto it. */
async function liveColonyPick(page: Page, request: Parameters<typeof bootFixtureSeats>[1], query: string): Promise<void> {
  const {seats} = await bootFixtureSeats(page, request, 'exclusive-colony', {query});
  const model = await fetchPlayerModel(request, seats[0]) as {waitingFor?: {options?: Array<{title?: string | {message?: string}}>}};
  const titleOf = (o: {title?: string | {message?: string}}) => typeof o.title === 'string' ? o.title : o.title?.message;
  const index = (model.waitingFor?.options ?? []).findIndex((o) => titleOf(o) === 'Play project card');
  expect(index, 'the menu offers the card play').toBeGreaterThanOrEqual(0);
  const post = await request.post(`/player/input?id=${seats[0]}`, {data: {
    type: 'or', index, response: {type: 'projectCard', card: 'Exclusive Colony', payment: {...NO_PAYMENT, megacredits: 10}},
  }});
  expect(post.ok(), `the play was accepted (${post.status()} ${await post.text().catch(() => '')})`).toBeTruthy();
  const asked = await fetchPlayerModel(request, seats[0]) as {waitingFor?: {type?: string}};
  expect(asked.waitingFor?.type, 'the server asks the colony on its own').toBe('colony');
  await reloadConsole(page);
  await expect(page.locator(`${colonies}, .con-mandatory`).first(), 'the pick is served or announced').toBeVisible({timeout: 30_000});
  if (await page.locator('.con-mandatory').isVisible().catch(() => false)) {
    await openMandatoryAnnounce(page);
  }
  await expect(page.locator(colonies), 'the colonies serve the live pick').toBeVisible({timeout: 30_000});
  await expect.poll(async () => (await readout(page)).stats.owners.colony?.colonies ?? 0,
    {timeout: 15_000, message: 'the shadow agrees: the colonies serve the colony pick'}).toBeGreaterThan(1);
  expect((await readout(page)).findings, 'a served question files nothing').toEqual([]);
}

function listen(page: Page): Array<string> {
  const lines: Array<string> = [];
  page.on('console', (m) => {
    if (m.text().startsWith('[screen-shadow]')) {
      lines.push(m.text());
    }
  });
  return lines;
}

const findingOf = async (page: Page, kind: string) => (await readout(page)).findings.find((f) => f.kind === kind);

test.describe('the screen director\'s cure — step 4, prepared', () => {
  test.use({viewport: TV});

  /*
   * THE PRODUCT'S OWN ROUTING FIRST (measured 2026-11-02 on the box): the stack dropped, or a foreign workspace stood up
   * (the milestones, the hand), is answered by the shell's routing in the same beat — the colonies stand again and the
   * shadow never confirms anything. Those defects are no work for the director, and this test pins that they stay so.
   */
  test('the routing heals a dropped stack and a foreign workspace by itself — the director has nothing to plan', async ({page, request}) => {
    test.setTimeout(300_000);
    const lines = listen(page);
    await liveColonyPick(page, request, QUERY);
    for (const [verb, arg] of [['dropStack', undefined], ['standWorkspace', 'milestones'], ['standWorkspace', 'hand']] as const) {
      await control(page, verb, arg);
      const agreed = (await readout(page)).stats.verdicts.agree ?? 0;
      await expect.poll(async () => (await readout(page)).stats.verdicts.agree ?? 0,
        {timeout: 10_000, message: `${verb}(${arg ?? ''}): the shadow keeps agreeing`}).toBeGreaterThan(agreed + 1);
      await expect(page.locator(colonies), `${verb}(${arg ?? ''}): the colonies stand`).toBeVisible();
    }
    expect((await readout(page)).findings, 'nothing confirmed').toEqual([]);
    expect(lines.filter((l) => l.startsWith('[screen-shadow]')), 'no finding, no plan').toEqual([]);
  });

  /*
   * THE DEFECT THE ROUTING DOES NOT SEE: the card centre stood up over the live pick (`enterWorkspace` unwinds the
   * colonies, the centre's own anchor then lets it go) — the stack ends EMPTY and nothing re-opens the question.
   */
  test('DRY RUN (nothing armed): a stranded question is found and its cure NAMED — the screen is left exactly as it stood', async ({page, request}) => {
    test.setTimeout(300_000);
    const lines = listen(page);
    await liveColonyPick(page, request, QUERY);
    expect((await readout(page)).cure.armed, 'without the URL only the owner\'s armed class — the blind announce').toEqual(['announce']);

    await control(page, 'standWorkspace', 'card-actions');
    await expect.poll(async () => (await findingOf(page, 'unserved'))?.cure ?? '',
      {timeout: 10_000, message: 'the stranded question is found, and the plan is the router\'s door'}).toBe('plan:open:openShellTaskSurface');
    expect(lines.some((l) => l.startsWith('[screen-shadow] cure-plan «open:openShellTaskSurface» by shadow (dry run')), lines.join('\n')).toBe(true);
    // An armed cure runs in the very pass that confirms the finding — a dry run leaves the defect standing.
    await expect(page.locator(colonies), 'the director touched nothing').toHaveCount(0);
    expect((await readout(page)).cure.standing, 'the finding stands, for the liveness rung to name').toBe('open:openShellTaskSurface');
    expect(lines.filter((l) => l.startsWith('[screen-shadow] cure «')), 'no cure was applied').toEqual([]);
  });

  test('ARMED (open): the same stranded question is CURED through the router\'s door — the colonies stand again, the shadow agrees', async ({page, request}) => {
    test.setTimeout(300_000);
    const lines = listen(page);
    await liveColonyPick(page, request, `${QUERY}&screenCure=open`);
    expect((await readout(page)).cure.armed, 'the URL armed the one verb').toEqual(['open']);

    await control(page, 'standWorkspace', 'card-actions');
    await expect.poll(async () => (await findingOf(page, 'unserved'))?.cure ?? '',
      {timeout: 10_000, message: 'the stranded question is cured through the router\'s door'}).toBe('cure:open:openShellTaskSurface');
    await expect(page.locator(colonies), 'the colonies stand again').toBeVisible({timeout: 15_000});
    const agreed = (await readout(page)).stats.verdicts.agree ?? 0;
    await expect.poll(async () => (await readout(page)).stats.verdicts.agree ?? 0, {timeout: 10_000}).toBeGreaterThan(agreed);
    expect((await readout(page)).cure.standing, 'nothing left standing').toBe(null);
    console.log('[cure] lines\n' + lines.join('\n'));
    expect(lines.filter((l) => l.startsWith('[screen-shadow] cure «')), 'cured once').toHaveLength(1);
  });
});

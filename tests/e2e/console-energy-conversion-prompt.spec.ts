import {test, expect} from '@playwright/test';
import {
  createGameWithCards, fetchPlayerModel, openConsole, press, seedGameOverApi, sendPlayerInput,
  soloGameConfig,
} from './consoleStart';

/**
 * SUPERCAPACITORS — the optional production-phase energy→heat conversion as a
 * PREMIUM CONTEXTUAL PROMPT (docs/claude/energy-heat-conversion.md § console
 * conversion prompt), verified on the real surface:
 *
 *   source context (kicker «ЭФФЕКТ ПРОИЗВОДСТВА» + the docked card) → headline
 *   + demoted ask → the compact dial (no in-panel hint duplication) → the
 *   two-sided current→after preview (neutral at 0, live deltas past it) → the
 *   commit verb that names the operation on A → collapse/resume keeps the safe
 *   0 → the COMMIT HANDOFF: the prompt surface LEAVES, the existing rail
 *   transition plays on the freed stage, and the NEXT prompt (the research
 *   buy) is admitted strictly after — with the counters carrying EXACTLY one
 *   conversion (a double press is absorbed by the commit lock).
 *
 * The road is the API one end to end (the walk is setup, never the subject):
 * the pregame is seeded, the play and the pass are POSTed over the same
 * player/input endpoint the real client uses, and the console then opens
 * FRESH on the standing prompt — which doubles as the reconnect case. Only
 * the prompt itself is driven with the keyboard: that IS the subject.
 */

test.use({viewport: {width: 1920, height: 1080}});

const NO_PAYMENT = {
  heat: 0, megacredits: 0, steel: 0, titanium: 0, plants: 0, microbes: 0,
  floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0,
  auroraiData: 0, graphene: 0, kuiperAsteroids: 0,
};

test('Supercapacitors: premium conversion prompt → rail handoff → next prompt after', async ({page, request}) => {
  test.setTimeout(300_000);

  // Supercapacitors guaranteed on top of the project deck (the dev mechanism —
  // Deck.putOnTop via customProjectCards); the seeder buys it into hand and
  // stops on the action menu.
  const playerId = await createGameWithCards(request, ['Supercapacitors'], {
    config: soloGameConfig({
      expansions: {promo: true},
      customProjectCards: ['Supercapacitors'],
    }),
  });
  await seedGameOverApi(request, playerId, {cards: ['Supercapacitors']});

  // PLAY the card and PASS the generation over the API — the same endpoint and
  // responses the real client posts. The pass branch is found by its BUTTON
  // LABEL, a raw English server constant on the wire (`Player.passOption()`),
  // never a rendered (translatable) title.
  let model = await fetchPlayerModel(request, playerId);
  type MenuOption = {type: string, buttonLabel?: string};
  const menu = (model.waitingFor?.options ?? []) as Array<MenuOption>;
  const playIdx = menu.findIndex((o) => o.type === 'projectCard');
  expect(playIdx, 'the action menu offers a card play').toBeGreaterThanOrEqual(0);
  model = await sendPlayerInput(request, playerId, {
    type: 'or', index: playIdx,
    response: {type: 'projectCard', card: 'Supercapacitors', payment: {...NO_PAYMENT, megacredits: 4}},
  });
  const menu2 = (model.waitingFor?.options ?? []) as Array<MenuOption>;
  const passIdx = menu2.findIndex((o) => o.buttonLabel === 'Pass');
  expect(passIdx, 'the action menu offers the pass branch').toBeGreaterThanOrEqual(0);
  model = await sendPlayerInput(request, playerId, {type: 'or', index: passIdx, response: {type: 'option'}});
  expect(model.waitingFor?.type, 'the pass ends the generation onto the conversion prompt').toBe('amount');

  // Open the console FRESH on the standing prompt (the reconnect case). The
  // API-answered pregame leaves its purchases undelivered, so the shell first
  // replays the intake reveal, then ANNOUNCES the mandatory decision — drive
  // both with A until the conversion prompt owns the stage.
  await openConsole(page, playerId);
  const convert = page.locator('.con-convert');
  for (let i = 0; i < 40 && await convert.count() === 0; i++) {
    if (await page.locator('.con-reveal, .con-mandatory').count() > 0) {
      await press(page, 'Enter', 1100);
    } else {
      await page.waitForTimeout(500);
    }
  }
  await expect(convert).toHaveCount(1);

  // ── SOURCE CONTEXT + HEADLINE (the caps are CSS text-transform, so the
  //    copy is matched case-insensitively on the translation itself) ──────
  await expect(page.locator('.con-task__kicker')).toContainText(/эффект производства/i);
  await expect(page.locator('.con-task__title')).toContainText(/преобразование энергии/i);
  await expect(page.locator('.con-task__subtext')).toContainText(/сколько энергии/i);
  expect(await page.locator('.con-task .con-src').count(),
    'the source dock (Supercapacitors) is docked').toBeGreaterThan(0);

  // ── THE DIAL AT THE SAFE 0 (testMode stock: 0 / 500) ──────────────────
  await expect(page.locator('.con-convert__dial')).toHaveCount(1);
  await expect(page.locator('.con-convert__value')).toHaveText('0');
  await expect(page.locator('.con-convert__preview--neutral')).toHaveCount(1);
  await expect(page.locator('.con-convert__note')).toContainText(/без изменений/i);
  const bar = page.locator('.con-cmdbar');
  await expect(bar).toContainText(/не преобразовывать/i);
  // No duplicated dial hints inside the panel — the bar is the one source.
  expect(await page.locator('.con-task__stepper-keys, .con-convert .gp-glyph').count()).toBe(0);
  // The rail marks the two stock rows the decision is about (values untouched).
  await expect(page.locator('.con-res__row--energy.con-res__row--conv-watch')).toHaveCount(1);
  await expect(page.locator('.con-res__row--heat.con-res__row--conv-watch')).toHaveCount(1);
  const energyBefore = Number((await page.locator('.con-res__row--energy .con-res__value').innerText()).trim());
  const heatBefore = Number((await page.locator('.con-res__row--heat .con-res__value').innerText()).trim());

  // ── COLLAPSE / RESUME: a dialed value is never carried into a resume —
  //    the prompt re-opens at the SAFE 0 with its full context and range. ──
  await press(page, 'ArrowRight', 320);
  await expect(page.locator('.con-convert__value')).toHaveText('1');
  await press(page, 'Escape', 1500);
  await expect(convert).toHaveCount(0);
  const restoreCard = page.locator('.con-mandatory');
  await expect(restoreCard).toContainText(/эффект производства/i);
  await expect(restoreCard).toContainText(/суперконденсаторы/i);
  await press(page, 'Enter', 1600);
  await expect(convert).toHaveCount(1);
  await expect(page.locator('.con-convert__value')).toHaveText('0');

  // ── DIAL TO 2: the preview goes LIVE — both sides, one operation ──────
  await press(page, 'ArrowRight', 320);
  await press(page, 'ArrowRight', 320);
  await expect(page.locator('.con-convert__value')).toHaveText('2');
  await expect(page.locator('.con-convert__preview--neutral')).toHaveCount(0);
  await expect(page.locator('.con-convert__row--from .con-convert__delta')).toContainText('-2');
  await expect(page.locator('.con-convert__row--to .con-convert__delta')).toContainText('+2');
  await expect(page.locator('.con-convert__row--from')).toContainText(String(energyBefore - 2));
  await expect(page.locator('.con-convert__row--to')).toContainText(String(heatBefore + 2));
  await expect(bar).toContainText(/преобразовать 2/i);
  // The real rail still shows the PRE-commit values — the preview never leaks.
  await expect(page.locator('.con-res__row--energy .con-res__value')).toHaveText(String(energyBefore));

  // Production income lands on the same commit (after the conversion) — the
  // final counters owe it too.
  const prodOf = async (row: string): Promise<number> => {
    const t = (await page.locator(`.con-res__row--${row} .con-res__prod`).innerText()).trim();
    return Number.parseInt(t.replace('+', ''), 10) || 0;
  };
  const energyProd = await prodOf('energy');
  const heatProd = await prodOf('heat');

  // ── COMMIT + HANDOFF. A commits; the immediate second press must be
  //    absorbed (commit lock) — the final counters prove no double run. ───
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  // Sample the sequencing (~9 s @ 150 ms). `overlayUp` is the transition's own
  // visible-motion layer (`.resource-conversion-layer` mounts only past the
  // lead-in — the handoff window in which the prompt surface plays its leave).
  type Sample = {convertUp: boolean, overlayUp: boolean, nextPrompt: boolean};
  const samples: Array<Sample> = [];
  for (let i = 0; i < 60; i++) {
    samples.push(await page.evaluate(() => ({
      convertUp: document.querySelector('.con-convert') !== null,
      overlayUp: document.querySelector('.resource-conversion-layer') !== null,
      nextPrompt: document.querySelector('.con-task--wide, .con-deckpick') !== null,
    })));
    await page.waitForTimeout(150);
  }
  // The transition PLAYED; it never ran under the still-standing prompt; and
  // at least one of its frames had the stage entirely to itself (prompt gone,
  // next prompt not yet admitted) — the handoff, in one claim each.
  expect(samples.some((s) => s.overlayUp), 'the rail conversion transition played').toBeTruthy();
  expect(samples.filter((s) => s.overlayUp && s.convertUp).length,
    'the transition must not play under the prompt surface').toBe(0);
  expect(samples.some((s) => s.overlayUp && !s.convertUp && !s.nextPrompt),
    'the transition ran with the prompt gone and the next prompt held').toBeTruthy();

  // The next prompt (the research buy) arrives, and the counters carry EXACTLY
  // one conversion + one production income (a double submit / double animation
  // would land −4/+4 or double the income).
  await page.locator('.con-task--wide, .con-deckpick').first().waitFor({timeout: 30_000});
  await expect(page.locator('.con-res__row--energy .con-res__value'))
    .toHaveText(String(energyBefore - 2 + energyProd));
  await expect(page.locator('.con-res__row--heat .con-res__value'))
    .toHaveText(String(heatBefore + 2 + heatProd));
});

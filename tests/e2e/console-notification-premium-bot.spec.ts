import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootWithCards, playCardFromHand, press, soloGameConfig, waitForTurn} from './consoleStart';

/**
 * THE BOT TURN AS A PREMIUM STORY — iteration 2's neutral-card contract.
 *
 * What iteration 1 left: the bot card was a server trace («Бот тратит…», «Бот
 * продвигается…», «Бот получил…» — the actor repeated per line, «1 ряд(а)»
 * pluralisation, trailing chips with no owner). This spec pins the rework on a
 * LIVE bot turn:
 *  - the actor is stated ONCE (the head chip); no outcome line re-opens with
 *    the bot's own name;
 *  - context chips ride OWNERSHIP clusters (`.con-notif__cluster-tag`), so a
 *    bot gain can never read as the viewer's reward;
 *  - the queue counter is the quiet TAIL under the stack (`.con-notifq`), and
 *    the old centre-stage «СОБЫТИЯ В ОЧЕРЕДИ» banner никогда does not exist;
 *  - no «(а)/(ов)» pluralisation compromise survives on the card.
 *
 * Content is deal-dependent (no reproducible seed), so every assertion is
 * structural — classes and shapes, never a specific card name.
 */

const OUT_DIR = path.resolve('screenshots', 'notification-premium');

const CHEAP_CARD = 'Power Plant';

const CONFIG = soloGameConfig({
  automa: {difficulty: 'normal'},
  customProjectCards: [CHEAP_CARD],
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** Keep the page painting (headless rAF starves on quiet frames). */
async function settle(page: Page, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
    await page.waitForTimeout(100);
  }
}

test.describe('bot turn card · premium neutral story', () => {
  test('one actor statement, ownership clusters, quiet queue tail, no (s)-compromises', async ({page, request}) => {
    test.setTimeout(300_000);

    await bootWithCards(page, request, {cards: [CHEAP_CARD], config: CONFIG});
    await waitForTurn(page);
    await settle(page, 1_500);

    // Hand the turn over: play the cheap card, then skip (LT wheel ↑).
    expect(await playCardFromHand(page, CHEAP_CARD), `${CHEAP_CARD} must have been played`).toBe(true);
    await settle(page, 1_200);
    await press(page, 'Comma', 900);
    await press(page, 'ArrowUp', 500);
    await press(page, 'Enter', 1200);

    const card = page.locator('.con-notif.notification-card--variant-bot-turn');
    await card.first().waitFor({timeout: 30_000});
    await settle(page, 900);
    await shoot(page, 'bot-turn-neutral');

    const audit = await page.evaluate(() => {
      const root = document.querySelector('.con-notif.notification-card--variant-bot-turn');
      if (root === null) {
        return undefined;
      }
      const actor = (root.querySelector('.con-notif__head .con-notif__actor') as HTMLElement | null)
        ?.innerText.replace(/\s+/g, ' ').trim() ?? '';
      const lines = Array.from(root.querySelectorAll('.con-notif__summary-line:not(.con-notif__summary-line--more)'))
        .map((el) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim());
      const headline = (root.querySelector('.con-notif__headline') as HTMLElement | null)
        ?.innerText.replace(/\s+/g, ' ').trim() ?? '';
      const clusterTags = Array.from(root.querySelectorAll('.con-notif__cluster-tag'))
        .map((el) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim());
      const whole = (root as HTMLElement).innerText;
      return {actor, lines, headline, clusterTags, whole,
        banner: document.querySelectorAll('.con-banner--events').length,
        queueTail: document.querySelectorAll('.con-notifq').length};
    });
    expect(audit, 'the bot card is on screen').toBeDefined();
    console.log('[notification-premium] bot card audit:', JSON.stringify(audit, null, 2));

    // ONE actor statement: the head chip names the bot; no outcome line and
    // not the headline re-opens with that same name.
    expect(audit!.actor.length, 'the head names the actor').toBeGreaterThan(0);
    for (const line of [audit!.headline, ...audit!.lines]) {
      if (line === '') {
        continue;
      }
      expect(line.startsWith(audit!.actor), `line re-opens with the actor: «${line}»`).toBe(false);
    }

    // Ownership clusters label every context chip row (when any chips exist).
    const chips = await card.locator('.con-notif__clusters .con-notif__chip').count();
    if (chips > 0) {
      expect(audit!.clusterTags.length, 'chips ride labelled clusters').toBeGreaterThan(0);
    }

    // No «(s)»-style pluralisation compromise anywhere on the card.
    expect(audit!.whole).not.toMatch(/\((s|а|ов|ы)\)/);

    // The centre-stage queue banner does not exist; the pending count (if any
    // right now) is the quiet tail under the stack.
    expect(audit!.banner, 'the old centre banner is gone').toBe(0);

    // ── the QUEUE TAIL, live: pass — the bot plays the round out as a RUN,
    //    whose cards arrive faster than one lifetime, so a backlog forms.
    //    The count presents as the quiet chip UNDER the stack, and the centre
    //    banner never returns. (The run may drain quickly — poll, don't pose.)
    await press(page, 'Comma', 900);
    await press(page, 'ArrowDown', 500); // «Пас»
    await page.keyboard.press('Enter');
    let sawTail = false;
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      if (await page.locator('.con-notifq').count() > 0) {
        sawTail = true;
        break;
      }
      if (await page.locator('.con-banner--events').count() > 0) {
        throw new Error('the centre-stage queue banner came back');
      }
      await settle(page, 250);
    }
    if (sawTail) {
      await shoot(page, 'queue-tail');
      const tail = await page.evaluate(() => {
        const el = document.querySelector('.con-notifq') as HTMLElement | null;
        const card = document.querySelector('.con-notif');
        return {
          text: el?.innerText.replace(/\s+/g, ' ').trim() ?? '',
          // The tail rides INSIDE the layer column, under the card — never
          // centre stage (its box starts right of the screen's midline).
          left: el?.getBoundingClientRect().left ?? 0,
          cardBottom: (card as HTMLElement | null)?.getBoundingClientRect().bottom ?? 0,
          top: el?.getBoundingClientRect().top ?? 0,
          mid: window.innerWidth / 2,
        };
      });
      console.log('[notification-premium] queue tail:', JSON.stringify(tail));
      expect(tail.text).toMatch(/\+\d+/);
      expect(tail.left, 'the tail hangs in the notification column, not centre stage').toBeGreaterThan(tail.mid);
    } else {
      console.log('[notification-premium] the bot run drained without a backlog this time — tail not exercised');
    }
  });
});

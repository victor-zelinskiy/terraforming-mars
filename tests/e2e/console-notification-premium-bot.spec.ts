import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootWithCards, playCardFromHand, press, settle, soloGameConfig, waitForTurn} from './consoleStart';
import {armWitness} from './witness';

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

/** One recorded state of the notification column during the bot's run: the queue tail (if it stands) and the banner. */
type QueueSeen = {
  tail: {text: string, left: number, top: number} | null,
  cardBottom: number, mid: number,
  /** The old centre-stage «События в очереди» banner is on screen. */
  banner: boolean,
};

test.describe('bot turn card · premium neutral story', () => {
  test('one actor statement, ownership clusters, quiet queue tail, no (s)-compromises', async ({page, request}) => {
    test.setTimeout(300_000);

    await bootWithCards(page, request, {cards: [CHEAP_CARD], config: CONFIG});
    await waitForTurn(page);
    await settle(page); // the board at rest — a state, never a fixed 1.5 s

    // Hand the turn over: play the cheap card, then skip (LT wheel ↑).
    expect(await playCardFromHand(page, CHEAP_CARD), `${CHEAP_CARD} must have been played`).toBe(true);
    await settle(page); // the play's scene is over before the wheel
    await press(page, 'Comma', 900);
    await press(page, 'ArrowUp', 500);
    await press(page, 'Enter', 1200);

    const card = page.locator('.con-notif.notification-card--variant-bot-turn');
    await card.first().waitFor({timeout: 30_000});
    await shoot(page, 'bot-turn-neutral');

    // The card is ATOMIC — final from its first painted frame (the notification contract) — so it is read as it
    // stands; no fixed pause before it (the bot's turn may keep the console busy while the card stands).
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
        banner: [...document.querySelectorAll('.con-banner')].filter((el) => /События в очереди/i.test(el.textContent ?? '')).length,
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

    // Ownership clusters label every context chip row (when any chips exist) — and the BOT's own line wears only its
    // dot (TR59: the head named the actor; ONE ACTOR STATEMENT), never «БОТ» again; no «Марс» cluster (the HUD).
    const chips = await card.locator('.con-notif__clusters .con-notif__chip').count();
    if (chips > 0) {
      expect(audit!.clusterTags.length, 'chips ride labelled clusters').toBeGreaterThan(0);
    }
    const actorName = audit!.actor.replace(/^\W+/, '').trim();
    for (const tag of audit!.clusterTags) {
      expect(actorName !== '' && tag.includes(actorName), `a cluster re-names the actor: «${tag}»`).toBe(false);
    }
    await expect.poll(() => card.locator('[data-notif-cluster="planet"]').count(), {message: 'no «Марс» cluster on the toast'}).toBe(0);

    // No «(s)»-style pluralisation compromise anywhere on the card.
    expect(audit!.whole).not.toMatch(/\((s|а|ов|ы)\)/);

    // The centre-stage queue banner does not exist; the pending count (if any
    // right now) is the quiet tail under the stack.
    expect(audit!.banner, 'the old centre banner is gone').toBe(0);

    // ── the QUEUE TAIL, live: pass — the bot plays the round out as a RUN,
    //    whose cards arrive faster than one lifetime, so a backlog forms.
    //    The count presents as the quiet chip UNDER the stack, and the centre
    //    banner never returns. (The run may drain quickly — RECORDED from before
    //    the pass, `armWitness`: a tail that stood for one frame is still seen.)
    const queue = await armWitness<QueueSeen>(page, 'bot-run-queue-tail', () => {
      const el = document.querySelector('.con-notifq') as HTMLElement | null;
      const card = document.querySelector('.con-notif');
      const tailRect = el?.getBoundingClientRect();
      return {
        tail: el === null || tailRect === undefined ? null : {
          text: el.innerText.replace(/\s+/g, ' ').trim(),
          // The tail rides INSIDE the layer column, under the card — never
          // centre stage (its box starts right of the screen's midline).
          left: Math.round(tailRect.left),
          top: Math.round(tailRect.top),
        },
        cardBottom: Math.round((card as HTMLElement | null)?.getBoundingClientRect().bottom ?? 0),
        mid: window.innerWidth / 2,
        banner: [...document.querySelectorAll('.con-banner')].some((b) => /События в очереди/i.test(b.textContent ?? '')),
      };
    }, {max: 20_000});
    await press(page, 'Comma', 900);
    await press(page, 'ArrowDown', 500); // «Пас»
    await page.keyboard.press('Enter');
    // The window ends on the tail's first stand, or 45 s of a run that formed no backlog.
    const sawTail = await queue.waitFor((v) => v.tail !== null, {timeoutMs: 45_000}).then(() => true, () => false);
    const seen = await queue.stop();
    const tailAt = seen.findIndex((s) => s.v.tail !== null);
    const beforeTail = tailAt < 0 ? seen : seen.slice(0, tailAt);
    expect(beforeTail.some((s) => s.v.banner), 'the centre-stage queue banner came back').toBe(false);
    if (sawTail) {
      await shoot(page, 'queue-tail');
      const first = seen[tailAt].v;
      const tail = {...first.tail!, cardBottom: first.cardBottom, mid: first.mid};
      console.log('[notification-premium] queue tail:', JSON.stringify(tail));
      expect(tail.text).toMatch(/\+\d+/);
      expect(tail.left, 'the tail hangs in the notification column, not centre stage').toBeGreaterThan(tail.mid);
    } else {
      console.log('[notification-premium] the bot run drained without a backlog this time — tail not exercised');
    }
  });
});

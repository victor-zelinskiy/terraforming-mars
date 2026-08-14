/*
 * A TRIGGERED EFFECT IS A STAGE OF THE PLAY THAT SET IT OFF.
 *
 * «Марсианский университет» answers a science tag the player just played —
 * including its own. Until now that question left the workspace the press was
 * made in: the hand folded on the landing beat and «ЭФФЕКТ КАРТЫ ·
 * Использовать эффект?» rose as a full-bleed band over the board, followed by a
 * discard on a freshly-opened hand and a drawn card in a fullscreen reveal.
 * One press, four unrelated-looking screens.
 *
 * The North-Star reading is one flow: «КАРТЫ В РУКЕ › МАРСИАНСКИЙ УНИВЕРСИТЕТ ›
 * ЭФФЕКТ » → «… › СБРОС КАРТЫ» → «… › ДОБОР КАРТ» → and only then does the
 * workspace leave. This probe watches that whole episode FRAME BY FRAME,
 * because every failure it guards against is a one-frame ownership question:
 * «did the workspace let go before its own effect was finished?».
 */
import {expect, test, Page} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {bootIntoGame, press, soloGameConfig} from './consoleStart';

const OUT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'effect-decision-embed');

/** ACTIVE, science tag, and its effect triggers on its OWN play («including
 *  this») — so ONE press from the hand reaches the decision. */
const MARS_UNIVERSITY = 'Mars University';
/** Filler, so the hand still holds something to discard after the play (the
 *  card's own guard returns nothing on an empty hand) and the cursor has
 *  somewhere to walk. */
const FILLER = ['Acquired Company', 'Rover Construction', 'Investment Loan'];

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/**
 * The workspace crumb's live tail — the ONE segment allowed to change.
 *
 * ⚠️ EVERY step node, not the first. The tail CROSSFADES (deliberately, never
 * `mode="out-in"` — see `ConsoleWsHead`), so the outgoing and incoming words
 * coexist for the whole transition, and reading `querySelector` there reports
 * the stage the player has just LEFT: this probe first accused the flow of
 * never naming its effect while the word was on screen beside the old one.
 */
async function crumbStages(page: Page): Promise<Array<string>> {
  return page.evaluate(() => Array.from(
    document.querySelectorAll('.con-wshead__layer--deep:not(.con-wshead__layer--out) .con-wshead__step'))
    .map((el) => (el.textContent ?? '').trim())
    .filter((t) => t !== ''));
}

test.describe('a play\'s TRIGGERED effect resolves inside the workspace it was played in', () => {
  test.setTimeout(300_000);

  test('«Марсианский университет»: decision → discard → draw, all embedded, one crumb', async ({page, request}) => {
    await bootIntoGame(page, request, {
      config: soloGameConfig({customProjectCards: [MARS_UNIVERSITY, ...FILLER]}),
      cards: [MARS_UNIVERSITY, ...FILLER],
    });

    // ── into the hand workspace and onto the card ────────────────────────
    for (let i = 0; i < 6 && await page.locator('.con-hand__frame').count() === 0; i++) {
      await press(page, 'Period', 800);
      await press(page, 'Enter', 1100);
    }
    await expect(page.locator('.con-hand__frame')).toBeVisible({timeout: 20_000});
    await expect(page.locator('.con-hand__slot').first()).toBeVisible({timeout: 20_000});
    await page.waitForTimeout(800);

    const onTarget = () => page.locator(`.con-hand__slot--selected[data-zoom-slot="${MARS_UNIVERSITY}"]`).count();
    let lastSelected = '';
    for (let i = 0; i < 60 && await onTarget() === 0; i++) {
      const selected = await page.evaluate(() =>
        document.querySelector('.con-hand__slot--selected')?.getAttribute('data-zoom-slot') ?? '');
      await press(page, selected === lastSelected && i > 0 ? 'ArrowDown' : 'ArrowRight', 260);
      lastSelected = selected;
    }
    expect(await onTarget(), `the hand cursor never reached ${MARS_UNIVERSITY}`).toBeGreaterThan(0);
    await press(page, 'Enter', 900);
    await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 20_000});
    await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 20_000});
    await page.waitForTimeout(1000);

    // ── CONFIRM, and watch the whole chain. ─────────────────────────────
    await page.keyboard.press('Enter');
    const log = {
      /** The decision presented INSIDE the hand's own outcome zone. */
      decisionEmbedded: false,
      /** …and never as a band of its own beside/over the workspace (the bug). */
      decisionStandaloneFrames: 0,
      /** The workspace was gone while the decision was up (the bug). */
      decisionOrphanFrames: 0,
      /** The discard ran on THIS workspace's own shelf, not a new screen. */
      pickedInPlace: false,
      /** The drawn card presented inside the same zone. */
      drawEmbedded: false,
      /** …never a full-bleed band or the fullscreen viewer (the bug). */
      revealStandaloneFrames: 0,
      viewerFrames: 0,
      /** The tail, in the order it was actually observed. */
      stages: [] as Array<string>,
      /** The tail WHILE each stage was on screen — read, never predicted, so
       *  nothing here depends on the interface language. */
      stageAtPlay: '',
      stageAtDecision: '',
      stageAtPick: '',
      stageAtDraw: '',
      trace: [] as Array<string>,
    };
    const noteStage = (stage: string) => {
      if (stage !== '' && stage !== log.stages[log.stages.length - 1]) {
        log.stages.push(stage);
      }
    };

    let shotDecision = false;
    let shotPick = false;
    let shotDraw = false;
    let goneStreak = 0;
    for (let i = 0; i < 160; i++) {
      const s = await page.evaluate(() => {
        const decision = document.querySelector('.con-decision');
        const reveal = document.querySelector('.con-reveal');
        const hand = document.querySelector('.con-hand__frame');
        return {
          hand: hand !== null,
          decision: decision !== null,
          decisionEmbedded: document.querySelector('.con-hand__outcome .con-decision') !== null,
          reveal: reveal !== null,
          revealEmbedded: document.querySelector('.con-hand__outcome .con-reveal') !== null,
          viewer: document.querySelector('dialog.con-zoom[open]') !== null,
          // The pick BRIDGE has borrowed the shelf — the workspace's own
          // browse layer is the picker («--stagepaused» → data-flow).
          picking: document.querySelector('.con-hand[data-flow="picking"]') !== null,
          // Whatever the pad is offering right now (a focused decision row,
          // a discardable card…).
          focusedDecisionRow: document.querySelector('.con-decision__action--focused') !== null,
          selectedCard: document.querySelector('.con-hand__slot--selected')?.getAttribute('data-zoom-slot') ?? '',
        };
      });
      const stages = await crumbStages(page);
      // The LAST node is the INCOMING word (the leaving one keeps its place
      // through its own transition) — reading anything else re-reports a stage
      // the player has already left.
      const stage = stages[stages.length - 1] ?? '';
      noteStage(stage);
      const diag = await page.evaluate(() => {
        const fn = (window as unknown as {__conColonyDiag?: () => Record<string, unknown>}).__conColonyDiag;
        const d = fn === undefined ? {} : fn();
        return {
          frames: ((d.stack ?? []) as Array<{kind: string, phase: string}>)
            .map((f) => `${f.kind}:${f.phase}`).join('+'),
          outcome: `${String(d.outcomeHost)}/${String(d.outcomeStage)}`,
          wf: String(d.wfType),
          release: String(d.lastRelease),
        };
      });
      log.trace.push(`${i} h:${s.hand ? 1 : 0} d:${s.decision ? 1 : 0}/${s.decisionEmbedded ? 'e' : '-'} ` +
        `p:${s.picking ? 1 : 0} r:${s.reveal ? 1 : 0}/${s.revealEmbedded ? 'e' : '-'} ` +
        `«${stages.join('|')}» [${diag.frames}] o:${diag.outcome} wf:${diag.wf} rel:${diag.release}`);

      if (!s.decision && !s.picking && !s.reveal && log.stageAtDecision === '') {
        log.stageAtPlay = stage; // the play's own stage, before the effect asked
      }
      if (s.decisionEmbedded) {
        log.decisionEmbedded = true;
        log.stageAtDecision = stage;
        if (!shotDecision) {
          shotDecision = true;
          // The ARRIVAL frame (the relieved tableau is still dissolving under
          // it) and the SETTLED one — the handoff is only continuous if BOTH
          // read as one surface.
          await shoot(page, 'decision-arriving');
          await page.waitForTimeout(900);
          await shoot(page, 'decision-embedded');
        }
      }
      if (s.decision && !s.decisionEmbedded) {
        log.decisionStandaloneFrames++;
      }
      if (s.decision && !s.hand) {
        log.decisionOrphanFrames++;
      }
      if (s.picking) {
        log.pickedInPlace = true;
        log.stageAtPick = stage;
        if (!shotPick) {
          shotPick = true;
          await shoot(page, 'discard-in-place');
        }
      }
      if (s.revealEmbedded) {
        log.drawEmbedded = true;
        log.stageAtDraw = stage;
        if (!shotDraw) {
          shotDraw = true;
          await shoot(page, 'draw-embedded');
        }
      }
      if (s.reveal && !s.revealEmbedded) {
        log.revealStandaloneFrames++;
      }
      if (s.reveal && s.viewer) {
        log.viewerFrames++;
      }

      if (!s.hand) {
        goneStreak++;
        if (goneStreak >= 12) {
          break;
        }
      } else {
        goneStreak = 0;
      }
      // A drives the whole chain: take the offer, discard the focused card,
      // take the drawn one. Every one of them is «A» by contract.
      if (s.focusedDecisionRow || s.picking || s.revealEmbedded) {
        await press(page, 'Enter', 800);
      } else {
        await page.waitForTimeout(250);
      }
    }
    console.log(`[mars university trace]\n${log.trace.join('\n')}`);
    console.log(`[crumb stages] ${log.stages.join(' › ')}`);

    expect(log.decisionEmbedded,
      'the triggered effect asked INSIDE the workspace the play was made in').toBeTruthy();
    expect(log.decisionStandaloneFrames,
      'the decision never stood as a band of its own').toBe(0);
    expect(log.decisionOrphanFrames,
      'the workspace never let go while its own effect was still asking').toBe(0);
    expect(log.pickedInPlace,
      'the discard ran on THIS workspace\'s shelf, not a freshly opened hand').toBeTruthy();
    expect(log.drawEmbedded,
      'the card the discard bought arrived in the same zone').toBeTruthy();
    expect(log.revealStandaloneFrames,
      'the drawn card never left for a full-bleed band').toBe(0);
    expect(log.viewerFrames,
      'no fullscreen viewer — the card is the workspace\'s, not the board\'s').toBe(0);

    // ── THE CRUMB IS ONE CONTINUOUS LINE, AND IT ONLY MOVES FORWARD ──────
    //
    // Asserted on what was READ at each stage rather than on the words
    // themselves: the tail is translated (and CSS-uppercased), so pinning it to
    // «ЭФФЕКТ» would test the RU locale file, not the flow. What the flow
    // promises is structural — every stage names itself, none of them reuses
    // another's name, and none of them is ever returned to.
    const seen = `[${log.stages.join(' › ')}]`;
    for (const [what, value] of Object.entries({
      play: log.stageAtPlay, effect: log.stageAtDecision,
      discard: log.stageAtPick, draw: log.stageAtDraw,
    })) {
      expect(value, `the tail named the ${what} stage ${seen}`).not.toBe('');
    }
    expect(new Set([log.stageAtPlay, log.stageAtDecision, log.stageAtPick, log.stageAtDraw]).size,
      `four stages, four names ${seen}`).toBe(4);
    expect(log.stages, 'the tail never returned to a stage already left')
      .toHaveLength(new Set(log.stages).size);

    // …and the flow ENDS by leaving: a finished operation is not a place to
    // come back to.
    await expect(page.locator('.con-hand__frame')).toHaveCount(0, {timeout: 60_000});
  });
});

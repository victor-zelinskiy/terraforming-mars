/*
 * WHAT ONE STYLE PASS COSTS — AND WHAT OF IT IS THE UNIVERSAL BUCKET (FREEZE ZERO · R16 —
 * docs/claude/console/freeze-zero/PLAN.md §4 · 8). A MEASUREMENT probe, env-gated (`STYLE_COST=1`), never a gate.
 *
 * The key trace probe (`console-key-trace-probe.spec.ts`, `KEY_TRACE_SELECTORS=1`) names the selectors a style pass
 * spends its matching on: the ones whose RIGHTMOST compound has no class, id or tag (`.a > *`, `[class*="x"]`,
 * `.a + *`, `:is(.a, .b)`, `:has(…)` hosts) are tried against EVERY element of every pass — Blink files them in its
 * universal bucket. This probe measures what that costs on a standing game screen:
 *
 *   1. the full style pass (every element invalidated), median of N — as the product ships;
 *   2. the same after every universal-bucket rule that matches NOTHING on this screen is taken out of the sheet
 *      (nothing the player sees changes — a rule that matches no element paints nothing): the upper bound of what
 *      re-keying those selectors can give back.
 *
 * Run: STYLE_COST=1 TM_E2E_CPU_THROTTLE=4 TM_E2E_LAPTOP_OVERRIDE=1 TM_E2E_ROOT=.e2e-<task> \
 *        npx playwright test tests/e2e/console-style-cost-probe.spec.ts --project=chromium --workers=1 --reporter=list
 */
import {test, expect} from './consoleTest';
import {bootFixtureSeats, FixtureName, settle} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

const RUN = process.env.STYLE_COST === '1';
const FIXTURE = process.env.STYLE_COST_FIXTURE ?? 'colony-trade-hub';
const OUT = path.resolve('screenshots', 'key-trace');

test.describe('what one style pass costs — the style cost probe', () => {
  test.skip(!RUN, 'opt-in: STYLE_COST=1 (a measurement, never a gate)');

  test(`style cost · ${FIXTURE}`, async ({page, request}) => {
    test.setTimeout(10 * 60_000);
    await bootFixtureSeats(page, request, FIXTURE as FixtureName, {landing: 'board'});
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);

    const result = await page.evaluate(() => {
      /** One FULL style pass: every element's style invalidated (a sheet toggled), then asked for. */
      const probeSheet = document.createElement('style');
      probeSheet.textContent = '* { --style-cost-probe: 0; }';
      const fullPass = (): number => {
        const t0 = performance.now();
        document.head.appendChild(probeSheet);
        void getComputedStyle(document.body).opacity;
        document.head.removeChild(probeSheet);
        void getComputedStyle(document.body).opacity;
        return (performance.now() - t0) / 2;
      };
      const median = (runs: number): number => {
        const samples = Array.from({length: runs}, () => fullPass()).sort((a, b) => a - b);
        return samples[Math.floor(samples.length / 2)];
      };
      /** The rightmost compound of a complex selector — what Blink buckets the rule by. */
      const rightmost = (selector: string): string => {
        let depth = 0;
        let start = 0;
        for (let i = 0; i < selector.length; i++) {
          const ch = selector[i];
          if (ch === '(' || ch === '[') {
            depth++;
          } else if (ch === ')' || ch === ']') {
            depth--;
          } else if (depth === 0 && (ch === ' ' || ch === '>' || ch === '+' || ch === '~')) {
            start = i + 1;
          }
        }
        return selector.slice(start).trim();
      };
      /** No class, id or tag to key the rule by: it is tried on every element. */
      const universal = (selector: string): boolean => {
        const compound = rightmost(selector).replace(/::[a-z-]+(\([^)]*\))?$/i, '');
        return compound === '' || /^[*[:]/.test(compound);
      };
      const splitList = (text: string): Array<string> => {
        const parts: Array<string> = [];
        let depth = 0;
        let from = 0;
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          if (ch === '(' || ch === '[') {
            depth++;
          } else if (ch === ')' || ch === ']') {
            depth--;
          } else if (ch === ',' && depth === 0) {
            parts.push(text.slice(from, i).trim());
            from = i + 1;
          }
        }
        parts.push(text.slice(from).trim());
        return parts;
      };
      const matchesNothing = (selector: string): boolean => {
        try {
          return document.querySelector(selector.replace(/::[a-z-]+(\([^)]*\))?/gi, '')) === null;
        } catch {
          return false;
        }
      };

      const elements = document.querySelectorAll('*').length;
      const before = median(31);
      let rules = 0;
      let universalRules = 0;
      let universalSelectors = 0;
      let removed = 0;
      const samples: Array<string> = [];
      const walk = (list: CSSRuleList, owner: CSSStyleSheet | CSSGroupingRule): void => {
        for (let i = list.length - 1; i >= 0; i--) {
          const rule = list[i];
          if (rule instanceof CSSStyleRule) {
            rules++;
            const parts = splitList(rule.selectorText);
            const universals = parts.filter(universal);
            universalSelectors += universals.length;
            if (universals.length === 0) {
              continue;
            }
            universalRules++;
            // Taken out only when the WHOLE rule matches nothing here: nothing on this screen changes.
            if (parts.every(universal) && parts.every(matchesNothing)) {
              if (samples.length < 40) {
                samples.push(rule.selectorText.slice(0, 140));
              }
              owner.deleteRule(i);
              removed++;
            }
          } else if ('cssRules' in rule) {
            walk((rule as CSSGroupingRule).cssRules, rule as CSSGroupingRule);
          }
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          walk(sheet.cssRules, sheet);
        } catch {
          // A sheet of another origin is not ours to read.
        }
      }
      const after = median(31);
      // 3. …and EVERY rule (whatever its bucket) that matches nothing on this screen: what is left is the cost of the
      //    rules that DO apply here — the floor no re-keying can go under.
      let removedAll = 0;
      const sweep = (list: CSSRuleList, owner: CSSStyleSheet | CSSGroupingRule): void => {
        for (let i = list.length - 1; i >= 0; i--) {
          const rule = list[i];
          if (rule instanceof CSSStyleRule) {
            if (splitList(rule.selectorText).every(matchesNothing)) {
              owner.deleteRule(i);
              removedAll++;
            }
          } else if ('cssRules' in rule) {
            sweep((rule as CSSGroupingRule).cssRules, rule as CSSGroupingRule);
          }
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          sweep(sheet.cssRules, sheet);
        } catch {
          // A sheet of another origin is not ours to read.
        }
      }
      const floor = median(31);
      return {elements, rules, universalRules, universalSelectors, removed, removedAll, before, after, floor, samples};
    });

    const lines = [
      `style cost · ${FIXTURE} · cpu ×${process.env.TM_E2E_CPU_THROTTLE ?? 1} · ${result.elements} elements`,
      `rules: ${result.rules} · with a universal-bucket selector: ${result.universalRules} (${result.universalSelectors} selectors)`,
      `ONE FULL STYLE PASS: ${result.before.toFixed(1)} ms as shipped → ${result.after.toFixed(1)} ms with the ${result.removed} universal rules that match nothing here taken out ` +
        `(${(100 * (1 - result.after / result.before)).toFixed(0)} % of the pass)`,
      `…and ${result.floor.toFixed(1)} ms with EVERY rule that matches nothing here taken out (${result.removedAll} more of ${result.rules}) — the cost of the rules that apply`,
      '── a sample of what was taken out ──',
      ...result.samples.map((selector) => `  ${selector}`),
    ];
    console.log(lines.join('\n'));
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, `style-cost-${FIXTURE}.txt`), `${lines.join('\n')}\n`);
    expect(result.rules).toBeGreaterThan(0);
  });
});

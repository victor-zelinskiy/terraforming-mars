import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * A SCENE'S FLAG IS ITS RUN'S LIFE (FREEZE ZERO, stage 3 — docs/claude/console/freeze-zero/PLAN.md § 8: «every reaction
 * and scene is a kernel scope whose end is guaranteed — a flag IS a scope's life; the pattern "a flag lowered after a
 * call that may throw" at zero by guard»).
 *
 * The nine scenes a view's commit waits for (`components/viewScenes.ts`) each said «I am playing» with a flag written
 * by hand: raised after `run.begin()`, lowered in every exit path. The path that throws before its lowering line — an
 * end skipped by an exception, a recovery that threw first — left the flag up for good: the view parked behind it, the
 * foreground held, the pad locked. The audit of 2026-11-15 found that every one of the nine could stick that way.
 *
 * Now the flag is the RUN's (`session/flowRun.ts` — `createFlowRun(label, {flag})`): raised by `begin`, lowered when
 * the run's scope ends — the flow's own end, a new run over it, the game screen leaving — and the one path that used
 * to call the module's recovery bare, the hold's `expire`, ends the run in a `finally`. This spec holds the three
 * statements for every scene of the list — a scene added to `viewScenes.ts` is read by it at once.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const VIEW_SCENES = path.join(ROOT, 'src/client/components/viewScenes.ts');

type Scene = {name: string, predicate: string, rel: string, text: string};

function scenes(): Array<Scene> {
  const list = fs.readFileSync(VIEW_SCENES, 'utf8').replace(/\r\n/g, '\n');
  const fileOf = new Map<string, string>();
  for (const m of list.matchAll(/^import \{(\w+)\} from '@\/([^']+)';$/gm)) {
    fileOf.set(m[1], `src/${m[2]}.ts`);
  }
  const out: Array<Scene> = [];
  for (const m of list.matchAll(/^ {2}\['([a-z-]+)', (\w+)\],$/gm)) {
    const rel = fileOf.get(m[2]);
    if (rel === undefined) {
      throw new Error(`viewScenes.ts: the predicate ${m[2]} of «${m[1]}» is not imported by a single-name import`);
    }
    out.push({name: m[1], predicate: m[2], rel, text: fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')});
  }
  return out;
}

/** The text of the call that opens at `open` (to its matching parenthesis). */
function callText(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') {
      depth++;
    } else if (text[i] === ')') {
      depth--;
      if (depth === 0) {
        return text.slice(open, i + 1);
      }
    }
  }
  return text.slice(open);
}

describe('the scene flag law — a view scene\'s flag is its run\'s life', () => {
  const all = scenes();

  it('reads the real list (anti-vacuous): the nine scenes a view\'s commit waits for', () => {
    expect(all.map((s) => s.name)).to.include.members([
      'energy-conversion', 'hazard-cleanup', 'trade-fleet', 'hydro-marker', 'played-hero', 'patent-sale', 'card-discard', 'tile-placement', 'nomad-move',
    ]);
    // Each predicate is the module's flag, read plainly: `return <state>.active;`.
    for (const scene of all) {
      expect(new RegExp(`export function ${scene.predicate}\\(\\): boolean \\{\\n {2}return \\w+\\.active;\\n\\}`).test(scene.text), `${scene.name}: ${scene.predicate} reads its flag`).to.eq(true);
    }
  });

  it('NO SCENE WRITES ITS FLAG BY HAND — `<state>.active = true | false` stands nowhere in a scene\'s module', () => {
    const byHand = all.flatMap((scene) => [...scene.text.matchAll(/^.*\b\w+\.active = (?:true|false)\b.*$/gm)]
      .map((m) => `${scene.rel}:${scene.text.slice(0, m.index).split('\n').length} — ${m[0].trim()}`));
    expect(byHand, 'the flag is the run\'s: `createFlowRun(label, {flag: (up) => { state.active = up; }})` — begin raises it, the run\'s end lowers it').to.deep.eq([]);
  });

  it('EVERY SCENE\'s FLAG IS A RUN\'s — `createFlowRun(…, {flag})` writes the very flag its predicate reads', () => {
    const without = all.filter((scene) => {
      const state = new RegExp(`export function ${scene.predicate}\\(\\): boolean \\{\\n {2}return (\\w+)\\.active;`).exec(scene.text)?.[1];
      return state === undefined || !new RegExp(`createFlowRun\\('[^']+', \\{[\\s\\S]{0,600}?\\bflag: \\(up\\) => \\{\\s*${state}\\.active = up;\\s*\\}`).test(scene.text);
    }).map((scene) => scene.rel);
    expect(without).to.deep.eq([]);
  });

  it('THE HOLD\'s EXPIRY ENDS THE RUN IN A `finally` — a recovery that throws leaves no flag behind', () => {
    const bare: Array<string> = [];
    for (const scene of all) {
      const at = scene.text.indexOf(`registerAnimationHoldSupplier('${scene.name}'`);
      if (at === -1) {
        bare.push(`${scene.rel}: no hold supplier named «${scene.name}»`);
        continue;
      }
      const call = callText(scene.text, scene.text.indexOf('(', at));
      if (!/\bexpire:/.test(call)) {
        bare.push(`${scene.rel}: the hold «${scene.name}» has no \`expire\``);
      } else if (!/\bfinally \{[\s\S]*?\.end\(/.test(call)) {
        bare.push(`${scene.rel}: the \`expire\` of «${scene.name}» does not end its run in a \`finally\``);
      }
    }
    expect(bare).to.deep.eq([]);
  });
});

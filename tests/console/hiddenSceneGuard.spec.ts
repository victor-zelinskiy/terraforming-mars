import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * ONE ANSWER TO «IS MY SCENE ON STAGE?» — a flow never assembles it from the stack's raw parts.
 *
 * The hidden-scene class (2026-11-05 — the Hydronetwork's stage-7 copied tile, 2454d07888, and two incidents of the
 * same week): a frame leaves the screen three ways — the park, aside for the board, the deferred plate — and each flow
 * kept its own set of flags for «is my scene hidden?». The Hydronetwork's knew two of the three: its result played
 * behind the board and the frame came back still `executing`, torn down only by the beat stall guard and the liveness
 * arbiter. The stack now answers it once (`workspaceSceneHidden` / `workspaceSceneOnStage` / `workspaceFrameOffStage`,
 * `consoleWorkspaceStack.ts`), and a new way off screen is a term THERE. This guard keeps it the only answer:
 *   ① `workspaceFrameYielded(` is the stack's own part — no file outside the stack module calls it;
 *   ② no expression combines the deferred plate (`task.deferred`) with a park / yield read — that is a hand-rolled
 *      «is the scene hidden?», the exact shape that missed a way out. An exception is a row with its reason.
 * Comments are not judged.
 */
const CLIENT = path.resolve(__dirname, '..', '..', 'src', 'client');
const STACK = path.join(CLIENT, 'console', 'consoleWorkspaceStack.ts');

/** `<file relative to src/client>:<line text fragment>` → the reason the combination is not a scene-visibility question. */
const ALLOWED_COMBINATIONS: Record<string, string> = {
  'components/console/ConsoleShell.vue|this.consoleState.task.deferred || workspaceStackCollapsed()':
    'onNotificationGoToAction: «is there anything set aside to RESTORE» — the restore door\'s own question about the whole park, not a flow asking whether its scene is visible',
};

function walk(dir: string, out: Array<string> = []): Array<string> {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|vue)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Comments blanked, newlines kept (line numbers stay true). */
function stripComments(source: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ');
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:'"`])\/\/[^\n]*/g, (m, lead: string) => lead + blank(m.slice(lead.length)));
}

const FILES = walk(CLIENT).map((file) => ({file, rel: path.relative(CLIENT, file).split(path.sep).join('/'), lines: stripComments(fs.readFileSync(file, 'utf8')).split('\n')}));

describe('hidden-scene guard — one answer to «is my scene on stage?»', () => {
  it('① `workspaceFrameYielded(` is called only inside the stack module — flows ask `workspaceSceneHidden`', () => {
    const offenders: Array<string> = [];
    for (const {file, rel, lines} of FILES) {
      if (file === STACK) {
        continue;
      }
      lines.forEach((line, i) => {
        if (/\bworkspaceFrameYielded\s*\(/.test(line)) {
          offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    expect(offenders, 'ask the stack\'s one answer (`workspaceSceneHidden(kind)` / `workspaceSceneOnStage(kind)`) instead').deep.eq([]);
  });

  it('② no expression assembles «hidden» from the deferred plate + a park / yield read (exceptions carry their reason)', () => {
    const offenders: Array<string> = [];
    const seen = new Set<string>();
    for (const {file, rel, lines} of FILES) {
      if (file === STACK) {
        continue;
      }
      lines.forEach((line, i) => {
        if (/task\.deferred/.test(line) && /\b(workspaceStackCollapsed|stackYieldedToBoard|workspaceFrameParked|workspaceFrameYielded)\s*\(/.test(line)) {
          const key = Object.keys(ALLOWED_COMBINATIONS).find((k) => {
            const [f, frag] = k.split('|');
            return f === rel && line.includes(frag);
          });
          if (key === undefined) {
            offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
          } else {
            seen.add(key);
          }
        }
      });
    }
    expect(offenders, 'a flow asks `workspaceSceneHidden(kind)` — a new way off screen is a term in the stack, never a flag here').deep.eq([]);
    expect(Object.keys(ALLOWED_COMBINATIONS).filter((k) => !seen.has(k)), 'an allowed row no longer matches — drop it').deep.eq([]);
  });

  /*
   * A FRAME LIVES ONLY WHILE ITS ANCHOR HOLDS (the Parliament field lock of 2026-11-06): a phase root off stage when its
   * phase ended was closed by nobody and came back through a return door. The phase's verb closes it in every home,
   * and both return doors ask the anchor before anything comes back.
   */
  it('③ a phase root (draft · parliament · endgame) is closed only by its phase\'s verb — `closePhaseRoot`, every home', () => {
    const offenders: Array<string> = [];
    for (const {rel, lines} of FILES) {
      lines.forEach((line, i) => {
        if (/\bcloseWorkspaceRoot\(\s*'(draft|parliament|endgame)'\s*\)/.test(line)) {
          offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    expect(offenders, 'a phase\'s root stands in the park or aside for the board too — `closeWorkspaceRoot` reaches the live stack alone').deep.eq([]);
  });

  it('④ both return doors drop a dead-anchored frame before anything comes back', () => {
    const stack = stripComments(fs.readFileSync(STACK, 'utf8'));
    for (const door of ['export function resumeStackFromBoard(', 'export function restoreWorkspaceStack(']) {
      const at = stack.indexOf(door);
      expect(at, door).to.be.greaterThan(-1);
      const body = stack.slice(at, stack.indexOf('\n}\n', at));
      expect(body, `${door} asks the anchor first`).to.match(/dropDeadAnchoredFrom\(/);
    }
  });
});

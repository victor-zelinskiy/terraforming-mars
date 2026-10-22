import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {execFileSync} from 'child_process';

/*
 * THE Z MAP OF A FLIGHT'S TWO PAINTS (T12 / CA — «жетон никогда не красится под поверхностью, на которую садится»).
 *
 * The owner's «ресурс летит ПОД панель» was a ladder nobody held: the board-born wave was demoted to 11444 for its
 * whole flight while the rail it lands on stood lifted at 11520 — and the lit layer itself (11670) stood UNDER the
 * status strip (11706) a rival's intake plaque hangs in. A runtime hit test cannot see every cover (the shade, the
 * satellite and the plaque are `pointer-events: none`), so the ladder is read off the stylesheet, every state at once:
 *
 *  · the LIT layer (`.con-transfer`) stands over every hull surface a token lands on or crosses — the rail in every
 *    state (lifted under a workspace, under the start's ceremony, in Info), the satellite, the status strip (and so a
 *    seat's plaque inside it), the command bar, the hand dock, the hand's verdict rail;
 *  · its SHADED TWIN (`.con-transfer--under`) stands under the shade and every band surface — and under the lifted
 *    rail, which is exactly why a token is HANDED OVER at the opening's edge instead of flying the whole way under;
 *  · `con-flight-to-board` (a static demotion) is declared only by a layer whose pieces never leave the board, and it
 *    says so (`data-flight-lands="board"`) — the transfer layer never carries it again.
 *
 * Compiled with the SAME `lessc` `make:css` runs (a child process — the lessDeadSelectorGuard way).
 */
type Rule = {selector: string, z: number};

function compiledRules(css: string): Array<Rule> {
  const out: Array<Rule> = [];
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = rule.exec(code)) !== null) {
    const z = /(?:^|;)\s*z-index\s*:\s*(-?\d+)/.exec(m[2]);
    if (z === null) {
      continue;
    }
    for (const raw of m[1].split(',')) {
      out.push({selector: raw.trim().replace(/\s+/g, ' '), z: Number(z[1])});
    }
  }
  return out;
}

/** The classes of a selector's SUBJECT (its last compound). */
function subjectClasses(selector: string): Array<string> {
  const last = selector.split(/\s*[\s>+~]\s*/).pop() ?? '';
  return [...last.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((c) => c[1]);
}

/** The cockpit's hull — every lit surface a token lands on or crosses on its way to one. */
const HULL = /^con-(res|res-host|res-aux|status|cmdbar|footer|handdock(__[a-z-]+)?|hand__verdictbar)$/;

describe('flightLayerZOrder — the two paints of a flight on the z map (T12 / CA)', function() {
  // The compile is the whole stylesheet (seconds; more on a loaded laptop), the last test walks every console `.vue`.
  // eslint-disable-next-line no-invalid-this
  this.timeout(60_000);
  let rules: Array<Rule> = [];

  before(() => {
    const css = execFileSync(process.execPath, [path.resolve('node_modules/less/bin/lessc'), path.resolve('src/styles/common.less')], {encoding: 'utf8', maxBuffer: 1 << 26});
    rules = compiledRules(css);
  });

  const zOf = (selector: string): number => {
    const found = rules.filter((r) => r.selector === selector);
    expect(found, `${selector} declares a z-index`).to.have.length.greaterThan(0);
    return found[found.length - 1].z;
  };

  it('the LIT layer stands over every hull surface in every state — a token lands OVER its destination\'s paint', () => {
    const lit = zOf('.con-transfer');
    const hull = rules.filter((r) => r.z > 0 && subjectClasses(r.selector).some((c) => HULL.test(c)));
    expect(hull.length, 'the hull is read (the rail lifted, the ceremony, Info, the strip, the dock …)').gte(8);
    const over = hull.filter((r) => r.z >= lit).map((r) => `${r.selector} (${r.z})`);
    expect(over, `the lit layer (${lit}) must stand over each`).deep.eq([]);
    // The states the owner's case runs through, named.
    expect(zOf('.con-root.con-root--ws-open .con-res'), 'the rail lifted under a workspace').lt(lit);
    expect(zOf('body.con-start-ceremony .con-res-host'), 'the rail under the start\'s ceremony').lt(lit);
    expect(zOf('body.con-start-ceremony .con-status'), 'the strip under the start\'s ceremony').lt(lit);
    expect(zOf('.con-status'), 'the strip a seat\'s intake plaque hangs in').lt(lit);
  });

  it('…and under every scene that takes the screen — the milestone / award ceremony, the notices', () => {
    const lit = zOf('.con-transfer');
    expect(zOf('.con-notice'), 'the notices').gt(lit);
    const ceremony = rules.filter((r) => r.z === 11720);
    expect(ceremony.length, 'the MA ceremony band (11720) is read').gt(0);
    expect(11720).gt(lit);
  });

  it('the SHADED TWIN stands under the shade, every band surface and the lifted rail — the reason the token is HANDED OVER', () => {
    const under = zOf('.con-transfer--under');
    expect(under).lt(zOf('.con-shade'));
    expect(under).lt(zOf('.con-start'));
    expect(under).lt(zOf('.con-root.con-root--ws-open .con-res-aux'));
    expect(under).lt(zOf('.con-root.con-root--ws-open .con-res'));
  });

  it('a static demotion is declared only by a layer whose pieces never leave the board — and it says so', () => {
    const dir = path.resolve('src/client/components/console');
    const vues: Array<string> = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, {withFileTypes: true})) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) {
          walk(p);
        } else if (e.name.endsWith('.vue')) {
          vues.push(p);
        }
      }
    };
    walk(dir);
    const marked: Array<string> = [];
    const undeclared: Array<string> = [];
    for (const file of vues) {
      const src = fs.readFileSync(file, 'utf8');
      const template = src.slice(0, src.indexOf('<script') < 0 ? src.length : src.indexOf('<script')).replace(/<!--[\s\S]*?-->/g, '');
      if (!/con-flight-to-board/.test(template)) {
        continue;
      }
      const name = path.basename(file);
      marked.push(name);
      if (!/data-flight-lands="board"/.test(template)) {
        undeclared.push(name);
      }
    }
    expect(marked.length, 'the board layers are read').gte(5);
    expect(marked, 'the transfer layer hands its tokens over — it never demotes the whole wave').not.include('ConsoleResourceTransferLayer.vue');
    expect(undeclared, 'a layer that demotes statically declares that its pieces land on the board').deep.eq([]);
    expect(zOf('.con-root.con-root--ws-open .con-flight-to-board')).lt(zOf('.con-shade'));
    expect(zOf('.con-root--endgame .con-flight-to-board')).lt(zOf('.con-start'));
  });
});

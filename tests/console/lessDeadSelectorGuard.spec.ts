import {expect} from 'chai';
import * as path from 'path';
import {execFileSync} from 'child_process';

/*
 * A PROFILE-SCOPED RULE THAT NAMES ITS ELEMENT WITH A SECOND `&` NEVER APPLIES (TR46, PL-198).
 *
 * Inside `html.con-profile-tv { .con-composer { … } }` the parent selector `&` is the WHOLE path
 * `html.con-profile-tv .con-composer`, so `&--play &__playcard` compiles to
 * `html.con-profile-tv .con-composer--play html.con-profile-tv .con-composer__playcard` — an `html` inside an `html`,
 * a selector no document can match. Nothing fails: the browser drops it silently and the screen keeps whatever the
 * previous rule said. PL-198 (the play composer's hero on the couch) shipped that way — the hero stayed at the
 * dialog's size while the stylesheet claimed ×1.42, and the e2e geometry probe was what caught it. Name the element by
 * its CLASS (`&--play .con-composer__playcard`), or nest it (`&--play { .con-composer__playcard { … } }`).
 *
 * The guard compiles the console's stylesheet entry with the SAME `lessc` `make:css` runs (a child process —
 * in-process `less` sees the test setup's browser globals and waits on an XHR) and lists every selector with two
 * `html` roots. The rows below are the ones that were already dead when the guard was written — each is a rule that
 * has NEVER applied on its profile, so making it live is a visual change to verify on that profile, never a free fix.
 * The list may only SHRINK: a new dead selector fails, and so does a row whose selector is gone (delete the row).
 */
const KNOWN_DEAD: ReadonlySet<string> = new Set([
  'html.con-profile-handheld .con-hand__filter html.con-profile-handheld .con-hand__filter-icon',
  'html.con-profile-tv .con-parl__step--next html.con-profile-tv .con-parl__step-node::after',
  'html.con-profile-tv .con-zoom-rules--packed html.con-profile-tv .con-zoom-rules__body',
  'html.con-profile-tv .con-zoom-rules--packed html.con-profile-tv .con-zoom-rules__group',
  'html.con-profile-tv .con-zoom-rules--packed html.con-profile-tv .con-zoom-rules__kind',
  'html.con-profile-tv .con-efx__fq--stage html.con-profile-tv .con-efx__fq-row',
  'html.con-profile-tv .con-efx__fq--stage html.con-profile-tv .con-efx__fq-value',
  'html.con-profile-tv .con-composer--play html.con-profile-tv .con-composer__playcard',
]);

/** Every selector of the compiled stylesheet that roots at `html` twice. */
function deadSelectors(css: string): Set<string> {
  const out = new Set<string>();
  const prelude = /([^{}]+)\{/g;
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let m: RegExpExecArray | null;
  while ((m = prelude.exec(code)) !== null) {
    for (const raw of m[1].split(',')) {
      const selector = raw.trim().replace(/\s+/g, ' ');
      if ((selector.match(/(^|\s)html(?=[.[:\s]|$)/g) ?? []).length >= 2) {
        out.add(selector);
      }
    }
  }
  return out;
}

describe('lessDeadSelectorGuard', () => {
  it('no compiled selector roots at `html` twice (a second `&` inside a profile block)', () => {
    const css = execFileSync(process.execPath, [path.resolve('node_modules/less/bin/lessc'), path.resolve('src/styles/common.less')], {encoding: 'utf8', maxBuffer: 1 << 26});
    const dead = deadSelectors(css);
    const fresh = [...dead].filter((s) => !KNOWN_DEAD.has(s));
    const gone = [...KNOWN_DEAD].filter((s) => !dead.has(s));
    expect(fresh, 'name the element by its CLASS (`&--mod .block__elem`), never a second `&`').to.deep.eq([]);
    expect(gone, 'a known dead selector is gone — delete its row from KNOWN_DEAD').to.deep.eq([]);
  }).timeout(60_000);
});

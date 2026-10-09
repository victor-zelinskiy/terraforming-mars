import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * THE SATELLITE'S CLASSES ARE STYLED WHERE THEY LIVE (PL-102, the TR35 walk).
 *
 * The ДОП. РЕСУРСЫ satellite (`.con-res-aux`, `ConsoleResourcePanel.vue`) is a
 * BEM block of its own beside the rail's rows (`.con-res`). PL-030's delegate
 * role badge wrote its rules (`&__rolebadge--icon`, `&__roleicon`) inside the
 * `.con-res` block — they compiled to `.con-res__rolebadge--icon`, a class no
 * element carries, and the badge the template renders as
 * `.con-res-aux__rolebadge--icon` stood unstyled: a 36 px delegate sprite
 * spilled out of the chip as an inline span (a grey blob between two chips),
 * and TR35's two fighter chips — delegates beside VP / storage — read as the
 * same thing. Nothing compiles a template class against a stylesheet, so the
 * guard does: every `con-res-aux__*` class the template names has a rule in a
 * `.con-res-aux` block (`&__x`) or a full `.con-res-aux__x` selector somewhere.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const COMPONENT = path.join(ROOT, 'src', 'client', 'components', 'console', 'ConsoleResourcePanel.vue');
const BLOCK = 'con-res-aux';

/** Every top-level-or-nested rule body whose own selector ends in `.con-res-aux` (the block's `&__…` live there). */
function blockBodies(src: string, block: string): Array<string> {
  const out: Array<string> = [];
  const head = new RegExp(`\\.${block}\\s*\\{`, 'g');
  for (const m of src.matchAll(head)) {
    const open = (m.index ?? 0) + m[0].length - 1;
    let depth = 0;
    let end = open;
    for (; end < src.length; end++) {
      if (src[end] === '{') {
        depth++;
      } else if (src[end] === '}') {
        depth--;
        if (depth === 0) {
          break;
        }
      }
    }
    out.push(src.slice(open, end));
  }
  return out;
}

function escape(s: string): string {
  return s.replace(/[-]/g, '\\-');
}

describe('the satellite\'s template classes are styled in their own block (PL-102)', () => {
  const vue = fs.readFileSync(COMPONENT, 'utf8');
  const template = vue.slice(0, vue.indexOf('<script'));
  const classes = [...new Set([...template.matchAll(/con-res-aux__[a-z0-9-]+/g)].map((m) => m[0]))];
  const styles = fs.readdirSync(path.join(ROOT, 'src', 'styles')).filter((f) => f.endsWith('.less'))
    .map((f) => fs.readFileSync(path.join(ROOT, 'src', 'styles', f), 'utf8'));
  const bodies = styles.flatMap((src) => blockBodies(src, BLOCK)).join('\n');
  const all = styles.join('\n');

  it('the template names the satellite\'s elements (anti-vacuous: the role badge and its icon among them)', () => {
    expect(classes.length).to.be.greaterThan(6);
    expect(classes).to.include.members([`${BLOCK}__rolebadge--icon`, `${BLOCK}__roleicon`, `${BLOCK}__mcbadge`]);
  });

  it('every one has a rule: `&__x` inside a `.con-res-aux` block, or a full `.con-res-aux__x` selector', () => {
    const unstyled = classes.filter((cls) => {
      const element = cls.slice(BLOCK.length);
      const nested = new RegExp(`&${escape(element)}(?![a-z0-9_-])`);
      const full = new RegExp(`\\.${escape(cls)}(?![a-z0-9_-])`);
      return !nested.test(bodies) && !full.test(all);
    });
    expect(unstyled, 'satellite classes with no rule of their own — written under another block?').to.deep.eq([]);
  });
});

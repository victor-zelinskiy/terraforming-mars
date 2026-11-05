import {expect} from 'chai';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

/**
 * A LEGAL CELL KEEPS THE FACE OF ITS TYPE (the owner on Arabia Terra, 2026-11-05: «когда доска входит в режим
 * размещения тайла, выделение клеток "бухта" пропадает»).
 *
 * The cell's TYPE layer (`board-space-type-{land|ocean|cove|volcanic-cove|…}`, the inner div of an EMPTY hex) is
 * identity only: the cove's ocean half and its divider, the reserve's water, the volcanic tint. A rule in board.less
 * zeroed its `background-image` on every `--available` cell — a leftover of the PNG hex outlines — so a cove read as
 * bare land exactly while the player was choosing where an ocean OR a land tile goes. The interaction state belongs
 * to the wrapper's `::before`; no stylesheet may strip the type layer of a candidate again.
 */
describe('the board: a candidate cell keeps its type face', () => {
  const STYLES = 'src/styles';
  const sheets = readdirSync(STYLES).filter((f) => f.endsWith('.less')).map((f) => ({file: f, text: readFileSync(join(STYLES, f), 'utf8')}));

  /** Every `selector { body }` of a sheet, comments stripped (one level is enough: the rules in question are flat). */
  function rules(text: string): Array<{selector: string, body: string}> {
    const clean = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // A Less interpolation (`@{grid-divider}` inside an inline SVG) carries braces of its own.
    const flat = clean.replace(/@\{[\w-]+\}/g, 'VAR');
    const out: Array<{selector: string, body: string}> = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    for (let m = re.exec(flat); m !== null; m = re.exec(flat)) {
      out.push({selector: m[1].trim(), body: m[2]});
    }
    return out;
  }

  it('no rule strips the type layer of an AVAILABLE cell', () => {
    const offenders: Array<string> = [];
    for (const sheet of sheets) {
      for (const rule of rules(sheet.text)) {
        // A selector that aims at the type layer of an available cell — `:not(.board-space--available)` is the
        // NON-target dim and is not one.
        const aims = rule.selector.split(',').some((sel) =>
          sel.includes('board-space-type-') && sel.replace(/:not\([^)]*\)/g, '').includes('board-space--available'));
        if (aims && /background(-image)?\s*:\s*(none|transparent)/.test(rule.body)) {
          offenders.push(`${sheet.file}: ${rule.selector.replace(/\s+/g, ' ')}`);
        }
      }
    }
    expect(offenders, 'a candidate cell must keep the face of its type').to.deep.eq([]);
  });

  it('the cove and the volcanic cove still draw their ocean half and their divider', () => {
    const board = sheets.find((s) => s.file === 'board.less')?.text ?? '';
    for (const type of ['cove', 'volcanic-cove']) {
      const rule = rules(board).find((r) => r.selector === `.board-space-type-${type}`);
      expect(rule, type).to.not.be.undefined;
      expect(rule?.body, `${type}: the half`).to.match(/<polygon points='23,1 23,50 1\.5,37\.7 1\.5,13\.3'/);
      expect(rule?.body, `${type}: the divider`).to.match(/<line x1='23' y1='1' x2='23' y2='50'/);
    }
  });
});

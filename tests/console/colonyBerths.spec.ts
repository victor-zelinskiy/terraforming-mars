import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {Color} from '../../src/common/Color';
import {ColonyBenefit} from '../../src/common/colonies/ColonyBenefit';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {colonyMetadata} from '../../src/common/colonies/ColonyMetadata';
import {Resource} from '../../src/common/Resource';
import {
  berthBuildBenefit,
  buildSiteOf,
  colonyBerthsOf,
  freeBerths,
  nextBuildSlot,
} from '../../src/client/console/colonyBuild/colonyBerths';

/*
 * THE BERTHS MODEL — the places of a colony tile as every console surface
 * draws them (docs/TURMOIL_REDUX_EXCLUSIVE_COLONY.md § the places).
 *
 * Three hosts drew «exactly three» by a literal (`v-for="idx in [0, 1, 2]"`)
 * and aimed a build at a clamp (`Math.min(cubes, 2)`): a colony built beyond
 * the printed limit (Turmoil Redux TR25 Exclusive Colony) was then drawn
 * nowhere, and its flight was aimed at a berth another cube stood in. The
 * number of places and the berth of a build are now ONE pure model — pinned
 * here — and the literal and the clamp may not come back (the scanner below
 * fails with the file and the line).
 */

const ROOT = path.join(__dirname, '..', '..');

const B: Color = 'blue';
const R: Color = 'red';

function tile(...colonies: Array<Color>) {
  return {colonies};
}

describe('colonyBerths — the places of a colony tile', () => {
  describe('colonyBerthsOf', () => {
    it('an ordinary tile reads its three printed berths — empty, taken, in order', () => {
      expect(colonyBerthsOf(tile())).deep.eq([
        {index: 0, state: 'empty', overLimit: false},
        {index: 1, state: 'empty', overLimit: false},
        {index: 2, state: 'empty', overLimit: false},
      ]);
      expect(colonyBerthsOf(tile(R, B))).deep.eq([
        {index: 0, state: 'taken', owner: R, overLimit: false},
        {index: 1, state: 'taken', owner: B, overLimit: false},
        {index: 2, state: 'empty', overLimit: false},
      ]);
      expect(colonyBerthsOf(tile(R, B, R)).map((b) => b.state)).deep.eq(['taken', 'taken', 'taken']);
    });

    it('a FOURTH cube is a fourth berth, and it lies beyond the limit', () => {
      const berths = colonyBerthsOf(tile(R, R, B, B));
      expect(berths).has.length(4);
      expect(berths[3]).deep.eq({index: 3, state: 'taken', owner: B, overLimit: true});
      expect(berths.slice(0, 3).every((b) => !b.overLimit)).is.true;
    });

    it('a door projecting into a printed berth adds no berth — it marks the one it lands in', () => {
      const berths = colonyBerthsOf(tile(R), {slot: 1});
      expect(berths.map((b) => b.state)).deep.eq(['taken', 'projected', 'empty']);
    });

    it('a door projecting BEYOND the limit opens the fourth berth before any cube stands there', () => {
      const berths = colonyBerthsOf(tile(R, R, B), {slot: 3});
      expect(berths).has.length(4);
      expect(berths[3]).deep.eq({index: 3, state: 'projected', overLimit: true});
    });

    it('a berth a cube already took is never «projected»', () => {
      expect(colonyBerthsOf(tile(R, B), {slot: 1})[1].state).eq('taken');
    });

    it('without a door a full tile shows three berths and nothing after them', () => {
      expect(colonyBerthsOf(tile(R, R, B))).has.length(3);
    });
  });

  describe('nextBuildSlot / freeBerths / buildSiteOf', () => {
    it('the berth of a build is the number of cubes — never a clamp', () => {
      expect(nextBuildSlot(tile())).eq(0);
      expect(nextBuildSlot(tile(R, B))).eq(2);
      expect(nextBuildSlot(tile(R, B, R)), 'a tile at its limit answers the fourth berth').eq(3);
    });

    it('…and the SERVER\'s projection wins while a build door stands', () => {
      expect(nextBuildSlot(tile(R, B, R), {slot: 3})).eq(3);
      expect(nextBuildSlot(tile(R), {slot: 1})).eq(1);
    });

    it('the free PRINTED berths never go negative', () => {
      expect(freeBerths(tile())).eq(3);
      expect(freeBerths(tile(R, B))).eq(1);
      expect(freeBerths(tile(R, B, R))).eq(0);
      expect(freeBerths(tile(R, B, R, B)), 'the old «3 − n» printed −1 here').eq(0);
    });

    it('the marker is read per tile', () => {
      const sites = [
        {colony: ColonyName.LUNA, slot: 3, overLimit: true, own: 1},
        {colony: ColonyName.TITAN, slot: 1, overLimit: false, own: 1},
      ];
      expect(buildSiteOf(sites, ColonyName.LUNA)).eq(sites[0]);
      expect(buildSiteOf(sites, ColonyName.CERES)).is.undefined;
      expect(buildSiteOf(undefined, ColonyName.LUNA)).is.undefined;
    });
  });

  describe('berthBuildBenefit — the bonus of ONE berth, resolved for a glyph', () => {
    const descending = colonyMetadata({
      name: ColonyName.TITANIA,
      build: {description: '', type: ColonyBenefit.GAIN_VP, quantity: [5, 3, 2]},
      trade: {description: '', type: ColonyBenefit.GAIN_RESOURCES, resource: Resource.MEGACREDITS},
      colony: {description: '', type: ColonyBenefit.GAIN_RESOURCES, resource: Resource.MEGACREDITS},
    });

    it('is a list of ONE — the glyph reads it with idx 0', () => {
      expect(berthBuildBenefit(descending, 0)).deep.eq({type: ColonyBenefit.GAIN_VP, quantity: [5], resource: undefined});
      expect(berthBuildBenefit(descending, 1).quantity).deep.eq([3]);
    });

    it('a berth beyond the printed ones draws the last printed cell — never an empty glyph', () => {
      expect(berthBuildBenefit(descending, 3).quantity).deep.eq([2]);
    });
  });

  /*
   * THE GUARD. The literal list of three and the clamp to the third berth are
   * how a surface forgets the fourth place; neither may return to a colony
   * surface. The allow-list is the frozen desktop files scheduled for deletion.
   */
  describe('the guard — no literal «three berths», no clamp, in a colony surface', () => {
    const LITERAL = /\[\s*0\s*,\s*1\s*,\s*2\s*\]/;
    const CLAMP = /Math\.min\(\s*2\s*,|Math\.min\([^()]*,\s*2\s*\)/;

    const FROZEN: ReadonlyArray<{file: string, why: string}> = [
      {file: 'src/client/components/colonies/ColonyDetailView.vue', why: 'frozen desktop — scheduled for deletion'},
    ];

    /** The colony surfaces of the console — whole files. */
    function colonyFiles(): Array<string> {
      const out: Array<string> = [];
      const walk = (dir: string, accept: (file: string) => boolean): void => {
        if (!fs.existsSync(dir)) {
          return;
        }
        for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full, accept);
          } else if (/\.(ts|vue)$/.test(entry.name) && accept(full)) {
            out.push(full);
          }
        }
      };
      const client = path.join(ROOT, 'src', 'client');
      // Every console component and module that names a colony…
      walk(path.join(client, 'components', 'console'), (file) => /colon/i.test(path.relative(client, file)));
      walk(path.join(client, 'console'), (file) => /colon/i.test(path.relative(client, file)));
      // …and the shared colony components (the legacy chip popover's tile among them).
      walk(path.join(client, 'components', 'colonies'), () => true);
      return out;
    }

    function codeLines(file: string): Array<{line: string, n: number}> {
      const raw = fs.readFileSync(file, 'utf8');
      // Comments may quote the old shape (this very law is written in them).
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
      return code.split('\n').map((line, i) => ({line: line.replace(/\/\/.*$/, ''), n: i + 1}));
    }

    it('the patterns recognise what they guard against (anti-vacuous)', () => {
      expect(LITERAL.test('<div v-for="idx in [0, 1, 2]" :key="idx"')).is.true;
      expect(LITERAL.test('return [0,1,2].map((idx) => this.ownerNameAt(idx));')).is.true;
      expect(CLAMP.test('return Math.min(this.colony.colonies.length, 2);')).is.true;
      expect(CLAMP.test('const slotIndex = Math.min(2, selected.colonies.length);')).is.true;
      expect(CLAMP.test('return Math.min(idx, this.metadata.build.quantity.length - 1);')).is.false;
      expect(CLAMP.test('return nextBuildSlot(this.colony);')).is.false;
      expect(LITERAL.test('quantity: [5, 3, 2],')).is.false;
    });

    it('every allow-listed file still exists', () => {
      expect(FROZEN.filter((f) => !fs.existsSync(path.join(ROOT, f.file))).map((f) => f.file)).deep.eq([]);
    });

    it('no colony surface draws a literal list of berths or clamps a build to the third — the offenders, by file and line', () => {
      const frozen = new Set(FROZEN.map((f) => path.join(ROOT, f.file)));
      const files = colonyFiles().filter((file) => !frozen.has(file));
      expect(files.length, 'the scan still reads the colony surfaces').to.be.greaterThan(25);
      const offenders: Array<string> = [];
      for (const file of files) {
        for (const {line, n} of codeLines(file)) {
          if (LITERAL.test(line) || CLAMP.test(line)) {
            offenders.push(`${path.relative(ROOT, file)}:${n}: ${line.trim()}`);
          }
        }
      }
      // The shell is one file for the whole console: its colony lines only.
      const shell = path.join(ROOT, 'src', 'client', 'components', 'console', 'ConsoleShell.vue');
      for (const {line, n} of codeLines(shell)) {
        if (/colon/i.test(line) && (LITERAL.test(line) || CLAMP.test(line))) {
          offenders.push(`${path.relative(ROOT, shell)}:${n}: ${line.trim()}`);
        }
      }
      expect(offenders, 'read the berths through `colonyBerthsOf` / `nextBuildSlot` (console/colonyBuild/colonyBerths.ts):\n' + offenders.join('\n')).deep.eq([]);
    });
  });
});

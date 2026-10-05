import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {ColonyBenefit} from '../../src/common/colonies/ColonyBenefit';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {buildBenefitAt, colonyMetadata, trackTop} from '../../src/common/colonies/ColonyMetadata';
import {MAX_COLONIES_PER_TILE} from '../../src/common/constants';
import {Resource} from '../../src/common/Resource';
import {ALL_COLONIES_TILES} from '../../src/server/colonies/ColonyManifest';

/*
 * THE ONE READER of a colony's build (placement) bonus — `buildBenefitAt`
 * (docs/TURMOIL_REDUX_EXCLUSIVE_COLONY.md § the build bonus).
 *
 * A tile prints its build bonus in its first cells only, and the engine used
 * to read it by the cube count as an INDEX: `build.quantity[colonies.length]`.
 * A colony placed beyond the printed cells (Turmoil Redux TR25 Exclusive
 * Colony) read `undefined` there and added `undefined` to a production track,
 * a stock or a card — state corrupted with no error. The reading is clamped to
 * the last printed cell in ONE function, and the compiler cannot be the
 * worklist (an indexed read of an array still type-checks), so this guard
 * scans the source for a raw read and fails with the file and the line; the
 * allow-list is the reader itself, the manifest export and the frozen desktop
 * files scheduled for deletion.
 */

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');

/** A RAW indexed read of the build bonus: `build.quantity[…]` off any metadata handle. */
const RAW_READ = /\bbuild\s*\.\s*quantity\s*\[/;

/** Files that may read the array directly, each with its reason. */
const ALLOWED: ReadonlyArray<{file: string, why: string}> = [
  {file: 'src/common/colonies/ColonyMetadata.ts', why: 'the reader itself'},
  {file: 'src/client/components/colonies/BuildBenefit.vue', why: 'frozen desktop — scheduled for deletion'},
];

function walk(dir: string, out: Array<string>): void {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'genfiles' || entry.name === 'node_modules') {
        continue;
      }
      walk(p, out);
    } else if (/\.(ts|vue)$/.test(entry.name)) {
      out.push(p);
    }
  }
}

describe('buildBenefitAt — the ONE reader of a tile\'s build bonus', () => {
  const base = {
    trade: {description: '', type: ColonyBenefit.GAIN_RESOURCES, resource: Resource.MEGACREDITS},
    colony: {description: '', type: ColonyBenefit.GAIN_RESOURCES, resource: Resource.MEGACREDITS},
  };
  const uniform = colonyMetadata({...base, name: ColonyName.LUNA,
    build: {description: '', type: ColonyBenefit.GAIN_PRODUCTION, quantity: [2, 2, 2], resource: Resource.MEGACREDITS}});
  const descending = colonyMetadata({...base, name: ColonyName.TITANIA,
    build: {description: '', type: ColonyBenefit.GAIN_VP, quantity: [5, 3, 2]}});

  it('reads the printed cell of a printed berth — kind, amount and resource together', () => {
    expect(buildBenefitAt(uniform, 0)).deep.eq({type: ColonyBenefit.GAIN_PRODUCTION, quantity: 2, resource: Resource.MEGACREDITS});
    expect(buildBenefitAt(descending, 0).quantity).eq(5);
    expect(buildBenefitAt(descending, 1).quantity).eq(3);
    expect(buildBenefitAt(descending, 2).quantity).eq(2);
  });

  it('a berth beyond the printed ones is paid the LAST printed cell — never `undefined`', () => {
    expect(buildBenefitAt(uniform, 3).quantity).eq(2);
    expect(buildBenefitAt(descending, 3).quantity).eq(2);
    expect(buildBenefitAt(descending, 6).quantity).eq(2);
  });

  it('is total below zero too (a defensive clamp, never a throw)', () => {
    expect(buildBenefitAt(descending, -1).quantity).eq(5);
  });

  it('a tile that declares no build quantity reads the default 1 at every berth', () => {
    const plain = colonyMetadata({...base, name: ColonyName.IO, build: {description: '', type: ColonyBenefit.GAIN_PRODUCTION, resource: Resource.HEAT}});
    expect(buildBenefitAt(plain, 0).quantity).eq(1);
    expect(buildBenefitAt(plain, 3).quantity).eq(1);
  });

  describe('the manifest\'s data — what the berths arithmetic stands on', () => {
    const tiles = ALL_COLONIES_TILES.map((entry) => new entry.Factory().metadata);

    it('every tile prints its build bonus in exactly MAX_COLONIES_PER_TILE cells', () => {
      const off = tiles.filter((m) => m.build.quantity.length !== MAX_COLONIES_PER_TILE).map((m) => `${m.name}: ${m.build.quantity.length}`);
      expect(off, 'a tile printing another number of build cells changes what «beyond the limit» means for it').deep.eq([]);
    });

    it('every track is longer than the printed limit — a cube beyond it has a cell, and the marker keeps one', () => {
      const short = tiles.filter((m) => trackTop(m) <= MAX_COLONIES_PER_TILE).map((m) => `${m.name}: top ${trackTop(m)}`);
      expect(short).deep.eq([]);
    });

    it('the sweep saw the tiles (anti-vacuous)', () => {
      expect(tiles.length).to.be.greaterThan(20);
    });
  });

  describe('the guard — no raw read of `build.quantity[…]` outside the allow-list', () => {
    it('the pattern recognises every raw-read shape (so a green scan means something)', () => {
      for (const line of [
        'this.giveBonus(player, this.metadata.build.type, this.metadata.build.quantity[this.colonies.length]);',
        'const amount = build.quantity[slotIndex] ?? 0;',
        'return this.metadata.build.quantity[idx] ?? 1;',
        '<template v-if="metadata.build.quantity[idx] === 3">',
        'return this.focusedMeta.build.quantity [this.focusedBuildSlot];',
      ]) {
        expect(RAW_READ.test(line), line).to.eq(true);
      }
      for (const line of [
        'const bonus = buildBenefitAt(this.metadata, slot);',
        'quantity: [5, 3, 2],',
        'm.build.quantity.length !== MAX_COLONIES_PER_TILE',
        'const last = build.quantity.length - 1;',
        'trade.quantity[pos] ?? 0',
      ]) {
        expect(RAW_READ.test(line), line).to.eq(false);
      }
    });

    it('every allow-listed file still exists (a deleted file leaves the list)', () => {
      const gone = ALLOWED.filter((a) => !fs.existsSync(path.join(ROOT, a.file))).map((a) => a.file);
      expect(gone).to.deep.eq([]);
    });

    it('src/ reads the build bonus through buildBenefitAt — the offenders, by file and line', () => {
      const files: Array<string> = [];
      walk(SRC, files);
      const allowed = new Set(ALLOWED.map((a) => path.join(ROOT, a.file)));
      const offenders: Array<string> = [];
      for (const file of files) {
        if (allowed.has(file)) {
          continue;
        }
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          // A comment may quote the old shape; only code is a read.
          const code = line.replace(/\/\/.*$/, '');
          if (/^\s*\*/.test(line) || /^\s*\/\*/.test(line)) {
            return;
          }
          if (RAW_READ.test(code)) {
            offenders.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
          }
        });
      }
      expect(offenders, 'read the build bonus through `buildBenefitAt(metadata, slot)` (ColonyMetadata.ts), never `build.quantity[slot]`:\n' + offenders.join('\n')).to.deep.eq([]);
    });
  });
});

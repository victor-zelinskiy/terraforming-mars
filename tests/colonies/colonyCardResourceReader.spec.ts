import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {CardResource} from '../../src/common/CardResource';
import {ColonyBenefit} from '../../src/common/colonies/ColonyBenefit';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {colonyCardResources, colonyMetadata} from '../../src/common/colonies/ColonyMetadata';
import {ALL_COLONIES_TILES} from '../../src/server/colonies/ColonyManifest';

/*
 * THE ONE READER of a colony's card resource(s) — `colonyCardResources`
 * (docs/claude/turmoil-redux-colonies.md § Vesta).
 *
 * A tile's card benefits may add ONE kind (Titan's floaters) or ONE OF
 * SEVERAL («mechs, asteroids or fighters» — the Turmoil Redux Vesta). The
 * list is declared as data (`ColonyMetadata.cardResources`, beside the
 * one-kind `cardResource`) and read through ONE function, because the
 * compiler cannot be the worklist here: a reader that keeps taking
 * `metadata.cardResource` still type-checks against a list-declaring tile —
 * it just draws ONE icon over a tile that prints three and refuses a holder
 * of the other two kinds. So this guard scans the source for a raw read and
 * fails with the file and the line; the allow-list is the reader itself, the
 * manifest export and the frozen desktop files scheduled for deletion.
 */

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');

/**
 * A RAW read of the one-kind field off colony metadata: `metadata.cardResource`,
 * `this.metadata.cardResource`, `colony.metadata.cardResource`,
 * `focusedMeta.cardResource`, `getColony(x).cardResource` / `?.cardResource`.
 * `\b` after the word keeps `.cardResources` (the list) out; a prompt marker's
 * own `meta.cardResource` (a bot attack, a resource-gain prompt) is not colony
 * metadata and is not matched.
 */
const RAW_READ = /(?:\bmetadata|\b(?:focused|colony)Meta|(?:getColony|findColony)\([^()]*\)\??)\.cardResource\b/;

/** Files that may read the field directly, each with its reason. */
const ALLOWED: ReadonlyArray<{file: string, why: string}> = [
  {file: 'src/common/colonies/ColonyMetadata.ts', why: 'the reader itself'},
  {file: 'src/server/tools/export_card_rendering.ts', why: 'the manifest export — copies both fields to genfiles/colonies.json'},
  {file: 'src/client/components/colonies/Colony.vue', why: 'frozen desktop (the /cards debug page) — scheduled for deletion'},
  {file: 'src/client/components/colonies/ColonyDetailView.vue', why: 'frozen desktop — scheduled for deletion'},
  {file: 'src/client/components/colonies/ColonyTradePaymentModal.vue', why: 'frozen desktop — scheduled for deletion'},
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

describe('colonyCardResources — the ONE reader of a tile\'s card resource(s)', () => {
  const base = {
    build: {description: '', type: ColonyBenefit.GAIN_RESOURCES, quantity: [1, 1, 1]},
    trade: {description: '', type: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: [0, 1, 1, 1, 2, 2, 3]},
    colony: {description: '', type: ColonyBenefit.GAIN_RESOURCES},
  };

  it('a one-kind tile reads as the list of one (Titan, Enceladus, Miranda — byte-identical behaviour)', () => {
    expect(colonyCardResources(colonyMetadata({...base, name: ColonyName.TITAN, cardResource: CardResource.FLOATER}))).to.deep.eq([CardResource.FLOATER]);
  });

  it('a several-kinds tile reads its declared list, in the declared order', () => {
    const meta = colonyMetadata({...base, name: ColonyName.TITAN, cardResources: [CardResource.MECH, CardResource.ASTEROID, CardResource.FIGHTER]});
    expect(colonyCardResources(meta)).to.deep.eq([CardResource.MECH, CardResource.ASTEROID, CardResource.FIGHTER]);
  });

  it('a tile whose benefits add nothing to a card reads as empty — never «any»', () => {
    expect(colonyCardResources(colonyMetadata({...base, name: ColonyName.LUNA}))).to.deep.eq([]);
    expect(colonyCardResources(colonyMetadata({...base, name: ColonyName.LUNA, cardResources: []}))).to.deep.eq([]);
  });

  it('the declared list wins over the one-kind field (a tile declares one of the two)', () => {
    const meta = colonyMetadata({...base, name: ColonyName.TITAN, cardResource: CardResource.FLOATER, cardResources: [CardResource.MECH, CardResource.ASTEROID]});
    expect(colonyCardResources(meta)).to.deep.eq([CardResource.MECH, CardResource.ASTEROID]);
  });

  it('no tile of the manifest declares both fields', () => {
    const both = ALL_COLONIES_TILES
      .map((entry) => new entry.Factory().metadata)
      .filter((m) => m.cardResource !== undefined && m.cardResources !== undefined)
      .map((m) => m.name);
    expect(both).to.deep.eq([]);
  });

  it('every card-benefit tile of the manifest names at least one kind', () => {
    const cardBenefit = (type: ColonyBenefit) => type === ColonyBenefit.ADD_RESOURCES_TO_CARD;
    const nameless = ALL_COLONIES_TILES
      .map((entry) => new entry.Factory().metadata)
      .filter((m) => {
        const trade = Array.isArray(m.trade.type) ? m.trade.type : [m.trade.type];
        return (trade.some(cardBenefit) || cardBenefit(m.build.type) || cardBenefit(m.colony.type)) && colonyCardResources(m).length === 0;
      })
      .map((m) => m.name);
    expect(nameless, 'a card benefit with no declared kind would pay «any resource»').to.deep.eq([]);
  });

  describe('the guard — no raw read of `cardResource` outside the allow-list', () => {
    it('the pattern recognises every raw-read shape (so a green scan means something)', () => {
      for (const line of [
        'const x = metadata.cardResource;',
        ':cardResource="metadata.cardResource"',
        'if (this.metadata.cardResource !== undefined) {',
        'if (colony.metadata.cardResource === card.resourceType) {',
        'const r = focusedMeta.cardResource;',
        'return getColony(this.colonyName)?.cardResource;',
        'const cardResource = getColony(name).cardResource;',
      ]) {
        expect(RAW_READ.test(line), line).to.eq(true);
      }
      for (const line of [
        'cardResources: metadata.cardResources,',
        'const kinds = colonyCardResources(this.metadata);',
        'cardResource: CardResource.FLOATER,',
        'meta.cardResources ?? meta.cardResource',
        'grant.cardResource !== undefined',
      ]) {
        expect(RAW_READ.test(line), line).to.eq(false);
      }
    });

    it('every allow-listed file still exists (a deleted file leaves the list)', () => {
      const gone = ALLOWED.filter((a) => !fs.existsSync(path.join(ROOT, a.file))).map((a) => a.file);
      expect(gone).to.deep.eq([]);
    });

    it('src/ reads the kinds through colonyCardResources — the offenders, by file and line', () => {
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
          if (RAW_READ.test(line)) {
            offenders.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
          }
        });
      }
      expect(offenders, 'read the kinds through `colonyCardResources(metadata)` (ColonyMetadata.ts), never `metadata.cardResource`:\n' + offenders.join('\n')).to.deep.eq([]);
    });
  });
});

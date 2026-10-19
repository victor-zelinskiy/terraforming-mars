import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * THE ROADS OF ACCESS ARE READ BY ONE CLIENT HELPER (TR62 Tharsis Alliance — the law's FOURTH road).
 *
 * A party's effect is the viewer's by one of four roads (`Parliament.access`): the party rules · the viewer's own
 * delegates · an ALLIANCE (the partner party stands by its printed road — effect AND card requirement) · a card's
 * grant. Before the alliance, four client sites asked `access.byDelegates ? … : 'granted'` — the «ВАШИ ЭФФЕКТЫ» tile,
 * its inner step, the resolution footer, the vote's «already yours» — and each would have called a borrowed effect
 * «granted by a card». So every WHY is read through the helpers in `consoleParliamentModel.ts` (`accessRoadOf`,
 * `heldByDelegates`, `allianceOf`, `alliancePairOf`, `grantSourcesOf`, …): the model's road fields — `byDelegates`,
 * `allied`, `alliances`, `granted` — are named in `src/client/**` ONLY by that file, and never in a `.vue`. A fifth
 * reader cannot be born silently lying about the fourth road.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const CLIENT = path.join(ROOT, 'src', 'client');
const HELPER = ['src', 'client', 'console', 'parliament', 'consoleParliamentModel.ts'].join('/');
const FIELDS = /\.(byDelegates|allied|alliances|granted)\b/;

/**
 * A `.granted` that is NOT the access model's — named, with its reason (a row that stops matching fails below).
 * The bonus-action window's own count of granted actions (`BonusActionMetaModel.granted`) has nothing to do with parties.
 */
const ALLOW: ReadonlyArray<{file: string, line: RegExp, reason: string}> = [
  {file: 'src/client/console/bonusAction.ts', line: /bonusActionMeta\(view\)\?\.granted/, reason: 'the bonus window\'s granted-actions count, not a party road'},
];

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

/** The code lines of `src` (comments dropped — a line comment, a block-comment line, an HTML comment) that name a road field. */
function codeReferences(src: string): Array<{n: number, text: string}> {
  const out: Array<{n: number, text: string}> = [];
  let inBlock = false;
  let inHtml = false;
  src.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (inBlock) {
      if (trimmed.includes('*/')) {
        inBlock = false;
      }
      return;
    }
    if (inHtml) {
      if (trimmed.includes('-->')) {
        inHtml = false;
      }
      return;
    }
    if (trimmed.startsWith('/*')) {
      inBlock = !trimmed.includes('*/');
      return;
    }
    if (trimmed.startsWith('<!--')) {
      inHtml = !trimmed.includes('-->');
      return;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
      return;
    }
    const code = line.replace(/\/\/.*$/, '');
    if (FIELDS.test(code)) {
      out.push({n: i + 1, text: code.trim()});
    }
  });
  return out;
}

describe('the roads of access are read through ONE client helper (TR62 Tharsis Alliance)', () => {
  const files = walk(CLIENT);
  const readers = files
    .map((file) => ({file: path.relative(ROOT, file).split(path.sep).join('/'), refs: codeReferences(fs.readFileSync(file, 'utf8'))}))
    .filter((entry) => entry.refs.length > 0);

  it('reads a real corpus (anti-vacuous: the helper itself names the fields)', () => {
    expect(files.length).to.be.greaterThan(500);
    expect(readers.map((r) => r.file)).to.include(HELPER);
  });

  it('`byDelegates` / `allied` / `alliances` / `granted` are named in src/client ONLY by the helper file', () => {
    const strays: Array<string> = [];
    for (const r of readers) {
      if (r.file === HELPER) {
        continue;
      }
      for (const ref of r.refs) {
        if (ALLOW.some((a) => a.file === r.file && a.line.test(ref.text))) {
          continue;
        }
        strays.push(`${r.file}:${ref.n}  ${ref.text}`);
      }
    }
    expect(strays, 'client sites reading a road of access by hand — ask `accessRoadOf` / `allianceOf` / `grantSourcesOf`').to.deep.eq([]);
  });

  it('every allow-list row still matches (a row whose line is gone is removed, never kept «just in case»)', () => {
    const dead = ALLOW.filter((a) => !readers.some((r) => r.file === a.file && r.refs.some((ref) => a.line.test(ref.text))));
    expect(dead.map((a) => a.file)).to.deep.eq([]);
  });

  it('the helper exports the readers the surfaces import', () => {
    const src = fs.readFileSync(path.join(ROOT, HELPER), 'utf8');
    for (const name of ['accessRoadOf', 'heldByDelegates', 'grantSourcesOf', 'allianceOf', 'alliancePairOf', 'alliancePartnerOf', 'allianceSourceOf', 'allianceBadgeOf', 'accessRingOf']) {
      expect(src, name).to.include(`export function ${name}(`);
    }
  });
});

import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * «ОДИН ФРЕЙМВОРК» (Turmoil Redux, 2026-10-24) — P0: a party's action and an enacted law's action are composed by THE
 * card composer (`ConsoleActionComposer`, «Действия карт»): one stage, one ACTION COMMIT, one outcome zone, one POST.
 * The second dialect — the party composer (`.con-pact`), its flow record (`partyFlow`), its submit (`submit-party`),
 * its conclusion reason (`party-owed`), its timed closing beat (`partyResult`), the migration's membership test
 * (`composesInCardComposer`) — was deleted in С5. This guard keeps it deleted: none of those names may come back into
 * the client or its styles, and a political tile key is never cast to a `CardName` (the key is a string of its own —
 * a fake CardName is how a law «became a card» to every reader that trusted the type).
 */
const ROOT = path.join(__dirname, '..', '..');
const SCAN = [path.join(ROOT, 'src', 'client'), path.join(ROOT, 'src', 'styles')];

const FORBIDDEN: ReadonlyArray<{name: string, re: RegExp}> = [
  {name: 'the party composer\'s class (.con-pact)', re: /con-pact\b/},
  {name: 'the party effects strip (.con-pfx — С1)', re: /con-pfx\b|ConsolePartyEffectsStrip/},
  {name: 'the party composer component', re: /ConsolePartyActionComposer/},
  {name: 'the party flow record', re: /\bpartyFlow\b/},
  {name: 'the party submit event', re: /submit-party|onCardActionsSubmitParty/},
  {name: 'the party conclusion reason', re: /party-owed/},
  {name: 'the party composer\'s timed result beat', re: /\bpartyResult\b|PARTY_RESULT_BEAT_MS/},
  {name: 'the migration\'s membership test', re: /composesInCardComposer|ONE_FRAMEWORK_PARTIES/},
  {name: 'a political tile key cast to CardName', re: /(?:partyTileKey|resolutionTileKey)\([^)]*\)\s+as\s+(?:unknown\s+as\s+)?CardName/},
];

function filesUnder(dir: string): Array<string> {
  const out: Array<string> = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...filesUnder(full));
    } else if (/\.(ts|vue|less)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('ONE FRAMEWORK — the party composer stays deleted (P0)', () => {
  const files = SCAN.flatMap(filesUnder);

  it('scans the client and its styles (anti-vacuous)', () => {
    expect(files.length).to.be.greaterThan(500);
    expect(files.some((f) => f.endsWith('ConsoleActionComposer.vue')), 'the card composer is in the scan').to.be.true;
  });

  for (const rule of FORBIDDEN) {
    it(`no ${rule.name}`, () => {
      const hits: Array<string> = [];
      for (const file of files) {
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        lines.forEach((line, i) => {
          if (rule.re.test(line)) {
            hits.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
          }
        });
      }
      expect(hits, hits.join('\n')).to.deep.eq([]);
    });
  }

  it('the Parliament hosts no composer of its own (src/client/components/console/parliament/*Composer*.vue)', () => {
    const dir = path.join(ROOT, 'src', 'client', 'components', 'console', 'parliament');
    expect(fs.readdirSync(dir).filter((f) => /Composer.*\.vue$/.test(f))).to.deep.eq([]);
  });

  it('the legacy files are gone', () => {
    for (const rel of [
      'src/client/components/console/parliament/ConsolePartyActionComposer.vue',
      'src/styles/console_party_action.less',
    ]) {
      expect(fs.existsSync(path.join(ROOT, rel)), rel).to.be.false;
    }
  });
});

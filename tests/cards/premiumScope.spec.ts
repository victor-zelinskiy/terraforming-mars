import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {CardName} from '../../src/common/cards/CardName';
import {PREMIUM_FACE_SCOPE_MODULES, PREMIUM_SCOPE_MODULES, inPremiumScope} from '../../src/common/cards/premiumScope';
import {PRELUDE2_CARDS_HELD_BACK} from '../../src/common/cards/prelude2Adaptation';
import {TURMOIL_REDUX_REPLACED_CLASSIC_NAMES} from '../../src/common/cards/turmoilReduxReplacements';
import {PRELUDE2_CARD_MANIFEST} from '../../src/server/cards/prelude2/Prelude2CardManifest';
import {TURMOIL_CARD_MANIFEST} from '../../src/server/cards/turmoil/TurmoilCardManifest';

/**
 * THE PREMIUM SCOPE IS ONE DEFINITION (T04 Diaspora Movement — the first classic
 * Turmoil card adapted in place). The scope is a module list with two card-level
 * exceptions: the classic Turmoil module is PART of Turmoil Redux (all 22 adapted by
 * 2026-10-25) and is in scope whole, minus the classic cards the Redux set REPLACES
 * (the replacement registry); Prelude 2 joins CARD BY CARD (since 2026-10-29) — the
 * module is in scope minus the hold-back list, temporary scaffolding that goes when
 * it empties. A hand-written module list anywhere in `src/` or `tests/` would let a
 * guard drift from the rule; this spec refuses one.
 */
describe('premium scope', () => {
  it('the modules: the premium nine, the classic Turmoil module and Prelude 2; the face adds the CEOs', () => {
    expect([...PREMIUM_SCOPE_MODULES].sort()).deep.eq(
      ['ares', 'base', 'colonies', 'corpera', 'deltaProject', 'prelude', 'prelude2', 'promo', 'turmoil', 'turmoilRedux', 'venus']);
    expect(PREMIUM_FACE_SCOPE_MODULES).deep.eq([...PREMIUM_SCOPE_MODULES, 'ceo']);
  });

  it('Prelude 2 is in scope MINUS the hold-back list — «the manifest minus the list»', () => {
    const manifest = Object.keys(PRELUDE2_CARD_MANIFEST.projectCards)
      .concat(Object.keys(PRELUDE2_CARD_MANIFEST.preludeCards), Object.keys(PRELUDE2_CARD_MANIFEST.corporationCards));
    const inScope = manifest.filter((name) => inPremiumScope({module: 'prelude2', name}));
    expect(inScope).deep.eq(manifest.filter((name) => !PRELUDE2_CARDS_HELD_BACK.has(name as CardName)));
    expect(inPremiumScope({module: 'prelude2', name: 'A Prelude 2 card that crossed'})).is.true;
    // The list is read for the Prelude 2 module ONLY.
    for (const name of PRELUDE2_CARDS_HELD_BACK) {
      expect(inPremiumScope({module: 'prelude2', name}), name).is.false;
      expect(inPremiumScope({module: 'prelude', name}), `prelude · ${name}`).is.true;
    }
  });

  it('the classic Turmoil module is in scope WHOLE, minus the replaced classic cards — «the manifest minus the replaced»', () => {
    const manifest = Object.keys(TURMOIL_CARD_MANIFEST.projectCards).concat(Object.keys(TURMOIL_CARD_MANIFEST.corporationCards));
    const inScope = manifest.filter((name) => inPremiumScope({module: 'turmoil', name}));
    expect(inScope).deep.eq(manifest.filter((name) => !TURMOIL_REDUX_REPLACED_CLASSIC_NAMES.has(name as CardName)));
    expect(inScope, '11 projects + 4 corporations adapted in place').has.length(15);
    expect(inPremiumScope({module: 'turmoil', name: 'A classic card not replaced'})).is.true;
  });

  // A REPLACED classic card never reaches a Redux table (the Redux manifest's `cardsToRemove`): it is never in scope,
  // its `:redux` replacement is.
  it('a replaced classic Turmoil card is OUT of scope for good; its replacement is in (TR71…TR77)', () => {
    for (const name of TURMOIL_REDUX_REPLACED_CLASSIC_NAMES) {
      expect(inPremiumScope({module: 'turmoil', name}), name).is.false;
    }
    expect(inPremiumScope({module: 'turmoilRedux', name: CardName.AERIAL_LENSES_REDUX})).is.true;
    expect(inPremiumScope({module: 'turmoilRedux', name: CardName.VOTE_OF_NO_CONFIDENCE_REDUX})).is.true;
  });

  it('the exception is read for the classic Turmoil module ONLY — another module card is never kept out by a name', () => {
    for (const name of TURMOIL_REDUX_REPLACED_CLASSIC_NAMES) {
      expect(inPremiumScope({module: 'turmoilRedux', name}), `turmoilRedux · ${name}`).is.true;
      expect(inPremiumScope({module: 'base', name}), `base · ${name}`).is.true;
    }
  });

  it('a module outside the list is out whatever the card; a narrowed list keeps the Turmoil exception', () => {
    expect(inPremiumScope({module: 'moon', name: CardName.ANTI_DESERTIFICATION_TECHNIQUES})).is.false;
    expect(inPremiumScope({module: 'ceo', name: CardName.ASIMOV})).is.false;
    expect(inPremiumScope({module: 'ceo', name: CardName.ASIMOV}, PREMIUM_FACE_SCOPE_MODULES)).is.true;
    const narrowed = PREMIUM_SCOPE_MODULES.filter((m) => m !== 'ares');
    expect(inPremiumScope({module: 'ares', name: CardName.CAPITAL_ARES}, narrowed)).is.false;
    expect(inPremiumScope({module: 'turmoil', name: CardName.VOTE_OF_NO_CONFIDENCE}, narrowed)).is.false;
    expect(inPremiumScope({module: 'turmoil', name: CardName.DIASPORA_MOVEMENT}, narrowed)).is.true;
    expect(inPremiumScope({module: 'prelude2', name: CardName.SPIRE}, narrowed)).is.false;
  });

  describe('no hand-written premium module list outside `premiumScope.ts`', function() {
    // Two walks over every source and spec file — seconds on a loaded machine.
    // eslint-disable-next-line no-invalid-this
    this.timeout(30_000);
    /**
     * Lists of modules that are NOT a premium scope, with the reason. A row that stops
     * matching fails too, so the allowance cannot outlive its subject.
     */
    const ALLOWED: Record<string, string> = {
      'tests/perf/seed-longgame.ts': 'the modules a synthetic long game is seeded from — a perf corpus, not a coverage scope',
      'tests/perf/seed-played-tableau.ts': 'the modules a synthetic tableau is seeded from — a perf corpus, not a coverage scope',
    };
    // Every scope list the fork ever wrote opened with the base game and the Corporate Era, on one line.
    const LITERAL = /\[\s*'base',\s*'corpera'/;
    const SELF = path.join('src', 'common', 'cards', 'premiumScope.ts');

    function walk(dir: string, out: Array<string>): void {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === 'genfiles' || entry.name === 'fixtures') {
            continue;
          }
          walk(full, out);
        } else if (/\.(ts|vue)$/.test(entry.name)) {
          out.push(full);
        }
      }
    }

    it('every module list in src/ and tests/ is the shared one', () => {
      const files: Array<string> = [];
      walk('src', files);
      walk('tests', files);
      const offenders: Array<string> = [];
      const allowedSeen = new Set<string>();
      for (const file of files) {
        if (path.normalize(file) === SELF) {
          continue;
        }
        const text = fs.readFileSync(file, 'utf8');
        if (!LITERAL.test(text)) {
          continue;
        }
        const rel = file.split(path.sep).join('/');
        if (ALLOWED[rel] !== undefined) {
          allowedSeen.add(rel);
          continue;
        }
        offenders.push(rel);
      }
      expect(offenders, `read PREMIUM_SCOPE_MODULES / inPremiumScope (src/common/cards/premiumScope.ts) instead:\n${offenders.join('\n')}`).deep.eq([]);
      expect(Object.keys(ALLOWED).filter((rel) => !allowedSeen.has(rel)), 'an allowance whose file no longer holds a list').deep.eq([]);
    });

    it('no guard declares its own Set-of-modules scope', () => {
      const files: Array<string> = [];
      walk('tests', files);
      walk('src', files);
      // The needle is assembled so this file does not match itself.
      const needle = ['new Set<GameModule>', '(['].join('');
      const offenders = files.filter((file) => fs.readFileSync(file, 'utf8').includes(needle))
        .map((file) => file.split(path.sep).join('/'));
      expect(offenders).deep.eq([]);
    });
  });
});

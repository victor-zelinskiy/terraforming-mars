import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {CardName} from '../../src/common/cards/CardName';
import {PREMIUM_FACE_SCOPE_MODULES, PREMIUM_SCOPE_MODULES, inPremiumScope} from '../../src/common/cards/premiumScope';
import {
  TURMOIL_CARDS_AWAITING_REDUX_REPLACEMENT,
  TURMOIL_CARDS_HELD_BACK_UNDER_REDUX,
  TURMOIL_CARDS_TO_ADAPT_IN_PLACE,
} from '../../src/common/cards/turmoilReduxAdaptation';
import {TURMOIL_REDUX_REPLACED_CLASSIC_NAMES} from '../../src/common/cards/turmoilReduxReplacements';
import {TURMOIL_CARD_MANIFEST} from '../../src/server/cards/turmoil/TurmoilCardManifest';
import * as serverList from '../../src/server/cards/turmoil/turmoilReduxAdaptation';

/**
 * THE PREMIUM SCOPE IS ONE DEFINITION (T04 Diaspora Movement — the first classic
 * Turmoil card adapted in place). The scope is a module list with one card-level
 * exception: the classic Turmoil module joins card by card, through the hold-back
 * list — the worklist and the scope are one object, so a card enters every premium
 * guard the moment its row leaves the list. A hand-written module list anywhere in
 * `src/` or `tests/` would let a guard drift from the rule; this spec refuses one.
 */
describe('premium scope', () => {
  it('the modules: the premium nine plus the classic Turmoil module; the face adds the CEOs', () => {
    expect([...PREMIUM_SCOPE_MODULES].sort()).deep.eq(
      ['ares', 'base', 'colonies', 'corpera', 'deltaProject', 'prelude', 'promo', 'turmoil', 'turmoilRedux', 'venus']);
    expect(PREMIUM_FACE_SCOPE_MODULES).deep.eq([...PREMIUM_SCOPE_MODULES, 'ceo']);
  });

  it('a classic Turmoil card still in the hold-back list is OUT of scope', () => {
    for (const name of TURMOIL_CARDS_HELD_BACK_UNDER_REDUX) {
      expect(inPremiumScope({module: 'turmoil', name}), name).is.false;
    }
  });

  it('a classic Turmoil card that left the list is IN scope — the scope is exactly «the manifest minus the list minus the replaced»', () => {
    const manifest = Object.keys(TURMOIL_CARD_MANIFEST.projectCards).concat(Object.keys(TURMOIL_CARD_MANIFEST.corporationCards));
    const inScope = manifest.filter((name) => inPremiumScope({module: 'turmoil', name}));
    expect(inScope).deep.eq(manifest.filter((name) =>
      !TURMOIL_CARDS_HELD_BACK_UNDER_REDUX.has(name as CardName) && !TURMOIL_REDUX_REPLACED_CLASSIC_NAMES.has(name as CardName)));
    expect(inPremiumScope({module: 'turmoil', name: 'A card that left the list'})).is.true;
  });

  // A REPLACED classic card never reaches a Redux table, whichever way it is kept out (its row, or — once its
  // `:redux` replacement is authored — the Redux manifest's `cardsToRemove`): it is never in scope, the replacement is.
  it('a replaced classic Turmoil card is OUT of scope for good — off the list too (TR71 Aerial Lenses:redux is the first)', () => {
    for (const name of TURMOIL_REDUX_REPLACED_CLASSIC_NAMES) {
      expect(inPremiumScope({module: 'turmoil', name}), name).is.false;
    }
    expect(TURMOIL_CARDS_HELD_BACK_UNDER_REDUX.has(CardName.AERIAL_LENSES), 'Aerial Lenses left the list').is.false;
    expect(inPremiumScope({module: 'turmoilRedux', name: CardName.AERIAL_LENSES_REDUX})).is.true;
  });

  it('the list is read for the classic Turmoil module ONLY — another module\'s card is never held back by a name', () => {
    for (const name of TURMOIL_CARDS_HELD_BACK_UNDER_REDUX) {
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
    // A card still held back — read from the list, never a name: each adaptation shortens it (T06 took GMO Contract out).
    const heldBack = [...TURMOIL_CARDS_HELD_BACK_UNDER_REDUX][0];
    expect(inPremiumScope({module: 'turmoil', name: heldBack}, narrowed)).is.false;
    expect(inPremiumScope({module: 'turmoil', name: 'A card that left the list'}, narrowed)).is.true;
  });

  it('the names live in `common`; the server file re-exports the SAME arrays (no second list)', () => {
    expect(serverList.TURMOIL_CARDS_TO_ADAPT_IN_PLACE).eq(TURMOIL_CARDS_TO_ADAPT_IN_PLACE);
    expect(serverList.TURMOIL_CARDS_AWAITING_REDUX_REPLACEMENT).eq(TURMOIL_CARDS_AWAITING_REDUX_REPLACEMENT);
    expect(serverList.TURMOIL_CARDS_HELD_BACK_UNDER_REDUX).eq(TURMOIL_CARDS_HELD_BACK_UNDER_REDUX);
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

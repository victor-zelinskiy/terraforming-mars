import {expect} from 'chai';
import {
  CopyRef, copyRefs, copyVocabulary, e2eFiles, e2eWrittenHooks, HookRef, hookAlive, hookRefs, indexCorpus, productCorpus,
} from './e2eContract';

/**
 * E2E LIVENESS — a spec may only wait for what the product still renders.
 *
 * THE CURSE THIS REMOVES: an e2e spec rots SILENTLY. The product renames a
 * hook or rewrites a line of copy; the unit suite, the typecheck and the lint
 * are all green, because nothing compiles against a selector string; and the
 * spec that waits for the old hook fails weeks later — as a 30 s timeout three
 * screens from the cause, in front of an agent who owns neither side and
 * spends a session on «is this red mine?». Worse, a DEAD hook inside a
 * negative check («the legacy modal never rises») or an `a, b` fallback does
 * not fail at all: it passes forever and proves nothing. Measured 2026-09-30:
 * 110 dead hooks in 70 e2e files (`data-sit-reward-state`, removed from the
 * product on 09-22, was still awaited by three Aquifer tests; `.con-botreview`
 * — never the class — sat in the driver's noise list).
 *
 * THE RULE: every `data-*` attribute and every class a spec or a driver uses
 * as a selector must still be RENDERED by the product (`src/client`,
 * `src/common`, the HTML shell — never merely styled), or be WRITTEN by the
 * e2e tree itself (a probe's own marker); and every Russian phrase a text
 * assertion waits for must still exist in the RU locale or the client. This
 * runs in `npm run test:server` — seconds, at the commit that kills the hook,
 * in front of the author who killed it. The fix is ALWAYS in the same diff:
 * point the spec at the hook that replaced it, or delete the check when the
 * thing it guarded is gone (a vacuous check is not coverage).
 *
 * `ALLOW` is for a hook that is genuinely outside the product (a third-party
 * library's DOM) — a row with its reason, and the second test fails the day a
 * row stops being needed, so the list cannot rot either.
 */

/** token → why a spec may reference it although the product does not render it. */
const ALLOW_HOOKS: Readonly<Record<string, string>> = {
};

/** phrase → why a text assertion may wait for it although no RU value or client text carries it. */
const ALLOW_COPY: Readonly<Record<string, string>> = {
};

describe('e2e liveness — specs wait only for what the product renders', () => {
  const files = e2eFiles();
  const corpus = productCorpus();
  const index = indexCorpus(corpus);
  const written = e2eWrittenHooks(files);
  /** Liveness per token, memoized — a token is referenced from many lines. */
  const aliveMemo = new Map<string, boolean>();
  const alive = (ref: HookRef): boolean => {
    const key = ref.kind + ' ' + ref.token;
    let verdict = aliveMemo.get(key);
    if (verdict === undefined) {
      verdict = hookAlive(ref, index, written);
      aliveMemo.set(key, verdict);
    }
    return verdict;
  };
  const refs: Array<HookRef> = files.flatMap((file) => hookRefs(file));

  it('reads a real contract (anti-vacuous: hundreds of hooks, a real corpus)', () => {
    expect(files.length, 'e2e files scanned').to.be.greaterThan(200);
    expect(refs.length, 'hook references found').to.be.greaterThan(1000);
    expect(corpus.length, 'product corpus characters').to.be.greaterThan(1_000_000);
  });

  it('every data-* attribute and class an e2e file waits for is still rendered by the product', () => {
    const dead = new Map<string, Array<string>>();
    for (const ref of refs) {
      if (ALLOW_HOOKS[ref.token] !== undefined || alive(ref)) {
        continue;
      }
      const key = `${ref.kind === 'attr' ? '[' + ref.token + ']' : '.' + ref.token}`;
      dead.set(key, [...(dead.get(key) ?? []), `${ref.file}:${ref.line}`]);
    }
    const report = [...dead.entries()].sort().map(([hook, where]) => `  ${hook}\n      ${where.join('\n      ')}`);
    expect(report, `${report.length} hook(s) the product no longer renders — point each spec at the hook that replaced it, or delete a check whose subject is gone:\n${report.join('\n')}\n`).deep.eq([]);
  });

  it('the hook allow-list holds only rows still needed (referenced, and still not rendered)', () => {
    const stale = Object.keys(ALLOW_HOOKS).filter((token) => {
      const uses = refs.filter((r) => r.token === token);
      return uses.length === 0 || uses.every((r) => alive(r));
    });
    expect(stale, 'remove these ALLOW_HOOKS rows').deep.eq([]);
  });

  describe('copy', () => {
    const vocabulary = copyVocabulary();
    const copy: Array<CopyRef> = files.flatMap((file) => copyRefs(file));
    const phraseMemo = new Map<string, boolean>();
    const said = (phrase: string): boolean => {
      let verdict = phraseMemo.get(phrase);
      if (verdict === undefined) {
        verdict = vocabulary.includes(phrase);
        phraseMemo.set(phrase, verdict);
      }
      return verdict;
    };

    it('reads real text assertions (anti-vacuous)', () => {
      expect(copy.length, 'Russian phrases found in text assertions').to.be.greaterThan(100);
    });

    it('every Russian phrase a text assertion waits for is still in the RU locale or the client', () => {
      const dead = copy.filter((ref) => ALLOW_COPY[ref.phrase] === undefined && !said(ref.phrase));
      const report = dead.map((ref) => `  «${ref.phrase}»  ${ref.file}:${ref.line}`);
      expect(report, `${report.length} phrase(s) the product no longer says — wait for its current copy (grep src/locales/ru), or for a hook:\n${report.join('\n')}\n`).deep.eq([]);
    });

    it('the copy allow-list holds only rows still needed', () => {
      const stale = Object.keys(ALLOW_COPY).filter((phrase) => !copy.some((ref) => ref.phrase === phrase) || said(phrase));
      expect(stale, 'remove these ALLOW_COPY rows').deep.eq([]);
    });
  });
});

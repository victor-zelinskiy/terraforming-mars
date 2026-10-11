import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {holderRoleReading, HolderRole} from '@/client/console/holderRoles';
import {stripComments, walk} from './e2eContract';

/**
 * READING PARAMS GUARD — a key with `${n}` placeholders is never printed
 * without its params (PL-160, the polish remediation iteration № 1).
 *
 * THE DEFECT CLASS. The TV printed «Потратьте ${0} отсюда: +${1}» in the
 * action composer's answered target row (the owner's photo, 2026-10-10): the
 * reading's key carries placeholders, the step's rail printed it with its
 * params, and the composer's own copy of the same row ran `$t(imp.label)` —
 * no params, a raw template on screen. A second copy of the row in the play
 * composer did the same. The fix is ONE renderer (`readingText.ts`); this
 * guard is what keeps a third copy from appearing.
 *
 * THREE CHECKS, all static or pure:
 *  1. No placeholder key is passed as a LITERAL to `$t(` / `translateText(`
 *     (a key with `${` and no params can only ever print the template).
 *  2. No `.vue` template prints a READING FIELD by hand — `$t(x.label)`,
 *     `$t(x.tail)`, `translateText(x.label)` for the reading vocabulary
 *     (`imp`, `impact`, `reading`) — the renderer is `readingText` /
 *     `readingTailText` / `readingLineText`.
 *  3. Every role reading's label has exactly as many `${n}` slots as params
 *     (and its tail as its tailParams) — the pure half, per role kind.
 */

const CLIENT = path.resolve(__dirname, '..', '..', 'src', 'client');
const PLACEHOLDER = /\$\{(\d+)\}/g;

function placeholderCount(key: string): number {
  const slots = new Set<string>();
  for (const m of key.matchAll(PLACEHOLDER)) {
    slots.add(m[1]);
  }
  return slots.size;
}

describe('readingParamsGuard — a key with ${n} is never printed without its params (PL-160)', () => {
  const files = walk(CLIENT, ['.ts', '.vue']);

  it('scans the client tree', () => {
    expect(files.length).to.be.greaterThan(100);
  });

  it('1. no placeholder key is passed as a literal to $t( / translateText( — a template with no params prints the template', () => {
    const offenders: Array<string> = [];
    const literal = /(?:\$t|translateText)\(\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1\s*\)/g;
    for (const file of files) {
      const text = stripComments(fs.readFileSync(file, 'utf8'));
      for (const m of text.matchAll(literal)) {
        if (placeholderCount(m[2]) > 0) {
          const line = text.slice(0, m.index).split('\n').length;
          offenders.push(`${path.relative(CLIENT, file)}:${line}: ${m[0]}`);
        }
      }
    }
    expect(offenders, 'print the key through translateTextWithParams / readingText with its params').to.deep.eq([]);
  });

  it('2. no template prints a reading field by hand — the renderer is readingText / readingTailText', () => {
    const offenders: Array<string> = [];
    // The reading vocabulary: the impact of a played-target step and a holder role's reading.
    const byHand = /(?:\$t|translateText)\(\s*(?:imp|impact|reading)\.(?:label|tail)\s*\)/g;
    for (const file of files.filter((f) => f.endsWith('.vue'))) {
      const text = stripComments(fs.readFileSync(file, 'utf8'));
      for (const m of text.matchAll(byHand)) {
        const line = text.slice(0, m.index).split('\n').length;
        offenders.push(`${path.relative(CLIENT, file)}:${line}: ${m[0]}`);
      }
    }
    expect(offenders, 'use readingText(imp) / readingTailText(imp) — one renderer, params always').to.deep.eq([]);
  });

  it('3. every role reading carries exactly the params its label (and its tail) needs', () => {
    const roles: Array<HolderRole> = [
      {kind: 'payment', unit: 'mechs', rate: 5, context: 'space'},
      {kind: 'delegate'},
      {kind: 'trade'},
      {kind: 'action', spend: 1, good: {kind: 'production', resource: 'plants' as never, amount: 1}},
      {kind: 'action', spend: 1, good: {kind: 'stock', resource: 'titanium' as never, amount: 2}},
      {kind: 'action', spend: 1, good: {kind: 'cards', amount: 1}},
      {kind: 'action', spend: 3, good: {kind: 'cards', amount: 2}},
      {kind: 'action', spend: 2, good: {kind: 'cards', amount: 1, tag: 'science' as never}},
      {kind: 'action', spend: 3, good: {kind: 'tr', amount: 1}},
      {kind: 'action', spend: 2, good: {kind: 'global', parameter: 'venus' as never, steps: 1}},
      {kind: 'vp', per: 1, each: 1},
      {kind: 'store'},
    ];
    for (const role of roles) {
      const reading = holderRoleReading(role);
      if (reading === undefined) {
        continue;
      }
      expect(reading.params, `${JSON.stringify(role)}: params is a list`).to.be.an('array');
      expect(reading.params.length, `${JSON.stringify(role)}: «${reading.label}» needs ${placeholderCount(reading.label)} params`).to.eq(placeholderCount(reading.label));
      if (reading.tail !== undefined) {
        expect((reading.tailParams ?? []).length, `${JSON.stringify(role)}: the tail «${reading.tail}» needs ${placeholderCount(reading.tail)} params`).to.eq(placeholderCount(reading.tail));
      }
    }
  });
});

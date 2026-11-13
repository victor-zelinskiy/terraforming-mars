import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {stripComments} from './e2eContract';

/*
 * A CARD FROM THE HAND IS CHOSEN IN THE HAND — THE DOOR IS ONE VERDICT (the owner's hard rule 2026-10-13).
 *
 * The TV photo that set the rule: «КАРТЫ В РУКЕ › МАРСИАНСКИЙ УНИВЕРСИТЕТ › ВЫБОР» over a column of thirteen card
 * NAMES. Both composers descended into every `or` option holding a question through their own flat list
 * (`sub = {kind: 'orNested'}`), and neither asked whether that question was a pick from the hand — the hand album
 * existed one call away. Now an option's door is `handPickRouting.orOptionDoor`, and this guard keeps it the ONLY road
 * into the flat nested list: the list is opened in exactly one place per composer, right behind the verdict that sends
 * a hand pick to the album instead.
 *
 * And a composer's hand pick is a PRE-SELECT: the album must not arm the discard tray (`leaving: 'none'`), or the card
 * would fly to the discard pile before the play / action was even committed.
 */

const CONSOLE = path.resolve(__dirname, '..', '..', 'src', 'client', 'components', 'console');

const COMPOSERS: ReadonlyArray<{file: string, door: string}> = [
  {file: 'ConsolePlayCardConfirm.vue', door: 'descendOrOption(c: ComposerChoice, item: ConsoleOrItem): void {'},
  {file: 'ConsoleActionComposer.vue', door: 'descendOrBranch(c: ComposerChoice, item: ConsoleOrItem): void {'},
];

/**
 * ONE reading for both forms a composer may stand in: `<script setup>` (a member is a top-level function, the
 * sub-state a ref — `sub.value = …`, `openHandPick(…)`) and the Options API one it was converted from (`this.sub = …`,
 * `this.openHandPick(…)`). The guard is about WHERE the list is opened, never about how a member is spelled.
 */
function memberNeutral(source: string): string {
  return source.replace(/\bthis\./g, '').replace(/\.value\b/g, '');
}

/** The nested list's opener, in the neutral reading. */
const OPENER = /\bsub = \{kind: 'orNested'/g;

/**
 * The body of a function declared by `signature` — up to its own closing line, at the indentation it is declared at
 * (a method of the Options form closes at the methods' indentation, a `<script setup>` function at column 0). A
 * declaration whose closing line is not found is NO body (`''` — the caller's «exists» assertion fails), never the
 * rest of the file.
 */
function methodBody(source: string, signature: string): string {
  const at = source.indexOf(signature);
  if (at === -1) {
    return '';
  }
  const indent = /^[ \t]*/.exec(source.slice(source.lastIndexOf('\n', at) + 1, at))?.[0] ?? '';
  const end = source.indexOf('\n' + indent + '}', at);
  return end === -1 ? '' : source.slice(at, end);
}

describe('the or-option door — a hand pick or a table pick inside an `or` never reaches a list of names', () => {
  for (const {file, door} of COMPOSERS) {
    const source = memberNeutral(stripComments(fs.readFileSync(path.join(CONSOLE, file), 'utf8')));

    it(`${file}: the flat nested list is opened in ONE place, behind the door verdict`, () => {
      const opens = (source.match(OPENER) ?? []).length;
      expect(opens, 'the nested list has exactly one opener').to.eq(1);
      const body = methodBody(source, door);
      expect(body, `the door method «${door}» exists`).to.not.eq('');
      const opener = body.search(OPENER);
      expect(opener, 'the opener lives inside the door method').to.be.greaterThan(-1);
      const verdict = body.indexOf('orOptionDoor(');
      expect(verdict, 'the door asks the ONE verdict').to.be.greaterThan(-1);
      expect(verdict, '…before it opens the list').to.be.lessThan(opener);
      expect(body, 'a hand verdict opens the album').to.contain('openHandPick(c, item)');
      // …and a TABLE verdict opens the embedded target step (grouped by owner) — the ONE pattern for every removal that
      // also offers MarsBot: «Хищники» / «Муравьи» from an action, «Научный прорыв» from a play. The play composer once
      // sent it to the flat list of names.
      const table = body.indexOf('openPlayedTargetStep(c, item)');
      expect(table, 'a table verdict opens the embedded target step').to.be.greaterThan(-1);
      expect(table, '…before the flat list').to.be.lessThan(opener);
    });

    it(`${file}: the composer's hand pick is a PRE-SELECT — it never arms the discard tray`, () => {
      const body = methodBody(source, 'openHandPick(c: ComposerChoice, orItem?: ConsoleOrItem): void {');
      expect(body, 'openHandPick takes the `or` option it answers').to.not.eq('');
      expect(body).to.contain('leaving: \'none\'');
      expect(body, 'the server\'s discard marker rides raw').to.match(/discard(: model\.discardPrompt|,)/);
    });
  }
});

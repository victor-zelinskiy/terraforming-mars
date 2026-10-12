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

/** The body of a method declared by `signature` — up to its own closing line at the methods' indentation. */
function methodBody(source: string, signature: string): string {
  const at = source.indexOf(signature);
  if (at === -1) {
    return '';
  }
  const end = source.indexOf('\n    },', at);
  return source.slice(at, end === -1 ? undefined : end);
}

describe('the hand-pick door — a hand pick inside an `or` never reaches a list of names', () => {
  for (const {file, door} of COMPOSERS) {
    const source = stripComments(fs.readFileSync(path.join(CONSOLE, file), 'utf8'));

    it(`${file}: the flat nested list is opened in ONE place, behind the door verdict`, () => {
      const opens = source.split('this.sub = {kind: \'orNested\'').length - 1;
      expect(opens, 'the nested list has exactly one opener').to.eq(1);
      const body = methodBody(source, door);
      expect(body, `the door method «${door}» exists`).to.not.eq('');
      expect(body, 'the opener lives inside the door method').to.contain('this.sub = {kind: \'orNested\'');
      const verdict = body.indexOf('orOptionDoor(');
      expect(verdict, 'the door asks the ONE verdict').to.be.greaterThan(-1);
      expect(verdict, '…before it opens the list').to.be.lessThan(body.indexOf('this.sub = {kind: \'orNested\''));
      expect(body, 'a hand verdict opens the album').to.contain('this.openHandPick(c, item)');
    });

    it(`${file}: the composer's hand pick is a PRE-SELECT — it never arms the discard tray`, () => {
      const body = methodBody(source, 'openHandPick(c: ComposerChoice, orItem?: ConsoleOrItem): void {');
      expect(body, 'openHandPick takes the `or` option it answers').to.not.eq('');
      expect(body).to.contain('leaving: \'none\'');
      expect(body, 'the server\'s discard marker rides raw').to.match(/discard(: model\.discardPrompt|,)/);
    });
  }
});

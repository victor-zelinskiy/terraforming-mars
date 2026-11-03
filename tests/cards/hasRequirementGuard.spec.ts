import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {hasRequirement} from '../../src/server/cards/requirements/CardsWithRequirementsRequirement';
import {hasPartyRequirement} from '../../src/server/cards/requirements/partyRequirementCards';
import {newProjectCard} from '../../src/server/createCard';
import {CardName} from '../../src/common/cards/CardName';

/**
 * «A CARD WITH A REQUIREMENT» HAS ONE READING (PL-1690, P54 Nobel Prize). The
 * phrase is printed by a search (Nobel Prize), a discard (Strategic Shift), two
 * milestones, an award, two discounts, a quest report and three MarsBot boxes —
 * and every one of them reads `hasRequirement(card)`. A second inline
 * `card.requirements.length > 0` is how two of those readers would start
 * disagreeing the day the descriptor list gains a kind that is not a
 * requirement (a footnote, a printed waiver): the guard names the line.
 *
 * Allowed: the predicate itself, and the requirement ENGINE's own list
 * (`CardRequirements.ts` — `this.requirements`, the compiled requirements, not a
 * card) and event FACTS (`fact.requirements`) — neither is a card.
 */
const ROOT = path.resolve(__dirname, '..', '..', 'src', 'server');
const PREDICATE = path.join('cards', 'requirements', 'CardsWithRequirementsRequirement.ts');
/** A card-shaped object's requirement list measured by hand: `card.` / `c.` / `x.` — anything but `this.` and `fact.`. */
const INLINE = /\b(?!this\b|fact\b)[A-Za-z_]\w*\??\.requirements\??\.length\s*(>|>=|===|!==|==|<)\s*[01]\b/;

function walk(dir: string, out: Array<string>): void {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
}

describe('hasRequirement — the ONE reading of «a card with a requirement»', () => {
  it('no server file measures a card\'s requirement list by hand', () => {
    const files: Array<string> = [];
    walk(ROOT, files);
    const offenders: Array<string> = [];
    for (const file of files) {
      const rel = path.relative(ROOT, file);
      if (rel === PREDICATE) {
        continue;
      }
      fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        if (/^\s*\*/.test(code)) {
          return; // a doc comment line
        }
        if (INLINE.test(code)) {
          offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders, `read «a card with a requirement» through hasRequirement(card):\n${offenders.join('\n')}`).deep.eq([]);
  });

  it('reads every requirement kind alike; the party kind is its subset', () => {
    const birds = newProjectCard(CardName.BIRDS)!; // oxygen
    const powerPlant = newProjectCard(CardName.POWER_PLANT)!; // none
    const metropolis = newProjectCard(CardName.CULTURAL_METROPOLIS)!; // a party
    expect(hasRequirement(birds)).is.true;
    expect(hasRequirement(powerPlant)).is.false;
    expect(hasRequirement(metropolis)).is.true;
    expect(hasPartyRequirement(metropolis)).is.true;
    expect(hasPartyRequirement(birds), 'a parameter is no party requirement').is.false;
  });
});

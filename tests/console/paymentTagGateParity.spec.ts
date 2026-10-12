import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {PaymentOptions} from '../../src/common/inputs/Payment';
import {SPENDABLE_CARD_RESOURCES} from '../../src/common/inputs/Spendable';
import {projectCardPaymentOptions} from '../../src/client/console/paymentPlan';
import {fakeCard} from '../TestingUtils';

/**
 * К-P2 (TR48) — THE TAG GATE OF A PAYMENT UNIT IS WRITTEN TWICE, AND THE TWO
 * COPIES MAY NEVER DISAGREE. «Which tag opens which lane» lives on the server
 * (`Player.paymentOptionsForCard` — the play prompt, the payment check, the
 * forecast) and in its pure client mirror (`paymentPlan.projectCardPaymentOptions`
 * — the console's panel, its default mix, the hand's tender plate). A unit whose
 * client copy opens on a tag the server refuses is a lane the submit is then
 * rejected for («Did not spend enough»); the other way round, a lane the player
 * is never offered. Every card-bound unit (and the board pair, steel and
 * titanium) is asked about every single tag, every pair of tags and no tag at
 * all, on a plain project card with no standing grant (Last Resort Ingenuity,
 * Martian Lumber Corp, Helion, Luna Trade Federation — the grants the two
 * copies take from different places on purpose are out of this question).
 * A new unit is in the sweep the day it joins `SPENDABLE_CARD_RESOURCES`.
 */
const TAGS: ReadonlyArray<Tag> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN, Tag.VENUS, Tag.PLANT, Tag.MICROBE,
  Tag.ANIMAL, Tag.CITY, Tag.MOON, Tag.MARS, Tag.WILD,
];

function tagSets(): Array<Array<Tag>> {
  const sets: Array<Array<Tag>> = [[]];
  TAGS.forEach((a, i) => {
    sets.push([a]);
    TAGS.slice(i + 1).forEach((b) => sets.push([a, b]));
  });
  return sets;
}

type Gate = keyof PaymentOptions;
const GATES: ReadonlyArray<Gate> = ['steel', 'titanium', ...SPENDABLE_CARD_RESOURCES];

describe('the tag gate of every payment unit — server ↔ client parity (К-P2)', () => {
  const [/* game */, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});

  it('the sweep is real: every card-bound unit, ≥ 100 tag sets', () => {
    expect(GATES.length).gte(SPENDABLE_CARD_RESOURCES.length + 2);
    expect(tagSets().length).gte(100);
  });

  for (const gate of GATES) {
    it(`${gate}: the server and its client mirror open on exactly the same tags`, () => {
      const disagree: Array<string> = [];
      for (const tags of tagSets()) {
        const card = fakeCard({name: `Gate ${tags.join('+') || 'none'}` as CardName, cost: 10, tags});
        const server = player.paymentOptionsForCard(card)[gate] === true;
        const client = projectCardPaymentOptions(tags, {}, undefined)[gate] === true;
        if (server !== client) {
          disagree.push(`[${tags.join(', ') || 'no tag'}] server ${server} · client ${client}`);
        }
      }
      expect(disagree, `${gate} — the two copies of the gate disagree on:\n${disagree.join('\n')}`).deep.eq([]);
    });
  }

  it('anti-vacuous: the sweep sees Supercomputer\'s lane open on a Science tag and shut without one', () => {
    expect(projectCardPaymentOptions([Tag.SCIENCE], {}, undefined).supercomputerData).eq(true);
    expect(projectCardPaymentOptions([Tag.WILD], {}, undefined).supercomputerData).eq(false);
    expect(player.paymentOptionsForCard(fakeCard({name: 'Gate science' as CardName, cost: 1, tags: [Tag.SCIENCE]})).supercomputerData).is.true;
  });
});

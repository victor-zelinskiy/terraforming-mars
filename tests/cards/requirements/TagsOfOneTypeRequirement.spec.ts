import {expect} from 'chai';
import {Card} from '../../../src/server/cards/Card';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {CardRequirements} from '../../../src/server/cards/requirements/CardRequirements';
import {TagCardRequirement, tagRequirementScore} from '../../../src/server/cards/requirements/TagCardRequirement';
import {TagsOfOneTypeRequirement} from '../../../src/server/cards/requirements/TagsOfOneTypeRequirement';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {Curator} from '../../../src/server/awards/amazonisPlanitia/Curator';
import {EarthEmbassy} from '../../../src/server/cards/moon/EarthEmbassy';
import {HabitatMarte} from '../../../src/server/cards/pathfinders/HabitatMarte';
import {Odyssey} from '../../../src/server/cards/pathfinders/Odyssey';
import {Chimera} from '../../../src/server/cards/pathfinders/Chimera';
import {IPlayer} from '../../../src/server/IPlayer';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {fakeCard} from '../../TestingUtils';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {ALL_TAGS, Tag} from '../../../src/common/cards/Tag';
import {RequirementType} from '../../../src/common/cards/RequirementType';
import {CardRequirementDescriptor, requirementType} from '../../../src/common/cards/CardRequirementDescriptor';

/**
 * «REQUIRES N TAGS OF ANY ONE TYPE» — the Turmoil Redux requirement kind (TR01
 * Supreme Expertise prints it first), pinned END TO END: the descriptor → type
 * → compiled class → the score → the rule line → the unplayable reason with its
 * honest «now». And the two readings it is built from, each ONE:
 *  · `tagRequirementScore` — the body `TagCardRequirement.getScore` had, lifted
 *    out unchanged (the yardstick below is that body verbatim), plus the event
 *    tag Odyssey leaves face up, which `Tags.count` cannot see (an event's tag
 *    is its card TYPE, never printed in `card.tags`);
 *  · `Tags.tagTypesInPlay` — Curator's vocabulary, proven against the award
 *    itself rather than copied from it.
 */
class OneTypeCard extends Card implements IProjectCard {
  constructor(descriptor: CardRequirementDescriptor = {tagsOfOneType: 10}) {
    // `Card` caches its static properties PER NAME: the name carries the descriptor.
    super({name: `Tags of one type test ${JSON.stringify(descriptor)}` as CardName, type: CardType.AUTOMATED, cost: 3, requirements: descriptor, metadata: {cardNumber: 'X00'}});
  }
}

/** `n` played cards, each printing `tags`. */
function play(player: TestPlayer, n: number, tags: Array<Tag>, type: CardType = CardType.AUTOMATED): void {
  for (let i = 0; i < n; i++) {
    player.playedCards.push(fakeCard({tags, type}));
  }
}

/** The body of `TagCardRequirement.getScore` BEFORE the extraction, verbatim — the refactor's yardstick. */
function preRefactorScore(player: IPlayer, tag: Tag, max: boolean, all: boolean): number {
  const mode = max !== true ? 'default' : 'raw-pf';
  let tagCount = player.tags.count(tag, mode);
  if (all) {
    player.opponents.forEach((p) => {
      tagCount += p.tags.count(tag, 'raw');
    });
  }
  if (tag === Tag.SCIENCE && player.hasTurmoilScienceTagBonus) {
    tagCount += 1;
  }
  return tagCount;
}

describe('TagsOfOneTypeRequirement', () => {
  describe('the descriptor → the type → the compiled requirement', () => {
    it('`{tagsOfOneType: N}` is its own requirement type and compiles to its own class with N as the count', () => {
      expect(requirementType({tagsOfOneType: 10})).eq(RequirementType.TAGS_OF_ONE_TYPE);
      const compiled = CardRequirements.compile([{tagsOfOneType: 10}]).requirements[0];
      expect(compiled).is.instanceOf(TagsOfOneTypeRequirement);
      expect(compiled.type).eq(RequirementType.TAGS_OF_ONE_TYPE);
      expect(compiled.count).eq(10);
      // `Card.populateCount` mirrors the number into `count`, as for every other kind.
      expect(new OneTypeCard().requirements).deep.eq([{tagsOfOneType: 10, count: 10}]);
    });
  });

  describe('`tagRequirementScore` — the printed tag requirement\'s one reading, extracted unchanged', () => {
    type Table = {name: string, arrange: () => TestPlayer};
    const TABLES: ReadonlyArray<Table> = [
      {name: 'an empty tableau', arrange: () => testGame(2)[1]},
      {name: 'mixed tags, a wild tag and face-down events', arrange: () => {
        const [, p1, p2] = testGame(2);
        play(p1, 2, [Tag.SCIENCE, Tag.SCIENCE]);
        play(p1, 1, [Tag.BUILDING, Tag.WILD]);
        play(p1, 2, [Tag.MARS]);
        play(p1, 1, [Tag.SPACE], CardType.EVENT);
        play(p2, 3, [Tag.SCIENCE, Tag.WILD]);
        play(p2, 1, [Tag.BUILDING]);
        return p1;
      }},
      {name: 'Earth Embassy (Moon tags count as Earth tags)', arrange: () => {
        const [, p1] = testGame(2);
        p1.playedCards.push(new EarthEmbassy());
        play(p1, 2, [Tag.MOON]);
        play(p1, 1, [Tag.EARTH]);
        return p1;
      }},
      {name: 'Habitat Marte (Mars tags count as science tags)', arrange: () => {
        const [, p1] = testGame(2);
        p1.playedCards.push(new HabitatMarte());
        play(p1, 3, [Tag.MARS]);
        play(p1, 1, [Tag.SCIENCE]);
        return p1;
      }},
      {name: 'Odyssey + Chimera (events face up, two wild tags)', arrange: () => {
        const [, p1] = testGame(2);
        p1.playedCards.push(new Odyssey(), new Chimera());
        play(p1, 2, [Tag.SPACE], CardType.EVENT);
        play(p1, 1, [Tag.PLANT]);
        return p1;
      }},
      {name: 'the classic Scientists P4 bonus', arrange: () => {
        const [, p1] = testGame(2, {turmoilExtension: true});
        p1.hasTurmoilScienceTagBonus = true;
        play(p1, 1, [Tag.SCIENCE]);
        return p1;
      }},
    ];

    for (const table of TABLES) {
      it(`${table.name}: every tag, min and max, own and all — the same number as before`, () => {
        const player = table.arrange();
        for (const tag of ALL_TAGS) {
          for (const max of [false, true]) {
            for (const all of [false, true]) {
              const before = preRefactorScore(player, tag, max, all);
              const events = tag === Tag.EVENT && player.tags.eventTagsInPlay() ? player.getPlayedEventsCount() : 0;
              expect(tagRequirementScore(player, tag, {max, all}), `${tag} max=${max} all=${all}`).eq(before + events);
              expect(new TagCardRequirement(tag, {max, all}).getScore(player), `the class asks the function: ${tag}`).eq(before + events);
            }
          }
        }
      });
    }

    it('the ONE difference: under Odyssey the face-up events show their event tag (before, `Tags.count` never saw them)', () => {
      const [, p1] = testGame(2);
      play(p1, 3, [Tag.SPACE], CardType.EVENT);
      expect(tagRequirementScore(p1, Tag.EVENT), 'face down — no event tag in play').eq(0);
      p1.playedCards.push(new Odyssey());
      expect(preRefactorScore(p1, Tag.EVENT, false, false), 'the old reading was blind to them').eq(0);
      expect(tagRequirementScore(p1, Tag.EVENT), 'three face-up events, three event tags').eq(3);
      // No printed requirement names the event tag today, so no card changes its answer.
    });
  });

  describe('the score — the MAXIMUM over the tag types, never a sum', () => {
    let player: TestPlayer;
    beforeEach(() => {
      [, player] = testGame(2);
    });

    const score = (p: IPlayer) => new TagsOfOneTypeRequirement({count: 10}).getScore(p);

    it('reads the leading type', () => {
      expect(score(player)).eq(0);
      play(player, 4, [Tag.BUILDING]);
      play(player, 7, [Tag.SCIENCE]);
      expect(score(player)).eq(7);
    });

    it('tags of different types never add up — 5 building + 5 science are 5', () => {
      play(player, 5, [Tag.BUILDING]);
      play(player, 5, [Tag.SCIENCE]);
      expect(score(player)).eq(5);
    });

    it('a card printing two tags of one type counts both', () => {
      play(player, 3, [Tag.SCIENCE, Tag.SCIENCE]);
      expect(score(player)).eq(6);
    });

    it('a wild tag joins EVERY type at once — counted once, on top of the leader', () => {
      play(player, 5, [Tag.BUILDING]);
      play(player, 3, [Tag.SCIENCE]);
      play(player, 2, [Tag.WILD]);
      expect(score(player)).eq(7);
    });

    it('wild tags alone are not a type of their own, yet stand in for one', () => {
      play(player, 3, [Tag.WILD]);
      expect(player.tags.tagTypesInPlay()).not.to.include(Tag.WILD);
      expect(score(player), 'any one type, all three wild').eq(3);
    });

    it('played events are face down — their tags, and the event tag, are not in play', () => {
      play(player, 10, [Tag.SPACE], CardType.EVENT);
      expect(score(player)).eq(0);
      expect(player.tags.tagTypesInPlay()).not.to.include(Tag.EVENT);
    });

    it('under Odyssey the events stay face up: the event tag is a type, and their printed tags count', () => {
      player.playedCards.push(new Odyssey());
      play(player, 4, [Tag.SPACE], CardType.EVENT);
      play(player, 2, [], CardType.EVENT);
      expect(player.tags.tagTypesInPlay()).to.include(Tag.EVENT);
      expect(score(player), 'six events — the event tag leads the four space tags').eq(6);
    });

    it('the clone tag is a placeholder, never a type', () => {
      play(player, 4, [Tag.CLONE]);
      expect(player.tags.tagTypesInPlay()).not.to.include(Tag.CLONE);
      expect(score(player)).eq(0);
    });
  });

  describe('the vocabulary — ONE with Curator («the most tags of any one type»)', () => {
    // For every tag, a tableau holding three cards of that tag only: Curator
    // sees the three exactly when the tag is a type of `tagTypesInPlay`, and
    // on such a tableau (no wild tag, no substitution) the requirement reads
    // the same number as the award. The event tag rides on event cards.
    for (const odyssey of [false, true]) {
      it(`${odyssey ? 'with' : 'without'} Odyssey: Curator and the requirement agree, tag by tag`, () => {
        for (const tag of ALL_TAGS) {
          const [, player] = testGame(2);
          if (odyssey) {
            player.playedCards.push(new Odyssey());
          }
          if (tag === Tag.EVENT) {
            play(player, 3, [], CardType.EVENT);
          } else {
            play(player, 3, [tag]);
          }
          const curator = new Curator().getScore(player);
          const inVocabulary = player.tags.tagTypesInPlay().includes(tag);
          expect(curator > 0, `${tag}: Curator counts it ⇔ it is a type in play`).eq(inVocabulary);
          if (tag !== Tag.WILD) {
            // A wild tag is the one place the two MODES differ (an award counts none, a requirement every one).
            expect(new TagsOfOneTypeRequirement({count: 10}).getScore(player), `${tag}: the same number`).eq(curator);
          }
        }
      });
    }
  });

  describe('on a card — playability and the reason', () => {
    let player: TestPlayer;
    let card: OneTypeCard;
    beforeEach(() => {
      [, player] = testGame(2);
      card = new OneTypeCard();
      player.cardsInHand.push(card);
      player.megaCredits = 20;
    });

    it('the unmet requirement names itself as a COUNT with the honest maximum, and restates the whole printed rule', () => {
      play(player, 7, [Tag.SCIENCE]);
      play(player, 5, [Tag.BUILDING]);
      expect(player.canPlay(card)).is.false;
      const reasons = unplayableReasons(player, card);
      expect(reasons).has.lengthOf(1);
      expect(reasons[0]).deep.include({type: 'count', message: 'Requires ${0} tags of one type', params: ['10'], current: 7, requirement: true});
      // Never `type: 'tag'`: no leading tag rides along to replace the number in the sentence.
      expect(reasons[0].tag).is.undefined;
      // FULLY_RESTATED: the surface showing the reason may hide the rule line it restates.
      expect(reasons[0].requirementKey).eq(`req:${RequirementType.TAGS_OF_ONE_TYPE}`);
    });

    it('ten of one type makes the card playable', () => {
      play(player, 10, [Tag.SCIENCE]);
      expect(player.canPlay(card)).is.true;
      expect(unplayableReasons(player, card)).deep.eq([]);
    });
  });

  describe('the rule line of the info panel', () => {
    function requirementLine(descriptor: CardRequirementDescriptor): string | undefined {
      const info = buildCardInformation(new OneTypeCard(descriptor), 'turmoilRedux');
      return info?.groups.find((g) => g.kind === 'requirements')?.blocks[0]?.text;
    }

    it('says «of any one type», plural and singular, min and max', () => {
      expect(requirementLine({tagsOfOneType: 10})).eq('Requires 10 tags of any one type.');
      expect(requirementLine({tagsOfOneType: 1})).eq('Requires 1 tag of any one type.');
      expect(requirementLine({tagsOfOneType: 2, max: true})).eq('Requires at most 2 tags of any one type.');
    });

    it('the block is linked to the requirement graphic of its own type — no tag qualifier, there is no one tag', () => {
      const info = buildCardInformation(new OneTypeCard(), 'turmoilRedux');
      const block = info?.groups.find((g) => g.kind === 'requirements')?.blocks[0];
      expect(block?.id).eq(`req:${RequirementType.TAGS_OF_ONE_TYPE}`);
      expect(block?.graphicId).eq(`req:${RequirementType.TAGS_OF_ONE_TYPE}`);
    });
  });
});

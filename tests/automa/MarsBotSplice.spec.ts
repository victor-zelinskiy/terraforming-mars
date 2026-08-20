import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {Tag} from '../../src/common/cards/Tag';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {newProjectCard} from '../../src/server/createCard';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {cast} from '../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../TestingUtils';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const B03 = BonusCardId.B03_RESEARCH_AND_DEVELOPMENT;
/** What one microbe tag of the OPPONENT'S pays the bot. */
const HUMAN_TAG_MC = 2;
/** What one microbe tag of the BOT'S OWN pays it. */
const OWN_TAG_MC = 4;

/** A live Splice game with the corporation seated. */
function spliceGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C24_SPLICE): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function bonusDeckIds(game: IGame): Array<BonusCardId> {
  return game.automa!.bonusDeck.flatMap((e) => e.kind === 'bonus' ? [e.id] : []);
}

function seededProjects(game: IGame): Array<string> {
  return game.automa!.bonusDeck.flatMap((e) => e.kind === 'project' ? [e.name as string] : []);
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

describe('MarsBot Splice (C24)', () => {
  describe('the printed card', () => {
    it('prints a plant starting tag, a Microbe priority and a matching-only seed', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C24_SPLICE);
      expect(info.original).eq(CardName.SPLICE);
      expect(info.cardNumber).eq('C24');
      expect(info.startingTags, 'the leaf is the STARTING TAG; the microbe is the priority')
        .deep.eq([Tag.PLANT]);
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.MICROBE]});
      expect(info.bonusDeckSeed).deep.eq({tag: Tag.MICROBE, count: 1, shuffle: 'matching-only'});
      expect(info.resource).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect']);
    });
  });

  describe('the SETUP box', () => {
    it('hands the bot 8 M€', () => {
      const [, , bot] = spliceGame('-sp-mc');
      // Measured against a corporation whose setup box gifts nothing, so the
      // bot's own starting money never has to be restated here.
      const [, , plainBot] = spliceGame('-sp-mc-base', MarsBotCorpId.C01_CREDICOR);
      expect(bot.megaCredits).eq(plainBot.megaCredits + 8);
    });

    it('destroys Research and Development everywhere it could be', () => {
      const [game] = spliceGame('-sp-destroy');
      expect(game.automa!.destroyedBonusCards).contains(B03);
      expect(bonusDeckIds(game)).not.contains(B03);
      expect(game.automa!.bonusDiscard).not.contains(B03);
      expect(game.automa!.actionDeck.filter((e) => e.kind === 'bonus' && e.id === B03)).is.empty;
    });

    it('seeds ONLY the microbe card — «shuffle IT», not «these cards»', () => {
      const [game] = spliceGame('-sp-seed');
      const seeded = seededProjects(game);
      expect(seeded, 'exactly one project card joined the bonus deck').has.length(1);
      expect(stat(game, 'spliceSeeded')).eq(1);
      const card = newProjectCard(seeded[0] as CardName)!;
      expect(card.tags, 'and it is the microbe one').contains(Tag.MICROBE);
    });

    it('its own starting tag is a PLANT, so the setup pays it nothing extra', () => {
      const [game] = spliceGame('-sp-owntag');
      expect(stat(game, 'spliceOwnTags'), 'no microbe was resolved at setup').eq(0);
    });

    it('another corporation destroys nothing and seeds nothing', () => {
      const [game] = spliceGame('-sp-other', MarsBotCorpId.C01_CREDICOR);
      expect(game.automa!.destroyedBonusCards).not.contains(B03);
      expect(seededProjects(game)).is.empty;
    });
  });

  describe('the EFFECT — the opponent\'s microbe tag', () => {
    it('pays the bot 2 M€ and offers the human the printed choice', () => {
      const [game, human, bot] = spliceGame('-sp-human');
      const before = bot.megaCredits;
      // A card that can HOST a microbe — the choice only exists then.
      const card = fakeCard({name: 'Ants' as CardName, tags: [Tag.MICROBE], resourceType: CardResource.MICROBE});
      human.playedCards.push(card);

      AutomaCorporations.onHumanCardPlayed(game, human, card);
      runAllActions(game);

      // The opponent's CHOICE outranks the owner's gain in the deferred queue,
      // so the bot is still owed its share while the human is being asked —
      // the engine's ordinary order for the human Splice too.
      const options = cast(human.popWaitingFor(), OrOptions);
      expect(options.options, 'M€ or a microbe on that card').has.length(2);
      options.options[0].cb(undefined); // «Add a microbe resource to this card»
      runAllActions(game);

      expect(card.resourceCount, 'the microbe landed on the card just played').eq(1);
      expect(bot.megaCredits, 'the bot took its printed share').eq(before + HUMAN_TAG_MC);
      expect(stat(game, 'spliceHumanTags')).eq(1);
      expect(stat(game, 'spliceHumanMc')).eq(HUMAN_TAG_MC);
    });

    it('a card that cannot host a microbe pays the human deterministically', () => {
      const [game, human, bot] = spliceGame('-sp-nohost');
      const before = bot.megaCredits;
      const humanBefore = human.megaCredits;
      const card = fakeCard({name: 'Bacteria' as CardName, tags: [Tag.MICROBE]});
      human.playedCards.push(card);

      AutomaCorporations.onHumanCardPlayed(game, human, card);
      runAllActions(game);

      expect(bot.megaCredits).eq(before + HUMAN_TAG_MC);
      expect(human.megaCredits, 'no choice was possible — the M€ half is the only branch')
        .eq(humanBefore + HUMAN_TAG_MC);
    });

    it('is PER TAG — the engine\'s own reading of the human Splice, unlike C21', () => {
      const [game, human, bot] = spliceGame('-sp-twotags');
      const before = bot.megaCredits;
      const card = fakeCard({name: 'DoubleMicrobe' as CardName, tags: [Tag.MICROBE, Tag.MICROBE]});
      human.playedCards.push(card);

      AutomaCorporations.onHumanCardPlayed(game, human, card);
      runAllActions(game);

      expect(bot.megaCredits, 'two tags, two payments').eq(before + 2 * HUMAN_TAG_MC);
      expect(stat(game, 'spliceHumanTags')).eq(2);
    });

    it('a card without a microbe tag pays nothing', () => {
      const [game, human, bot] = spliceGame('-sp-nomicrobe');
      const before = bot.megaCredits;
      AutomaCorporations.onHumanCardPlayed(game, human, fakeCard({name: 'Plain' as CardName, tags: [Tag.BUILDING]}));
      runAllActions(game);
      expect(bot.megaCredits).eq(before);
      expect(stat(game, 'spliceHumanTags')).eq(0);
    });

    it('another corporation collects nothing from the same card', () => {
      const [game, human, bot] = spliceGame('-sp-human-other', MarsBotCorpId.C01_CREDICOR);
      const before = bot.megaCredits;
      AutomaCorporations.onHumanCardPlayed(game, human, fakeCard({name: 'Ants2' as CardName, tags: [Tag.MICROBE]}));
      runAllActions(game);
      expect(bot.megaCredits).eq(before);
      expect(game.automa!.corpStats['spliceHumanTags']).is.undefined;
    });
  });

  describe('the EFFECT — the bot\'s own microbe tag', () => {
    it('pays the bot 4 M€ per TAG', () => {
      const [game, , bot] = spliceGame('-sp-own');
      const before = bot.megaCredits;

      AutomaResolver.resolveTag(game, Tag.MICROBE);

      expect(bot.megaCredits).eq(before + OWN_TAG_MC);
      expect(stat(game, 'spliceOwnTags')).eq(1);
      expect(stat(game, 'spliceOwnMc')).eq(OWN_TAG_MC);
    });

    it('two microbe tags on one card pay twice — tag granularity, not card', () => {
      const [game, , bot] = spliceGame('-sp-own-two');
      const before = bot.megaCredits;

      AutomaResolver.resolveTag(game, Tag.MICROBE);
      AutomaResolver.resolveTag(game, Tag.MICROBE);

      // The AMOUNT is asserted through the counter, never through raw M€: the
      // tag also ADVANCES the bio track, and a track cell can pay the bot on
      // its own (a greenery's covered bonus icon). Two different facts.
      expect(stat(game, 'spliceOwnMc')).eq(2 * OWN_TAG_MC);
      expect(stat(game, 'spliceOwnTags')).eq(2);
      expect(bot.megaCredits).is.at.least(before + 2 * OWN_TAG_MC);
    });

    it('another tag pays nothing', () => {
      const [game, , bot] = spliceGame('-sp-own-othertag');
      const before = bot.megaCredits;
      AutomaResolver.resolveTag(game, Tag.SPACE);
      expect(bot.megaCredits).eq(before);
      expect(stat(game, 'spliceOwnTags')).eq(0);
    });

    it('another corporation resolving a microbe tag gains nothing', () => {
      const [game, , bot] = spliceGame('-sp-own-other', MarsBotCorpId.C01_CREDICOR);
      const before = bot.megaCredits;
      AutomaResolver.resolveTag(game, Tag.MICROBE);
      expect(bot.megaCredits).eq(before);
      expect(game.automa!.corpStats['spliceOwnTags']).is.undefined;
    });
  });

  describe('a microbe ADVANCEMENT is also a microbe (RB-B FAQ)', () => {
    it('the Venus microbe cell pays the same 4 M€', () => {
      const [game, , bot] = spliceGame('-sp-advance');
      const before = bot.megaCredits;

      AutomaCorporations.onMicrobeAdvancement(game);

      expect(bot.megaCredits).eq(before + OWN_TAG_MC);
      expect(stat(game, 'spliceOwnTags')).eq(1);
    });

    it('a resolved microbe TAG never also comes through it — no microbe pays twice', () => {
      const [game, , bot] = spliceGame('-sp-nodouble');
      const before = bot.megaCredits;

      AutomaResolver.resolveTag(game, Tag.MICROBE);

      expect(bot.megaCredits, 'exactly ONE payment for one tag').eq(before + OWN_TAG_MC);
      expect(stat(game, 'spliceOwnTags')).eq(1);
    });

    it('another corporation is deaf to it', () => {
      const [game, , bot] = spliceGame('-sp-advance-other', MarsBotCorpId.C01_CREDICOR);
      const before = bot.megaCredits;
      AutomaCorporations.onMicrobeAdvancement(game);
      expect(bot.megaCredits).eq(before);
    });
  });

  describe('state', () => {
    it('the destroyed card, the seed and the counters survive a save/load round trip', () => {
      const [game, , bot] = spliceGame('-sp-serialize');
      const before = bot.megaCredits;
      AutomaResolver.resolveTag(game, Tag.MICROBE);
      expect(bot.megaCredits).eq(before + OWN_TAG_MC);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C24_SPLICE);
      expect(restored.automa!.destroyedBonusCards).contains(B03);
      expect(restored.automa!.corpStats['spliceOwnMc']).eq(OWN_TAG_MC);
      expect(restored.automa!.corpStats['spliceSeeded']).eq(1);
      expect(seededProjects(restored)).deep.eq(seededProjects(game));
    });

    it('the corporation is reachable through the shared registry', () => {
      const [game] = spliceGame('-sp-registry');
      expect(AutomaCorporations.activeCorp(game)?.info.id).eq(MarsBotCorpId.C24_SPLICE);
    });
  });
});

import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {newProjectCard} from '../../src/server/createCard';
import {fakeCard} from '../TestingUtils';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const B01 = BonusCardId.B01_METEOR_SHOWER;
/** What a human microbe tag costs the bot. */
const MICROBE_TOLL = 4;

/** A live Pharmacy Union game with the corporation seated. */
function pharmacyGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C21_PHARMACY_UNION): [IGame, TestPlayer, IPlayer] {
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

describe('MarsBot Pharmacy Union (C21)', () => {
  describe('the printed card', () => {
    it('prints a science starting tag, a Science priority and a matching-only seed', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C21_PHARMACY_UNION);
      expect(info.original).eq(CardName.PHARMACY_UNION);
      expect(info.cardNumber).eq('C21');
      expect(info.startingTags).deep.eq([Tag.SCIENCE]);
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.SCIENCE]});
      expect(info.bonusDeckSeed).deep.eq({tag: Tag.SCIENCE, count: 1, shuffle: 'matching-only'});
      expect(info.resource).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect']);
    });
  });

  describe('the SETUP box', () => {
    it('destroys Meteor Shower everywhere it could be', () => {
      const [game] = pharmacyGame('-pu-destroy');
      expect(game.automa!.destroyedBonusCards).contains(B01);
      expect(bonusDeckIds(game)).not.contains(B01);
      expect(game.automa!.bonusDiscard).not.contains(B01);
      expect(game.automa!.actionDeck.filter((e) => e.kind === 'bonus' && e.id === B01)).is.empty;
    });

    it('a generation-1 slot Meteor Shower already held is handed to the next bonus card', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C21_PHARMACY_UNION}, '-pu-slot');
      const automa = game.automa!;
      // Force the state the shuffle can deal: B01 IN the one bonus slot. If it
      // is not already there, SWAP it with whatever is — the same trade
      // `AutomaSetup` would have made, so no second copy is invented.
      const slot = automa.actionDeck.findIndex((e) => e.kind === 'bonus');
      const dealt = automa.actionDeck[slot];
      if (!(dealt.kind === 'bonus' && dealt.id === B01)) {
        const inBonusDeck = automa.bonusDeck.findIndex((e) => e.kind === 'bonus' && e.id === B01);
        expect(inBonusDeck, 'B01 must be somewhere in the pre-corporation state').is.greaterThan(-1);
        automa.bonusDeck[inBonusDeck] = dealt;
        automa.actionDeck[slot] = {kind: 'bonus', id: B01};
      }
      const deckSize = automa.actionDeck.length;

      game.playerIsFinishedWithResearchPhase(human);

      expect(automa.actionDeck.length, 'the deck keeps its printed size').eq(deckSize);
      expect(automa.actionDeck.filter((e) => e.kind === 'bonus'), 'still exactly one bonus card').has.length(1);
      expect(automa.actionDeck.filter((e) => e.kind === 'bonus' && e.id === B01)).is.empty;
      expect(automa.destroyedBonusCards).contains(B01);
    });

    it('seeds ONLY the science card — «shuffle IT», not «these cards»', () => {
      const [game] = pharmacyGame('-pu-seed');
      const seeded = seededProjects(game);
      expect(seeded, 'exactly one project card joined the bonus deck').has.length(1);
      expect(stat(game, 'pharmacySeeded')).eq(1);
      const card = newProjectCard(seeded[0] as CardName)!;
      expect(card.tags, 'and it is the science one').contains(Tag.SCIENCE);
    });

    it('«including this»: its own starting science tag raises TR once', () => {
      const [game] = pharmacyGame('-pu-owntag');
      expect(stat(game, 'pharmacyOwnTag')).eq(1);
      expect(stat(game, 'pharmacyTr')).is.at.least(1);
    });

    it('another corporation destroys nothing and seeds nothing', () => {
      const [game] = pharmacyGame('-pu-other', MarsBotCorpId.C01_CREDICOR);
      expect(game.automa!.destroyedBonusCards).not.contains(B01);
      expect(seededProjects(game)).is.empty;
    });
  });

  describe('the EFFECT — a human microbe tag taxes the bot', () => {
    it('costs 4 M€ when the bot can pay it', () => {
      const [game, human, bot] = pharmacyGame('-pu-toll');
      bot.megaCredits = 20;

      AutomaCorporations.onHumanCardPlayed(game, human, fakeCard({name: 'Microbes' as CardName, tags: [Tag.MICROBE]}));

      expect(bot.megaCredits).eq(20 - MICROBE_TOLL);
      expect(stat(game, 'pharmacyMicrobeTags')).eq(1);
      expect(stat(game, 'pharmacyMcLost')).eq(MICROBE_TOLL);
    });

    it('takes PARTIALLY when the bot has less — «as much as it is able to lose»', () => {
      const [game, human, bot] = pharmacyGame('-pu-partial');
      bot.megaCredits = 2;

      AutomaCorporations.onHumanCardPlayed(game, human, fakeCard({name: 'Microbes2' as CardName, tags: [Tag.MICROBE]}));

      expect(bot.megaCredits, 'everything it had').eq(0);
      expect(stat(game, 'pharmacyMcLost')).eq(2);
    });

    it('a broke bot still records the tag, and never goes negative', () => {
      const [game, human, bot] = pharmacyGame('-pu-broke');
      bot.megaCredits = 0;

      AutomaCorporations.onHumanCardPlayed(game, human, fakeCard({name: 'Microbes3' as CardName, tags: [Tag.MICROBE]}));

      expect(bot.megaCredits).eq(0);
      expect(stat(game, 'pharmacyMicrobeTags')).eq(1);
      expect(stat(game, 'pharmacyMcLost')).eq(0);
    });

    it('fires ONCE per card, even with two microbe tags — the engine\'s own reading', () => {
      const [game, human, bot] = pharmacyGame('-pu-twotags');
      bot.megaCredits = 20;

      AutomaCorporations.onHumanCardPlayed(game, human,
        fakeCard({name: 'DoubleMicrobe' as CardName, tags: [Tag.MICROBE, Tag.MICROBE]}));

      expect(bot.megaCredits, 'one card, one toll').eq(20 - MICROBE_TOLL);
      expect(stat(game, 'pharmacyMicrobeTags')).eq(1);
    });

    it('a card without a microbe tag costs nothing', () => {
      const [game, human, bot] = pharmacyGame('-pu-nomicrobe');
      bot.megaCredits = 20;
      AutomaCorporations.onHumanCardPlayed(game, human, fakeCard({name: 'Plain' as CardName, tags: [Tag.BUILDING]}));
      expect(bot.megaCredits).eq(20);
      expect(stat(game, 'pharmacyMicrobeTags')).eq(0);
    });

    it('another corporation is not taxed', () => {
      const [game, human, bot] = pharmacyGame('-pu-othercorp', MarsBotCorpId.C01_CREDICOR);
      bot.megaCredits = 20;
      AutomaCorporations.onHumanCardPlayed(game, human, fakeCard({name: 'Microbes4' as CardName, tags: [Tag.MICROBE]}));
      expect(bot.megaCredits).eq(20);
      expect(game.automa!.corpStats['pharmacyMicrobeTags']).is.undefined;
    });
  });

  describe('the EFFECT — the bot\'s own science pays it', () => {
    it('a card with a science tag raises TR one step', () => {
      const [game, , bot] = pharmacyGame('-pu-science');
      const tr = bot.terraformRating;
      const before = stat(game, 'pharmacyTr');

      AutomaCorporations.onProjectCardResolving(game, newProjectCard(CardName.SEARCH_FOR_LIFE)!);

      expect(bot.terraformRating).eq(tr + 1);
      expect(stat(game, 'pharmacyScienceCards')).eq(1);
      expect(stat(game, 'pharmacyTr')).eq(before + 1);
    });

    it('ONCE per card, however many science tags it prints', () => {
      const [game, , bot] = pharmacyGame('-pu-twoscience');
      const tr = bot.terraformRating;

      AutomaCorporations.onProjectCardResolving(game,
        fakeCard({name: 'DoubleScience' as CardName, tags: [Tag.SCIENCE, Tag.SCIENCE]}));

      expect(bot.terraformRating, 'a card with a science tag, not a science tag').eq(tr + 1);
      expect(stat(game, 'pharmacyScienceCards')).eq(1);
    });

    it('a card without a science tag pays nothing', () => {
      const [game, , bot] = pharmacyGame('-pu-noscience');
      const tr = bot.terraformRating;
      AutomaCorporations.onProjectCardResolving(game, newProjectCard(CardName.MINE)!);
      expect(bot.terraformRating).eq(tr);
      expect(stat(game, 'pharmacyScienceCards')).eq(0);
    });

    it('another corporation gets no TR for the same card', () => {
      const [game, , bot] = pharmacyGame('-pu-science-other', MarsBotCorpId.C01_CREDICOR);
      const tr = bot.terraformRating;
      AutomaCorporations.onProjectCardResolving(game, newProjectCard(CardName.SEARCH_FOR_LIFE)!);
      expect(bot.terraformRating).eq(tr);
    });
  });

  describe('state', () => {
    it('the destroyed card, the seed and the counters survive a save/load round trip', () => {
      const [game, human, bot] = pharmacyGame('-pu-serialize');
      bot.megaCredits = 10;
      AutomaCorporations.onHumanCardPlayed(game, human, fakeCard({name: 'Microbes5' as CardName, tags: [Tag.MICROBE]}));

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C21_PHARMACY_UNION);
      expect(restored.automa!.destroyedBonusCards).contains(B01);
      expect(restored.automa!.corpStats['pharmacyMcLost']).eq(MICROBE_TOLL);
      expect(restored.automa!.corpStats['pharmacyOwnTag']).eq(1);
      expect(seededProjects(restored)).deep.eq(seededProjects(game));
    });
  });
});

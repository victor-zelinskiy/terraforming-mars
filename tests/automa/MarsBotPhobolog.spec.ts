import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {AutomaResearch} from '../../src/server/automa/AutomaResearch';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {newProjectCard} from '../../src/server/createCard';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/** A live PhoboLog game with the corporation seated (setup already run). */
function phobologGame(suffix: string, options: Record<string, unknown> = {}): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation: MarsBotCorpId.C07_PHOBOLOG, ...options}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Park the space track one space below `position` so the next advance lands on it. */
function armTrack(game: IGame, position: number) {
  game.automa!.board.tracks[THARSIS_TRACK.SPACE].position = position - 1;
}

function seededProjects(game: IGame): Array<CardName> {
  return game.automa!.bonusDeck.flatMap((e) => e.kind === 'project' ? [e.name] : []);
}

describe('MarsBot PhoboLog (C07)', () => {
  describe('the printed card', () => {
    it('prints a space starting tag, the seeding rule and 4 white cubes', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C07_PHOBOLOG);
      expect(info.original).eq(CardName.PHOBOLOG);
      expect(info.cardNumber).eq('C07');
      expect(info.startingTags).deep.eq([Tag.SPACE]);
      expect(info.bonusDeckSeed).deep.eq({tag: Tag.SPACE, count: 2});
      const cubes = info.trackCubes ?? [];
      expect(cubes).has.length(4);
      expect(cubes.every((c) => c.cubeType === 'white' && c.tag === Tag.SPACE)).is.true;
      expect(cubes.map((c) => c.position)).deep.eq([7, 10, 13, 15]);
      expect(info.draftPriority).is.undefined;
      expect(info.resource).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect']);
    });
  });

  describe('the SETUP box', () => {
    it('reveals project cards until TWO carry a space tag and shuffles them all in', () => {
      const [game] = phobologGame('-pl-seed');
      const seeded = seededProjects(game);
      expect(seeded.length, 'at least the two space cards').is.at.least(2);
      expect(game.automa!.corpStats['phobologSeeded']).eq(seeded.length);
      // Exactly two of them carry a space tag — the reveal stopped on the second.
      const spaceCards = seeded.filter((name) => newProjectCard(name)!.tags.includes(Tag.SPACE));
      expect(spaceCards, 'the reveal stopped at the second space card').has.length(2);
      const last = newProjectCard(seeded[seeded.length - 1]!);
      expect(seeded.every((name) => name !== undefined)).is.true;
      expect(last).is.not.undefined;
    });

    it('seeds the cubes on the space track', () => {
      const [game] = phobologGame('-pl-cubes');
      const cubes = AutomaCorporations.cubesOf(game);
      expect(cubes).has.length(4);
      expect(cubes.every((c) => c.trackIndex === THARSIS_TRACK.SPACE && c.cubeType === 'white')).is.true;
      expect(cubes.map((c) => c.position).sort((a, b) => a - b)).deep.eq([7, 10, 13, 15]);
    });

    it('another corporation seeds nothing into the bonus deck', () => {
      const [game] = phobologGame('-pl-none', {corporation: MarsBotCorpId.C01_CREDICOR});
      expect(seededProjects(game)).is.empty;
      expect(AutomaCorporations.cubesOf(game)).is.empty;
    });
  });

  describe('the EFFECT — a white cube draws from the bonus deck', () => {
    it('resolves a PROJECT card that was seeded into the deck', () => {
      const [game] = phobologGame('-pl-project');
      const automa = game.automa!;
      automa.bonusDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
      const playedBefore = automa.playedPile.length;
      armTrack(game, 7);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(automa.playedPile, 'the project card was played').contains(CardName.GENE_REPAIR);
      expect(automa.playedPile.length).eq(playedBefore + 1);
      expect(automa.corpStats['phobologCubesHit']).eq(1);
      expect(automa.corpStats['phobologProjectCards']).eq(1);
    });

    it('resolves a BONUS card when that is what comes up', () => {
      const [game] = phobologGame('-pl-bonus');
      const automa = game.automa!;
      automa.bonusDeck = [{kind: 'bonus', id: BonusCardId.B04_OVERACHIEVEMENT}];
      armTrack(game, 10);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(automa.corpStats['phobologCubesHit']).eq(1);
      expect(automa.corpStats['phobologBonusCards']).eq(1);
      // It went through the ordinary routing — it is out of the deck.
      expect(automa.bonusDeck.some((e) => e.kind === 'bonus' && e.id === BonusCardId.B04_OVERACHIEVEMENT)).is.false;
    });

    it('a spent cube never fires again, not even after a regression', () => {
      const [game] = phobologGame('-pl-once');
      const automa = game.automa!;
      automa.bonusDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
      armTrack(game, 10);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);
      expect(automa.corpStats['phobologCubesHit']).eq(1);

      automa.board.tracks[THARSIS_TRACK.SPACE].regress();
      automa.bonusDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(automa.corpStats['phobologCubesHit'], 'RB-B: a triggered cube never re-arms').eq(1);
    });

    it('the space\'s own printed icon still resolves — the card never says «instead of»', () => {
      const [game] = phobologGame('-pl-addition', {venusNextExtension: true});
      const automa = game.automa!;
      automa.bonusDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
      const venusBefore = game.getVenusScaleLevel();
      armTrack(game, 7); // Tharsis space #7 prints a Venus raise.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(game.getVenusScaleLevel(), 'the printed Venus raise happened too').is.greaterThan(venusBefore);
      expect(automa.playedPile).contains(CardName.GENE_REPAIR);
    });

    it('an empty bonus deck reshuffles the discard before drawing', () => {
      const [game] = phobologGame('-pl-reshuffle');
      const automa = game.automa!;
      automa.bonusDeck = [];
      automa.bonusDiscard = [BonusCardId.B04_OVERACHIEVEMENT];
      armTrack(game, 13);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(automa.corpStats['phobologBonusCards']).eq(1);
    });

    it('nothing to draw at all is not a crash and not a Failed Action', () => {
      const [game, , bot] = phobologGame('-pl-nothing');
      const automa = game.automa!;
      automa.bonusDeck = [];
      automa.bonusDiscard = [];
      const mcBefore = bot.megaCredits;
      armTrack(game, 15);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(automa.corpStats['phobologCubesHit']).eq(1);
      expect(automa.corpStats['phobologProjectCards']).is.undefined;
      expect(automa.corpStats['phobologBonusCards']).is.undefined;
      expect(bot.megaCredits).eq(mcBefore);
    });
  });

  describe('the MIXED bonus deck', () => {
    it('a seeded project card can become the generation\'s action-deck card', () => {
      const [game] = phobologGame('-pl-actiondeck');
      const automa = game.automa!;
      automa.bonusDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];

      AutomaResearch.finishActionDeck(game, []);

      expect(automa.actionDeck.some((e) => e.kind === 'project' && e.name === CardName.GENE_REPAIR)).is.true;
    });

    it('round-trips through a save, project entries included', () => {
      const [game] = phobologGame('-pl-serialize');
      const automa = game.automa!;
      automa.bonusDeck = [
        {kind: 'project', name: CardName.GENE_REPAIR},
        {kind: 'bonus', id: BonusCardId.B04_OVERACHIEVEMENT},
      ];

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.bonusDeck).deep.eq([
        {kind: 'project', name: CardName.GENE_REPAIR},
        {kind: 'bonus', id: BonusCardId.B04_OVERACHIEVEMENT},
      ]);
    });

    it('an OLD save whose bonus deck is bare ids still loads', () => {
      const [game] = phobologGame('-pl-oldsave');
      const serialized = structuredClone(game.serialize());
      // Pre-C07 saves stored `Array<BonusCardId>`.
      serialized.automa!.bonusDeck = [BonusCardId.B01_METEOR_SHOWER, BonusCardId.B04_OVERACHIEVEMENT];

      const restored = Game.deserialize(serialized);

      expect(restored.automa!.bonusDeck).deep.eq([
        {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER},
        {kind: 'bonus', id: BonusCardId.B04_OVERACHIEVEMENT},
      ]);
    });
  });
});

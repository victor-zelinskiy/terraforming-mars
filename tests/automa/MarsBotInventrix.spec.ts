import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {newProjectCard} from '../../src/server/createCard';
import {TestPlayer} from '../TestPlayer';
import {setOxygenLevel, setTemperature} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

const B06 = BonusCardId.B06_LOBBYISTS;
const B15 = BonusCardId.B15_LOBBYISTS_VENUS;
const B25 = BonusCardId.B25_DO_IT_RIGHT;
const REWARD = 2;

/** A live Inventrix game with the corporation seated (setup + BAP already run). */
function inventrixGame(suffix: string, options: Record<string, unknown> = {}): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation: MarsBotCorpId.C05_INVENTRIX, ...options}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Resolve a bonus card exactly as the bot's turn does (resolve → route). */
function resolve(game: IGame, id: BonusCardId) {
  const outcome = resolveBonusCard(game, id);
  routeBonusCard(game, id, outcome);
  return outcome;
}

function bonusEntries(game: IGame): Array<BonusCardId> {
  return game.automa!.actionDeck.flatMap((entry) => entry.kind === 'bonus' ? [entry.id] : []);
}

/** The bonus cards still IN the deck (it may also hold project cards — C07). */
function bonusDeckIds(game: IGame): Array<BonusCardId> {
  return game.automa!.bonusDeck.flatMap((entry) => entry.kind === 'bonus' ? [entry.id] : []);
}

describe('MarsBot Inventrix (C05) + B25 Do It Right', () => {
  describe('the printed card', () => {
    it('prints no starting tags, no priority, no resource — only its three boxes', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C05_INVENTRIX);
      expect(info.original).eq(CardName.INVENTRIX);
      expect(info.cardNumber).eq('C05');
      expect(info.startingTags).is.empty;
      expect(info.draftPriority).is.undefined;
      expect(info.resource).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.corpBonusCards).deep.eq([B25]);
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect', 'beforeActionPhase']);
    });
  });

  describe('the SETUP box — Lobbyists is destroyed', () => {
    it('takes Lobbyists out of the bonus deck and out of the game', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C05_INVENTRIX}, '-inv-destroy');
      const automa = game.automa!;
      // Put Lobbyists in the DECK (setup may have dealt it into generation 1's
      // action deck — that path is the next spec).
      const dealt = automa.actionDeck.findIndex((e) => e.kind === 'bonus' && e.id === B06);
      if (dealt !== -1) {
        automa.actionDeck[dealt] = {kind: 'bonus', id: BonusCardId.B04_OVERACHIEVEMENT};
        automa.bonusDeck.push({kind: 'bonus', id: B06});
      }
      expect(bonusDeckIds(game)).contains(B06);

      game.playerIsFinishedWithResearchPhase(human);

      expect(bonusDeckIds(game), 'gone from the deck').not.contains(B06);
      expect(automa.destroyedBonusCards, 'out of the game').contains(B06);
      expect(bonusEntries(game), 'and never dealt into a hand').not.contains(B06);
    });

    it('when generation 1 already dealt it, the slot goes to the next bonus card', () => {
      // `customBonusCards` lifts B06 to the top of the bonus deck, and setup
      // deals the top card into generation 1's action deck — the exact case
      // this engine's compressed setup order creates.
      const [game, human] = testAutomaGame(
        {corporation: MarsBotCorpId.C05_INVENTRIX, customBonusCards: [B06]}, '-inv-swap');
      const automa = game.automa!;
      expect(bonusEntries(game), 'generation 1 was dealt Lobbyists').deep.eq([B06]);
      const deckSize = automa.actionDeck.length;
      const successor = bonusDeckIds(game)[0];

      game.playerIsFinishedWithResearchPhase(human);

      expect(automa.destroyedBonusCards).contains(B06);
      // The successor took the slot (and B25 joined) — the deck did not shrink.
      expect(bonusEntries(game).sort()).deep.eq([successor, B25].sort());
      expect(automa.actionDeck.length, 'one card in, one card out, plus B25').eq(deckSize + 1);
      expect(bonusDeckIds(game)).not.contains(successor);
    });

    it('with Venus Next it is the VENUS printing that is destroyed', () => {
      const [game] = inventrixGame('-inv-venus', {venusNextExtension: true});
      const automa = game.automa!;
      expect(automa.destroyedBonusCards).contains(B15);
      expect(automa.destroyedBonusCards).not.contains(B06);
      expect(bonusDeckIds(game)).not.contains(B15);
    });

    it('another corporation leaves Lobbyists alone', () => {
      const [game] = inventrixGame('-inv-other', {corporation: MarsBotCorpId.C01_CREDICOR});
      expect(game.automa!.destroyedBonusCards).is.empty;
    });
  });

  describe('the EFFECT — 2 M€ per card with a requirement', () => {
    it('pays for a card that prints a requirement', () => {
      const [game, , bot] = inventrixGame('-inv-req');
      const before = bot.megaCredits;

      AutomaCorporations.onProjectCardResolving(game, newProjectCard(CardName.GENE_REPAIR)!);

      expect(bot.megaCredits).eq(before + REWARD);
      expect(game.automa!.corpStats['inventrixTriggers']).eq(1);
      expect(game.automa!.corpStats['inventrixMc']).eq(REWARD);
    });

    it('pays for ANY requirement — a global parameter one too', () => {
      const [game, , bot] = inventrixGame('-inv-req-global');
      const before = bot.megaCredits;
      // Bushes requires −10 °C; the bot never checks it, the printed row is
      // what the corporation reads.
      AutomaCorporations.onProjectCardResolving(game, newProjectCard(CardName.BUSHES)!);
      expect(bot.megaCredits).eq(before + REWARD);
    });

    it('pays nothing for a card without a requirement', () => {
      const [game, , bot] = inventrixGame('-inv-noreq');
      const before = bot.megaCredits;

      AutomaCorporations.onProjectCardResolving(game, newProjectCard(CardName.MINE)!);

      expect(bot.megaCredits).eq(before);
      expect(game.automa!.corpStats['inventrixTriggers']).is.undefined;
    });

    it('another corporation pays nothing for the same card', () => {
      const [game, , bot] = inventrixGame('-inv-req-other', {corporation: MarsBotCorpId.C01_CREDICOR});
      const before = bot.megaCredits;
      AutomaCorporations.onProjectCardResolving(game, newProjectCard(CardName.GENE_REPAIR)!);
      expect(bot.megaCredits).eq(before);
    });
  });

  describe('B25 lifecycle — a corporation-owned recurring action card', () => {
    it('generation 1: exactly one B25 in the deck and in the recurring pool', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C05_INVENTRIX}, '-inv-b25-g1');
      expect(bonusEntries(game)).not.contains(B25); // Built before the corporation existed.
      game.playerIsFinishedWithResearchPhase(human);
      expect(bonusEntries(game).filter((id) => id === B25)).has.length(1);
      expect(game.automa!.recurringBonusCards.filter((id) => id === B25)).has.length(1);
    });

    it('a second Before-Action-Phase pass never adds a duplicate', () => {
      const [game] = inventrixGame('-inv-b25-idem');
      AutomaCorporations.corpFor(MarsBotCorpId.C05_INVENTRIX).beforeActionPhase?.(game);
      expect(bonusEntries(game).filter((id) => id === B25)).has.length(1);
    });

    it('resolving it never discards or destroys it — it stays recurring', () => {
      const [game] = inventrixGame('-inv-b25-recur');
      expect(resolve(game, B25)).eq('discard');
      const automa = game.automa!;
      expect(automa.bonusDiscard).not.contains(B25);
      expect(automa.destroyedBonusCards).not.contains(B25);
      expect(automa.recurringBonusCards.filter((id) => id === B25)).has.length(1);
    });
  });

  describe('B25 Do It Right — the printed a/b/c/d ladder', () => {
    it('a: temperature 1–2 steps from a bonus → +2 steps', () => {
      const [game] = inventrixGame('-b25-temp');
      setTemperature(game, -28); // 2 steps to the −24 heat bonus.
      resolve(game, B25);
      expect(game.getTemperature()).eq(-24);
      expect(game.automa!.corpStats['doItRightTemperature']).eq(1);
      expect(game.automa!.corpStats['doItRightPlayed']).eq(1);
    });

    it('b: oxygen 1–2 steps away → a greenery (its oxygen) + 1 more step', () => {
      const [game, , bot] = inventrixGame('-b25-oxygen');
      setTemperature(game, -16); // Branch a not applicable.
      setOxygenLevel(game, 12); // 2 steps to completion (14).
      resolve(game, B25);
      expect(game.getOxygenLevel()).eq(14);
      expect(game.board.spaces.some((s) => s.tile?.tileType === TileType.GREENERY && s.player?.id === bot.id)).is.true;
      expect(game.automa!.corpStats['doItRightGreeneries']).eq(1);
    });

    it('c: an ocean-reserved space next to 2 oceans → place the ocean there', () => {
      const [game, human] = inventrixGame('-b25-ocean');
      setTemperature(game, -16);
      setOxygenLevel(game, 9); // 5 steps to completion — branch b not applicable.
      const target = game.board.spaces.find((s) =>
        s.spaceType === SpaceType.OCEAN && s.tile === undefined &&
        game.board.getAdjacentSpaces(s).filter((a) => a.spaceType === SpaceType.OCEAN).length >= 2)!;
      const neighbors = game.board.getAdjacentSpaces(target).filter((a) => a.spaceType === SpaceType.OCEAN);
      game.simpleAddTile(human, neighbors[0], {tileType: TileType.OCEAN});
      game.simpleAddTile(human, neighbors[1], {tileType: TileType.OCEAN});
      const oceansBefore = game.board.getOceanSpaces().length;

      resolve(game, B25);

      expect(game.board.getOceanSpaces().length).eq(oceansBefore + 1);
      expect(game.automa!.corpStats['doItRightOceans']).eq(1);
    });

    it('d: nothing close enough → NO EFFECT, and never a Failed Action', () => {
      // A fresh board: −30 °C (3 steps to the first bonus), 0% oxygen, no oceans.
      const [game, , bot] = inventrixGame('-b25-none');
      const mcBefore = bot.megaCredits;
      const trBefore = bot.terraformRating;

      resolve(game, B25);

      expect(game.getTemperature()).eq(-30);
      expect(game.getOxygenLevel()).eq(0);
      expect(game.board.getOceanSpaces()).is.empty;
      expect(bot.megaCredits, 'no Failed Action compensation — the card prints "no effect"').eq(mcBefore);
      expect(bot.terraformRating).eq(trBefore);
      expect(game.automa!.corpStats['doItRightNoEffect']).eq(1);
    });

    it('unlike Lobbyists, it never falls back to the furthest Martian parameter', () => {
      const [game] = inventrixGame('-b25-nofallback');
      setTemperature(game, -16);
      setOxygenLevel(game, 9);
      resolve(game, B25);
      // Lobbyists' (d) would have raised oxygen here (furthest from complete).
      expect(game.getOxygenLevel()).eq(9);
      expect(game.getTemperature()).eq(-16);
    });

    it('Venus Next changes nothing — the printed third option is the ocean one', () => {
      const [game] = inventrixGame('-b25-venus', {venusNextExtension: true});
      setTemperature(game, -16);
      setOxygenLevel(game, 9);
      const venusBefore = game.getVenusScaleLevel();
      resolve(game, B25);
      expect(game.getVenusScaleLevel(), 'B25 has no Venus branch').eq(venusBefore);
    });

    it('a foreign bonus card is refused by the corporation', () => {
      const [game] = inventrixGame('-b25-foreign');
      expect(() => AutomaCorporations.corpFor(MarsBotCorpId.C05_INVENTRIX)
        .resolveBonusCard?.(game, BonusCardId.B23_RAPID_SPROUTING)).to.throw(/does not own/);
    });
  });

  describe('state', () => {
    it('the destroyed card and the corp stats survive a save/load round trip', () => {
      const [game] = inventrixGame('-inv-serialize');
      setTemperature(game, -28);
      resolve(game, B25);
      const destroyed = [...game.automa!.destroyedBonusCards];
      const stats = {...game.automa!.corpStats};

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C05_INVENTRIX);
      expect(restored.automa!.destroyedBonusCards).deep.eq(destroyed);
      expect(restored.automa!.corpStats).deep.eq(stats);
      expect(restored.automa!.recurringBonusCards).contains(B25);
    });
  });
});

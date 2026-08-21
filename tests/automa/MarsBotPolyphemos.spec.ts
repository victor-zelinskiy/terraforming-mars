import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaActionCard} from '../../src/server/automa/AutomaState';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/** The printed opening gift. */
const SETUP_MC = 25;
/** Single-tag / two-tag / three-tag cards, probed from the corpus. */
const ONE_TAG = CardName.CARBONATE_PROCESSING; // building
const TWO_TAGS = CardName.ECOLOGICAL_ZONE; // plant + animal
/** A card with NO printed tag at all — the official Failed Action. */
const NO_TAGS = CardName.LAKE_MARINERIS;

/** A live Polyphemos game. */
function polyGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C32_POLYPHEMOS): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

const project = (name: CardName): AutomaActionCard => ({kind: 'project', name});
const bonus = (id: BonusCardId): AutomaActionCard => ({kind: 'bonus', id});

/** Replace the action deck with exactly these entries. */
function setDeck(game: IGame, ...entries: Array<AutomaActionCard>) {
  game.automa!.actionDeck = [...entries];
}

function projectNames(game: IGame): Array<string> {
  return game.automa!.actionDeck.flatMap((e) => e.kind === 'project' ? [e.name] : []);
}

/** Run the box directly — the shared gate's once-per-generation marker is its own concern. */
function runBox(game: IGame) {
  AutomaCorporations.corpFor(MarsBotCorpId.C32_POLYPHEMOS).beforeActionPhase?.(game);
}

describe('MarsBot Polyphemos (C32)', () => {
  describe('the printed card', () => {
    it('prints SIX starting tags, no priority and two boxes', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C32_POLYPHEMOS);
      expect(info.original).eq(CardName.POLYPHEMOS);
      expect(info.cardNumber).eq('C32');
      expect(info.startingTags, 'the corner reads three space and three event')
        .deep.eq([Tag.SPACE, Tag.SPACE, Tag.SPACE, Tag.EVENT, Tag.EVENT, Tag.EVENT]);
      expect(info.draftPriority, 'no priority plate is printed').is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.whiteMarkerTracks).is.undefined;
      expect(info.resource).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'beforeActionPhase']);
    });

    it('has the most starting tags of any implemented corporation', () => {
      const counts = new Map<MarsBotCorpId, number>();
      for (const id of Object.values(MarsBotCorpId)) {
        counts.set(id, marsBotCorpInfo(id).startingTags.length);
      }
      const most = Math.max(...counts.values());
      expect(counts.get(MarsBotCorpId.C32_POLYPHEMOS)).eq(most).and.eq(6);
    });
  });

  describe('the SETUP box', () => {
    it('hands the bot 25 M€ and opens both its tracks on #3', () => {
      const [game, , bot] = polyGame('-po-setup');
      expect(bot.megaCredits, 'the gift, plus whatever the six tags landed on')
        .is.at.least(SETUP_MC);
      expect(game.automa!.board.tracks[THARSIS_TRACK.SPACE].position,
        'three space tags — and #1 is «advance», so it goes further').is.at.least(3);
      expect(game.automa!.board.tracks[THARSIS_TRACK.EVENT].position,
        'three event tags, same').is.at.least(3);
    });

    it('the BEFORE ACTION PHASE box has ALREADY run once by the first action phase', () => {
      // RB-B p.3: «Ones marked Before Action Phase are also resolved after
      // setup, before the first generation's Action Phase». The shared gate
      // does that for every corporation, so the opening deck is thinned too —
      // which is why every count below is measured as a DELTA.
      const [game] = polyGame('-po-gen1');
      expect(stat(game, 'polyphemosDiscards')).eq(1);
      expect(game.projectDeck.discardPile, 'and the card really left the deck').is.not.empty;
    });

    it('another corporation opens on nothing', () => {
      const [game] = polyGame('-po-setup-other', MarsBotCorpId.C01_CREDICOR);
      expect(game.automa!.board.tracks[THARSIS_TRACK.SPACE].position).eq(0);
      expect(game.automa!.board.tracks[THARSIS_TRACK.EVENT].position).eq(0);
    });
  });

  describe('the BEFORE ACTION PHASE box — «the fewest tags»', () => {
    it('sheds the card with the fewest printed tags', () => {
      const [game] = polyGame('-po-fewest');
      setDeck(game, project(TWO_TAGS), project(ONE_TAG), project(TWO_TAGS));
      const discards = stat(game, 'polyphemosDiscards');

      runBox(game);

      expect(projectNames(game), 'the one-tag card left').deep.eq([TWO_TAGS, TWO_TAGS]);
      expect(game.projectDeck.discardPile.map((c) => c.name), 'and it went to the OPEN discard')
        .contains(ONE_TAG);
      expect(stat(game, 'polyphemosDiscards')).eq(discards + 1);
    });

    it('a TAGLESS card goes first, and is counted as its own kind of save', () => {
      const [game] = polyGame('-po-tagless');
      setDeck(game, project(ONE_TAG), project(NO_TAGS), project(TWO_TAGS));

      runBox(game);

      expect(projectNames(game)).deep.eq([ONE_TAG, TWO_TAGS]);
      expect(stat(game, 'polyphemosTaglessShed'), 'a guaranteed Failed Action, removed').eq(1);
    });

    it('a BONUS card is never the choice — it has no tag row at all', () => {
      // The action deck always carries one; «the cards with the fewest tags»
      // compares tag rows, and a bonus card has none.
      const [game] = polyGame('-po-bonus');
      setDeck(game, bonus(BonusCardId.B01_METEOR_SHOWER), project(TWO_TAGS), project(ONE_TAG));

      runBox(game);

      expect(game.automa!.actionDeck.filter((e) => e.kind === 'bonus'), 'the bonus card stayed').has.length(1);
      expect(projectNames(game)).deep.eq([TWO_TAGS]);
      expect(stat(game, 'polyphemosTaglessShed'), 'and it was not counted as a tagless card').eq(0);
    });

    it('a deck of nothing but bonus cards sheds nothing', () => {
      const [game] = polyGame('-po-only-bonus');
      setDeck(game, bonus(BonusCardId.B01_METEOR_SHOWER), bonus(BonusCardId.B04_OVERACHIEVEMENT));
      const discards = stat(game, 'polyphemosDiscards');

      runBox(game);

      expect(game.automa!.actionDeck).has.length(2);
      expect(stat(game, 'polyphemosDiscards')).eq(discards);
    });

    it('ties are broken by the seeded rng — exactly one card leaves either way', () => {
      const [game] = polyGame('-po-tie');
      setDeck(game, project(ONE_TAG), project(ONE_TAG), project(TWO_TAGS));
      const discards = stat(game, 'polyphemosDiscards');

      runBox(game);

      expect(projectNames(game)).has.length(2);
      expect(projectNames(game), 'the two-tag card is never the one that goes').contains(TWO_TAGS);
      expect(stat(game, 'polyphemosDiscards') - discards).eq(1);
    });

    it('every generation sheds one more', () => {
      const [game] = polyGame('-po-repeat');
      setDeck(game, project(ONE_TAG), project(ONE_TAG), project(TWO_TAGS), project(TWO_TAGS));
      const discards = stat(game, 'polyphemosDiscards');

      runBox(game);
      runBox(game);

      expect(projectNames(game)).deep.eq([TWO_TAGS, TWO_TAGS]);
      expect(stat(game, 'polyphemosDiscards') - discards).eq(2);
    });

    it('the box runs through the shared gate, once per generation', () => {
      const [game] = polyGame('-po-gate');
      setDeck(game, project(ONE_TAG), project(TWO_TAGS));
      const discards = stat(game, 'polyphemosDiscards');
      game.generation = 4;

      AutomaCorporations.onActionPhaseStart(game);
      AutomaCorporations.onActionPhaseStart(game);

      expect(stat(game, 'polyphemosDiscards'), 'a reload or an undo cannot double it')
        .eq(discards + 1);
    });

    it('another corporation sheds nothing', () => {
      const [game] = polyGame('-po-other', MarsBotCorpId.C01_CREDICOR);
      setDeck(game, project(ONE_TAG), project(NO_TAGS), project(TWO_TAGS));
      game.generation = 4;

      AutomaCorporations.onActionPhaseStart(game);

      expect(projectNames(game)).has.length(3);
      expect(game.automa!.corpStats['polyphemosDiscards']).is.undefined;
    });
  });

  describe('state', () => {
    it('the thinned deck and the counters survive a save/load round trip', () => {
      const [game] = polyGame('-po-serialize');
      setDeck(game, project(ONE_TAG), project(TWO_TAGS));
      const discards = stat(game, 'polyphemosDiscards');
      runBox(game);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C32_POLYPHEMOS);
      expect(restored.automa!.corpStats['polyphemosDiscards']).eq(discards + 1);
      expect(projectNames(restored)).deep.eq([TWO_TAGS]);
    });

    it('the corporation is reachable through the shared registry', () => {
      const [game] = polyGame('-po-registry');
      expect(AutomaCorporations.activeCorp(game)?.info.id).eq(MarsBotCorpId.C32_POLYPHEMOS);
    });
  });
});

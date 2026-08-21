import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {corpOwningBonusCard, marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {resolveBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {drawAndResolveBonusDeckCard} from '../../src/server/automa/AutomaCardDraw';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {newProjectCard} from '../../src/server/createCard';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const B30 = BonusCardId.B30_INTERFACE_HYPERLINK;
/** Probed from the corpus: the chain's three deciders, one card each. */
const SCIENCE_CHEAP = CardName.SEARCH_FOR_LIFE; // cost 3, one science tag
const EXPENSIVE = CardName.AQUIFER_PUMPING; // cost 18, one building tag
const MID_ONE_TAG = CardName.GRASS; // cost 11, one plant tag
const MID_THREE_TAGS = CardName.ADVANCED_ECOSYSTEMS; // cost 11, three tags
const CHEAPEST = CardName.ALGAE; // cost 10, one plant tag

/** A live Tycho Magnetics game. */
function tychoGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C46_TYCHO_MAGNETICS): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

function bonusDeckIds(game: IGame): Array<BonusCardId> {
  return game.automa!.bonusDeck.flatMap((e) => e.kind === 'bonus' ? [e.id] : []);
}

/** Stack the project deck so exactly these cards are drawn, in this order. */
function stackDeck(game: IGame, ...names: Array<CardName>) {
  game.projectDeck.drawPile.length = 0;
  // `draw()` pops the END, so the first name must be pushed last.
  for (const name of [...names].reverse()) {
    game.projectDeck.drawPile.push(newProjectCard(name)!);
  }
}

/** Park the bot on `space` of the power track — the card's own draw size. */
function powerTrack(game: IGame, space: number) {
  game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position = space;
}

describe('MarsBot Tycho Magnetics (C46) + B30 Interface Hyperlink', () => {
  describe('the printed card', () => {
    it('prints no tag, a power > science priority and owns B30', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C46_TYCHO_MAGNETICS);
      expect(info.original).eq(CardName.TYCHO_MAGNETICS);
      expect(info.cardNumber).eq('C46');
      expect(info.startingTags, 'the corner carries only the priority plate').is.empty;
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.POWER, Tag.SCIENCE]});
      expect(info.corpBonusCards).deep.eq([B30]);
      expect(corpOwningBonusCard(B30)?.id).eq(MarsBotCorpId.C46_TYCHO_MAGNETICS);
      expect(info.trackCubes).is.undefined;
      expect(info.whiteMarkerTracks).is.undefined;
      expect(info.resource).is.undefined;
      expect(info.requiresModules, 'nothing but the base game is needed').is.undefined;
      expect(info.sections.map((s) => s.kind), 'no effect box and no round start is printed')
        .deep.eq(['draftPriority', 'setup']);
    });
  });

  describe('the SETUP box — «on the bottom of the bonus deck»', () => {
    it('places its card LAST, unshuffled — bonus draws take the front', () => {
      const [game] = tychoGame('-ty-setup');
      const ids = bonusDeckIds(game);
      expect(ids.filter((id) => id === B30), 'exactly one copy').has.length(1);
      expect(ids[ids.length - 1], 'and it sits at the very bottom').eq(B30);
      expect(game.automa!.recurringBonusCards, 'it is not recurring — it destroys itself')
        .not.contains(B30);
    });

    it('another corporation places none', () => {
      const [game] = tychoGame('-ty-setup-other', MarsBotCorpId.C01_CREDICOR);
      expect(bonusDeckIds(game)).not.contains(B30);
    });
  });

  describe('B30 — the draw size is the power track', () => {
    it('an untouched track still draws the printed minimum of two', () => {
      const [game] = tychoGame('-ty-min');
      powerTrack(game, 0);
      stackDeck(game, SCIENCE_CHEAP, EXPENSIVE);

      resolveBonusCard(game, B30);

      expect(stat(game, 'hyperlinkDrawn')).eq(2);
      expect(stat(game, 'hyperlinkResolved'), 'and with only two drawn, both are kept').eq(2);
    });

    it('a track on space 5 draws five', () => {
      const [game] = tychoGame('-ty-five');
      powerTrack(game, 5);
      stackDeck(game, SCIENCE_CHEAP, EXPENSIVE, MID_ONE_TAG, CHEAPEST, MID_THREE_TAGS);

      resolveBonusCard(game, B30);

      expect(stat(game, 'hyperlinkDrawn')).eq(5);
      expect(stat(game, 'hyperlinkResolved'), 'but still only two are kept').eq(2);
    });
  });

  describe('B30 — the printed priority chain', () => {
    it('1. SCIENCE first, even against a card six times its cost', () => {
      const [game] = tychoGame('-ty-science');
      powerTrack(game, 4);
      stackDeck(game, EXPENSIVE, MID_ONE_TAG, SCIENCE_CHEAP, CHEAPEST);

      resolveBonusCard(game, B30);

      const played = game.automa!.playedPile;
      expect(played, 'the 3 M€ science card outranks the 18 M€ one').contains(SCIENCE_CHEAP);
      expect(played, 'and the most expensive takes the second slot').contains(EXPENSIVE);
      expect(played).has.length(2);
    });

    it('2. MOST EXPENSIVE decides when nothing carries science', () => {
      const [game] = tychoGame('-ty-cost');
      powerTrack(game, 4);
      stackDeck(game, CHEAPEST, EXPENSIVE, MID_ONE_TAG, CHEAPEST);

      resolveBonusCard(game, B30);

      const played = game.automa!.playedPile;
      expect(played).contains(EXPENSIVE).and.contains(MID_ONE_TAG);
      expect(played, 'the 10 M€ card never made it').does.not.contain(CHEAPEST);
    });

    it('3. MOST TAGS breaks a tie on cost', () => {
      const [game] = tychoGame('-ty-tags');
      powerTrack(game, 3);
      // Two cards at 11 M€, one of them with three printed tags.
      stackDeck(game, MID_ONE_TAG, MID_THREE_TAGS, CHEAPEST);

      resolveBonusCard(game, B30);

      const played = game.automa!.playedPile;
      expect(played, 'three tags beat one at the same price').contains(MID_THREE_TAGS);
      expect(played, 'and the cheaper card is the one left out').does.not.contain(CHEAPEST);
    });

    it('the rejects go to the project discard, the keepers get PLAYED', () => {
      const [game] = tychoGame('-ty-discard');
      powerTrack(game, 4);
      stackDeck(game, SCIENCE_CHEAP, EXPENSIVE, MID_ONE_TAG, CHEAPEST);

      resolveBonusCard(game, B30);

      const discarded = game.projectDeck.discardPile.map((c) => c.name);
      expect(discarded).contains(MID_ONE_TAG).and.contains(CHEAPEST);
      expect(game.automa!.playedPile, 'and the kept ones are in the played pile')
        .deep.eq([SCIENCE_CHEAP, EXPENSIVE]);
    });

    it('the kept cards really RESOLVE — their tags move the mat', () => {
      const [game] = tychoGame('-ty-resolve');
      powerTrack(game, 2);
      const science = game.automa!.board.tracks[THARSIS_TRACK.SCIENCE].position;
      stackDeck(game, SCIENCE_CHEAP, EXPENSIVE);

      resolveBonusCard(game, B30);

      expect(game.automa!.board.tracks[THARSIS_TRACK.SCIENCE].position,
        'the science card advanced the science track').is.greaterThan(science);
    });
  });

  describe('B30 — «then destroy this card»', () => {
    it('destroys itself, and never comes back through the discard', () => {
      // Driven the way the GAME does it — the deck finally reaches the card,
      // draws it off the front, resolves it and routes its fate. Resolving it
      // while it still sits in the deck would test a state that never happens.
      const [game] = tychoGame('-ty-destroy');
      powerTrack(game, 2);
      stackDeck(game, SCIENCE_CHEAP, EXPENSIVE);
      const automa = game.automa!;
      automa.bonusDeck = automa.bonusDeck.filter((e) => !(e.kind === 'bonus' && e.id === B30));
      automa.bonusDeck.unshift({kind: 'bonus', id: B30});

      expect(drawAndResolveBonusDeckCard(game), 'the deck really produced it').is.true;

      expect(stat(game, 'hyperlinkPlayed'), 'it ran').eq(1);
      expect(automa.destroyedBonusCards).contains(B30);
      expect(automa.bonusDiscard).does.not.contain(B30);
      expect(bonusDeckIds(game)).does.not.contain(B30);
    });

    it('a foreign bonus card is refused by the corporation', () => {
      const [game] = tychoGame('-ty-foreign');
      expect(() => resolveBonusCard(game, BonusCardId.B23_RAPID_SPROUTING)).to.throw();
    });

    it('another corporation cannot resolve it', () => {
      const [game] = tychoGame('-ty-other', MarsBotCorpId.C01_CREDICOR);
      expect(() => resolveBonusCard(game, B30)).to.throw();
    });
  });

  describe('draft priority — «power, then science»', () => {
    it('prefers a power card, and falls back to a science one', () => {
      const [game] = tychoGame('-ty-draft');
      const power = newProjectCard(CardName.GEOTHERMAL_POWER)!; // power + building
      const science = newProjectCard(SCIENCE_CHEAP)!;
      const neither = newProjectCard(CHEAPEST)!;

      expect(AutomaCorporations.draftPick(game, [neither, science, power]).name)
        .eq(CardName.GEOTHERMAL_POWER);
      expect(AutomaCorporations.draftPick(game, [neither, science]).name).eq(SCIENCE_CHEAP);
    });
  });

  describe('state', () => {
    it('the counters and the bonus deck survive a save/load round trip', () => {
      const [game] = tychoGame('-ty-serialize');
      powerTrack(game, 3);
      stackDeck(game, SCIENCE_CHEAP, EXPENSIVE, CHEAPEST);
      resolveBonusCard(game, B30);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C46_TYCHO_MAGNETICS);
      expect(restored.automa!.corpStats['hyperlinkDrawn']).eq(3);
      expect(restored.automa!.corpStats['hyperlinkResolved']).eq(2);
    });

    it('the corporation is reachable through the shared registry', () => {
      const [game] = tychoGame('-ty-registry');
      expect(AutomaCorporations.activeCorp(game)?.info.id).eq(MarsBotCorpId.C46_TYCHO_MAGNETICS);
    });
  });
});

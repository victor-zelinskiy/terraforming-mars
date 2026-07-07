import {expect} from 'chai';
import {CardType} from '../../src/common/cards/CardType';
import {Tag} from '../../src/common/cards/Tag';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {fakeCard, setVenusScaleLevel} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

// Tharsis track indexes (THARSIS_MARSBOT_BOARD order).
const BUILDING = 0;
const SPACE = 1;
const EVENT = 2;
const SCIENCE = 3;
const ENERGY = 4;
const EARTH = 5;
const BIO = 6;
const VENUS_TRACK = 7;

describe('AutomaResolver', () => {
  it('a card with no tags is a Failed Action: +5 M€', () => {
    const [game, /* human */, bot] = testAutomaGame();
    AutomaResolver.resolveProjectCard(game, fakeCard({tags: []}));
    expect(bot.megaCredits).eq(5);
    expect(game.automa!.board.tracks.every((t) => t.position === 0)).is.true;
  });

  it('Easy: a Failed Action gives 3 M€ instead of 5', () => {
    const [game, /* human */, bot] = testAutomaGame({difficulty: 'easy'});
    AutomaResolver.resolveProjectCard(game, fakeCard({tags: []}));
    expect(bot.megaCredits).eq(3);
  });

  it('one building tag advances the Building track one space', () => {
    const [game] = testAutomaGame();
    AutomaResolver.resolveProjectCard(game, fakeCard({tags: [Tag.BUILDING]}));
    expect(game.automa!.board.tracks[BUILDING].position).eq(1);
  });

  it('multiple tags resolve left-to-right, one at a time', () => {
    const [game] = testAutomaGame();
    // Earth[1]='city' would throw (Phase 7), so use building+space+building:
    // Building 0→1 (none), Space 0→1 ('advance' → cascades to 2), Building 1→2 ('ocean' → Phase 7)...
    // Keep it physical-action-free: building, building → positions only.
    AutomaResolver.resolveProjectCard(game, fakeCard({tags: [Tag.BUILDING, Tag.SPACE]}));
    expect(game.automa!.board.tracks[BUILDING].position).eq(1);
    // Space[1]='advance' cascades: 1→2 (no action at 2).
    expect(game.automa!.board.tracks[SPACE].position).eq(2);
  });

  it('an event card resolves its printed tags first, then the event tag (last)', () => {
    const [game] = testAutomaGame();
    const card = fakeCard({tags: [Tag.BUILDING], type: CardType.EVENT});
    expect(AutomaResolver.printedTags(card)).deep.eq([Tag.BUILDING, Tag.EVENT]);
    AutomaResolver.resolveProjectCard(game, card);
    expect(game.automa!.board.tracks[BUILDING].position).eq(1);
    // Event[1]='advance' cascades to 2 (no action at 2).
    expect(game.automa!.board.tracks[EVENT].position).eq(2);
  });

  it('a pure event card (no other tags) still advances the Event track — never a Failed Action', () => {
    const [game, /* human */, bot] = testAutomaGame();
    AutomaResolver.resolveProjectCard(game, fakeCard({tags: [], type: CardType.EVENT}));
    expect(bot.megaCredits).eq(0);
    expect(game.automa!.board.tracks[EVENT].position).eq(2); // 1 is 'advance'.
  });

  it('a Wild tag advances the least-advanced track, topmost on ties', () => {
    const [game] = testAutomaGame();
    const board = game.automa!.board;
    // Everything at 0 → topmost (Building) wins the tie.
    AutomaResolver.resolveTag(game, Tag.WILD);
    expect(board.tracks[BUILDING].position).eq(1);
    // Raise every track except Science → Science is now the furthest back.
    for (const idx of [SPACE, EVENT, ENERGY, EARTH, BIO]) {
      board.tracks[idx].position = 5;
    }
    AutomaResolver.resolveTag(game, Tag.WILD);
    // Science[1]='advance' cascades to 2.
    expect(board.tracks[SCIENCE].position).eq(2);
  });

  it('a Venus tag without Venus Next is an unused-expansion icon: ignored, no Failed Action', () => {
    const [game, /* human */, bot] = testAutomaGame();
    AutomaResolver.resolveProjectCard(game, fakeCard({tags: [Tag.VENUS]}));
    expect(bot.megaCredits).eq(0);
    expect(game.automa!.board.tracks.every((t) => t.position === 0)).is.true;
  });

  it('a Venus tag with Venus Next advances the Venus track (cell 1: gain 1 floater)', () => {
    const [game] = testAutomaGame({venusNextExtension: true});
    AutomaResolver.resolveTag(game, Tag.VENUS);
    expect(game.automa!.board.tracks[VENUS_TRACK].position).eq(1);
    expect(game.automa!.floaters).eq(1);
  });

  it('advancing a maxed track is a Failed Action', () => {
    const [game, /* human */, bot] = testAutomaGame();
    game.automa!.board.tracks[BUILDING].position = 18;
    AutomaResolver.resolveProjectCard(game, fakeCard({tags: [Tag.BUILDING]}));
    expect(bot.megaCredits).eq(5);
    expect(game.automa!.board.tracks[BUILDING].position).eq(18);
  });

  it('a Gain TR action grants the printed TR', () => {
    const [game, /* human */, bot] = testAutomaGame();
    // Building[5]='tr2'.
    game.automa!.board.tracks[BUILDING].position = 4;
    AutomaResolver.resolveTag(game, Tag.BUILDING);
    expect(bot.terraformRating).eq(22);
  });

  it('the Advance Tracker action cascades — and Easy ignores it', () => {
    const [game] = testAutomaGame();
    // Science[1]='advance' → cascades to 2.
    AutomaResolver.resolveTag(game, Tag.SCIENCE);
    expect(game.automa!.board.tracks[SCIENCE].position).eq(2);

    const [easyGame] = testAutomaGame({difficulty: 'easy'}, '-easy');
    AutomaResolver.resolveTag(easyGame, Tag.SCIENCE);
    expect(easyGame.automa!.board.tracks[SCIENCE].position).eq(1);
  });

  it('Advance Another Track chains across tracks', () => {
    const [game] = testAutomaGame();
    const board = game.automa!.board;
    // Building[11]='tag_1' (advance the Space track); Space[1]='advance' → 2.
    board.tracks[BUILDING].position = 10;
    AutomaResolver.resolveTag(game, Tag.BUILDING);
    expect(board.tracks[BUILDING].position).eq(11);
    expect(board.tracks[SPACE].position).eq(2);
  });

  it('a regressed position is skipped when re-advanced (no reactivation)', () => {
    const [game, /* human */, bot] = testAutomaGame();
    const track = game.automa!.board.tracks[BUILDING];
    // Building[5]='tr2': advance onto it, regress off it, re-advance — no second TR.
    track.position = 4;
    AutomaResolver.resolveTag(game, Tag.BUILDING);
    expect(bot.terraformRating).eq(22);
    track.regress();
    expect(track.position).eq(4);
    AutomaResolver.resolveTag(game, Tag.BUILDING);
    expect(track.position).eq(5);
    expect(bot.terraformRating).eq(22); // Unchanged: the action did not reactivate.
  });

  describe('Raise Venus track action', () => {
    it('raises Venus 1 step and TR per the normal rules', () => {
      const [game, /* human */, bot] = testAutomaGame({venusNextExtension: true});
      AutomaResolver.performTrackAction(game, 'venus', ENERGY);
      expect(game.getVenusScaleLevel()).eq(2);
      expect(bot.terraformRating).eq(21);
    });

    it('the 16% threshold TR bonus applies to the bot; the 8% card draw does not (OQ-7)', () => {
      const [game, /* human */, bot] = testAutomaGame({venusNextExtension: true});
      setVenusScaleLevel(game, 6);
      AutomaResolver.performTrackAction(game, 'venus', ENERGY);
      expect(game.getVenusScaleLevel()).eq(8);
      expect(bot.cardsInHand).is.empty; // No 8% card for the bot.
      expect(bot.terraformRating).eq(21);

      setVenusScaleLevel(game, 14);
      AutomaResolver.performTrackAction(game, 'venus', ENERGY);
      expect(game.getVenusScaleLevel()).eq(16);
      expect(bot.terraformRating).eq(23); // +1 step +1 bonus TR.
    });

    it('a maxed Venus is a Failed Action', () => {
      const [game, /* human */, bot] = testAutomaGame({venusNextExtension: true});
      setVenusScaleLevel(game, 30);
      AutomaResolver.performTrackAction(game, 'venus', ENERGY);
      expect(bot.megaCredits).eq(5);
      expect(bot.terraformRating).eq(20);
    });

    it('venus2 raises twice; the second raise onto a completed Venus is a Failed Action', () => {
      const [game, /* human */, bot] = testAutomaGame({venusNextExtension: true});
      setVenusScaleLevel(game, 28);
      AutomaResolver.performTrackAction(game, 'venus2', EVENT);
      expect(game.getVenusScaleLevel()).eq(30);
      expect(bot.megaCredits).eq(5); // Second step failed.
      expect(bot.terraformRating).eq(21); // Only the first step's TR.
    });

    it('without Venus Next the icon is ignored — no Failed Action', () => {
      const [game, /* human */, bot] = testAutomaGame();
      AutomaResolver.performTrackAction(game, 'venus', ENERGY);
      expect(bot.megaCredits).eq(0);
    });
  });

  it('floater / floater2 actions add to the single floater pool', () => {
    const [game] = testAutomaGame({venusNextExtension: true});
    AutomaResolver.performTrackAction(game, 'floater', VENUS_TRACK);
    AutomaResolver.performTrackAction(game, 'floater2', VENUS_TRACK);
    expect(game.automa!.floaters).eq(3);
  });

  it('physical track actions fail loudly until their phase lands', () => {
    const [game] = testAutomaGame();
    expect(() => AutomaResolver.performTrackAction(game, 'ocean', BUILDING)).to.throw(/Automa Phase 7/);
    expect(() => AutomaResolver.performTrackAction(game, 'temperature', BUILDING)).to.throw(/Automa Phase 7/);
    expect(() => AutomaResolver.performTrackAction(game, 'greenery', BUILDING)).to.throw(/Automa Phase 7/);
    expect(() => AutomaResolver.performTrackAction(game, 'city', EARTH)).to.throw(/Automa Phase 7/);
    expect(() => AutomaResolver.performTrackAction(game, 'milestone', BUILDING)).to.throw(/Automa Phase 9/);
    expect(() => AutomaResolver.performTrackAction(game, 'award', BUILDING)).to.throw(/Automa Phase 9/);
  });
});

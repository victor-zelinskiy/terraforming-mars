import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {AUTOMA_FLIP_TAGS} from '../../src/common/automa/AutomaFlipTags';
import {IGame} from '../../src/server/IGame';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {TestPlayer} from '../TestPlayer';
import {fakeCard} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

/**
 * HOME RULE (the owner, 2026-10-31) — a tag the bot's board has no track for resolves as a random ORDINARY tag:
 * the top project card is flipped, one random tracked tag of it advances its track, the card is discarded
 * (`common/automa/AutomaFlipTags.ts`). Told only in the bot-turn review.
 */

/** Lay cards on top of the project deck — the LAST one given is flipped first. */
function stack(game: IGame, ...cards: Array<IProjectCard>): void {
  game.projectDeck.drawPile.push(...cards);
}

function trackOf(game: IGame, tag: Tag): number {
  const index = game.automa!.board.getTrackIndexForTag(tag);
  if (index === undefined) {
    throw new Error(`no track for ${tag}`);
  }
  return index;
}

function positions(game: IGame): Array<number> {
  return game.automa!.board.tracks.map((t) => t.position);
}

describe('AutomaFlipTags — a tag with no track resolves as a random ordinary tag (home rule)', () => {
  it('a Mars-only card flips the top project card and advances ITS track; the card goes to the discard', () => {
    const [game] = testAutomaGame();
    const top = fakeCard({name: 'flip-space' as CardName, tags: [Tag.SPACE]});
    stack(game, top);
    const deck = game.projectDeck.drawPile.length;
    const before = positions(game);
    AutomaResolver.resolveProjectCard(game, fakeCard({name: 'mars-only' as CardName, tags: [Tag.MARS]}));
    const after = positions(game);
    const space = trackOf(game, Tag.SPACE);
    expect(after[space], 'the space track moved').greaterThan(before[space]);
    after.forEach((p, i) => {
      if (i !== space) {
        expect(p, `track ${i} untouched`).eq(before[i]);
      }
    });
    expect(game.projectDeck.drawPile.length).eq(deck - 1);
    expect(game.projectDeck.discardPile).includes(top);
  });

  it('a flipped card with no tracked tag is discarded and the NEXT one flipped', () => {
    const [game] = testAutomaGame();
    const earth = fakeCard({name: 'flip-earth' as CardName, tags: [Tag.EARTH]});
    const marsToo = fakeCard({name: 'flip-mars' as CardName, tags: [Tag.MARS]});
    stack(game, earth, marsToo);
    const before = positions(game)[trackOf(game, Tag.EARTH)];
    AutomaResolver.resolveProjectCard(game, fakeCard({name: 'mars-only' as CardName, tags: [Tag.MARS]}));
    expect(positions(game)[trackOf(game, Tag.EARTH)]).greaterThan(before);
    expect(game.projectDeck.discardPile).includes(marsToo);
    expect(game.projectDeck.discardPile).includes(earth);
  });

  it('a card with a Mars tag AND an ordinary one: each tag resolves — two steps, as any two-tag card', () => {
    const [game] = testAutomaGame();
    stack(game, fakeCard({name: 'flip-science' as CardName, tags: [Tag.SCIENCE]}));
    const before = positions(game);
    AutomaResolver.resolveProjectCard(game, fakeCard({name: 'mixed' as CardName, tags: [Tag.MARS, Tag.BUILDING]}));
    const after = positions(game);
    expect(after[trackOf(game, Tag.SCIENCE)], 'the flip').greaterThan(before[trackOf(game, Tag.SCIENCE)]);
    expect(after[trackOf(game, Tag.BUILDING)], 'the printed building tag').greaterThan(before[trackOf(game, Tag.BUILDING)]);
  });

  it('a flipped card with several tracked tags gives ONE of them, at random (the seeded RNG) — never the first by rule', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 16; seed++) {
      const [game] = testAutomaGame({seed: seed / 16}, `-flip-${seed}`);
      stack(game, fakeCard({name: 'flip-two' as CardName, tags: [Tag.SPACE, Tag.POWER]}));
      const before = positions(game);
      AutomaResolver.resolveProjectCard(game, fakeCard({name: 'mars-only' as CardName, tags: [Tag.MARS]}));
      const after = positions(game);
      const moved = [Tag.SPACE, Tag.POWER].filter((t) => after[trackOf(game, t)] > before[trackOf(game, t)]);
      expect(moved, 'exactly one of the two').lengthOf(1);
      seen.add(moved[0]);
    }
    expect([...seen].sort()).deep.eq([Tag.POWER, Tag.SPACE].sort());
  });

  it('Venus without Venus Next keeps the rulebook\'s reading: an unused expansion\'s icon, ignored — nothing flipped', () => {
    const [game] = testAutomaGame();
    expect(game.automa!.board.getTrackIndexForTag(Tag.VENUS)).is.undefined;
    const deck = game.projectDeck.drawPile.length;
    const before = positions(game);
    AutomaResolver.resolveProjectCard(game, fakeCard({name: 'venus-only' as CardName, tags: [Tag.VENUS]}));
    expect(positions(game)).deep.eq(before);
    expect(game.projectDeck.drawPile.length).eq(deck);
  });

  it('in a real turn: the tag step carries the flip, the advance follows it, and NOTHING reaches the journal', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    game.playerIsFinishedWithResearchPhase(human);
    const top = fakeCard({name: 'flip-science' as CardName, tags: [Tag.SCIENCE]});
    stack(game, top);
    automa.actionDeck = [{kind: 'project', name: CardName.MARTIAN_CENSUS}];
    const logBefore = game.gameLog.length;
    (human as TestPlayer).popWaitingFor();
    game.playerIsFinishedTakingActions();

    const steps = automa.lastTurn!.steps;
    const i = steps.findIndex((s) => s.kind === 'tag');
    const tagStep = steps[i];
    expect(tagStep.kind === 'tag' && tagStep.tag).eq(Tag.MARS);
    expect(tagStep.kind === 'tag' && tagStep.flip).deep.eq({card: top.name, tag: Tag.SCIENCE});
    expect(tagStep.kind === 'tag' && tagStep.trackIndex).eq(trackOf(game, Tag.SCIENCE));
    expect(steps[i + 1]?.kind, 'the step is followed by the advance it caused').eq('advance');
    const fresh = game.gameLog.slice(logBefore);
    expect(fresh.some((e) => (e.data ?? []).some((d) => d.value === top.name)), 'the flipped card is never named in the journal').is.false;
  });

  it('GUARD: every tag is a track on the board, Wild, or under the home rule — a NEW tag must be decided', () => {
    const [game] = testAutomaGame({venusNextExtension: true});
    const board = game.automa!.board;
    const undecided = Object.values(Tag).filter((t) => t !== Tag.WILD && board.getTrackIndexForTag(t) === undefined && !AUTOMA_FLIP_TAGS.has(t));
    expect(undecided, 'add a track or put the tag under AUTOMA_FLIP_TAGS').deep.eq([]);
  });
});

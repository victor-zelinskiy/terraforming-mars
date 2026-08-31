import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {DELTA_TRACK_TAGS, DeltaProjectExpansion} from '../../src/server/delta/DeltaProjectExpansion';
import {DeltaSurge} from '../../src/server/cards/delta/DeltaSurge';
import {TitanFloatingLaunchPad} from '../../src/server/cards/colonies/TitanFloatingLaunchPad';
import {AICentral} from '../../src/server/cards/base/AICentral';
import {testGame} from '../TestGame';
import {fakeCard, runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {OrOptions} from '../../src/server/inputs/OrOptions';

/**
 * COPIED-ACTION ATTRIBUTION — «whose action raised this prompt?», answered for
 * every card, including ones not written yet.
 *
 * THE BUG CLASS. A Hydronetwork stage-7 reward repeats a used blue action, and
 * the server resolves the whole traversal inside ONE request — so every prompt
 * the copy raises is on the wire while the marker is still cells back. The
 * console holds those prompts behind a stage gate, and the gate needs to know
 * which prompt belongs to the copy.
 *
 * The first answer was «read the prompt's `choiceContext`», and it worked for
 * exactly the prompts somebody had remembered to mark. It did not work for the
 * repeated COLONY TRADE, whose `SelectColony` is built bare — so the colonies
 * screen was free to open mid-walk. Marking those four cards would have closed
 * four holes and left the class open: the next card with a prompt-raising action
 * would arrive unmarked and nobody would notice until it shipped.
 *
 * THE FIX IS AT THE FUNNEL. `Player.setWaitingFor` is the one place every prompt
 * passes through, and the event recorder already knows whether a COPIED action
 * is running (the scope the deferred queue captures and restores). The stamp is
 * taken from there, so a card cannot forget to mark itself — there is nothing to
 * mark.
 */
describe('copied-action attribution (stamped at the funnel, never by the card)', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2, {coloniesExtension: true, deltaProjectExpansion: true});
    // ⚠️ THE MODULE'S OWN CARD IS DELIBERATELY *NOT* PUSHED. The Hydronetwork is
    // a GLOBAL SUBSYSTEM action and nobody plays that card, so a spec that seeds
    // it into the tableau is testing a configuration the game never has — which
    // is exactly how the first version of this suite passed while the real flow
    // shipped every prompt unattributed.
  });

  /** Stand the marker on `position` with every tag the track demands. */
  function reachStage(position: number): void {
    player.playedCards.push(fakeCard({tags: DELTA_TRACK_TAGS.filter((t) => t !== undefined)}));
    player.deltaProjectData!.position = position;
  }

  it('a repeated action that raises a BARE prompt is still attributed', () => {
    // «Титановая плавучая платформа»: spend a floater, trade for free. Its
    // `SelectColony` carries NO `choiceContext` — nothing about it names a card.
    const pad = new TitanFloatingLaunchPad();
    pad.resourceCount = 1;
    player.playedCards.push(pad);
    player.actionsThisGeneration.add(pad.name);
    reachStage(6);
    player.energy = 1;

    DeltaProjectExpansion.advance(player, 1, undefined, {
      answers: [{position: 7, selectedCard: pad.name}],
    });
    runAllActions(game);

    // The branch pick, then the colony pick — both raised INSIDE the copy.
    const branches = cast(player.getWaitingFor(), OrOptions);
    expect(branches.copiedActionSource, 'the branch prompt names the copied card')
      .to.eq(pad.name);

    // ⚠️ ANSWERED THROUGH THE REAL FUNNEL, never by poking `options[i].cb()`.
    // `Player.process` restores the prompt's captured event context around the
    // callback, and that restore is precisely what carries the copied scope
    // ACROSS the input boundary — so a spec that calls the callback directly
    // tests a path the game never takes and reports a hole that is not there.
    player.process({type: 'or', index: 0, response: {type: 'option'}});
    runAllActions(game);

    const colony = cast(player.getWaitingFor(), SelectColony);
    expect(colony.choiceContext, 'the card marks nothing — that is the point')
      .to.eq(undefined);
    expect(colony.copiedActionSource, 'and it is attributed anyway').to.eq(pad.name);
  });

  it('…and so is a repeated action whose follow-up is a plain draw', () => {
    const ai = new AICentral();
    player.playedCards.push(ai);
    player.actionsThisGeneration.add(ai.name);
    reachStage(6);
    player.energy = 1;

    DeltaProjectExpansion.advance(player, 1, undefined, {
      answers: [{position: 7, selectedCard: ai.name}],
    });
    runAllActions(game);
    // AI Central draws without asking, so there is no prompt to attribute —
    // the batch carries its own `CardDrawRevealSource`. The assertion that
    // matters is that nothing was left waiting UNattributed.
    const pending = player.getWaitingFor();
    if (pending !== undefined) {
      expect(pending.copiedActionSource, 'any prompt it did raise is attributed').to.eq(ai.name);
    }
  });

  it('an ORDINARY action is NOT stamped — the marker means «copied», not «a card asked»', () => {
    const pad = new TitanFloatingLaunchPad();
    pad.resourceCount = 1;
    player.playedCards.push(pad);
    player.defer(pad.action(player));
    runAllActions(game);

    const branches = cast(player.popWaitingFor(), OrOptions);
    expect(branches.copiedActionSource, 'nobody is copying anything here').to.eq(undefined);
  });

  it('a DECLARED and a RUNTIME repeat pick reach the same runner', () => {
    // Two doors, one scope: the journal marker and the attribution cannot
    // depend on which one the player used.
    const pad = new TitanFloatingLaunchPad();
    pad.resourceCount = 1;
    player.playedCards.push(pad);
    player.actionsThisGeneration.add(pad.name);
    player.playedCards.push(new DeltaSurge());
    reachStage(6);
    player.energy = 1;

    // No declared answer → the runtime SelectCard door.
    DeltaProjectExpansion.advance(player, 1);
    runAllActions(game);
    const cardPick = player.popWaitingFor();
    expect(cardPick?.type, 'the runtime pick').to.eq('card');
    expect(cardPick?.copiedActionSource, 'the PICK itself is not the copy').to.eq(undefined);
    (cardPick as {cb: (cards: ReadonlyArray<unknown>) => void}).cb([pad]);
    runAllActions(game);

    expect(player.getWaitingFor()?.copiedActionSource,
      'everything past it is').to.eq(CardName.TITAN_FLOATING_LAUNCHPAD);
  });
});

import {expect} from 'chai';
import {runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';
import {Server} from '../../src/server/models/ServerModel';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {PlayerInputModel} from '../../src/common/models/PlayerInputModel';
import {buildEffectDecision} from '../../src/client/console/effectDecision/effectDecisionModel';
import {ICard} from '../../src/server/cards/ICard';
import {PlayerInput} from '../../src/server/PlayerInput';

// The EFFECT CARDS in premium scope whose trigger is a CARD PLAY.
import {MarsUniversity} from '../../src/server/cards/base/MarsUniversity';
import {OlympusConference} from '../../src/server/cards/base/OlympusConference';
import {ViralEnhancers} from '../../src/server/cards/base/ViralEnhancers';
import {Recyclon} from '../../src/server/cards/promo/Recyclon';
import {Splice} from '../../src/server/cards/promo/Splice';
import {PharmacyUnion} from '../../src/server/cards/promo/PharmacyUnion';
// …plus the ATTACK a play makes itself, which is the same family.
import {Virus} from '../../src/server/cards/base/Virus';

// …and the cards whose PLAY sets them off.
import {Research} from '../../src/server/cards/base/Research';
import {EarthOffice} from '../../src/server/cards/base/EarthOffice';
import {Mine} from '../../src/server/cards/base/Mine';
import {Fish} from '../../src/server/cards/base/Fish';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';

/*
 * A TRIGGERED EFFECT THAT ASKS SOMETHING IS A STAGE OF THE PLAY THAT SET IT
 * OFF — and the mechanism that puts it there is STRUCTURAL, not a per-card
 * arrangement: the play claims `'effect'`, and the workspace hosts whatever the
 * console's decision adapter can represent honestly (`buildEffectDecision`).
 *
 * THIS SPEC IS THE WORKLIST FOR THAT CLAIM. It walks every premium-scope card
 * whose effect triggers on a CARD PLAY and demands a decision, builds the REAL
 * prompt the server would send, and asserts the adapter accepts it — because
 * the day it does not, the flow silently degrades to a full-bleed band over the
 * workspace that produced it, and nothing else in the suite would notice.
 *
 * It deliberately crosses the layer boundary (server card → `getWaitingFor` →
 * the pure client adapter): the contract IS the seam between them, and testing
 * either half alone is what let a hand-authored fixture drift away from the
 * shape the server actually sends. The adapter is pure TS with no Vue and no
 * DOM, so it runs here unchanged.
 *
 * ⚠️ A CARD THAT FAILS HERE IS NOT A BUG IN THIS FILE. It means the adapter has
 * met a shape it cannot serve, and the answer is to teach `buildEffectDecision`
 * that shape — never to drop the row (see `docs/claude/console/workspace-band.md`
 * § СРАБОТАВШИЙ ЭФФЕКТ).
 *
 * THE FRONTIER, stated so nobody has to rediscover it: the adapter serves a
 * branch that RESOLVES on the press and a branch that opens the player's OWN
 * hand. A branch that picks somebody ELSE'S card (the animal half of «Вирус»
 * when the table holds one) is refused — WHOLE prompt included — and keeps the
 * ordinary task host, which is the honest fallback and not a regression. Same
 * for a play's non-`choice` sub-prompts (`player` / `amount`): those are the
 * task host's, and re-homing them is a separate, deliberate step.
 */
describe('embedded effect decisions — every play-triggered ask in scope', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2);
  });

  /**
   * Fire a trigger the way `Player.onCardPlayed` does.
   *
   * The hooks are not uniform and must not be assumed to be — the signature
   * says so: some `defer()` their own prompt and return `void` (Mars
   * University, Viral Enhancers, Splice), others RETURN the input for the
   * caller to queue (Recyclon). Calling one directly and only draining the
   * queue silently tests nothing at all — this spec's first run «passed» a card
   * whose prompt had never been raised.
   */
  function trigger(raised: PlayerInput | void | undefined): void {
    if (raised !== undefined) {
      player.defer(raised);
    }
  }

  /** The prompt the SERVER would actually send, as the client would read it. */
  function promptModel(): PlayerInputModel {
    runAllActions(game);
    const input = player.popWaitingFor();
    expect(input, 'the effect must actually raise a prompt').is.not.undefined;
    const model = Server.getWaitingFor(player, input);
    expect(model, 'the prompt must serialize').is.not.undefined;
    return model as PlayerInputModel;
  }

  /** …and the verdict: the workspace can host it, with the source named. */
  function expectEmbeddable(source: string): void {
    const handNames = new Set(player.cardsInHand.map((c) => c.name as string));
    const vm = buildEffectDecision(promptModel(), {handNames});
    expect(vm, 'the console must be able to present this decision INSIDE the play').is.not.undefined;
    expect(vm?.source?.card, 'the stage must name the card that asked').to.eq(source);
    expect(vm?.stageKey, 'and carry a crumb tail for the hosting workspace').is.not.eq('');
    expect(vm?.actions.length, 'every branch must be pressable').is.greaterThan(1);
  }

  /** Put an effect card on the table (its own play is not the subject here). */
  function onTable<T extends ICard>(card: T): T {
    player.playedCards.push(card as never);
    return card;
  }

  it('Mars University — «сбросить карту и взять новую» (a branch that opens the hand)', () => {
    const card = onTable(new MarsUniversity());
    player.cardsInHand.push(new EarthOffice());
    trigger(card.onCardPlayed(player, new Research()));
    expectEmbeddable(card.name);
  });

  it('Olympus Conference — «снять жетон / положить жетон» (both resolve on the press)', () => {
    const card = onTable(new OlympusConference());
    card.resourceCount = 1; // with none there is nothing to remove and no question
    trigger(card.onCardPlayed(player, new Research()));
    expectEmbeddable(card.name);
  });

  it('Viral Enhancers — «жетон на сыгранную карту / растение»', () => {
    const card = onTable(new ViralEnhancers());
    // The played card must be able to HOLD the resource, or the effect pays
    // plants outright and asks nothing.
    trigger(card.onCardPlayed(player, new Fish()));
    expectEmbeddable(card.name);
  });

  it('Recyclon — «снять 2 микроба ради производства / положить микроб»', () => {
    const card = onTable(new Recyclon());
    card.resourceCount = 2; // below that it simply takes one and asks nothing
    trigger(card.onCardPlayed(player, new Mine()));
    expectEmbeddable(card.name);
  });

  it('Splice — «микроб / M€», asked of whoever played the microbe tag', () => {
    const [g, cardPlayer, spliceOwner] = testGame(2);
    game = g;
    player = cardPlayer;
    spliceOwner.playedCards.push(new Splice() as never);
    const card = new Splice();
    // The prompt is deferred on the card PLAYER, even when Splice is somebody
    // else's — which is exactly why it belongs to THEIR play's workspace.
    trigger(card.onCardPlayedByAnyPlayer(spliceOwner, new Tardigrades(), cardPlayer));
    expectEmbeddable(card.name);
  });

  it('Pharmacy Union — «перевернуть карту ради ПТ / ничего» (a real decline)', () => {
    const card = onTable(new PharmacyUnion());
    card.resourceCount = 0; // no diseases left → the science-tag offer
    trigger(card.onNonCardTagAdded(player, 'science' as never));
    expectEmbeddable(card.name);
  });

  /*
   * …AND THE ATTACK a play makes IS ONE OF THESE TOO — the same claim, the same
   * surface, the crumb tail just reads «АТАКА» instead of «ЭФФЕКТ». «Вирус» is
   * the scope's example, and it is also the FRONTIER: which shape it sends
   * depends on what the table holds.
   */
  describe('Virus — the play\'s own attack', () => {
    it('is hosted when every branch is a plain target («убрать растения у X»)', () => {
      const [g, attacker, victim] = testGame(2);
      game = g;
      player = attacker;
      victim.stock.add(Resource.PLANTS, 5);
      trigger(new Virus().bespokePlay(attacker));
      expectEmbeddable(CardName.VIRUS);
    });
  });
});

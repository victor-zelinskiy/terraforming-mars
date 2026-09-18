import {IGame} from '../IGame';
import {IPlayer, PendingCardIntake} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {IProjectCard} from '../cards/IProjectCard';
import {SelectCard} from '../inputs/SelectCard';
import {Priority} from './Priority';
import {LogHelper} from '../LogHelper';
import {message} from '../logs/MessageBuilder';
import {ExternalDrawCause, ExternalDrawTakeMeta} from '../../common/models/ExternalDrawPromptModel';
import {ChoiceContextSource} from '../../common/models/PlayerInputModel';

/**
 * EXTERNAL CARD DRAW — the mandatory-intake path for every draw an effect
 * grants a player OUTSIDE their own managed flow (another human or MarsBot set
 * it off): Solar Logistics reacting to a foreign space event, Sponsored
 * Academies' «all opponents draw 1 card», and any future member of the class.
 *
 * Contract (the three halves are deliberately split in time):
 *  1. GAME RECEIPT happens at the TRIGGER: the cards leave the deck now, the
 *     draw is journaled (names private to the recipient) and recorded in the
 *     event stream inside the caller's effect scope — deck order and
 *     distribution can never depend on when (or in what order) recipients
 *     answer.
 *  2. HAND AVAILABILITY happens at the TAKE: the cards sit in
 *     `player.pendingCardIntakes` (serialized game state), NOT in
 *     `cardsInHand`, so no hand projection, discard/sale prompt or counter can
 *     see them early. Taking a subset moves exactly those cards; the prompt
 *     re-issues with the remainder under the SAME intake id, so a partial take
 *     survives reload as ordinary state.
 *  3. The PROMPT is a re-derivable projection of the intake (deferred actions
 *     are not serialized): {@link ExternalDrawIntake.rebuildPrompts} re-defers
 *     it on load — unlike the transient reveal queue, nothing is lost.
 *
 * A MarsBot recipient never reaches this module: bot-facing draw effects
 * resolve per the Automa rules at their call sites (e.g. Sponsored Academies'
 * FAQ «MarsBot gains 1 M€ instead»).
 *
 * THE CAUSE IS DATA (`ExternalDrawCause`), never a card field: the same three
 * halves carry an ENACTED RESOLUTION's draw (Turmoil Redux — Climate
 * Research's «draw 1 card for every 3 steps of heat production»). A caller
 * that owns the WAIT itself — the political phase, whose driver may not move
 * on while a mandatory take is owed — uses {@link ExternalDrawIntake.open} +
 * {@link ExternalDrawIntake.takePromptFor} and keeps the prompt; every other
 * caller uses {@link ExternalDrawIntake.grant}, which defers it.
 */
export class ExternalDrawIntake {
  /** The priority a RE-ISSUED prompt keeps its batch together with (outranks a
   *  second intake's BACK_OF_THE_LINE entry — the Pluto «continuation of the
   *  same delivery» precedent). */
  private static readonly CONTINUATION_PRIORITY = Priority.SUPERPOWER;

  /**
   * Fire the whole intake for `count` cards: draw now, journal, record, queue
   * the mandatory take prompt on the recipient. Call from inside the effect's
   * own event scope (`withEffect` / the play's action scope) so the draw is
   * attributed to the effect that granted it.
   */
  public static grant(recipient: IPlayer, count: number, ctx: {
    effectCard: ICard,
    effectCardOwner: 'you' | 'initiator',
    initiator: IPlayer,
    triggerCard?: ICard,
  }): void {
    const intake = ExternalDrawIntake.open(recipient, count, {
      kind: 'card',
      effectCard: ctx.effectCard.name,
      effectCardOwner: ctx.effectCardOwner,
      initiator: ctx.initiator.color,
      ...(ctx.triggerCard === undefined ? {} : {triggerCard: ctx.triggerCard.name}),
    });
    if (intake !== undefined) {
      recipient.defer(() => ExternalDrawIntake.takePromptFor(recipient, intake), Priority.BACK_OF_THE_LINE);
    }
  }

  /**
   * THE GAME RECEIPT alone: draw now, journal, record, push the intake — and
   * hand it back. The caller then owns the prompt (`takePromptFor`) and
   * therefore owns the wait. Undefined when the deck supplied nothing (named
   * in the journal — never a silent loss).
   */
  public static open(recipient: IPlayer, count: number, cause: ExternalDrawCause): PendingCardIntake | undefined {
    if (recipient.isMarsBot) {
      throw new Error(`External draw intake granted to MarsBot by ${ExternalDrawIntake.causeLabel(cause)} — bot recipients resolve per Automa rules at the call site`);
    }
    const game = recipient.game;
    game.resettable = false;
    const cards = count <= 0 ? [] : game.projectDeck.drawN(game, count);
    if (cards.length === 0) {
      // No silent loss: the skipped effect names itself.
      if (cause.kind === 'card') {
        game.log('${0} drew no cards with ${1} (the deck is empty)',
          (b) => b.player(recipient).cardName(cause.effectCard));
      } else {
        game.log('${0} drew no cards from ${1} (the deck is empty)',
          (b) => b.player(recipient).resolution(cause.resolution));
      }
      return undefined;
    }
    // Same journal shape as an ordinary kept draw: public count, private names.
    game.log('${0} drew ${1} card(s)', (b) => b.player(recipient).number(cards.length));
    LogHelper.logDrawnCards(recipient, cards, /* privateMessage= */ true);
    game.events?.recordCardsDrawn(recipient, cards.length, undefined, {externalIntake: true});

    const intake: PendingCardIntake = {
      id: ExternalDrawIntake.nextId(recipient),
      count: cards.length,
      cards: [...cards],
      cause,
    };
    recipient.pendingCardIntakes.push(intake);
    return intake;
  }

  /** Is `intake` still owed (a defensive rebuild / a raced re-defer sees none)? */
  public static isPending(recipient: IPlayer, intake: PendingCardIntake): boolean {
    return intake.cards.length > 0 && recipient.pendingCardIntakes.includes(intake);
  }

  /** The recipient's intake with `id`, while it is still owed. */
  public static pendingOf(recipient: IPlayer, id: number): PendingCardIntake | undefined {
    return recipient.pendingCardIntakes.find((intake) => intake.id === id && intake.cards.length > 0);
  }

  private static causeLabel(cause: ExternalDrawCause): string {
    return cause.kind === 'card' ? cause.effectCard : cause.resolution;
  }

  /**
   * Re-derive the take prompts after deserialization. Deferred actions are NOT
   * serialized (`Game.serialize` → `deferredActions: []`), so this is what
   * makes a pending intake — unlike a transient reveal — survive a reload with
   * nothing lost and nothing double-drawn: the cards already left the deck.
   */
  public static rebuildPrompts(game: IGame): void {
    for (const player of game.players) {
      if (player.isMarsBot) {
        continue;
      }
      for (const intake of player.pendingCardIntakes) {
        player.defer(() => ExternalDrawIntake.takePromptFor(player, intake), Priority.BACK_OF_THE_LINE);
      }
    }
  }

  /**
   * The mandatory take, as a PROJECTION of the intake — re-derivable at any
   * moment (a reload, a partial take, a caller that owns the wait). Undefined
   * once nothing is owed.
   */
  public static takePromptFor(recipient: IPlayer, intake: PendingCardIntake): SelectCard<IProjectCard> | undefined {
    if (!ExternalDrawIntake.isPending(recipient, intake)) {
      // Already fully taken (an idempotent rebuild / a raced re-defer).
      return undefined;
    }
    const cause = intake.cause;
    const title = cause.kind === 'card' ?
      message('Take ${0} card(s) drawn by ${1}', (b) => b.number(intake.cards.length).cardName(cause.effectCard)) :
      message('Take ${0} card(s) drawn by ${1}', (b) => b.number(intake.cards.length).resolution(cause.resolution));
    const prompt = new SelectCard(
      title,
      'Take',
      intake.cards,
      // played: false → the model carries calculated costs; unplayable reasons
      // feed the console's availability rail (Inventrix-style modifiers are
      // already folded in server-side).
      {min: 1, max: intake.cards.length, played: false, showUnplayableReasons: true})
      .markExternalDrawPrompt(ExternalDrawIntake.meta(intake))
      .andThen((taken) => {
        ExternalDrawIntake.take(recipient, intake, taken);
        return undefined;
      });
    if (cause.kind === 'resolution') {
      // A RESOLUTION asks: the same source marker every other resolution
      // prompt carries, so the mandatory plate, the source dock (the
      // resolution's own face, its code, L3) and the enactment stage read
      // this take like any other payout — structurally, never by a title.
      const source: ChoiceContextSource = {kind: 'resolution', resolution: cause.resolution};
      prompt.markChoiceContext({source, trigger: 'The enacted resolution draws these cards for you', mode: 'reward'});
    }
    return prompt;
  }

  private static meta(intake: PendingCardIntake): ExternalDrawTakeMeta {
    return {
      intakeId: intake.id,
      count: intake.count,
      remaining: intake.cards.length,
      cause: intake.cause,
    };
  }

  /** Move the taken cards into the hand; re-issue the prompt for a remainder. */
  private static take(recipient: IPlayer, intake: PendingCardIntake, taken: ReadonlyArray<IProjectCard>): void {
    for (const card of taken) {
      const idx = intake.cards.indexOf(card);
      if (idx === -1) {
        // SelectCard.process already validated membership; belt and braces.
        continue;
      }
      intake.cards.splice(idx, 1);
      recipient.cardsInHand.push(card);
    }
    if (intake.cards.length > 0) {
      recipient.defer(() => ExternalDrawIntake.takePromptFor(recipient, intake), ExternalDrawIntake.CONTINUATION_PRIORITY);
    } else {
      recipient.pendingCardIntakes = recipient.pendingCardIntakes.filter((i) => i !== intake);
    }
  }

  private static nextId(recipient: IPlayer): number {
    let max = 0;
    for (const intake of recipient.pendingCardIntakes) {
      max = Math.max(max, intake.id);
    }
    return max + 1;
  }
}

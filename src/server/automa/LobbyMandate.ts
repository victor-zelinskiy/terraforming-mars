/*
 * THE LOBBYING MANDATE — how many FURTHER delegates MarsBot sends in one
 * generation, beyond Party Politics' one (Turmoil Redux, docs/TURMOIL_REDUX_MARSBOT.md
 * §3.2, the owner's decision D14 of 2026-10-25).
 *
 * The owner's targets: the bot's further votes are FREE (its M€ are its late
 * score — 8 M€/VP early, down to 1 M€/VP — and a resolution never pays it, so
 * a paid delegate was a sure loss of points); USUALLY few, SOMETIMES many;
 * about 30 % of the generations with no further delegate at all; ALL its
 * delegates in about 3 % of the generations; never more than TWO a turn (a
 * player's pace).
 *
 * A face-down deck of 33 mandate cards does it at the table: one is drawn per
 * generation, and nobody sees it until the generation's end. Digitally the
 * draw is a stream of its own (the game's seed × the generation), so it never
 * shifts the game's shared RNG — a mandate is not a reason for the next deal
 * to change.
 *
 * THE PACE (`lobbyingThisTurn`, pure): after each card the bot resolves, a
 * project card whose cost is divisible by 3 sends one delegate while the
 * mandate lasts (the official generator, «the price divisible by 3», taken
 * from the card the bot already played); and when what is left cannot be sent
 * any more at two a turn over the cards still in the action deck, the bot
 * catches up NOW. So the delegates arrive in different turns and in an order
 * nobody can read off the deck — and a mandate of ALL always lands.
 */
import {PARLIAMENT_DELEGATES_PER_PLAYER} from '../../common/parliament/ParliamentTypes';
import {BonusCardId} from '../../common/automa/AutomaTypes';
import {SeededRandom} from '../../common/utils/Random';
import {IGame} from '../IGame';
import type {AutomaActionCard} from './AutomaState';

/** A mandate card: the number of further delegates, or ALL of them. */
export type LobbyMandateCard = number | 'all';

/**
 * The generation's mandate — the card drawn, how many delegates it has already
 * sent, and whether it LAPSED (a vote refused — no resolution, no delegate
 * left: said once, never again on every turn left).
 */
export type LobbyMandate = {generation: number; card: LobbyMandateCard; sent: number; lapsed?: boolean};

/**
 * THE MANDATE DECK — 33 cards. 0 · 1 · 2 · 3 · 4 · 5 · ALL in 10 · 8 · 6 · 4 · 3 · 1 · 1:
 * 30.3 % · 24.2 % · 18.2 % · 12.1 % · 9.1 % · 3.0 % · 3.0 %. The knob of the
 * whole rule — a softer or a harder bot is another deck, never another code path.
 */
export const LOBBY_MANDATE_DECK: ReadonlyArray<LobbyMandateCard> = [
  ...Array<number>(10).fill(0),
  ...Array<number>(8).fill(1),
  ...Array<number>(6).fill(2),
  ...Array<number>(4).fill(3),
  ...Array<number>(3).fill(4),
  5,
  'all',
];

/** At most this many of the bot's delegates a turn — Party Politics' own included (a player's pace). */
export const MAX_BOT_DELEGATES_PER_TURN = 2;

/** The price divisible by this sends one delegate of the mandate (the official generator). */
export const LOBBYING_DIVISOR = 3;

/** How many further delegates a card means: ALL = every delegate but Party Politics' one. */
export function mandateSize(card: LobbyMandateCard): number {
  return card === 'all' ? PARLIAMENT_DELEGATES_PER_PLAYER - 1 : card;
}

/** Does a played project card of `cost` send one delegate of the mandate on its own? */
export function lobbyingTrigger(cost: number): boolean {
  return cost % LOBBYING_DIVISOR === 0;
}

/** Party Politics — the one card of the action deck that sends a delegate of its own. */
function isPartyPolitics(card: AutomaActionCard): boolean {
  return card.kind === 'bonus' && card.id === BonusCardId.B21_PARTY_POLITICS;
}

/** What the bot can still send over `deck`, at two a turn — one beside Party Politics' own. */
export function turnCapacity(deck: ReadonlyArray<AutomaActionCard>): number {
  return deck.reduce((sum, card) => sum + MAX_BOT_DELEGATES_PER_TURN - (isPartyPolitics(card) ? 1 : 0), 0);
}

export type LobbyingStep = {
  /** Delegates of the mandate still to send. */
  left: number;
  /** The card just resolved — a project card whose cost is divisible by 3 triggers one. */
  trigger: boolean;
  /** The card just resolved was Party Politics (its own delegate takes one of the turn's two places). */
  partyPolitics: boolean;
  /** What the cards still in the action deck can carry (`turnCapacity`). */
  ahead: number;
};

/**
 * HOW MANY THE BOT SENDS THIS TURN, and why — pure. The trigger sends one;
 * what the deck ahead can no longer carry is sent now (the catch-up); never
 * more than the turn's places, never more than what is left. `byTrigger` is
 * the delegate the played card's cost sent (0 or 1), `byMandate` the rest.
 */
export function lobbyingThisTurn(step: LobbyingStep): {count: number; byTrigger: number; byMandate: number} {
  const places = MAX_BOT_DELEGATES_PER_TURN - (step.partyPolitics ? 1 : 0);
  const owed = Math.max(0, step.left - step.ahead);
  const wanted = Math.max(step.trigger ? 1 : 0, owed);
  const count = Math.max(0, Math.min(step.left, places, wanted));
  const byTrigger = step.trigger && count > 0 ? 1 : 0;
  return {count, byTrigger, byMandate: count - byTrigger};
}

/** The generation's card, off a stream of its own: the game's seed × the generation. */
export function drawLobbyMandate(game: IGame): LobbyMandateCard {
  const stream = new SeededRandom(0, ((game.rng.seed * 4294967296) ^ Math.imul(game.generation, 0x9E3779B1)) | 0);
  return LOBBY_MANDATE_DECK[stream.nextInt(LOBBY_MANDATE_DECK.length)];
}

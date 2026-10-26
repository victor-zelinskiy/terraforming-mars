/*
 * THE LOBBYING MANDATE — how many FURTHER delegates MarsBot sends in one
 * generation, beyond Party Politics' one (Turmoil Redux, docs/TURMOIL_REDUX_MARSBOT.md
 * §3.2, the owner's decision D14 of 2026-10-25).
 *
 * The owner's targets (D14): the bot's further votes are FREE (its M€ are its late
 * score — 8 M€/VP early, down to 1 M€/VP — and a resolution never pays it, so
 * a paid delegate was a sure loss of points); USUALLY few, SOMETIMES many;
 * ALL its delegates rare but never under 1 % of the generations; never more
 * than TWO a turn (a player's pace).
 *
 * One mandate is drawn per generation, and nobody sees it until the
 * generation's end. The draw follows the game's TEMPO (D15, the owner's
 * decision of 2026-10-26): the terraforming progress the player reads on the
 * HUD (`common/game/terraformingProgress.ts` — temperature, oxygen, oceans).
 * Early on the bot is cautious (one or two delegates in ~72 % of the
 * generations), towards the end it grows bolder (six and seven at 5 % each,
 * never more) — a straight blend of two anchor tables, so the drift has no
 * step a player could feel. Digitally the draw is a stream of its own (the
 * game's seed × the generation), so it never shifts the game's shared RNG — a
 * mandate is not a reason for the next deal to change.
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
import {terraformingProgress} from '../../common/game/terraformingProgress';
import {BonusCardId} from '../../common/automa/AutomaTypes';
import type {MarsBotVoteHold} from '../../common/automa/MarsBotTurn';
import {SeededRandom} from '../../common/utils/Random';
import {IGame} from '../IGame';
import type {AutomaActionCard} from './AutomaState';

/** A mandate card: the number of further delegates, or ALL of them. */
export type LobbyMandateCard = number | 'all';

/** Why the bot KEPT a delegate it was ready to send (D15) — a fact about the vote, never a guess (`BotVoteStakes.ts`). */
export type BotVoteHold = MarsBotVoteHold;

/**
 * The generation's mandate — the card drawn, the tempo it was drawn at (0..1),
 * how many delegates it has already sent, whether it LAPSED (a vote refused —
 * no resolution, no delegate left: said once, never again on every turn left)
 * and whether the bot HELD the rest (the vote decided, or out of its reach —
 * the mandate stands, the bot simply has no use for a delegate; said once).
 */
export type LobbyMandate = {
  generation: number;
  card: LobbyMandateCard;
  sent: number;
  tempo?: number;
  lapsed?: boolean;
  held?: BotVoteHold;
};

/** The mandate cards, in the order of the anchor tables below. */
export const LOBBY_MANDATE_CARDS: ReadonlyArray<LobbyMandateCard> = [0, 1, 2, 3, 4, 5, 'all'];

/**
 * THE TWO ANCHORS (percent, aligned with `LOBBY_MANDATE_CARDS`; each sums to 100):
 * the mandate's odds at tempo 0 (the first generation) and at tempo 1 (Mars
 * terraformed). In delegates a generation, Party Politics' one included:
 * early 1 · 2 = 42 % · 30 %, ALL 1 % (never under the owner's floor); late
 * 6 · 7 = 5 % · 5 % (the owner's ceiling). Halfway they blend into the D14
 * deck (≈ 30 · 24 · 18 · 12 · 9 · 3.5 · 3). The knob of the whole rule — a
 * softer or a harder bot is another pair of tables, never another code path.
 */
export const LOBBY_MANDATE_EARLY: ReadonlyArray<number> = [42, 30, 14, 7, 4, 2, 1];
export const LOBBY_MANDATE_LATE: ReadonlyArray<number> = [19, 18, 22, 17, 14, 5, 5];

/** The game's tempo, 0..1 — the terraforming progress the HUD shows (temperature, oxygen, oceans; never Venus). */
export function gameTempo(game: IGame): number {
  return terraformingProgress({
    temperature: game.getTemperature(),
    oxygenLevel: game.getOxygenLevel(),
    oceans: game.board.getOceanSpaces().length,
  }).total;
}

/** The mandate's odds at `tempo` — a straight blend of the anchors (percent, aligned with `LOBBY_MANDATE_CARDS`). */
export function mandateWeights(tempo: number): Array<number> {
  const t = Math.max(0, Math.min(1, tempo));
  return LOBBY_MANDATE_EARLY.map((early, i) => (1 - t) * early + t * LOBBY_MANDATE_LATE[i]);
}

/** The card a uniform `u` in [0, 1) lands on over `weights`. */
export function pickMandate(weights: ReadonlyArray<number>, u: number): LobbyMandateCard {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let at = u * total;
  for (let i = 0; i < weights.length; i++) {
    at -= weights[i];
    if (at < 0) {
      return LOBBY_MANDATE_CARDS[i];
    }
  }
  return LOBBY_MANDATE_CARDS[LOBBY_MANDATE_CARDS.length - 1];
}

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

/** The generation's card at the game's tempo, off a stream of its own: the game's seed × the generation. */
export function drawLobbyMandate(game: IGame): {card: LobbyMandateCard; tempo: number} {
  const stream = new SeededRandom(0, ((game.rng.seed * 4294967296) ^ Math.imul(game.generation, 0x9E3779B1)) | 0);
  const tempo = gameTempo(game);
  return {card: pickMandate(mandateWeights(tempo), stream.next()), tempo};
}

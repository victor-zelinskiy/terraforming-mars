/*
 * A PARTY'S ANSWER TO A RESOLUTION, the CLIENT reading (Turmoil Redux).
 *
 * An enacted resolution does not only pay its own effect: it puts its PARTY in
 * power, and the party's passive then answers what the resolution just did.
 * Climate Research raises heat production, and the Greens — who rule the
 * moment the card is enacted — answer every step of it with a step of M€
 * production. A forecast that showed the heat and stayed silent about the M€
 * would understate the card by half.
 *
 * So the reading is built HERE, from the party's DECLARED reactions
 * (`common/parliament/partyReactions.ts` — the same rule the live hook runs)
 * and the steps the resolution's own declaration says it will pay. Pure: no
 * Vue, no DOM, no i18n — English keys and numbers.
 *
 * THE MOMENTS are told apart, because they answer different questions:
 *   `conditional` — the card is UP FOR THE VOTE: if it is enacted its party
 *                   RULES, so the answer counts even while another party is in
 *                   power right now;
 *   `resolving`   — the chain is being paid: the steps are the server's own;
 *   `applied`     — recorded: what the answer actually came to.
 */
import {Color} from '@/common/Color';
import {Resource} from '@/common/Resource';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {InfluenceScaledEffect, InfluenceYield} from '@/common/parliament/influenceScaling';
import {PartyReaction, PartyReactionGain, partyReactionAmount, productionReactionOf} from '@/common/parliament/partyReactions';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {getPartyEffect} from '@/client/parliament/ClientParliamentManifest';

export type PartyReactionMoment = 'conditional' | 'resolving' | 'applied';

/** ONE reading: whose rule, what it answers, how much — for one moment. */
export type PartyReactionReading = {
  party: ReduxParty;
  reaction: PartyReaction;
  moment: PartyReactionMoment;
  /** The units of the trigger this reading stands on (production steps). */
  units: number;
  /** What the party pays for them. */
  amount: number;
  /**
   * WHAT it answered, concretely — the effect's own unit, not the first of the
   * reaction's trigger list. The Greens answer plant AND heat production; a
   * block that drew the plant plate beside a heat raise would name the wrong
   * cause while the number beside it was right.
   */
  trigger: PartyReactionGain;
};

/** The gain's icon family — the same vocabulary the yield block draws. */
export function reactionGainIcon(reaction: PartyReaction): {resource: Resource, production: boolean} {
  return {resource: reaction.gain.resource, production: reaction.gain.kind === 'production'};
}

/** …and the icon of what it ANSWERED, for the «per» side of the row. */
export function reactionTriggerIcon(reading: PartyReactionReading): {resource: Resource, production: boolean} {
  return {resource: reading.trigger.resource, production: reading.trigger.kind === 'production'};
}

/**
 * The reaction the resolution's OWN party would make to `effect` — undefined
 * when the party's passive says nothing about what the effect pays. Only a
 * PRODUCTION-raising effect has an answer today; the vocabulary grows with the
 * declarations, never with a special case here.
 */
export function reactionForEffect(party: ReduxParty, effect: InfluenceScaledEffect): PartyReaction | undefined {
  if (effect.unit.kind !== 'production') {
    return undefined;
  }
  return productionReactionOf(getPartyEffect(party)?.reactions, effect.unit.resource);
}

/**
 * The viewer's reading of the party's answer, for `steps` of the effect's own
 * payout. Zero steps yield NO reading: an answer to nothing is not a promise
 * the surface may print.
 */
export function partyReactionReading(
  party: ReduxParty,
  reaction: PartyReaction,
  steps: number,
  moment: PartyReactionMoment,
  trigger: PartyReactionGain,
): PartyReactionReading | undefined {
  const amount = partyReactionAmount(reaction, steps);
  return amount <= 0 ? undefined : {party, reaction, moment, units: steps, amount, trigger};
}

/**
 * Every reading a resolution's scaled parts imply for the VIEWER, at the
 * moment the surface is in. `yields` are the readings already computed for the
 * effects themselves (`influenceYieldModel`) — the answer stands on the very
 * numbers printed beside it, so the two can never disagree.
 *
 * A `forecast` reading wins over an `estimate` of the same effect (the vote
 * surface shows both; the party's answer follows the bigger promise the player
 * is being offered), and a recorded one wins over both.
 */
export function partyReactionsOf(
  resolution: IClientResolution | undefined,
  yields: ReadonlyArray<InfluenceYield>,
): Array<PartyReactionReading> {
  if (resolution === undefined) {
    return [];
  }
  const out: Array<PartyReactionReading> = [];
  for (const effect of resolution.scaled ?? []) {
    const reaction = reactionForEffect(resolution.party, effect);
    if (reaction === undefined) {
      continue;
    }
    const mine = yields.filter((y) => y.effect.id === effect.id && y.amount !== undefined && y.skipped === undefined);
    // The most COMMITTED reading available: recorded, then live, then the
    // «if you win» promise, then today's estimate.
    const chosen = mine.find((y) => y.context === 'applied') ?? mine.find((y) => y.context === 'resolving') ??
      mine.find((y) => y.context === 'forecast') ?? mine.find((y) => y.context === 'estimate');
    if (chosen === undefined) {
      continue;
    }
    const moment: PartyReactionMoment = chosen.context === 'applied' ? 'applied' :
      chosen.context === 'resolving' ? 'resolving' : 'conditional';
    const reading = partyReactionReading(resolution.party, reaction, chosen.amount ?? 0, moment,
      // The effect's OWN unit is what the party answered.
      {kind: 'production', resource: (effect.unit as {resource: Resource}).resource});
    if (reading !== undefined) {
      out.push(reading);
    }
  }
  return out;
}

/**
 * The caption under a reading — WHICH question it answers (English keys). A
 * conditional one says the party would be in power; the others state the fact.
 */
export function reactionCaptionOf(reading: PartyReactionReading): string {
  switch (reading.moment) {
  case 'conditional': return 'The ruling party answers';
  case 'resolving': return 'The ruling party answers';
  // The caption names the SOURCE and stays the same before and after the record (glossary §6, R-07):
  // the reward panel's kicker carries the state («ЭТА ВЫПЛАТА» → «ПОЛУЧЕНО»), never the chip.
  case 'applied': return 'The ruling party answers';
  }
}

/** A reading belongs to the viewer's own seat only — a spectator gets none. */
export function viewerHasSeat(model: ParliamentModel | undefined, viewer: Color | undefined): boolean {
  return model !== undefined && viewer !== undefined && model.players.some((p) => p.color === viewer && p.participates);
}

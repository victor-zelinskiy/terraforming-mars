import {Parliament} from '../../src/server/parliament/Parliament';
import {ReduxParty, ResolutionId, ResolutionInstanceId, resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {AQUIFER_CONTEST_ID} from '../../src/server/parliament/resolutions/greens/AquiferContest';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {CENTRAL_POWER_GRID_ID} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {DEV_COMPOUND_RESOLUTION_ID, DEV_SCIENCE_RESOLUTION_ID} from '../../src/server/parliament/resolutions/ResolutionCatalog';

/**
 * THE VOTING AREA, ARRANGED BY THE SPEC — never assumed from the deal.
 *
 * The deck is made of REAL resolutions only and dealt at random, so «which card
 * landed in which slot» is never a spec's to depend on. A spec that needs a
 * particular table seats it here, and the pool stays CONSISTENT: the seated card
 * leaves the deck, the discard, the enacted slot and any other voting slot, and
 * the card it displaces goes back to the deck — every card stays in exactly one
 * place, as the real refresh assumes.
 */
function asInstance(id: ResolutionId | ResolutionInstanceId): ResolutionInstanceId {
  return id.includes('#') ? id : resolutionInstanceId(id, 0);
}

function lift(parliament: Parliament, instance: ResolutionInstanceId): void {
  parliament.deck = parliament.deck.filter((i) => i !== instance);
  parliament.discard = parliament.discard.filter((i) => i !== instance);
  if (parliament.enacted === instance) {
    parliament.enacted = undefined;
  }
}

/**
 * Seat `id` in voting slot `index`. The area never holds two cards of one
 * party: the slot that held the seated card — or ANOTHER card of its party —
 * takes the displaced one (that other card returns to the deck); otherwise the
 * displaced card returns to the deck. A card lifted from ENACTED leaves the
 * government empty.
 */
export function seatResolution(parliament: Parliament, index: number, id: ResolutionId | ResolutionInstanceId): ResolutionInstanceId {
  const instance = asInstance(id);
  const target = parliament.slots[index];
  if (target === undefined) {
    throw new Error(`no voting slot ${index}`);
  }
  if (target.instance === instance) {
    return instance;
  }
  const displaced = target.instance;
  lift(parliament, instance);
  const party = parliament.resolutionOf(instance).party;
  const rival = parliament.slots.find((slot) => slot !== target &&
    (slot.instance === instance || parliament.resolutionOf(slot.instance).party === party));
  if (rival !== undefined) {
    if (rival.instance !== instance) {
      parliament.deck.push(rival.instance);
    }
    rival.instance = displaced;
  } else {
    parliament.deck.push(displaced);
  }
  target.instance = instance;
  return instance;
}

/**
 * Make `id` the ENACTED card (the government) — it leaves wherever it was. A
 * voting slot it stood in takes a card of another party from the deck, or —
 * exactly as the real refresh does when nothing fits — is left out of the area.
 */
export function seatEnacted(parliament: Parliament, id: ResolutionId | ResolutionInstanceId): ResolutionInstanceId {
  const instance = asInstance(id);
  lift(parliament, instance);
  const slot = parliament.slots.find((s) => s.instance === instance);
  if (slot !== undefined) {
    const taken = new Set(parliament.slots.filter((s) => s !== slot).map((s) => parliament.resolutionOf(s.instance).party));
    taken.add(parliament.resolutionOf(instance).party);
    const replacement = parliament.deck.find((i) => !taken.has(parliament.resolutionOf(i).party));
    if (replacement === undefined) {
      parliament.slots = parliament.slots.filter((s) => s !== slot);
    } else {
      lift(parliament, replacement);
      slot.instance = replacement;
    }
  }
  const previous = parliament.enacted;
  if (previous !== undefined && previous !== instance) {
    parliament.discard.push(previous);
  }
  parliament.enacted = instance;
  return instance;
}

/**
 * A REAL resolution of `party` whose enactment ASKS NOTHING at a fresh table —
 * the stand-in a spec seats when its subject is the PHASE, not a card:
 *  - the Greens: Aquifer Contest (its animals go to a holder, and a fresh
 *    table has none — the share is named and forfeited, nothing is asked);
 *  - Mars First: Architecture Award, the Industrialists: Central Power Grid
 *    (M€ production, never a choice).
 * The parties with no real resolution yet are never dealt, so they never need one.
 */
export function quietResolutionOf(party: ReduxParty): ResolutionId {
  switch (party) {
  case PartyName.GREENS: return AQUIFER_CONTEST_ID;
  case PartyName.MARS: return ARCHITECTURE_AWARD_ID;
  case PartyName.INDUSTRIALISTS: return CENTRAL_POWER_GRID_ID;
  default:
    throw new Error(`no real resolution of ${party} is dealt — a spec cannot meet one in the voting area`);
  }
}

/** Replace slot `index` with its own party's QUIET real resolution (see `quietResolutionOf`). */
export function seatQuiet(parliament: Parliament, index: number): ResolutionInstanceId {
  const party = parliament.resolutionOf(parliament.slots[index].instance).party;
  return seatResolution(parliament, index, quietResolutionOf(party));
}

/**
 * NEVER-DEALT stand-ins of parties that have no real resolution — for a spec
 * that needs a slot, or a government, of a party the deck cannot produce.
 * They are catalogued development examples (`copies: 0`), so a reload knows them.
 */
export const REDS_STAND_IN: ResolutionId = DEV_COMPOUND_RESOLUTION_ID;
export const SCIENTISTS_STAND_IN: ResolutionId = DEV_SCIENCE_RESOLUTION_ID;

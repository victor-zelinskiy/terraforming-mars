import {IPlayer} from '../../IPlayer';
import {ICard} from '../ICard';
import {PARTY_EFFECT_DELEGATES, ReduxParty, ResolutionId} from '../../../common/parliament/ParliamentTypes';
import {ActionPreviewStep} from '../../../common/models/ActionPreviewModel';
import {Parliament} from '../../parliament/Parliament';
import {message} from '../../logs/MessageBuilder';
import * as actionPreviews from '../actionPreviews';

/*
 * THE ALLIANCE CARDS' SHARED READING (Turmoil Redux — TR62 Tharsis Alliance, TR63 Eden Alliance): a card that
 * declares a PAIR of parties (`ICard.partyAlliance`) opens one side of it when the other stands by its PRINTED road
 * for the owner (it rules, or two of the owner's own delegates on its resolution). What a play opens is ONE list,
 * read twice — by the composer's preview and by the play's journal — through the Parliament's own readings, so the
 * promise and the record cannot diverge. Pure: mutates nothing.
 */

/** The composer's row for a party this play opens because its partner stands by its printed road. */
export const ALLIANCE_OPENS_RULING_NOTE = 'Opens now: the effect and cards of ${0} — ${1} is ruling';
export const ALLIANCE_OPENS_DELEGATES_NOTE = 'Opens now: the effect and cards of ${0} — two of your delegates are on ${1}';
/** …the same, for a party whose EFFECT the player already holds by another road (a grant, one delegate under TR36). */
export const ALLIANCE_OPENS_CARDS_RULING_NOTE = 'Opens now: the cards of ${0} — ${1} is ruling';
export const ALLIANCE_OPENS_CARDS_DELEGATES_NOTE = 'Opens now: the cards of ${0} — two of your delegates are on ${1}';
/** The journal's line per party the play opened. */
export const ALLIANCE_HOLDS_LINE = '${0} holds the ${1} party effect and cards: allied with ${2} (${3})';

/**
 * A party this play opens: its partner stands by its PRINTED road for the player (`road`), and the party's
 * requirement is not the player's yet. `effectHeld` — its EFFECT is already the player's by another road (a grant,
 * one delegate under Council Seat): the play opens its CARDS only.
 */
export type AllianceOpening = {
  party: ReduxParty,
  via: ReduxParty,
  road: 'ruling' | 'delegates',
  resolution?: ResolutionId,
  effectHeld: boolean,
};

/** The parties `pair` opens for `player` NOW, read off the live table through the Parliament's own readings. */
export function allianceOpenings(player: IPlayer, parliament: Parliament, pair: Readonly<[ReduxParty, ReduxParty]>): Array<AllianceOpening> {
  const out: Array<AllianceOpening> = [];
  for (const party of pair) {
    const via = party === pair[0] ? pair[1] : pair[0];
    const partner = parliament.access(player, via);
    const printed = partner.ruling || partner.delegates >= PARTY_EFFECT_DELEGATES;
    if (!printed) {
      continue;
    }
    const side = parliament.access(player, party);
    if (side.satisfiesRequirement) {
      continue;
    }
    const slot = parliament.slotOf(via);
    out.push({
      party,
      via,
      road: partner.ruling ? 'ruling' : 'delegates',
      ...(partner.ruling || slot === undefined ? {} : {resolution: parliament.resolutionOf(slot.instance).id}),
      effectHeld: side.hasEffect,
    });
  }
  return out;
}

/** The composer's rows for the openings — or the card's own honest «nothing yet». */
export function allianceOpeningSteps(openings: ReadonlyArray<AllianceOpening>, nothingNote: string): Array<ActionPreviewStep> {
  if (openings.length === 0) {
    return [actionPreviews.noteStep('generic', nothingNote)];
  }
  return openings.map((opening) => {
    if (opening.road === 'ruling') {
      return actionPreviews.noteStep('generic', message(opening.effectHeld ? ALLIANCE_OPENS_CARDS_RULING_NOTE : ALLIANCE_OPENS_RULING_NOTE,
        (b) => b.partyName(opening.party).partyName(opening.via)));
    }
    const resolution = opening.resolution;
    return actionPreviews.noteStep('generic', message(opening.effectHeld ? ALLIANCE_OPENS_CARDS_DELEGATES_NOTE : ALLIANCE_OPENS_DELEGATES_NOTE,
      (b) => {
        b.partyName(opening.party);
        if (resolution === undefined) {
          b.partyName(opening.via);
        } else {
          b.resolution(resolution);
        }
      }));
  });
}

/** The play's journal: one line per party it opened, under the card's own effect scope. Reads, never mutates the table. */
export function journalAllianceOpenings(player: IPlayer, card: ICard, openings: ReadonlyArray<AllianceOpening>): void {
  if (openings.length === 0) {
    return;
  }
  player.game.events.withEffect(player, card, 'card-played', () => {
    for (const opening of openings) {
      player.game.log(ALLIANCE_HOLDS_LINE, (b) => b.player(player).partyName(opening.party).partyName(opening.via).card(card));
    }
  });
}

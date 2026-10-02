import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {DeferredAction} from '../deferredActions/DeferredAction';
import {Priority} from '../deferredActions/Priority';
import {recordSkippedEffect} from '../deferredActions/skippedEffect';
import {SelectParty} from '../inputs/SelectParty';
import {ChoiceContextSource, SelectPartyModel, SupportAreaProjection} from '../../common/models/PlayerInputModel';
import {PARLIAMENT_MAX_POPULAR_SUPPORT, POPULAR_SUPPORT_LABEL, REDUX_PARTIES, ReduxParty} from '../../common/parliament/ParliamentTypes';
import {PartyName} from '../../common/turmoil/PartyName';
import type {SkippedEffect} from '../cards/actionPreviews';
import {Parliament} from './Parliament';

/** The prompt's title — an English i18n key (the journal text; the console reads the marker, never this). */
export const DISCARD_POPULAR_SUPPORT_TITLE = 'Select a Popular Support Area to discard its neutral delegates';

/** The ONE reason an empty area is shown refused — the pick would change nothing. */
export const EMPTY_SUPPORT_AREA_REASON = 'The support area is empty';

/** The cause of the named skip when no area holds a neutral delegate at all. */
export const EVERY_SUPPORT_AREA_EMPTY_REASON = 'Every Popular Support area is empty';

/**
 * What a lost «discard all neutral delegates from one Popular Support Area» is
 * NAMED by — the one description the play preview's warning
 * (`actionPreviews.supportDiscardStep`) and the after-the-fact record share:
 * the area's own label, and the cause. No magnitude: «all» of nothing.
 */
export function skippedSupportDiscard(reason: string = EVERY_SUPPORT_AREA_EMPTY_REASON): {reason: string, skipped: SkippedEffect} {
  return {reason, skipped: {label: POPULAR_SUPPORT_LABEL}};
}

/**
 * «DISCARD ALL NEUTRAL DELEGATES FROM ONE POPULAR SUPPORT AREA OF YOUR CHOICE»
 * (Turmoil Redux TR12 Party Sanctions) — the shared step any card that strips
 * a party's support inherits.
 *
 * WHO IS ASKED ABOUT WHAT:
 *  · the SIX parties of the parliament, each an AREA — the ruling party's area
 *    included: it can hold a stock (TR03 pays a resolution's party, the
 *    resolution wins and the party rules with it — `PoliticalDonation.spec`
 *    § rule 5), and a stock is a stock;
 *  · an area holding ≥ 1 neutral delegate is a CANDIDATE; an EMPTY area is
 *    shown refused with its ONE reason, never hidden — the pick would change
 *    nothing;
 *  · NO candidate at all is a NAMED skip (`recordSkippedEffect`), and the
 *    continuation (`then` — the card's next printed effect) runs anyway.
 *
 * WHAT MOVES: every neutral delegate of the chosen area returns to the common
 * supply (`Parliament.discardPopularSupport` — the supply is derived, so the
 * area emptied IS the return). Neutral delegates standing ON RESOLUTIONS are
 * votes, not support: untouched. Players' delegates: untouched.
 *
 * ONE PROMPT, BUILT ONCE, READ TWICE: `execute()` raises it and
 * `previewSelectParty()` describes it without touching anything — the play
 * preview's staged door (`actionPreviews.supportDiscardStep`) shows the very
 * prompt the commit will ask, with the `supportPrompt` projection of all six
 * areas («3 → 0», the refusals and their reason).
 *
 * `then` is the card's NEXT effect, run inside the SAME answer (TR12: «advance
 * your Agenda marker 1 step» — printed after the discard, so it is taken
 * after it, in the response to the play's one POST).
 *
 * Priority: `GAIN_RESOURCE_OR_PRODUCTION`, the delegate step's own slot
 * (`PlaceDelegatesOnResolution`), so a chairman quest the play completes —
 * gated at `BACK_OF_THE_LINE` — is asked AFTER it.
 */
export class DiscardPopularSupport extends DeferredAction<undefined> {
  constructor(
    player: IPlayer,
    /** The giver — the card being played (the prompt's `choiceContext.source`, the staged tail's address). */
    public readonly cause: ChoiceContextSource,
    /** The card's next printed effect — run after the discard (or its named skip), inside the same answer. */
    private readonly then: () => void = () => {},
  ) {
    super(player, Priority.GAIN_RESOURCE_OR_PRODUCTION);
  }

  /** Every area of the parliament, in the table's order — the candidates and the refused, with the ONE reason. */
  private static areasOf(parliament: Parliament): Array<SupportAreaProjection> {
    return REDUX_PARTIES.map((party): SupportAreaProjection => {
      const current = parliament.popularSupportOf(party);
      return current > 0 ?
        {party: party as PartyName, current, resulting: 0, available: true} :
        {party: party as PartyName, current, resulting: 0, available: false, reason: EMPTY_SUPPORT_AREA_REASON};
    });
  }

  /** The parliament and its six areas — or nothing to ask (no parliament, or every area empty). */
  private offer(): {parliament: Parliament, areas: Array<SupportAreaProjection>} | undefined {
    const parliament = this.player.game.parliament;
    if (parliament === undefined) {
      return undefined;
    }
    const areas = DiscardPopularSupport.areasOf(parliament);
    return areas.some((area) => area.available) ? {parliament, areas} : undefined;
  }

  /** The marked prompt, without its answer — the one construction both the live ask and its read-only twin use. */
  private prompt(areas: ReadonlyArray<SupportAreaProjection>): SelectParty {
    const candidates = areas.filter((area) => area.available).map((area) => area.party);
    return new SelectParty(DISCARD_POPULAR_SUPPORT_TITLE, 'Select', candidates)
      .markSupportPrompt({source: 'discard', areas})
      .markChoiceContext({source: this.cause, mode: 'effect-choice'});
  }

  /**
   * READ-ONLY: the `SelectPartyModel` the live path WOULD raise — the same
   * title, candidates, `supportPrompt` projection and giver — or `undefined`
   * exactly where `execute()` asks nothing (no parliament, every area empty,
   * MarsBot — who is never asked). Nothing is mutated, logged or queued.
   * `choiceContext` is decorated centrally on a live prompt
   * (`ServerModel.getWaitingFor`), so it is attached here by hand.
   */
  public previewSelectParty(): SelectPartyModel | undefined {
    const offer = this.offer();
    if (offer === undefined || this.player.isMarsBot) {
      return undefined;
    }
    const select = this.prompt(offer.areas);
    const model = select.toModel(this.player);
    model.choiceContext = select.choiceContext;
    return model;
  }

  public execute(): PlayerInput | undefined {
    const player = this.player;
    const offer = this.offer();
    if (offer === undefined) {
      if (player.game.parliament !== undefined) {
        const lost = skippedSupportDiscard();
        recordSkippedEffect(player, lost.reason, lost.skipped);
      }
      this.then();
      return undefined;
    }
    const {parliament, areas} = offer;
    // MARSBOT NEVER RECEIVES A PARLIAMENT PROMPT (docs/TURMOIL_REDUX_MARSBOT.md §2). The bot does not play
    // the cards that raise this step (its deck is tags); should one ever reach it, the fullest area goes —
    // decided on the spot, deterministic (the table's order breaks a tie).
    if (player.isMarsBot) {
      const fullest = areas.filter((area) => area.available).reduce((best, area) => area.current > best.current ? area : best);
      this.discard(parliament, fullest.party as ReduxParty);
      this.then();
      return undefined;
    }
    return this.prompt(areas).andThen((party) => {
      this.discard(parliament, party as ReduxParty);
      this.then();
      return undefined;
    });
  }

  /**
   * The chosen area returns its neutral delegates to the common supply. Re-read
   * at the answer — the area is what it is NOW (a reload, a sibling effect):
   * emptied meanwhile, it is the named skip, never a silent «0».
   */
  private discard(parliament: Parliament, party: ReduxParty): void {
    const player = this.player;
    const count = parliament.discardPopularSupport(party);
    if (count <= 0) {
      const lost = skippedSupportDiscard(EMPTY_SUPPORT_AREA_REASON);
      recordSkippedEffect(player, lost.reason, lost.skipped);
      return;
    }
    player.game.log('${0} discarded ${1} neutral delegate(s) from the Popular Support of ${2} (0/${3})', (b) =>
      b.player(player).number(count).partyName(party).number(PARLIAMENT_MAX_POPULAR_SUPPORT));
    player.game.events.recordPopularSupportDiscarded(player, party, count, parliament.popularSupportOf(party));
  }
}

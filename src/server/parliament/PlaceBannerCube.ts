import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {DeferredAction} from '../deferredActions/DeferredAction';
import {Priority} from '../deferredActions/Priority';
import {recordSkippedEffect} from '../deferredActions/skippedEffect';
import {SelectParty} from '../inputs/SelectParty';
import {BannerPartyProjection, ChoiceContextSource, SelectPartyModel} from '../../common/models/PlayerInputModel';
import {REDUX_PARTIES, ReduxParty} from '../../common/parliament/ParliamentTypes';
import {PartyName} from '../../common/turmoil/PartyName';
import {CardName} from '../../common/cards/CardName';
import {Parliament} from './Parliament';

/** The prompt's title — an English i18n key (the journal text; the console reads the marker, never this). */
export const PLACE_BANNER_CUBE_TITLE = 'Select a party to place your cube on its banner';

/** The ONE reason a banner already holding the seat's cube is shown refused — one cube per banner. */
export const CUBE_ALREADY_ON_BANNER_REASON = 'Your cube already stands on this banner';

/** The cause of the named skip when every banner already holds the seat's cube. */
export const EVERY_BANNER_HOLDS_YOUR_CUBE_REASON = 'Your cube already stands on every banner';

/**
 * PUT ONE OF THE SEAT'S CUBES ON A PARTY'S BANNER — the shared operation of Septem Tribus:redux (its first action
 * asks for the party; a resolution won names it). The cube IS the grant: `grantPartyEffect(player, party, source)`,
 * idempotent per (party, source), so «at least one cube» and «one cube» are the same fact. The cube gives the
 * party's EFFECT only, never its requirement (FAQ p.19 — `Parliament.access`). Logged and recorded once; a banner
 * already holding the cube records nothing (returns false).
 */
export function placeBannerCube(player: IPlayer, parliament: Parliament, party: ReduxParty, source: CardName): boolean {
  if (hasBannerCube(parliament, player, party, source)) {
    return false;
  }
  parliament.grantPartyEffect(player, party, source);
  player.game.log('${0} places a cube on the banner of ${1}', (b) => b.player(player).partyName(party));
  player.game.events.recordBannerCube(player, party);
  return true;
}

/** Does the seat's cube from `source` stand on `party`'s banner? */
export function hasBannerCube(parliament: Parliament, player: IPlayer, party: ReduxParty, source: string): boolean {
  return (parliament.grantedEffects.get(player.id) ?? []).some((grant) => grant.party === party && grant.source === source);
}

/**
 * «PLACE 1 OF YOUR CUBES ON THE BANNER OF ANY PARTY» (Septem Tribus:redux — the first action).
 *
 * WHO IS ASKED ABOUT WHAT: the SIX parties of the parliament, each a BANNER — the ruling party's included (its
 * effect is everyone's today; the cube outlives its rule). A banner already holding the seat's cube is shown
 * refused with its ONE reason, never hidden; every banner holding it → a NAMED skip. Mandatory: no «decline».
 *
 * ONE PROMPT, BUILT ONCE, READ TWICE: `execute()` raises it and `previewSelectParty()` describes it without
 * touching anything (the first-action briefing shows the very prompt the commit will ask).
 */
export class PlaceBannerCube extends DeferredAction<undefined> {
  constructor(
    player: IPlayer,
    /** The giver — the corporation (the prompt's `choiceContext.source`). */
    public readonly cause: ChoiceContextSource,
    /** The grant's source — the card whose cube it is. */
    private readonly source: CardName,
  ) {
    super(player, Priority.DEFAULT);
  }

  /** Every banner of the parliament, in the table's order — the server's projection of the answer. */
  public static partiesOf(parliament: Parliament, player: IPlayer, source: string): Array<BannerPartyProjection> {
    return REDUX_PARTIES.map((party): BannerPartyProjection => {
      const hasCube = hasBannerCube(parliament, player, party, source);
      const access = parliament.access(player, party);
      // «By another road» — the cube's own grant is not counted (a road that would vanish with the cube is not one).
      const otherRoad = access.ruling || access.byDelegates || access.allied.length > 0 || access.granted.some((g) => g !== source);
      const row: BannerPartyProjection = {party: party as PartyName, available: !hasCube, hasCube, hasEffect: otherRoad};
      if (hasCube) {
        row.reason = CUBE_ALREADY_ON_BANNER_REASON;
      }
      return row;
    });
  }

  private offer(): {parliament: Parliament, parties: Array<BannerPartyProjection>} | undefined {
    const parliament = this.player.game.parliament;
    if (parliament === undefined) {
      return undefined;
    }
    const parties = PlaceBannerCube.partiesOf(parliament, this.player, this.source);
    return parties.some((row) => row.available) ? {parliament, parties} : undefined;
  }

  private prompt(parties: ReadonlyArray<BannerPartyProjection>): SelectParty {
    const candidates = parties.filter((row) => row.available).map((row) => row.party);
    return new SelectParty(PLACE_BANNER_CUBE_TITLE, 'Place cube', candidates)
      .markBannerPrompt({source: 'first-action', parties})
      .markChoiceContext({source: this.cause, mode: 'effect-choice'});
  }

  /**
   * READ-ONLY: the `SelectPartyModel` the live path WOULD raise — or `undefined` exactly where `execute()` asks
   * nothing. Nothing is mutated, logged or queued. `choiceContext` is attached by hand (it is decorated centrally
   * on a live prompt).
   */
  public previewSelectParty(): SelectPartyModel | undefined {
    const offer = this.offer();
    if (offer === undefined || this.player.isMarsBot) {
      return undefined;
    }
    const select = this.prompt(offer.parties);
    const model = select.toModel(this.player);
    model.choiceContext = select.choiceContext;
    return model;
  }

  public execute(): PlayerInput | undefined {
    const player = this.player;
    const offer = this.offer();
    if (offer === undefined) {
      if (player.game.parliament !== undefined) {
        recordSkippedEffect(player, EVERY_BANNER_HOLDS_YOUR_CUBE_REASON, {label: 'Party banner'});
      }
      return undefined;
    }
    const {parliament} = offer;
    return this.prompt(offer.parties).andThen((party) => {
      // Re-read at the answer: placed meanwhile (a reload, a sibling effect) → nothing is placed twice.
      placeBannerCube(player, parliament, party as ReduxParty, this.source);
      return undefined;
    });
  }
}

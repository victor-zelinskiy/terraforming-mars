import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {CorporationCard} from '../corporation/CorporationCard';
import {ICorporationCard} from '../corporation/ICorporationCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ReduxParty, ResolutionId, ResolutionInstanceId, REDUX_PARTIES} from '../../../common/parliament/ParliamentTypes';
import {PlaceBannerCube, placeBannerCube} from '../../parliament/PlaceBannerCube';
import {Size} from '../../../common/cards/render/Size';
import * as actionPreviews from '../actionPreviews';

/**
 * SEPTEM TRIBUS («Septem Tribus», Turmoil Redux) — the set's REPLACEMENT CORPORATION for the classic Turmoil R15
 * (`common/cards/turmoilReduxReplacements.ts`, `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2), registered as
 * `Septem Tribus:redux` (the plain name — upstream's `SEPTUM_TRIBUS` enum — stays the classic card's; the Redux
 * manifest's `cardsToRemove` keeps the classic one out of every Redux deck). Rulebook p.12: «remove the Septem
 * Tribus corporation card from [the official Turmoil expansion]. It is not compatible with Turmoil Redux».
 *
 * SCAN READING — 40 M€; the WILD tag («?» in the tag corner — kept from the classic card). Left: «40» + the
 * wild-party pill with a white player cube in its corner and a «*» (the first action: «place 1 of your player
 * cubes on the banner of any party»). The EFFECT box: «★ : [cube on ?-party]*» (when you win on a resolution, place
 * your player cube on its party's banner) and «[cube on ?-party] EFFECT» (you gain the effect of every party whose
 * banner holds your cube — «in addition to gaining them from the ruling party and by having 2 delegates on a
 * resolution»). The classic M€-per-party ACTION is gone. Printed lore: «Septem Tribus is a secret society…» —
 * keyed `R15` and borrowed with the R15 art through `reimplements`. The number box prints no number — the card is
 * TR77, the first number past the six project replacements (`replacementCardNumber`).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/SeptemTribusRedux.spec.ts):
 *  1. A CUBE ON A BANNER IS A GRANT of that party's effect — `Parliament.grantPartyEffect(player, party, this card)`
 *     (`parliament/PlaceBannerCube.ts`), never a second state. ONE cube per banner: the rules never tell one cube
 *     from several (the owner), so a second win on the same party places nothing and records nothing.
 *  2. The cube gives the EFFECT only, never the party's REQUIREMENT (rulebook FAQ p.19 — «Septem Tribus and Council
 *     Seat only grant you the effect of the party. Not its full favor»): `access().satisfiesRequirement` ignores
 *     grants; an ALLIANCE (TR62) is never set off by a cube (it reads the printed roads only).
 *  3. FIRST ACTION (mandatory): the player picks ANY of the six parties (`PlaceBannerCube` — the ruling party
 *     included; its effect is everyone's today, the cube outlives its rule).
 *  4. «When you WIN ON A RESOLUTION» — the winning PLAYER of the sitting's winning resolution (`onResolutionWon`,
 *     called at the enactment under the step's key): the cube goes on that resolution's party's banner. A neutral
 *     win or MarsBot's places nothing (the bot never holds this card — it has no twin).
 *  5. The cubes are the corporation's: should the card leave the table (`onDiscard`), every grant of this source
 *     is revoked — the cubes leave the banners and the effects they gave go with them (owner decision 4a).
 */
export class SeptemTribusRedux extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.SEPTEM_TRIBUS_REDUX,
      tags: [Tag.WILD],
      startingMegaCredits: 40,
      initialActionText: 'Place your cube on the banner of any party',

      metadata: {
        cardNumber: 'TR77',
        reimplements: CardName.SEPTUM_TRIBUS,
        description: 'You start with 40 M€. As your first action, place your cube on the banner of any party.',
        infoText: [
          {text: 'As your first action, place your cube on the banner of any party.'},
          {kind: 'effect-short', text: 'Win a resolution: your cube on its party\'s banner', tokens: ['(vote-winner,banner-cube)']},
          {kind: 'effect-short', text: 'Cube on a banner: its effect, not its requirement', tokens: ['(banner-cube,text)']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.br.br;
          b.megacredits(40).nbsp.bannerCube().asterix();
          b.corpBox('effect', (ce) => {
            ce.vSpace(Size.LARGE);
            ce.effect('When you win on a resolution, place your cube on its party\'s banner.', (eb) => {
              eb.voteWinner({superscript: false}).startEffect.bannerCube().asterix();
            });
            ce.vSpace();
            ce.effect('You gain the effect of every party whose banner holds your cube — in addition to the ruling party and to the parties where you have 2 delegates.', (eb) => {
              eb.bannerCube().startEffect.text('effect', Size.SMALL, true);
            });
          });
        }),
      },
    });
  }

  public override initialAction(player: IPlayer) {
    if (player.game.parliament === undefined) {
      return undefined;
    }
    player.game.defer(new PlaceBannerCube(player, {kind: 'corporation', card: this.name}, this.name));
    return undefined;
  }

  /** The first action asks for the banner AFTER the confirm — the briefing says so (the Vitor precedent). */
  public firstActionPreview() {
    return actionPreviews.firstActionBranch(this, [], [
      actionPreviews.noteStep('generic', 'After confirming, choose the party whose banner takes your cube.'),
    ]);
  }

  /** Rule 4 — the winner of the won resolution puts the cube on its party's banner (one per banner: rule 1). */
  public onResolutionWon(player: IPlayer, context: {instance: ResolutionInstanceId, resolution: ResolutionId, party: ReduxParty}): void {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      return;
    }
    placeBannerCube(player, parliament, context.party, this.name);
  }

  /**
   * Rule 5 — the cubes leave with the corporation. No road of the game takes a corporation off a table today
   * (`discardPlayedCard` is the project cards'), so this is the honest answer for the day one exists.
   */
  public override onDiscard(player: IPlayer): void {
    super.onDiscard(player);
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      return;
    }
    for (const party of REDUX_PARTIES) {
      parliament.revokePartyEffect(player, party, this.name);
    }
  }
}

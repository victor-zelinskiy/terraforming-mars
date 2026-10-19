import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {ReduxParty} from '../../../common/parliament/ParliamentTypes';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {CardRenderer} from '../render/CardRenderer';
import {Parliament} from '../../parliament/Parliament';
import * as actionPreviews from '../actionPreviews';
import {AllianceOpening, allianceOpeningSteps, allianceOpenings, journalAllianceOpenings} from './partyAllianceCard';

/** The two parties the card allies — «Unity = the Greens», printed in this order. */
export const EDEN_ALLIANCE_PARTIES: Readonly<[ReduxParty, ReduxParty]> = [PartyName.UNITY, PartyName.GREENS];

/** The composer's row for a play that opens nothing yet. */
export const EDEN_ALLIANCE_NOTHING_NOTE = 'Opens nothing now: the alliance holds once Unity or the Greens rule or get two of your delegates on their resolution';
/** The card's second effect, named before the press. */
export const EDEN_ALLIANCE_TR_NOTE = 'Gain 1 TR each time Unity or the Greens become the ruling party';
/** The journal's line of the rating at an enactment. */
export const EDEN_ALLIANCE_TR_LINE = '${0} gains 1 TR: ${1} is the new ruling party (${2})';

/** The parties this play opens — the alliance cards' shared reading over this pair. */
export function edenAllianceOpenings(player: IPlayer, parliament: Parliament): Array<AllianceOpening> {
  return allianceOpenings(player, parliament, EDEN_ALLIANCE_PARTIES);
}

/**
 * TR63 — EDEN ALLIANCE, a Turmoil Redux PROJECT card — the second card of the
 * law of access's FOURTH road (`alliance`, TR62 Tharsis Alliance's class:
 * `docs/TURMOIL_REDUX_THARSIS_ALLIANCE.md`), over another pair and with
 * another answer to a change of power.
 *
 * «Effect: While Unity is ruling or you have 2 delegates there, you may also
 * use the Greens' effect and cards. And vice versa. Gain 1 TR when either of
 * those parties becomes ruling.» Cost 8, Plant + Earth tags, blue, no action,
 * no requirement, no VP.
 *
 * SCAN READING — cost 8; two round tags in the corner — Plant (the green leaf)
 * and Earth (the globe). The MIN plate is EMPTY: no requirement. The formula in
 * two rows: «[Unity] = [Greens]» and «[Unity][Greens] RULING : [TR]» (the two
 * seals overlapped, «RULING» under them — when either rules, the rating rises
 * by one). The text: «(Effect: While Unity is ruling or you have 2 delegates
 * there, you may also use the Greens' effect and cards. And vice versa. Gain 1
 * TR when either of those parties becomes ruling.)». No VP badge; only the
 * module's icon at the bottom left: no `compatibility`. Printed lore: «UNMI got
 * tired of being ignored.» (art: paco mkz).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/EdenAlliance.spec.ts) —
 * TR62's ten readings over the pair [Unity, Greens], with the fifth changed:
 *  5. «BECOMES RULING» → +1 TR (`onRulingPartyChanged`, called by the
 *     sitting's enactment under its own key, inside this card's effect scope):
 *     `next` in the pair and not the party it replaced → the owner's rating
 *     rises by one, attributed to this card, with the journal's line. The
 *     rating's own answers follow by the engine (the ruling Greens' +2 M€ per
 *     step when the Greens are the party that came to power — the sitting
 *     records them beside the rating, `rulingAnswers`). Playing the card while
 *     Unity ALREADY rules raises nothing («becomes»).
 */
export class EdenAlliance extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.EDEN_ALLIANCE,
      type: CardType.ACTIVE,
      tags: [Tag.PLANT, Tag.EARTH],
      cost: 8,

      metadata: {
        cardNumber: 'TR63',
        infoText: [
          {kind: 'effect-short', text: 'Unity = the Greens: effect and cards of both', tokens: ['(party-seal,party-seal)']},
          {kind: 'effect-short', text: 'One TR when Unity or the Greens come to power', tokens: ['tr']},
        ],
        renderData: CardRenderer.builder((b) => {
          // Row 1 — «[Unity] = [Greens]»: standing with one party is standing with the other (effect and cards).
          b.effect('While Unity is ruling or you have 2 delegates there, you may also use the Greens\' effect and cards. And vice versa.', (eb) => {
            eb.partySeal(PartyName.UNITY).br.equals().br.partySeal(PartyName.GREENS);
          });
          b.br;
          // Row 2 — «[Unity][Greens] RULING : [TR]»: the two seals overlapped, the word under the pair.
          b.effect('Gain 1 TR when either of those parties becomes ruling.', (eb) => {
            eb.partySeal(PartyName.UNITY).partySeal(PartyName.GREENS, {stacked: true, text: 'Ruling'}).startEffect.tr(1);
          });
        }),
      },
    });
  }

  /** THE LAW OF ACCESS, given its fourth road: the pair this card allies (read live by `Parliament.access`). */
  public readonly partyAlliance = EDEN_ALLIANCE_PARTIES;

  /** The play changes NOTHING on the table; it says which side of the pair it opened (the composer's own reading). */
  public override bespokePlay(player: IPlayer) {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      return undefined;
    }
    journalAllianceOpenings(player, this, edenAllianceOpenings(player, parliament));
    return undefined;
  }

  /** Rule 5 — a party of the pair BECOMES ruling: the owner's rating rises by one, named by this card. */
  public onRulingPartyChanged(player: IPlayer, next: ReduxParty, previous: ReduxParty): void {
    if (next === previous || !EDEN_ALLIANCE_PARTIES.includes(next)) {
      return;
    }
    player.game.log(EDEN_ALLIANCE_TR_LINE, (b) => b.player(player).partyName(next).card(this));
    player.increaseTerraformRating(1);
  }

  /** The composer BEFORE the press: which side opens NOW, or the honest «nothing yet»; then the second effect. */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      return actionPreviews.playPreview(this, player);
    }
    const steps = allianceOpeningSteps(edenAllianceOpenings(player, parliament), EDEN_ALLIANCE_NOTHING_NOTE);
    steps.push(actionPreviews.noteStep('generic', EDEN_ALLIANCE_TR_NOTE));
    return actionPreviews.playPreview(this, player, [], steps);
  }
}

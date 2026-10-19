import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {Resource} from '../../../common/Resource';
import {ReduxParty} from '../../../common/parliament/ParliamentTypes';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {CardRenderer} from '../render/CardRenderer';
import {Parliament} from '../../parliament/Parliament';
import * as actionPreviews from '../actionPreviews';
import {AllianceOpening, allianceOpeningSteps, allianceOpenings, journalAllianceOpenings} from './partyAllianceCard';

/** The two parties the card allies — «Scientists = Industrialists», printed in this order. */
export const PROMETHEAN_ALLIANCE_PARTIES: Readonly<[ReduxParty, ReduxParty]> = [PartyName.SCIENTISTS, PartyName.INDUSTRIALISTS];

/** The production the card gives at a change of power. */
export const PROMETHEAN_ALLIANCE_PRODUCTION = 2;

/** The composer's row for a play that opens nothing yet. */
export const PROMETHEAN_ALLIANCE_NOTHING_NOTE = 'Opens nothing now: the alliance holds once the Scientists or the Industrialists rule or get two of your delegates on their resolution';
/** The card's second effect, named before the press. */
export const PROMETHEAN_ALLIANCE_PRODUCTION_NOTE = 'Gain 2 M€ production each time the Scientists or the Industrialists become the ruling party';
/** The journal's line of the production at an enactment. */
export const PROMETHEAN_ALLIANCE_PRODUCTION_LINE = '${0} gains 2 M€ production: ${1} is the new ruling party (${2})';

/** The parties this play opens — the alliance cards' shared reading over this pair. */
export function prometheanAllianceOpenings(player: IPlayer, parliament: Parliament): Array<AllianceOpening> {
  return allianceOpenings(player, parliament, PROMETHEAN_ALLIANCE_PARTIES);
}

/**
 * TR64 — PROMETHEAN ALLIANCE, a Turmoil Redux PROJECT card — the third card of
 * the law of access's FOURTH road (`alliance`, TR62 Tharsis Alliance's class:
 * `docs/TURMOIL_REDUX_THARSIS_ALLIANCE.md`; TR63 Eden Alliance gave the answer
 * to a change of power its MEASURED record), over the last pair and with the
 * third kind of answer — production.
 *
 * «Effect: While the Scientists are ruling or you have 2 delegates there, you
 * may also use the Industrialists' effect and cards. And vice versa. Gain 2 M€
 * production when either of those parties becomes ruling.» Cost 8, Power +
 * Science tags, blue, no action, no requirement, no VP.
 *
 * SCAN READING — cost 8; two round tags in the corner — Power (the purple
 * lightning) and Science (the atom). The MIN plate is EMPTY: no requirement.
 * The formula in two rows: «[Scientists] = [Industrialists]» and
 * «[Scientists][Industrialists] RULING : [2 M€ on the production plate]» (the
 * two seals overlapped, «RULING» under them). The text: «(Effect: While the
 * Scientists are ruling or you have 2 delegates there, you may also use the
 * Industrialists' effect and cards. And vice versa. Gain 2 M€ production when
 * either of those parties becomes ruling.)». No VP badge; only the module's
 * icon at the bottom left: no `compatibility`. Printed lore: «Mars is an
 * investment. And the investors want their way.» (art: Tony Yan).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/PrometheanAlliance.spec.ts)
 * — TR62's readings over the pair [Scientists, Industrialists], with the fifth
 * changed:
 *  5. «BECOMES RULING» → +2 M€ production (`onRulingPartyChanged`, called by
 *     the sitting's enactment under its own key, inside this card's effect
 *     scope): `next` in the pair and not the party it replaced → the owner's
 *     M€ production rises by two, attributed to this card, with the journal's
 *     line; the sitting MEASURES it into `rulingAnswers` (`production`).
 *     Playing the card while the Scientists ALREADY rule raises nothing
 *     («becomes»).
 */
export class PrometheanAlliance extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.PROMETHEAN_ALLIANCE,
      type: CardType.ACTIVE,
      tags: [Tag.POWER, Tag.SCIENCE],
      cost: 8,

      metadata: {
        cardNumber: 'TR64',
        infoText: [
          {kind: 'effect-short', text: 'The Scientists = the Industrialists: effect and cards of both', tokens: ['(party-seal,party-seal)']},
          {kind: 'effect-short', text: 'Two M€ production when the Scientists or the Industrialists come to power', tokens: ['production(']},
        ],
        renderData: CardRenderer.builder((b) => {
          // Row 1 — «[Scientists] = [Industrialists]»: standing with one party is standing with the other.
          b.effect('While the Scientists are ruling or you have 2 delegates there, you may also use the Industrialists\' effect and cards. And vice versa.', (eb) => {
            eb.partySeal(PartyName.SCIENTISTS).br.equals().br.partySeal(PartyName.INDUSTRIALISTS);
          });
          b.br;
          // Row 2 — «[Scientists][Industrialists] RULING : [2 M€ production]»: the seals overlapped, the word under the pair.
          b.effect('Gain 2 M€ production when either of those parties becomes ruling.', (eb) => {
            eb.partySeal(PartyName.SCIENTISTS).partySeal(PartyName.INDUSTRIALISTS, {stacked: true, text: 'Ruling'}).startEffect
              .production((pb) => pb.megacredits(PROMETHEAN_ALLIANCE_PRODUCTION));
          });
        }),
      },
    });
  }

  /** THE LAW OF ACCESS, given its fourth road: the pair this card allies (read live by `Parliament.access`). */
  public readonly partyAlliance = PROMETHEAN_ALLIANCE_PARTIES;

  /** The play changes NOTHING on the table; it says which side of the pair it opened (the composer's own reading). */
  public override bespokePlay(player: IPlayer) {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      return undefined;
    }
    journalAllianceOpenings(player, this, prometheanAllianceOpenings(player, parliament));
    return undefined;
  }

  /** Rule 5 — a party of the pair BECOMES ruling: the owner's M€ production rises by two, named by this card. */
  public onRulingPartyChanged(player: IPlayer, next: ReduxParty, previous: ReduxParty): void {
    if (next === previous || !PROMETHEAN_ALLIANCE_PARTIES.includes(next)) {
      return;
    }
    player.game.log(PROMETHEAN_ALLIANCE_PRODUCTION_LINE, (b) => b.player(player).partyName(next).card(this));
    player.production.add(Resource.MEGACREDITS, PROMETHEAN_ALLIANCE_PRODUCTION, {log: false});
  }

  /** The composer BEFORE the press: which side opens NOW, or the honest «nothing yet»; then the second effect. */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      return actionPreviews.playPreview(this, player);
    }
    const steps = allianceOpeningSteps(prometheanAllianceOpenings(player, parliament), PROMETHEAN_ALLIANCE_NOTHING_NOTE);
    steps.push(actionPreviews.noteStep('generic', PROMETHEAN_ALLIANCE_PRODUCTION_NOTE));
    return actionPreviews.playPreview(this, player, [], steps);
  }
}

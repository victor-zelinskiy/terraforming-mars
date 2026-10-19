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
import {
  ALLIANCE_HOLDS_LINE, ALLIANCE_OPENS_CARDS_DELEGATES_NOTE, ALLIANCE_OPENS_CARDS_RULING_NOTE, ALLIANCE_OPENS_DELEGATES_NOTE, ALLIANCE_OPENS_RULING_NOTE,
  AllianceOpening, allianceOpeningSteps, allianceOpenings, journalAllianceOpenings,
} from './partyAllianceCard';

/** The two parties the card allies — «Mars First = the Reds», printed in this order. */
export const THARSIS_ALLIANCE_PARTIES: Readonly<[ReduxParty, ReduxParty]> = [PartyName.MARS, PartyName.REDS];

/** The composer's rows for a party this play opens — the alliance cards' shared wording (`partyAllianceCard.ts`). */
export const THARSIS_ALLIANCE_OPENS_RULING_NOTE = ALLIANCE_OPENS_RULING_NOTE;
export const THARSIS_ALLIANCE_OPENS_DELEGATES_NOTE = ALLIANCE_OPENS_DELEGATES_NOTE;
export const THARSIS_ALLIANCE_OPENS_CARDS_RULING_NOTE = ALLIANCE_OPENS_CARDS_RULING_NOTE;
export const THARSIS_ALLIANCE_OPENS_CARDS_DELEGATES_NOTE = ALLIANCE_OPENS_CARDS_DELEGATES_NOTE;
/** …and for a play that opens nothing yet. */
export const THARSIS_ALLIANCE_NOTHING_NOTE = 'Opens nothing now: the alliance holds once Mars First or the Reds rule or get two of your delegates on their resolution';
/** The card's second effect, named before the press. */
export const THARSIS_ALLIANCE_DRAW_NOTE = 'Draw a card each time Mars First or the Reds become the ruling party';
/** The journal's line per party the play opened. */
export const THARSIS_ALLIANCE_HOLDS_LINE = ALLIANCE_HOLDS_LINE;
/** The journal's line of the draw at an enactment. */
export const THARSIS_ALLIANCE_DRAW_LINE = '${0} draws a card: ${1} is the new ruling party (${2})';

/** A party this play opens (the alliance cards' shared shape — `partyAllianceCard.ts`). */
export type TharsisAllianceOpening = AllianceOpening;

/**
 * THE PARTIES THIS PLAY OPENS, read off the live table BEFORE the card lands
 * (the preview's rows and the journal's lines are the SAME list — one
 * predicate, read twice): the alliance cards' shared reading over this pair.
 */
export function tharsisAllianceOpenings(player: IPlayer, parliament: Parliament): Array<TharsisAllianceOpening> {
  return allianceOpenings(player, parliament, THARSIS_ALLIANCE_PARTIES);
}

/**
 * TR62 — THARSIS ALLIANCE («Альянс Тарсиса»), a Turmoil Redux PROJECT card —
 * the set's FOURTH ROAD of the law of access: the first that gives a party's
 * effect AND its requirement («full favor») through ANOTHER party.
 *
 * «Effect: While Mars First is ruling or you have 2 delegates there, you may
 * also use the Reds' effect and cards. And vice versa. Draw a card when either
 * of those parties becomes ruling.» Cost 8, Mars + Building tags, blue, no
 * action, no requirement, no VP.
 *
 * The rulebook's two roads to a party's effect and to playing its cards are
 * ONE condition (p.7: «the party either needs to be ruling, or you need to
 * have 2 delegates on its resolution»). This card says: standing by that
 * condition with ONE party of the pair, the owner stands with the OTHER too —
 * effect and cards. It is neither a GRANT (a grant is an effect without the
 * requirement — Septem Tribus, FAQ p.19) nor a THRESHOLD (TR36's number of
 * cubes): it is a new road, `alliance`, declared in THIS file
 * (`partyAlliance`) and read live by the Parliament (`Parliament.alliancesOf`
 * → `access()`), so there is no state, no save field and nothing to revoke.
 *
 * SCAN READING — cost 8; two round tags in the corner — Mars (the red planet)
 * and Building (the brown roof). The MIN plate is EMPTY: no requirement. The
 * formula in two rows: «[Mars First] = [Reds]» (the two parties equated) and
 * «[Mars First][Reds] RULING : [card]» (the two seals overlapped, «RULING»
 * under them — when either rules, draw a card). The text: «(Effect: While
 * Mars First is ruling or you have 2 delegates there, you may also use the
 * Reds' effect and cards. And vice versa. Draw a card when either of those
 * parties becomes ruling.)». No VP badge. Only the module's icon at the bottom
 * left: no `compatibility`. Printed lore: «Their slogan was gonna be "Born
 * Red!", but they got a Cease & Desist from Native Americans.» (art: Mike
 * Luard).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/TharsisAlliance.spec.ts):
 *  1. The alliance is the pair [Mars First, Reds], DECLARED IN THIS FILE
 *     (`partyAlliance`, invariant 8); the Parliament reads it off the tableau
 *     live (`alliancesOf`), never by the card's name: the card on the table —
 *     the alliance exists; gone — it does not.
 *  2. THE TRIGGER IS THE PARTNER's PRINTED ROAD — it rules, or ≥ 2 of the
 *     owner's OWN delegates on its resolution (the requirement's reading).
 *     Never a grant of the partner, never TR36's lowered threshold (one cube
 *     on Mars First gives Mars First's effect, not the Reds' — FAQ p.19's
 *     «full favor»), never an alliance (one pair, one hop).
 *  3. WHAT IT GIVES: `access(Reds).hasEffect` (the Reds' ACTION — «2 cards →
 *     discard 2 + 2 M€ per tag» — once a generation; Mars First's passive
 *     «1 steel per tile, a card per city») AND `satisfiesRequirement` (the
 *     Reds' cards are playable). Both ways («and vice versa»). The road is
 *     `allied: [{via, source, road}]`; `alliances` names a dormant pair. A
 *     party's action is one use per generation whatever the road.
 *  4. THE DIFF OF THE LAW ANNOUNCES IT (`announceAccessChanges`, PL-112):
 *     basis `alliance` (ranked ruling → delegates → alliance → card), its own
 *     journal lines, `impact.partyEffect = {party, basis, via, source}`, the
 *     owner's notification with «Открыть Парламент». Mars First coming to
 *     power gives the Reds by the ALLIANCE road — announced like any other.
 *  5. «BECOMES RULING» → A CARD (`onRulingPartyChanged`, called by the
 *     sitting's enactment under its own key): `next` in the pair and not the
 *     party it replaced → `drawCard(1)` with this card as the source + the
 *     journal's line. Playing the card while Mars First ALREADY rules draws
 *     nothing («becomes»); the final sitting's enactment does.
 *  6. REQUIREMENTS UNDER THE ALLIANCE: `requirementEasingOf` reads a Reds
 *     card as `effective: 'allied'`, `via: Mars First`, the source this card
 *     (`kind: 'ally'`), `decisive` while the Reds' own printed road fails; a
 *     waiver (TR70) stands first and names itself alone. The play records
 *     `requirement-eased` kind `ally`.
 *  7. THE REASON while the pair holds no road: ONE blocker (the party's own
 *     line) + `alliedVia` — the second line «or the same with Mars First».
 *  8. THE PREVIEW (`tharsisAllianceOpenings`): what opens NOW, or the honest
 *     «nothing yet», and the draw note; the play journals the same list.
 *     Never futile (a standing effect).
 *  9. What stands up by itself (spec, not code): the Reds' action in «Card
 *     actions», Mars First's steel, the effect forecast, the cell dossier,
 *     Unity's free trade — all through `hasPartyEffect`.
 * 10. MarsBot never plays the card; its seat (outside `party-effects`) holds
 *     no alliance at any table. Save / load: nothing new.
 */
export class TharsisAlliance extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.THARSIS_ALLIANCE,
      type: CardType.ACTIVE,
      tags: [Tag.MARS, Tag.BUILDING],
      cost: 8,

      metadata: {
        cardNumber: 'TR62',
        infoText: [
          {kind: 'effect-short', text: 'Mars First = the Reds: effect and cards of both', tokens: ['(party-seal,party-seal)']},
          {kind: 'effect-short', text: 'A card when Mars First or the Reds come to power', tokens: ['cards']},
        ],
        renderData: CardRenderer.builder((b) => {
          // Row 1 — «[Mars First] = [Reds]»: standing with one party is standing with the other (effect and cards).
          b.effect('While Mars First is ruling or you have 2 delegates there, you may also use the Reds\' effect and cards. And vice versa.', (eb) => {
            eb.partySeal(PartyName.MARS).br.equals().br.partySeal(PartyName.REDS);
          });
          b.br;
          // Row 2 — «[Mars First][Reds] RULING : [card]»: the two seals overlapped, the word under the pair.
          b.effect('Draw a card when either of those parties becomes ruling.', (eb) => {
            eb.partySeal(PartyName.MARS).partySeal(PartyName.REDS, {stacked: true, text: 'Ruling'}).startEffect.cards(1);
          });
        }),
      },
    });
  }

  /** THE LAW OF ACCESS, given its fourth road: the pair this card allies (read live by `Parliament.access`). */
  public readonly partyAlliance = THARSIS_ALLIANCE_PARTIES;

  /**
   * Rule 8 — the play changes NOTHING on the table; it only says which side
   * of the pair it opened, by the same reading the composer showed, under the
   * card's own effect area. Read before the card is counted.
   */
  public override bespokePlay(player: IPlayer) {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      // Never dealt outside the Mars Parliament (the manifest is the deck gate): nothing to open.
      return undefined;
    }
    journalAllianceOpenings(player, this, tharsisAllianceOpenings(player, parliament));
    return undefined;
  }

  /**
   * Rule 5 — a party of the pair BECOMES ruling: the owner draws a card, named
   * by this card (the sitting calls the hook inside this card's effect scope).
   */
  public onRulingPartyChanged(player: IPlayer, next: ReduxParty, previous: ReduxParty): void {
    if (next === previous || !THARSIS_ALLIANCE_PARTIES.includes(next)) {
      return;
    }
    player.game.log(THARSIS_ALLIANCE_DRAW_LINE, (b) => b.player(player).partyName(next).card(this));
    player.drawCard(1, {source: {type: 'ruling-change', cardName: this.name, party: next}});
  }

  /**
   * The composer BEFORE the press: which side opens NOW (with its partner's
   * road), or the honest «nothing yet»; then the second effect. The same
   * `tharsisAllianceOpenings` the play journals — there is no prompt between.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      return actionPreviews.playPreview(this, player);
    }
    const steps = allianceOpeningSteps(tharsisAllianceOpenings(player, parliament), THARSIS_ALLIANCE_NOTHING_NOTE);
    steps.push(actionPreviews.noteStep('generic', THARSIS_ALLIANCE_DRAW_NOTE));
    return actionPreviews.playPreview(this, player, [], steps);
  }
}

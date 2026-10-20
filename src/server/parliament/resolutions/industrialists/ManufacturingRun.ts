/*
 * MANUFACTURING RUN (the Industrialists) — Turmoil Redux resolution RX37, an
 * action law with nothing else: no enactment, no winner part, no passive
 * (docs/TURMOIL_REDUX_MANUFACTURING_RUN.md).
 *
 * Printed: «Action: Add 2 floaters OR 1 fighter OR 1 mech to any card. You can
 * use this action twice this generation. Players with at least 2 Influence can
 * use it 3 times.» Chairman quest: play 2 green cards. Floaters, fighters and
 * mechs all exist without Venus Next (the Redux cards, Colonies, the promos),
 * so the card declares no compatibility.
 *
 * THE READINGS FIXED HERE:
 *  · ONE OF THREE OUTCOMES ON ONE CARD OF THE SEAT'S OWN — 2 floaters, or 1
 *    fighter, or 1 mech. «Any card» is one of the player's own (the Scientists'
 *    action reads it the same, as do RX01 / RX18). Never a layout: the units
 *    land together on the card chosen.
 *  · THE KIND IS A BRANCH (decision Р2): the printed «OR» is a variant choice
 *    and the amounts differ by kind, so the prompt is the Scientists' shape —
 *    `OrOptions` over the kinds with a holder, each branch a `SelectCard` of that
 *    kind's holders (`resourceToOwnCard.ts`, the one builder both stand on). A
 *    kind with no holder is not offered; one branch stays a branch of one (the
 *    console seeds it — no decision on the kind), and the CARD is always asked,
 *    even with a single holder (no auto-select).
 *  · HOW MANY TIMES IS DATA (`actionUses` + `actionUsesFor`): twice a
 *    generation, three times for a seat with at least 2 influence, read LIVE at
 *    every use (decision Р3) — a seat at influence 1 that has spent both uses and
 *    then becomes chairman (the Agenda +1 → influence 2) gains the third at once.
 *    Influence only ever GROWS inside a generation (the Agenda marker advances,
 *    a bonus is only ever added), so the reverse case — a use taken away
 *    mid-generation — does not arise; were it to, the limit would simply read 0
 *    left (`resolutionActionUsesLeft` floors at zero).
 *  · EVERY USE IS AN ACTION OF THE TURN: both actions of one turn may be this
 *    law; the use is recorded at the ANSWER (`runResolutionAction`), never when
 *    the prompt is built, and the generation boundary restores them all.
 *  · UNAVAILABLE WITH A REASON, never hidden: no holder of any of the three
 *    kinds names the empty case; a spent count names its numbers («2 of 2»);
 *    MarsBot takes no part.
 *  · THE LOG is the family's «used the action of …» and the holder's own
 *    resource line, both under the law's source (`from: {resolution}`).
 *  · THE QUEST is Open IP Trade's — 2 green (automated) cards played; the
 *    action plays nothing, and the resources it adds count for no quest of the
 *    catalog (a resolution source on the stack is cut — decision Q5).
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {Size} from '../../../../common/cards/render/Size';
import {CardResource} from '../../../../common/CardResource';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {actionUsesFor, ResolutionActionUses} from '../../../../common/parliament/actionUses';
import {ChoiceContextSource} from '../../../../common/models/PlayerInputModel';
import {IPlayer} from '../../../IPlayer';
import {ResolutionAction, ResolutionDefinition} from '../IResolution';
import {runResolutionAction} from '../ResolutionAction';
import {ResourceYield, resourceToOwnCardChoice, resourceToOwnCardPreview, yieldsWithHolders} from '../../resourceToOwnCard';

export const MANUFACTURING_RUN_ID: ResolutionId = 'RDX_INDUSTRIALISTS_MANUFACTURING_RUN';
export const MANUFACTURING_RUN_CODE: ResolutionCode = 'RX37';
/** «Twice this generation; players with at least 2 Influence 3 times.» */
export const MANUFACTURING_RUN_USES: ResolutionActionUses = {base: 2, atInfluence: {influence: 2, uses: 3}};
/** The printed outcomes, in the printed order: 2 floaters OR 1 fighter OR 1 mech. */
export const MANUFACTURING_RUN_YIELD: ReadonlyArray<ResourceYield> = [
  {resource: CardResource.FLOATER, amount: 2},
  {resource: CardResource.FIGHTER, amount: 1},
  {resource: CardResource.MECH, amount: 1},
];
/** The action's own gate: no card of the seat's can take any of the three kinds. */
export const MANUFACTURING_RUN_NO_HOLDER_REASON = 'No card of yours can hold floaters, fighters or mechs';

const SOURCE: ChoiceContextSource = {kind: 'resolution', resolution: MANUFACTURING_RUN_ID};

/** The seat's count this generation, read at this very moment (decision Р3 — live influence). */
export function manufacturingRunUses(player: IPlayer): number {
  return actionUsesFor(MANUFACTURING_RUN_USES, player.game.parliament?.influence(player) ?? 0);
}

const MANUFACTURING_RUN_ACTION: ResolutionAction = {
  usesPerGeneration: manufacturingRunUses,
  canAct(player) {
    return yieldsWithHolders(player, MANUFACTURING_RUN_YIELD).length > 0 ?
      {available: true} :
      {available: false, reason: MANUFACTURING_RUN_NO_HOLDER_REASON};
  },
  // THE COMMIT CONTRACT: building the prompt changes nothing; the answer — the kind's branch and its card — is the
  // commit, through the family's funnel (the scope under the law's source, the header, the use).
  execute(player, parliament, meta) {
    return resourceToOwnCardChoice(player, MANUFACTURING_RUN_YIELD, {
      title: 'Add 2 floaters, 1 fighter or 1 mech to a card',
      buttonLabel: 'Add',
      mark: (input) => input.markResolutionActionPrompt(meta),
      source: SOURCE,
      trigger: 'Resolution action',
      noHolder: MANUFACTURING_RUN_NO_HOLDER_REASON,
      give: (card, outcome) => runResolutionAction(player, parliament, MANUFACTURING_RUN_ID, () => {
        player.addResourceTo(card, {qty: outcome.amount, log: true, from: {resolution: MANUFACTURING_RUN_ID}});
      }),
    });
  },
  // A chip per kind — with a seat, only the kinds it can hold (the prompt offers exactly those).
  preview(player) {
    return resourceToOwnCardPreview(MANUFACTURING_RUN_YIELD, player);
  },
};

export const MANUFACTURING_RUN: ResolutionDefinition = {
  id: MANUFACTURING_RUN_ID,
  code: MANUFACTURING_RUN_CODE,
  module: 'turmoilRedux',
  party: PartyName.INDUSTRIALISTS,
  copies: 1,
  // THE FACE as printed (decision Р4): ONE action box — «2 with the influence mark» left of the arrow (the threshold
  // of the third use), then «[floater][floater] OR [fighter] OR [mech]» on the right.
  renderData: CardRenderer.builder((b) => {
    b.action(undefined, (ab) => ab.text('2', Size.LARGE).influence({superscript: true}).startAction
      .resource(CardResource.FLOATER, 2).or()
      .resource(CardResource.FIGHTER).or()
      .resource(CardResource.MECH));
  }),
  text: {
    name: 'Manufacturing Run',
    // The count is structural (`actionUses`) — every surface prints it beside the live uses, never in this sentence.
    action: 'Add 2 floaters, 1 fighter or 1 mech to one of your cards.',
    quest: 'Play 2 green cards',
  },
  // BY TYPE: a green card is an AUTOMATED card (Open IP Trade's object and key).
  quest: {goal: {kind: 'cardsPlayed', cardType: 'automated'}, count: 2},
  action: MANUFACTURING_RUN_ACTION,
  actionUses: MANUFACTURING_RUN_USES,
};

/*
 * R&D FUNDING (the Scientists) — Turmoil Redux resolution RX26, the card with
 * NO enactment at all: everything it gives it gives WHILE IT STANDS — a
 * passive that changes how many TAGS a seat has, and an action that repeats a
 * card action already spent this generation
 * (docs/TURMOIL_REDUX_RD_FUNDING.md).
 *
 * Printed: «Effect: When taking actions, you have additional Science tags
 * equal to your Influence. Action: Use an action on one of your cards a second
 * time this generation.» Chairman quest: play 2 blue cards (the blue-topped
 * card icon ×2 of the scan — the spec's §4.1.1 reading).
 *
 * THE READINGS FIXED HERE:
 *  · THE PASSIVE IS A COUNT, NOT A CARD. The law does not put a science tag
 *    anywhere: it raises the ANSWER to «how many Science tags do you have?»
 *    while a seat holds it. So it is a pure QUERY (`tagBonus`) asked by the
 *    one counting function (`Tags.count` → `ParliamentHandler.tagBonus`),
 *    exactly as Metal Research's value bonus is asked by the one value
 *    accessor: no field of the player is written, the save format does not
 *    change by a byte, a save from under the law loads right by construction,
 *    and the bonus leaves the instant another card takes the ENACTED slot.
 *  · «WHEN TAKING ACTIONS» IS THE WHOLE SCOPE, and it is why the engine's
 *    OTHER extra-tag seam (`Tags.extraScienceTags` — Leavitt Station) is the
 *    wrong one: that one is unconditional and would reach the AWARDS, where
 *    a printed tag is the only thing that counts. The law's tags ride the
 *    SUBSTITUTION modes beside the wild tag — a card requirement, an action's
 *    gate, a behaviour counter — and are absent from `'raw'`, `'award'` and
 *    `'milestone'` (claiming a milestone records an achievement; it is not
 *    an action taken — pinned by its own spec).
 *  · THE PRINTED COUNT STAYS PRINTED. The МЕТКИ zone reads `countAllTags`
 *    (`'raw'`), and it keeps reading it: the addition is STATED beside the
 *    printed digit (`ParliamentHandler.tagBonuses` → the model's
 *    `tagBonuses`), never folded into it. A player must be able to see both
 *    «what I have printed» and «what will be counted now».
 *  · THE ACTION IS VIRON'S MECHANISM, not a second reading of it. Which cards
 *    may be repeated is the ONE shared list (`repeatableActionCards`) Viron
 *    and Project Inspection now ask too: an action already USED this
 *    generation, that can act again, not caught in a copy loop.
 *  · THE COPY IS ATTRIBUTED TO THE LAW. The repeat runs inside
 *    `withCopiedActionFrom` under the resolution's own source, so the journal
 *    and the statistics read «law → card → its result» the way they read
 *    «VIRON → card → its result». The copied card's own prompts arrive
 *    afterwards on their normal surfaces, carrying the copy's stamp.
 *  · THE CARD IS ALWAYS CHOSEN. Even with a single candidate the pick is
 *    SHOWN (no auto-select) — the player must see WHICH action is about to
 *    run a second time.
 *  · ONCE PER GENERATION (`usesPerGeneration` = 1), recorded AT THE ANSWER
 *    through the shared `runResolutionAction` — a prompt built and abandoned
 *    spends nothing. Held by PARTICIPANTS only, and only while the card
 *    stands ENACTED.
 *  · UNAVAILABLE WITH A REASON, never hidden: no action used this generation
 *    that can be used again (the law's own gate), a spent use, a seat outside
 *    the parliament — the model carries the reason.
 *
 * THE STEP CONTRACT (IResolution.ts): there are no steps. The enactment pays
 * nobody, records nothing, and asks nothing — the REWARD stage reads the
 * passive and names the action instead.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Tag} from '../../../../common/cards/Tag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {ChoiceContextSource} from '../../../../common/models/PlayerInputModel';
import {SelectCard} from '../../../inputs/SelectCard';
import {InputError} from '../../../inputs/InputError';
import {IActionCard, ICard} from '../../../cards/ICard';
import {repeatableActionCards} from '../../../cards/repeatableActions';
import {IPlayer} from '../../../IPlayer';
import {PlayerInput} from '../../../PlayerInput';
import {ResolutionAction, ResolutionDefinition} from '../IResolution';
import {resolutionActionSource, runResolutionAction} from '../ResolutionAction';

export const RD_FUNDING_ID: ResolutionId = 'RDX_SCIENTISTS_RD_FUNDING';
export const RD_FUNDING_CODE: ResolutionCode = 'RX26';
/** The printed rate of the passive: 1 extra Science tag per point of influence. */
export const RD_FUNDING_TAGS_PER_INFLUENCE = 1;
/** Once per generation, as every action of the Parliament. */
export const RD_FUNDING_USES_PER_GENERATION = 1;
/** The action's own gate — the SAME sentence Project Inspection refuses with. */
export const RD_FUNDING_NO_ACTION_REASON = 'No card action used this generation to use again';

const SOURCE: ChoiceContextSource = {kind: 'resolution', resolution: RD_FUNDING_ID};

/**
 * THE PASSIVE, as one pure function: the extra tags of `tag` this law grants a
 * seat at `influence`. Science only; every other tag is untouched. It reads
 * nothing but its arguments — the dispatcher owns «is this seat a
 * participant» and «what is their influence right now».
 */
export function rdFundingTagBonus(_player: IPlayer, tag: Tag, influence: number): number {
  return tag === Tag.SCIENCE ? RD_FUNDING_TAGS_PER_INFLUENCE * Math.max(0, influence) : 0;
}

/**
 * THE COMMIT of the action: `card`'s action runs a SECOND time, inside the
 * copied-action scope of the LAW (never of a card — the law is not in anybody's
 * tableau), so everything the copy produces is attributed to the resolution.
 * Returns whatever the copied action asks next.
 */
export function repeatCardAction(player: IPlayer, card: IActionCard & ICard): PlayerInput | undefined {
  const events = player.game.events;
  const run = (): PlayerInput | undefined => {
    player.game.log('${0} used ${1} action a second time with ${2}', (b) =>
      b.player(player).card(card).resolution(RD_FUNDING_ID));
    return card.action(player);
  };
  return events.withCopiedActionFrom(player, resolutionActionSource(RD_FUNDING_ID, player), card, run);
}

const RD_FUNDING_ACTION: ResolutionAction = {
  usesPerGeneration: () => RD_FUNDING_USES_PER_GENERATION,
  canAct(player) {
    return repeatableActionCards(player).length > 0 ?
      {available: true} :
      {available: false, reason: RD_FUNDING_NO_ACTION_REASON};
  },
  // THE COMMIT CONTRACT: building the prompt changes nothing; the answer is
  // the commit. The pick is the repeat family's own form — one card among the
  // actions already spent this generation, shown even when there is one.
  execute(player, parliament, meta) {
    const cards = repeatableActionCards(player);
    return new SelectCard<IActionCard & ICard>(
      'Use an action on one of your cards a second time (R&D Funding)',
      'Take action',
      cards)
      .markChoiceContext({source: SOURCE, trigger: 'Resolution action', mode: 'effect-choice'})
      // The DECISION IS ON THE TABLE, not in the hand — the one structural
      // signal the console tells a repeat from a spend by.
      .markRepeatActionPrompt()
      .markResolutionActionPrompt(meta)
      .andThen(([card]) => {
        if (card === undefined) {
          throw new InputError('Choose the card action to use again');
        }
        return runResolutionAction(player, parliament, RD_FUNDING_ID, () => repeatCardAction(player, card));
      });
  },
  // NO CHIPS, and that is the honest answer: what this action pays is whatever
  // the COPIED card pays — a different amount for every candidate, and unknown
  // until one is chosen. The tile reads the rule; the pick reads each
  // candidate's own preview.
  preview() {
    return [];
  },
};

export const RD_FUNDING: ResolutionDefinition = {
  id: RD_FUNDING_ID,
  code: RD_FUNDING_CODE,
  module: 'turmoilRedux',
  party: PartyName.SCIENTISTS,
  copies: 1,
  // THE FACE as printed: the standing RULE as a drawing in the game's own
  // dictionary — «+ [science tag] / [influence]» — and the ACTION as the replay
  // icon Project Inspection prints. The law itself is the cause, so the cause
  // side is EMPTY, and an empty-cause effect is drawn as the MODIFIER it is
  // («+ …», the Scientists' own wild-tag plaque): a bare «: …» reads as a
  // formula whose condition went missing.
  renderData: CardRenderer.builder((b) => {
    b.effect(undefined, (eb) => eb.empty().startEffect.plus().tag(Tag.SCIENCE).slash().influence());
    b.action(undefined, (ab) => ab.empty().startAction.replayAction());
  }),
  text: {
    name: 'R&D Funding',
    // The block label says WHEN («Эффект, пока принята»); the sentence says WHAT.
    passive: 'When taking actions, you have additional science tags equal to your influence.',
    // The per-generation limit is structural (`usesPerGeneration`), never a
    // clause of the sentence — every surface prints it beside the live uses.
    action: 'Use an action on one of your cards a second time this generation.',
    quest: 'Play 2 blue cards',
  },
  // BY TYPE: a blue card is an ACTIVE card — never a tag, never a colour of the face.
  quest: {goal: {kind: 'cardsPlayed', cardType: 'active'}, count: 2},
  passive: {
    tagBonus: rdFundingTagBonus,
    // The tag bonus's forecast twin is the МЕТКИ zone's own addition badge
    // (the rate where the decision is made — Heat Capture's and Metal
    // Research's precedent): a fact here would print the same tags a second
    // time, in a group meant for triggers, with no `effect-triggered` event
    // to match it. Nothing else of this law fires on a play.
    forecast() {
      return [];
    },
  },
  action: RD_FUNDING_ACTION,
};

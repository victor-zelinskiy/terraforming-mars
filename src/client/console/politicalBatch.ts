/*
 * THE ONE BATCH OF A POLITICAL COMMIT (Turmoil Redux «один фреймворк»): a party's or the enacted law's action,
 * composed in the card actions' composer, answered as the action menu's own option — byte for byte what the party
 * composer sent. Pure; the host finds the menu option (the prompt bridge — never a title) and hands its index in.
 *
 *  · the option's answer by the preview's `answer` (`buildPoliticalActionBatch`);
 *  · a COPIED action (R&D Funding RX26 — Viron's repeat slot): the pick IS the copy's card, the copy's own composed
 *    answers ride behind it (`repeatActionResponses`, the function a card's repeat builds them with);
 *  · a LAW'S PLAY (Live Experiments RX36): the card's play ADDRESSED to the law (`role: 'projectCard'`), the card's
 *    own answers behind it — after every other step of the branch (the bill's payment first).
 */
import {CardName} from '@/common/cards/CardName';
import {addressed} from '@/common/inputs/preselectAddress';
import type {PoliticalActionAnswer} from '@/common/models/ActionPreviewModel';
import type {ResolutionId} from '@/common/parliament/ParliamentTypes';
import {buildPoliticalActionBatch, repeatActionResponses, RepeatComposed} from '@/client/console/consoleActionComposer';
import {buildPlayCardBatch} from '@/client/console/consolePlayCardComposer';
import type {ConsolePlayPickResult} from '@/client/console/consolePlayPick';

export type PoliticalBatchArgs = {
  menuIndex: number;
  answer: PoliticalActionAnswer;
  branchIndex: number;
  optionResponse: unknown;
  stepResponses: ReadonlyArray<unknown>;
  /** A copied action (the repeat slot's answer). */
  repeat?: {chosenCard: CardName, composed: RepeatComposed};
  /** A law's play (the play slot's answer) — with the law that plays it. */
  lawPlay?: {resolution: ResolutionId, play: ConsolePlayPickResult};
};

export function buildPoliticalBatch(args: PoliticalBatchArgs): Array<unknown> {
  const repeat = args.repeat;
  const batch = buildPoliticalActionBatch({
    menuIndex: args.menuIndex,
    answer: args.answer,
    branchIndex: args.branchIndex,
    optionResponse: repeat !== undefined ? {type: 'card', cards: [repeat.chosenCard]} : args.optionResponse,
    stepResponses: args.stepResponses,
  });
  if (batch.length === 0) {
    return batch;
  }
  if (repeat !== undefined) {
    // The head of `repeatActionResponses` is the pick itself — already answered inside the menu option.
    batch.push(...repeatActionResponses(repeat.chosenCard, repeat.composed).slice(1));
  }
  const law = args.lawPlay;
  if (law !== undefined) {
    const play = law.play;
    const [card, ...tail] = buildPlayCardBatch({
      playPath: [],
      cardName: play.cardName,
      payment: play.payment,
      branchIndex: play.branchIndex,
      branchFor: play.branchFor,
      preResponses: play.preResponses,
      optionResponse: play.optionResponse,
      stepResponses: play.stepResponses,
      // A composed REPEAT (Project Inspection played through the law): the copied action's answers ride behind the play.
      repeat: play.composed?.repeat,
    });
    batch.push(addressed(card, {source: {kind: 'resolution', resolution: law.resolution}, role: 'projectCard'}), ...tail);
  }
  return batch;
}

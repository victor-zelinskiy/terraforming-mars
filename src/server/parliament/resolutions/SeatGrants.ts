/*
 * THE DEEDS A LAW GRANTS THE SEATS (decision D11 — docs/TURMOIL_REDUX_MARSBOT.md
 * §10): the ONE reading of «what does this enacted resolution hand every seat
 * to DO», which the effects step walks for a seat the law does not PAY
 * (MarsBot under `'politics'` — the aspect `seat-grant`).
 *
 * A law never pays the bot and never charges it (D3), but what it grants the
 * seats and the bot has its own primitive for, the bot performs itself: the
 * TILE (`tileGrant` — Skyscrapers' tier, Mars First Budget's city: the bot's
 * placement rule) and the STEP OF THE CAREER (`agendaGrant` — Reds Budget: the
 * track's one walk, a card step 1 M€). ONE list, ONE seat loop: a definition
 * that declares any deed walks every seat of `seat-grant` in generation order,
 * the bot in ITS place — never two queues for two deeds.
 *
 * The deeds come in the PRINTED order — the order their shared steps stand in
 * `immediateSteps` — so a card that grants both performs them as a human seat
 * would. Each carries the step key its record is filed under (the human's
 * shared step's own key), so the bot's record reads as one more seat's.
 */
import {TileGrantDeclaration, tileGrantStepKey} from '../../../common/parliament/tileGrant';
import {AGENDA_GRANT_STEP_KEY, AgendaGrantDeclaration} from '../../../common/parliament/agendaGrant';
import {ResolutionDefinition} from './IResolution';

/** ONE deed a law grants the seats, with the step key its record wears. */
export type SeatGrantDeed =
  | {kind: 'tile', key: string, grant: TileGrantDeclaration}
  | {kind: 'agenda', key: string, grant: AgendaGrantDeclaration};

/** The deeds `definition` grants the seats, in the printed order of their shared steps; empty for a law that grants none. */
export function seatGrantsOf(definition: ResolutionDefinition): Array<SeatGrantDeed> {
  const deeds: Array<SeatGrantDeed> = [];
  if (definition.tileGrant !== undefined) {
    deeds.push({kind: 'tile', key: tileGrantStepKey(definition.tileGrant), grant: definition.tileGrant});
  }
  if (definition.agendaGrant !== undefined) {
    deeds.push({kind: 'agenda', key: AGENDA_GRANT_STEP_KEY, grant: definition.agendaGrant});
  }
  // A grant's shared step stands in the STATIC list (a per-player plan pays colony bonuses, never a deed).
  const order = (definition.immediateSteps ?? []).map((step) => step.key);
  const at = (key: string): number => {
    const index = order.indexOf(key);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return deeds.sort((a, b) => at(a.key) - at(b.key));
}

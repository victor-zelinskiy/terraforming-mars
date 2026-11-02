/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE CAUSE PLATE of a reaction told on its own (P46 Colony Trade Hub, the owner's 2026-11-03: «эффект встроился в
 * существующий фреймворк … и это показывалось даже на срабатывания от хода других игроков» — the bot included).
 *
 * The standalone chain lifts the reacting card at the rail's edge and flies what it paid. For a cause the viewer just
 * WATCHED (their own colony's scene — the cube sat down, the bonus left its slot) that is the whole story. For a
 * colony another seat built nothing on this screen animated the build — a rival's or MarsBot's cube is not played on
 * the viewer's board — so the card would rise and pay «out of nowhere». The plate answers «where did this come
 * from»: the colony's planet, its name, and the seat that built it, read off the SERVER's record (`cause.colony`,
 * written by both writers of a cube — `Colony.addColony` and `AutomaColonies.botBuildColony`), never off the log.
 *
 * Pure: the record, the viewer, the seats → the plate or nothing. The layer paints it beside the face (a kant, no
 * light — invariant 15); it stands with the face and leaves with it.
 */
import {Color} from '@/common/Color';
import {ColonyName} from '@/common/colonies/ColonyName';
import {CardReactionRecord} from '@/common/models/CardReactionModel';

/** A seat as the plate reads it: its colour, its name, whether it is MarsBot. */
export type CausePlateSeat = {color: Color; name: string; isMarsBot?: boolean};

/** WHAT another seat did that woke the card — today one kind: a colony built. */
export type ReactionCausePlate = {
  kind: 'colony';
  colony: ColonyName;
  /** The seat that built it (its chip's colour and name — MarsBot is «just another seat», the table-zone law). */
  builder: CausePlateSeat;
};

/**
 * The plate for one reaction record, or `undefined` when the viewer needs none: no cause the plate can name, or a
 * cause the viewer made themselves (their own scene told it).
 */
export function causePlateOf(
  record: Pick<CardReactionRecord, 'channel' | 'cause'>,
  viewer: Color | undefined,
  seats: ReadonlyArray<CausePlateSeat>,
): ReactionCausePlate | undefined {
  const colony = record.cause?.colony;
  if (record.channel !== 'colony-added' || colony === undefined || colony.builder === viewer) {
    return undefined;
  }
  const seat = seats.find((s) => s.color === colony.builder);
  return {
    kind: 'colony',
    colony: colony.name,
    builder: {color: colony.builder, name: seat?.name ?? colony.builder, ...(seat?.isMarsBot === true ? {isMarsBot: true} : {})},
  };
}

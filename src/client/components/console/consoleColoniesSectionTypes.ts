/*
 * @console-shared LIVE — console native stands on this file.
 *
 * The types `ConsoleColoniesSection.vue` shares with the code that drives it. They live in a `.ts` module because a `.ts` module
 * (a shell controller — console/shell/) cannot import a named export of a `.vue` file: plain tsc sees `*.vue` through
 * the shim. The SFC imports and re-exports them, so `import {…} from '…/ConsoleColoniesSection.vue'` inside another SFC still works.
 */
import type {ChoiceContextSource} from '@/common/models/PlayerInputModel';
import type {BoardName} from '@/common/boards/BoardName';
import type {ColonyTrackMove} from '@/common/parliament/colonyTrackAdvance';
import type {ColonyTileSite} from '@/common/colonies/ColonyTileSite';
import type {ColonyBuildSite} from '@/common/colonies/ColonyBuildSite';
import type {ColonyRosterPickView} from '@/client/console/colonyRoster/colonyRosterModel';

/** PICK MODE (T4 — a server SelectColony drives the grid): the shell owns it. */
export type ConsoleColonyPick = {
  /** Names the server accepts (its `coloniesModel`). */
  selectable: ReadonlyArray<string>,
  /** Per-colony SERVER reason for the unpickable ones (translated). */
  reasons: Readonly<Record<string, string>>,
  /**
   * The server verb — a MACHINE DISCRIMINATOR the trade orchestration keys on
   * (the lowercase `'trade'` sentinel routes the premium launch). NEVER
   * rendered: a sentinel is not copy, and `$t('trade')` leaked raw onto the
   * CTA chip and the command bar («A TRADE»).
   */
  buttonLabel: string,
  /** The DISPLAY i18n key for the A chip / command bar («Trade» / «Build» / «Select»). */
  labelKey: string,
  /**
   * THE PICK MOVES THE CHOSEN TILE'S TRACK (TR07 — the server's
   * `SelectColonyModel.trackMoves`): where each CANDIDATE's marker lands.
   * Its presence makes the act `track` (`colonyPickIntent`).
   */
  trackMoves?: ReadonlyArray<ColonyTrackMove>,
  /**
   * THE PICK PLACES A TILE ON THE CHOSEN COLONY TILE (TR22 Nova City — the server's `SelectColonyModel.tileSite`):
   * the tile, its hosted cell and the projection of the count and the card's VP — ONE marker for every candidate.
   * Its presence makes the act `city` (`colonyPickIntent`).
   */
  tileSite?: ColonyTileSite,
  /**
   * THE PICK BUILDS A COLONY (the server's `SelectColonyModel.buildSites` — published on EVERY build prompt): the
   * berth the cube takes on each CANDIDATE, whether it lies beyond the printed limit, the player's own cubes
   * there. Its presence makes the act `build` (`colonyPickIntent`) — never the button's label.
   */
  buildSites?: ReadonlyArray<ColonyBuildSite>,
  /**
   * The build is A CARD's own door (staged, or its live re-ask — the prompt names a card as its giver): the grid
   * PROJECTS the cube on every candidate and says, calmly, what the card lifts there. Every other build (the
   * standard project, a follow-up, a resolution's colony) keeps the grid it always had.
   */
  buildProjected?: boolean,
  /**
   * The pick is a STAGED door (TR07's staged colony): nothing is on the wire
   * yet — the stage's A is the PLAY's one submit and B walks one level back.
   * Absent on a live server prompt.
   */
  staged?: boolean,
  /**
   * THE PICK CHANGES THE ROSTER (the server's `SelectColonyModel.rosterChange` — a tile enters, leaves, or is
   * replaced in its slot): the marker, the LEVEL standing («who leaves» on the table / «who enters» on the
   * reserve) and a replacement's chosen leaving tile. Its presence makes the act `roster` (`colonyPickIntent`).
   */
  roster?: ColonyRosterPickView,
  /**
   * A BOARD CELL asked for this pick (Terra Cimmeria's MSL Curiosity — the prompt's `choiceContext.source`): the head
   * names it with the ONE source plate the payment before it wore (`ConsoleSourceDock`), on the board in play.
   */
  cellGiver?: {source: ChoiceContextSource, boardName: BoardName},
};

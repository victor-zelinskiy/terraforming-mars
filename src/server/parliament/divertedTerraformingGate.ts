/*
 * THE ONE DOOR A TERRAFORMING UNIT GOES THROUGH BEFORE THE ENGINE PERFORMS IT
 * (Turmoil Redux — RX35 Diverted Research, `ResolutionPassive.divertTerraforming`).
 *
 * A module of its own, deliberately LIGHT: the engine's lowest doors ask it
 * (`Game.increaseOxygenLevel` / `increaseTemperature` ahead of the ceiling,
 * the behavior executor's tile keys, the `Place*Tile` steps, the conversions,
 * the standard projects, the final greenery, the preview passes), and several
 * of them are loaded while `Card.ts` itself is still initializing — the
 * parliament's hub (`ParliamentHandler`, which pulls the phase, the catalog
 * and the party effects) cannot be imported there without closing a cycle on
 * the card class. Everything here reads the live parliament object off the
 * game and opens the recorder's scope; `ParliamentHandler.divertTerraforming`
 * / `divertsTerraforming` are this module's public face in the hub.
 */
import {IPlayer} from '../IPlayer';
import {Phase} from '../../common/Phase';
import {EventSource} from '../../common/events/EventSource';
import {TerraformingOrigin, TerraformingUnit} from './resolutions/IResolution';

/**
 * DOES A STANDING LAW REPLACE THIS SEAT'S TERRAFORMING? A pure QUERY, like
 * `cardDiscount`: the gates the ceiling and the cell impose on an action fall
 * while it answers true (decision Р5 — the law seats nothing and needs no
 * room), the previews' exit pass strikes the printed units, the futility
 * reader judges by the holders instead of the ceiling. False for a seat
 * outside the law's `restriction` aspect (MarsBot under `'none'`) and during
 * the World Government's phase (nobody «gains» there).
 *
 * MarsBot under `'politics'` IS bound (the owner, 2026-10-24 — decision D13):
 * a law never PAYS the bot (D3), but a replacement is a RESTRICTION — the
 * law's whole point is to drag the game out, and a bot that still terraformed
 * would make it dead for every human beside it (RX42's `restriction` reading).
 * What stands instead is the law hook's to say: the bot holds no card
 * resource, so its unit becomes M€ (`divertIntoBotMegacredits`).
 */
export function divertsTerraforming(player: IPlayer): boolean {
  const parliament = player.game?.parliament;
  const enacted = parliament?.enactedDefinition();
  if (parliament === undefined || enacted === undefined || enacted.passive?.divertTerraforming === undefined) {
    return false;
  }
  return player.game.phase !== Phase.SOLAR && parliament.participates(player, 'restriction');
}

/**
 * ASK THE LAW TO REPLACE `unit` — every entry performs NOTHING when this
 * answers true: the law has already queued what stands instead, under its own
 * effect scope on the channel `terraforming-diverted` (so the replacement's
 * records are the law's own children, and the notification, the journal and
 * the stats name the law). The entries keep out what the law never touches: a
 * lowering, an `unrewarded` move (checked before asking); this gate keeps out
 * the World Government's phase and a seat outside the `restriction` aspect.
 *
 * `origin` is who produced the unit (a card, a project, a cell, a colony, the
 * final placement) — read off the live event scope when the entry hands none,
 * so a hook that names it never guesses.
 */
export function divertTerraforming(player: IPlayer, unit: TerraformingUnit, origin?: TerraformingOrigin): boolean {
  const parliament = player.game?.parliament;
  const enacted = parliament?.enactedDefinition();
  const hook = enacted?.passive?.divertTerraforming;
  if (parliament === undefined || enacted === undefined || hook === undefined || !divertsTerraforming(player)) {
    return false;
  }
  const from = origin ?? originOfScope(player.game.events.currentSource());
  return player.game.events.withEffectSource(player, {kind: 'resolution', id: enacted.id, owner: player.color}, 'terraforming-diverted',
    () => hook(player, unit, from) === true);
}

/** The unit's origin as the live scope names it — the vocabulary every prompt's asker speaks (shared with the rating veto's gate). */
export function originOfScope(source: EventSource | undefined): TerraformingOrigin | undefined {
  if (source === undefined) {
    return undefined;
  }
  switch (source.kind) {
  case 'card':
  case 'corporation':
  case 'standardProject':
    return {kind: source.kind, card: source.card};
  case 'colony':
    return {kind: 'colony', name: source.name};
  default:
    return undefined;
  }
}

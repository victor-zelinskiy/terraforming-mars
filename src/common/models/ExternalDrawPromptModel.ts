import {CardName} from '../cards/CardName';
import {Color} from '../Color';
import {ResolutionId} from '../parliament/ParliamentTypes';

/**
 * WHO granted an external draw — the whole «what → why → who» reading of the
 * take surface, as data. Two families, deliberately kept apart because they
 * answer different questions:
 *
 *  · `card` — another player's action set an effect off (Solar Logistics on a
 *    foreign space event, Sponsored Academies' «all opponents draw 1 card»):
 *    there IS an initiator and a played card, and the surface names both.
 *  · `resolution` — an ENACTED RESOLUTION's own effect pays it (Turmoil Redux,
 *    Climate Research): the political phase is the cause, nobody «did» it to
 *    the recipient, and the source is the resolution's own face — the same
 *    source plate, code and L3 inspection every other resolution ask carries.
 */
export type ExternalDrawCause =
  | {
      kind: 'card';
      /** The card whose EFFECT granted the draw (Solar Logistics; Sponsored
       *  Academies for the «opponents draw» half of its own play). */
      effectCard: CardName;
      /** Whether the effect card belongs to the RECIPIENT («you» — your own blue
       *  card reacted) or to the INITIATOR (their card handed the cards out). The
       *  client words the cause line off this, never off tableau guessing. */
      effectCardOwner: 'you' | 'initiator';
      /** Who set the effect off — an ordinary player color (MarsBot included; the
       *  client renders it through the regular player model). */
      initiator: Color;
      /** The card the initiator played/resolved that TRIGGERED the effect, when
       *  known (the foreign space event behind Solar Logistics). Distinct from
       *  `effectCard`: one provides the effect, the other activated it. */
      triggerCard?: CardName;
    }
  | {
      kind: 'resolution';
      /** The enacted resolution's catalog id — the source face, code and L3. */
      resolution: ResolutionId;
      /** The scaled effect (`InfluenceScaledEffect.id`) that computed the count. */
      effect?: string;
    };

/**
 * Marker: this `SelectCard` is the mandatory TAKE step of an EXTERNAL draw — a
 * draw granted OUTSIDE the recipient's own managed flow (another player set an
 * effect off, or the political phase enacted a resolution that pays cards).
 *
 * The cards were drawn from the deck AT THE MOMENT the effect fired, so deck
 * order and distribution never depend on when the recipient answers; they are
 * WITHHELD from `cardsInHand` (and every hand projection) until each one is
 * taken through this prompt. Answering with a subset takes exactly those
 * cards; the prompt re-issues with the remainder (same `intakeId`), so a
 * partial take survives reload/reconnect as ordinary game state.
 *
 * Structural and translation-proof (cross-cutting invariant 1): the console
 * derives the whole «what → why → who» reading from this marker, never from
 * the (translatable, render-mutated) prompt title.
 */
export type ExternalDrawTakeMeta = {
  /** Stable id of the intake batch (per recipient; survives re-issued prompts). */
  intakeId: number;
  /** Total cards this trigger granted. */
  count: number;
  /** Cards still awaiting the take (== this prompt's candidate list). */
  remaining: number;
  /** WHO granted the draw (see {@link ExternalDrawCause}). */
  cause: ExternalDrawCause;
};

/** The card-granted cause, narrowed (the client's two branches read one helper each). */
export function externalDrawCardCause(meta: ExternalDrawTakeMeta): Extract<ExternalDrawCause, {kind: 'card'}> | undefined {
  return meta.cause.kind === 'card' ? meta.cause : undefined;
}

/** The resolution-granted cause, narrowed (Turmoil Redux). */
export function externalDrawResolutionCause(meta: ExternalDrawTakeMeta): Extract<ExternalDrawCause, {kind: 'resolution'}> | undefined {
  return meta.cause.kind === 'resolution' ? meta.cause : undefined;
}

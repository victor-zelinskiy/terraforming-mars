import {CardRenderDynamicVictoryPoints} from './render/CardRenderDynamicVictoryPoints';
import {ICardRenderDescription} from './render/ICardRenderDescription';
import {CardComponent} from './render/CardComponent';
import {CardInformation, CardInfoText} from './CardInformation';
import {CardName} from './CardName';

export type CardMetadata = {
  /**
   * The card's number. It's not used. it used to be shown, but now it isn't.
   *
   * It could be rendered on the card again, or used as part of card search.
   */
  cardNumber?: string;
  /**
   * The card this one REIMPLEMENTS / replaces (a promo reissue of a base card,
   * e.g. Deimos Down Promo → Deimos Down). Used by the art resolver
   * (`cardArt.ts`): when this card has no artwork of its own (its `cardNumber`
   * is absent from the art manifest), it borrows the reimplemented card's art
   * instead of the generic fallback — the two cards share the same illustration.
   */
  reimplements?: CardName;
  description?: string | ICardRenderDescription;
  renderData?: CardComponent;
  victoryPoints?: number | CardRenderDynamicVictoryPoints;
  /**
   * CO-LOCATED information texts for BESPOKE mechanics (English keys only —
   * translations live in each locale's card_info.json). Authored in the
   * card file, consumed by the make:cards information generator; NOT
   * exported to the client (the generated `information` below is).
   */
  infoText?: ReadonlyArray<CardInfoText>;
  /**
   * Structured per-graphic-block card text (see CardInformation.ts).
   * GENERATED at build time (make:cards) — never hand-set in card classes;
   * attached to the exported ClientCard's metadata for the client / the
   * future fullscreen information panel. The legacy `description` above
   * stays for the legacy renderer only (LEGACY — do not consume in new code).
   */
  information?: CardInformation;
}

import {CardRenderDynamicVictoryPoints} from './render/CardRenderDynamicVictoryPoints';
import {ICardRenderDescription} from './render/ICardRenderDescription';
import {CardComponent} from './render/CardComponent';
import {CardInformation} from './CardInformation';

export type CardMetadata = {
  /**
   * The card's number. It's not used. it used to be shown, but now it isn't.
   *
   * It could be rendered on the card again, or used as part of card search.
   */
  cardNumber?: string;
  description?: string | ICardRenderDescription;
  renderData?: CardComponent;
  victoryPoints?: number | CardRenderDynamicVictoryPoints;
  /**
   * Structured per-graphic-block card text (see CardInformation.ts).
   * GENERATED at build time (make:cards) — never hand-set in card classes;
   * attached to the exported ClientCard's metadata for the client / the
   * future fullscreen information panel. The legacy `description` above
   * stays for the legacy renderer only (LEGACY — do not consume in new code).
   */
  information?: CardInformation;
}

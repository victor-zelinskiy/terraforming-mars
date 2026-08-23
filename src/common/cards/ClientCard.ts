import {CardResource} from '../CardResource';
import {Units} from '../Units';
import {CardName} from './CardName';
import {CardType} from './CardType';
import {Expansion, GameModule} from './GameModule';
import {CardMetadata} from './CardMetadata';
import {CardRequirementDescriptor} from './CardRequirementDescriptor';
import {CountableVictoryPoints} from './CountableVictoryPoints';
import {Tag} from './Tag';
import {CardDiscount} from './Types';
import {OneOrArray} from '../utils/types';

export type ClientCard = Readonly<{
  name: CardName;
  module: GameModule;
  tags: ReadonlyArray<Tag>;
  cardDiscount?: OneOrArray<CardDiscount>;
  victoryPoints?: number | 'special' | CountableVictoryPoints,
  cost?: number;
  type: CardType;
  requirements?: ReadonlyArray<CardRequirementDescriptor>;
  metadata: CardMetadata;
  productionBox?: Units; // Replace with behavior?
  resourceType?: CardResource;
  startingMegaCredits?: number; // Corporation and Prelude
  cardCost?: number; // Corporation
  compatibility: Array<Expansion>;
  hasAction: boolean; // For Prelude 2 preludes with actions. Can be used for more, of course.
  /**
   * This CORPORATION owes a MANDATORY FIRST ACTION when it is played.
   *
   * Generated from the card's own declaration under EXACTLY the condition
   * `Player.playCorporationCard` uses to fill `pendingInitialActions`
   * (`initialAction !== undefined && initialActionText !== undefined`), so
   * the client's answer can never disagree with the server's ledger.
   *
   * It exists because the ledger only fills at PLAY time, while the console's
   * start flow must name its stages BEFORE the deployment runs — a chapter
   * that pops into the journey rail when the corporation lands reads as the
   * flow changing its mind. (A merger's second corporation is genuinely
   * unknown until it is chosen, and stays a dynamic addition.)
   */
  hasFirstAction?: boolean;
  /** The card grants N bonus actions when played (Head Start) — exported so
   *  the start flow can DECLARE its bonus chapter before the card is played,
   *  exactly like `hasFirstAction` declares the corp's. */
  grantsBonusActions?: number;
}>

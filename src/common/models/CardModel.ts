import {Units} from '../Units';
import {CardName} from '../cards/CardName';
import {Resource} from '../Resource';
import {AdditionalProjectCosts, CardDiscount, StandardProjectCanPayWith} from '../cards/Types';
import {Tag} from '../cards/Tag';
import {Warning} from '../cards/Warning';
import {UnplayableReason} from '../cards/UnplayableReason';
import {Message} from '../logs/Message';
// `import type`: `ActionPreviewModel` imports `PlayerInputModel`, which imports
// THIS file — a value import would close that cycle at runtime (the same reason
// `PlayerInputModel` type-imports `ActionEffect`).
import type {ActionEffect} from './ActionPreviewModel';

/**
 * The GUARANTEED result of a standard project, computed server-side from the
 * real rule sources (adjusted cost, the card's own `tr` bump clamped to the
 * global scales, co-located per-card extras). Attached to a std project's
 * CardModel in the standard-projects menu so the client can render honest
 * `current → resulting` chips without re-deriving a single rule.
 *
 * `target` names the follow-up the project asks for AFTER the initial submit —
 * the PAY-ON-COMMIT projects (City / Greenery / Aquifer → a board space,
 * Build Colony → a colony), whose cost applies only once that target commits.
 * The console hosts that follow-up as a nested step of the Standard-Projects
 * flow; target-DEPENDENT consequences (cell bonuses, colony grants) stay with
 * the step's own preview surfaces and are deliberately NOT guessed here.
 */
export interface StandardProjectPreviewModel {
    effects: ReadonlyArray<ActionEffect>;
    target?: 'space' | 'colony';
}

export interface CardModel {
    name: CardName;
    resources?: number | undefined;
    calculatedCost?: number;
    isSelfReplicatingRobotsCard?: boolean,
    discount?: Array<CardDiscount>,
    isDisabled?: boolean; // Used with Pharmacy Union
    // When this card is a DISABLED candidate in a SelectCard prompt (it's a
    // relevant target but can't be picked right now — e.g. no resources on it),
    // a user-facing reason. Shown as a badge/popover in the premium card picker.
    disabledReason?: string | Message;
    additionalProjectCosts?: AdditionalProjectCosts;
    warnings?: ReadonlyArray<Warning>;
    // Structured reasons this card can't be played right now. Set only for
    // the viewer's OWN cards in hand (in their private PlayerViewModel) and
    // only when the card is currently unplayable. See UnplayableReason.
    unplayableReasons?: ReadonlyArray<UnplayableReason>;
    // Structured reasons this card's activatable ACTION can't be used right now.
    // Set for (a) the viewer's OWN tableau (their PublicPlayerModel is the
    // self-model) — an action card whose action is currently unavailable AND not
    // yet used this generation, and (b) a DISABLED STANDARD PROJECT in the
    // standard-projects menu (see server/models/standardProjectReasons.ts): same
    // question, same shape, one renderer. Reuses UnplayableReason's shape.
    // Drives the "why is this disabled" popover / status line.
    actionReasons?: ReadonlyArray<UnplayableReason>;
    reserveUnits?: Readonly<Units>; // Written for The Moon, but useful in other contexts.
    bonusResource?: Array<Resource>; // Used with the Mining cards and Robotic Workforce
    cloneTag?: Tag; // Used with Pathfinders
    standardProjectCanPayWith?: StandardProjectCanPayWith; // Set for standard projects; undefined for regular project cards
    standardProjectPreview?: StandardProjectPreviewModel; // Set for standard projects in the std-projects menu
}

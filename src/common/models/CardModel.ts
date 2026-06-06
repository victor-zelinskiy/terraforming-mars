import {Units} from '../Units';
import {CardName} from '../cards/CardName';
import {Resource} from '../Resource';
import {AdditionalProjectCosts, CardDiscount, StandardProjectCanPayWith} from '../cards/Types';
import {Tag} from '../cards/Tag';
import {Warning} from '../cards/Warning';
import {UnplayableReason} from '../cards/UnplayableReason';
import {Message} from '../logs/Message';

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
    // Set only for the viewer's OWN tableau (their PublicPlayerModel is the
    // self-model) and only for an action card whose action is currently
    // unavailable AND not yet used this generation. Reuses UnplayableReason's
    // shape. Drives the Actions overlay's "why is this disabled" popover.
    actionReasons?: ReadonlyArray<UnplayableReason>;
    reserveUnits?: Readonly<Units>; // Written for The Moon, but useful in other contexts.
    bonusResource?: Array<Resource>; // Used with the Mining cards and Robotic Workforce
    cloneTag?: Tag; // Used with Pathfinders
    standardProjectCanPayWith?: StandardProjectCanPayWith; // Set for standard projects; undefined for regular project cards
}

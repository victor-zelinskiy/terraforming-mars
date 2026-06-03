import {Units} from '../Units';
import {CardName} from '../cards/CardName';
import {Resource} from '../Resource';
import {AdditionalProjectCosts, CardDiscount, StandardProjectCanPayWith} from '../cards/Types';
import {Tag} from '../cards/Tag';
import {Warning} from '../cards/Warning';
import {UnplayableReason} from '../cards/UnplayableReason';

export interface CardModel {
    name: CardName;
    resources?: number | undefined;
    calculatedCost?: number;
    isSelfReplicatingRobotsCard?: boolean,
    discount?: Array<CardDiscount>,
    isDisabled?: boolean; // Used with Pharmacy Union
    additionalProjectCosts?: AdditionalProjectCosts;
    warnings?: ReadonlyArray<Warning>;
    // Structured reasons this card can't be played right now. Set only for
    // the viewer's OWN cards in hand (in their private PlayerViewModel) and
    // only when the card is currently unplayable. See UnplayableReason.
    unplayableReasons?: ReadonlyArray<UnplayableReason>;
    reserveUnits?: Readonly<Units>; // Written for The Moon, but useful in other contexts.
    bonusResource?: Array<Resource>; // Used with the Mining cards and Robotic Workforce
    cloneTag?: Tag; // Used with Pathfinders
    standardProjectCanPayWith?: StandardProjectCanPayWith; // Set for standard projects; undefined for regular project cards
}

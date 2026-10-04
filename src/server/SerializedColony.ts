
import {ColonyName} from '../common/colonies/ColonyName';
import {PlayerId, SpaceId} from '../common/Types';

export type SerializedColony = {
    name: ColonyName;
    colonies: Array<PlayerId>;
    isActive: boolean;
    trackPosition: number;
    visitor: undefined | PlayerId;
    /** The cells whose tile lies ON this colony tile (`IColony.tiles`). Absent = none (and every save made before the field). */
    tiles?: Array<SpaceId>;
}


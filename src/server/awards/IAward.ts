import {AwardName} from '../../common/ma/AwardName';
import {IPlayer} from '../IPlayer';
import {CardResource} from '../../common/CardResource';

export interface IAward {
    name: AwardName;
    description: string;
    getScore(player: IPlayer): number;
    /**
     * The card resources whose AMOUNT this one counts (`'any'` — every kind): one more unit of such a resource on a
     * card moves the score. Declared beside `getScore` (the one reader that knows), read by the «no effect» verdict
     * (`models/actionFutility.ts`) — a resource that still counts for a live award is never «for nothing».
     * Guard: `tests/models/actionFutility.spec.ts` (every scorer reading a resource amount declares it).
     */
    readonly cardResourceCount?: ReadonlyArray<CardResource> | 'any';
}

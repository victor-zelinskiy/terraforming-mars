import {Resource} from '../../common/Resource';
import {OrOptions} from '../inputs/OrOptions';
import {SelectOption} from '../inputs/SelectOption';
import {IPlayer} from '../IPlayer';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {gainProduction} from '../inputs/optionMetadata';

export class SelectResourceTypeDeferred extends DeferredAction<Resource> {
  constructor(
    player: IPlayer,
    public resources: ReadonlyArray<Resource>,
    public title: string,
  ) {
    super(player, Priority.DEFAULT);
  }

  public execute() {
    const orOptions = new OrOptions().setTitle(this.title);
    // Every caller of this deferred grants +1 production of the chosen resource
    // (the title is literally "gain 1 unit of production"). Attach premium option
    // metadata so the modal shows the resource icon + a current → resulting
    // production preview instead of a bare resource name.
    orOptions.options = this.resources.map((resource) => {
      return new SelectOption(resource, 'OK')
        .withMetadata(gainProduction(this.player, resource, 1))
        .andThen(() => {
          this.cb(resource);
          return undefined;
        });
    });
    if (orOptions.options.length === 0) {
      return undefined;
    }
    if (orOptions.options.length === 1) {
      orOptions.options[0].cb();
      return undefined;
    }
    return orOptions;
  }
}

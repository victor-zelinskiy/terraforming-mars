import {ColonyName} from '../../common/colonies/ColonyName';
import {SerializedColony} from '../SerializedColony';
import {ALL_COLONIES_TILES} from './ColonyManifest';
import {IColony} from './IColony';
import {SpaceId} from '../../common/Types';

export class ColonyDeserializer {
  public static deserialize(serialized: SerializedColony | ColonyName): IColony | undefined {
    const name = typeof(serialized) === 'string' ? serialized : serialized.name;
    const factory = ALL_COLONIES_TILES.find((cf) => cf.colonyName === name);
    if (factory === undefined) {
      console.warn(`colony ${name} not found`);
      return undefined;
    }

    const colony = new factory.Factory();
    if (typeof(serialized) !== 'string') {
      colony.colonies = serialized.colonies;
      colony.isActive = serialized.isActive;
      colony.trackPosition = serialized.trackPosition;
      colony.visitor = serialized.visitor;
      // A tile on a colony tile is a space-colony cell (Nova City). Those ids lead with 'c' since the upstream
      // migration toward the eleven-row Amazonis Planitia board (c24eae02b6); a save from before keeps the bare id.
      // TODO: remove with GameSetup.migrateColonySpaceIds.
      colony.tiles = (serialized.tiles ?? []).map((id) => /^[0-9][0-9]$/.test(id) ? `c${id}` as SpaceId : id);
    }
    return colony;
  }

  public static deserializeAndFilter(serialized: Array<SerializedColony | ColonyName>): Array<IColony> {
    return serialized.map((c) => this.deserialize(c)).filter((c) => c !== undefined);
  }
}

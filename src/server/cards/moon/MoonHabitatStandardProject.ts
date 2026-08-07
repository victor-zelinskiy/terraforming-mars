import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {StandardProjectCard} from '../StandardProjectCard';
import {MoonExpansion} from '../../moon/MoonExpansion';
import {PlaceMoonHabitatTile} from '../../moon/PlaceMoonHabitatTile';
import {Resource} from '../../../common/Resource';
import {TileType} from '../../../common/TileType';
import {AltSecondaryTag} from '../../../common/cards/render/AltSecondaryTag';
import * as actionReason from '../actionReasons';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';


export class MoonHabitatStandardProject extends StandardProjectCard {
  constructor(properties = {
    name: CardName.MOON_HABITAT_STANDARD_PROJECT,
    cost: 22,
    reserveUnits: {titanium: 1},
    tr: {moonHabitat: 1},
    tilesBuilt: [TileType.MOON_HABITAT],

    metadata: {
      cardNumber: '',
      renderData: CardRenderer.builder((b) =>
        b.standardProject('Spend 22 M€ and 1 titanium to place a habitat on The Moon and raise your M€ production 1 step.', (eb) => {
          eb.megacredits(22).titanium(1).startAction.moonHabitat({secondaryTag: AltSecondaryTag.MOON_HABITAT_RATE}).production((pb) => pb.megacredits(1));
        }),
      ),
    },
  }) {
    super(properties);
  }

  public override canAct(player: IPlayer): boolean {
    const moonData = MoonExpansion.moonData(player.game);
    const spaces = moonData.moon.getAvailableSpacesOnLand(player);

    if (spaces.length === 0) {
      return false;
    }

    return super.canAct(player);
  }

  // Co-located with canAct so the reason can't drift when the gate changes.
  // Inherited by both variants — their extra gate is a game OPTION, and
  // `Game.getStandardProjects` already drops a variant whose option is off, so a
  // disabled variant is never the option's fault.
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    const moonData = MoonExpansion.moonData(player.game);
    if (moonData.moon.getAvailableSpacesOnLand(player).length === 0) {
      return actionReason.placementReason('No space left on The Moon');
    }
    return undefined;
  }

  actionEssence(player: IPlayer): void {
    const adjustedReserveUnits = MoonExpansion.adjustedReserveCosts(player, this);
    player.stock.deductUnits(adjustedReserveUnits);
    player.game.defer(new PlaceMoonHabitatTile(player));
    player.production.add(Resource.MEGACREDITS, 1, {log: true});
  }
}

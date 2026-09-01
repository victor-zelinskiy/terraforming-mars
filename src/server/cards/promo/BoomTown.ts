import {PreludeCard} from '../prelude/PreludeCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {Space} from '../../boards/Space';
import {SpaceBonus} from '../../../common/boards/SpaceBonus';
import {Size} from '../../../common/cards/render/Size';
import {TileType} from '../../../common/TileType';
import {PlaceCityTile} from '../../deferredActions/PlaceCityTile';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class BoomTown extends PreludeCard {
  constructor() {
    super({
      name: CardName.BOOM_TOWN,
      tags: [Tag.BUILDING, Tag.CITY],

      behavior: {
        production: {titanium: 2},
        titanumValue: -1,
      },

      metadata: {

        infoText: [

          {text: 'Place a city tile on an area with a steel or titanium placement bonus.', tokens: ['city']},

          {text: 'Increase your titanium production 2 steps.', tokens: ['production(']},

        ],
        cardNumber: 'X80',
        renderData: CardRenderer.builder((b) => {
          // The permanent titanium devaluation is an ONGOING rule, so it is drawn
          // as a real `effect()` frame (the same shape Advanced Alloys / Rego
          // Plastics / PhoboLog use for the positive direction) rather than the
          // loose graphic row + `plainText` upstream ships. That is what makes the
          // premium face draw it as an effect band, the ЭФФЕКТЫ overlay list it,
          // and `metadata.information` file it under «постоянный эффект» instead
          // of the on-play zone.
          b.effect('Your titanium is worth 1 M€ less.', (eb) => {
            eb.titanium(1).startEffect.minus(Size.SMALL).megacredits(1);
          }).br;
          b.city().asterix().production((pb) => pb.titanium(2));
        }),
        description: 'Place a city tile on an area with a STEEL OR TITANIUM PLACEMENT BONUS. Increase your titanium production 2 steps.',
      },
    });
  }

  private availableSpaces(player: IPlayer): ReadonlyArray<Space> {
    return player.game.board.getAvailableSpacesForType(player, 'city')
      .filter((space) => space.bonus.includes(SpaceBonus.STEEL) || space.bonus.includes(SpaceBonus.TITANIUM));
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    return this.availableSpaces(player).length > 0;
  }

  // The city is placed bespoke (a filtered `SelectSpace`, not declarative
  // `behavior.city`), so the generic preview walker can't emit the "you'll place
  // a tile" note — the prelude's press beat would show the titanium production
  // and stay mute about the board interaction that follows it.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.placementPreview(this, player, {
      tile: TileType.CITY,
      constraint: 'on a steel or titanium bonus area',
    });
  }

  public override bespokePlay(player: IPlayer) {
    // Every cell a city COULD go on. One that isn't offered is off-limits for
    // exactly one reason: it lacks the required steel/titanium placement bonus →
    // 'wrong-bonus-type'. A cell that HAS the bonus but is illegal for another
    // reason (adjacent to a city, occupied, reserved) is not in this set and keeps
    // its generic reason rather than a misleading "no bonus".
    const cityPlaceable = new Set(player.game.board.getAvailableSpacesForType(player, 'city').map((s) => s.id));
    player.game.defer(new PlaceCityTile(player, {
      spaces: this.availableSpaces(player),
      title: 'Select a space with a steel or titanium bonus for city tile',
      // Names the card in the placement context + lets the per-cell preview ask
      // this card what it does on the hovered cell.
      sourceCard: this.name,
      customReasoner: (space) => {
        if (cityPlaceable.has(space.id) &&
            !space.bonus.includes(SpaceBonus.STEEL) &&
            !space.bonus.includes(SpaceBonus.TITANIUM)) {
          return 'wrong-bonus-type';
        }
        return undefined;
      },
    }));
    return undefined;
  }
}

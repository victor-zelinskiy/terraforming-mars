/*
 * THE CHAIRMAN QUEST AS A GRAPHIC (Turmoil Redux).
 *
 * A quest's goal is data (`QuestDefinition`), and the ONE drawing of it is
 * built here from the same render DSL every card face uses — so the
 * resolution's quest corner, the Parliament workspace's quest block and the
 * inspector all show the same icons for «raise your heat production 3 steps»
 * and none of them ever hand-composes a second formula. Exported into
 * `genfiles/parliament.json` beside the resolution's own render data.
 */
import {CardRenderer} from '../../cards/render/CardRenderer';
import {ICardRenderRoot} from '../../../common/cards/render/Types';
import {Size} from '../../../common/cards/render/Size';
import {AltSecondaryTag} from '../../../common/cards/render/AltSecondaryTag';
import {Resource} from '../../../common/Resource';
import {QuestDefinition, STARTER_QUEST} from '../../../common/parliament/ParliamentTypes';

/** English i18n key of the printed generation-1 quest. */
export const STARTER_QUEST_TEXT = 'Raise your heat production 3 steps';

type Builder = Parameters<Parameters<typeof CardRenderer.builder>[0]>[0];
type ProductionBuilder = Parameters<Parameters<Builder['production']>[0]>[0];

function productionOf(pb: ProductionBuilder, resource: Resource, count: number): void {
  switch (resource) {
  case Resource.MEGACREDITS: pb.megacredits(count); return;
  case Resource.STEEL: pb.steel(count); return;
  case Resource.TITANIUM: pb.titanium(count); return;
  case Resource.PLANTS: pb.plants(count); return;
  case Resource.ENERGY: pb.energy(count); return;
  case Resource.HEAT: pb.heat(count); return;
  }
}

/** The goal's graphic: what to do and how many times, in the card DSL. */
export function questRenderData(quest: QuestDefinition): ICardRenderRoot {
  const goal = quest.goal;
  const count = quest.count;
  return CardRenderer.builder((b) => {
    switch (goal.kind) {
    case 'production':
      b.production((pb) => productionOf(pb, goal.resource, count));
      return;
    case 'tag':
      b.tag(goal.tag, count);
      return;
    case 'tile':
      for (let i = 0; i < count; i++) {
        switch (goal.tile) {
        case 'greenery':
          b.greenery({size: Size.SMALL, withO2: false});
          break;
        case 'city':
          b.city({size: Size.SMALL});
          break;
        case 'cityOrSpecial':
          b.city({size: Size.SMALL}).slash().specialTile({size: Size.SMALL});
          break;
        case 'spaceCity':
          b.city({size: Size.SMALL}).asterix();
          break;
        }
      }
      return;
    case 'colony':
      b.colonies(count);
      return;
    case 'tr':
      b.tr(count);
      return;
    case 'cardResource':
      b.resource(goal.resource, count);
      return;
    case 'delegates':
      b.delegates(count);
      return;
    case 'cardsPlayed':
      // A card OF A TYPE: the card glyph with the type's header band (the
      // physical game's own «blue card» / «green card» icon — the premium
      // face draws the band from the secondary tag), one per card to play.
      // Never a draw-card icon alone (it would read as «take 2 cards») and
      // never a text plate inside a graphic zone.
      b.cards(count, {secondaryTag: goal.cardType === 'active' ? AltSecondaryTag.BLUE : AltSecondaryTag.GREEN});
      return;
    }
  });
}

/** The printed generation-1 quest, drawn the same way. */
export function starterQuestRenderData(): ICardRenderRoot {
  return questRenderData(STARTER_QUEST);
}

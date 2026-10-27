import {IPlayer} from '../IPlayer';
import {Resource} from '../../common/Resource';
import {
  countCardsToward,
  countProductionToward,
  CountedCardFacts,
  resolutionCountKind,
  ResolutionCountId,
  ResolutionCountModel,
} from '../../common/parliament/resolutionCounts';
import {newProjectCard} from '../createCard';

/**
 * MARSBOT'S OWN COUNTS FOR A RESOLUTION (decision D16, the owner 2026-10-27:
 * «бот получает начисления по реально своим тегам или тайлам — максимально
 * приближено к игрокам»). The bot is a real `Player` but keeps no tableau and
 * no production, so the four kinds of count a tableau answers for a human are
 * answered here from what the bot really has:
 *  · TAGS — its printed TRACKS, the position of a track is the number of every
 *    tag it serves (the Automa FAQ reading the engine already uses for every
 *    human card that counts an opponent's tags — `AutomaTargeting.
 *    automaTagCount`, the infopanel's tag matrix). A count over SEVERAL tags
 *    reads every serving track ONCE: the bio track is the plant AND microbe AND
 *    animal track, never three times (the owner's choice «позиция трека
 *    целиком», counted once per query). A tag no track serves (Mars) is 0;
 *  · CARDS — its PLAYED PILE (every project card it resolved), through the
 *    SAME predicate a human's tableau goes through (`countCardsToward`);
 *    events lie face down like a human's;
 *  · PRODUCTION — the track each production stands for on its printed board
 *    (`MarsBotBoard.getTrackIndexForProduction`, RB-A p.5: a production loss
 *    regresses that track, a quest's production is its advance), its position;
 *  · HOLDERS — its STORES (the floater pool, every shipping storage area, the
 *    corporation's own pile) holding at least one resource; a store is a
 *    holder, its own resource a kind.
 * Every other kind (the board, the colonies, the TR threshold) is the bot's
 * real state and is read by the human path — `undefined` here.
 */
export function botResolutionCount(bot: IPlayer, id: ResolutionCountId): ResolutionCountModel | undefined {
  const automa = bot.game.automa;
  if (automa === undefined) {
    return undefined;
  }
  const kind = resolutionCountKind(id);
  switch (kind.kind) {
  case 'tags': {
    const seen = new Set<number>();
    const byTag: Array<{tag: typeof kind.tags[number], count: number}> = [];
    let shared = false;
    for (const tag of kind.tags) {
      const index = automa.board.getTrackIndexForTag(tag);
      if (index === undefined) {
        byTag.push({tag, count: 0});
        continue;
      }
      if (seen.has(index)) {
        shared = true;
        byTag.push({tag, count: 0});
        continue;
      }
      seen.add(index);
      byTag.push({tag, count: automa.board.tracks[index].position});
    }
    const count = byTag.reduce((sum, entry) => sum + entry.count, 0);
    // A breakdown only where every tag stands on its own track — «[plant] 9 + [microbe] 0» would read as a lie.
    return kind.tags.length > 1 && !shared ? {id, count, cards: [], byTag} : {id, count, cards: []};
  }
  case 'cards': {
    const pile: Array<CountedCardFacts> = [];
    for (const name of automa.playedPile) {
      const card = newProjectCard(name);
      if (card !== undefined) {
        pile.push(card);
      }
    }
    return countCardsToward(id, pile, {eventTagsInPlay: false});
  }
  case 'production': {
    const production: Partial<Record<Resource, number>> = {};
    for (const resource of kind.resources) {
      production[resource] = botProductionEquivalent(bot, resource);
    }
    return countProductionToward(id, production);
  }
  case 'holders': {
    const stores = botStores(bot);
    const count = kind.measure === 'types' ? new Set(stores.map((s) => s.kind)).size : stores.length;
    return {id, count, cards: []};
  }
  default:
    return undefined;
  }
}

/** The bot's «production» of `resource`: the position of the track that production stands for (0 when none). */
export function botProductionEquivalent(bot: IPlayer, resource: Resource): number {
  const automa = bot.game.automa;
  const index = automa?.board.getTrackIndexForProduction(resource);
  return automa === undefined || index === undefined ? 0 : automa.board.tracks[index].position;
}

/** The bot's stores holding at least one resource — its «cards with resources». */
export function botStores(bot: IPlayer): Array<{store: string, kind: string, amount: number}> {
  const automa = bot.game.automa;
  if (automa === undefined) {
    return [];
  }
  const stores: Array<{store: string, kind: string, amount: number}> = [];
  if (automa.floaters > 0) {
    stores.push({store: 'floaters', kind: 'floater', amount: automa.floaters});
  }
  for (const [colony, amount] of Object.entries(automa.shippingStorage)) {
    if (typeof amount === 'number' && amount > 0) {
      stores.push({store: `storage:${colony}`, kind: `storage:${colony}`, amount});
    }
  }
  if (automa.corpResources > 0) {
    stores.push({store: 'corporation', kind: `corp:${automa.corpResourceKind ?? 'own'}`, amount: automa.corpResources});
  }
  return stores;
}


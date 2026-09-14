import {Expansion, GameModule} from '../../common/cards/GameModule';
import {OneOrArray} from '../../common/utils/types';
import {asArray} from '../../common/utils/utils';
import {GameOptions} from '../game/GameOptions';

/**
 * Defines conditions for creating a card in a game, including conditions
 * when it will be included in a game.
 */
export type CardFactorySpec<T> = {
  // Creates a new instance of this card.
  Factory: new () => T;
  // Returns the required modules for this card.
  compatibility?: OneOrArray<Expansion>;
  // False when the card should not be instantiated. It's reserved for fake and proxy cards.
  instantiate?: boolean;
  // Used for Turmoil's global events. When true, classifeid as a "negative" global event.
  negative?: boolean;
  /**
   * For an entry that needs a POLITICAL ENGINE (`compatibility: 'turmoil'`):
   * which engines it has been adapted to. Absent = `'classic'` (the upstream
   * implementation reads `Turmoil` directly and is NOT ready for Turmoil
   * Redux). Adapting a card = implementing it through `game.politics` and
   * marking it `'redux'` / `'both'` — never widening the Redux pool by API
   * presence, never flipping the classic option on.
   */
  politics?: 'classic' | 'redux' | 'both';
}

export function isCompatibleWith(cf: CardFactorySpec<any>, gameOptions: GameOptions): boolean {
  if (cf.compatibility === undefined) {
    return true;
  }
  const expansions: Array<GameModule> = asArray(cf.compatibility);
  return expansions.every((expansion) => {
    switch (expansion) {
    case 'venus':
      return gameOptions.venusNextExtension;
    case 'colonies':
      return gameOptions.coloniesExtension;
    case 'turmoil':
      if (gameOptions.turmoilExtension) {
        return true;
      }
      // Turmoil Redux provides a political engine, but a card joins its pool
      // only once adapted (see `politics`).
      return gameOptions.turmoilReduxExpansion === true && (cf.politics === 'redux' || cf.politics === 'both');
    case 'turmoilRedux':
      return gameOptions.turmoilReduxExpansion;
    case 'prelude':
      return gameOptions.preludeExtension;
    case 'prelude2':
      return gameOptions.prelude2Expansion;
    case 'moon':
      return gameOptions.moonExpansion;
    case 'pathfinders':
      return gameOptions.pathfindersExpansion;
    case 'ares':
      return gameOptions.aresExtension;
    case 'ceo':
      return gameOptions.ceoExtension;
    case 'starwars':
      return gameOptions.starWarsExpansion;
    case 'underworld':
      return gameOptions.underworldExpansion;
    case 'deltaProject':
      return gameOptions.deltaProjectExpansion;
    }
    throw new Error(`Unhandled expansion type ${expansion}`);
  });
}

/*
 * CURATED CARD INFORMATION — the hand-authored tail of the generator.
 *
 * Three registries:
 *  - CURATED_CARD_INFO: block sets for bespoke cards whose mechanics can't
 *    be derived from `behavior` (multi-block bespokePlay cards). `tokens`
 *    link a block to its graphic row (matched against the shared
 *    deriveGraphicIds signatures; 'production(' matches any production box,
 *    'tile-' any special tile). Blocks with kind 'effect'/'action' form
 *    their own groups (for cards whose ongoing rule is drawn as raw rows,
 *    not an effect node). An EMPTY blocks array means "no immediate
 *    mechanics — every graphic row belongs to the auto-extracted
 *    effect/action groups".
 *  - CURATED_SPECIAL_VP: texts for `victoryPoints: 'special'` cards that
 *    carry no vpText on their face.
 *  - MANUAL_RU: Russian translations for keys the generator emits that are
 *    missing from the existing locale files (the audit's `missingRu` list —
 *    mostly requirement-stripped description remainders).
 *
 * The audit (src/genfiles/cardInfoAudit.json → `needsCuration`) is the
 * worklist: a new bespoke card lands there until it gets an entry here.
 */

import {CardName} from '../../../common/cards/CardName';
import {CardInfoBlockKind} from '../../../common/cards/CardInformation';

export type CuratedBlock = {
  kind?: CardInfoBlockKind; // default 'immediate'
  en: string;
  ru: string;
  /** Graphic row tokens to link against (see cardGraphicIds signatures). */
  tokens?: ReadonlyArray<string>;
};

export const CURATED_CARD_INFO: Partial<Record<CardName, {blocks: ReadonlyArray<CuratedBlock>}>> = {
  /* ── base ── */
  [CardName.IMPORTED_HYDROGEN]: {blocks: [
    {en: 'Gain 3 plants, or add 3 microbes or 2 animals to another card.', ru: 'Получите 3 растения либо добавьте 3 бактерии или 2 животных на другую карту.', tokens: ['plants']},
    {en: 'Place an ocean tile.', ru: 'Разместите тайл океана.', tokens: ['oceans']},
  ]},
  [CardName.LARGE_CONVOY]: {blocks: [
    {en: 'Place an ocean tile and draw 2 cards.', ru: 'Разместите тайл океана и возьмите 2 карты.', tokens: ['oceans']},
    {en: 'Gain 5 plants, or add 4 animals to another card.', ru: 'Получите 5 растений либо добавьте 4 животных на другую карту.', tokens: ['plants']},
  ]},
  [CardName.MINING_RIGHTS]: {blocks: [
    {en: 'Place this tile on an area with a steel or titanium placement bonus.', ru: 'Разместите этот тайл на клетку с бонусом размещения стали или титана.', tokens: ['tile-']},
    {en: 'Increase the matching production (steel or titanium) 1 step.', ru: 'Увеличьте производство соответствующего ресурса (стали или титана) на 1.', tokens: ['production(']},
  ]},
  [CardName.MOSS]: {blocks: [
    {en: 'Lose 1 plant.', ru: 'Потеряйте 1 растение.', tokens: ['plants']},
    {en: 'Increase your plant production 1 step.', ru: 'Увеличьте своё производство растений на 1.', tokens: ['production(']},
  ]},
  [CardName.NITROGEN_RICH_ASTEROID]: {blocks: [
    {en: 'Raise your terraform rating 2 steps.', ru: 'Повысьте ваш РТ на 2.', tokens: ['tr']},
    {en: 'Raise the temperature 1 step.', ru: 'Повысьте температуру на 1.', tokens: ['temperature']},
    {en: 'Increase your plant production 1 step, or 4 steps if you have at least 3 plant tags.', ru: 'Увеличьте своё производство растений на 1 (на 4, если у вас не менее 3 меток растений).', tokens: ['production(']},
  ]},
  [CardName.NITROPHILIC_MOSS]: {blocks: [
    {en: 'Lose 2 plants.', ru: 'Потеряйте 2 растения.', tokens: ['plants']},
    {en: 'Increase your plant production 2 steps.', ru: 'Увеличьте своё производство растений на 2.', tokens: ['production(']},
  ]},
  [CardName.NOCTIS_CITY]: {blocks: [
    {en: 'Decrease your energy production 1 step.', ru: 'Уменьшите своё производство энергии на 1.', tokens: ['production(']},
    {en: 'Increase your M€ production 3 steps.', ru: 'Увеличьте своё производство М€ на 3.', tokens: ['production(']},
    {en: 'Place a city tile on the reserved Noctis City area, disregarding normal placement restrictions.', ru: 'Разместите тайл города на зарезервированной области Ноктис-Сити, игнорируя обычные ограничения размещения.', tokens: ['city']},
  ]},
  [CardName.URBANIZED_AREA]: {blocks: [
    {en: 'Decrease your energy production 1 step.', ru: 'Уменьшите своё производство энергии на 1.', tokens: ['production(']},
    {en: 'Increase your M€ production 2 steps.', ru: 'Увеличьте своё производство М€ на 2.', tokens: ['production(']},
    {en: 'Place a city tile adjacent to at least 2 other city tiles.', ru: 'Разместите тайл города рядом минимум с 2 другими городами.', tokens: ['city']},
  ]},

  [CardName.LAND_CLAIM]: {blocks: [
    {en: 'Place your marker on a non-reserved area. Only you may place a tile there.', ru: 'Выложите свой маркер на любой свободный участок. Только вы можете выложить тайл на этот участок.', tokens: ['text']},
  ]},

  /* ── corpera ── */
  [CardName.AIR_RAID]: {blocks: [
    {en: 'Spend 1 floater from any card.', ru: 'Потратьте 1 аэростат с любой карты.', tokens: ['res-floater']},
    {en: 'Steal 5 M€ from any player.', ru: 'Украдите 5 М€ у любого игрока.', tokens: ['megacredits']},
  ]},
  [CardName.BUSINESS_CONTACTS]: {blocks: [
    {en: 'Look at the top 4 cards from the deck. Take 2 of them into hand and discard the other 2.', ru: 'Посмотрите 4 верхние карты колоды. Возьмите 2 в руку, а остальные 2 сбросьте.', tokens: ['cards', 'text']},
  ]},
  [CardName.CEOS_FAVORITE_PROJECT]: {blocks: [
    {en: 'Add 1 resource to a card with at least 1 resource on it.', ru: 'Добавьте 1 ресурс на карту, на которой уже есть хотя бы 1 ресурс.', tokens: ['wild', 'text']},
  ]},
  [CardName.INVENTION_CONTEST]: {blocks: [
    {en: 'Look at the top 3 cards from the deck. Take 1 of them into hand and discard the other two.', ru: 'Посмотрите 3 верхние карты колоды. Возьмите 1 из них в руку и сбросьте остальные 2.', tokens: ['cards', 'text']},
  ]},
  [CardName.HACKERS]: {blocks: [
    {en: 'Decrease your energy production 1 step.', ru: 'Уменьшите своё производство энергии на 1.', tokens: ['production(']},
    {en: 'Decrease any player’s M€ production 2 steps.', ru: 'Уменьшите производство М€ любого игрока на 2.', tokens: ['production(']},
    {en: 'Increase your M€ production 2 steps.', ru: 'Увеличьте своё производство М€ на 2.', tokens: ['production(']},
  ]},
  [CardName.HIRED_RAIDERS]: {blocks: [
    {en: 'Steal up to 2 steel from any player.', ru: 'Украдите до 2 стали у любого игрока.', tokens: ['steel']},
    {en: 'Or steal up to 3 M€ from any player.', ru: 'Либо украдите до 3 М€ у любого игрока.', tokens: ['megacredits']},
  ]},
  [CardName.MINING_AREA]: {blocks: [
    {en: 'Place this tile on an area with a steel or titanium placement bonus, adjacent to another of your tiles.', ru: 'Разместите этот тайл на клетку с бонусом размещения стали или титана рядом с другим вашим тайлом.', tokens: ['tile-']},
    {en: 'Increase the matching production (steel or titanium) 1 step.', ru: 'Увеличьте производство соответствующего ресурса (стали или титана) на 1.', tokens: ['production(']},
  ]},
  [CardName.OLYMPUS_CONFERENCE]: {blocks: [
    {kind: 'effect', en: 'When you play a science tag, including this, either add a science resource to this card, or remove a science resource from it to draw a card.', ru: 'Когда вы разыгрываете метку науки (включая эту карту), добавьте жетон науки на эту карту либо удалите с неё жетон науки, чтобы взять карту.', tokens: ['tag-science']},
  ]},
  [CardName.PROTECTED_HABITATS]: {blocks: [
    {kind: 'effect', en: 'Your plants, animals and microbes are protected from removal by other players.', ru: 'Другие игроки не могут удалять ваши растения, животных и бактерий.', tokens: ['plants']},
  ]},
  [CardName.SABOTAGE]: {blocks: [
    {en: 'Remove up to 3 titanium or up to 4 steel from any player.', ru: 'Удалите до 3 титана или до 4 стали у любого игрока.', tokens: ['titanium']},
    {en: 'Or remove up to 7 M€ from any player.', ru: 'Либо удалите до 7 М€ у любого игрока.', tokens: ['megacredits']},
  ]},
  [CardName.VIRAL_ENHANCERS]: {blocks: []}, // trigger row belongs to the auto-extracted effect
  // The description restates the VP rule (already the curated VP block).
  [CardName.VERMIN]: {blocks: []},
  // The description IS the VP rule (goes to the VP block via CURATED_SPECIAL_VP).
  [CardName.ST_JOSEPH_OF_CUPERTINO_MISSION]: {blocks: []},

  /* ── promo ── */
  [CardName.POTATOES]: {blocks: [
    {en: 'Lose 2 plants.', ru: 'Потеряйте 2 растения.', tokens: ['plants']},
    {en: 'Increase your M€ production 2 steps.', ru: 'Увеличьте своё производство М€ на 2.', tokens: ['production(']},
  ]},
  [CardName.GREAT_DAM_PROMO]: {blocks: [
    {en: 'Increase your energy production 2 steps.', ru: 'Увеличьте своё производство энергии на 2.', tokens: ['production(']},
    {en: 'Place this tile adjacent to an ocean tile.', ru: 'Разместите этот тайл рядом с тайлом океана.', tokens: ['tile-']},
  ]},
  [CardName.BACTOVIRAL_RESEARCH]: {blocks: [
    {en: 'Draw 1 card.', ru: 'Возьмите 1 карту.', tokens: ['cards']},
    {en: 'Add 1 microbe to one of your cards for each science tag you have, including this.', ru: 'Добавьте на одну из ваших карт по 1 бактерии за каждую вашу метку науки (включая эту).', tokens: ['res-microbe']},
  ]},
  [CardName.ROBOT_POLLINATORS]: {blocks: [
    {en: 'Increase your plant production 1 step.', ru: 'Увеличьте своё производство растений на 1.', tokens: ['production(']},
    {en: 'Gain 1 plant for each plant tag you have.', ru: 'Получите 1 растение за каждую вашу метку растений.', tokens: ['plants']},
  ]},
  [CardName.CYBERIA_SYSTEMS]: {blocks: [
    {en: 'Increase your steel production 1 step.', ru: 'Увеличьте своё производство стали на 1.', tokens: ['production(steel']},
    {en: 'Copy the production boxes of 2 of your building-tag cards.', ru: 'Скопируйте блоки производства 2 ваших карт с меткой строительства.', tokens: ['production(tag-building']},
  ]},
  [CardName.HERMETIC_ORDER_OF_MARS]: {blocks: [
    {en: 'Increase your M€ production 2 steps.', ru: 'Увеличьте своё производство М€ на 2.', tokens: ['production(']},
    {en: 'Gain 1 M€ for each empty area adjacent to your tiles.', ru: 'Получите 1 М€ за каждую пустую клетку рядом с вашими тайлами.', tokens: ['megacredits']},
  ]},
  [CardName.KAGUYA_TECH]: {blocks: [
    {en: 'Increase your M€ production 2 steps and draw 1 card.', ru: 'Увеличьте своё производство М€ на 2 и возьмите 1 карту.', tokens: ['production(']},
    {en: 'Remove 1 of your greenery tiles (oxygen is not affected) and place a city tile there, regardless of placement rules. Gain placement bonuses as usual.', ru: 'Удалите 1 ваш тайл озеленения (кислород не меняется) и разместите на его месте тайл города, игнорируя правила размещения. Бонусы клетки получаете как обычно.', tokens: ['greenery']},
  ]},
  [CardName.MARS_NOMADS]: {blocks: [
    {en: 'Place the Nomads on a non-reserved, empty area on the game board.', ru: 'Разместите кочевников на пустой незарезервированной клетке игрового поля.', tokens: ['nomads']},
  ]},
  [CardName.PROJECT_INSPECTION]: {blocks: [
    {en: 'Use a card action that has been used this generation.', ru: 'Выполните действие карты, которое уже выполнялось в этом поколении.', tokens: ['text']},
  ]},
  [CardName.PUBLIC_PLANS]: {blocks: [
    {en: 'Reveal any number of other cards from your hand (your opponents may inspect them). Gain 1 M€ for each revealed card.', ru: 'Покажите любое количество других карт из вашей руки (соперники могут их просмотреть). Получите 1 М€ за каждую показанную карту.', tokens: ['text']},
  ]},
  [CardName.DOUBLE_DOWN]: {blocks: [
    {en: 'Copy your other prelude’s direct effect.', ru: 'Скопируйте прямой эффект другой вашей прелюдии.', tokens: ['text']},
  ]},
  [CardName.NEPTUNIAN_POWER_CONSULTANTS]: {blocks: [
    {kind: 'effect', en: 'When any ocean is placed, you may pay 5 M€ (steel may be used) to raise your energy production 1 step and add 1 hydroelectric resource to this card.', ru: 'Когда любой игрок размещает океан, вы можете заплатить 5 М€ (можно платить сталью), чтобы увеличить своё производство энергии на 1 и добавить 1 гидроресурс на эту карту.', tokens: ['oceans']},
  ]},
  [CardName.MARTIAN_LUMBER_CORP]: {blocks: [
    {en: 'Increase your plant production 1 step.', ru: 'Увеличьте своё производство растений на 1.', tokens: ['production(']},
  ]},
  [CardName.STATIC_HARVESTING]: {blocks: [
    {en: 'Increase your energy production 1 step.', ru: 'Увеличьте своё производство энергии на 1.', tokens: ['production(']},
    {en: 'Gain 1 M€ for each building tag you have.', ru: 'Получите 1 М€ за каждую вашу метку строительства.', tokens: ['megacredits']},
  ]},
  [CardName.NEW_PARTNER]: {blocks: [
    {en: 'Increase your M€ production 1 step.', ru: 'Увеличьте своё производство М€ на 1.', tokens: ['production(']},
    {en: 'Draw 2 prelude cards: play 1 of them and discard the other.', ru: 'Возьмите 2 карты прелюдий: разыграйте одну из них, а другую сбросьте.', tokens: ['prelude']},
  ]},
  [CardName.CORPORATE_ARCHIVES]: {blocks: [
    {en: 'Look at the top 7 cards of the deck: take 2 of them into your hand, discard the rest.', ru: 'Посмотрите 7 верхних карт колоды: возьмите 2 из них в руку, остальные сбросьте.', tokens: ['text']},
    {en: 'Gain 13 M€.', ru: 'Получите 13 М€.', tokens: ['megacredits']},
  ]},
  [CardName.ESTABLISHED_METHODS]: {blocks: [
    {en: 'Gain 30 M€. Then pay for and perform 2 standard projects.', ru: 'Получите 30 М€. Затем оплатите и выполните 2 стандартных проекта.', tokens: ['megacredits']},
    {kind: 'note', en: 'If you cannot afford a second standard project, spend 10 M€ instead, or as much as possible.', ru: 'Если второй стандартный проект вам не по карману, вместо этого потратьте 10 М€ (или сколько сможете).'},
  ]},
  [CardName.STRATEGIC_BASE_PLANNING]: {blocks: [
    {en: 'Pay 3 M€.', ru: 'Заплатите 3 М€.', tokens: ['megacredits']},
    {en: 'Place a city tile.', ru: 'Разместите тайл города.', tokens: ['city']},
    {en: 'Place a colony.', ru: 'Постройте колонию.', tokens: ['colonies']},
  ]},

  /* ── venus ── */
  [CardName.AIR_SCRAPPING_EXPEDITION]: {blocks: [
    {en: 'Raise Venus 1 step.', ru: 'Повысьте Венеру на 1.', tokens: ['venus']},
    {en: 'Add 3 floaters to any Venus card.', ru: 'Добавьте 3 аэростата на любую карту Венеры.', tokens: ['res-floater']},
  ]},
  [CardName.ATMOSCOOP]: {blocks: [
    {en: 'Raise the temperature 2 steps, or raise Venus 2 steps.', ru: 'Повысьте температуру на 2 либо Венеру на 2.', tokens: ['temperature']},
    {en: 'Add 2 floaters to any card.', ru: 'Добавьте 2 аэростата на любую карту.', tokens: ['res-floater']},
  ]},
  [CardName.COMET_FOR_VENUS]: {blocks: [
    {en: 'Raise Venus 1 step.', ru: 'Повысьте Венеру на 1.', tokens: ['venus']},
    {en: 'Remove up to 4 M€ from any player with a Venus tag in play.', ru: 'Удалите до 4 М€ у любого игрока с меткой Венеры в игре.', tokens: ['megacredits']},
  ]},
  [CardName.CORRODER_SUITS]: {blocks: [
    {en: 'Increase your M€ production 2 steps.', ru: 'Увеличьте своё производство М€ на 2.', tokens: ['production(']},
    {en: 'Add 1 resource to any Venus card.', ru: 'Добавьте 1 ресурс на любую карту Венеры.', tokens: ['wild']},
  ]},
  [CardName.FREYJA_BIODOMES]: {blocks: [
    {en: 'Add 2 microbes or 2 animals to another Venus card.', ru: 'Добавьте 2 бактерии или 2 животных на другую карту Венеры.', tokens: ['res-microbe']},
    {en: 'Decrease your energy production 1 step and increase your M€ production 2 steps.', ru: 'Уменьшите своё производство энергии на 1 и увеличьте производство М€ на 2.', tokens: ['production(']},
  ]},
  [CardName.GYROPOLIS]: {blocks: [
    {en: 'Decrease your energy production 2 steps.', ru: 'Уменьшите своё производство энергии на 2.', tokens: ['production(']},
    {en: 'Increase your M€ production 1 step for each Venus and Earth tag you have.', ru: 'Увеличьте своё производство М€ на 1 за каждую вашу метку Венеры и Земли.', tokens: ['production(']},
    {en: 'Place a city tile.', ru: 'Разместите тайл города.', tokens: ['city']},
  ]},
  [CardName.HYDROGEN_TO_VENUS]: {blocks: [
    {en: 'Raise Venus 1 step.', ru: 'Повысьте Венеру на 1.', tokens: ['venus']},
    {en: 'Add 1 floater to a Venus card for each Jovian tag you have.', ru: 'Добавьте на карту Венеры по 1 аэростату за каждую вашу метку Юпитера.', tokens: ['res-floater']},
  ]},
  [CardName.IO_SULPHUR_RESEARCH]: {blocks: [
    {en: 'Draw 1 card, or draw 3 cards if you have at least 3 Venus tags.', ru: 'Возьмите 1 карту (3 карты, если у вас не менее 3 меток Венеры).', tokens: ['cards']},
  ]},
  [CardName.LUNA_METROPOLIS]: {blocks: [
    {en: 'Increase your M€ production 1 step for each Earth tag you have, including this.', ru: 'Увеличьте своё производство М€ на 1 за каждую вашу метку Земли (включая эту).', tokens: ['production(']},
    {en: 'Place a city tile on the reserved area.', ru: 'Разместите тайл города на зарезервированной области.', tokens: ['city']},
  ]},
  [CardName.SPONSORED_ACADEMIES]: {blocks: [
    {en: 'Discard 1 card from your hand, then draw 3 cards.', ru: 'Сбросьте 1 карту с руки, затем возьмите 3 карты.', tokens: ['cards']},
    {en: 'All opponents draw 1 card.', ru: 'Все соперники берут по 1 карте.', tokens: ['cards']},
  ]},
  [CardName.STRATOSPHERIC_BIRDS]: {blocks: [
    {en: 'Spend 1 floater from any card.', ru: 'Потратьте 1 аэростат с любой карты.', tokens: ['res-floater']},
  ]},
  [CardName.SULPHUR_EXPORTS]: {blocks: [
    {en: 'Raise Venus 1 step.', ru: 'Повысьте Венеру на 1.', tokens: ['venus']},
    {en: 'Increase your M€ production 1 step for each Venus tag you have, including this.', ru: 'Увеличьте своё производство М€ на 1 за каждую вашу метку Венеры (включая эту).', tokens: ['production(']},
  ]},
  [CardName.VENUSIAN_PLANTS]: {blocks: [
    {en: 'Raise Venus 1 step.', ru: 'Повысьте Венеру на 1.', tokens: ['venus']},
    {en: 'Add 1 microbe or 1 animal to another Venus card.', ru: 'Добавьте 1 бактерию или 1 животное на другую карту Венеры.', tokens: ['res-microbe']},
  ]},

  /* ── colonies ── */
  [CardName.MARKET_MANIPULATION]: {blocks: [
    {en: 'Increase one colony tile track 1 step. Decrease another colony tile track 1 step.', ru: 'Увеличьте трек одной колонии на 1 и уменьшите трек другой колонии на 1.', tokens: ['text']},
  ]},
  [CardName.PRODUCTIVE_OUTPOST]: {blocks: [
    {en: 'Gain all your colony bonuses.', ru: 'Получите бонусы всех ваших колоний.', tokens: ['text']},
  ]},
  [CardName.ECOLOGY_RESEARCH]: {blocks: [
    {en: 'Increase your plant production 1 step for each colony you own.', ru: 'Увеличьте своё производство растений на 1 за каждую вашу колонию.', tokens: ['production(']},
    {en: 'Add 1 animal to another card and 2 microbes to another card.', ru: 'Добавьте 1 животное на другую карту и 2 бактерии на другую карту.', tokens: ['res-animal']},
  ]},
  [CardName.MOLECULAR_PRINTING]: {blocks: [
    {en: 'Gain 1 M€ for each city tile in play.', ru: 'Получите 1 М€ за каждый тайл города в игре.', tokens: ['megacredits']},
    {en: 'Gain 1 M€ for each colony in play.', ru: 'Получите 1 М€ за каждую колонию в игре.', tokens: ['colonies']},
  ]},

  /* ── prelude ── */
  [CardName.ECCENTRIC_SPONSOR]: {blocks: [
    {en: 'Play a card from hand, reducing its cost by 25 M€.', ru: 'Разыграйте карту с руки, снизив её стоимость на 25 М€.', tokens: ['text']},
  ]},
  [CardName.LAVA_TUBE_SETTLEMENT]: {blocks: [
    {en: 'Decrease your energy production 1 step.', ru: 'Уменьшите своё производство энергии на 1.', tokens: ['production(']},
    {en: 'Increase your M€ production 2 steps.', ru: 'Увеличьте своё производство М€ на 2.', tokens: ['production(']},
    {en: 'Place a city tile on a volcanic area, regardless of adjacent cities.', ru: 'Разместите тайл города на вулканической области, независимо от соседних городов.', tokens: ['city']},
  ]},
  [CardName.AQUIFER_TURBINES]: {blocks: [
    {en: 'Place an ocean tile.', ru: 'Разместите тайл океана.', tokens: ['oceans']},
    {en: 'Increase your energy production 2 steps.', ru: 'Увеличьте своё производство энергии на 2.', tokens: ['production(']},
    {en: 'Pay 3 M€.', ru: 'Заплатите 3 М€.', tokens: ['megacredits']},
  ]},
  [CardName.BUSINESS_EMPIRE]: {blocks: [
    {en: 'Increase your M€ production 6 steps.', ru: 'Увеличьте своё производство М€ на 6.', tokens: ['production(']},
    {en: 'Pay 6 M€.', ru: 'Заплатите 6 М€.', tokens: ['megacredits']},
  ]},
  [CardName.GALILEAN_MINING]: {blocks: [
    {en: 'Increase your titanium production 2 steps.', ru: 'Увеличьте своё производство титана на 2.', tokens: ['production(']},
    {en: 'Pay 5 M€.', ru: 'Заплатите 5 М€.', tokens: ['megacredits']},
  ]},
  [CardName.HUGE_ASTEROID]: {blocks: [
    {en: 'Raise the temperature 3 steps.', ru: 'Повысьте температуру на 3.', tokens: ['temperature']},
    {en: 'Pay 5 M€.', ru: 'Заплатите 5 М€.', tokens: ['megacredits']},
  ]},
  [CardName.ACQUIRED_SPACE_AGENCY]: {blocks: [
    {en: 'Gain 6 titanium.', ru: 'Получите 6 титана.', tokens: ['titanium']},
    {en: 'Reveal cards from the deck until you reveal two cards with space tags. Take them into your hand and discard the rest.', ru: 'Вскрывайте карты колоды, пока не откроете две карты с меткой космоса. Возьмите их в руку, остальные сбросьте.', tokens: ['cards']},
  ]},
  [CardName.ECOLOGY_EXPERTS]: {blocks: [
    {en: 'Increase your plant production 1 step.', ru: 'Увеличьте своё производство растений на 1.', tokens: ['production(']},
    {en: 'Play a card from your hand, ignoring its global requirements.', ru: 'Разыграйте карту с руки, игнорируя её глобальные требования.', tokens: ['ignore_global_requirements']},
  ]},
  [CardName.EXPERIMENTAL_FOREST]: {blocks: [
    {en: 'Place 1 greenery tile and raise the oxygen level 1 step.', ru: 'Разместите 1 тайл озеленения и повысьте уровень кислорода на 1.', tokens: ['greenery']},
    {en: 'Reveal cards from the deck until you reveal two cards with plant tags. Take them into your hand and discard the rest.', ru: 'Вскрывайте карты колоды, пока не откроете две карты с меткой растений. Возьмите их в руку, остальные сбросьте.', tokens: ['cards']},
  ]},
};

export const CURATED_SPECIAL_VP: Partial<Record<CardName, {en: string, ru: string}>> = {
  [CardName.LAW_SUIT]: {
    en: 'The player who takes this card counts it as −1 VP.',
    ru: 'Игрок, забравший эту карту, получает за неё −1 ПО.',
  },
  [CardName.ST_JOSEPH_OF_CUPERTINO_MISSION]: {
    en: '1 VP per City with a Cathedral in it.',
    ru: '1 ПО за каждый город с собором.',
  },
  [CardName.VERMIN]: {
    en: 'If this card has 10 or more animals, EVERY player loses 1 VP per city tile at the end of the game.',
    ru: 'Если на этой карте 10 и более животных, в конце игры КАЖДЫЙ игрок теряет 1 ПО за каждый тайл города.',
  },
};

export const MANUAL_RU: Readonly<Record<string, string>> = {
  'Decrease any steel production 1 step and increase your own 1 step.':
    'Уменьшите производство стали любого игрока на 1 и увеличьте своё на 1.',
  'Decrease any titanium production 1 step and increase your own 1 step.':
    'Уменьшите производство титана любого игрока на 1 и увеличьте своё на 1.',
  'Draw 3 cards with a building tag.':
    'Возьмите 3 карты с меткой строительства.',
  'Gain 1 M€ per each city tile in play.':
    'Получите 1 М€ за каждый тайл города в игре.',
  'Gain 1 plant per power tag you have.':
    'Получите 1 растение за каждую вашу метку энергии.',
  'Gain 1 titanium or 2 steel.':
    'Получите 1 титан или 2 стали.',
  'Increase your M€ production 1 step for each city tile ON MARS.':
    'Увеличьте своё производство М€ на 1 за каждый тайл города НА МАРСЕ.',
  'Increase your M€ production 1 step for each colony in play.':
    'Увеличьте своё производство М€ на 1 за каждую колонию в игре.',
  'Increase your plant production 1 step for each plant tag you have.':
    'Увеличьте своё производство растений на 1 за каждую вашу метку растений.',
  'Increase your plant production 1 step for every 2 microbe tags you have, including this.':
    'Увеличьте своё производство растений на 1 за каждые 2 ваши метки бактерий (включая эту).',
  'Place this tile adjacent to ANY greenery.':
    'Разместите этот тайл рядом с любым озеленением.',
  'The next card you play this generation costs 16 M€ less.':
    'Следующая карта, которую вы разыграете в этом поколении, стоит на 16 М€ дешевле.',
  'Action: Pay 5 M€ (STEEL MAY BE USED) to build  1 Cathedral in a city. Max 1 per city. City owner can pay 2 M€  to draw 1 card.':
    'Действие: заплатите 5 М€ (можно платить сталью), чтобы построить 1 собор в городе. Не более 1 на город. Владелец города может заплатить 2 М€, чтобы взять 1 карту.',
};

import {IPlayer} from '../IPlayer';
import {CardResource} from '../../common/CardResource';
import {OrOptions} from '../inputs/OrOptions';
import {SelectCard} from '../inputs/SelectCard';
import {SelectOption} from '../inputs/SelectOption';
import {ICard} from '../cards/ICard';
import {PlayerInputModel, SelectCardModel} from '../../common/models/PlayerInputModel';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {Message} from '../../common/logs/Message';
import {UnderworldExpansion} from '../underworld/UnderworldExpansion';
import {message} from '../logs/MessageBuilder';
import {CardName} from '../../common/cards/CardName';
import {skip, removeCardResourceFromPlayer} from '../inputs/optionMetadata';
import {AutomaTargeting} from '../automa/AutomaTargeting';

export type Source = 'self' | 'opponents' | 'all';
export type Response = {card: ICard, owner: IPlayer, proceed: boolean} | {card: undefined, owner: undefined, proceed: boolean};
export class RemoveResourcesFromCard extends DeferredAction<Response> {
  public cardResource: CardResource | undefined;
  public count: number;
  private source: Source;
  private mandatory: boolean;
  private blockable: boolean;
  private autoselect: boolean;
  private title: string | Message;
  private log: boolean;

  public override priority: Priority = Priority.ATTACK_OPPONENT;
  constructor(
    player: IPlayer,
    cardResource: CardResource | undefined,
    count: number = 1,
    options?: {
      /** Which players to take from. Default all. */
      source?: Source,
      /** Resource must be removed (either it's a cost or the icon is not red-bordered.) default true. */
      mandatory?: boolean,
      /** If there's only one card, automatically select it. Default is true. Ignored if mandatory is false. */
      autoselect?: boolean
      title?: string | Message,
      blockable?: boolean,
      log?: boolean,
    }) {
    super(player, Priority.ATTACK_OPPONENT);
    this.cardResource = cardResource;
    this.count = count;
    this.source = options?.source ?? 'all';
    this.mandatory = options?.mandatory ?? true;
    this.blockable = options?.blockable ?? true;
    this.autoselect = options?.autoselect ?? true;
    this.log = options?.log ?? false;
    // A `message()` (NOT a raw template literal) so the title is a translatable
    // key — the ${1} resource token is translated client-side, and the template
    // 'Select card to remove ${0} ${1}' has a single stable i18n key.
    this.title = options?.title ?? message('Select card to remove ${0} ${1}', (b) => b.number(count).string(cardResource ?? ''));
    if (this.source === 'self') {
      this.priority = Priority.LOSE_RESOURCE_OR_PRODUCTION;
      if (this.blockable) {
        throw new Error('Cannot block removing resources from self');
      }
    }
  }

  public execute() {
    if (this.source !== 'self' && this.player.game.isSoloMode()) {
      this.player.resolveInsuranceInSoloGame();
      this.cb({card: undefined, owner: undefined, proceed: true});
      return undefined;
    }

    const cards = RemoveResourcesFromCard.getAvailableTargetCards(this.player, this.cardResource, this.source);

    // MarsBot as a card-resource target (Automa rulebook, Adding Expansions p.5):
    // the bot holds real microbes / animals / floaters in its shipping-board
    // storage (Enceladus / Miranda / Titan), and its M€ supply proxies any of
    // them — so a "remove X <card-resource> from any card" effect may take them.
    // The bot is a PLAYER-target (not a card), so its presence turns the picker
    // into an OrOptions [card branch?, MarsBot, skip?]. `undefined` for a self
    // removal / untyped resource / no bot / an empty bot.
    const botOption = this.botOption(() => this.cb({card: undefined, owner: undefined, proceed: true}));

    if (cards.length === 0 && botOption === undefined) {
      this.cb({card: undefined, owner: undefined, proceed: false});
      return undefined;
    }

    // Relevant cards of the same resource type that CAN'T be picked right now
    // (no resources / protected) are shown DISABLED with a reason instead of
    // vanishing — the premium picker's All/Available/Unavailable filter hides
    // them by default. They ride a SEPARATE `disabled` channel, so `cards`
    // stays the selectable set (auto-select / counts / validation unchanged).
    const disabledCards = RemoveResourcesFromCard.getUnavailableTargetCards(this.player, this.cardResource, this.source, cards);

    // With a bot target, ALWAYS present an OrOptions so the bot is a conscious,
    // visible choice alongside the card(s) — never auto-applied behind the picker.
    if (botOption !== undefined) {
      const orOptions = new OrOptions().setTitle(this.title);
      if (cards.length > 0) {
        orOptions.options.push(this.buildSelectCard(cards, disabledCards));
      }
      orOptions.options.push(botOption);
      if (!this.mandatory) {
        orOptions.options.push(new SelectOption('Do not remove').withMetadata(skip()));
      }
      return orOptions;
    }

    // No bot involved — the original card-only behaviour, byte-identical.
    if (this.mandatory) {
      if (cards.length === 1 && this.autoselect === true) {
        this.attack(cards[0]);
        return undefined;
      }
      return this.buildSelectCard(cards, disabledCards);
    }

    return new OrOptions(
      this.buildSelectCard(cards, disabledCards),
      new SelectOption('Do not remove').withMetadata(skip()));
  }

  private buildSelectCard(cards: Array<ICard>, disabledCards: Array<{card: ICard, reason: string}>) {
    return new SelectCard(
      this.title,
      'Remove resource(s)',
      cards,
      {showOwner: this.source !== 'self', disabled: disabledCards.length > 0 ? disabledCards : undefined})
      .andThen(([card]) => {
        this.attack(card);
        return undefined;
      });
  }

  /**
   * The MarsBot target option for a card-resource removal — its shipping-board
   * storage of the type (Enceladus microbes / Miranda animals / Titan floaters)
   * FIRST, then the M€-supply proxy (Automa rulebook, Adding Expansions p.5). A
   * metadata-rich player-target (the storage-row + M€-supply-row `current →
   * resulting` breakdown, exactly like a standard-resource attack). SHARED by the
   * generic `execute()` and bespoke callers (Virus) so the bot reads consistently.
   * `onRemoved` fires after the removal (the deferred's `cb`, when applicable).
   * Returns `undefined` when there's no MarsBot opponent or it holds nothing.
   */
  public static marsBotOption(player: IPlayer, cardResource: CardResource, count: number, onRemoved?: () => void): SelectOption | undefined {
    const bot = player.opponents.find((p) => p.isMarsBot);
    if (bot === undefined) {
      return undefined;
    }
    const attackable = AutomaTargeting.attackableCardResourceStock(bot, cardResource);
    const removable = Math.min(count, attackable);
    if (removable <= 0) {
      return undefined;
    }
    return new SelectOption(
      message('Remove ${0} ${1} from ${2}', (b) => b.number(removable).cardResource(cardResource).player(bot)),
      'Remove')
      .withMetadata(removeCardResourceFromPlayer(bot, cardResource, removable, attackable))
      .andThen(() => {
        AutomaTargeting.removeCardResourceFromBot(player.game, cardResource, removable);
        onRemoved?.();
        return undefined;
      });
  }

  /**
   * TRUE when a "remove <cardResource> from any card" effect has ANY valid target:
   * a card holding the resource, OR MarsBot's shipping-board storage / M€-supply
   * proxy of that type. The bot-aware companion of `getAvailableTargetCards` — a
   * blue-card action's `canAct` must consult it so the action stays available
   * against a lone MarsBot (whose "cards" are its storage areas).
   */
  public static hasTarget(player: IPlayer, cardResource: CardResource | undefined, source: Source = 'all'): boolean {
    if (RemoveResourcesFromCard.getAvailableTargetCards(player, cardResource, source).length > 0) {
      return true;
    }
    if (cardResource === undefined || source === 'self') {
      return false;
    }
    const bot = player.opponents.find((p) => p.isMarsBot);
    return bot !== undefined && AutomaTargeting.attackableCardResourceStock(bot, cardResource) > 0;
  }

  /** The MarsBot target option for THIS removal (or undefined) — a self / untyped
   *  removal never targets the bot. */
  private botOption(onRemoved?: () => void): SelectOption | undefined {
    if (this.cardResource === undefined || this.source === 'self') {
      return undefined;
    }
    return RemoveResourcesFromCard.marsBotOption(this.player, this.cardResource, this.count, onRemoved);
  }

  /**
   * READ-ONLY: the full removal PICKER as a model — a bare `SelectCard` (cards
   * only) OR, when MarsBot is a valid card-resource target, the combined
   * `OrOptions` [card branch?, MarsBot, skip?] that `execute()` builds live. Kept
   * STRUCTURALLY identical to `execute()` so the action-confirm modal pre-collects
   * a response that replays byte-for-byte against the live prompt. `undefined` when
   * there's no choice (solo auto-resolve / no target / a lone auto-selected card).
   */
  public previewRemovalModel(): PlayerInputModel | undefined {
    if (this.source !== 'self' && this.player.game.isSoloMode()) {
      return undefined;
    }
    const cards = RemoveResourcesFromCard.getAvailableTargetCards(this.player, this.cardResource, this.source);
    const botOption = this.botOption();
    if (cards.length === 0 && botOption === undefined) {
      return undefined;
    }
    const disabledCards = RemoveResourcesFromCard.getUnavailableTargetCards(this.player, this.cardResource, this.source, cards);
    if (botOption !== undefined) {
      const orOptions = new OrOptions().setTitle(this.title);
      if (cards.length > 0) {
        orOptions.options.push(this.buildSelectCard(cards, disabledCards));
      }
      orOptions.options.push(botOption);
      if (!this.mandatory) {
        orOptions.options.push(new SelectOption('Do not remove').withMetadata(skip()));
      }
      return orOptions.toModel(this.player);
    }
    if (this.mandatory && cards.length === 1 && this.autoselect === true) {
      return undefined;
    }
    return this.buildSelectCard(cards, disabledCards).toModel(this.player);
  }

  /**
   * READ-ONLY: the `SelectCardModel` the live path WOULD present (the target
   * picker), or `undefined` when no choice is offered (solo auto-resolve, no
   * target, or a single auto-selected target). Used by the action-preview
   * builder to host the picker INSIDE the confirmation modal — no mutation.
   * Only the MANDATORY case is modelled (the non-mandatory "Do not remove"
   * OrOptions wrapper is left to the caller); all in-scope action cards that
   * remove a card resource (Predators, Ants, …) are mandatory.
   */
  public previewSelectCard(): SelectCardModel | undefined {
    if (this.source !== 'self' && this.player.game.isSoloMode()) {
      return undefined;
    }
    const cards = RemoveResourcesFromCard.getAvailableTargetCards(this.player, this.cardResource, this.source);
    if (cards.length === 0) {
      return undefined;
    }
    if (this.mandatory && cards.length === 1 && this.autoselect === true) {
      return undefined;
    }
    const disabledCards = RemoveResourcesFromCard.getUnavailableTargetCards(this.player, this.cardResource, this.source, cards);
    return new SelectCard(
      this.title,
      'Remove resource(s)',
      cards,
      {showOwner: this.source !== 'self', disabled: disabledCards.length > 0 ? disabledCards : undefined})
      .toModel(this.player);
  }

  private attack(card: ICard) {
    const target = this.player.game.getCardPlayerOrThrow(card.name);

    // TODO(kberg): Consolidate the blockable in maybeBlock.
    if (this.blockable === false) {
      target.removeResourceFrom(card, this.count, {removingPlayer: this.player});
      this.cb({card: card, owner: target, proceed: true});
      return;
    }
    const msg = message('${0} ${1} from ${2}', (b) => b.number(this.count).string(card.resourceType || 'resources').card(card));
    target.defer(UnderworldExpansion.maybeBlockAttack(target, this.player, msg, (proceed) => {
      if (proceed) {
        target.removeResourceFrom(card, this.count, {removingPlayer: this.player, log: this.log});
      }
      this.cb({card: card, owner: target, proceed: proceed});
      return undefined;
    }));
  }

  public static getAvailableTargetCards(player: IPlayer, resourceType: CardResource | undefined, source: Source = 'all'): Array<ICard> {
    const resourceCards: Array<ICard> = [];
    for (const p of player.game.players) {
      if (p === player) {
        if (source !== 'opponents') {
          for (const card of p.getCardsWithResources(resourceType)) {
            // Protected resources can't be removed, even by the owner (e.g. Pets), except for
            // Bioengineering Enclosure, whose protection only stops *other* players.
            if (card.protectedResources === true && card.name !== CardName.BIOENGINEERING_ENCLOSURE) {
              continue;
            }
            resourceCards.push(card);
          }
        }
      } else {
        if (source !== 'self') {
          const hasProtetedHabitats = p.tableau.has(CardName.PROTECTED_HABITATS);
          for (const card of p.getCardsWithResources(resourceType)) {
            if (card.protectedResources === true) {
              continue;
            }
            if (hasProtetedHabitats) {
              if (card.resourceType === CardResource.ANIMAL || card.resourceType === CardResource.MICROBE) {
                continue;
              }
            }
            resourceCards.push(card);
          }
        }
      }
    }
    return resourceCards;
  }

  /**
   * Cards of the same resource type that are RELEVANT to this removal but can't
   * be picked right now — shown disabled with a reason. Only meaningful for a
   * specific `resourceType` (the "cards that can hold X" pool). All cards here
   * are played/tableau cards (public), so there's no privacy concern.
   */
  public static getUnavailableTargetCards(
    player: IPlayer,
    resourceType: CardResource | undefined,
    source: Source,
    available: ReadonlyArray<ICard>,
  ): Array<{card: ICard, reason: string}> {
    if (resourceType === undefined) {
      return [];
    }
    const result: Array<{card: ICard, reason: string}> = [];
    for (const p of player.game.players) {
      if (p === player ? source === 'opponents' : source === 'self') {
        continue;
      }
      for (const card of p.getResourceCards(resourceType)) {
        if (available.includes(card)) {
          continue;
        }
        result.push({
          card,
          reason: card.resourceCount === 0 ? 'No resources on this card' : 'Card resources are protected',
        });
      }
    }
    return result;
  }
}

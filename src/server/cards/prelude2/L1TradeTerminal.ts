import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {PlayerInput} from '../../PlayerInput';
import {SelectCard} from '../../inputs/SelectCard';
import {ICard} from '../ICard';
import {ActionPreview, ActionPreviewStep} from '../../../common/models/ActionPreviewModel';
import {SelectCardModel} from '../../../common/models/PlayerInputModel';
import * as actionPreviews from '../actionPreviews';
import {holderResourceIcons} from '../../deferredActions/AddResourcesToCard';
import {recordSkippedEffect} from '../../deferredActions/skippedEffect';

/** How many different cards the play feeds (the printed «3»). */
export const L1_TRADE_TERMINAL_TARGETS = 3;
/** The live prompt's title — and the preview's ONE merged ask (one key, one question). */
export const L1_TRADE_TERMINAL_PROMPT = 'Select up to 3 cards to gain 1 resource each';
/** The live prompt's button (the shared key — upstream's «Add Resources» had no translation; the bar read English). */
export const L1_TRADE_TERMINAL_BUTTON = 'Add resources';
/** The composer's confirm when the player chooses no card at all — a conscious choice, never a misclick. */
export const L1_TRADE_TERMINAL_EMPTY_WARNING = 'No cards are selected. The card will be played, but no resources will be added.';

/**
 * P78 — L1 TRADE TERMINAL («Торговый терминал L1»), a Prelude 2 blue card: cost 25,
 * Space, 2 VP, no requirement, Colonies-compatible.
 *
 * SCAN READING — «25» the price, no requirement plate, the star (Space) in the
 * corner; the effect frame «[trade] : +2» with its caption; below, «3 [?] *» — three
 * WILD resources (the printed yellow «?», `wild()` — never the wild TAG
 * `diverseTag()`), the asterisk pointing at «(Add a resource to 3 different cards
 * that already have resources.)»; the VP «2»; Prelude 2 and Colonies at the bottom
 * left. Lore: «Lagrange points are suitable take-off locations to different worlds».
 *
 * RULE READINGS (pinned by tests/cards/prelude2/L1TradeTerminal.spec.ts):
 *  1. EFFECT — `behavior.colonies.tradeOffset: 2`: the ONE trade plan
 *     (`Colony.tradeTrackPlan`) reads it; the printed «may» is always in the
 *     player's favour, so it is never asked; the top of the track cuts it honestly.
 *  2. PLAY — the candidates are the player's own resource holders that already hold
 *     one, plus the cards under Self-Replicating Robots with a resource (never this
 *     card itself) — ONE source (`eligibleCards`) for the live prompt and the preview.
 *  3. The play ALWAYS asks (`SelectCard`, `min 0`, `max min(3, N)`) — even with one,
 *     two or three candidates. Upstream applied ≤ 3 silently; the fork never does
 *     (`docs/DELAYED_TARGET_AUDIT.md` § prelude2). The console's composer SEEDS every
 *     candidate when there are no more of them than seats and each one is a gain
 *     (ledger CU) — shown, marked, answered by the batch; the server still asks.
 *  4. No candidate at all → no prompt, a NAMED loss: «add 3 resources to a card»,
 *     recorded with the same description the preview's warning promised.
 *  5. PREVIEW = EXECUTION: Astra Mechanica's form — one slot per seat (deduped),
 *     merged into ONE «up to 3» answer under the live prompt's own title; every
 *     candidate reads its OWN resource `N → N+1` and its honest VP (negative too —
 *     Vermin, Ancient Shipyards). Read-only.
 */
export class L1TradeTerminal extends Card {
  constructor() {
    super({
      name: CardName.L1_TRADE_TERMINAL,
      type: CardType.ACTIVE,
      tags: [Tag.SPACE],
      cost: 25,
      victoryPoints: 2,

      behavior: {
        colonies: {
          tradeOffset: 2,
        },
      },

      metadata: {
        cardNumber: 'P78',
        // The effects explorer's one-liner — the family's own words (Trade Envoys, Trading Colony, Veynon); the tile prints the «+2».
        infoText: [{kind: 'effect-short', text: 'You may raise the colony track before trading'}],
        renderData: CardRenderer.builder((b) => {
          b.effect('When you trade, you may first increase that colony tile track 2 steps.', (eb) =>
            eb.trade().startEffect.text('+2')).br;
          b.text('3').wild(1).asterix();
        }),
        description: 'Add a resource to 3 different cards that already have resources.',
      },
    });
  }

  /** Rule 2 — the ONE candidate set. */
  private eligibleCards(player: IPlayer): ReadonlyArray<ICard> {
    return player.getCardsWithResources().concat(
      player.getSelfReplicatingRobotsTargetCards().filter((card) => card.resourceCount > 0)
        .filter((c) => c.name !== this.name)); // When L1 Trade Terminal is coming from Self Replicating Robots, it might include itself.
  }

  /** Rule 4 — WHAT is lost on an empty table: one description for the preview's warning and the live record. */
  private skipped() {
    return actionPreviews.skippedAddToCard(undefined, L1_TRADE_TERMINAL_TARGETS);
  }

  private addResources(player: IPlayer, cards: ReadonlyArray<ICard>): void {
    for (const card of cards) {
      player.addResourceTo(card, {qty: 1, log: true});
    }
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    const cards = this.eligibleCards(player);
    if (cards.length === 0) {
      // FORK: a PLAY's words — upstream's `noMatchingCards` speaks of «this action» (P78, ledger CU).
      this.addWarning('noResourceHolder');
    }
    return true;
  }

  public override bespokePlay(player: IPlayer): PlayerInput | undefined {
    const cards = this.eligibleCards(player);
    if (cards.length === 0) {
      recordSkippedEffect(player, actionPreviews.SKIP_REASON.noHolder, this.skipped());
      return undefined;
    }
    // Rule 3 — always the prompt (no hidden target, whatever the count).
    return new SelectCard(L1_TRADE_TERMINAL_PROMPT, L1_TRADE_TERMINAL_BUTTON, cards, {min: 0, max: Math.min(L1_TRADE_TERMINAL_TARGETS, cards.length)})
      .andThen((chosen) => {
        this.addResources(player, chosen);
        return undefined;
      });
  }

  /** Rule 5 — the pre-collected «up to 3», one slot per seat, every candidate reading its own resource. */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const cards = this.eligibleCards(player);
    if (cards.length === 0) {
      return actionPreviews.playPreview(this, player, [], [
        actionPreviews.warningNote(actionPreviews.NO_HOLDER_WARNING, {skipped: this.skipped()}),
      ]);
    }
    const seats = Math.min(L1_TRADE_TERMINAL_TARGETS, cards.length);
    const slots: Array<ActionPreviewStep> = [];
    for (let i = 0; i < seats; i++) {
      const step = actionPreviews.selectCardStep(player, L1_TRADE_TERMINAL_PROMPT, L1_TRADE_TERMINAL_BUTTON, cards, {
        amount: 1,
        ...(i > 0 ? {dedupeFromSteps: Array.from({length: i}, (_, j) => j)} : {}),
      });
      // The holders take DIFFERENT kinds — each candidate's own (its storage rule), so the reading names what
      // lands on IT; the step's per-candidate VP stands beside it on the same marker.
      slots.push(step.kind === 'input' ? {...step, input: {...(step.input as SelectCardModel), resourceGainPrompt: {
        amount: 1,
        cardResourceByCard: holderResourceIcons(cards),
        ...(step.vpBox !== undefined ? {vpBox: step.vpBox} : {}),
        genericTitle: true,
      }}} : step);
    }
    return actionPreviews.playPreview(this, player, [], slots, {
      mergeCardSteps: {min: 0, title: L1_TRADE_TERMINAL_PROMPT, emptyWarning: L1_TRADE_TERMINAL_EMPTY_WARNING},
    });
  }
}

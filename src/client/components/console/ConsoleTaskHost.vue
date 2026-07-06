<template>
  <div class="con-task-host" role="dialog" :aria-label="titleText">
    <div class="con-task-host__backdrop" aria-hidden="true"></div>

    <!-- Keyed frame: prompt→prompt switches cross-fade (CTS-3.9). -->
    <transition name="con-task-swap" mode="out-in">
      <div class="con-task" :class="{'con-task--wide': activeTask.kind === 'cardSelect'}" :key="taskKey">
        <!-- ── Frame header ────────────────────────────────────────── -->
        <header class="con-task__head">
          <div class="con-task__kicker">
            <span class="con-task__kicker-mark" aria-hidden="true">◈</span>
            <span>{{ $t(kickerText) }}</span>
          </div>
          <div class="con-task__title">{{ titleText }}</div>
          <!-- Phase note (draft: what happens to the cards you don't keep). -->
          <div v-if="phaseSubtext !== ''" class="con-task__subtext">{{ phaseSubtext }}</div>
          <div v-if="triggerText !== ''" class="con-task__trigger">{{ triggerText }}</div>
          <!-- Card browser: the live pick counter (multi only) + BUY economics.
               The buy price is per-card RESEARCH cost (base 3 M€), never the
               card's printed cost — see buyCostPerCard. -->
          <div v-if="activeTask.kind === 'cardSelect' && (!singlePick || isBuyMode)" class="con-task__pickline">
            <span v-if="!singlePick" class="con-task__pickcount" :class="{'con-task__pickcount--ready': cardPicksValid}">
              {{ $t('Selected') }}: <b>{{ picks.length }}</b><template v-if="cardMax > 0"> / {{ cardMax }}</template>
            </span>
            <template v-if="isBuyMode">
              <!-- Main total + muted "N × unit" breakdown — honest, printed-cost-free. -->
              <span class="con-task__buysum" :class="{'con-task__buysum--over': !cardBuyAffordable}">
                <span class="con-task__buysum-total">{{ $t('Purchase') }}: −{{ buyTotal }}<i class="resource_icon resource_icon--megacredits con-task__buysum-mc" aria-hidden="true"></i></span>
                <span v-if="picks.length > 0" class="con-task__buysum-detail">{{ picks.length }} × {{ buyCostPerCard }} {{ $t('per card') }}</span>
              </span>
              <!-- Wallet: you-have + after-purchase (only when affordable). -->
              <span class="con-task__buywallet">
                <span>{{ $t('You have') }}: <b>{{ megacreditsOnHand }}</b><i class="resource_icon resource_icon--megacredits con-task__buysum-mc" aria-hidden="true"></i></span>
                <span v-if="picks.length > 0 && cardBuyAffordable" class="con-task__buywallet-after">{{ $t('After purchase') }}: <b>{{ megacreditsAfterPurchase }}</b></span>
              </span>
            </template>
          </div>
          <!-- Insufficient-funds banner (buy phase) — RT is also disabled. -->
          <div v-if="isBuyMode && picks.length > 0 && !cardBuyAffordable" class="con-task__buywarn">⚠ {{ buyShortfallText }}</div>
          <!-- Payment: the cost chip + live coverage readout. -->
          <div v-if="activeTask.kind === 'payment'" class="con-task__pickline">
            <span class="con-task__paycost">
              {{ $t('Cost') }}: <b>{{ paymentCost }}</b> <i class="resource_icon resource_icon--megacredits con-task__opt-res" aria-hidden="true"></i>
            </span>
            <span class="con-task__pickcount" :class="{'con-task__pickcount--ready': paymentReady}">
              {{ $t('Total') }}: <b>{{ payTotal }}</b> / {{ paymentCost }}
            </span>
          </div>
        </header>

        <div class="con-task__main">
          <!-- INFO PARITY (CTS-3.8): the SOURCE CARD renders as the real
               premium card wherever the desktop docks it. -->
          <div v-if="sourceCardName !== undefined" class="con-task__source">
            <div class="con-task__source-label">{{ $t('Source') }}</div>
            <Card :card="{name: sourceCardName}" :key="sourceCardName" />
          </div>

          <div class="con-task__body con-info__scroll" ref="body">
            <!-- Warnings carry over (parity). -->
            <div v-if="warningTexts.length > 0" class="con-task__warnings">
              <div v-for="(w, i) in warningTexts" :key="i" class="con-task__warning">⚠ {{ w }}</div>
            </div>

            <!-- ── CHOICE ─────────────────────────────────────────── -->
            <template v-if="activeTask.kind === 'choice'">
              <div v-for="(entry, i) in choiceEntries" :key="'o' + entry.index"
                   class="con-task__option"
                   :class="{
                     'con-task__option--focused': focusIdx === i,
                     'con-task__option--armed': focusIdx === i && armed,
                     'con-task__option--skip': entry.isSkip,
                   }">
                <div class="con-task__option-main">
                  <i v-if="entry.iconClass !== ''" class="con-task__opt-icon" :class="entry.iconClass" aria-hidden="true"></i>
                  <span v-if="entry.playerColor !== undefined" class="con-task__opt-player">
                    <span :class="'con-status__dot player_bg_color_' + entry.playerColor"></span>
                    <span>{{ entry.playerName }}</span>
                  </span>
                  <span class="con-task__opt-title">{{ entry.title }}</span>
                  <span v-if="entry.preview !== ''" class="con-task__opt-preview">{{ entry.preview }}</span>
                  <span v-if="entry.isSpace" class="con-task__opt-board">{{ $t('Choose a location on the board') }} →</span>
                  <span v-else-if="entry.isNested" class="con-task__opt-board" aria-hidden="true">›</span>
                  <GamepadGlyph v-if="focusIdx === i" :control="armed ? 'secondary' : 'confirm'" class="con-task__opt-a" />
                </div>
                <div v-if="entry.effects.length > 0" class="con-task__opt-effects">
                  <ActionEffectChip v-for="(eff, k) in entry.effects" :key="k" :effect="eff" />
                </div>
                <div v-if="entry.description !== ''" class="con-task__opt-desc">{{ entry.description }}</div>
                <div v-if="entry.tradeoff !== ''" class="con-task__opt-tradeoff">⚠ {{ entry.tradeoff }}</div>
                <div v-if="focusIdx === i && armed && entry.risky" class="con-task__opt-confirmbar">
                  {{ $t('Press again to confirm') }}
                </div>
              </div>
              <div v-if="disabledChoiceEntries.length > 0" class="con-task__disabled">
                <div class="con-task__disabled-title">{{ $t('Unavailable targets') }}</div>
                <div v-for="(d, i) in disabledChoiceEntries" :key="'d' + i" class="con-task__option con-task__option--disabled">
                  <div class="con-task__option-main">
                    <span v-if="d.playerColor !== undefined" class="con-task__opt-player">
                      <span :class="'con-status__dot player_bg_color_' + d.playerColor"></span>
                    </span>
                    <span class="con-task__opt-title">{{ d.title }}</span>
                    <span class="con-task__opt-reason">{{ d.reason }}</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- ── PLAYER ─────────────────────────────────────────── -->
            <template v-else-if="activeTask.kind === 'player'">
              <div v-for="(p, i) in playerEntries" :key="p.color"
                   class="con-task__option"
                   :class="{'con-task__option--focused': focusIdx === i, 'con-task__option--armed': focusIdx === i && armed}">
                <div class="con-task__option-main">
                  <span class="con-task__opt-player">
                    <span :class="'con-status__dot player_bg_color_' + p.color"></span>
                    <span>{{ p.name }}</span>
                  </span>
                  <span v-if="p.corp !== ''" class="con-task__opt-corp">{{ $t(p.corp) }}</span>
                  <span v-if="p.impact !== ''" class="con-task__opt-preview" :class="{'con-task__opt-preview--prod': p.production}">
                    <i v-if="p.iconClass !== ''" :class="p.iconClass" class="con-task__opt-icon" aria-hidden="true"></i>
                    {{ p.impact }}
                  </span>
                  <GamepadGlyph v-if="focusIdx === i" :control="armed ? 'secondary' : 'confirm'" class="con-task__opt-a" />
                </div>
              </div>
              <div v-if="disabledPlayerEntries.length > 0" class="con-task__disabled">
                <div class="con-task__disabled-title">{{ $t('Unavailable targets') }}</div>
                <div v-for="(d, i) in disabledPlayerEntries" :key="'dp' + i" class="con-task__option con-task__option--disabled">
                  <div class="con-task__option-main">
                    <span class="con-task__opt-player">
                      <span :class="'con-status__dot player_bg_color_' + d.color"></span>
                      <span>{{ d.name }}</span>
                    </span>
                    <span class="con-task__opt-reason">{{ d.reason }}</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- ── AMOUNT ─────────────────────────────────────────── -->
            <template v-else-if="activeTask.kind === 'amount'">
              <div class="con-task__stepper">
                <i v-if="amountIconClass !== ''" :class="amountIconClass" class="con-task__stepper-icon" aria-hidden="true"></i>
                <div class="con-task__stepper-readout">
                  <span class="con-task__stepper-value">{{ value }}</span>
                  <span v-if="amountUnit !== ''" class="con-task__stepper-unit">{{ amountUnit }}</span>
                </div>
                <div class="con-task__stepper-range">{{ amountMin }} – {{ amountMax }}</div>
                <div class="con-task__stepper-keys" aria-hidden="true">
                  <span class="con-task__key"><GamepadGlyph control="bumperL" /><span>−1</span></span>
                  <span class="con-task__key"><GamepadGlyph control="bumperR" /><span>+1</span></span>
                  <span class="con-task__key"><GamepadGlyph control="triggerR" /><span>{{ $t('MAX') }}</span></span>
                </div>
              </div>
            </template>

            <!-- ── RESOURCE ───────────────────────────────────────── -->
            <template v-else-if="activeTask.kind === 'resource'">
              <div class="con-task__tiles">
                <div v-for="(unit, i) in resourceUnits" :key="unit"
                     class="con-task__tile"
                     :class="{'con-task__tile--focused': focusIdx === i, 'con-task__tile--armed': focusIdx === i && armed}">
                  <i class="con-task__tile-icon" :class="'resource_icon resource_icon--' + unit" aria-hidden="true"></i>
                  <GamepadGlyph v-if="focusIdx === i" :control="armed ? 'secondary' : 'confirm'" class="con-task__opt-a" />
                </div>
              </div>
            </template>

            <!-- ── CARD BROWSER (T2 · P13 rework): ONE clean composition —
                 the focused card is emphasized IN PLACE (scaled up,
                 neighbours calmed), X opens the fullscreen viewer; >6
                 candidates wrap into a GRID (no kilometre scrolling). -->
            <template v-else-if="activeTask.kind === 'cardSelect'">
              <div class="con-cards">
                <div class="con-cards__strip"
                     :class="{'con-cards__strip--grid': gridMode, 'con-cards__strip--has-focus': cardEntries.length > 0}"
                     ref="cardStrip">
                  <!-- P15: no per-card cost overlay (the buy math lives in
                       the pickline), strong «✓ SELECTED» band, unpicked
                       cards de-emphasize at the pick max. -->
                  <div v-for="(entry, i) in cardEntries" :key="entry.card.name + '#' + i"
                       class="con-cards__slot"
                       :class="{
                         'con-cards__slot--focused': focusIdx === i,
                         'con-cards__slot--picked': isPicked(entry.card.name),
                         'con-cards__slot--disabled': entry.disabled,
                         'con-cards__slot--dim': cardDimUnpicked && !entry.disabled && !isPicked(entry.card.name),
                       }"
                       :ref="focusIdx === i ? 'focusedCardSlot' : undefined">
                    <Card :card="entry.card" :key="entry.card.name" lightweight />
                    <span v-if="isPicked(entry.card.name)" class="con-cards__pickband" aria-hidden="true">✓ {{ $t('Card selected') }}</span>
                    <!-- P18: disabled candidates wear the state badge + the
                         concrete reason line (glance + detail). -->
                    <span v-else-if="entry.disabled" class="con-cards__pickband con-cards__pickband--disabled" aria-hidden="true">{{ $t('Unavailable') }}</span>
                    <span v-if="entry.disabled" class="con-cards__reason">{{ entry.reason !== '' ? entry.reason : $t('Unavailable right now') }}</span>
                  </div>
                </div>
                <!-- The focused card's verdict line — compact context, never a
                     duplicate card (X = the universal fullscreen INSPECT read).
                     PICK phase: A = select (one press commits, no deselect).
                     BUY / multi: A = select/deselect, RT = commit the set. -->
                <div v-if="focusedCardEntry !== undefined" class="con-cards__verdictbar">
                  <span class="con-cards__verdict-name">{{ $t(focusedCardEntry.card.name) }}</span>
                  <span v-if="focusedCardEntry.disabled" class="con-cards__verdict con-cards__verdict--blocked">
                    <span aria-hidden="true">✕</span>
                    <span>{{ focusedCardEntry.reason !== '' ? focusedCardEntry.reason : $t('Unavailable right now') }}</span>
                  </span>
                  <span v-else-if="singlePick" class="con-cards__verdict con-cards__verdict--ok">
                    <GamepadGlyph control="confirm" /><span>{{ $t('Select') }}</span>
                  </span>
                  <span v-else-if="isPicked(focusedCardEntry.card.name)" class="con-cards__verdict con-cards__verdict--picked">
                    <GamepadGlyph control="confirm" /><span>{{ $t('Deselect') }}</span>
                  </span>
                  <span v-else-if="canPickFocusedCard" class="con-cards__verdict con-cards__verdict--ok">
                    <GamepadGlyph control="confirm" /><span>{{ $t('Select') }}</span>
                  </span>
                  <span v-else class="con-cards__verdict con-cards__verdict--blocked">
                    <span aria-hidden="true">✕</span><span>{{ $t('Deselect another card first') }}</span>
                  </span>
                  <span class="con-cards__verdict con-cards__verdict--zoom">
                    <GamepadGlyph control="secondary" /><span>{{ $t('Inspect') }}</span>
                  </span>
                  <span v-if="!singlePick && confirmReady" class="con-cards__verdict con-cards__verdict--go">
                    <GamepadGlyph control="triggerR" /><span>{{ $t(cardConfirmLabel) }}</span>
                  </span>
                </div>
              </div>
            </template>

            <!-- ── PAYMENT (T3: native lanes; M€ auto-balances) ────── -->
            <template v-else-if="activeTask.kind === 'payment'">
              <div v-for="(lane, i) in payLanes" :key="lane.unit"
                   class="con-task__lane"
                   :class="{'con-task__lane--focused': focusIdx === i, 'con-task__lane--active': payCount(lane.unit) > 0}">
                <span class="con-task__lane-id">
                  <i class="con-task__opt-icon" :class="'resource_icon resource_icon--' + lane.unit" aria-hidden="true"></i>
                </span>
                <span class="con-task__lane-rate" aria-hidden="true">×{{ lane.rate }}</span>
                <span class="con-task__lane-value">{{ payCount(lane.unit) }}</span>
                <span class="con-task__lane-max">/ {{ lane.available }}</span>
                <span v-if="lane.reserved" class="con-task__lane-reserved">{{ $t('reserved') }}</span>
                <span v-if="focusIdx === i" class="con-task__lane-keys" aria-hidden="true">
                  <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
                </span>
              </div>
              <!-- The AUTO M€ lane — always the exact remainder (derived). -->
              <div class="con-task__lane con-task__lane--auto" :class="{'con-task__lane--active': payAutoMc > 0}">
                <span class="con-task__lane-id">
                  <i class="con-task__opt-icon resource_icon resource_icon--megacredits" aria-hidden="true"></i>
                </span>
                <span class="con-task__lane-value">{{ payAutoMc }}</span>
                <span class="con-task__lane-max">/ {{ megacreditsOnHand }}</span>
                <span class="con-task__lane-auto-tag">{{ $t('auto') }}</span>
              </div>
              <div v-if="!paymentReady" class="con-task__pay-short">
                ⚠ {{ $t('Not enough resources to cover the cost') }}
              </div>
            </template>

            <!-- ── DISTRIBUTE ─────────────────────────────────────── -->
            <template v-else-if="activeTask.kind === 'distribute'">
              <div class="con-task__dist-target" :class="{'con-task__dist-target--ready': distributeReady}">
                {{ $t('Total') }}: <b>{{ distributedSum }}</b> / {{ distributeTarget }}
              </div>
              <div v-for="(lane, i) in lanes" :key="lane.unit"
                   class="con-task__lane"
                   :class="{'con-task__lane--focused': focusIdx === i, 'con-task__lane--active': laneValue(lane.unit) > 0}">
                <span class="con-task__lane-id" :class="{'con-task__lane-id--prod': activeTask.mode === 'production'}">
                  <i class="con-task__opt-icon" :class="'resource_icon resource_icon--' + lane.unit" aria-hidden="true"></i>
                </span>
                <span class="con-task__lane-value">{{ laneValue(lane.unit) }}</span>
                <span class="con-task__lane-max">/ {{ lane.max }}</span>
                <span v-if="focusIdx === i" class="con-task__lane-keys" aria-hidden="true">
                  <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
                </span>
              </div>
            </template>
          </div>
        </div>

        <!-- ── Footer: the command contract, always visible ────────── -->
        <footer class="con-task__foot" aria-hidden="true">
          <span v-for="(hint, i) in footHints" :key="i" class="con-task__foot-item" :class="{'con-task__foot-item--off': hint.enabled === false}">
            <GamepadGlyph :control="hint.control" />
            <span>{{ $t(hint.label) }}</span>
          </span>
        </footer>
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE TASK HOST — CTS T1–T3 (CONSOLE_MODE_CONCEPT.md §CTS-1). The
 * single console-native surface for the prompt kinds: T1 primitives
 * (choice / player / amount / resource / distribute) + the T2 CARD
 * BROWSER (draft / buy / select / target — inspector + filmstrip, pick
 * counter, buy economics, disabled candidates with reasons) + the T3
 * PAYMENT lanes (desktop ledger math via paymentPlan.ts; M€ is an AUTO
 * lane so under/over-payment is impossible). The desktop
 * MandatoryInputModal is SUPPRESSED whenever this host serves
 * (taskServedByHost) — no fallback. `promptOverride` additionally hosts
 * CLIENT-BUILT prompts (the standard-project alt-resource payment) where
 * B = Cancel instead of Minimize (`deferLabel`).
 *
 * Control grammar (user-mandated):
 *   A  = select / toggle the focused element; A on the selected = confirm
 *   X  = CONFIRM in one press from anywhere (risky options arm first)
 *   B  = cancel when possible, else DEFER (inspect the board; B returns)
 *   LB/RB = −1 / +1 on value lanes · ←/→ mirror · Y = MAX
 *
 * INFO PARITY (CTS-3.8): the source card renders as the REAL <Card>;
 * option metadata (icons, player chips, current→resulting, effect chips
 * via the shared ActionEffectChip, tradeoffs, descriptions), disabled
 * targets with reasons and prompt warnings all carry over from the desktop
 * premium inputs. Submission payloads are byte-identical (taskResponses).
 */
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/Card.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel, OrOptionsModel, SelectOptionModel, OptionMetadata, SelectCardModel, SelectPaymentModel} from '@/common/models/PlayerInputModel';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Phase} from '@/common/Phase';
import {Color} from '@/common/Color';
import {Units} from '@/common/Units';
import {Message} from '@/common/logs/Message';
import {getCard} from '@/client/cards/ClientCardManifest';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {ConsoleTask} from '@/client/console/consoleTaskRouter';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {GamepadIntent, NavDirection, SemanticButton} from '@/client/gamepad/gamepadPollModel';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {
  amountResponse, cardsResponse, deltaProjectResponse, optionConfirmResponse, orOptionResponse,
  orWrappedResponse, paymentResponse, playerResponse, productionToLoseResponse, resourceResponse,
  resourcesResponse, STANDARD_UNITS,
} from '@/client/console/taskResponses';
import {CardModel} from '@/common/models/CardModel';
import {SpendableResource} from '@/common/inputs/Spendable';
import {
  autoMegacredits, initialCounts, laneCap, megacreditsAvailable, paymentCovers,
  paymentFromCounts, PaymentLane, paymentLanes, paymentTotal,
} from '@/client/console/paymentPlan';
import {getAward} from '@/client/MilestoneAwardManifest';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {AwardName} from '@/common/ma/AwardName';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

/** The UNTRANSLATED text (manifest lookups key off the English name). */
function rawTextOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? v : v.message;
}

type ChoiceEntry = {
  index: number,
  title: string,
  iconClass: string,
  playerColor: Color | undefined,
  playerName: string,
  preview: string,
  effects: ReadonlyArray<ActionEffect>,
  description: string,
  tradeoff: string,
  isSkip: boolean,
  isSpace: boolean,
  /** T9: the option nests a hostable input — confirming OPENS it (one-level wizard). */
  isNested: boolean,
  risky: boolean,
  option: PlayerInputModel,
};

/**
 * T9: the task kind a NESTED option's input maps to (the one-level
 * wizard). Composites (`and`) and deeper `or` nesting are NOT here — they
 * stay on the desktop modal (the router's serve predicate mirrors this).
 */
function nestedTaskFor(input: PlayerInputModel): ConsoleTask | undefined {
  switch (input.type) {
  case 'card':
    return {kind: 'cardSelect', mode: 'target'};
  case 'payment':
    return {kind: 'payment'};
  case 'amount':
    return {kind: 'amount', flavor: 'generic'};
  case 'player':
    return {kind: 'player'};
  case 'resource':
    return {kind: 'resource'};
  case 'resources':
    return {kind: 'distribute', mode: 'resources'};
  case 'productionToLose':
    return {kind: 'distribute', mode: 'production'};
  default:
    return undefined;
  }
}

const RESOURCE_FIELD: Record<string, {stock: string, production: string}> = {
  megacredits: {stock: 'megacredits', production: 'megacreditProduction'},
  steel: {stock: 'steel', production: 'steelProduction'},
  titanium: {stock: 'titanium', production: 'titaniumProduction'},
  plants: {stock: 'plants', production: 'plantProduction'},
  energy: {stock: 'energy', production: 'energyProduction'},
  heat: {stock: 'heat', production: 'heatProduction'},
};

export default defineComponent({
  name: 'ConsoleTaskHost',
  components: {Card, GamepadGlyph, ActionEffectChip},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    task: {type: Object as PropType<ConsoleTask>, required: true},
    /**
     * CLIENT-SIDE prompt override (T3): hosts a client-built input (the
     * standard-project alt-resource payment) instead of `waitingFor` —
     * nothing is committed server-side, so B = CANCEL (`deferLabel`).
     */
    promptOverride: {type: Object as PropType<PlayerInputModel | undefined>, default: undefined},
    /** The B affordance label: 'Minimize' (server prompt) / 'Cancel' (client). */
    deferLabel: {type: String, default: 'Minimize'},
  },
  emits: ['submit', 'defer', 'space-pick'],
  data() {
    return {
      focusIdx: 0,
      armed: false,
      value: 0,
      units: {} as Partial<Record<keyof Units, number>>,
      /** T2 card browser: picked card names, in pick order. */
      picks: [] as Array<CardName>,
      /** T3 payment: the dialed-in non-M€ lane counts (M€ auto-derives). */
      payCounts: {} as Partial<Record<SpendableResource, number>>,
      /** T9: the OPEN nested option (one-level wizard) — B returns to the list. */
      nested: undefined as {index: number, input: PlayerInputModel} | undefined,
      /** Blocks a duplicate submit between the emit and the next server response
       *  (e.g. rapid A presses in the pick phase) — cleared on every response. */
      submitting: false,
    };
  },
  computed: {
    /** The TOP-LEVEL prompt (never the nested input). */
    parentWf(): PlayerInputModel | undefined {
      return this.promptOverride ?? this.playerView.waitingFor;
    },
    /** What the bodies render: the nested input while the wizard is open. */
    wf(): PlayerInputModel | undefined {
      return this.nested?.input ?? this.parentWf;
    },
    /** The kind actually rendered (the nested input's kind while open). */
    activeTask(): ConsoleTask {
      if (this.nested !== undefined) {
        return nestedTaskFor(this.nested.input) ?? this.task;
      }
      return this.task;
    },
    /** The PROMPT identity — a change means a genuinely new server ask. */
    baseKey(): string {
      const override = this.promptOverride !== undefined ? 'client|' : '';
      return `${override}${this.parentWf?.type ?? ''}|${textOf(this.parentWf?.title)}`;
    },
    taskKey(): string {
      return this.nested !== undefined ? `${this.baseKey}|n${this.nested.index}` : this.baseKey;
    },
    titleText(): string {
      // Phase-aware card-browser titles — the server title there is generic
      // ("Select up to N cards to buy" / "Select a card to keep and pass…").
      // Other kinds AND every nested step keep the descriptive server title.
      if (this.nested === undefined && this.activeTask.kind === 'cardSelect') {
        if (this.isBuyMode) {
          return translateText('Select cards to purchase');
        }
        // Only the single-keep draft gets the "1 card" title; a multi-keep
        // draft keeps the (translated) server title ("Select two cards to keep…").
        if (this.isDraftPick && this.singlePick) {
          return translateText('Choose 1 card to draft');
        }
      }
      return textOf(this.wf?.title);
    },
    kickerText(): string {
      return 'Awaiting decision';
    },
    /** choiceContext trigger sentence (parity with ContextualChoiceContent);
     *  inside a nested step — the PARENT ask as a breadcrumb. */
    triggerText(): string {
      if (this.nested !== undefined) {
        return `← ${textOf(this.parentWf?.title)}`;
      }
      const trigger = this.wf?.choiceContext?.trigger;
      return textOf(trigger as string | Message | undefined);
    },
    /** The docked source card — REAL render (info-parity contract; the
     *  context lives on the PARENT prompt, kept visible in nested steps). */
    sourceCardName(): CardName | undefined {
      const source = this.parentWf?.choiceContext?.source;
      return source !== undefined && 'card' in source ? (source.card as CardName | undefined) : undefined;
    },
    warningTexts(): Array<string> {
      const warnings = (this.wf as {warnings?: ReadonlyArray<string>} | undefined)?.warnings ?? [];
      return warnings.map((w) => translateText(String(w)));
    },
    confirmLabel(): string {
      const label = this.wf?.buttonLabel;
      return label !== undefined && label !== '' ? label : 'Confirm';
    },
    // ── choice ───────────────────────────────────────────────────────
    orOptions(): ReadonlyArray<PlayerInputModel> {
      if (this.wf?.type === 'or') {
        return (this.wf as OrOptionsModel).options;
      }
      return [];
    },
    allChoiceEntries(): Array<ChoiceEntry> {
      const source = this.wf?.type === 'option' ? [this.wf] : this.orOptions;
      return source.map((option, index) => {
        const meta: OptionMetadata | undefined = (option as SelectOptionModel).metadata;
        const player = meta?.player;
        const playerModel = player !== undefined ? this.playerView.players.find((p) => p.color === player.color) : undefined;
        const preview =
          player?.current !== undefined && player?.resulting !== undefined ? `${player.current} → ${player.resulting}` :
            meta?.global?.current !== undefined && meta?.global?.resulting !== undefined ?
              `${meta.global.current}${meta.global.unit ?? ''} → ${meta.global.resulting}${meta.global.unit ?? ''}` :
              meta?.resource !== undefined ? `${meta.resource.current} → ${meta.resource.resulting}` : '';
        const tradeoff = textOf(meta?.tradeoff);
        const title = textOf(option.title);
        // Free award funding (T4): dock each award's RULE next to its name —
        // the desktop AwardsOverlay shows it, so the console must too (CTS-3.8).
        let description = textOf(meta?.description);
        if (description === '' && this.activeTask.kind === 'choice' && this.activeTask.flavor === 'awardFunding') {
          try {
            description = translateText(getAward(rawTextOf(option.title) as AwardName).description);
          } catch (err) {
            description = '';
          }
        }
        return {
          index,
          title,
          iconClass: meta?.icon !== undefined ? iconClassFor(meta.icon) + ' con-task__opt-res' : '',
          playerColor: player?.color,
          playerName: playerModel?.name ?? '',
          preview,
          effects: meta?.effects ?? [],
          description,
          tradeoff,
          isSkip: meta?.kind === 'skip',
          isSpace: option.type === 'space',
          isNested: option.type !== 'option' && option.type !== 'space',
          risky: tradeoff !== '' || ((option as {warnings?: ReadonlyArray<string>}).warnings ?? []).length > 0,
          option,
        };
      });
    },
    /** Primary rows first, skip options last (desktop parity). */
    choiceEntries(): Array<ChoiceEntry> {
      const all = this.allChoiceEntries;
      return [...all.filter((e) => !e.isSkip), ...all.filter((e) => e.isSkip)];
    },
    disabledChoiceEntries(): Array<{title: string, reason: string, playerColor: Color | undefined}> {
      if (this.wf?.type !== 'or') {
        return [];
      }
      return ((this.wf as OrOptionsModel).disabledOptions ?? []).map((d) => {
        const rec = d as {label?: string | Message, reason?: string | Message, player?: {color?: Color}, metadata?: OptionMetadata};
        return {
          title: textOf(rec.label),
          reason: textOf(rec.reason),
          playerColor: rec.metadata?.player?.color ?? rec.player?.color,
        };
      });
    },
    // ── player ───────────────────────────────────────────────────────
    playerEntries(): Array<{color: Color, name: string, corp: string, impact: string, iconClass: string, production: boolean}> {
      if (this.wf?.type !== 'player') {
        return [];
      }
      const model = this.wf as PlayerInputModel & {type: 'player', players: ReadonlyArray<Color>, icon?: string, amount?: number, scope?: 'stock' | 'production'};
      const scope = model.scope ?? 'stock';
      return model.players.map((color) => {
        const p = this.playerView.players.find((pp) => pp.color === color);
        let corp = '';
        for (const c of p?.tableau ?? []) {
          try {
            if (getCard(c.name)?.type === CardType.CORPORATION) {
              corp = c.name;
              break;
            }
          } catch (err) { /* manifest gap */ }
        }
        let impact = '';
        if (model.icon !== undefined && model.amount !== undefined && p !== undefined) {
          const field = RESOURCE_FIELD[model.icon]?.[scope];
          const current = field !== undefined ? (p as unknown as Record<string, number>)[field] : undefined;
          if (current !== undefined) {
            impact = `${current} → ${current - model.amount}`;
          } else {
            impact = `−${model.amount}`;
          }
        }
        return {
          color,
          name: p?.name ?? color,
          corp,
          impact,
          iconClass: model.icon !== undefined ? iconClassFor(model.icon) + ' con-task__opt-res' : '',
          production: scope === 'production',
        };
      });
    },
    disabledPlayerEntries(): Array<{color: Color, name: string, reason: string}> {
      if (this.wf?.type !== 'player') {
        return [];
      }
      const model = this.wf as PlayerInputModel & {type: 'player', disabledPlayers?: ReadonlyArray<{color: Color, reason?: string | Message}>};
      return (model.disabledPlayers ?? []).map((d) => ({
        color: d.color,
        name: this.playerView.players.find((p) => p.color === d.color)?.name ?? d.color,
        reason: textOf(d.reason),
      }));
    },
    // ── amount ───────────────────────────────────────────────────────
    amountMin(): number {
      return this.wf?.type === 'amount' ? (this.wf as PlayerInputModel & {type: 'amount'}).min : 0;
    },
    amountMax(): number {
      if (this.wf?.type === 'amount') {
        return (this.wf as PlayerInputModel & {type: 'amount'}).max;
      }
      if (this.wf?.type === 'deltaProject') {
        return (this.wf as PlayerInputModel & {type: 'deltaProject', max?: number}).max ?? 0;
      }
      return 0;
    },
    amountIconClass(): string {
      const icon = this.wf?.type === 'amount' ? (this.wf as PlayerInputModel & {type: 'amount', icon?: string}).icon : 'energy';
      return icon !== undefined ? iconClassFor(icon) + ' con-task__opt-res' : '';
    },
    amountUnit(): string {
      const unit = this.wf?.type === 'amount' ? (this.wf as PlayerInputModel & {type: 'amount', unit?: string}).unit : undefined;
      return unit ?? '';
    },
    // ── resource ─────────────────────────────────────────────────────
    resourceUnits(): ReadonlyArray<keyof Units> {
      if (this.wf?.type !== 'resource') {
        return [];
      }
      return (this.wf as PlayerInputModel & {type: 'resource'}).include;
    },
    // ── distribute ───────────────────────────────────────────────────
    lanes(): Array<{unit: keyof Units, max: number}> {
      if (this.activeTask.kind !== 'distribute') {
        return [];
      }
      if (this.activeTask.mode === 'production') {
        const model = this.wf as PlayerInputModel & {type: 'productionToLose'};
        return STANDARD_UNITS
          .filter((u) => model.payProduction.units[u] > 0)
          .map((u) => ({unit: u, max: model.payProduction.units[u]}));
      }
      // resources: distribute over the standard stock, capped by ownership.
      const me = this.playerView.thisPlayer as unknown as Record<string, number>;
      return STANDARD_UNITS.map((u) => ({unit: u, max: me[RESOURCE_FIELD[u].stock] ?? 0}));
    },
    distributeTarget(): number {
      if (this.activeTask.kind !== 'distribute') {
        return 0;
      }
      if (this.activeTask.mode === 'production') {
        return (this.wf as PlayerInputModel & {type: 'productionToLose'}).payProduction.cost;
      }
      return (this.wf as PlayerInputModel & {type: 'resources'}).count;
    },
    distributedSum(): number {
      return this.lanes.reduce((sum, l) => sum + (this.units[l.unit] ?? 0), 0);
    },
    distributeReady(): boolean {
      return this.distributedSum === this.distributeTarget;
    },
    // ── card browser (T2) ────────────────────────────────────────────
    cardModel(): SelectCardModel | undefined {
      return this.wf?.type === 'card' ? (this.wf as SelectCardModel) : undefined;
    },
    /** Selectable candidates first, then the DISABLED ones (with reasons). */
    cardEntries(): Array<{card: CardModel, disabled: boolean, reason: string}> {
      const model = this.cardModel;
      if (model === undefined) {
        return [];
      }
      return [
        ...model.cards.map((card) => ({card, disabled: false, reason: ''})),
        ...(model.disabledCards ?? []).map((card) => ({card, disabled: true, reason: textOf(card.disabledReason)})),
      ];
    },
    focusedCardEntry(): {card: CardModel, disabled: boolean, reason: string} | undefined {
      return this.cardEntries[this.focusIdx];
    },
    cardMin(): number {
      return this.cardModel?.min ?? 0;
    },
    cardMax(): number {
      return this.cardModel?.max ?? 0;
    },
    /** min === max === 1 (P15: A toggles ONLY — Y is the one confirm). */
    singlePick(): boolean {
      return this.cardMin === 1 && this.cardMax === 1;
    },
    /** P15: at the pick max, unpicked cards de-emphasize (desktop parity). */
    cardDimUnpicked(): boolean {
      return this.cardMax > 0 && this.picks.length >= this.cardMax;
    },
    /** Can A pick the focused (unpicked, enabled) card right now? */
    canPickFocusedCard(): boolean {
      return this.cardMax === 1 || this.picks.length < this.cardMax;
    },
    /** P13: >6 candidates wrap into a grid (no kilometre scrolling). */
    gridMode(): boolean {
      return this.activeTask.kind === 'cardSelect' && this.cardEntries.length > 6;
    },
    isBuyMode(): boolean {
      return this.activeTask.kind === 'cardSelect' && this.activeTask.mode === 'buy';
    },
    /**
     * The between-generation DRAFT pick (keep a card, pass the rest on). The
     * REAL Draft.ts prompt uses buttonLabel 'Select' (→ router `mode: 'target'`),
     * so the reliable signal is the PHASE (mirrors the desktop
     * CardSelectionContent.isDraftPhase). The dead `mode: 'draft'` branch stays
     * for any future 'Keep'-labelled prompt.
     */
    isDraftPick(): boolean {
      const phase = this.playerView.game.phase;
      return this.activeTask.kind === 'cardSelect' &&
        (this.activeTask.mode === 'draft' || phase === Phase.DRAFTING || phase === Phase.INITIALDRAFTING);
    },
    /**
     * The per-card RESEARCH/buy cost — `player.cardCost` (base 3 M€, raised by
     * Polyphemos to 5 / dropped by Terralabs Research to 1), which is EXACTLY
     * what the server charges after we submit the card list (ChooseCards →
     * `cost = selected.length * player.cardCost`). Mirrors the desktop
     * CardSelectionContent.costPerCard — UI and the actual charge cannot diverge.
     *
     * NEVER `cards[0].calculatedCost`: that is the card's PLAY cost (printed
     * cost minus play discounts), baked into every `played:false` CardModel for
     * information only. Using it BUY-priced a card at its printed cost (the
     * "2 × 17 = −34" bug).
     */
    buyCostPerCard(): number {
      return this.playerView.thisPlayer.cardCost;
    },
    buyTotal(): number {
      return this.picks.length * this.buyCostPerCard;
    },
    megacreditsOnHand(): number {
      return megacreditsAvailable(this.playerView.thisPlayer);
    },
    /** M€ left after the current buy selection (buy-phase readout). */
    megacreditsAfterPurchase(): number {
      return this.megacreditsOnHand - this.buyTotal;
    },
    cardBuyAffordable(): boolean {
      return !this.isBuyMode || this.buyTotal <= this.megacreditsOnHand;
    },
    /** The honest insufficient-funds banner text (buy phase). */
    buyShortfallText(): string {
      return translateText('Not enough M€: need ${0}, have ${1}')
        .replace('${0}', String(this.buyTotal))
        .replace('${1}', String(this.megacreditsOnHand));
    },
    /** RT/commit label for the MULTI (buy / multi-target) commit. */
    cardConfirmLabel(): string {
      if (this.isBuyMode) {
        return this.picks.length === 0 ? 'Skip' : 'Buy';
      }
      return this.confirmLabel;
    },
    /** A one-line explanation under the title (single-keep draft: what happens
     *  to the cards you don't keep). */
    phaseSubtext(): string {
      return this.isDraftPick && this.singlePick ?
        translateText('The card is kept for you, the rest are passed on.') : '';
    },
    cardPicksValid(): boolean {
      return this.picks.length >= this.cardMin && this.picks.length <= this.cardMax && this.cardBuyAffordable;
    },
    // ── payment (T3) ─────────────────────────────────────────────────
    paymentModel(): SelectPaymentModel | undefined {
      return this.wf?.type === 'payment' ? (this.wf as SelectPaymentModel) : undefined;
    },
    paymentCost(): number {
      return this.paymentModel?.amount ?? 0;
    },
    payLanes(): Array<PaymentLane> {
      const model = this.paymentModel;
      if (model === undefined) {
        return [];
      }
      return paymentLanes(model, this.playerView.thisPlayer);
    },
    payAutoMc(): number {
      return autoMegacredits(this.paymentCost, this.payLanes, this.payCounts, this.megacreditsOnHand);
    },
    payTotal(): number {
      return paymentTotal(this.paymentCost, this.payLanes, this.payCounts, this.megacreditsOnHand);
    },
    paymentReady(): boolean {
      return this.activeTask.kind !== 'payment' ||
        paymentCovers(this.paymentCost, this.payLanes, this.payCounts, this.megacreditsOnHand);
    },
    /** Can X submit right now? */
    confirmReady(): boolean {
      switch (this.activeTask.kind) {
      case 'distribute':
        return this.distributeReady;
      case 'choice':
        return this.choiceEntries.length > 0;
      case 'player':
        return this.playerEntries.length > 0;
      case 'resource':
        return this.resourceUnits.length > 0;
      case 'cardSelect':
        return this.cardPicksValid;
      case 'payment':
        return this.paymentReady;
      default:
        return true;
      }
    },
    footHints(): Array<{control: GlyphControl, label: string, enabled?: boolean}> {
      const confirm = {control: 'secondary' as GlyphControl, label: this.confirmLabel, enabled: this.confirmReady};
      const defer = {control: 'back' as GlyphControl, label: this.nested !== undefined ? 'Back' : this.deferLabel};
      switch (this.activeTask.kind) {
      case 'amount':
        return [
          {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
          {control: 'triggerR', label: 'MAX'}, confirm, defer,
        ];
      case 'distribute':
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
          {control: 'triggerR', label: 'MAX'}, confirm, defer,
        ];
      case 'payment':
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
          {control: 'triggerR', label: 'MAX'}, confirm, defer,
        ];
      case 'cardSelect': {
        // X ALWAYS opens the fullscreen INSPECT viewer (never labelled "Card").
        const nav: {control: GlyphControl, label: string} = {control: this.gridMode ? 'dpad' : 'dpadH', label: 'Navigate'};
        const inspect: {control: GlyphControl, label: string} = {control: 'secondary', label: 'Inspect'};
        if (this.singlePick) {
          // PICK phase (draft / single target): A commits the focused card in
          // one press — no toggle-then-confirm, no re-pick, no RT.
          return [nav, {control: 'confirm', label: 'Select'}, inspect, defer];
        }
        // BUY / multi phase: A toggles the pick, RT commits the whole set.
        return [
          nav,
          {control: 'confirm', label: 'Select / Deselect'},
          inspect,
          {control: 'triggerR', label: this.cardConfirmLabel, enabled: this.confirmReady},
          defer,
        ];
      }
      default:
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select'},
          confirm, defer,
        ];
      }
    },
    focusCount(): number {
      switch (this.activeTask.kind) {
      case 'choice': return this.choiceEntries.length;
      case 'player': return this.playerEntries.length;
      case 'resource': return this.resourceUnits.length;
      case 'distribute': return this.lanes.length;
      case 'cardSelect': return this.cardEntries.length;
      case 'payment': return this.payLanes.length;
      default: return 0;
      }
    },
  },
  watch: {
    taskKey: {
      immediate: true,
      handler() {
        this.resetState();
      },
    },
    /** A genuinely NEW server prompt discards an open nested step. */
    baseKey() {
      this.nested = undefined;
    },
    /** Every server response (root identity always changes) re-arms submission —
     *  robust against a same-key prompt re-send that the taskKey watcher misses. */
    playerView() {
      this.submitting = false;
    },
  },
  methods: {
    resetState(): void {
      this.focusIdx = 0;
      this.armed = false;
      this.units = {};
      this.picks = [];
      this.submitting = false;
      // Payment opens on the SAME optimal default mix the desktop form uses.
      this.payCounts = this.activeTask.kind === 'payment' ?
        initialCounts(this.paymentCost, this.payLanes, this.megacreditsOnHand) : {};
      const init = this.wf?.type === 'amount' ?
        ((this.wf as PlayerInputModel & {type: 'amount'}).maxByDefault ? this.amountMax : this.amountMin) :
        this.amountMax;
      this.value = init;
    },
    /** The shell routes every intent here while the host is active. */
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      this.onPress(intent.button);
    },
    /** P13/P15: X opens the focused card fullscreen (reused viewer). The
     *  select context lets A toggle the pick from fullscreen — disabled
     *  candidates stay readable but never pickable (toggle no-ops). */
    zoomFocusedCard(): void {
      if (this.cardEntries.length === 0) {
        return;
      }
      const cards = this.cardEntries.map((e) => e.card);
      if (this.singlePick) {
        // PICK phase: A in the viewer COMMITS the card (the ACTION bridge —
        // executes AFTER the viewer closes, never a toggle) — parity with the
        // strip's single-press select, and with the desktop fullscreen "Select".
        openConsoleCardZoom(cards, this.focusIdx, undefined, {
          labelFor: (name) => (this.cardEntries.find((e) => e.card.name === name)?.disabled ? undefined : 'Select'),
          reasonsFor: (name) => {
            const e = this.cardEntries.find((entry) => entry.card.name === name);
            return e !== undefined && e.disabled && e.reason !== '' ? [e.reason] : [];
          },
          execute: (name) => this.commitSingleCard(name),
        });
        return;
      }
      // BUY / multi: A toggles the pick and the viewer STAYS open to browse.
      openConsoleCardZoom(cards, this.focusIdx, {
        isSelected: (name) => this.isPicked(name),
        toggle: (name) => this.toggleCardPickByName(name),
      });
    },
    /**
     * Row jump in GRID mode — measured from the real DOM (offsetTop groups),
     * so it is robust to flex-wrap at any profile/width: pick the slot in
     * the adjacent row whose centre is nearest horizontally.
     */
    moveFocusRow(step: 1 | -1): void {
      const strip = this.$refs.cardStrip as HTMLElement | undefined;
      if (strip === undefined) {
        return;
      }
      const slots = Array.from(strip.children) as Array<HTMLElement>;
      const cur = slots[this.focusIdx];
      if (cur === undefined) {
        return;
      }
      const curTop = cur.offsetTop;
      const curCx = cur.offsetLeft + cur.offsetWidth / 2;
      let best = -1;
      let bestScore = Infinity;
      slots.forEach((el, i) => {
        const dTop = el.offsetTop - curTop;
        if ((step === 1 && dTop <= 4) || (step === -1 && dTop >= -4)) {
          return; // not in the requested direction
        }
        const rowDist = Math.abs(dTop);
        const cx = el.offsetLeft + el.offsetWidth / 2;
        const score = rowDist * 10000 + Math.abs(cx - curCx);
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      });
      if (best !== -1 && best !== this.focusIdx) {
        this.focusIdx = best;
        this.armed = false;
        void this.$nextTick(() => this.scrollFocusedIntoView());
      }
    },
    onNav(dir: NavDirection): void {
      const vertical = dir === 'up' || dir === 'down';
      if (this.activeTask.kind === 'amount') {
        if (dir === 'left') {
          this.adjust(-1);
        }
        if (dir === 'right') {
          this.adjust(1);
        }
        return;
      }
      if (this.activeTask.kind === 'distribute' || this.activeTask.kind === 'payment') {
        if (vertical) {
          this.moveFocus(dir === 'down' ? 1 : -1);
        } else {
          this.adjust(dir === 'right' ? 1 : -1);
        }
        return;
      }
      if (this.activeTask.kind === 'resource' || this.activeTask.kind === 'cardSelect') {
        // Horizontal tile row / filmstrip; the P13 GRID adds row jumps.
        if (!vertical) {
          this.moveFocus(dir === 'right' ? 1 : -1);
        } else if (this.activeTask.kind === 'cardSelect' && this.gridMode) {
          this.moveFocusRow(dir === 'down' ? 1 : -1);
        }
        return;
      }
      // choice / player: vertical rows.
      if (vertical) {
        this.moveFocus(dir === 'down' ? 1 : -1);
      }
    },
    moveFocus(step: number): void {
      const n = this.focusCount;
      if (n === 0) {
        return;
      }
      const next = Math.min(n - 1, Math.max(0, this.focusIdx + step));
      if (next !== this.focusIdx) {
        this.focusIdx = next;
        this.armed = false;
        void this.$nextTick(() => this.scrollFocusedIntoView());
      }
    },
    scrollFocusedIntoView(): void {
      const body = this.$refs.body as HTMLElement | undefined;
      const slot = this.$refs.focusedCardSlot as HTMLElement | Array<HTMLElement> | undefined;
      const cardEl = Array.isArray(slot) ? slot[0] : slot;
      if (cardEl !== undefined && cardEl !== null) {
        cardEl.scrollIntoView({inline: 'center', block: 'nearest', behavior: 'smooth'});
        return;
      }
      const focused = body?.querySelector('.con-task__option--focused, .con-task__tile--focused, .con-task__lane--focused');
      focused?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    },
    // ── card browser helpers (T2) ────────────────────────────────────
    isPicked(name: CardName): boolean {
      return this.picks.includes(name);
    },
    togglePick(): void {
      const entry = this.focusedCardEntry;
      if (entry === undefined || entry.disabled) {
        return; // a disabled candidate is readable, never pickable
      }
      this.toggleCardPickByName(entry.card.name);
    },
    /** P15: pure selection flip — shared by the strip AND the fullscreen
     *  viewer's A (picked → deselect, even single-pick; the hidden
     *  A-on-picked confirm is gone — Y is the one confirm). */
    toggleCardPickByName(name: CardName): void {
      const entry = this.cardEntries.find((e) => e.card.name === name);
      if (entry === undefined || entry.disabled) {
        return;
      }
      const at = this.picks.indexOf(name);
      if (at !== -1) {
        this.picks.splice(at, 1);
        return;
      }
      if (this.cardMax === 1) {
        this.picks = [name]; // single-slot: the new pick replaces
        return;
      }
      if (this.picks.length >= this.cardMax) {
        return; // slots full — the verdict bar explains (deselect first)
      }
      this.picks.push(name);
    },
    /** PICK phase (single card): select the focused card AND submit at once —
     *  no lingering "selected" state, no re-pick (desktop single-select parity). */
    commitFocusedCard(): void {
      const entry = this.focusedCardEntry;
      if (entry !== undefined && !entry.disabled) {
        this.commitSingleCard(entry.card.name);
      }
    },
    commitSingleCard(name: CardName): void {
      const entry = this.cardEntries.find((e) => e.card.name === name);
      if (entry === undefined || entry.disabled) {
        return;
      }
      this.picks = [name];
      this.onConfirm();
    },
    laneValue(unit: keyof Units): number {
      return this.units[unit] ?? 0;
    },
    payCount(unit: SpendableResource): number {
      return this.payCounts[unit] ?? 0;
    },
    adjust(step: number): void {
      if (this.activeTask.kind === 'amount') {
        this.value = Math.min(this.amountMax, Math.max(this.amountMin, this.value + step));
        return;
      }
      if (this.activeTask.kind === 'distribute') {
        const lane = this.lanes[this.focusIdx];
        if (lane === undefined) {
          return;
        }
        const current = this.units[lane.unit] ?? 0;
        // Cap by the lane max AND by the remaining target.
        const headroom = this.distributeTarget - this.distributedSum;
        const next = Math.min(lane.max, Math.max(0, current + Math.min(step, headroom)));
        this.units = {...this.units, [lane.unit]: next};
        return;
      }
      if (this.activeTask.kind === 'payment') {
        const lane = this.payLanes[this.focusIdx];
        if (lane === undefined) {
          return;
        }
        const current = this.payCounts[lane.unit] ?? 0;
        const next = Math.min(laneCap(this.paymentCost, lane), Math.max(0, current + step));
        this.payCounts = {...this.payCounts, [lane.unit]: next};
      }
    },
    maxOut(): void {
      if (this.activeTask.kind === 'amount') {
        this.value = this.amountMax;
        return;
      }
      if (this.activeTask.kind === 'distribute') {
        const lane = this.lanes[this.focusIdx];
        if (lane === undefined) {
          return;
        }
        const current = this.units[lane.unit] ?? 0;
        const headroom = this.distributeTarget - this.distributedSum + current;
        this.units = {...this.units, [lane.unit]: Math.min(lane.max, headroom)};
        return;
      }
      if (this.activeTask.kind === 'payment') {
        const lane = this.payLanes[this.focusIdx];
        if (lane === undefined) {
          return;
        }
        this.payCounts = {...this.payCounts, [lane.unit]: laneCap(this.paymentCost, lane)};
      }
    },
    onPress(button: SemanticButton): void {
      switch (button) {
      case 'bumperL':
        this.adjust(-1);
        return;
      case 'bumperR':
        this.adjust(1);
        return;
      case 'triggerR': // P27b: the local verb moved off Y (Y = Info Mode)
        // CARD context: RT is the MULTI (buy / multi-target) commit. The PICK
        // phase has no separate confirm — A already commits — so RT is inert.
        if (this.activeTask.kind === 'cardSelect') {
          if (!this.singlePick) {
            this.onConfirm();
          }
          return;
        }
        this.maxOut();
        return;
      case 'confirm':
        this.onPrimary();
        return;
      case 'secondary':
        // P13 global rule: X opens the focused card FULLSCREEN in every
        // card context; elsewhere it stays the one-press confirm.
        if (this.activeTask.kind === 'cardSelect') {
          this.zoomFocusedCard();
          return;
        }
        this.onConfirm();
        return;
      case 'back':
        // T9: inside a nested step B returns to the branch list, never defers.
        if (this.nested !== undefined) {
          this.exitNested();
          return;
        }
        this.$emit('defer');
        return;
      default:
        return;
      }
    },
    /** A: select/arm the focused element; A on the armed one = confirm. */
    onPrimary(): void {
      if (this.activeTask.kind === 'amount' || this.activeTask.kind === 'distribute' || this.activeTask.kind === 'payment') {
        this.onConfirm();
        return;
      }
      if (this.activeTask.kind === 'cardSelect') {
        if (this.singlePick) {
          this.commitFocusedCard(); // PICK phase: A selects + submits at once
        } else {
          this.togglePick(); // BUY / multi: A toggles; RT commits
        }
        return;
      }
      if (this.wf?.type === 'option') {
        this.onConfirm(); // bare confirm — a single A is enough
        return;
      }
      if (this.armed) {
        this.onConfirm();
      } else {
        this.armed = true;
      }
    },
    /** X: one-press confirm of the focused selection (risky arms first). */
    onConfirm(): void {
      if (!this.confirmReady) {
        return;
      }
      switch (this.activeTask.kind) {
      case 'choice': {
        if (this.wf?.type === 'option') {
          this.submitResponse( optionConfirmResponse());
          return;
        }
        const entry = this.choiceEntries[this.focusIdx];
        if (entry === undefined) {
          return;
        }
        if (entry.risky && !this.armed) {
          this.armed = true; // risky: X arms first, second press confirms
          return;
        }
        if (entry.isSpace) {
          // Nested board pick — the shell hosts the headless SelectSpace
          // and wraps the space response into this option's OR index.
          this.$emit('space-pick', {index: entry.index, spacePrompt: entry.option});
          return;
        }
        if (entry.isNested) {
          // T9: OPEN the nested input as a one-level wizard step — its
          // submit is wrapped into this option's OR index; B returns here.
          this.nested = {index: entry.index, input: entry.option};
          return;
        }
        this.submitResponse(orOptionResponse(entry.index));
        return;
      }
      case 'player': {
        const p = this.playerEntries[this.focusIdx];
        if (p !== undefined) {
          this.submitResponse( playerResponse(p.color));
        }
        return;
      }
      case 'amount':
        this.submitResponse( this.activeTask.flavor === 'delta' ? deltaProjectResponse(this.value) : amountResponse(this.value));
        return;
      case 'resource': {
        const unit = this.resourceUnits[this.focusIdx];
        if (unit !== undefined) {
          this.submitResponse( resourceResponse(unit));
        }
        return;
      }
      case 'distribute':
        this.submitResponse( this.activeTask.mode === 'production' ?
          productionToLoseResponse(this.units) : resourcesResponse(this.units));
        return;
      case 'cardSelect':
        // Byte-parity: the bare top-level {type:'card', cards} the desktop
        // CardSelectionContent / hand-select flow POSTs.
        this.submitResponse( cardsResponse(this.picks));
        return;
      case 'payment':
        this.submitResponse( paymentResponse(
          paymentFromCounts(this.paymentCost, this.payLanes, this.payCounts, this.megacreditsOnHand)));
        return;
      default:
        return;
      }
    },
    /** T9: back from a nested step to the branch list (nothing submitted). */
    exitNested(): void {
      this.nested = undefined;
    },
    /**
     * ALL submits route here: a nested step's response is WRAPPED into its
     * OR index (`{type:'or', index, response}` — byte-identical to the
     * desktop ModernOptionPicker's nestedSave); a top-level response
     * passes through unchanged.
     */
    submitResponse(response: unknown): void {
      if (this.submitting) {
        return; // guard rapid double-presses — no duplicate action (req §8)
      }
      this.submitting = true;
      if (this.nested !== undefined) {
        this.$emit('submit', orWrappedResponse(this.nested.index, response));
        return;
      }
      this.$emit('submit', response);
    },
  },
});
</script>

<template>
  <div class="con-task-host" role="dialog" :aria-label="titleText">
    <div class="con-task-host__backdrop" aria-hidden="true"></div>

    <!-- Keyed frame: prompt→prompt switches cross-fade (CTS-3.9). -->
    <transition name="con-task-swap" mode="out-in">
      <div class="con-task" :key="taskKey">
        <!-- ── Frame header ────────────────────────────────────────── -->
        <header class="con-task__head">
          <div class="con-task__kicker">
            <span class="con-task__kicker-mark" aria-hidden="true">◈</span>
            <span>{{ $t(kickerText) }}</span>
          </div>
          <div class="con-task__title">{{ titleText }}</div>
          <div v-if="triggerText !== ''" class="con-task__trigger">{{ triggerText }}</div>
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
            <template v-if="task.kind === 'choice'">
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
            <template v-else-if="task.kind === 'player'">
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
            <template v-else-if="task.kind === 'amount'">
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
                  <span class="con-task__key"><GamepadGlyph control="inspect" /><span>{{ $t('MAX') }}</span></span>
                </div>
              </div>
            </template>

            <!-- ── RESOURCE ───────────────────────────────────────── -->
            <template v-else-if="task.kind === 'resource'">
              <div class="con-task__tiles">
                <div v-for="(unit, i) in resourceUnits" :key="unit"
                     class="con-task__tile"
                     :class="{'con-task__tile--focused': focusIdx === i, 'con-task__tile--armed': focusIdx === i && armed}">
                  <i class="con-task__tile-icon" :class="'resource_icon resource_icon--' + unit" aria-hidden="true"></i>
                  <GamepadGlyph v-if="focusIdx === i" :control="armed ? 'secondary' : 'confirm'" class="con-task__opt-a" />
                </div>
              </div>
            </template>

            <!-- ── DISTRIBUTE ─────────────────────────────────────── -->
            <template v-else-if="task.kind === 'distribute'">
              <div class="con-task__dist-target" :class="{'con-task__dist-target--ready': distributeReady}">
                {{ $t('Total') }}: <b>{{ distributedSum }}</b> / {{ distributeTarget }}
              </div>
              <div v-for="(lane, i) in lanes" :key="lane.unit"
                   class="con-task__lane"
                   :class="{'con-task__lane--focused': focusIdx === i, 'con-task__lane--active': laneValue(lane.unit) > 0}">
                <span class="con-task__lane-id" :class="{'con-task__lane-id--prod': task.mode === 'production'}">
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
 * CONSOLE TASK HOST — CTS T1 (CONSOLE_MODE_CONCEPT.md §CTS-1). The single
 * console-native surface for the primitive prompt kinds (choice / player /
 * amount / resource / distribute). The desktop MandatoryInputModal is
 * SUPPRESSED whenever this host serves (taskServedByHost) — no fallback.
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
import {PlayerInputModel, OrOptionsModel, SelectOptionModel, OptionMetadata} from '@/common/models/PlayerInputModel';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
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
  amountResponse, deltaProjectResponse, optionConfirmResponse, orOptionResponse,
  playerResponse, productionToLoseResponse, resourceResponse, resourcesResponse,
  STANDARD_UNITS,
} from '@/client/console/taskResponses';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
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
  risky: boolean,
  option: PlayerInputModel,
};

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
  },
  emits: ['submit', 'defer', 'space-pick'],
  data() {
    return {
      focusIdx: 0,
      armed: false,
      value: 0,
      units: {} as Partial<Record<keyof Units, number>>,
    };
  },
  computed: {
    wf(): PlayerInputModel | undefined {
      return this.playerView.waitingFor;
    },
    taskKey(): string {
      return `${this.wf?.type ?? ''}|${textOf(this.wf?.title)}`;
    },
    titleText(): string {
      return textOf(this.wf?.title);
    },
    kickerText(): string {
      return 'Awaiting decision';
    },
    /** choiceContext trigger sentence (parity with ContextualChoiceContent). */
    triggerText(): string {
      const trigger = this.wf?.choiceContext?.trigger;
      return textOf(trigger as string | Message | undefined);
    },
    /** The docked source card — REAL render (info-parity contract). */
    sourceCardName(): CardName | undefined {
      const source = this.wf?.choiceContext?.source;
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
        return {
          index,
          title: textOf(option.title),
          iconClass: meta?.icon !== undefined ? iconClassFor(meta.icon) + ' con-task__opt-res' : '',
          playerColor: player?.color,
          playerName: playerModel?.name ?? '',
          preview,
          effects: meta?.effects ?? [],
          description: textOf(meta?.description),
          tradeoff,
          isSkip: meta?.kind === 'skip',
          isSpace: option.type === 'space',
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
      if (this.task.kind !== 'distribute') {
        return [];
      }
      if (this.task.mode === 'production') {
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
      if (this.task.kind !== 'distribute') {
        return 0;
      }
      if (this.task.mode === 'production') {
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
    /** Can X submit right now? */
    confirmReady(): boolean {
      switch (this.task.kind) {
      case 'distribute':
        return this.distributeReady;
      case 'choice':
        return this.choiceEntries.length > 0;
      case 'player':
        return this.playerEntries.length > 0;
      case 'resource':
        return this.resourceUnits.length > 0;
      default:
        return true;
      }
    },
    footHints(): Array<{control: GlyphControl, label: string, enabled?: boolean}> {
      const confirm = {control: 'secondary' as GlyphControl, label: this.confirmLabel, enabled: this.confirmReady};
      const defer = {control: 'back' as GlyphControl, label: 'Minimize'};
      switch (this.task.kind) {
      case 'amount':
        return [
          {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
          {control: 'inspect', label: 'MAX'}, confirm, defer,
        ];
      case 'distribute':
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
          {control: 'inspect', label: 'MAX'}, confirm, defer,
        ];
      default:
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select'},
          confirm, defer,
        ];
      }
    },
    focusCount(): number {
      switch (this.task.kind) {
      case 'choice': return this.choiceEntries.length;
      case 'player': return this.playerEntries.length;
      case 'resource': return this.resourceUnits.length;
      case 'distribute': return this.lanes.length;
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
  },
  methods: {
    resetState(): void {
      this.focusIdx = 0;
      this.armed = false;
      this.units = {};
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
    onNav(dir: NavDirection): void {
      const vertical = dir === 'up' || dir === 'down';
      if (this.task.kind === 'amount') {
        if (dir === 'left') {
          this.adjust(-1);
        }
        if (dir === 'right') {
          this.adjust(1);
        }
        return;
      }
      if (this.task.kind === 'distribute') {
        if (vertical) {
          this.moveFocus(dir === 'down' ? 1 : -1);
        } else {
          this.adjust(dir === 'right' ? 1 : -1);
        }
        return;
      }
      if (this.task.kind === 'resource') {
        // Horizontal tile row.
        if (!vertical) {
          this.moveFocus(dir === 'right' ? 1 : -1);
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
      const focused = body?.querySelector('.con-task__option--focused, .con-task__tile--focused, .con-task__lane--focused');
      focused?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    },
    laneValue(unit: keyof Units): number {
      return this.units[unit] ?? 0;
    },
    adjust(step: number): void {
      if (this.task.kind === 'amount') {
        this.value = Math.min(this.amountMax, Math.max(this.amountMin, this.value + step));
        return;
      }
      if (this.task.kind === 'distribute') {
        const lane = this.lanes[this.focusIdx];
        if (lane === undefined) {
          return;
        }
        const current = this.units[lane.unit] ?? 0;
        // Cap by the lane max AND by the remaining target.
        const headroom = this.distributeTarget - this.distributedSum;
        const next = Math.min(lane.max, Math.max(0, current + Math.min(step, headroom)));
        this.units = {...this.units, [lane.unit]: next};
      }
    },
    maxOut(): void {
      if (this.task.kind === 'amount') {
        this.value = this.amountMax;
        return;
      }
      if (this.task.kind === 'distribute') {
        const lane = this.lanes[this.focusIdx];
        if (lane === undefined) {
          return;
        }
        const current = this.units[lane.unit] ?? 0;
        const headroom = this.distributeTarget - this.distributedSum + current;
        this.units = {...this.units, [lane.unit]: Math.min(lane.max, headroom)};
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
      case 'inspect':
        this.maxOut();
        return;
      case 'confirm':
        this.onPrimary();
        return;
      case 'secondary':
        this.onConfirm();
        return;
      case 'back':
        this.$emit('defer');
        return;
      default:
        return;
      }
    },
    /** A: select/arm the focused element; A on the armed one = confirm. */
    onPrimary(): void {
      if (this.task.kind === 'amount' || this.task.kind === 'distribute') {
        this.onConfirm();
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
      switch (this.task.kind) {
      case 'choice': {
        if (this.wf?.type === 'option') {
          this.$emit('submit', optionConfirmResponse());
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
        this.$emit('submit', orOptionResponse(entry.index));
        return;
      }
      case 'player': {
        const p = this.playerEntries[this.focusIdx];
        if (p !== undefined) {
          this.$emit('submit', playerResponse(p.color));
        }
        return;
      }
      case 'amount':
        this.$emit('submit', this.task.flavor === 'delta' ? deltaProjectResponse(this.value) : amountResponse(this.value));
        return;
      case 'resource': {
        const unit = this.resourceUnits[this.focusIdx];
        if (unit !== undefined) {
          this.$emit('submit', resourceResponse(unit));
        }
        return;
      }
      case 'distribute':
        this.$emit('submit', this.task.mode === 'production' ?
          productionToLoseResponse(this.units) : resourcesResponse(this.units));
        return;
      default:
        return;
      }
    },
  },
});
</script>

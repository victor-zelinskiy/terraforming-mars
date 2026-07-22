<template>
  <!-- data-motion-*: rides the shared `.con-shade` dim + the surface-motion
       director — no own backdrop. -->
  <div class="con-composer con-composer--corpfirst" :class="{'con-composer--submitting': submitting}" role="dialog" :aria-label="titleText" data-motion-surface="corp-first">

    <div class="con-composer__panel con-composer__panel--play con-composer__panel--corpfirst" data-motion-panel>
      <!-- ── Header: the MANDATORY framing leads. ─────────────────────── -->
      <div class="con-composer__kicker con-composer__kicker--mandatory">
        <span class="con-composer__kicker-mark" aria-hidden="true">⚑</span>
        <span>{{ $t('Mandatory corporation action') }}</span>
      </div>
      <div class="con-composer__name">{{ titleText }}</div>
      <div class="con-composer__playhead">
        <span class="con-composer__corpfirst-chip" v-i18n>First action</span>
        <span class="con-composer__paytag con-composer__paytag--mandatory" v-i18n>Mandatory</span>
        <span v-if="corpNames.length > 1" class="con-composer__corpfirst-pager">
          <span v-i18n>Corporation</span> {{ idx + 1 }}/{{ corpNames.length }}
        </span>
      </div>

      <!-- ── Two columns: the corporation card · the action briefing. ─── -->
      <div class="con-composer__playmain">
        <div class="con-composer__playcard">
          <Card v-if="card !== undefined" :card="card" :key="card.name" />
        </div>

        <div class="con-composer__playright">
          <ConsoleScrollArea class="con-composer__scroll" content-class="con-composer__scroll-body" ref="scroll">
            <!-- WHAT the corporation demands — the printed first-action text. -->
            <div class="con-composer__corpfirst-ask">{{ actionText }}</div>

            <div v-if="loading" class="con-composer__loading">{{ $t('Loading') }}…</div>
            <template v-else>
              <!-- The computable result — server-authored preview chips. -->
              <template v-if="effects.length > 0">
                <div class="con-composer__sub-title">{{ $t('Result') }}</div>
                <div class="con-composer__hero-chips con-composer__result-chips">
                  <ActionEffectChip v-for="(eff, k) in effects" :key="k" :effect="eff" />
                </div>
              </template>

              <!-- Skipped-effect warnings (shared derivation — desktop parity). -->
              <div v-for="(w, i) in warnings" :key="'w' + i" class="con-composer__warn">
                <span class="con-composer__warn-glyph" aria-hidden="true">⚠</span>
                <span class="con-composer__warn-body">
                  <span class="con-composer__warn-head">
                    <span v-if="w.title !== ''" class="con-composer__warn-title">{{ w.title }}</span>
                    <ActionEffectChip v-if="w.effect !== undefined" :effect="w.effect" :skipped="true" />
                  </span>
                  <span class="con-composer__warn-text">{{ w.reason }}</span>
                </span>
              </div>

              <!-- Honest post-confirm follow-ups (a board placement, a pick…). -->
              <div v-for="(n, i) in followUpNotes" :key="'n' + i" class="con-composer__next">
                <span aria-hidden="true">›</span><span>{{ n }}</span>
              </div>

              <!-- The single Ⓐ CTA — the action is mandatory, so it is always
                   ready; B only DEFERS (the amber chip), never dismisses. -->
              <div class="con-composer__cta con-composer__cta--ready con-composer__cta--focused">
                <GamepadGlyph control="confirm" class="con-composer__cta-glyph" />
                <span class="con-composer__cta-label">{{ $t('Take first action') }}</span>
              </div>
            </template>
          </ConsoleScrollArea>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE CORP FIRST-ACTION CONFIRM — the dedicated modal for the corporation's
 * MANDATORY first action (`startGamePrompt.kind === 'corporationInitialAction'`).
 * The visual sibling of ConsolePlayCardConfirm (`.con-composer` chassis),
 * recomposed for this scenario: a MANDATORY framing (amber kicker + badge), the
 * corporation card as the artifact, the printed first-action ASK, the
 * server-computed result chips (`/api/corp-first-action-preview` — the
 * first-action analog of the card-play preview) and the honest post-confirm
 * follow-up notes. It REPLACED the «Разыграно» table's action mode as the
 * serving surface for this prompt.
 *
 * Nothing is pre-collected here — the submit is the single OrOptions option
 * (`{type:'or', index, response:{type:'option'}}`, byte-identical to the
 * desktop start-flow submit); the action's own prompts (a Tharsis city
 * placement, Vitor's award pick, Aridor's tile catalog) arrive as NATIVE
 * follow-up tasks on their dedicated surfaces, exactly as before.
 *
 * Control grammar (hints live ONLY in the shell's bottom command bar):
 * A = take the first action · X = inspect the corporation fullscreen ·
 * ←/→ (and LB/RB) = switch corporation when SEVERAL owe an action (Merger) ·
 * B = defer to the amber chip (mandatory — never a dismissal) · Y stays the
 * global Information Mode (handled by the shell).
 */
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {ActionPreview, ActionPreviewBranch, ActionEffect} from '@/common/models/ActionPreviewModel';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {skippedEffectViews} from '@/client/components/actions/skippedEffectView';
import {translateMessage, translateText, translateCardName} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {startFlowCorpPrompt, corpActionOptionIndexFor} from '@/client/components/startGameFlow/startGameFlowState';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

export default defineComponent({
  name: 'ConsoleCorpFirstActionConfirm',
  components: {Card, ConsoleScrollArea, GamepadGlyph, ActionEffectChip},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    /** The corporations whose first action is live RIGHT NOW (>1 = Merger). */
    corpNames: {type: Array as PropType<ReadonlyArray<CardName>>, required: true},
  },
  emits: {
    'confirm': (_name: CardName) => true,
    'cancel': () => true,
  },
  data() {
    return {
      idx: 0,
      /** Fetched previews by corp name (`name in previews` = fetch settled). */
      previews: {} as Record<string, ActionPreview | undefined>,
      submitting: false,
    };
  },
  computed: {
    currentName(): CardName | undefined {
      return this.corpNames[Math.min(this.idx, this.corpNames.length - 1)];
    },
    card(): CardModel | undefined {
      return this.playerView.thisPlayer.tableau.find((c) => c.name === this.currentName);
    },
    titleText(): string {
      return this.currentName !== undefined ? translateCardName(this.currentName) : '';
    },
    /** The printed first-action text — the live option's buttonLabel
     *  (`initialActionText`), resolved structurally from the prompt. */
    actionText(): string {
      const prompt = startFlowCorpPrompt(this.playerView);
      const name = this.currentName;
      if (prompt !== undefined && name !== undefined) {
        const index = corpActionOptionIndexFor(prompt, name);
        const label = index !== -1 ? prompt.options?.[index]?.buttonLabel : undefined;
        if (label !== undefined && label !== '') {
          return translateText(label);
        }
      }
      return translateText('Take the first action of your corporation');
    },
    loading(): boolean {
      const name = this.currentName;
      return name !== undefined && !(name in this.previews);
    },
    preview(): ActionPreview | undefined {
      const name = this.currentName;
      return name !== undefined ? this.previews[name] : undefined;
    },
    branch(): ActionPreviewBranch | undefined {
      return this.preview?.branches.find((b) => b.available) ?? this.preview?.branches[0];
    },
    effects(): ReadonlyArray<ActionEffect> {
      return this.branch?.effects ?? [];
    },
    warnings(): Array<{title: string, reason: string, effect?: ActionEffect}> {
      const b = this.branch;
      if (b === undefined) {
        return [];
      }
      return skippedEffectViews(b.steps).map((w) => ({
        title: w.title !== '' ? translateText(w.title) : '',
        reason: translateText(w.reason),
        effect: w.effect,
      }));
    },
    followUpNotes(): Array<string> {
      const b = this.branch;
      if (b === undefined) {
        return [];
      }
      const out: Array<string> = [];
      for (const s of b.steps) {
        if (s.kind === 'boardPlacement') {
          out.push(translateText(s.placementType === 'colony' ? 'Choose where to build a colony' : 'Choose a location on the board'));
        } else if (s.kind === 'note' && s.noteKind !== 'warning') {
          out.push(s.text !== undefined ? textOf(s.text) : translateText('Choose a target'));
        } else if (s.kind === 'input') {
          // Defensive: the first-action submit pre-collects nothing, so an
          // interactive step reads as an honest "you will choose next" line.
          const t = textOf(s.input.title);
          out.push(t !== '' ? t : translateText('Choose a target'));
        }
      }
      return out;
    },
  },
  watch: {
    corpNames: {
      immediate: true,
      handler(names: ReadonlyArray<CardName>) {
        if (this.idx >= names.length) {
          this.idx = 0;
        }
      },
    },
    currentName: {
      immediate: true,
      handler(name: CardName | undefined) {
        if (name !== undefined && !(name in this.previews)) {
          this.fetchPreview(name);
        }
      },
    },
    playerView() {
      this.submitting = false;
    },
  },
  methods: {
    fetchPreview(name: CardName): void {
      const url = apiUrl(paths.API_CORP_FIRST_ACTION_PREVIEW) +
        '?id=' + encodeURIComponent(this.playerView.id) + '&corp=' + encodeURIComponent(name);
      fetch(url)
        .then((r) => (r.ok ? r.json() : undefined))
        .then((p) => {
          this.previews = {...this.previews, [name]: p as ActionPreview | undefined};
        })
        .catch(() => {
          // Graceful: the modal still shows the ask + the confirm CTA.
          this.previews = {...this.previews, [name]: undefined};
        });
    },
    switchCorp(step: 1 | -1): void {
      const n = this.corpNames.length;
      if (n < 2) {
        return;
      }
      this.idx = (this.idx + step + n) % n;
    },
    // ── input (the shell owns the pad and delegates) ────────────────────
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'scroll') {
        this.stickScroll(intent.dy);
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary':
        this.confirm();
        break;
      case 'inspect':
        this.inspectCard();
        break;
      case 'prevSection':
        this.switchCorp(-1);
        break;
      case 'nextSection':
        this.switchCorp(1);
        break;
      case 'back':
        this.$emit('cancel');
        break;
      default:
        break;
      }
    },
    onNav(dir: NavDirection): void {
      if (dir === 'left') {
        this.switchCorp(-1);
      } else if (dir === 'right') {
        this.switchCorp(1);
      }
    },
    stickScroll(dy: number): void {
      if (Math.abs(dy) < 0.05) {
        return;
      }
      (this.$refs.scroll as {scrollByPx?: (d: number) => void} | undefined)?.scrollByPx?.(dy * 44);
    },
    inspectCard(): void {
      if (this.card !== undefined) {
        // "One physical card": the modal's corp card lifts into fullscreen
        // and returns into the same slot on close (the composer pattern).
        openConsoleCardZoom([this.card], 0, undefined, undefined, {
          origin: {
            kind: 'physical',
            resolve: () => (this.$el as HTMLElement | undefined)?.querySelector<HTMLElement>('.con-composer__playcard') ?? null,
          },
        });
      }
    },
    confirm(): void {
      const name = this.currentName;
      if (name === undefined || this.submitting) {
        return;
      }
      this.submitting = true;
      this.$emit('confirm', name);
    },
  },
});
</script>

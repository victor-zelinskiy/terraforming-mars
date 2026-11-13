<template>
  <div ref="root" class="con-composer con-composer--corpfirst con-ws" :class="{'con-composer--submitting': submitting}" role="dialog" :aria-label="titleText" data-motion-surface="corp-first">

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

              <!-- Honest post-confirm follow-ups (a board placement, a pick…).
                   Same fixed-height «ДАЛЕЕ» row as the play composer. -->
              <div v-for="(n, i) in followUpNotes" :key="'n' + i" class="con-composer__next" :aria-label="n.full">
                <span v-if="n.tileType !== undefined" class="con-composer__next-tile" :style="tileIconStyle(n.tileType)" aria-hidden="true"></span>
                <span v-else class="con-composer__next-glyph" aria-hidden="true">›</span>
                <span class="con-composer__next-label">{{ $t('Next') }}</span>
                <span class="con-composer__next-text">{{ n.text }}</span>
                <span v-if="n.constraint !== ''" class="con-composer__next-tail">{{ n.constraint }}</span>
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

<script setup lang="ts">
/*
 * data-motion-*: rides the shared `.con-shade` dim + the surface-motion
 * director — no own backdrop.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
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
import {computed, PropType, ref, useTemplateRef, watch} from 'vue';
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
import {fetchPreview} from '@/client/utils/previewFetch';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {skippedEffectViews} from '@/client/components/actions/skippedEffectView';
import {$t, translateMessage, translateText, translateCardName} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {NextStepRow, noteRow, placementRow} from '@/client/console/consolePlacementNextStep';
import {consoleTranslate} from '@/client/console/consoleTranslate';
/** The «ДАЛЕЕ» row's inline tile pictogram (the same art as the card face). */
import {tileIconStyle} from '@/client/console/consoleTileIcon';
import {gameStateVersion} from '@/client/console/gameStateVersion';
import {startFlowCorpPrompt, corpActionOptionIndexFor} from '@/client/components/startGameFlow/startGameFlowState';
import {firstActionPreviewable} from '@/client/console/startFirstAction';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

defineOptions({name: 'ConsoleCorpFirstActionConfirm'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  /** The corporations whose first action is live RIGHT NOW (>1 = Merger). */
  corpNames: {type: Array as PropType<ReadonlyArray<CardName>>, required: true},
});
const emit = defineEmits({
  'confirm': (_name: CardName) => true,
  'cancel': () => true,
});

const root = useTemplateRef<HTMLElement>('root');
const scroll = useTemplateRef<{scrollByPx?: (d: number) => void}>('scroll');
const idx = ref(0);
/** Fetched previews by corp name (`name in previews` = fetch settled),
 *  scoped to the game-state version they were fetched under — a corp's
 *  first action is priced against live state (`canAfford`, production),
 *  so a preview outliving its own inputs is a lie about the ask. */
const previews = ref<Record<string, ActionPreview | undefined>>({});
const previewsVersion = ref('');
const submitting = ref(false);

const currentName = computed((): CardName | undefined => {
  return props.corpNames[Math.min(idx.value, props.corpNames.length - 1)];
});
const card = computed((): CardModel | undefined => {
  return props.playerView.thisPlayer.tableau.find((c) => c.name === currentName.value);
});
const titleText = computed((): string => {
  return currentName.value !== undefined ? translateCardName(currentName.value) : '';
});
/** The printed first-action text — the live option's buttonLabel
 *  (`initialActionText`), resolved structurally from the prompt. */
const actionText = computed((): string => {
  const prompt = startFlowCorpPrompt(props.playerView);
  const name = currentName.value;
  if (prompt !== undefined && name !== undefined) {
    const index = corpActionOptionIndexFor(prompt, name);
    const label = index !== -1 ? prompt.options?.[index]?.buttonLabel : undefined;
    if (label !== undefined && label !== '') {
      return translateText(label);
    }
  }
  return translateText('Take the first action of your corporation');
});
/** The game-state version the fetched previews belong to. */
const previewVersion = computed((): string => {
  return gameStateVersion(props.playerView);
});
const loading = computed((): boolean => {
  const name = currentName.value;
  return name !== undefined && !(name in previews.value);
});
const preview = computed((): ActionPreview | undefined => {
  const name = currentName.value;
  return name !== undefined ? previews.value[name] : undefined;
});
const branch = computed((): ActionPreviewBranch | undefined => {
  return preview.value?.branches.find((b) => b.available) ?? preview.value?.branches[0];
});
const effects = computed((): ReadonlyArray<ActionEffect> => {
  return branch.value?.effects ?? [];
});
const warnings = computed((): Array<{title: string, reason: string, effect?: ActionEffect}> => {
  const b = branch.value;
  if (b === undefined) {
    return [];
  }
  return skippedEffectViews(b.steps).map((w) => ({
    title: w.title !== '' ? translateText(w.title) : '',
    reason: translateText(w.reason),
    effect: w.effect,
  }));
});
const followUpNotes = computed((): Array<NextStepRow> => {
  const b = branch.value;
  if (b === undefined) {
    return [];
  }
  const out: Array<NextStepRow> = [];
  for (const s of b.steps) {
    if (s.kind === 'boardPlacement') {
      // Same presenter as the play composer — Tharsis Republic's free city
      // must read «разместите тайл города», not a mute "pick a location".
      out.push(placementRow(s, consoleTranslate, textOf));
    } else if (s.kind === 'note' && s.noteKind !== 'warning') {
      out.push(noteRow(s.text !== undefined ? textOf(s.text) : translateText('Choose a target')));
    } else if (s.kind === 'input') {
      // Defensive: the first-action submit pre-collects nothing, so an
      // interactive step reads as an honest "you will choose next" line.
      const t = textOf(s.input.title);
      out.push(noteRow(t !== '' ? t : translateText('Choose a target')));
    }
  }
  return out;
});

function loadPreview(name: CardName): void {
  // The version at REQUEST time: an answer that lands after the state moved
  // is dropped rather than stored under the new version (the prewarm cache's
  // rule — a stale answer is never patched, it simply stops matching).
  const version = previewVersion.value;
  // SETTLE, don't just skip. `loading` is `!(name in previews)`, so a name
  // we decline to ask about must still be RECORDED as answered — «no
  // preview» is the honest verdict (the modal shows the ask + the confirm
  // CTA), while leaving the slot empty is a permanent «Загрузка…».
  const settle = (preview: ActionPreview | undefined) => {
    if (previewsVersion.value === version) {
      previews.value = {...previews.value, [name]: preview};
    }
  };
  // ASK ONLY WHAT THE SERVER CAN ANSWER — the corp must still owe its first
  // action (`pendingInitialActions`, the ledger the route resolves
  // against). It drains at the SUBMIT, while this modal is still mounted.
  if (!firstActionPreviewable(props.playerView, name)) {
    settle(undefined);
    return;
  }
  const url = apiUrl(paths.API_CORP_FIRST_ACTION_PREVIEW) +
    '?id=' + encodeURIComponent(props.playerView.id) + '&corp=' + encodeURIComponent(name);
  // Graceful on an absent preview: the modal still shows the ask + the CTA.
  fetchPreview<ActionPreview>(url).then(settle);
}
function switchCorp(step: 1 | -1): void {
  const n = props.corpNames.length;
  if (n < 2) {
    return;
  }
  idx.value = (idx.value + step + n) % n;
}
// ── input (the shell owns the pad and delegates) ────────────────────
function handleIntent(intent: GamepadIntent): void {
  if (intent.kind === 'scroll') {
    stickScroll(intent.dy);
    return;
  }
  if (intent.kind === 'nav') {
    onNav(intent.dir);
    return;
  }
  if (intent.kind !== 'press') {
    return;
  }
  switch (consoleActionOf(intent)) {
  case 'primary':
    confirm();
    break;
  case 'inspect':
    inspectCard();
    break;
  case 'prevSection':
    switchCorp(-1);
    break;
  case 'nextSection':
    switchCorp(1);
    break;
  case 'back':
    emit('cancel');
    break;
  default:
    break;
  }
}
function onNav(dir: NavDirection): void {
  if (dir === 'left') {
    switchCorp(-1);
  } else if (dir === 'right') {
    switchCorp(1);
  }
}
function stickScroll(dy: number): void {
  if (Math.abs(dy) < 0.05) {
    return;
  }
  scroll.value?.scrollByPx?.(dy * 44);
}
function inspectCard(): void {
  if (card.value !== undefined) {
    // "One physical card": the modal's corp card lifts into fullscreen
    // and returns into the same slot on close (the composer pattern).
    openConsoleCardZoom([card.value], 0, undefined, undefined, {
      origin: {
        kind: 'physical',
        resolve: () => root.value?.querySelector<HTMLElement>('.con-composer__playcard') ?? null,
      },
    });
  }
}
function confirm(): void {
  const name = currentName.value;
  if (name === undefined || submitting.value) {
    return;
  }
  submitting.value = true;
  emit('confirm', name);
}

watch(() => props.corpNames, (names: ReadonlyArray<CardName>) => {
  if (idx.value >= names.length) {
    idx.value = 0;
  }
}, {immediate: true});
watch(() => currentName.value, (name: CardName | undefined) => {
  if (name !== undefined && !(name in previews.value)) {
    loadPreview(name);
  }
}, {immediate: true});
watch(() => props.playerView, () => {
  submitting.value = false;
});
/**
 * The server state moved — every fetched preview is a spent verdict. Drop
 * them AND re-ask for the one on screen: `currentName` has not changed, so
 * its own watcher will not fire, and a cleared cache with nobody refilling
 * it is a permanent «Загрузка…».
 */
watch(() => previewVersion.value, (version: string) => {
  if (previewsVersion.value === version) {
    return;
  }
  const seeding = previewsVersion.value === '';
  previewsVersion.value = version;
  previews.value = {};
  const name = currentName.value;
  // On the SEEDING pass the `currentName` watcher (declared above, also
  // immediate) has already asked — refetching here would double it.
  if (!seeding && name !== undefined) {
    loadPreview(name);
  }
}, {immediate: true});
defineExpose({handleIntent, stickScroll});
</script>

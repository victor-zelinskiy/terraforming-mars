<template>
  <div class="con-parl-fxhost" :class="['con-parl-fxhost--zone-' + zone, {'con-parl-fxhost--no-actions': groups.length === 0}]"
       data-parl-effects-step :data-parl-effects-zone="zone">
    <!-- ══ THE INNER STEP «ВАШИ ЭФФЕКТЫ» IS A HOST (ONE FRAMEWORK С6, decision Р4): the seat's Parliament ACTIONS are the
         «Действия карт» tiles themselves (read-only — the same group view Information's «Действия» hosts; A here is the
         bench's own door, routed by the section), its STANDING EFFECTS are the effects explorer's political groups (the
         third host, its own cursor). It stands on the CHAMBER's rect, titles nothing (the crumb names it) and draws no
         tile language of its own. ══ -->
    <section class="con-parl-fxhost__actions" data-parl-effects-actions>
      <header class="con-parl-fxhost__head">
        <span class="con-parl-fxhost__kicker">
          <svg class="con-parl-fxhost__glyph" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.6 1 3.4 9.1h3.9L6.2 15l6.4-8.4H8.6z" /></svg>{{ $t('Actions') }}
        </span>
        <span v-if="groups.length > 0" class="con-parl-fxhost__sum">{{ groups.length }}</span>
      </header>
      <div class="con-parl-fxhost__list">
        <div v-for="(group, i) in groups" :key="group.key" class="con-parl-fxhost__tile"
             :class="{'con-parl-fxhost__tile--focused': zone === 'actions' && i === actionCursor}"
             :data-parl-fx-entry="group.key" :data-party="group.party ?? group.resolutionParty">
          <ConsoleActionGroupView :group="group" readonly />
        </div>
        <p v-if="groups.length === 0" class="con-parl-fxhost__empty" data-parl-fx-empty="actions">{{ $t('No parliament action is yours') }}</p>
      </div>
    </section>
    <section class="con-parl-fxhost__effects" data-parl-effects-standing>
      <ConsoleEffectsExplorer ref="explorer" :cards="noCards" :color="color" :politicalEntries="entries" :explorerUi="explorerUi" workColumn />
    </section>
  </div>
</template>
<script setup vapor lang="ts">
import {PropType, useTemplateRef} from 'vue';
import {ExposedOf} from '@/client/components/exposedOf';
import {$t} from '@/client/directives/i18n';
import {CardModel} from '@/common/models/CardModel';
import {ConsoleActionGroup} from '@/client/console/consoleCardActions';
import {PoliticalEffectEntry} from '@/client/components/effects/effectExtraction';
import {EffectsExplorerUi} from '@/client/console/consoleEffectsExplorer';
import {EffectsHostZone} from '@/client/console/parliament/parliamentEffectsHost';
import ConsoleActionGroupView from '@/client/components/console/ConsoleActionGroupView.vue';
import ConsoleEffectsExplorer from '@/client/components/console/ConsoleEffectsExplorer.vue';

defineOptions({name: 'ConsoleParliamentEffectsStep'});
defineProps({
  /** The seat's Parliament actions as «Действия карт» groups (`parliamentActionSources` → `buildConsoleActionsModel`). */
  groups: {type: Array as PropType<ReadonlyArray<ConsoleActionGroup>>, required: true},
  /** The seat's standing political effects — the explorer's entries (`politicalEffectEntries`). */
  entries: {type: Array as PropType<ReadonlyArray<PoliticalEffectEntry>>, required: true},
  color: {type: String, required: true},
  zone: {type: String as PropType<EffectsHostZone>, required: true},
  actionCursor: {type: Number, required: true},
  explorerUi: {type: Object as PropType<EffectsExplorerUi>, required: true},
});

/** The explorer's `cards` — it reads none here (a constant handed to the template: no ref — RECIPES § R4). */
const noCards: ReadonlyArray<CardModel> = [];
// The template's `ref="explorer"` (R11). The Options component had a METHOD of the same name beside it — two
// namespaces there (`this.$refs.explorer` · `this.explorer()`), one here: the template ref keeps the key's name, the
// method stands under a name of its own and is EXPOSED under the public one. (A function binding named like a string
// template ref makes the runtime warn «Template ref "explorer" used on a non-ref value» on every mount of a dev build.)
const explorer = useTemplateRef<ExposedOf<typeof ConsoleEffectsExplorer>>('explorer');

/** The hosted explorer — the section forwards the effects zone's intents to it. */
function hostedExplorer(): ExposedOf<typeof ConsoleEffectsExplorer> | undefined {
  return explorer.value ?? undefined;
}

// What `ConsoleParliamentSection` reaches through its `ref="effectsStep"`: `explorer()` — and nothing else. The
// `handleIntent` / `consumeEffectsBack` it then calls are members of the explorer this returns, not of this component.
defineExpose({explorer: hostedExplorer});
</script>

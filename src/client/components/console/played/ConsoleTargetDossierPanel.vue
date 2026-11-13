<template>
  <section class="con-tdossier" :class="{'con-tdossier--closing': closing, 'con-tdossier--blocked': dossier.blocked !== undefined}"
           data-target-dossier :data-target-dossier-card="dossier.cardName">
    <header class="con-tdossier__head">
      <span class="con-tdossier__kicker">{{ $t('Target') }}</span>
      <span class="con-tdossier__owner">
        <span class="con-tdossier__dot" :class="'player_bg_color_' + dossier.owner.color" aria-hidden="true"></span>
        <!-- The seat's colour rides the DOT; the name reads in the panel's own ink (a dark seat colour on the dark plate
             was illegible — the 4K walk). -->
        <span class="con-tdossier__owner-name">{{ dossier.owner.self ? $t('Your card') : dossier.owner.name }}</span>
      </span>
    </header>

    <!-- WHAT LIES ON IT NOW, and what lands — the two numbers the rules never print. -->
    <div class="con-tdossier__now" data-target-dossier-now>
      <span v-if="dossier.holding !== undefined" class="con-tdossier__fact">
        <span class="con-tdossier__fact-label">{{ $t('On this card now') }}</span>
        <span class="con-tdossier__fact-value">
          <i class="con-tdossier__icon" :class="iconClass(dossier.holding.icon)" aria-hidden="true"></i>
          <b data-target-dossier-count>{{ dossier.holding.count }}</b>
        </span>
      </span>
      <span v-if="payloadIcon !== ''" class="con-tdossier__fact">
        <span class="con-tdossier__fact-label">{{ $t('Lands here') }}</span>
        <span class="con-tdossier__fact-value con-tdossier__fact-value--gain">
          <b>+{{ dossier.payload?.amount }}</b>
          <i class="con-tdossier__icon" :class="iconClass(payloadIcon)" aria-hidden="true"></i>
        </span>
      </span>
    </div>

    <!-- WHAT THIS MOVE DOES — the step's preview, section by section, every impact in full (the rail caps them). -->
    <div v-for="section in dossier.sections" :key="section.key" class="con-tdossier__section" :data-target-dossier-section="section.key">
      <div class="con-tdossier__section-title">{{ $t(section.title) }}</div>
      <div v-for="(imp, k) in section.impacts" :key="k" class="con-tdossier__row" :data-impact-outcome="imp.outcome">
        <span class="con-tdossier__row-icons" aria-hidden="true">
          <template v-if="imp.icons !== undefined">
            <template v-for="(icon, j) in imp.icons" :key="icon">
              <span v-if="j > 0" class="con-tdossier__row-join">{{ imp.join === 'and' ? '+' : '/' }}</span>
              <i class="con-tdossier__icon" :class="iconClass(icon)"></i>
            </template>
          </template>
          <i v-else-if="imp.icon !== undefined" class="con-tdossier__icon" :class="iconClass(imp.icon)"></i>
        </span>
        <span class="con-tdossier__row-label">{{ line(imp) }}</span>
        <span v-if="imp.from !== undefined && imp.to !== undefined" class="con-tdossier__row-delta"
              :class="{'con-tdossier__row-delta--down': imp.to < imp.from}">
          {{ imp.from }}<span class="con-tdossier__arrow" aria-hidden="true">→</span><b>{{ imp.to }}</b>
        </span>
        <span v-else-if="imp.amount !== undefined" class="con-tdossier__row-delta"><b>{{ imp.amount > 0 ? '+' : '' }}{{ imp.amount }}</b></span>
      </div>
      <div v-if="section.note !== undefined" class="con-tdossier__note">{{ $t(section.note) }}</div>
    </div>

    <div v-if="dossier.blocked !== undefined" class="con-tdossier__blocked" data-target-dossier-blocked>
      <span aria-hidden="true">✕</span> {{ dossier.blocked.reason }}
      <b>{{ dossier.blocked.have }} / {{ dossier.blocked.need }}</b>
    </div>
    <div v-if="dossier.selfHarm" class="con-tdossier__warn">⚠ {{ $t('This is your own card') }}</div>
  </section>
</template>

<script setup vapor lang="ts">
/*
 * THE TARGET DOSSIER (the owner, 2026-11-02 — X on a target reads the card AS A TARGET, «с контекстом именно по
 * ресурсам на ней»). The viewer's side column leads with it, before the card's rules: whose card, what lies on it
 * NOW, what lands, what THIS move does to it (the step's own preview — the words the rail reads under the cursor),
 * a near miss's reason. Read-only; every state is a kant, a fill or a word (invariant 15).
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType} from 'vue';
import {$t} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {readingLineText} from '@/client/console/readingText';
import {PlayedTargetImpact} from '@/client/console/played/consolePlayedTargetModel';
import {PlayedTargetDossier} from '@/client/console/played/playedTargetDossier';

defineOptions({name: 'ConsoleTargetDossierPanel'});
const props = defineProps({
  dossier: {type: Object as PropType<PlayedTargetDossier>, required: true},
  /** The zoom close flight began — hide instantly (never lag the card). */
  closing: {type: Boolean, default: false},
});

/** The unit that lands: the step's own kind, or — a pick of any kind (P43) — the kind THIS card keeps. */
const payloadIcon = computed((): string => {
  const p = props.dossier.payload;
  if (p === undefined) {
    return '';
  }
  return p.icon !== '' ? p.icon : props.dossier.holding?.icon ?? '';
});
function iconClass(key: string): string {
  return iconClassFor(key);
}
/** ONE renderer for a reading with params (PL-160). */
function line(imp: PlayedTargetImpact): string {
  return readingLineText(imp);
}
</script>

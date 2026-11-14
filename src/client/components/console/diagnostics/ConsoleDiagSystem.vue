<template>
  <div class="con-diagsys" data-diag-system>
    <ConsoleScrollArea ref="scroll" class="con-diagsys__scroll" contentClass="con-diagsys__content">
      <div class="con-set__readout">
        <div v-for="group in groups" :key="group.label" class="con-set__rogroup" :data-diag-group="group.label">
          <div class="con-set__group">{{ $t(group.label) }}</div>
          <div v-for="ro in group.rows" :key="ro.label" class="con-set__ro">
            <span class="con-set__ro-key">{{ ro.raw ? ro.label : $t(ro.label) }}</span>
            <span class="con-set__ro-val" :class="'con-set__ro-val--' + ro.tone">{{ ro.value }}</span>
          </div>
          <div v-if="group.note !== ''" class="con-set__ro-note" :class="{'con-set__ro-note--bad': group.noteBad}">{{ group.note }}</div>
        </div>
      </div>
    </ConsoleScrollArea>
    <div class="con-set__detail con-diag__detail">
      <div class="con-set__detail-head">
        <span class="con-set__detail-title">{{ $t('Connection check') }}</span>
      </div>
      <div class="con-set__detail-desc">{{ $t('Sends one test message from the game screen, the application and the game server, and shows which of them reached the developer.') }}</div>
      <div class="con-set__detail-note"></div>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/**
 * «ДИАГНОСТИКА» → СИСТЕМА — the read-only readout of this device: how reports are sent, the link to the game server,
 * the display, the local network. It is the readout that used to be a category of the settings console; it lives
 * here now, beside the journal it explains, and the settings category of the same name holds the two SETTINGS of
 * diagnostics instead (a settings category has rows or a readout, never both — `system-surface.md` §2).
 *
 * ONE implementation of the groups: `buildDiagnosticsReadout` of the settings model (the same rows, the same tones),
 * with the reports group in front. Exposes `scrollBy` for ↑ / ↓.
 */
import {computed, onMounted, ref, useTemplateRef} from 'vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import {desktopBridge, DesktopLanState} from '@/client/components/desktop/desktopUpdateState';
import {buildDiagnosticsReadout, ConsoleReadoutGroup} from '@/client/console/settings/consoleSettingsModel';
import {diagHubState} from '@/client/diagnostics/diagnosticsHubState';
import {diagClock, environmentLabel, sendingReading} from '@/client/diagnostics/diagnosticsView';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';

defineOptions({name: 'ConsoleDiagSystem'});

const scroll = useTemplateRef<{scrollByPx?: (dy: number) => void}>('scroll');
const desktopVersion = ref('');
const lanInfo = ref<DesktopLanState | undefined>(undefined);

/** How reports leave this device — the hub's own words, in the readout's grammar. */
const reports = computed((): ConsoleReadoutGroup => {
  const status = diagHubState.status;
  const sending = sendingReading(status);
  const rows: Array<ConsoleReadoutGroup['rows'][number]> = [
    {label: 'Sending reports', raw: false, value: translateTextWithParams(sending.key, [...sending.params]), tone: sending.tone === 'ok' ? 'ok' : (sending.tone === 'warn' ? 'warn' : 'plain')},
  ];
  if (status !== undefined) {
    rows.push(
      {label: 'Build type', raw: false, value: translateText(environmentLabel(status.environment)), tone: 'plain'},
      {label: 'Waiting for the network', raw: false, value: String(status.queued), tone: status.queued > 0 ? 'warn' : 'plain'},
      {label: 'Last delivery', raw: false, value: status.lastDeliveredAt > 0 ? diagClock(status.lastDeliveredAt) : '—', tone: status.lastDeliveredAt > 0 ? 'ok' : 'plain'},
    );
  }
  return {
    label: 'Reports',
    rows,
    // Where the packages are kept — the one path a player may be asked for.
    note: status === undefined ? '' : (status.lastError !== '' ? status.lastError : status.reportsDir),
    noteBad: status !== undefined && status.lastError !== '',
  };
});
const groups = computed((): ReadonlyArray<ConsoleReadoutGroup> => [
  reports.value,
  ...buildDiagnosticsReadout({context: 'game', desktopVersion: desktopVersion.value, lan: lanInfo.value}),
]);

function scrollBy(dy: number): void {
  scroll.value?.scrollByPx?.(dy);
}

onMounted(() => {
  const bridge = desktopBridge();
  if (bridge === undefined) {
    return;
  }
  void bridge.getVersion().then((v) => {
    desktopVersion.value = typeof v === 'string' ? v : '';
  }).catch(() => undefined);
  void bridge.getLanState?.().then((lan) => {
    if (lan !== undefined) {
      lanInfo.value = lan;
    }
  }).catch(() => undefined);
});

defineExpose({scrollBy});
</script>

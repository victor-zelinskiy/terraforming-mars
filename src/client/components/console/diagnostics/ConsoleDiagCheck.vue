<template>
  <div class="con-diagcheck" :data-diag-check="state">
    <div class="con-diagrep__lead">{{ $t('One test message from each part of the game') }}</div>
    <div class="con-diagcheck__rows">
      <div
        v-for="row in rows"
        :key="row.runtime"
        class="con-diagcheck__row"
        :class="'con-diagcheck__row--' + row.state"
        :data-diag-check-row="row.runtime"
      >
        <span class="con-diagcheck__mark" aria-hidden="true">{{ row.mark }}</span>
        <span class="con-diagcheck__text">
          <span class="con-diagcheck__name">{{ $t(row.name) }}</span>
          <span class="con-diagcheck__what">{{ $t(row.what) }}</span>
        </span>
        <span class="con-diagcheck__result">
          <span class="con-diagcheck__verdict">{{ $t(row.verdict) }}</span>
          <span class="con-diagcheck__reason">{{ row.reason }}</span>
        </span>
      </div>
    </div>
    <!-- The summary's two lines are always reserved: the verdict arrives into a place that was waiting for it. -->
    <div class="con-diagcheck__summary" :class="'con-diag__tone--' + summary.tone">{{ $t(summary.title) }}</div>
    <div class="con-diagcheck__hint">{{ $t(summary.body) }}</div>
  </div>
</template>

<script setup vapor lang="ts">
/**
 * «ДИАГНОСТИКА › ПРОВЕРКА СВЯЗИ» — the developer's proof that this installation reaches them: one test event from
 * each runtime (the game screen, the application, the game server), each answered «доставлено» by the collector's
 * own acceptance — or with the reason it was not. Three fixed rows from the first frame (a row waits, then shows its
 * verdict in place); a runtime that does not run on this device says so, it is not a failure.
 */
import {computed} from 'vue';
import {DiagRuntime} from '@/common/diagnostics/DiagnosticModel';
import {diagSurfaceState} from '@/client/diagnostics/diagnosticsSurface';
import {diagRuntimeLabel, SELFTEST_RUNTIMES} from '@/client/diagnostics/diagnosticsView';
import {$t} from '@/client/directives/i18n';

defineOptions({name: 'ConsoleDiagCheck'});

const s = diagSurfaceState;

const WHAT: Record<DiagRuntime, string> = {
  page: 'What you see and control',
  main: 'The window, updates, crash reports',
  server: 'The rules and the saves of the game',
};

const state = computed((): string => (s.checking ? 'running' : (s.check === undefined ? 'idle' : 'done')));

const rows = computed(() => SELFTEST_RUNTIMES.map((runtime) => {
  const answer = s.check?.rows.find((r) => r.runtime === runtime);
  const rowState = answer === undefined ? 'waiting' : answer.state;
  return {
    runtime,
    state: rowState,
    name: diagRuntimeLabel(runtime),
    what: WHAT[runtime],
    mark: rowState === 'delivered' ? '✓' : (rowState === 'failed' ? '✕' : (rowState === 'absent' ? '—' : '…')),
    verdict: rowState === 'delivered' ? 'Delivered' : (rowState === 'failed' ? 'Not delivered' : (rowState === 'absent' ? 'Not on this device' : 'Checking…')),
    // The collector's and the transport's own words (technical, as they are) — only where something failed.
    reason: rowState === 'failed' ? (answer?.reason ?? '') : '',
  };
}));

const summary = computed((): {title: string, body: string, tone: string} => {
  if (s.check === undefined) {
    return {title: s.checking ? 'Checking the connection…' : '', body: s.checking ? 'This takes a few seconds.' : '', tone: 'plain'};
  }
  const failed = s.check.rows.filter((r) => r.state === 'failed').length;
  // THE COLLECTOR'S LIMIT IS NOT THE NETWORK: nothing on this device is wrong, and «check the internet» would be a lie.
  if (s.check.rows.some((r) => r.state === 'failed' && r.limited)) {
    return {
      title: 'The receiving service is full',
      body: 'The connection is fine — the service that receives reports has used up its limit. Reports are kept on this device and leave by themselves when the limit renews.',
      tone: 'warn',
    };
  }
  if (failed === 0) {
    return {title: 'Everything reaches the developer', body: 'Errors of this installation will arrive by themselves.', tone: 'ok'};
  }
  return {
    title: 'Not everything reaches the developer',
    body: 'Check the internet connection and try again. Reports you send by hand are kept on this device until they leave.',
    tone: 'bad',
  };
});
</script>

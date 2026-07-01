<template>
  <div
    v-if="showIndicator"
    class="realtime-indicator"
    :class="'realtime-indicator--' + rt.status"
    aria-hidden="true">
    <span class="realtime-indicator__dot"></span>
    <span class="realtime-indicator__label">RT: {{ rt.status }}{{ rt.helloAcked ? ' ✓' : '' }}{{ rt.subscribed ? ' · sub' : '' }}</span>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {realtimeService, realtimeState} from './realtimeService';
import {isRealtimeDebug, realtimeClientEnabled} from './realtimeConfig';

/**
 * App-level realtime layer (mounted as a sibling of <player-home>, so the
 * singleton service survives the `playerkey` remount). Its ONLY jobs in Phase 1:
 *   - start/stop the realtime service tied to being on a game screen;
 *   - render a dev-only connection-status chip.
 * It intentionally causes NO gameplay behaviour. When the realtime flag is off
 * the service no-ops and nothing renders.
 */
export default defineComponent({
  name: 'RealtimeLayer',
  props: {
    participantId: {
      type: String,
      required: true,
    },
  },
  computed: {
    rt() {
      return realtimeState;
    },
    showIndicator(): boolean {
      return isRealtimeDebug() && realtimeState.status !== 'disabled';
    },
  },
  watch: {
    participantId(id: string) {
      if (realtimeClientEnabled() && id !== '') {
        realtimeService.start({participantId: id});
      }
    },
  },
  mounted() {
    if (realtimeClientEnabled() && this.participantId !== '') {
      realtimeService.start({participantId: this.participantId});
    }
  },
  beforeUnmount() {
    realtimeService.stop();
  },
});
</script>

<style scoped lang="less">
.realtime-indicator {
  position: fixed;
  left: 8px;
  bottom: 8px;
  z-index: 12800;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 4px;
  font: 600 11px/1.2 monospace;
  letter-spacing: 0.04em;
  color: #cfe9ff;
  background: rgba(6, 14, 22, 0.82);
  border: 1px solid rgba(80, 160, 220, 0.35);
  pointer-events: none;
  user-select: none;
}

.realtime-indicator__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7a8a99;
  box-shadow: 0 0 6px currentColor;
}

.realtime-indicator--connecting .realtime-indicator__dot,
.realtime-indicator--reconnecting .realtime-indicator__dot {
  background: #e0b23a;
}

.realtime-indicator--connected .realtime-indicator__dot {
  background: #3ad07a;
}

.realtime-indicator--error .realtime-indicator__dot,
.realtime-indicator--closed .realtime-indicator__dot {
  background: #e05a5a;
}
</style>

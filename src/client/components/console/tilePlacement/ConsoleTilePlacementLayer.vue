<template>
  <!--
    TILE-PLACEMENT HERO STAGE — the fixed, app-level layer of the "tile
    physically lands on Mars" scene (consoleTilePlacement /
    tilePlacementDirector). Mounted for the WHOLE transaction, so the
    flight survives any surface shuffling beneath it.

    Anatomy:
     - the GROUND SHADOW parks at the target hex for the whole flight
       (wide + faint at altitude → tight contact at touchdown);
     - the TILE proxy is a twin of the REAL board tile art (the same
       `board-space-tile--*` sprite), carrying a thickness EDGE (the same
       art, darkened, offset down — a real hex-shaped underside) and a
       TOUCH overlay (the one quiet surface-acceptance beat);
     - the BONUS icon proxies replay the cell's printed icons from their
       exact captured positions — the reward beat lifts them through the
       placed tile and hands each to its resource chip on the shared
       ConsoleResourceTransferLayer.
  -->
  <!--
    `con-flight-to-board` — the DESTINATION marker. This flight lands on a
    live board hex (`.board-space[data_space_id]`), which a workspace surface
    covers with the shared shade. So while one is docked, this layer recedes
    BENEATH the shade (`.con-root:has(.con-ws)` in console.less) instead of
    flying bright over the panel the player is reading — another player's
    city used to do exactly that. Declare the marker ONLY if the flight truly
    ends on the board: a layer that lands on the rail, the «Разыграно» table,
    the footer dock, a reveal modal or its own tray must NOT carry it, or its
    arrival sinks under the shade while its target stays lit. Omitting it is
    the safe default.
  -->
  <div v-if="tilePlacementState.active || remotePlacementState.active" class="con-tileplace con-flight-to-board" aria-hidden="true">
    <template v-if="tilePlacementState.active">
      <div ref="shadow" class="con-tileplace__shadow"></div>
      <div v-if="artClass !== ''" ref="tile" class="con-tileplace__tile">
        <div class="con-tileplace__edge" :class="artClass"></div>
        <div class="con-tileplace__art" :class="artClass"></div>
        <div ref="touch" class="con-tileplace__touch"></div>
      </div>
      <div v-for="b in tilePlacementState.bonusProxies"
           :key="b.id"
           class="con-tileplace__bonus"
           :class="'board-space-bonus--' + b.icon"
           :style="bonusStyle(b)"
           :ref="(el) => setBonusRef(b.id, el as HTMLElement | null)"></div>
      <!-- OCEAN ADJACENCY — one paying ocean, one wake + one coin. The pulse
           is a local swell at the shore the ocean shares with the new tile;
           the coin CONDENSES out of that light (sparks → metal contour → gold
           mass → numeral + sheen) and ends as a pixel-twin of the framework's
           own M€ chip, so the handoff into the flight is invisible. -->
      <template v-for="c in tilePlacementState.oceanCoins" :key="'ocean-' + c.id">
        <div class="con-tileplace__oceanpulse"
             :style="oceanPulseStyle(c)"
             :ref="(el) => setOceanPulseRef(c.id, el as HTMLElement | null)">
          <div class="con-tileplace__oceanpulse-wash"></div>
          <div class="con-tileplace__oceanpulse-ring"></div>
        </div>
        <div class="con-tileplace__oceancoin"
             :style="oceanCoinStyle(c)"
             :ref="(el) => setOceanCoinRef(c.id, el as HTMLElement | null)">
          <div v-for="s in oceanSparks" :key="s" class="con-tileplace__coin-spark" :class="sparkClass(s)"></div>
          <div class="con-tileplace__coin-ring"></div>
          <div class="con-tileplace__coin-body">
            <span class="con-tileplace__coin-value">+{{ c.amount }}</span>
            <div class="con-tileplace__coin-sheen"></div>
          </div>
        </div>
      </template>
    </template>
    <!-- The REMOTE flight (another player's / the bot's placement) — its
         OWN proxy set, so a remote landing can overlap the own
         transaction's reward beat without fighting over refs. Same
         anatomy (thickness edge + touch overlay + parked ground shadow);
         the pose/direction carries the provenance. -->
    <template v-if="remotePlacementState.active">
      <div ref="remoteShadow" class="con-tileplace__shadow"></div>
      <div v-if="remoteArtClass !== ''" ref="remoteTile" class="con-tileplace__tile con-tileplace__tile--remote">
        <div class="con-tileplace__edge" :class="remoteArtClass"></div>
        <div class="con-tileplace__art" :class="remoteArtClass"></div>
        <div ref="remoteTouch" class="con-tileplace__touch"></div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {tilePlacementState, registerTilePlacementStage, BonusProxy, OceanCoinProxy} from '@/client/console/tilePlacement/consoleTilePlacement';
import {remotePlacementState, abortRemotePlacements} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {TileStageEls} from '@/client/console/tilePlacement/tilePlacementDirector';
import {OCEAN_COIN_SPARKS} from '@/client/console/tilePlacement/tilePlacementModel';
import {tileCssClassOf} from '@/client/components/board/BoardSpaceTile.vue';

export default defineComponent({
  name: 'ConsoleTilePlacementLayer',
  data() {
    return {
      tilePlacementState,
      remotePlacementState,
      unregister: undefined as (() => void) | undefined,
      bonusEls: new Map<number, HTMLElement>(),
      oceanPulseEls: new Map<number, HTMLElement>(),
      oceanCoinEls: new Map<number, HTMLElement>(),
      /** Stable indices for the condensation particles (the director poses
       *  them deterministically — no randomness anywhere in the scene). */
      oceanSparks: Array.from({length: OCEAN_COIN_SPARKS}, (_, i) => i),
    };
  },
  computed: {
    artClass(): string {
      const t = tilePlacementState.tileType;
      if (t === undefined) {
        return '';
      }
      const suffix = tileCssClassOf(t, tilePlacementState.aresExtension);
      return suffix === '' ? '' : 'board-space-tile--' + suffix;
    },
    remoteArtClass(): string {
      const t = remotePlacementState.tileType;
      if (t === undefined) {
        return '';
      }
      const suffix = tileCssClassOf(t, remotePlacementState.aresExtension);
      return suffix === '' ? '' : 'board-space-tile--' + suffix;
    },
  },
  methods: {
    /** The captured live rect IS the resting pose (the director only lifts). */
    bonusStyle(b: BonusProxy): Record<string, string> {
      return {
        left: `${Math.round(b.rect.x)}px`,
        top: `${Math.round(b.rect.y)}px`,
        width: `${Math.round(b.rect.w)}px`,
        height: `${Math.round(b.rect.h)}px`,
      };
    },
    setBonusRef(id: number, el: HTMLElement | null): void {
      if (el === null) {
        this.bonusEls.delete(id);
      } else {
        this.bonusEls.set(id, el);
      }
    },
    /** The activation pulse is sized from the OCEAN HEX (never fixed px), so
     *  it stays proportional under board zoom and every display profile. */
    oceanPulseStyle(c: OceanCoinProxy): Record<string, string> {
      return {
        left: `${Math.round(c.pulseAt.x - c.pulseSize / 2)}px`,
        top: `${Math.round(c.pulseAt.y - c.pulseSize / 2)}px`,
        width: `${c.pulseSize}px`,
        height: `${c.pulseSize}px`,
      };
    },
    /** The coin is CSS-sized in rem (the exact size of the framework's M€
     *  chip) and self-centres via a negative margin — so the birth point is
     *  the only thing JS supplies, and TV scaling is free. */
    oceanCoinStyle(c: OceanCoinProxy): Record<string, string> {
      return {left: `${Math.round(c.at.x)}px`, top: `${Math.round(c.at.y)}px`};
    },
    /** Mostly gold matter, with two cold highlights that keep the visual tie
     *  to the water the value condensed out of. */
    sparkClass(i: number): Record<string, boolean> {
      return {'con-tileplace__coin-spark--cool': i % 3 === 1};
    },
    setOceanPulseRef(id: number, el: HTMLElement | null): void {
      if (el === null) {
        this.oceanPulseEls.delete(id);
      } else {
        this.oceanPulseEls.set(id, el);
      }
    },
    setOceanCoinRef(id: number, el: HTMLElement | null): void {
      if (el === null) {
        this.oceanCoinEls.delete(id);
      } else {
        this.oceanCoinEls.set(id, el);
      }
    },
  },
  mounted() {
    this.unregister = registerTilePlacementStage({
      els: (): TileStageEls | undefined => {
        // Vue 3 sets a template ref to `null` (not `undefined`) once its
        // element has rendered then been removed — here when a SelectSpace has
        // no real tile art (St. Joseph's cathedral lands on an existing city,
        // so `artClass === ''` and the tile div is not rendered). `!tile`
        // covers both null and undefined; a bare `=== undefined` NPE'd.
        const tile = this.$refs.tile as HTMLElement | undefined;
        if (!tile || !tile.isConnected) {
          return undefined;
        }
        const bonusIcons: Array<HTMLElement> = [];
        for (const b of tilePlacementState.bonusProxies) {
          const el = this.bonusEls.get(b.id);
          if (el !== undefined && el.isConnected) {
            bonusIcons.push(el);
          }
        }
        // Ocean pieces are index-aligned with `oceanCoins` — the controller
        // bails out of the beat unless BOTH arrays match its own length, so a
        // half-mounted stage can never desync a pulse from its coin.
        const oceanPulses: Array<HTMLElement> = [];
        const oceanCoins: Array<HTMLElement> = [];
        for (const c of tilePlacementState.oceanCoins) {
          const pulse = this.oceanPulseEls.get(c.id);
          const coin = this.oceanCoinEls.get(c.id);
          if (pulse !== undefined && pulse.isConnected && coin !== undefined && coin.isConnected) {
            oceanPulses.push(pulse);
            oceanCoins.push(coin);
          }
        }
        return {
          tile,
          edge: tile.querySelector<HTMLElement>('.con-tileplace__edge') ?? undefined,
          touch: this.$refs.touch as HTMLElement | undefined,
          shadow: this.$refs.shadow as HTMLElement | undefined,
          bonusIcons,
          oceanPulses,
          oceanCoins,
        };
      },
      remoteEls: (): TileStageEls | undefined => {
        const tile = this.$refs.remoteTile as HTMLElement | undefined;
        if (!tile || !tile.isConnected) {
          return undefined;
        }
        return {
          tile,
          edge: tile.querySelector<HTMLElement>('.con-tileplace__edge') ?? undefined,
          touch: this.$refs.remoteTouch as HTMLElement | undefined,
          shadow: this.$refs.remoteShadow as HTMLElement | undefined,
          bonusIcons: [],
          oceanPulses: [],
          oceanCoins: [],
        };
      },
    });
  },
  beforeUnmount() {
    this.unregister?.();
    // Shell teardown / game switch mid-flight: every held tile must become
    // visible NOW (the hold set is module-level and would otherwise leak
    // into the next mounted board).
    abortRemotePlacements();
  },
});
</script>

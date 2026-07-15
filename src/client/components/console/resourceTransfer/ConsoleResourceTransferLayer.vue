<template>
  <!--
    RESOURCE TRANSFER STAGE — the fixed, app-level layer of the shared
    "receiving resources" language (consoleResourceTransfer /
    resourceTransferDirector). Mounted once in ConsoleShell; empty & free
    when nothing flies.

    Each flight is a PHYSICAL chip built from the game's REAL resource art —
    never a bespoke animation icon:
     - a standard-resource chip = the panel's own `resource_icon` sprite;
     - a PRODUCTION chip = the same sprite seated in the printed brown
       production plate (the card language — unmistakably production);
     - a card-resource chip = the round `card-resource` token sprite;
     - megacredits = the gold M€ tile with the amount printed ON it (the
       canonical M€ reading), «+N» centred.
    Every chip carries its amount — «+1» included — in a contrast-managed
    plate that reads on any resource colour at TV distance.
  -->
  <div v-if="resourceTransferState.flights.length > 0" class="con-transfer" aria-hidden="true">
    <template v-for="f in resourceTransferState.flights" :key="f.id">
      <div class="con-transfer__chip"
           :class="chipClass(f.spec)"
           :ref="(el) => setChipRef(f.id, el as HTMLElement | null)">
        <i v-if="!isMegacredits(f.spec)" class="con-transfer__icon" :class="iconClass(f.spec)"></i>
        <span class="con-transfer__amt" :class="{'con-transfer__amt--mc': isMegacredits(f.spec)}">+{{ f.spec.amount }}</span>
      </div>
      <div class="con-transfer__beat"
           :class="{'con-transfer__beat--production': f.spec.channel === 'production'}"
           :ref="(el) => setBeatRef(f.id, el as HTMLElement | null)"></div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {resourceTransferState, registerResourceTransferStage} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {TransferStagePiece} from '@/client/console/resourceTransfer/resourceTransferDirector';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';

export default defineComponent({
  name: 'ConsoleResourceTransferLayer',
  data() {
    return {
      resourceTransferState,
      unregister: undefined as (() => void) | undefined,
      chipEls: new Map<number, HTMLElement>(),
      beatEls: new Map<number, HTMLElement>(),
    };
  },
  methods: {
    isMegacredits(spec: ResourceTransferSpec): boolean {
      return spec.channel === 'stock' && spec.resource === 'megacredits';
    },
    chipClass(spec: ResourceTransferSpec): Record<string, boolean> {
      return {
        'con-transfer__chip--mc': this.isMegacredits(spec),
        'con-transfer__chip--production': spec.channel === 'production',
        'con-transfer__chip--cardres': spec.channel === 'card-resource',
      };
    },
    /** The game's ONE icon resolver — the chip shows the real resource art. */
    iconClass(spec: ResourceTransferSpec): string {
      return iconClassFor(spec.resource);
    },
    setChipRef(id: number, el: HTMLElement | null): void {
      if (el === null) {
        this.chipEls.delete(id);
      } else {
        this.chipEls.set(id, el);
      }
    },
    setBeatRef(id: number, el: HTMLElement | null): void {
      if (el === null) {
        this.beatEls.delete(id);
      } else {
        this.beatEls.set(id, el);
      }
    },
  },
  mounted() {
    this.unregister = registerResourceTransferStage({
      piece: (id: number): TransferStagePiece | undefined => {
        const chip = this.chipEls.get(id);
        if (chip === undefined || !chip.isConnected) {
          return undefined;
        }
        return {chip, beat: this.beatEls.get(id)};
      },
    });
  },
  beforeUnmount() {
    this.unregister?.();
  },
});
</script>

<template>
  <!-- THE FLEET DOCK — the ONE fleet presentation of the colony workspace.
       Always the same component, always the header's RIGHT edge (spatial
       memory), in every mode: standalone / embedded / browse / focus / build.
       Every fleet is a physical SVG ship on its OWN launch pad; an out fleet
       leaves its pad EMPTY (the slot never collapses → no reflow). The
       viewer's launching fleet lifts off its OWN pad (`data-fleet-launch`)
       toward the colony — the pad stays a stable launch anchor because this
       bar never unmounts through the focus descent. -->
  <div class="con-colonies__fleetbar" :aria-label="$t('Free trade fleets')">
    <span v-for="chip in chips" :key="chip.color"
          class="con-colonies__fleetchip"
          :class="{
            'con-colonies__fleetchip--me': chip.me,
            'con-colonies__fleetchip--none': chip.free === 0,
          }">
      <span class="con-colonies__fleetchip-name">{{ chip.name }}</span>
      <span v-if="chip.total <= 6" class="con-colonies__fleetdock"
            :class="['fleet-hue--' + chip.color, {'con-fleet-launching': launchingColor === chip.color}]"
            :aria-label="chip.free + '/' + chip.total">
        <span v-for="n in chip.total" :key="n"
              class="con-colonies__fleetberth"
              :class="{'con-colonies__fleetberth--empty': n > chip.free}">
          <!-- The ship SLOT is always laid out (even when its ship is hidden
               mid-launch) so it stays a stable launch anchor. -->
          <span class="con-colonies__fleetship"
                :data-fleet-launch="isLaunchAnchor(chip, n) ? '' : undefined">
            <ColonyFleetIcon v-if="n <= chip.free && !isLaunchingSlot(chip, n)"
                             :color="chip.color" :free="true" />
          </span>
          <ColonyFleetPad :color="chip.color" :occupied="n <= chip.free" />
        </span>
      </span>
      <b v-else class="con-colonies__fleetchip-count">
        <ColonyFleetIcon :color="chip.color" :free="chip.free > 0" />{{ chip.free }}/{{ chip.total }}
      </b>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import ColonyFleetPad from '@/client/components/colonies/ColonyFleetPad.vue';

export type ColonyFleetChip = {color: Color, name: string, free: number, total: number, me: boolean};

export default defineComponent({
  name: 'ConsoleColonyFleetBar',
  components: {ColonyFleetIcon, ColonyFleetPad},
  props: {
    /** Every player's fleet situation, the viewer first (built by the section). */
    chips: {type: Array as PropType<ReadonlyArray<ColonyFleetChip>>, required: true},
    /** The colour whose fleet is CURRENTLY lifting off ('' = none) — its
     *  launch berth hides the ship (the flight proxy carries it). */
    launchingColor: {type: String as PropType<Color | ''>, default: ''},
  },
  methods: {
    /** The viewer's LAUNCH berth — the last currently-free fleet slot. */
    isLaunchAnchor(chip: ColonyFleetChip, n: number): boolean {
      return chip.me && chip.free > 0 && n === chip.free;
    },
    /** The berth whose ship is CURRENTLY lifting off (hidden — the proxy
     *  carries it; the fixed `total` pads keep the row from reflowing). */
    isLaunchingSlot(chip: ColonyFleetChip, n: number): boolean {
      return this.launchingColor === chip.color && this.isLaunchAnchor(chip, n);
    },
  },
});
</script>

<template>
  <!--
    THE CITY'S SEAT on a colony tile (Turmoil Redux TR22 Nova City — «place a
    city ON A COLONY TILE»). ONE component, three hosts: the grid tile's head,
    the focus stage's hero, the dossier's planet zone.

    The colony tile is a PLACE, the planet an OBJECT, the city a SECOND OBJECT
    of the tile — and its seat exists BEFORE the object: this root is ALWAYS
    rendered (`data-colony-city-seat`), an empty seat being an invisible
    measurement slot exactly like the fleet's berth. So neither a projection
    nor a landed city can move anything around it.

    POSES (the controller's ONE reading — `colonyCitySeatView`):
      · empty     — nothing painted;
      · projected — a «city» door stands: the dashed hex contour, the art as a
                    ghost, a translucent cube in the viewer's colour;
      · waiting   — the door is answered, the piece is on its way: the contour
                    alone («the place waits»);
      · seated    — the board's own city art and the board's own owner cube on
                    a static contact shadow: the piece LIES on the tile.
    `--landed` / `--press` are one-shots (the contact's answer, the cube's
    press), each cleared by its own `animationend`.

    It is NOT a control: no pointer events, no cursor stop, no text, no pulse.
    The owner is named by the CUBE (a ring on the planet is the fleet's
    language). Console-safe materials only — transform / opacity / gradients.
  -->
  <span class="con-colcity"
        :class="[
          'con-colcity--' + size,
          'con-colcity--' + view.pose,
          {
            'con-colcity--landed': landed,
            'con-colcity--press': pressed,
          },
        ]"
        :data-colony-city-seat="colony.name"
        :data-colony-city-pose="view.pose"
        :data-colony-city-owner="view.color"
        aria-hidden="true">
    <!-- The static CONTACT shadow of a piece that lies here (seated only). -->
    <span v-if="view.pose === 'seated'" class="con-colcity__shadow"></span>
    <!-- The place itself: the dashed contour of a seat that is offered or awaited. It lets go AT THE CONTACT (the
         seat's answer takes over): a dashed edge may not peek from under the piece that has just touched it. -->
    <svg v-if="(view.pose === 'projected' || view.pose === 'waiting') && !landed"
         class="con-colcity__contour" viewBox="0 0 46 51" preserveAspectRatio="none" focusable="false">
      <polygon points="23,1.2 44.8,13.4 44.8,37.6 23,49.8 1.2,37.6 1.2,13.4" />
    </svg>
    <!-- The tile — the board's own city art (ghosted in the projection). -->
    <span v-if="view.pose === 'seated' || view.pose === 'projected'"
          class="con-colcity__tile board-space-tile--city"
          data-colony-city-tile
          @animationend.self="onPressEnd"></span>
    <!-- THE CUBE'S BOX — always rendered (the cube proxy measures it before the real cube stands). -->
    <span class="con-colcity__cube" data-colony-city-cube>
      <PlayerCube v-if="view.pose === 'seated' && view.cube && view.color !== undefined"
                  :color="view.color"
                  :size="cubeSize" />
      <span v-else-if="view.pose === 'projected' && view.color !== undefined"
            class="con-colcity__ghost-cube" :class="'player_translucent_bg_color_' + view.color"></span>
    </span>
    <!-- The contact's ONE answer: the place's OWN contour — the hex — washing out once. -->
    <svg v-if="landed" class="con-colcity__answer" viewBox="0 0 46 51" preserveAspectRatio="none" focusable="false"
         @animationend.self="onLandedEnd">
      <polygon points="23,1.2 44.8,13.4 44.8,37.6 23,49.8 1.2,37.6 1.2,13.4" />
    </svg>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ColonyModel} from '@/common/models/ColonyModel';
import {Color} from '@/common/Color';
import {ColonyCitySeatView, ackColonyCitySeat, colonyCitySeatView, colonyCityState} from '@/client/console/colonyCity/consoleColonyCity';
import {COLONY_CITY_CUBE_PX, ColonyCitySeatSize} from '@/client/console/colonyCity/colonyCityModel';
import PlayerCube from '@/client/components/PlayerCube.vue';

export default defineComponent({
  name: 'ConsoleColonyCitySeat',
  components: {PlayerCube},
  props: {
    /** The colony tile whose seat this is (its `tiles` say what lies on it). */
    colony: {type: Object as PropType<Pick<ColonyModel, 'name' | 'tiles'>>, required: true},
    /** The colour of the city a standing «city» door would place here ('' = no door, or not a candidate). */
    projection: {type: String as PropType<Color | ''>, default: ''},
    size: {type: String as PropType<ColonyCitySeatSize>, default: 'tile'},
  },
  computed: {
    view(): ColonyCitySeatView {
      return colonyCitySeatView(this.colony, this.projection === '' ? undefined : this.projection);
    },
    cubeSize(): number {
      return COLONY_CITY_CUBE_PX[this.size];
    },
    landed(): boolean {
      return colonyCityState.landed === this.colony.name;
    },
    pressed(): boolean {
      return colonyCityState.pressed === this.colony.name && this.view.pose === 'seated';
    },
  },
  methods: {
    onLandedEnd(): void {
      ackColonyCitySeat(this.colony.name, 'landed');
    },
    onPressEnd(): void {
      ackColonyCitySeat(this.colony.name, 'pressed');
    },
  },
});
</script>

<template>
  <div class="eg-tab eg-params">
    <p class="eg-tab__hint" v-i18n>Each step raising a global parameter is one terraform rating point. Here is who pushed the planet.</p>

    <!-- total terraforming push -->
    <section class="eg-params__total">
      <h2 class="eg-section-title" v-i18n>Total terraforming push</h2>
      <div class="eg-pbars">
        <div v-for="p in rankedByPush" :key="p.color" class="eg-pbar" :style="{'--eg-pc': hex(p.color)}">
          <span class="eg-pbar__name">
            <span class="eg-pbar__dot" :class="'player_bg_color_' + p.color"></span>{{ p.name }}
          </span>
          <span class="eg-pbar__track"><span class="eg-pbar__fill" :style="{width: pushWidth(p.parametersTotal)}"></span></span>
          <span class="eg-pbar__val">{{ p.parametersTotal }}</span>
        </div>
      </div>
    </section>

    <!-- per-parameter contribution -->
    <section v-if="model.parameters.length > 0" class="eg-params__by">
      <h2 class="eg-section-title" v-i18n>Contribution by parameter</h2>
      <div class="eg-param-grid">
        <div v-for="param in model.parameters" :key="param.key" class="eg-param-card">
          <div class="eg-param-card__head">
            <span class="eg-param-card__dot" :class="'vp-accent--' + param.accent"></span>
            <span class="eg-param-card__label" v-i18n>{{ param.label }}</span>
          </div>
          <div class="eg-pbars">
            <div v-for="p in playersFor(param)" :key="p.color" class="eg-pbar eg-pbar--sm"
                 :class="{'eg-pbar--leader': isLeader(param, p.color)}" :style="{'--eg-pc': hex(p.color)}">
              <span class="eg-pbar__name"><span class="eg-pbar__dot" :class="'player_bg_color_' + p.color"></span>{{ p.name }}</span>
              <span class="eg-pbar__track"><span class="eg-pbar__fill" :style="{width: paramWidth(param, p.color)}"></span></span>
              <span class="eg-pbar__val">{{ param.values[p.color] || 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {EndgameModel, EndgameParameter, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';

export default defineComponent({
  name: 'EndgameParametersTab',
  props: {
    model: {type: Object as () => EndgameModel, required: true},
    // Declared so the shell's shared props don't fall through (unused here).
    view: {type: Object, required: false, default: undefined},
    viewerColor: {type: String, required: false, default: undefined},
  },
  computed: {
    rankedByPush(): Array<EndgamePlayerScore> {
      return [...this.model.players].sort((a, b) => b.parametersTotal - a.parametersTotal);
    },
    maxPush(): number {
      return this.rankedByPush.reduce((m, p) => Math.max(m, p.parametersTotal), 1);
    },
  },
  methods: {
    hex(color: Color): string {
      return endgamePlayerHex(color);
    },
    pushWidth(v: number): string {
      return `${(v / this.maxPush) * 100}%`;
    },
    playersFor(param: EndgameParameter): Array<EndgamePlayerScore> {
      // Sort players by their contribution to this parameter, desc.
      return [...this.model.players].sort((a, b) => (param.values[b.color] ?? 0) - (param.values[a.color] ?? 0));
    },
    paramWidth(param: EndgameParameter, color: Color): string {
      const v = param.values[color] ?? 0;
      return param.max > 0 ? `${(v / param.max) * 100}%` : '0%';
    },
    isLeader(param: EndgameParameter, color: Color): boolean {
      return param.leaders.includes(color);
    },
  },
});
</script>

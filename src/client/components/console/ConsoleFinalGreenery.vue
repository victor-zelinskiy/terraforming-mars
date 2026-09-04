<template>
  <!--
    FINAL GREENERY — the endgame conversion beat, on its own screen.

    Deliberately NOT the optional-decision modal: that screen teaches the player
    that the quiet card at the bottom is a harmless "no thanks", and here the
    bottom card ENDS THEIR GAME. So the two choices are framed as what they
    really are — a conversion you may repeat, and a finish that is irreversible
    and takes two presses.

    The supply line does the arithmetic the player would otherwise do in their
    head at the most expensive moment of the match: plants held, what one
    greenery costs THEM (discounts included), and how many that still buys.
  -->
  <div class="con-finale con-ws" role="dialog" :aria-label="$t(HEADLINE)"
       data-motion-surface="final-greenery">
    <div class="con-finale__panel" data-motion-panel>
      <header class="con-finale__head">
        <div class="con-finale__kicker">
          <span class="con-finale__kicker-mark" aria-hidden="true">◈</span>
          <span>{{ $t(EYEBROW) }}</span>
        </div>
        <h2 class="con-finale__title">{{ $t(HEADLINE) }}</h2>
      </header>

      <!-- THE SUPPLY. Three numbers, stated once, so the decision is arithmetic
           the player can see rather than one they have to do. -->
      <div class="con-finale__supply">
        <div class="con-finale__stat">
          <span class="con-finale__stat-label">{{ $t(SUPPLY_LABEL) }}</span>
          <span class="con-finale__stat-value">
            <i class="resource_icon resource_icon--plants con-finale__stat-icon" aria-hidden="true"></i>
            <b>{{ vm.plants }}</b>
          </span>
        </div>
        <div class="con-finale__stat">
          <span class="con-finale__stat-label">{{ $t('Cost of one greenery') }}</span>
          <span class="con-finale__stat-value">
            <i class="resource_icon resource_icon--plants con-finale__stat-icon" aria-hidden="true"></i>
            <b>{{ vm.cost }}</b>
          </span>
        </div>
        <div class="con-finale__stat con-finale__stat--headline">
          <span class="con-finale__stat-label">{{ $t(AFFORDABLE_LABEL) }}</span>
          <span class="con-finale__stat-value"><b>{{ vm.affordable }}</b></span>
        </div>
      </div>

      <div class="con-finale__actions">
        <div v-for="(action, i) in vm.actions" :key="action.role"
             class="con-finale__action"
             :class="{
               'con-finale__action--focused': focusIdx === i,
               'con-finale__action--destructive': action.destructive,
               'con-finale__action--armed': focusIdx === i && armed && action.destructive,
             }">
          <div class="con-finale__action-head">
            <span class="con-finale__action-title">{{ $t(action.titleKey) }}</span>
            <span v-if="!action.destructive" class="con-finale__action-go" aria-hidden="true">›</span>
            <GamepadGlyph v-if="focusIdx === i" control="confirm" class="con-finale__action-a" />
          </div>
          <div class="con-finale__action-lead">{{ $t(action.leadKey) }}</div>
          <!-- The irreversible branch says so BEFORE it is armed, and says what
               the next press does once it is. -->
          <div v-if="action.destructive && focusIdx === i && armed" class="con-finale__action-confirm">
            {{ $t(STOP_ARMED) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The finale SCREEN. Focus, the pad contract and the emit — nothing else: what
 * a press MEANS (and in particular that ending the game needs two of them)
 * lives in the pure model, where it is guarded by tests.
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {clearPanelCommands, setPanelCommands} from '@/client/console/consolePanelUi';
import {orOptionResponse} from '@/client/console/taskResponses';
import {
  AFFORDABLE_LABEL, EYEBROW, HEADLINE, STOP_ARMED, SUPPLY_LABEL,
  FinalGreeneryViewModel,
  finalGreeneryCommandKeys, finalGreeneryFocusStep, finalGreeneryPressIntent,
} from '@/client/console/finalGreenery/finalGreeneryModel';

export default defineComponent({
  name: 'ConsoleFinalGreenery',
  components: {GamepadGlyph},
  props: {
    vm: {type: Object as PropType<FinalGreeneryViewModel>, required: true},
    /** The live prompt — the placement branch is handed to the board with it. */
    prompt: {type: Object as PropType<PlayerInputModel>, required: true},
  },
  emits: ['submit', 'defer', 'space-pick'],
  data() {
    return {
      focusIdx: 0,
      /** The destructive branch is armed: the NEXT press ends the game. */
      armed: false,
      submitting: false,
      EYEBROW, HEADLINE, SUPPLY_LABEL, AFFORDABLE_LABEL, STOP_ARMED,
    };
  },
  computed: {
    footCommands(): Array<ConsoleCommand> {
      const controls = ['dpad', 'confirm', 'back'] as const;
      return finalGreeneryCommandKeys(this.vm, this.focusIdx, this.armed).map((label, i) => ({
        control: controls[Math.min(i, controls.length - 1)],
        label,
        // The armed finish is the loudest thing on screen — never let the fit
        // engine drop the line that says what the next press does, and never
        // paint it in the mint "claimable" tone the bar uses for good news.
        priority: label === STOP_ARMED ? 0 : undefined,
        tone: label === STOP_ARMED ? 'danger' as const : undefined,
      }));
    },
  },
  watch: {
    /**
     * A fresh prompt re-arms submission — the ConsoleTaskHost contract
     * (`playerView` there; the live prompt's identity here, which changes
     * with every applied response). A `submitting` latched across a response
     * boundary is a visible surface that swallows every A — the exact defect
     * ConsoleEffectDecision shipped for chained effect decisions.
     */
    prompt() {
      this.submitting = false;
      this.armed = false;
    },
    footCommands: {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>): void {
        setPanelCommands('finalGreenery', cmds);
      },
    },
  },
  beforeUnmount() {
    clearPanelCommands('finalGreenery');
  },
  methods: {
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        const delta = intent.dir === 'down' || intent.dir === 'right' ? 1 : -1;
        this.focusIdx = finalGreeneryFocusStep(this.vm, this.focusIdx, delta);
        // Looking at the other option always disarms: an armed "end my game"
        // must never survive the player's attention moving away from it.
        this.armed = false;
        return;
      }
      const action = consoleActionOf(intent);
      if (action === 'back') {
        this.$emit('defer');
        return;
      }
      if (this.submitting) {
        return;
      }
      const press = finalGreeneryPressIntent(this.vm, this.focusIdx, action, this.armed);
      if (press === undefined) {
        return;
      }
      switch (press.kind) {
      case 'arm':
        this.armed = true;
        return;
      case 'placement':
        // The ordinary board hand-off — the same path every nested SelectSpace
        // branch uses, so placement behaves exactly as it does everywhere else.
        this.$emit('space-pick', {
          index: press.optionIndex,
          spacePrompt: (this.prompt as {options: Array<PlayerInputModel>}).options[press.optionIndex],
        });
        return;
      case 'finish':
      default:
        this.submitting = true;
        this.$emit('submit', orOptionResponse(press.optionIndex));
      }
    },
  },
});
</script>

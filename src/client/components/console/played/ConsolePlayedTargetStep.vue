<template>
  <!-- THE EMBEDDED PLAYED-TARGET STEP — a level of the Card Play Workspace,
       not a surface over it. No band geometry, no plate, no backdrop, no
       `con-ws` marker: the workspace it stands in already owns all of those,
       and the source card stays visible to its left throughout. -->
  <div class="con-ptsel" :data-mode="layout.mode">
    <!-- ── THE SELECTION CONTRACT — a stable, compact line answering «what am
         I choosing and why are these the options». The server's own ask, then
         the honest scope. Never the source card's full text. ── -->
    <header class="con-ptsel__contract" data-unfold-item>
      <div class="con-ptsel__contract-head">
        <span class="con-ptsel__contract-mark" aria-hidden="true">◈</span>
        <span class="con-ptsel__contract-title">{{ $t('Choose a played card') }}</span>
      </div>
      <div class="con-ptsel__contract-ask">{{ model.contract.ask }}</div>
      <div class="con-ptsel__contract-scope">
        <span class="con-ptsel__scope-count">{{ scopeLine }}</span>
        <!-- MULTI: the live accumulation, so «сколько ещё можно» is never a
             guess. At the cap it says so instead of silently ignoring A. -->
        <span v-if="selection.mode === 'multi'" class="con-ptsel__scope-picked"
              :class="{'con-ptsel__scope-picked--full': atCap}">{{ pickedLine }}</span>
        <span v-if="selection.mode === 'multi' && atCap" class="con-ptsel__scope-note">{{ $t('Deselect another card first') }}</span>
        <span v-else-if="model.contract.selfAllowed && model.contract.opponentsInvolved"
              class="con-ptsel__scope-note">{{ $t('Your own card or another player\'s') }}</span>
      </div>
    </header>

    <!-- ── OWNER TABS — only in tabbed mode, and only over owners that HAVE
         targets (which, by construction of the model, is all of them). ── -->
    <div v-if="layout.mode === 'tabs' && model.owners.length > 1" class="con-ptsel__tabs" data-unfold-item>
      <GamepadGlyph control="bumperL" />
      <span v-for="owner in model.owners" :key="owner.id"
            class="con-ptsel__tab"
            :class="['player_color_' + owner.color, {'con-ptsel__tab--active': owner.id === activeOwnerId}]">
        <span class="con-ptsel__tab-dot" :class="'player_bg_color_' + owner.color" aria-hidden="true"></span>
        <span class="con-ptsel__tab-name">{{ owner.name }}</span>
        <b>{{ owner.candidates.length }}</b>
      </span>
      <GamepadGlyph control="bumperR" />
    </div>

    <!-- ── OWNER GROUPS. Each owner is a SPATIAL group with its own rail and
         its own counts — candidates are never mixed into one grid with small
         badges, because whose card this is must read from where it sits. ── -->
    <div class="con-ptsel__zone">
      <section v-for="owner in visibleOwners" :key="owner.id"
               class="con-ptsel__owner"
               :class="{'con-ptsel__owner--self': owner.self, 'con-ptsel__owner--focused': owner.id === focus.ownerId}"
               data-unfold-item>
        <header class="con-ptsel__ownerbar">
          <span class="con-ptsel__ownerdot" :class="'player_bg_color_' + owner.color" aria-hidden="true"></span>
          <span class="con-ptsel__ownername" :class="'player_color_' + owner.color">{{ owner.name }}</span>
          <!-- «РАЗЫГРАНО 8 · ДОСТУПНО 2» — the familiar spatial anchor: these
               cards come from that player's table, and this is a FILTERED view
               of it, not everything they own. -->
          <span class="con-ptsel__ownercount">
            <i>{{ $t('Played') }}</i><b>{{ owner.totalPlayed }}</b>
            <span class="con-ptsel__ownercount-sep" aria-hidden="true">·</span>
            <i>{{ $t('Selectable') }}</i><b class="con-ptsel__ownercount-live">{{ owner.candidates.length }}</b>
          </span>
        </header>

        <div v-for="section in sectionsOf(owner)" :key="section.category" class="con-ptsel__section">
          <div v-if="showsRails(owner)" class="con-ptsel__catrail">
            <span class="con-ptsel__catname">{{ $t(section.label) }}</span>
            <span class="con-ptsel__catcount">{{ section.candidates.length }}</span>
          </div>
          <div class="con-ptsel__cards" :style="rowStyle">
            <div v-for="cand in section.candidates" :key="cand.cardName"
                 class="con-ptsel__slot"
                 :class="{
                   'con-ptsel__slot--focused': isFocused(owner.id, cand.cardName),
                   'con-ptsel__slot--locked': isChosen(cand.cardName),
                 }"
                 :data-zoom-slot="cand.slotKey">
              <ConsoleCardFaceLite :name="cand.cardName" />
              <span v-if="cand.model.resources !== undefined" class="con-played__res">{{ cand.model.resources }}</span>
              <span v-if="isChosen(cand.cardName)" class="con-ptsel__lock" aria-hidden="true">{{ pickOrdinal(cand.cardName) }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ── THE CONTEXTUAL STATUS RAIL — a permanent zone of the layout (never
         a tooltip, never a popover): it states what choosing the FOCUSED card
         would do, in this context, and updates on focus without changing size.
         Its height is reserved, so moving the cursor cannot move the cards. ── -->
    <footer class="con-ptsel__rail" data-unfold-item>
      <template v-if="focused !== undefined">
        <div class="con-ptsel__railhead">
          <span class="con-ptsel__railcard">{{ $t(focused.cardName) }}</span>
          <span class="con-ptsel__railsep" aria-hidden="true">·</span>
          <span class="con-ptsel__railowner" :class="'player_color_' + focusedOwnerColor">{{ focusedOwnerName }}</span>
        </div>
        <div class="con-ptsel__railbody">
          <div v-for="sec in focused.preview" :key="sec.key" class="con-ptsel__prev"
               :class="'con-ptsel__prev--' + sec.entity">
            <span class="con-ptsel__prev-title">{{ $t(sec.title) }}</span>
            <span class="con-ptsel__prev-impacts">
              <span v-for="(imp, i) in sec.impacts" :key="i" class="con-ptsel__imp">
                <i v-if="imp.icon" class="con-ptsel__imp-icon" :class="iconClass(imp.icon)" aria-hidden="true"></i>
                <span class="con-ptsel__imp-label">{{ imp.translate === false ? imp.label : $t(imp.label) }}</span>
                <b v-if="imp.from !== undefined && imp.to !== undefined" class="con-ptsel__imp-delta">
                  {{ imp.from }}<span aria-hidden="true"> → </span>{{ imp.to }}
                </b>
                <b v-else-if="imp.amount !== undefined" class="con-ptsel__imp-delta">{{ imp.amount > 0 ? '+' : '' }}{{ imp.amount }}</b>
              </span>
            </span>
            <span v-if="sec.note !== undefined" class="con-ptsel__prev-note">{{ $t(sec.note) }}</span>
          </div>
        </div>
      </template>
    </footer>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE PLAYED-TARGET STEP — the reusable embedded step for «point at a card
 * that is already on the table».
 *
 * It renders a MODEL and reports focus + selection upward; it contains no game rules
 * and no card names. Eligibility arrives from the server's own candidate set,
 * the contextual preview arrives pre-built from the host (which owns the game
 * knowledge), and the layout decision arrives from the pure planner. That is
 * what makes the same component serve Industrial Robots today, Predators next,
 * and the Blue Actions Workspace after that — the only thing a new host writes
 * is a preview builder.
 *
 * IT IS NOT A TABLEAU. Only eligible candidates render, so a thirty-card table
 * with two legal targets mounts two faces. The heavy «Разыграно» surfaces keep
 * their own architecture for their own (very different) job.
 *
 * PHYSICALITY, with the RIGHT semantics. A card chosen from hand is TAKEN; a
 * played card being targeted is NOT — it stays in its owner's tableau. So the
 * focused candidate lifts a little inside its own group and takes a ring; it
 * never leaves, never flies to the source card, and confirming locks it in
 * place rather than carrying it away.
 *
 * Control grammar (published by the host to the ONE command bar): D-pad = move
 * (crossing between owner groups in split view) · LB/RB = owner tabs (tabbed
 * view only) · A = choose · X = inspect · B = back to the play step.
 */
import {defineComponent, PropType} from 'vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateTextWithParams} from '@/client/directives/i18n';
import {
  PlayedTargetModel, PlayedTargetLayout, PlayedTargetFocus, PlayedTargetOwner,
  PlayedTargetCandidate, PlayedTargetSection, PlayedTargetSelection,
  playedTargetSections, playedTargetShowsCategoryRails, playedTargetAt,
} from '@/client/console/played/consolePlayedTargetModel';

export default defineComponent({
  name: 'ConsolePlayedTargetStep',
  components: {ConsoleCardFaceLite, GamepadGlyph},
  props: {
    model: {type: Object as PropType<PlayedTargetModel>, required: true},
    layout: {type: Object as PropType<PlayedTargetLayout>, required: true},
    focus: {type: Object as PropType<PlayedTargetFocus>, required: true},
    /**
     * HOW MANY the step asks for. `single` (A chooses and closes) or the
     * server's merged up-to-N ask (A toggles, RT confirms) — the shape follows
     * the prompt, never a per-card rule here.
     */
    selection: {type: Object as PropType<PlayedTargetSelection>, default: () => ({mode: 'single'} as PlayedTargetSelection)},
    /** The already-confirmed target of a SINGLE step (a re-entry from «Изменить
     *  выбор»); in multi the picks live in `selection.picked`. */
    lockedCard: {type: String, default: ''},
  },
  computed: {
    /** SPLIT shows every owner side by side; TABS shows the active one. */
    visibleOwners(): ReadonlyArray<PlayedTargetOwner> {
      return this.layout.mode === 'split' ?
        this.model.owners :
        this.model.owners.filter((o) => o.id === this.activeOwnerId);
    },
    activeOwnerId(): string {
      return this.focus.ownerId;
    },
    focused(): PlayedTargetCandidate | undefined {
      return playedTargetAt(this.focus, this.model.owners);
    },
    focusedOwner(): PlayedTargetOwner | undefined {
      return this.model.owners.find((o) => o.id === this.focus.ownerId);
    },
    focusedOwnerName(): string {
      return this.focusedOwner?.name ?? '';
    },
    focusedOwnerColor(): string {
      return this.focusedOwner?.color ?? 'neutral';
    },
    /** «3 доступные цели у 2 игроков» — the scope, in one honest line. */
    scopeLine(): string {
      const {targetCount, ownerCount} = this.model.contract;
      return ownerCount > 1 ?
        translateTextWithParams('${0} targets across ${1} players', [String(targetCount), String(ownerCount)]) :
        translateTextWithParams('${0} available targets', [String(targetCount)]);
    },
    rowStyle(): Record<string, string> {
      return {'--con-ptsel-per-row': String(Math.max(1, this.layout.perRow))};
    },
    /** «Выбрано 1 из 2» — the live accumulation of a multi ask. */
    pickedLine(): string {
      if (this.selection.mode !== 'multi') {
        return '';
      }
      return translateTextWithParams('Selected ${0} of ${1}',
        [String(this.selection.picked.length), String(this.selection.max)]);
    },
    atCap(): boolean {
      return this.selection.mode === 'multi' && this.selection.picked.length >= this.selection.max;
    },
  },
  methods: {
    /** Chosen = the confirmed single target, or a member of the multi pick. */
    isChosen(cardName: string): boolean {
      return this.selection.mode === 'multi' ?
        this.selection.picked.includes(cardName) :
        cardName === this.lockedCard;
    },
    /** In a multi ask the badge carries the ORDER — «первое / второе событие»
     *  is what the server's own slots mean, so the player can see which is
     *  which without reading the prompt again. A single ask just ticks. */
    pickOrdinal(cardName: string): string {
      if (this.selection.mode !== 'multi') {
        return '✓';
      }
      const at = this.selection.picked.indexOf(cardName);
      return at < 0 ? '✓' : String(at + 1);
    },
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    sectionsOf(owner: PlayedTargetOwner): ReadonlyArray<PlayedTargetSection> {
      return playedTargetSections(owner);
    },
    showsRails(owner: PlayedTargetOwner): boolean {
      return playedTargetShowsCategoryRails(playedTargetSections(owner));
    },
    isFocused(ownerId: string, cardName: string): boolean {
      return this.focus.ownerId === ownerId && this.focused?.cardName === cardName;
    },
  },
});
</script>

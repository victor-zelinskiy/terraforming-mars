<template>
  <!--
    One premium cost/gain chip for an action's preview: an icon + a
    `current → resulting` readout (or a signed amount when there's no single pool
    to track). Colour conveys direction — amber for a cost, mint for a gain — so
    the player reads "what changes, and to what value" at a glance, BEFORE they
    confirm. Used in the action confirmation modal (branch options + summary).
  -->
  <span class="action-effect-chip"
        :class="['action-effect-chip--' + effect.direction, {
          'action-effect-chip--insufficient': shortfall,
          'action-effect-chip--noeffect': noEffect,
          'action-effect-chip--steady': vpSteady,
          'action-effect-chip--skipped': skipped,
          'action-effect-chip--danger': danger && !shortfall,
          'action-effect-chip--bare': iconClass === '' && !isVictoryPoints,
          'action-effect-chip--timeline': moves !== undefined,
          'action-effect-chip--implied': effect.implied === true,
          'action-effect-chip--diverted': diverted || vetoed,
          'action-effect-chip--diverted-lost': diverted && effect.diverted?.lost === true,
          'action-effect-chip--vetoed': vetoed,
          'premium-tooltip': vetoed,
        }]"
        :data-diverted="diverted ? effect.diverted?.data : undefined"
        :data-vetoed="vetoed ? effect.vetoed?.steps : undefined"
        :data-hint="vetoed ? vetoedHint : undefined">
    <!-- The icon is ALWAYS a real sprite (including `tr` → tr.png and `cards` →
         card.png, via iconClassFor) — never a drawn glyph, so it matches the game art.
         A few effects have NO honest single sprite (the Ares penalty lets the player
         pick WHICH production to lose); those drop the box rather than reserve an
         empty 22px hole. -->
    <!-- VICTORY POINTS carry their identity as TYPE, not art: the game draws them
         as the card's own printed badge, and there is no inline sprite for them
         (the colony trade panel already answers TR the same way). The badge is
         not decoration — it must survive `noEffect`, which REPLACES the note, or
         a capped reading renders as a bare «1 → 1 · нет эффекта» with no word
         about WHAT did not change. -->
    <span v-if="isVictoryPoints" class="action-effect-chip__vp" v-i18n>VP</span>
    <!-- A PRODUCTION reads in the face's own print (2026-10-25 — the owner's «производство» running out of its tile):
         the resource on the riveted bronze plate every card prints, never the resource plus a word. A pool the server
         leaves open («lower ANY production») is the printed «?» on the same plate. The plate IS the pool — the note's
         word goes (it answered «which pool» and the plate answers it in the game's own language). -->
    <span v-else-if="productionPlate" class="action-effect-chip__prod" data-chip-prod :data-chip-prod-icon="wildProduction ? 'wild' : effect.icon" aria-hidden="true">
      <img v-if="wildProduction" class="action-effect-chip__icon action-effect-chip__icon--wild" :src="wildUrl" alt="" draggable="false" />
      <span v-else class="action-effect-chip__icon" :class="iconClass"></span>
    </span>
    <!-- ONE unit of one of SEVERAL kinds (TRP8: «1 mech OR fighter to a card» — `effect.icons`): every kind's sprite in
         one chip, joined by «/». One unit lands, so the kinds share one amount — never two chips that read as a sum. -->
    <span v-else-if="kindIcons.length > 1" class="action-effect-chip__kinds" data-chip-kinds aria-hidden="true">
      <template v-for="(cls, i) in kindIcons" :key="i">
        <span v-if="i > 0" class="action-effect-chip__kinds-sep">/</span>
        <span class="action-effect-chip__icon" :class="cls"></span>
      </template>
    </span>
    <span v-else-if="iconClass !== ''" class="action-effect-chip__icon" :class="iconClass" aria-hidden="true"></span>

    <span class="action-effect-chip__value">
      <!-- Unaffordable cost → "have / need" so the shortfall is explicit. -->
      <template v-if="shortfall">
        <span class="action-effect-chip__cur">{{ effect.current }}</span>
        <span class="action-effect-chip__sep" aria-hidden="true">/</span>
        <span class="action-effect-chip__need">{{ effect.amount }}{{ unit }}</span>
      </template>
      <template v-else-if="hasDelta">
        <span class="action-effect-chip__cur">{{ effect.current }}{{ unit }}</span>
        <span class="action-effect-chip__arrow" aria-hidden="true">→</span>
        <span class="action-effect-chip__res">{{ effect.resulting }}{{ unit }}</span>
      </template>
      <span v-else class="action-effect-chip__amount">{{ sign }}{{ effect.amount }}{{ unit }}</span>
    </span>

    <!-- A TIMELINE on one pool (TR28: «+1 here, then −2 here») — the pool's start and end above, its MOVEMENTS
         here, in order, each in its own direction's colour: two movements read as two, never as a bare net. -->
    <span v-if="moves !== undefined" class="action-effect-chip__moves">
      <span v-for="(m, i) in moves" :key="i" class="action-effect-chip__move"
            :class="m < 0 ? 'action-effect-chip__move--out' : 'action-effect-chip__move--in'">{{ m < 0 ? '−' : '+' }}{{ Math.abs(m) }}</span>
    </span>

    <!-- The note and "no effect" are BOTH shown: they answer different
         questions (WHICH pool this touches vs whether it moves). The note used
         to be replaced, which made a zero PRODUCTION chip indistinguishable
         from a zero STOCK chip of the same resource — the same hazard the VP
         badge above is spelled out for. -->
    <!-- A note with PARAMS is a sentence about this chip's number (TR42: «2 набора по 5 РТ сверх 20» on the
         Agenda chip — why the walk is this long); a plain note is vocabulary («на эту карту»). -->
    <span v-if="effect.note && !productionPlate" class="action-effect-chip__note" :class="{'action-effect-chip__note--sentence': effect.noteParams !== undefined}" v-i18n="effect.noteParams">{{ effect.note }}</span>
    <span v-if="noEffect" class="action-effect-chip__note action-effect-chip__note--noeffect" v-i18n>no effect</span>
    <!-- A UNIT A LAW REPLACES (Turmoil Redux RX35 — `effect.diverted`): the printed value stays, STRUCK in the Reds'
         own red (never a grey «disabled»), and the tail says what it becomes — «→ +N [data]» on one of the player's
         cards, or the loss when none can take it. The law is named in the hint; the state reads by weight and the
         strike, never by colour alone. -->
    <span v-if="diverted" class="action-effect-chip__diverted premium-tooltip" :data-hint="divertedHint" data-chip-diverted>
      <span class="action-effect-chip__diverted-arrow" aria-hidden="true">→</span>
      <span class="action-effect-chip__diverted-amount">+{{ effect.diverted?.data }}</span>
      <span class="action-effect-chip__icon action-effect-chip__diverted-icon" :class="divertedIconClass" aria-hidden="true"></span>
      <span v-if="effect.diverted?.lost === true" class="action-effect-chip__note action-effect-chip__note--sentence action-effect-chip__diverted-lost" v-i18n>no card can hold it</span>
    </span>
    <!-- A VP reading short of the next threshold: the resource still lands — a neutral fact, never «no effect». The
         server's note says how many more buy the point; a reading without one still names itself. -->
    <span v-else-if="vpSteady && !effect.note" class="action-effect-chip__note action-effect-chip__note--sentence" data-chip-vp-steady v-i18n>VP unchanged</span>

    <!-- A FILTERED DRAW's RULE (PL-021) — «+3 взять | без меток [P̸][M̸][A̸]»: the
         server's search descriptor, behind its own hairline like the basis.
         The SAME rendering the reveal's summary and the discard viewer use. -->
    <span v-if="effect.search !== undefined" class="action-effect-chip__search">
      <ConsoleDrawSearchRule :search="effect.search" />
    </span>

    <!-- A DRAW THAT KEEPS FEWER THAN IT TURNS OVER (TR46 — «X cards from the
         deck, take 1, discard the rest»): the chip's amount is what lands in the
         hand; this segment names how many leave the deck and how many go to the
         discard pile — the rest's fate is said before the press. -->
    <span v-if="effect.look !== undefined" class="action-effect-chip__note action-effect-chip__note--sentence action-effect-chip__look" data-chip-look
          v-i18n="[String(effect.look.revealed), String(effect.look.revealed - effect.look.keep)]">of ${0} turned over · ${1} to the discard</span>

    <!-- Variable-amount BASIS — "why is it this much": the live count of each
         counted entity (e.g. Cities on Mars: 3). It comes LAST, behind its own
         hairline: the chip states the change first and the reason after, so the
         count never lands in the middle of the reading («0 → 0 производство ·
         без эффекта | Метки соперников: 0»). It is also what makes a ZERO
         legible rather than baffling — the answer to the question a bare 0 asks. -->
    <span v-if="basisTerms.length > 0 && !basisInStrip" class="action-effect-chip__basis">
      <span v-for="(b, i) in basisTerms" :key="i" class="action-effect-chip__basis-term">
        <span class="action-effect-chip__basis-label" v-i18n>{{ b.label }}</span>
        <!-- The counted TAG as its own icon: one label per SCOPE instead of one
             per tag, and no translation can get the tag's name wrong. -->
        <span v-if="b.tag !== undefined" class="resource-tag action-effect-chip__basis-tag"
              :class="'tag-' + b.tag" aria-hidden="true"></span>
        <span class="action-effect-chip__basis-sep" aria-hidden="true">:</span>
        <span class="action-effect-chip__basis-count">{{ b.count }}</span>
      </span>
    </span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ActionEffect, ActionEffectBasis} from '@/common/models/ActionPreviewModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {wildIconUrl} from '@/client/components/premiumCard/premiumCardIcons';
import {divertedChip, gainHasNoEffect, vetoedChip, victoryPointsSteady} from '@/client/components/actions/actionEffectReading';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {translateTextWithParams} from '@/client/directives/i18n';
import ConsoleDrawSearchRule from '@/client/components/console/foundation/ConsoleDrawSearchRule.vue';

export default defineComponent({
  name: 'ActionEffectChip',
  components: {ConsoleDrawSearchRule},
  props: {
    effect: {
      type: Object as PropType<ActionEffect>,
      required: true,
    },
    // This chip describes an effect that will NOT happen (no valid target) — it is
    // shown INSIDE a warning block purely to name the magnitude that is lost. Muted
    // + struck through so it can never be misread as something that applies.
    skipped: {
      type: Boolean,
      default: false,
    },
    // The hosting row is DANGER-severity (a forced, unavoidable loss). The chip
    // takes the row's red so the two read as one statement — an amber "cost" chip
    // under a red title read as a second, milder fact.
    danger: {
      type: Boolean,
      default: false,
    },
    // The pool's MOVEMENTS, in order (signed) — the chip reads a timeline on one pool rather than one change.
    moves: {
      type: Array as PropType<ReadonlyArray<number>>,
      default: undefined,
    },
    // The chip's basis is READ by a «ПОЧЕМУ» strip beside it (TR45 — a counted play's composition): the chip states the
    // change and the strip says why, so the pill would say the same count twice. The data is untouched.
    basisInStrip: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    iconClass(): string {
      return iconClassFor(this.effect.icon);
    },
    /** The sprites of a unit of one of SEVERAL kinds (`effect.icons`), in the declared order; [] for the one-icon chip. */
    kindIcons(): ReadonlyArray<string> {
      return (this.effect.icons ?? []).map((icon) => iconClassFor(icon)).filter((cls) => cls !== '');
    },
    /** A production change (the server's `note: 'production'`) — drawn on the printed bronze plate. */
    productionPlate(): boolean {
      return this.effect.note === 'production' && this.effect.icon !== 'vp';
    },
    /** «ANY production» — the server names no single pool (`resources`), or nothing the sprite set can draw. */
    wildProduction(): boolean {
      return this.productionPlate && (this.effect.icon === 'resources' || this.effect.icon === 'production' || this.iconClass === '');
    },
    wildUrl(): string {
      return wildIconUrl();
    },
    /** The unit is REPLACED by a standing law (RX35): struck, with the data it becomes beside it. */
    diverted(): boolean {
      return divertedChip(this.effect);
    },
    /**
     * The RATING is REFUSED by a standing law (RX42 UNMI Veto — the seat is first by terraform rating): struck in the
     * same register as a replaced unit, NO tail (nothing stands in its place), the law and the steps in the hint.
     */
    vetoed(): boolean {
      return vetoedChip(this.effect);
    },
    vetoedHint(): string {
      const mark = this.effect.vetoed;
      if (mark === undefined) {
        return '';
      }
      const law = getResolution(mark.resolution)?.text.name ?? mark.resolution;
      return translateTextWithParams('Vetoed by ${0}: your terraform rating is the highest — ${1} TR not gained', [translateTextWithParams(law, []), String(mark.steps)]);
    },
    /** The hint names the LAW (the manifest's own name, never the catalog id) and the data. */
    divertedHint(): string {
      const mark = this.effect.diverted;
      if (mark === undefined) {
        return '';
      }
      const law = getResolution(mark.resolution)?.text.name ?? mark.resolution;
      return translateTextWithParams(mark.lost === true ?
        'Replaced by ${0}: ${1} data — no card of yours can hold it' :
        'Replaced by ${0}: ${1} data on one of your cards', [translateTextWithParams(law, []), String(mark.data)]);
    },
    /** The data sprite of the struck chip's tail — what the replaced unit becomes. */
    divertedIconClass(): string {
      return iconClassFor('data');
    },
    /** A VP reading — rendered as a typographic badge, never a sprite. */
    isVictoryPoints(): boolean {
      return this.effect.icon === 'vp';
    },
    basisTerms(): ReadonlyArray<ActionEffectBasis> {
      return this.effect.basis ?? [];
    },
    hasDelta(): boolean {
      return this.effect.current !== undefined && this.effect.resulting !== undefined;
    },
    // An unaffordable cost (you have fewer than the amount required) — shown as
    // "have / need" in an insufficient (red) style. Only ever true on a branch
    // the server already marked unavailable.
    // A pool that may legally go NEGATIVE (M€ production) carries its unclamped
    // `resulting` — the builder's own statement that the move is legal — so
    // «0 → −1» is not a shortfall; a clamped `resulting` (or none) still is.
    shortfall(): boolean {
      return this.moves === undefined && this.effect.direction === 'cost' &&
        this.effect.current !== undefined &&
        this.effect.current < this.effect.amount &&
        this.effect.resulting !== this.effect.current - this.effect.amount;
    },
    // A gain that changes nothing — because the pool is already capped (raising a
    // maxed global parameter) or because the amount itself counted to zero (a
    // "per X" reward on a board with no X). Shown muted with a "no effect" note.
    // The POOL-LESS form ("+N to a card", "draw N") has no `current` to compare,
    // so a zero amount is the only signal it has. A VP reading is never «no
    // effect» (`actionEffectReading.ts`): the resource still lands.
    noEffect(): boolean {
      return this.moves === undefined && gainHasNoEffect(this.effect);
    },
    // A VP reading short of the next threshold — the neutral register.
    vpSteady(): boolean {
      return this.moves === undefined && victoryPointsSteady(this.effect);
    },
    unit(): string {
      return this.effect.unit ?? '';
    },
    sign(): string {
      return this.effect.direction === 'cost' ? '−' : '+';
    },
  },
});
</script>

<style scoped lang="less">
.action-effect-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 6px;
  border-radius: 999px;
  border: 1px solid var(--chip-rim);
  background: var(--chip-bg);
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;

  --chip-rim: rgba(120, 200, 255, 0.28);
  --chip-bg: rgba(22, 44, 64, 0.55);
  --chip-accent: #bfe6ff;

  &--gain {
    --chip-rim: rgba(110, 235, 180, 0.45);
    --chip-bg: rgba(20, 54, 44, 0.5);
    --chip-accent: #8ff0c4;
  }
  &--cost {
    --chip-rim: rgba(255, 196, 120, 0.5);
    --chip-bg: rgba(58, 42, 22, 0.5);
    --chip-accent: #ffce92;
  }
  // Unaffordable cost — a stronger red so the shortfall reads as a blocker.
  &--insufficient {
    --chip-rim: rgba(255, 120, 110, 0.6);
    --chip-bg: rgba(62, 26, 24, 0.55);
    --chip-accent: #ff9f96;
  }
  // A FORCED loss the player cannot plan around (the Ares hazard-adjacency
  // production penalty). Same red as the unaffordable case — it is blocker-grade
  // news, and its row title is already red.
  &--danger {
    --chip-rim: rgba(255, 120, 110, 0.6);
    --chip-bg: rgba(62, 26, 24, 0.55);
    --chip-accent: #ff9f96;
  }
  // A TIMELINE on one pool: neither a gain nor a cost as a whole — the neutral rim; its moves carry the colours.
  &--timeline {
    --chip-rim: rgba(120, 200, 255, 0.42);
    --chip-bg: rgba(22, 44, 64, 0.55);
    --chip-accent: #bfe6ff;
  }
  // No sprite → no reserved icon box, so the pill stays symmetric.
  &--bare {
    padding-left: 10px;
  }
  // A chip that RESTATES a step another chip of the row already pays — a scale step's own TR drawn after the scale
  // (PL-147): the quiet voice. Same chassis and baseline, a dimmer rim and glass, so the eye reads the scale first and
  // the rating as its consequence — never as a second thing the card adds.
  &--implied {
    --chip-rim: rgba(110, 235, 180, 0.24);
    --chip-bg: rgba(20, 54, 44, 0.3);
    --chip-accent: #9fdcc0;
  }
  // A VP reading that waits for the next threshold (VP 2 → 2): NEUTRAL steel — neither the mint of a gain (nothing
  // is scored yet) nor the muted «no effect» (the resource still lands). Its note says how many more buy the point.
  &--steady {
    --chip-rim: rgba(190, 210, 230, 0.36);
    --chip-bg: rgba(26, 36, 48, 0.55);
    --chip-accent: #dfe7f0;
  }
  // A UNIT A LAW REPLACES (RX35): the chip keeps its own gain glass — data still lands — but the printed VALUE is
  // struck in the Reds' red (the party's own emblem language, never a grey «disabled»), and the tail carries the
  // data. The state survives desaturation by the strike and the tail's weight, never by the red alone.
  &--diverted {
    --chip-rim: rgba(255, 128, 118, 0.55);
    --chip-bg: rgba(52, 26, 30, 0.5);

    .action-effect-chip__value {
      text-decoration: line-through;
      text-decoration-thickness: 2px;
      text-decoration-color: rgba(255, 96, 84, 0.95);
      opacity: 0.78;
    }
  }
  // …and when no card can take the data: the tail reads the loss, the tail's data is struck too.
  &--diverted-lost {
    .action-effect-chip__diverted-amount {
      text-decoration: line-through;
      text-decoration-color: rgba(255, 96, 84, 0.95);
    }
  }
  // No-op gain (capped at max) — muted, so it reads as "this won't do anything".
  &--noeffect {
    opacity: 0.62;
    filter: saturate(0.55);
  }
  // A SKIPPED effect (shown inside a warning): amber rim to match the warning
  // block, desaturated, and the value struck through — it names what is lost, so
  // it must never read as an applied change.
  &--skipped {
    --chip-rim: rgba(240, 184, 106, 0.5);
    --chip-bg: rgba(58, 42, 22, 0.42);
    --chip-accent: #f4d3a6;
    filter: saturate(0.7);

    .action-effect-chip__value {
      text-decoration: line-through;
      text-decoration-thickness: 1px;
      text-decoration-color: rgba(240, 184, 106, 0.75);
    }
  }
}

.action-effect-chip__icon {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  /* Normalise the three sprite families to a single box (mirrors
     .modal-input__option-icon) so resource / param / card-resource icons align. */
  transform: scale(1);
}

// SEVERAL KINDS of one unit («[mech] / [fighter]») — the sprites side by side at the chip's own icon size, the slash
// in the chip's muted text voice: one reading, one amount after it.
.action-effect-chip__kinds {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
}
.action-effect-chip__kinds-sep {
  opacity: 0.7;
  font-weight: 600;
}

// THE PRODUCTION PLATE — the face's own riveted bronze frame (`.pcard-prod`, the palette's hero plate), the resource
// inside it a step smaller: «[▣ M€] 5 → 7» reads «M€ production 5 → 7» in the card's print, with no word to run out of
// the box. The «?» of «any production» sits on the same plate.
.action-effect-chip__prod {
  position: relative;
  flex: 0 0 auto;
  display: inline-flex;
  isolation: isolate;
  /* The PLATE IS A BACKING, never a box: the chip's line is laid out by the ICON (whatever size the host gives it), so
     a chip with a plate is exactly as tall as its neighbours; the plate paints behind it and the resource sits a step
     smaller on it (a transform — no layout). */
  &::before {
    content: '';
    position: absolute;
    inset: -1px;
    z-index: -1;
    border-radius: 4px;
    background:
      radial-gradient(circle at 3px 3px, rgba(255, 235, 200, 0.5) 0 0.8px, transparent 1.2px),
      radial-gradient(circle at calc(100% - 3px) 3px, rgba(255, 235, 200, 0.5) 0 0.8px, transparent 1.2px),
      radial-gradient(circle at 3px calc(100% - 3px), rgba(255, 235, 200, 0.5) 0 0.8px, transparent 1.2px),
      radial-gradient(circle at calc(100% - 3px) calc(100% - 3px), rgba(255, 235, 200, 0.5) 0 0.8px, transparent 1.2px),
      linear-gradient(180deg, #7c5c3b 0%, #5d4128 55%, #47301c 100%);
    box-shadow:
      inset 0 0 0 1px #2e1e10,
      inset 0 1px 0 rgba(255, 235, 200, 0.28),
      inset 0 -2px 3px rgba(20, 12, 5, 0.55);
  }
  > .action-effect-chip__icon { transform: scale(0.74); }
  > .action-effect-chip__icon--wild { object-fit: contain; }
}

// The REPLACEMENT tail («→ +N [data]») — the chip's brightest voice: the data is what the player gets.
.action-effect-chip__diverted {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 2px;
  padding-left: 6px;
  border-left: 1px solid rgba(255, 128, 118, 0.35);
  color: #ffd0c8;
  font-weight: 700;
}
.action-effect-chip__diverted-arrow {
  opacity: 0.75;
}
.action-effect-chip__diverted-icon {
  width: 20px;
  height: 20px;
}
.action-effect-chip__diverted-lost {
  font-weight: 500;
  color: #f4d3a6;
}

// The VP identity as type rather than art (see the template note). Sized to the
// icon box so a row mixing sprite chips and this one keeps ONE baseline, and
// tinted from the chip's own accent so gain / no-effect / skipped all carry it
// without a second colour rule.
.action-effect-chip__vp {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  border-radius: 6px;
  border: 1px solid var(--chip-rim);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--chip-accent);
}

.action-effect-chip__value {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.action-effect-chip__cur { color: rgba(220, 236, 247, 0.72); }
.action-effect-chip__arrow { color: var(--chip-accent); font-weight: 700; }
.action-effect-chip__res { color: var(--chip-accent); }
.action-effect-chip__amount { color: var(--chip-accent); }
.action-effect-chip__sep { color: rgba(220, 236, 247, 0.5); font-weight: 700; }
.action-effect-chip__need { color: var(--chip-accent); }

.action-effect-chip__moves {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding-left: 6px;
  border-left: 1px solid var(--chip-rim);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 12px;
}
.action-effect-chip__move--in { color: #8ff0c4; }
.action-effect-chip__move--out { color: #ffce92; }

.action-effect-chip__note {
  font-size: 10.5px;
  letter-spacing: 0.02em;
  text-transform: lowercase;
  color: rgba(180, 210, 230, 0.6);
}
/* A SENTENCE about the chip's number (TR42: «2 набора по 5 РТ сверх 20») keeps its own case — lowercasing it
   printed «рт», and an abbreviation is not vocabulary. */
.action-effect-chip__note--sentence {
  text-transform: none;
}

/* Variable-amount basis ("Cities on Mars: 3") — a quiet pill inside the chip,
   set off by a hairline so it reads as the reason for the amount. Several terms
   («Cities: 2 · Colonies: 1») share the one pill, separated by a middle dot. */
.action-effect-chip__basis {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding-left: 7px;
  margin-left: 1px;
  border-left: 1px solid var(--chip-rim);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  color: rgba(200, 224, 240, 0.66);
}
.action-effect-chip__basis-term {
  display: inline-flex;
  align-items: center;
  gap: 3px;

  & + & {
    padding-left: 5px;
    &::before {
      content: '·';
      padding-right: 4px;
      opacity: 0.55;
    }
  }
}
.action-effect-chip__basis-label { letter-spacing: 0.01em; }
/* The counted tag, sized down to the basis line — the global `.resource-tag`
   is a 30px card badge with a card-face margin, neither of which belongs here. */
.action-effect-chip__basis-tag {
  width: 14px;
  height: 14px;
  background-size: 16px 16px;
  background-position: -1px -1px;
  line-height: 12px;
  margin-bottom: 0;
  box-shadow: none;
  vertical-align: middle;
}
.action-effect-chip__basis-sep { margin: 0 1px; opacity: 0.6; }
/* The search rule — set off by the same hairline as the basis: the chip states
   the draw first, then WHAT the deck is searched for. */
.action-effect-chip__search {
  display: inline-flex;
  align-items: center;
  padding-left: 7px;
  margin-left: 1px;
  border-left: 1px solid var(--chip-rim);
  font-size: 10.5px;
  color: rgba(200, 224, 240, 0.66);
}
/* The look — a NOTE sentence (so every host's note scale reaches it — a px size of its own read as a speck on the TV
   hero), behind the same hairline as the basis: the draw first, then how many it turned over. */
.action-effect-chip__look {
  display: inline-flex;
  align-items: center;
  padding-left: 7px;
  margin-left: 1px;
  border-left: 1px solid var(--chip-rim);
  font-variant-numeric: tabular-nums;
  color: rgba(200, 224, 240, 0.78);
}
.action-effect-chip__basis-count {
  font-weight: 700;
  color: var(--chip-accent);
}
/* "no effect" sits AFTER the pool note, so it needs its own quieter voice —
   the note says WHAT this touches, this says that it does not move. */
.action-effect-chip__note--noeffect {
  font-style: italic;
  opacity: 0.85;
}
</style>

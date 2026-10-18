<template>
  <div class="pcard__reqs" :class="reqClass">
    <!-- the copper SURFACE = the whole symmetric banner (no dark end caps); the
         formula lives here, centred on the clean copper. -->
    <div class="pcard__reqs-field">
      <template v-for="(req, i) in requirements" :key="i">
        <span v-if="i > 0" class="pcard-req__sep" aria-hidden="true"></span>
        <span class="pcard-req" :class="segmentClass(req)" :data-req-state="stateOf(req)">
          <!-- binary requirement (party / chairman / plants-removed): icon-only
               with an optional «minus» overlay — a Redux party by its EMBLEM,
               a party with no emblem (classic Turmoil) by a text label. -->
          <template v-if="req.isBinary">
            <span v-if="req.negation" class="pcard-req__minus" aria-hidden="true">−</span>
            <span v-if="req.iconUrl !== undefined" class="pcard-req__socket" :class="socketClass(req)"
                  :data-req-party="req.party">
              <span class="pcard-req__icon" :class="iconClass(req)" :style="iconStyle(req)"></span>
            </span>
            <span v-else class="pcard-req__label">{{ binaryLabel(req) }}</span>
            <!-- MET THROUGH AN ALLIANCE (TR62): the printed party stays in its socket; the seal beside it is the
                 PARTNER's emblem with the link sign — who stands for this party. -->
            <span v-if="stateOf(req) === 'allied'" class="pcard-req__mod pcard-req__mod--marks pcard-req__mod--ally" data-req-mod
                  :data-req-mod-via="req.easing?.via">
              <PremiumModifierMarks :sources="req.easing?.sources ?? []" />
            </span>
          </template>
          <!-- formula requirement: [icon] [≥/≤] [value][suffix] — one expression -->
          <template v-else>
            <span v-if="req.iconUrl !== undefined" class="pcard-req__socket" :class="socketClass(req)">
              <span class="pcard-req__icon" :class="iconClass(req)" :style="iconStyle(req)"></span>
            </span>
            <span v-else class="pcard-req__label">{{ formulaLabel(req) }}</span>
            <!-- a PLAIN requirement («GEN 4+») prints its floor as «N+», never the ≥ glyph -->
            <PremiumRequirementOperator v-if="!(req.plain && req.comparator === 'min')" :comparator="req.comparator" />
            <!-- the PRINTED value always stays (the player sees what the modifier bends);
                 under a SHIFT it steps back and the effective bound follows a chevron -->
            <span class="pcard-req__value" :class="{'pcard-req__value--printed': isShifted(req)}">{{ valueText(req.value)
              }}<span v-if="req.suffix && !isShifted(req)" class="pcard-req__suffix">{{ req.suffix }}</span></span>
            <template v-if="isShifted(req)">
              <span class="pcard-req__shift" aria-hidden="true"></span>
              <span class="pcard-req__value pcard-req__value--effective" data-req-effective>{{ effectiveText(req)
                }}<span v-if="req.suffix" class="pcard-req__suffix">{{ req.suffix }}</span></span>
              <!-- THE MODIFIER SEAL: what bends it (one mark per source — a card on the table, the one-play bolt, a
                   policy) and the TOTAL bend; the bound before it is already the FINAL one. A crowded plate keeps the
                   marks and drops the number. -->
              <span class="pcard-req__mod" :class="{'pcard-req__mod--marks': !showsModBadge(req)}" data-req-mod
                    :data-req-mod-steps="req.easing?.steps">
                <PremiumModifierMarks :sources="req.easing?.sources ?? []" />
                <span v-if="showsModBadge(req)" class="pcard-req__mod-steps">±{{ req.easing?.steps }}</span>
              </span>
            </template>
            <!-- LIFTED: the struck value stays readable, and the seal names who lifted it. -->
            <span v-else-if="stateOf(req) === 'waived'" class="pcard-req__mod pcard-req__mod--marks" data-req-mod>
              <PremiumModifierMarks :sources="req.easing?.sources ?? []" />
            </span>
          </template>
          <!-- MET ONLY THANKS TO the modifier — the state is a FORM (a check), never colour alone -->
          <span v-if="req.easing?.decisive === true" class="pcard-req__verdict" data-req-decisive aria-hidden="true"></span>
        </span>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {RequirementType} from '@/common/cards/RequirementType';
import {translateText} from '@/client/directives/i18n';
import {NormalizedRequirement} from './premiumCardViewModel';
import PremiumRequirementOperator from './PremiumRequirementOperator.vue';
import PremiumModifierMarks from './PremiumModifierMarks.vue';
import {tagIconStyle} from './premiumCardIcons';

/**
 * The requirements PLATE — ONE clean, flat copper banner that is part of the
 * card's graphic design, NOT a raised brown button with black end caps. There
 * is NO dark gunmetal housing and NO machined brackets: the whole silhouette is
 * the copper SURFACE (`.pcard__reqs-field`), wrapped by a single thin bronze RIM
 * (the parent `.pcard__reqs`, which ties it to the card's gold frame). The two
 * layers share ONE symmetric POINTED-banner clip-path (`--pcard-req-clip` in the
 * LESS), so the rim wraps every edge — the left and right ends are IDENTICAL.
 * Its width is a fixed proportion of the card (`--multi` → `--dense`), so the
 * zone reads identically across cards and separates the header from the art.
 * The fullscreen info-tether targets the whole `.pcard__reqs` rect, so there is
 * no visible anchor and the plate stays fully symmetric.
 *
 * Each requirement is a SEGMENT reading «[icon] ≥ 6» as ONE expression: the icon
 * lies DIRECTLY on the copper (a whisper of contact shade, no button socket),
 * the value is bold + tabular, and the comparator is a bespoke SVG glyph
 * (`PremiumRequirementOperator`) tuned to the digit's weight — a connector, not
 * a gold emblem. Symbols only (≥/≤), never the legacy «от / до» words. Multiple
 * requirements are split by ONE slim illuminated divider. Binary requirements
 * (party / chairman / plants-removed) draw icon-only. The «{all}» variant
 * re-enamels the SAME plate (field + rim) to crimson-copper AND adds a crimson
 * inner kant (a STRUCTURAL cue), sharing `--pcard-any` with the fullscreen «any
 * player» rule highlight.
 */
export default defineComponent({
  name: 'PremiumRequirementsBar',
  components: {PremiumRequirementOperator, PremiumModifierMarks},
  props: {
    requirements: {
      type: Array as () => ReadonlyArray<NormalizedRequirement>,
      required: true,
    },
  },
  computed: {
    hasAll(): boolean {
      return this.requirements.some((r) => r.all);
    },
    /** Width/density variant — the cassette stays a STABLE wide zone; the width
     *  scales in controlled steps with the requirement count (single → multi →
     *  dense), never auto-shrinking to the content. */
    reqClass(): Record<string, boolean> {
      const n = this.requirements.length;
      return {
        'pcard__reqs--all': this.hasAll,
        'pcard__reqs--multi': n > 1,
        'pcard__reqs--dense': n > 2,
        'pcard__reqs--eased': this.requirements.some((r) => r.easing !== undefined && !r.easing.quiet),
        'pcard__reqs--waived': this.requirements.some((r) => r.easing?.effective === 'waived'),
        'pcard__reqs--allied': this.requirements.some((r) => r.easing?.effective === 'allied' && !r.easing.quiet),
        'pcard__reqs--decisive': this.requirements.some((r) => r.easing?.decisive === true),
      };
    },
  },
  methods: {
    /** The requirement's state under the viewer's modifiers — printed / eased / waived (TR49 class). */
    /**
     * The requirement's state under the viewer's modifiers — printed / eased / waived (TR49 class), or QUIET: met anyway
     * under a shift, drawn exactly as printed (a standing ±2 would otherwise mark every card it does not decide).
     */
    stateOf(req: NormalizedRequirement): 'printed' | 'eased' | 'waived' | 'allied' | 'quiet' {
      if (req.easing === undefined) {
        return 'printed';
      }
      if (req.easing.effective === 'waived') {
        return 'waived';
      }
      if (req.easing.quiet) {
        return 'quiet';
      }
      // TR62: a party requirement met THROUGH the alliance's partner — the printed party stands, the seal names who.
      return req.easing.effective === 'allied' ? 'allied' : 'eased';
    },
    isShifted(req: NormalizedRequirement): boolean {
      return this.stateOf(req) === 'eased';
    },
    segmentClass(req: NormalizedRequirement): Record<string, boolean> {
      const state = this.stateOf(req);
      return {
        'pcard-req--binary': req.isBinary,
        'pcard-req--eased': state === 'eased',
        'pcard-req--waived': state === 'waived',
        'pcard-req--allied': state === 'allied',
        'pcard-req--decisive': req.easing?.decisive === true,
      };
    },
    effectiveText(req: NormalizedRequirement): string {
      const effective = req.easing?.effective;
      return typeof effective === 'number' ? this.valueText(effective) : '';
    },
    /** A bound as the plate prints it — a negative one with the typographic minus (wide enough to survive a stroke). */
    valueText(value: number): string {
      return value < 0 ? `−${Math.abs(value)}` : String(value);
    },
    /** The «±N» badge only where a lone requirement leaves the plate room for it. */
    showsModBadge(req: NormalizedRequirement): boolean {
      return this.requirements.length === 1 && (req.easing?.steps ?? 0) > 0;
    },
    iconStyle(req: NormalizedRequirement): Record<string, string> {
      if (req.type === RequirementType.TAG && req.tag !== undefined) {
        return tagIconStyle(req.tag);
      }
      return req.iconUrl !== undefined ? {backgroundImage: `url(${req.iconUrl})`} : {};
    },
    /** Oxygen / Venus icons are horizontal chips — a wider socket + icon. */
    isWideIcon(req: NormalizedRequirement): boolean {
      return req.type === RequirementType.VENUS || req.type === RequirementType.OXYGEN;
    },
    /**
     * A PARTY's EMBLEM (Turmoil Redux — the scan prints the party's badge in
     * the MIN plate): a round seal with its own rim, so it takes no contact
     * shade and sits a step larger than a formula icon — it is the whole
     * statement, there is no number beside it.
     */
    isEmblem(req: NormalizedRequirement): boolean {
      return req.type === RequirementType.PARTY && req.iconUrl !== undefined;
    },
    socketClass(req: NormalizedRequirement): Record<string, boolean> {
      return {'pcard-req__socket--wide': this.isWideIcon(req), 'pcard-req__socket--emblem': this.isEmblem(req)};
    },
    iconClass(req: NormalizedRequirement): Record<string, boolean> {
      return {'pcard-req__icon--wide': this.isWideIcon(req), 'pcard-req__icon--emblem': this.isEmblem(req)};
    },
    /** A plain requirement's label is an i18n key (the scan's own word); an exotic type keeps its raw name. */
    formulaLabel(req: NormalizedRequirement): string {
      if (req.label === undefined) {
        return '';
      }
      return req.plain ? translateText(req.label) : req.label;
    },
    binaryLabel(req: NormalizedRequirement): string {
      if (req.party !== undefined) {
        return translateText(req.party);
      }
      return req.label !== undefined ? translateText(req.label) : '';
    },
  },
});
</script>

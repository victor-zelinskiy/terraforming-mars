<template>
  <!--
    «A CARD WITH A REQUIREMENT OF ANY PARTY» — the premium vocabulary's glyph
    for the requirement OBJECT a card prints (Turmoil Redux TR13 Political Think
    Tank: «→ [plate ?]* : [card]* 5 M€»; render item `PARTY_REQUIREMENT`). ONE
    drawing, reused wherever the concept is named: the card face's mechanics
    (PremiumMechNode), the action composer's check row and the deck-check
    verdict («ПРОВЕРКА [plate ?] Требование партии») — one symbol, one concept.

    Built from the face's own language: the PLATE is the requirements banner of
    the premium face in miniature (`.pcard__reqs` — the same pointed silhouette,
    bronze rim and copper field, drawn, never an image of a plate), and the
    PARTY is the owner's printed wild-party pill (`assets/misc/wild-party.png`,
    256×184, alpha kept) seated inside it at its own proportion — a stretched
    pill is a defect. State is never carried by `filter` (the console strips it).

    Sized by `--pprq-size` — the plate's HEIGHT (default: the face's mechanics
    icon), so a rem-authored host and the px-designed face both set it in their
    own units; every part is a share of that one size.
  -->
  <span class="pprq" aria-hidden="true">
    <span class="pprq__field">
      <span class="pprq__pill"></span>
    </span>
  </span>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'PremiumPartyRequirementGlyph',
});
</script>

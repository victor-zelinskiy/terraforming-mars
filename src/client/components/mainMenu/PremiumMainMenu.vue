<template>
  <div class="premium-main-menu">
    <!-- Layered background: image → warm sunrise glow → vignette → grain.
         Real DOM layers (not a single pasted image) so the scene reads as
         controlled app chrome, not a wallpaper. -->
    <div class="pmm__bg" aria-hidden="true"></div>
    <div class="pmm__glow" aria-hidden="true"></div>
    <div class="pmm__vignette" aria-hidden="true"></div>
    <div class="pmm__grain" aria-hidden="true"></div>
    <div class="pmm__hud" aria-hidden="true"></div>

    <div class="pmm__content">
      <header class="pmm__title-block">
        <div class="pmm__emblem" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path class="pmm__emblem-ring" d="M32 4 L54 17 L54 47 L32 60 L10 47 L10 17 Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
            <path class="pmm__emblem-core" d="M22 40 C26 28 30 24 36 22 C33 28 33 33 30 38 C35 35 39 31 42 25 C42 35 37 42 30 44 C27 44 24 43 22 40 Z" fill="currentColor"/>
          </svg>
        </div>
        <h1 class="pmm__wordmark">
          <span class="pmm__title-terraforming">TERRAFORMING</span>
          <span class="pmm__title-mars">MARS</span>
        </h1>
        <div class="pmm__badge">
          <span class="pmm__badge-tick" aria-hidden="true"></span>
          <span class="pmm__badge-text">PREMIUM EDITION</span>
          <span class="pmm__badge-tick" aria-hidden="true"></span>
        </div>
      </header>

      <nav class="pmm__actions" aria-label="Main menu">
        <premium-main-menu-button
          label="Create game"
          icon="globe-plus"
          variant="primary"
          href="new-game" />
        <premium-main-menu-button
          label="Join game"
          icon="users"
          variant="secondary"
          @activate="openStub" />
        <premium-main-menu-button
          label="Cards list"
          icon="cards"
          variant="secondary"
          href="cards" />
        <premium-main-menu-button
          label="How to play"
          icon="book"
          variant="secondary"
          href="help" />
      </nav>

      <premium-menu-footer />
    </div>

    <premium-stub-modal
      v-if="stubOpen"
      title="Join game"
      body="Online and local Join modes are coming in a future update."
      @close="closeStub" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import PremiumMainMenuButton from '@/client/components/mainMenu/PremiumMainMenuButton.vue';
import PremiumMenuFooter from '@/client/components/mainMenu/PremiumMenuFooter.vue';
import PremiumStubModal from '@/client/components/mainMenu/PremiumStubModal.vue';

export default defineComponent({
  name: 'PremiumMainMenu',
  components: {
    PremiumMainMenuButton,
    PremiumMenuFooter,
    PremiumStubModal,
  },
  data() {
    return {
      stubOpen: false,
    };
  },
  methods: {
    openStub(): void {
      this.stubOpen = true;
    },
    closeStub(): void {
      this.stubOpen = false;
    },
  },
});
</script>

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
          @activate="onCreate" />
        <premium-main-menu-button
          label="Join game"
          icon="users"
          variant="secondary"
          @activate="onJoin" />
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

      <premium-menu-footer @edit-identity="openIdentityModal" />
    </div>

    <premium-identity-modal
      v-if="identityModalOpen"
      :initial-name="initialName"
      :initial-color="initialColor"
      @save="onIdentitySave"
      @close="onIdentityClose" />

    <join-game-panel
      v-if="joinPanelOpen"
      @close="joinPanelOpen = false"
      @edit-identity="openIdentityModal"
      @create-game="goCreate" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {paths} from '@/common/app/paths';
import PremiumMainMenuButton from '@/client/components/mainMenu/PremiumMainMenuButton.vue';
import PremiumMenuFooter from '@/client/components/mainMenu/PremiumMenuFooter.vue';
import PremiumIdentityModal from '@/client/components/mainMenu/PremiumIdentityModal.vue';
import JoinGamePanel from '@/client/components/mainMenu/JoinGamePanel.vue';
import {identityState, ensureIdentityLoaded, setIdentity} from '@/client/components/mainMenu/identity/identityState';
import {DEFAULT_IDENTITY_COLOR} from '@/client/components/mainMenu/identity/playerIdentity';

type PendingAction = 'create' | 'join' | undefined;

export default defineComponent({
  name: 'PremiumMainMenu',
  components: {
    PremiumMainMenuButton,
    PremiumMenuFooter,
    PremiumIdentityModal,
    JoinGamePanel,
  },
  data() {
    return {
      identityModalOpen: false,
      joinPanelOpen: false,
      // What to resume after the player saves an identity they didn't have yet.
      pendingAction: undefined as PendingAction,
    };
  },
  computed: {
    initialName(): string {
      return identityState.identity?.displayName ?? '';
    },
    initialColor(): Color {
      return identityState.identity?.cubeColor ?? DEFAULT_IDENTITY_COLOR;
    },
  },
  mounted() {
    ensureIdentityLoaded();
  },
  methods: {
    onCreate(): void {
      if (identityState.identity !== undefined) {
        this.goCreate();
      } else {
        this.requireIdentity('create');
      }
    },
    onJoin(): void {
      if (identityState.identity !== undefined) {
        this.joinPanelOpen = true;
      } else {
        this.requireIdentity('join');
      }
    },
    // Open the identity modal because an action needs an identity first; the
    // action resumes once the player saves.
    requireIdentity(action: PendingAction): void {
      this.pendingAction = action;
      this.identityModalOpen = true;
    },
    // Open the identity modal to simply edit (no pending action). Used by the
    // identity chip + the join panel's "change name and color".
    openIdentityModal(): void {
      this.pendingAction = undefined;
      this.identityModalOpen = true;
    },
    onIdentitySave(payload: {displayName: string, color: Color}): void {
      setIdentity(payload.displayName, payload.color);
      this.identityModalOpen = false;
      const action = this.pendingAction;
      this.pendingAction = undefined;
      if (action === 'create') {
        this.goCreate();
      } else if (action === 'join') {
        this.joinPanelOpen = true;
      }
      // No pending action → it was a plain edit; if the join panel is open it
      // reloads itself via its name watcher.
    },
    onIdentityClose(): void {
      this.identityModalOpen = false;
      this.pendingAction = undefined;
    },
    goCreate(): void {
      // The create-game form reads the same stored identity to prefill the
      // first player's name + cube colour (see CreateGameForm.mounted).
      window.location.assign(paths.NEW_GAME);
    },
  },
});
</script>

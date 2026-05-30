<template>
  <!--
    Лёгкий confirm popup для подтверждения skip'a стартовых карт.
    Hosted внутри `<MandatoryInputModal :minimizable="false">` (родитель
    InitialDraftFlowOverlay). Никакого card-grid, никакой money-панели —
    игрок осознанно выбирает «не покупать проекты», и второй щелчок
    тут просто финализирует это решение.

    Кнопки:
      - «Продолжить» (primary) → emit('confirm') → родитель закрывает
        popup и переходит к финальному confirm (этап 6).
      - «Вернуться» (secondary) → emit('cancel') → родитель закрывает
        popup и возвращает игрока к модалу projects (с уже выбранным/
        пустым selected[]).
  -->
  <div class="initial-draft-mini-popup">
    <h2 class="initial-draft-mini-popup__title"
        v-i18n>Continue without buying any project cards?</h2>
    <p class="initial-draft-mini-popup__body"
       v-i18n>You will start the game with no project cards in hand. At the start of the game only standard projects will be available to you.</p>
    <div class="initial-draft-mini-popup__actions">
      <button class="initial-draft-mini-popup__btn initial-draft-mini-popup__btn--secondary"
              @click="$emit('cancel')">
        <span v-i18n>Go back</span>
      </button>
      <button class="initial-draft-mini-popup__btn initial-draft-mini-popup__btn--primary"
              @click="$emit('confirm')">
        <span v-i18n>Continue</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'InitialDraftSkipConfirmContent',
  emits: ['confirm', 'cancel'],
});
</script>

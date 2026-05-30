<template>
  <!--
    Финальное подтверждение запуска партии. Открывается, когда все
    обязательные шаги initial draft committed. Hosted внутри
    `<MandatoryInputModal :minimizable="false">` — игрок ОБЯЗАН либо
    финализировать, либо явно вернуться к свернутым плашкам, чтобы
    ничего не отправить случайно.

    Кнопки:
      - «Начать» (primary) → emit('confirm') → родитель отправляет
        агрегированный initialCards-ответ на сервер.
      - «Изменить выбор» (secondary) → emit('cancel') → родитель
        закрывает popup, оставляет игрока на pill-stack экране с
        возможностью кликнуть pill любого шага и пересмотреть.
  -->
  <div class="initial-draft-mini-popup">
    <h2 class="initial-draft-mini-popup__title"
        v-i18n>Start the game with the selected cards?</h2>
    <p class="initial-draft-mini-popup__body"
       v-i18n>Your choices will be sent to the server. After the game begins, the initial draft cannot be replayed.</p>
    <div class="initial-draft-mini-popup__actions">
      <button class="initial-draft-mini-popup__btn initial-draft-mini-popup__btn--secondary"
              @click="$emit('cancel')">
        <span v-i18n>Change selection</span>
      </button>
      <button class="initial-draft-mini-popup__btn initial-draft-mini-popup__btn--primary"
              @click="$emit('confirm')">
        <span v-i18n>Start</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'InitialDraftFinalConfirmContent',
  emits: ['confirm', 'cancel'],
});
</script>

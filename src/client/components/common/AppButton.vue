<template>
  <button @click="$emit('click')" class="btn" :class="outerClass" :disabled="isDisabled" v-i18n>
    <span v-if="hasIcon" class="icon" :class="iconClass" data-test="icon"/>
    <span v-else>{{ buttonText }}</span>
  </button>
</template>

<script setup lang="ts">
import {computed} from 'vue';
import {useAppRoot} from '@/client/components/appRoot';
import {Message} from '@/common/logs/Message';
import {translateText, translateMessage} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';

defineOptions({name: 'AppButton'});
const props = defineProps({
  title: {
    type: [String, Object as () => Message],
    required: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  align: {
    type: String,
    validator: (align: string) => ['right', 'left', 'center'].includes(align),
    required: false,
    default: 'center',
  },
  size: {
    type: String,
    default: 'normal',
    validator: (item: string) => ['tiny', 'small', 'normal', 'big', 'jumbo'].includes(item),
  },
  rounded: {
    type: Boolean,
    default: true,
  },
  disableOnServerBusy: {
    type: Boolean,
    default: true,
  },
  type: {
    type: String,
    default: 'normal',
    validator: (item: string) =>
      [
        'normal',
        'action',
        'max',
        'success',
        'error',
        'submit',
        'close',
        'back',
        'minus',
        'plus',
      ].includes(item),
  },
});
defineEmits(['click']);

// the app root's port (R26): `undefined` outside the application — a button with no root above it is not busy
const root = useAppRoot();

const isDisabledDueToServerBusy = computed((): boolean => {
  return props.disableOnServerBusy && root?.isServerSideRequestInProgress === true;
});
const isDisabled = computed((): boolean => {
  return props.disabled || isDisabledDueToServerBusy.value;
});
const hasIcon = computed((): boolean => {
  const iconTypes = ['close', 'back', 'plus', 'minus'];
  return iconTypes.includes(props.type);
});
const outerClass = computed((): Object => {
  return {
    // size
    'btn-tiny': props.size === 'tiny',
    'btn-sm': props.size === 'small',
    'btn-lg': props.size === 'big',

    // type
    'btn-max': props.type === 'max',
    'btn-plus': props.type === 'plus',
    'btn-minus': props.type === 'minus',
    'btn-success': props.type === 'success',
    'btn-error': props.type === 'error',
    'btn-action': props.type === 'action',
    'btn-submit': props.type === 'submit',

    // align
    'float-left': props.align === 'left',
    'float-right': props.align === 'right',

    'btn-rounded': props.rounded === true,

    // loading
    'loading': isDisabledDueToServerBusy.value,
  };
});
const iconClass = computed((): Object => {
  return {
    'icon-cross': props.type === 'close',
    'icon-back': props.type === 'back',
    'icon-plus': props.type === 'plus',
    'icon-minus': props.type === 'minus',
  };
});
const buttonText = computed((): string => {
  if (typeof props.title === 'string') {
    return translateText(props.title);
  } else if (typeof props.title === 'object') {
    return translateMessage(props.title);
  } else {
    return '';
  }
});
</script>

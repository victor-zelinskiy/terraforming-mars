<template>
  <section class="vp-basics" :class="{'vp-basics--on': on}" :data-total="total">
    <p class="vp-basics__label" @click="bump">{{ label }}: {{ count }}</p>
    <ul>
      <li v-for="item in items" :key="item.id" class="vp-basics__item" :data-id="item.id">{{ item.name }}</li>
    </ul>
    <b v-if="on" class="vp-basics__if">on</b>
    <i v-else class="vp-basics__else">off</i>
    <span v-show="on" class="vp-basics__show">shown</span>
    <span class="vp-basics__html" v-html="html"></span>
    <input class="vp-basics__input" v-model="typed">
    <em class="vp-basics__typed">{{ typed }}</em>
    <component :is="tag" class="vp-basics__dynamic">dynamic</component>
    <button class="vp-basics__stop" @click.stop="stopped++">stop {{ stopped }}</button>
  </section>
</template>

<script setup vapor lang="ts">
import {computed, ref} from 'vue';

const props = withDefaults(defineProps<{
  label: string,
  items?: ReadonlyArray<{id: number, name: string}>,
  on?: boolean,
  html?: string,
  tag?: string,
}>(), {items: () => [], on: false, html: '', tag: 'u'});
const emit = defineEmits<{(e: 'bumped', count: number): void}>();

const count = ref(0);
const typed = ref('');
const stopped = ref(0);
const total = computed(() => count.value + props.items.length);

function bump(): void {
  count.value++;
  emit('bumped', count.value);
}

defineExpose({bump, count});
</script>

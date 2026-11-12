<template>
  <div class="admin-home">
    <ul>
      <li v-for="path of paths" v-bind:key="path">
        <a :href="path + '?serverId=' + serverId">{{path}}</a>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue';
// The import yields its name to the `paths` field the template reads (`<script setup>` has one scope).
import {paths as appPaths} from '@/common/app/paths';

defineOptions({name: 'admin-home'});

const paths = ref([
  appPaths.API_STATS,
  appPaths.GAMES_OVERVIEW,
  appPaths.API_GAMES,
  appPaths.API_METRICS,
  appPaths.LOAD,
  appPaths.API_IPS,
  appPaths.API_HEAP_SNAPSHOT,
]);
const serverId = computed((): string => new URLSearchParams(window.location.search).get('serverId') || '');
</script>

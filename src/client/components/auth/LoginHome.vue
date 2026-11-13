<template>
  <div class="login-home">
    <template v-if="user !== undefined">
      You are {{  user }}
      <a :href="logoutURL">Log out</a>
    </template>
    <template v-else>
      <a :href="loginUrl">
        <img style="width: 87px; height: 24px;" src="https://cdn.prod.website-files.com/6257adef93867e50d84d30e2/6257d23c5fb25be7e0b6e220_Open%20Source%20Projects%20_%20Discord-7.svg">
        Login with Discord</a>
    </template>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue';
import raw_settings from '@/genfiles/settings.json';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';

defineOptions({name: 'login-home'});

const user = ref<string | undefined>(undefined);
const discordClientId = ref(raw_settings.discordClientId);

const loginUrl = computed((): string => {
  const thisUrl = window.location.href;
  const idx = window.location.href.lastIndexOf('/' + paths.LOGIN);
  const url = thisUrl.substring(0, idx) + '/' + paths.AUTH_DISCORD_CALLBACK;
  const encoded = encodeURI(url);
  const clientId = discordClientId.value;
  if (!clientId) {
    return '';
  }
  return 'https://discord.com/oauth2/authorize?client_id=' + clientId + '&response_type=code&scope=identify&redirect_uri=' + encoded;
});
const logoutURL = computed((): string => {
  return paths.API_LOGOUT;
});

onMounted(() => {
  const url = apiUrl(paths.API_PROFILE);
  fetch(url)
    .then((resp) => {
      if (!resp.ok) {
        console.error('Unexpected server response: ' + resp.statusText);
        return null;
      }
      return resp.json();
    })
    .then((data) => {
      if (!data) {
        return;
      }
      try {
        user.value = data._user.userid;
      } catch (e) {
        console.log('Error processing fetch response: ' + e);
      }
    })
    .catch((err) => {
      alert('Error getting session profile data');
      console.error(err);
    });
});
</script>

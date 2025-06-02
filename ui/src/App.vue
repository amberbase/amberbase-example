<script setup lang="ts">
import Amber from "./components/Amber.vue";
import {ref} from "vue";
import { AmberClient } from "amber-client";
import { type AmberUserDetails } from "./state";
const user = ref<AmberUserDetails | null>(null);
const amber= ref<AmberClient | null>(null);

</script>

<template>
  <v-app theme="dark">
    <v-app-bar app>
      <v-app-bar-title>Amberbase Example</v-app-bar-title>
      <v-spacer></v-spacer>
      <template v-if="user"></template>
       {{user?.userName}}
      <v-menu>
        <template v-slot:activator="{ props }">
          <v-btn icon="mdi-dots-vertical" variant="text" v-bind="props"></v-btn>
        </template>

        <v-list>
          <v-list-item @click="amber?.getAmberUiApi().goToUserProfile()">
            <v-list-item-title>Profile</v-list-item-title>
          </v-list-item>
          <v-list-item @click="amber?.getAmberUiApi().goToAdmin()" v-if="user?.roles.includes('admin')">
            <v-list-item-title>Manage</v-list-item-title>
          </v-list-item>
          <v-list-item @click="amber?.getAmberUiApi().goToMonitoring()" v-if="user?.roles.includes('admin')">
            <v-list-item-title>Monitoring</v-list-item-title>
          </v-list-item>
          
          <template v-if="user?.globalAdmin">
            <v-divider></v-divider>
            <v-list-subheader>Global Admin</v-list-subheader>
            <v-list-item @click="amber?.getAmberUiApi().goToGlobalAdmin()">
              <v-list-item-title>Manage Global</v-list-item-title>
            </v-list-item>
            <v-list-item @click="amber?.getAmberUiApi().goToGlobalMonitoring()">
              <v-list-item-title>Global Monitoring</v-list-item-title>
            </v-list-item>
          </template>
          <v-divider></v-divider>
          <v-list-item @click="amber?.getUserApi().logout()">
            <v-list-item-title>Logout</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>
    <v-main class="d-flex" style="min-height: 300px;">
      <Amber @user-ready="(details)=>{
        if (details) {
          user = details.user;
          amber = details.client;
        } else {
          user = null;
          amber = null;
        }
      }"></Amber>
    </v-main>
    <v-footer app>
      <v-col class="text-center">
        Visit amberbase at <v-btn variant="text" href="https://github.com/amberbase" target="_blank" prepend-icon="mdi-github">
          github
          </v-btn>
      </v-col>
    </v-footer>
  </v-app>
</template>

<style scoped>

</style>

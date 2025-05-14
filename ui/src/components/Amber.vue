<script setup lang="ts">
import {ref} from "vue"
import {  AmberClient, AmberClientInit, type InvitationDetails, type UserDetails, amberClient} from "amber-client"
import { state, type AmberUserDetails } from "@/state";
import AmberToDoTest from "./AmberToDoTest.vue";
import AmberNotesTest from "./AmberNotesTest.vue";
import AmberLoadTest from "./AmberLoadTest.vue";

const emit = defineEmits<{
   (e: 'userReady', details: {client: AmberClient,user:AmberUserDetails} | null): void,
}>();



const amberUser = ref<AmberUserDetails | null>(null);
const amber= ref<AmberClient | null>(null);
const experiment = ref<"notes" | "todo" | "load">("todo");
const connectedToAmber = ref(false);
var isGlobalAdmin = false;
var clientBuilder = amberClient().withPath("/amber");
if (state.amberTenant)
{
  clientBuilder = clientBuilder.withTenant(state.amberTenant);
}

clientBuilder.onUserChanged(u=>{
  var globalRoles = u?.tenants["*"];
  if (globalRoles && globalRoles.length > 0) {
    isGlobalAdmin = globalRoles.includes("admin");
  } else {
    isGlobalAdmin = false;
  }
});

clientBuilder.onRolesChanged(
  (tenant, roles, user) => {
    if (!tenant || !roles || !user ||roles.length === 0) {
      amberUser.value = null;
      emit("userReady", null);
      console.log("User changed to none");
      return;
    }
    amberUser.value = {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      tenant: tenant,
      roles: roles,
      globalAdmin: isGlobalAdmin,
    };
    amber.value?.getChannelsApi().onConnectionChanged((isConnected)=>{
      connectedToAmber.value = isConnected;
    });
    console.log("User changed", JSON.stringify(amberUser.value));
    emit("userReady", {client: amber.value!, user: amberUser.value});
  }
);

amber.value = clientBuilder.withAmberUiLogin().start();
</script>
<template>
    <v-container v-if ="amberUser && amberUser.tenant!='*' && amberUser.roles && amberUser.roles.length > 0">
      <v-alert v-if="!connectedToAmber" text="Connection to amber server is interrupted" type="warning"></v-alert>
      <v-tabs
      v-model="experiment"
      bg-color="amber"
    >
      <v-tab value="todo">ToDo</v-tab>
      <v-tab value="notes">Notes</v-tab>
      <v-tab value="load" v-if ="amberUser.roles.includes('editor')">Loadtest</v-tab>
    </v-tabs>
    <v-tabs-window v-model="experiment">
    <v-tabs-window-item value="todo">
      
      <template  v-if = "(amberUser.roles.includes('reader') || amberUser.roles.includes('editor'))">
        <p class="explanation">Example app that showcases a shared document database containing todos synchronized with everyone opening this page. It uses a channel to communicate a shared selection state.</p>
        <AmberToDoTest v-if="amberUser && amber" :amber-client="amber"></AmberToDoTest>
      </template>
    </v-tabs-window-item>
    <v-tabs-window-item value="notes">
      <template v-if ="(amberUser.roles.includes('reader') || amberUser.roles.includes('editor'))">
        <p class="explanation">
          Example app that showcases a shared document database with a simple rights management system. 
          Notes are owned by a user and can be shared with everyone (public) or specific users.
        </p>
        <AmberNotesTest v-if="amberUser && amber" :amber-client="amber"></AmberNotesTest>
      </template>
    </v-tabs-window-item>
    <v-tabs-window-item value="load">
    <template v-if ="amberUser.roles.includes('editor')">
      <p class="explanation">
        Example app to create load on a shared document database. The parameters for randomly selecting create, update or delete operations are configurable. 
        All browsers showing this app are remote controlled via a channel to contribute to the load using the same parameters . They are running their own loop and therefore multiplying the resulting pressure.
      </p>
      <AmberLoadTest v-if="amberUser && amber" :amber-client="amber"></AmberLoadTest>
    </template>
    </v-tabs-window-item>
    </v-tabs-window>
    </v-container>
</template>

<style scoped>
  .explanation {
    font-size: 0.8em;
    color: #777;
    margin: 1em;
    font-style: italic;
  }
</style>

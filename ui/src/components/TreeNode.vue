<script setup lang="ts">
import {ref, onMounted} from "vue"
import { AmberClient, type UserWithRoles, type Tenant, type UserDetails, type UserInfo, type CollectionDocument} from "amber-client"

interface Node {
  label: string;
  id: string;
  children: Node[];
}

const emit = defineEmits<{
   (e: 'add', id: string): void,
   (e: 'delete', id: string): void,
}>();
var props = defineProps<{
  node: Node,
  editable: boolean,
}>();

var expanded = ref(false);

</script>
<template>
  <div>
    <div>
        <v-btn icon="mdi-stop" title="leaf" v-if="!props.node.children?.length"></v-btn>
        <v-btn icon="mdi-chevron-right" @click="expanded = true" title="expand" v-if="!expanded && props.node.children?.length"></v-btn>
        <v-btn icon="mdi-chevron-down" @click="expanded = false" title="collapse" v-if="expanded && props.node.children?.length"></v-btn>
        {{ props.node.label }}
        <v-btn icon="mdi-delete-circle" density="compact" @click="emit('delete', props.node.id)" title="delete"></v-btn>
         <v-btn icon="mdi-plus-circle" density="compact" @click="emit('add', props.node.id); expanded = true;"></v-btn>
    </div>
    
    <div style="border-left:5px solid gray" v-if="expanded">
        <TreeNode v-for="child in props.node.children" :key="child.id" :node="child" @add="(id)=>emit('add', id)" @delete="(id)=>emit('delete', id)" :editable="props.editable"></TreeNode>
    </div>
  </div>
</template>

<style scoped>

</style>

<script setup lang="ts" generic="T extends Node">
import {ref, onMounted} from "vue"
import { AmberClient, type UserWithRoles, type Tenant, type UserDetails, type UserInfo, type CollectionDocument} from "amber-client"

export interface Node {
  label: string;
  id: string;
  children: Node[];
}

const emit = defineEmits<{
   (e: 'add', id: string): void,
   (e: 'delete', id: string): void,
   (e: 'add-note', id: string): void,
   (e: 'select', id: string): void,
   (e: 'edit', id: string, node: T): void,
}>();
var props = defineProps<{
  node: T,
  editable: boolean,
  selected: string,
}>();

var expanded = ref(false);

</script>
<template>
  <div>
    <div :class="['tree-node', {'selected': props.selected === props.node.id}]" >
        <v-btn icon="mdi-stop" style="visibility:hidden" v-if="!props.node.children?.length"></v-btn>
        <v-btn icon="mdi-chevron-right" variant="plain" @click="expanded = true" title="expand" v-if="!expanded && props.node.children?.length"></v-btn>
        <v-btn icon="mdi-chevron-down" variant="plain" @click="expanded = false" title="collapse" v-if="expanded && props.node.children?.length"></v-btn>
        <span @click="(id)=>emit('select', node.id)" class="label">{{ props.node.label }}</span>
        <template v-if="props.editable">
         <v-btn icon="mdi-pencil" density="compact" @click="emit('edit', props.node.id, props.node);" title="edit"></v-btn>
         <v-btn icon="mdi-content-copy" density="compact" @click="emit('add', props.node.id); expanded = true;" title="copy node"></v-btn>
         <v-btn icon="mdi-delete-circle" density="compact" @click="emit('delete', props.node.id)" title="delete"></v-btn>
         <v-btn icon="mdi-plus-circle" density="compact" @click="emit('add', props.node.id); expanded = true;" title="add node"></v-btn>
         <v-btn icon="mdi-note-plus" density="compact" @click="emit('add-note', props.node.id);" title="add annotation"></v-btn>
         </template>
    </div>
    
    <div style="border-left:15px solid transparent" v-if="expanded">
        <TreeNode v-for="child in props.node.children" :key="child.id" :selected="props.selected" @edit="(id, oldvalue)=>emit('edit', id, oldvalue)"  @select="(id)=>emit('select', id)" :node="child as T" @add-note="(id)=>emit('add-note', id)" @add="(id)=>emit('add', id)" @delete="(id)=>emit('delete', id)" :editable="props.editable"></TreeNode>
    </div>
  </div>
</template>

<style scoped>
 .selected {
    background-color: #444;
  }

  .label:hover {
    cursor: pointer;
    text-decoration: underline;
  }
</style>

<script setup lang="ts">
import {ref, onMounted, computed} from "vue"
import { AmberClient, type UserWithRoles, type Tenant, type UserDetails, type UserInfo, type CollectionDocument} from "amber-client"
import TreeNode from "./TreeNode.vue";

interface TreeItem {
  label: string;
  id:string;
  children: TreeItem[];
  changeNumber: number;
  userName: string;
  parentId: string | null;
}

interface TreeEntity {
  label: string;
  childrenIds: string[];
  parentId: string | null;
}

var props = defineProps<{
  amberClient: AmberClient, 
}>();
var roles = ref<string[]>([]);
var isAdmin = ()=> roles.value.includes("admin");
var isEditor = ()=> roles.value.includes("editor");
var isReader = ()=> roles.value.includes("reader");
var users = ref<UserInfo[]>([]);
var loadingUsers = ref(false);
var connectedToAmber = ref(false);
var roots = computed<TreeItem[]>(()=>{
  return Object.values(allNodes.value).filter(node => node.parentId === null);
});
var nodesCount = computed<number>(()=>{
  return Object.keys(allNodes.value).length;
});

var allNodes = ref<{[id: string]: TreeItem}>({});

var collectionApi = props.amberClient.getCollectionsApi().getCollection<TreeEntity>("tree");


var addNode = async (parentId:string | null) => {
  await collectionApi.createDoc({
    label: "New Node " + (Math.random() * 100000).toFixed(0),
    childrenIds: [],
    parentId: parentId
  });
};

var deleteNode = async (nodeId:string) => {
  try {
    await collectionApi.deleteDoc(nodeId);
  } catch (error) {
    console.error("Error deleting node:", error);
  }
};



onMounted(async () => {
  if (props.amberClient) {
    connectedToAmber.value = false;
    roles.value = await props.amberClient.loginManager.roles;
    try {
      loadingUsers.value = true;
      const usersResponse = await props.amberClient.getAmberApi()?.getUsers();
      
      users.value = usersResponse || [];
      loadingUsers.value = false;
      var collectionsApi = props.amberClient.getCollectionsApi();
      if (!collectionsApi) {
        console.error("Collections API is not available.");
        return;
      }

      collectionApi.subscribe(
        0,
        (doc)=>{
            var existingNode = allNodes.value[doc.id];
            var node : TreeItem | null = null;
            if (existingNode){
              if ( existingNode.parentId){
                var existingParent = allNodes.value[existingNode.parentId];
                if (existingParent) {
                  existingParent.children = existingParent.children.filter(child => child.id !== doc.id);
                }
            }
              existingNode.label = doc.data.label;
              existingNode.parentId = doc.data.parentId;
              existingNode.changeNumber = doc.change_number;
              existingNode.userName = users.value.find(user => user.id === doc.change_user)?.name || "Unknown";
              node = existingNode;
              
            } else {
              var newNode: TreeItem = {
                label: doc.data.label,
                id: doc.id,
                children: [],
                changeNumber: doc.change_number,
                userName: users.value.find(user => user.id === doc.change_user)?.name || "Unknown",
                parentId: doc.data.parentId
              };
              allNodes.value[doc.id] = newNode;
              node = newNode;
            }
            if (node?.parentId) {
              var parentNode = allNodes.value[node.parentId];
              if (parentNode) {
                parentNode.children.push(node);
              }
              else
              {
                allNodes.value[node.parentId] = {
                  label: "Unknown Parent",
                  id: node.parentId,
                  children: [node],
                  changeNumber: 0,
                  userName: "Unknown",
                  parentId: null
                };
              }
              
            }
        },
        (deletedDoc:string)=>{
            const deletedNode = allNodes.value[deletedDoc];
            if (deletedNode) {
              if (deletedNode.parentId) {
                const parentNode = allNodes.value[deletedNode.parentId];
                if (parentNode) {
                  parentNode.children = parentNode.children.filter(child => child.id !== deletedDoc);
                }
              }
              delete allNodes.value[deletedDoc];
            }
        }
      );
      
      collectionsApi.onConnectionChanged(
        (connected:boolean)=>
        {
          connectedToAmber.value = connected;
        });


      collectionsApi.connect();
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }
});
</script>
<template>
  <v-container>
    We have {{ nodesCount }} nodes in the database.
    <v-btn 
      v-if="isEditor()"
      color="primary" 
      @click="addNode(null)" 
      class="mb-2">
      Add Root Node
    </v-btn>
    <TreeNode 
      v-for="root in roots"
      :key="root.id"
      :node="root"
      @add="(id) => addNode(id)"
      @delete="(id) => deleteNode(id)"
      :editable="isEditor()">
    </TreeNode>
  </v-container>
</template>

<style scoped>

</style>

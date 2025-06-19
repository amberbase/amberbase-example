<script setup lang="ts">
import {ref, onMounted, computed} from "vue"
import { AmberClient, type UserWithRoles, type Tenant, type UserDetails, type UserInfo, type CollectionDocument} from "amber-client"
import TreeNode, {type Node} from "./TreeNode.vue";

interface TreeItem extends Node {
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

interface TreeAnnotationEntity {
  label: string;
  treeEntityId: string; // the id of the tree entity this annotation belongs to
  ownerId: string; // the owners userId of the annotation
}

interface TreeAnnotation {
  id:string; // this is the id of the annotation in the collection
  label: string;
  treeEntityId: string; // the id of the tree entity this annotation belongs to
  ownerId: string; // the owners userId of the annotation
  changeNumber:number;
}

var props = defineProps<{
  amberClient: AmberClient, 
}>();
var roles = ref<string[]>([]);
var isAdmin = ()=> roles.value.includes("admin");
var isEditor = ()=> roles.value.includes("editor");
var isReader = ()=> roles.value.includes("reader");
var editDialogOpen = ref(false);
var editDialogText = ref("");
var editDialogValue = ref<string>("");
var editDialogOnConfirm : ((newValue:string)=>void) | null = null;

var editDialogClose = (result:boolean)=>{
  editDialogOpen.value = false;
  if (result) {
    // handle the result
    if (editDialogOnConfirm) {
      editDialogOnConfirm(editDialogValue.value);
    }
  } 
};


function edit(text:string, value:string, onConfirm:(newValue:string)=>void) {
  editDialogText.value = text;
  editDialogValue.value = value;
  editDialogOnConfirm = onConfirm;
  editDialogOpen.value = true;
}

var users = ref<UserInfo[]>([]);
var user = ref<UserDetails | null>(null);
var loadingUsers = ref(false);
var connectedToAmber = ref(false);
var roots = computed<TreeItem[]>(()=>{
  return Object.values(allNodes.value).filter(node => node.parentId === null);
});
var nodesCount = computed<number>(()=>{
  return Object.keys(allNodes.value).length;
});

var annotationsCount = computed<number>(()=>{
  return myAnnotations.value.length;
});

var allNodes = ref<{[id: string]: TreeItem}>({});
var myAnnotations = ref<TreeAnnotation[]>([]);
var selectedNodeId = ref<string>("");

var collectionApi = props.amberClient.getCollectionsApi().getCollection<TreeEntity>("tree");
var annotationCollectionApi = props.amberClient.getCollectionsApi().getCollection<TreeAnnotationEntity>("tree-annotations");


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
    user.value = await props.amberClient.loginManager.getUser();
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

      annotationCollectionApi.subscribe(
        0,
        (doc) => {
          if (doc.data) {
            const existingAnnotation = myAnnotations.value.find(annotation => annotation.id === doc.id);
            if (existingAnnotation) {
              // Update existing annotation
              existingAnnotation.label = doc.data.label;
              existingAnnotation.treeEntityId = doc.data.treeEntityId;
              existingAnnotation.ownerId = doc.data.ownerId;
              existingAnnotation.changeNumber = doc.change_number;
              } else {
                // Add new annotation
              myAnnotations.value.push({
                label: doc.data.label,
                treeEntityId: doc.data.treeEntityId,
                ownerId: doc.data.ownerId,
                id: doc.id,
                changeNumber: doc.change_number
              });
            }
          }
        },
        (deletedDoc: string) => {
          myAnnotations.value = myAnnotations.value.filter(annotation => annotation.id !== deletedDoc);
        }
      );

      collectionApi.subscribe(
        0,
        (doc)=>{
            var existingNode = allNodes.value[doc.id];
            var node : TreeItem | null = null;
            if (existingNode){
              if ( existingNode.parentId){
                var existingParent = allNodes.value[existingNode.parentId];
                if (existingParent && doc.data.parentId !== existingParent.id) {
                  // Remove from old parent
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
              if (parentNode && !parentNode.children.some(child => child.id === doc.id)) {
                parentNode.children.push(node);
              }
              else
              if (!parentNode) {
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
    We have {{ nodesCount }} nodes and {{ annotationsCount }} annotations cached.
    <v-btn 
      v-if="isEditor()"
      color="primary" 
      @click="addNode(null)" 
      class="mb-2">
      Add Root Node
    </v-btn>
    <v-row>
      <v-col cols="8">
        <h3>The common Tree</h3>
        <TreeNode 
          v-for="root in roots"
          :key="root.id"
          :node="root"
          :selected="selectedNodeId"
          @add="(id) => addNode(id)"
          @delete="(id) => deleteNode(id)"
          @select="selectedNodeId = $event"
          @edit="(id, node) => edit('Edit Node Label', node.label, (newValue) => {
            collectionApi.updateDoc(id, node.changeNumber, { 
              label: newValue,
              childrenIds: node.children.map(child => child.id),
              parentId: node.parentId
            });
          })"
          @add-note="(id) => {
            annotationCollectionApi.createDoc({
              label: 'New Annotation ' + (Math.random() * 100000).toFixed(0),
              treeEntityId: id,
              ownerId: user?.id || ''
            });
          }"
          :editable="isEditor()">
        </TreeNode>
      </v-col>
      <v-col cols="4">
        <h3>My Annotations</h3>
        <v-list>
          <v-list-item 
            v-for="annotation in myAnnotations" 
            :key="annotation.id"
            @click="selectedNodeId = annotation.treeEntityId"
            :active="selectedNodeId === annotation.treeEntityId"
            >
            <v-list-item-title>{{ annotation.label }}</v-list-item-title>
            <template v-slot:append>
            <v-btn
              icon="mdi-pencil"
              variant="text"
              @click.stop="edit('Edit Annotation', annotation.label, (newValue) => {
                annotationCollectionApi.updateDoc(
                  annotation.id, 
                  annotation.changeNumber, 
                  { 
                    label: newValue,
                    treeEntityId: annotation.treeEntityId,
                    ownerId: annotation.ownerId
                  });
              })"
            ></v-btn>
          </template>

          </v-list-item>
        </v-list>
      </v-col>
    </v-row>
  </v-container>
  <v-dialog v-model="editDialogOpen" max-width="600">
      <v-card>
        <v-card-title class="headline">Edit</v-card-title>
        <v-card-text>{{ editDialogText }}</v-card-text>
        <v-card-text> <v-text-field v-model="editDialogValue" @keydown.enter.prevent="editDialogClose(true)"></v-text-field></v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="editDialogClose(false)" color="red">Cancel</v-btn>
          <v-btn @click="editDialogClose(true)" color="green">OK</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
</template>

<style scoped>

</style>

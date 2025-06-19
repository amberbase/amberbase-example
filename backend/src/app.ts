import express from 'express'
import {relativeTimeFromDates} from './timeHelper.js'
import * as path from 'path';

import {fileURLToPath} from 'url';
import cookieParser from 'cookie-parser';
import * as uberspace from './integration/uberspace.js';
import {amber, CollectionAccessAction, UserContext}  from 'amber-backend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

var uberspaceConfig = uberspace.loadConfig('.my.cnf');
var buildInfo = uberspace.loadBuildInfo();
var db_username = uberspaceConfig?.client?.user || process.env.Mariadb_user;
var db_password = uberspaceConfig?.client?.password || process.env.Mariadb_password;

const app = express();
const port = 3000;
const startTime =  new Date();
const serverInstanceId = crypto.randomUUID();
const version = "0.0.1"; // todo: we could use the value from package.json...

 //This is just for the demo. Would be in some models.ts file
interface ToDoEntity {
  title: string;
  description: string;
  completed: boolean;
}

interface NoteEntity {
  title: string;
  description: string;
  owner:string;
  sharedWith:string[];
  isPublic:boolean;
}

interface DocumentEntity {
  title: string;
  description: string;
  changeTimestamp: number;
}

interface LoadtestCommand{
  start: boolean;
  intervalMs?: number;
  jitterMs?: number;
  updatePercentage?: number;
  deletionPercentage?: number;
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

var amberInit = amber()
              .withConfig({
                db_password:db_password,
                db_username:db_username,
                db_name:'amber',
              })
              .withPath('/amber')
            // Example for a simple ToDo app. Everyone with the reader role can read todos. Editors can create, update and delete todos.
            .withCollection<ToDoEntity>("todos",
              {
                accessRights:{
                  "editor":['create',"update","delete","subscribe"],
                  "reader":['subscribe']
                },
                validator:(user, oldDoc, newDoc, action) => {
                  if (action == 'create' || action == 'update') 
                  {
                    if (newDoc.title.length < 3) return false; // title must be at least 3 characters long. This is an example validation
                  }
                  return true;
                }
              }
            )
            // Example for a simple Note app. Everyone with the reader role can read notes. Editors can create new notes. Notes are private by default and can be shared with other users or publicly.
            .withCollection<NoteEntity>("notes",
              {
                accessRights:(user:UserContext, doc:NoteEntity | null, action:CollectionAccessAction) => {
                  if(action == 'create' || action == 'update' || action == 'delete'){
                    if(!user.roles.includes("editor")){ // only editors can create, update or delete notes
                      return false;
                    }
                    if(action == 'create'){ // editors can create. Update and delete needs an additional check for the owner
                     return true;
                    }
                  }

                  if (action == 'update' || action == 'delete'){
                    if(doc.owner != user.userId ){ // only the owner can update or delete the note
                      return false;
                    }
                    else{
                      return true;
                    }
                  }
                  if (action == 'subscribe'){ // the filter to only see the subset of documents they are allowed to see is handled by the accessTags. 
                  // This is for general access to the collection subscription. The client would otherwise not even be able to subscribe
                    if(user.roles.includes("editor") || user.roles.includes("reader")){
                      return true;
                    }
                    return false;
                  }
                  return false; // default forbidden
                },
                accessTagsFromDocument:( doc:NoteEntity) => [ // we use access tags, generated out of the docuemnt content to make them accessible to a subset of users. There needs to be at least one overlap of document tags and user tags
                    "owner-" + doc.owner, // the owner can see the document
                    ...doc.sharedWith.map(s=>"sharedWith-" + s), // everyone it is shared with can see it
                    ...(doc.isPublic ? ["public"] : []) // if it is public, everyone can see it
                  ],
                accessTagsFromUser:(user:UserContext) => [ // user tags allow users to see documents with the same tags
                    "owner-" + user.userId, // a user can see their own documents
                    "sharedWith-" + user.userId, // a user can see documents that include them in their sharing tags
                    "public" // a user can always see public documents
                ],
                validator:(user, oldDoc:NoteEntity, newDoc:NoteEntity | null, action:CollectionAccessAction) => {
                  if (action == 'create' || action == 'update') 
                  { // just some minimal validation. This is not a production ready validator.
                    if (newDoc.title.length < 3) return false;
                    if(!newDoc.owner) return false;
                    if(!newDoc.sharedWith) return false;
                  }
                  return true;
                }
              }
            )            
            .withCollection<TreeEntity>("tree", { // a simple tree structure to test the tree functionality
              accessRights:{
                "editor":['create',"delete","subscribe", "update"],
                "reader":['subscribe']
              },
              onDocumentChange :async (tenant, userId, docId, oldDocument, newDocument, action, collections) =>{
                var collection = collections.getCollection<TreeEntity>("tree")!;
                const treeAnnotationCollection = collections.getCollection<TreeAnnotationEntity>("tree-annotations");
                if (action == 'delete')
                { 
                  // we need to delete all annotations that are related to this tree node. We use the indexed data tags to find them.                
                  await treeAnnotationCollection.allDocumentsByTags(tenant, ["tn-" + docId], async (annotationId, annotationData) => {
                    await treeAnnotationCollection.deleteDocument(tenant, userId, annotationId);
                  });
                    
                  // we need to remove all children as well and need to remove it from the parents list
                  if (oldDocument && oldDocument.childrenIds && oldDocument.childrenIds.length > 0) {
                    for (const childId of oldDocument.childrenIds) {
                      await collection.deleteDocument(tenant,userId, childId);
                    }
                  }
                  if (oldDocument && oldDocument.parentId) {
                    await collection.updateDocumentWithCallback(tenant, oldDocument.parentId,userId, (parentDoc) => {
                      if (parentDoc && parentDoc.childrenIds) { 
                        parentDoc.childrenIds = parentDoc.childrenIds.filter(id => id !== docId); // remove the deleted document from the parent's children list
                        return parentDoc; // return the updated parent document
                      }
                    });
                  }
                }
                if( action == 'create')
                {
                  if (newDocument && newDocument.parentId) { // if it has a parent, we need to add it to the parent's children list so that we can cascade delete later
                    await collection.updateDocumentWithCallback(tenant, newDocument.parentId,userId, (parentDoc) => {
                      if (parentDoc && parentDoc.childrenIds) { 
                        parentDoc.childrenIds.push(docId); // add the new document to the parent's children list
                        return parentDoc; // return the updated parent document
                      }
                    });
                  }
                }
              }
            })
            .withCollection<TreeAnnotationEntity>("tree-annotations", // a simple tree annotation structure to test the deletion on-change functionality
              { 
                accessRights : (user: UserContext, doc: TreeAnnotationEntity | null, action: CollectionAccessAction) => {
                if(action == 'create') 
                {
                  return user.roles?.includes("editor");
                }
                if(action == 'subscribe') 
                {
                  return user.roles?.includes("reader") || user.roles?.includes("editor");
                }
                if(action == 'delete' || action == 'update') 
                {
                  return doc?.ownerId == user.userId; // only the owner can update or delete the annotation
                }

              },
              accessTagsFromDocument:(doc: TreeAnnotationEntity) => [ // we use access tags, generated out of the docuemnt content to make them accessible to a subset of users. There needs to be at least one overlap of document tags and user tags
                  "owner-" + doc.ownerId], // only the owner can see the annotation
              accessTagsFromUser:(user: UserContext) => [ // user tags allow users to see documents with the same tags
                  "owner-" + user.userId // a user can see their own annotations
              ],
              tagsFromDocument:(doc: TreeAnnotationEntity) => [ // tags are used to filter the documents in the client side
                  "tn-" + doc.treeEntityId // we use the tree node entity id to filter the annotations for a specific tree node
              ]
              })              
            .withChannel<string>("selected-todo",{ // a simple "share selection id" channel to broadcast the selected item to all clients live at the same time
              subchannels:false
            })
            .withCollection<DocumentEntity>("loadtest",{ // a simple collection used for load tests
              accessRights:{
                "editor":['create',"update","delete","subscribe"]
              }
            })
            .withChannel<LoadtestCommand>("loadtest-command",{ // a channel to distribute load tests towards all clients live at the same time. Poor-mans horizontally scalable load testing framework ;-)
              subchannels:false
            })
            .withUi({
               availableRoles: ["editor", "reader"],
               theme:"dark",
               loginTargetUrl:"/#/tenant={tenant}",
               title:"Amberbase Example App",
            });

var amberApp = await amberInit.create(app); // we attach the amber instance to the express app we use for our custom logic.

// this setup of a server is separate from the amber instance. Amberbase wants to be just a library and not a framework. So it integrates into the app, and not the otherway around
// BUT, adding middleware before adding amber will mess with the amber routes, so we need to add the amber instance first, than the middleware. This seems to be a limitation of express.
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'static')));
app.use(express.json());
app.get('/starttime', (req, res) => {
    res.send(`We are here since ${startTime.toISOString()}, that is ${relativeTimeFromDates(startTime)}`);
})

app.get('/version', async (req, res) => {
    res.send(`Version: ${version} (${buildInfo.commit} @ ${buildInfo.branch}) Build Time: ${buildInfo.buildtime}, Up Since: ${startTime.toISOString()}`);
  });


amberApp.addAdminIfNotExists('admin',"Admin Account","password", ["admin","editor"]); // bootstrap an admin user. This is just for the demo. In a real application, you would use a proper secret from somewhere secured.
amberApp.listen(port, "0.0.0.0");
export var state = {
    amberTenant: "",
    defaultView: ""
};

export interface AmberUserDetails
{
  userId:string,
  userName:string,
  userEmail:string,
  tenant:string,
  roles:string[],
  globalAdmin:boolean,
}
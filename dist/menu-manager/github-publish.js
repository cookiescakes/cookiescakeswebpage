const publishButton=document.querySelector('#publish-github');
const publishEndpoint=document.querySelector('#publish-endpoint');
const publishPassword=document.querySelector('#publish-password');
const publishStatus=document.querySelector('#publish-status');
let publishAfterSave=false;
if(location.protocol.startsWith('http'))publishEndpoint.value=location.origin;
function publishMessage(message,isError=false){publishStatus.textContent=message;publishStatus.style.color=isError?'#9a254d':'';}
function toBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});}
async function imagesForPublish(){
  if(!selectedDirectoryHandle)throw new Error('Choose the website folder first.');
  const imagesDirectory=await selectedDirectoryHandle.getDirectoryHandle('images');
  const images=[];
  for(const path of getAllMenuImagePaths()){
    if(!/^images\/[a-z0-9][a-z0-9._-]*$/i.test(path))throw new Error('An image path is not valid.');
    const file=await (await imagesDirectory.getFileHandle(path.slice(7))).getFile();
    images.push({path,content:await toBase64(file)});
  }
  return images;
}
async function publishToGitHub(){
  try{
    publishMessage('Uploading the menu to GitHub…');
    const endpoint=publishEndpoint.value.trim().replace(/\/$/,'');
    const result=await fetch(`${endpoint}/api/publish-menu`,{method:'POST',headers:{'Content-Type':'application/json','X-Menu-Publish-Password':publishPassword.value},body:JSON.stringify({menuData:serialiseMenuData(),images:await imagesForPublish()})});
    const body=await result.json();
    if(!result.ok)throw new Error(body.error||'Publishing failed.');
    publishPassword.value='';publishMessage(`Published to GitHub — commit ${body.commit.slice(0,7)}.`);
  }catch(error){publishMessage(error.message||'Publishing failed.',true);}
}
publishButton.addEventListener('click',async()=>{
  if(!publishEndpoint.value.trim()){publishMessage('Enter your Worker address first.',true);return;}
  if(!publishPassword.value){publishMessage('Enter the publish password first.',true);return;}
  publishAfterSave=true;
  const saved=await saveChanges();
  if(saved){publishAfterSave=false;await publishToGitHub();}
});
publishPassword.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();publishButton.click();}});

let selectedDirectoryHandle;
let menuCatalogue=[];
let menuCategories=[];
let weeklySelection=new Set();
const pendingPhotos=new Map();

const $=selector=>document.querySelector(selector);
const folderButton=$('#choose-folder');
const folderStatus=$('#folder-status');
const editor=$('#editor');
const weeklyMount=$('#weekly-items');
const weeklyLibraryMount=$('#weekly-library');
const weeklyEmpty=$('#weekly-empty');
const weeklyCount=$('#weekly-count');
const libraryMount=$('#library-categories');
const saveStatus=$('#save-status');
const weeklyTemplate=$('#weekly-template');
const libraryTemplate=$('#library-template');

function setStatus(element,message,isError=false){element.textContent=message;element.style.color=isError?'#9a254d':'';}
function makeId(){return `item-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}
function cleanCategory(value){return String(value||'Other').trim()||'Other';}
function normalisePrice(value){const text=String(value||'').trim();if(!text)return '';const number=Number(text.replace(/[£,]/g,''));return Number.isFinite(number)?`£${number.toFixed(2)}`:text;}
function normaliseItem(item){return {id:item?.id||makeId(),title:item?.title||'',category:cleanCategory(item?.category),description:item?.description||'',price:normalisePrice(item?.price),image:item?.image||'',glutenFree:Boolean(item?.glutenFree),vegan:Boolean(item?.vegan)};}
function categoryList(){return [...new Set([...menuCategories,...menuCatalogue.map(item=>cleanCategory(item.category)),'Other'])].sort((a,b)=>a.localeCompare(b));}
function itemById(id){return menuCatalogue.find(item=>item.id===id);}
function itemKey(item){return item.id;}

function assignmentFrom(source,name){const match=source.match(new RegExp(`window\\.${name}\\s*=\\s*([\\s\\S]*?);\\s*(?=window\\.|$)`));return match?Function(`"use strict";return (${match[1]});`)():undefined;}
function readMenuData(source){
  const catalogue=assignmentFrom(source,'menuCatalogue');
  const selection=assignmentFrom(source,'weeklyMenuSelection');
  const categories=assignmentFrom(source,'menuCategories');
  if(Array.isArray(catalogue))return {catalogue:catalogue.map(normaliseItem),selection:Array.isArray(selection)?selection:[],categories:Array.isArray(categories)?categories.map(cleanCategory):[]};
  const legacy=assignmentFrom(source,'weeklyMenuItems');
  if(Array.isArray(legacy)){const items=legacy.map(normaliseItem);return {catalogue:items,selection:items.map(item=>item.id),categories:items.map(item=>item.category)};}
  return {catalogue:[],selection:[],categories:[]};
}

function openStorage(){return new Promise((resolve,reject)=>{const request=indexedDB.open('cookies-cakes-menu-manager',1);request.onupgradeneeded=()=>request.result.createObjectStore('settings');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function saveFolder(handle){const database=await openStorage();await new Promise((resolve,reject)=>{const transaction=database.transaction('settings','readwrite');transaction.objectStore('settings').put(handle,'website-folder');transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});database.close();}
async function getSavedFolder(){const database=await openStorage();const handle=await new Promise((resolve,reject)=>{const transaction=database.transaction('settings','readonly');const request=transaction.objectStore('settings').get('website-folder');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});database.close();return handle;}

function categoryOptions(select,selected){select.innerHTML='';categoryList().forEach(category=>{const option=document.createElement('option');option.value=category;option.textContent=category;option.selected=category===selected;select.append(option);});}
function photoText(item){const pending=pendingPhotos.get(itemKey(item));return pending?`New photo: ${pending.name}`:(item.image?`Current photo: ${item.image}`:'No photo selected');}
function updateCard(card,item){
  item.title=card.querySelector('[name="title"]').value;
  item.category=cleanCategory(card.querySelector('[name="category"]').value);
  item.description=card.querySelector('[name="description"]').value;
  item.price=card.querySelector('[name="price"]').value;
  item.glutenFree=card.querySelector('[name="glutenFree"]').checked;
  item.vegan=card.querySelector('[name="vegan"]').checked;
}
function attachFields(card,item,rerender){
  card.querySelector('[name="title"]').value=item.title;
  card.querySelector('[name="price"]').value=item.price;
  card.querySelector('[name="description"]').value=item.description;
  card.querySelector('[name="glutenFree"]').checked=item.glutenFree;
  card.querySelector('[name="vegan"]').checked=item.vegan;
  categoryOptions(card.querySelector('[name="category"]'),item.category);
  card.querySelector('.photo-name').textContent=photoText(item);
  const title=card.querySelector('h3');
  const sync=()=>{updateCard(card,item);title.textContent=item.title||'Untitled item';};
  card.querySelectorAll('input:not([type="file"]),textarea,select').forEach(input=>input.addEventListener(input.type==='checkbox'?'change':'input',sync));
  card.querySelector('[name="price"]').addEventListener('blur',event=>{event.target.value=normalisePrice(event.target.value);sync();});
  card.querySelector('[name="category"]').addEventListener('change',()=>{sync();rerender();});
  card.querySelector('[name="image"]').addEventListener('change',event=>{const photo=event.target.files[0];if(photo){pendingPhotos.set(itemKey(item),photo);card.querySelector('.photo-name').textContent=photoText(item);}});
}

function renderWeeklyLibrary(){
  weeklyLibraryMount.innerHTML='';
  categoryList().forEach(category=>{
    const items=menuCatalogue.filter(item=>cleanCategory(item.category)===category).sort((a,b)=>a.title.localeCompare(b.title));
    if(!items.length)return;
    const group=document.createElement('section');group.className='category-picker';
    const heading=document.createElement('h4');heading.textContent=category;group.append(heading);
    items.forEach(item=>{const row=document.createElement('div');row.className='picker-item';const title=document.createElement('span');title.textContent=item.title||'Untitled item';const button=document.createElement('button');button.type='button';button.className='add-weekly';button.textContent=weeklySelection.has(item.id)?'Added':'Add';button.disabled=weeklySelection.has(item.id);button.addEventListener('click',()=>{weeklySelection.add(item.id);renderAll();});row.append(title,button);group.append(row);});
    weeklyLibraryMount.append(group);
  });
}
function moveWeekly(id,direction){const order=[...weeklySelection];const from=order.indexOf(id);const to=from+direction;if(from<0||to<0||to>=order.length)return;[order[from],order[to]]=[order[to],order[from]];weeklySelection=new Set(order);renderWeekly();}
function renderWeekly(){
  weeklyMount.innerHTML='';
  [...weeklySelection].map(itemById).filter(Boolean).forEach(item=>{
    const card=weeklyTemplate.content.firstElementChild.cloneNode(true);card.dataset.id=item.id;card.querySelector('h3').textContent=item.title||'Untitled item';attachFields(card,item,renderAll);
    card.querySelector('.move-up').addEventListener('click',()=>moveWeekly(item.id,-1));
    card.querySelector('.move-down').addEventListener('click',()=>moveWeekly(item.id,1));
    card.querySelector('.remove-weekly').addEventListener('click',()=>{weeklySelection.delete(item.id);renderAll();});
    weeklyMount.append(card);
  });
  weeklyEmpty.hidden=weeklyMount.children.length>0;
  weeklyCount.textContent=`${weeklyMount.children.length} item${weeklyMount.children.length===1?'':'s'} live this week`;
}
function renderLibrary(){
  libraryMount.innerHTML='';
  categoryList().forEach(category=>{
    const group=document.createElement('section');group.className='library-category';
    const header=document.createElement('div');header.className='category-header';const heading=document.createElement('h3');heading.textContent=category;
    const actions=document.createElement('div');actions.className='category-actions';
    const rename=document.createElement('button');rename.type='button';rename.textContent='Rename';rename.addEventListener('click',()=>renameCategory(category));
    const remove=document.createElement('button');remove.type='button';remove.className='delete-category';remove.textContent='Remove';remove.addEventListener('click',()=>removeCategory(category));
    actions.append(rename,remove);header.append(heading,actions);group.append(header);
    const items=document.createElement('div');items.className='category-items';const inCategory=menuCatalogue.filter(item=>cleanCategory(item.category)===category).sort((a,b)=>a.title.localeCompare(b.title));
    if(!inCategory.length){const empty=document.createElement('p');empty.className='category-empty';empty.textContent='No saved items in this category yet.';items.append(empty);}
    inCategory.forEach(item=>{const card=libraryTemplate.content.firstElementChild.cloneNode(true);card.dataset.id=item.id;card.querySelector('h3').textContent=item.title||'Untitled item';attachFields(card,item,renderAll);card.querySelector('.remove-library').addEventListener('click',()=>removeItem(item));items.append(card);});
    group.append(items);libraryMount.append(group);
  });
}
function renderAll(){renderWeeklyLibrary();renderWeekly();renderLibrary();}

function addLibraryItem(category='Other'){const item=normaliseItem({id:makeId(),title:'New menu item',category,description:'',price:'',image:''});menuCatalogue.unshift(item);renderAll();setTab('library');}
function addCategory(){const name=window.prompt('Name your new category:');if(!name)return;const clean=cleanCategory(name);if(categoryList().some(category=>category.localeCompare(clean,undefined,{sensitivity:'accent'})===0)){window.alert('That category already exists.');return;}menuCategories.push(clean);menuCategories=categoryList();renderAll();}
function renameCategory(category){if(category==='Other'){window.alert('The Other category is kept as a safe place for uncategorised items.');return;}const name=window.prompt('Rename category:',category);if(!name)return;const clean=cleanCategory(name);if(clean===category)return;if(categoryList().some(entry=>entry!==category&&entry.localeCompare(clean,undefined,{sensitivity:'accent'})===0)){window.alert('That category already exists.');return;}menuCatalogue.forEach(item=>{if(cleanCategory(item.category)===category)item.category=clean;});menuCategories=menuCategories.map(entry=>entry===category?clean:entry);renderAll();}
function removeCategory(category){if(category==='Other'){window.alert('The Other category cannot be removed.');return;}if(!window.confirm(`Remove “${category}”? Its saved items will move to Other.`))return;menuCatalogue.forEach(item=>{if(cleanCategory(item.category)===category)item.category='Other';});menuCategories=menuCategories.filter(entry=>entry!==category);renderAll();}
function removeItem(item){if(!window.confirm(`Remove “${item.title||'this item'}” permanently from your saved library?`))return;menuCatalogue=menuCatalogue.filter(entry=>entry.id!==item.id);weeklySelection.delete(item.id);pendingPhotos.delete(itemKey(item));renderAll();}

function setTab(tab){const weekly=tab==='weekly';$('#weekly-panel').hidden=!weekly;$('#library-panel').hidden=weekly;$('#weekly-tab').classList.toggle('active',weekly);$('#library-tab').classList.toggle('active',!weekly);$('#weekly-tab').setAttribute('aria-selected',String(weekly));$('#library-tab').setAttribute('aria-selected',String(!weekly));}
$('#weekly-tab').addEventListener('click',()=>setTab('weekly'));
$('#library-tab').addEventListener('click',()=>setTab('library'));
$('#add-category').addEventListener('click',addCategory);
$('#add-library-item').addEventListener('click',()=>addLibraryItem(categoryList()[0]||'Other'));

async function useFolder(handle){
  await handle.getFileHandle('menu.html');selectedDirectoryHandle=handle;
  let data={catalogue:[],selection:[],categories:[]};
  try{const file=await handle.getFileHandle('menu-data.js');data=readMenuData(await (await file.getFile()).text());}catch(error){console.warn(error);}
  menuCatalogue=data.catalogue;menuCategories=data.categories;weeklySelection=new Set(data.selection.filter(id=>menuCatalogue.some(item=>item.id===id)));pendingPhotos.clear();renderAll();editor.hidden=false;setStatus(folderStatus,`Ready to edit: ${handle.name}`);
}
folderButton.addEventListener('click',async()=>{if(!window.showDirectoryPicker){setStatus(folderStatus,'Please open this page in Chrome or Microsoft Edge to use the folder picker.',true);return;}try{const handle=await window.showDirectoryPicker({mode:'readwrite'});await useFolder(handle);await saveFolder(handle);}catch(error){if(error.name!=='AbortError')setStatus(folderStatus,'That folder could not be used. Please choose the Cookies Cakes website folder.',true);}});

function serialiseMenuData(){return `window.menuCatalogue = ${JSON.stringify(menuCatalogue,null,2)};\n\nwindow.menuCategories = ${JSON.stringify(categoryList(),null,2)};\n\nwindow.weeklyMenuSelection = ${JSON.stringify([...weeklySelection],null,2)};\n`;}
function getAllMenuImagePaths(){return [...new Set(menuCatalogue.map(item=>item.image).filter(Boolean))];}
async function saveChanges(){
  if(!selectedDirectoryHandle){setStatus(saveStatus,'Choose the website folder first.',true);return false;}
  try{setStatus(saveStatus,'Saving your menu…');const imagesDirectory=await selectedDirectoryHandle.getDirectoryHandle('images',{create:true});
    for(let index=0;index<menuCatalogue.length;index+=1){const item=menuCatalogue[index];const photo=pendingPhotos.get(itemKey(item));if(!photo)continue;const extension=(photo.name.match(/\.[a-zA-Z0-9]+$/)||['.jpg'])[0].toLowerCase();const safeTitle=(item.title||`item-${index+1}`).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||`item-${index+1}`;const filename=`${Date.now()}-${index+1}-${safeTitle}${extension}`;const imageFile=await imagesDirectory.getFileHandle(filename,{create:true});const writer=await imageFile.createWritable();await writer.write(photo);await writer.close();item.image=`images/${filename}`;}
    const dataFile=await selectedDirectoryHandle.getFileHandle('menu-data.js',{create:true});const writer=await dataFile.createWritable();await writer.write(serialiseMenuData());await writer.close();pendingPhotos.clear();setStatus(saveStatus,`Saved! ${weeklySelection.size} item${weeklySelection.size===1?'':'s'} will appear on this week’s menu.`);renderAll();return true;
  }catch(error){console.error(error);setStatus(saveStatus,'Could not save the menu. Please choose the website folder again and try once more.',true);return false;}
}
$('#menu-form').addEventListener('submit',async event=>{event.preventDefault();await saveChanges();});

const themeToggle=$('#theme-toggle');
function applyTheme(dark){document.body.classList.toggle('dark',dark);themeToggle.textContent=dark?'Light mode':'Dark mode';themeToggle.setAttribute('aria-pressed',String(dark));localStorage.setItem('cookies-cakes-manager-theme',dark?'dark':'light');}
themeToggle.addEventListener('click',()=>applyTheme(!document.body.classList.contains('dark')));
applyTheme(localStorage.getItem('cookies-cakes-manager-theme')==='dark'||(!localStorage.getItem('cookies-cakes-manager-theme')&&matchMedia('(prefers-color-scheme: dark)').matches));
(async()=>{try{const saved=await getSavedFolder();if(!saved)return;const permission=await saved.queryPermission({mode:'readwrite'});if(permission==='granted')await useFolder(saved);else setStatus(folderStatus,'Your Cookies Cakes website folder is remembered. Click “Choose website folder” to reconnect it.');}catch(error){console.warn(error);}})();

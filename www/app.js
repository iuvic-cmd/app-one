/**
 * MY COMPUTER — Windows-style File Manager
 * app.js v3.0 — Full featured: HTML viewer, Image viewer, Video/Audio player,
 *               Copy/Cut/Paste, Multi-select, Drag&Drop, Trash, Search, Export
 */
'use strict';

/* ═══ FILESYSTEM ═══ */
const FS_KEY = 'myComputer_fs';
const TRASH_KEY = 'myComputer_trash';

function defaultFS() {
  const now = Date.now();
  return {
    "C:": { type:"drive", label:"Локальный диск (C:)", children:{
      "Документы":  {type:"folder",created:now,modified:now,children:{}},
      "Загрузки":   {type:"folder",created:now,modified:now,children:{}},
      "Изображения":{type:"folder",created:now,modified:now,children:{}},
      "Музыка":     {type:"folder",created:now,modified:now,children:{}},
      "readme.txt": {type:"file",ext:".txt",created:now,modified:now,
        content:"Добро пожаловать в Мой компьютер v3.0!\n\nФункции:\n• Создание папок и файлов\n• Текстовый редактор\n• Просмотр изображений (pinch-zoom)\n• Видео и аудио плеер\n• HTML просмотрщик\n• Копировать/Вырезать/Вставить\n• Мультивыделение\n• Корзина\n• Поиск файлов\n• Импорт и экспорт файлов"}
    }},
    "D:": { type:"drive", label:"Диск данных (D:)", children:{
      "Проекты": {type:"folder",created:now,modified:now,children:{
        "Мой сайт": {type:"folder",created:now,modified:now,children:{
          "index.html": {type:"file",ext:".html",created:now,modified:now,
            content:"<!DOCTYPE html>\n<html>\n<head><title>Мой сайт</title></head>\n<body>\n  <h1>Привет, мир!</h1>\n  <p>Мой первый сайт</p>\n</body>\n</html>"}
        }}
      }},
      "Видео":  {type:"folder",created:now,modified:now,children:{}},
      "Архив":  {type:"folder",created:now,modified:now,children:{}}
    }}
  };
}

function loadFS()    { try{const r=localStorage.getItem(FS_KEY);return r?JSON.parse(r):defaultFS();}catch{return defaultFS();} }
function loadTrash() { try{const r=localStorage.getItem(TRASH_KEY);return r?JSON.parse(r):[];}catch{return[];} }
function saveFS()    { try{localStorage.setItem(FS_KEY,JSON.stringify(fs));}catch(e){showMsg('Ошибка','Хранилище заполнено: '+e.message);} }
function saveTrash() { try{localStorage.setItem(TRASH_KEY,JSON.stringify(trash));}catch{} }

function getNode(path) {
  if(!path.length) return {type:'root',children:fs};
  let node=fs[path[0]];
  for(let i=1;i<path.length;i++){if(!node||!node.children)return null;node=node.children[path[i]];}
  return node;
}
function formatDate(ts){if(!ts)return'—';const d=new Date(ts);return d.toLocaleDateString('ru-RU')+' '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});}
function formatSize(str){const b=new TextEncoder().encode(str||'').length;if(b<1024)return b+' Б';if(b<1048576)return(b/1024).toFixed(1)+' КБ';return(b/1048576).toFixed(2)+' МБ';}
function countItems(node){return node.children?Object.keys(node.children).length:0;}
function getExt(name){const i=name.lastIndexOf('.');return i>=0?name.slice(i):'.txt';}
function deepClone(obj){return JSON.parse(JSON.stringify(obj));}

/* ═══ STATE ═══ */
let fs            = loadFS();
let trash         = loadTrash();
let currentPath   = [];
let historyStack  = [];
let forwardStack  = [];
let selectedItem  = null;
let selectedItems = {};   // multi-select
let clipboard     = {items:{},operation:null,fromPath:[]};
let viewMode      = 'grid';
let currentEditPath = null;
let editorDirty   = false;
let searchMode    = false;

/* ═══ DOM ═══ */
const $=id=>document.getElementById(id);
const fileGrid    =$('fileGrid');
const emptyHint   =$('emptyHint');
const addressBar  =$('addressBar');
const breadcrumb  =$('breadcrumb');
const folderTree  =$('folderTree');
const statusText  =$('statusText');
const statusCount =$('statusCount');
const titleBarText=$('titleBarText');
const taskbarTitle=$('taskbarTitle');
const detailIcon  =$('detailIcon');
const detailName  =$('detailName');
const detailInfo  =$('detailInfo');
const contextMenu =$('contextMenu');
const modalOverlay=$('modalOverlay');
const editorModal =$('editorModal');
const dialogModal =$('dialogModal');
const propsModal  =$('propsModal');
const msgModal    =$('msgModal');
const startMenu   =$('startMenu');

/* ═══ CLOCK ═══ */
function updateClock(){$('clock').textContent=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});}
setInterval(updateClock,1000);updateClock();

/* ═══ ICONS ═══ */
function svgDrive(l){return`<svg viewBox="0 0 40 40"><rect x="2" y="8" width="36" height="26" rx="3" fill="#c8c8c8" stroke="#999" stroke-width="1"/><rect x="4" y="10" width="32" height="10" rx="1" fill="#b0b0b0"/><rect x="4" y="22" width="20" height="9" rx="1" fill="#d8d8d8"/><circle cx="30" cy="27" r="4" fill="#3a7fd4" stroke="#2060b0" stroke-width="0.5"/><circle cx="30" cy="27" r="1.5" fill="#80b8f0"/><text x="14" y="20" font-size="7" fill="#555" font-weight="bold" text-anchor="middle" font-family="Arial">${l}</text></svg>`;}
function svgFolder(col='#f0c040'){return`<svg viewBox="0 0 40 40"><path d="M3 14 Q3 11 6 11 L16 11 L19 8 L34 8 Q37 8 37 11 L37 30 Q37 33 34 33 L6 33 Q3 33 3 30 Z" fill="${col}" stroke="#d4a020" stroke-width="1"/><path d="M3 16 L37 16 L37 30 Q37 33 34 33 L6 33 Q3 33 3 30 Z" fill="${lighten(col)}" stroke="#d4a020" stroke-width="1"/></svg>`;}
function lighten(hex){try{const n=parseInt(hex.replace('#',''),16);const r=Math.min(255,(n>>16)+30),g=Math.min(255,((n>>8)&0xff)+30),b=Math.min(255,(n&0xff)+30);return'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');}catch{return hex;}}
function svgFile(ext){const cols={'.txt':'#fff','.json':'#fff3cd','.html':'#ffe0cc','.js':'#fff9c4','.css':'#e0f0ff','.md':'#f0fff0','.jpg':'#ffe4e1','.jpeg':'#ffe4e1','.png':'#ffe4e1','.mp4':'#e8e0ff','.mp3':'#fce4ff'};const labs={'.txt':'TXT','.json':'JSON','.html':'HTM','.js':'JS','.css':'CSS','.md':'MD','.jpg':'JPG','.jpeg':'JPG','.png':'PNG','.mp4':'MP4','.mp3':'MP3','.wav':'WAV'};const col=cols[ext]||'#f8f8f8';const lbl=labs[ext]||(ext.replace('.','').toUpperCase().slice(0,4));return`<svg viewBox="0 0 40 40"><path d="M8 3 L26 3 L32 9 L32 37 L8 37 Z" fill="${col}" stroke="#aaa" stroke-width="1"/><path d="M26 3 L26 9 L32 9 Z" fill="#ddd" stroke="#aaa" stroke-width="1"/><text x="20" y="27" font-size="7" fill="#555" font-weight="bold" text-anchor="middle" font-family="Arial">${lbl}</text></svg>`;}
function svgTrash(){return`<svg viewBox="0 0 40 40"><path d="M10 12 L30 12 L28 34 Q28 36 26 36 L14 36 Q12 36 12 34 Z" fill="#c0c0c0" stroke="#888" stroke-width="1"/><rect x="8" y="9" width="24" height="4" rx="1" fill="#b0b0b0" stroke="#888" stroke-width="1"/><rect x="15" y="6" width="10" height="4" rx="1" fill="#b0b0b0" stroke="#888" stroke-width="1"/><line x1="16" y1="16" x2="15" y2="32" stroke="#888" stroke-width="1.5"/><line x1="20" y1="16" x2="20" y2="32" stroke="#888" stroke-width="1.5"/><line x1="24" y1="16" x2="25" y2="32" stroke="#888" stroke-width="1.5"/></svg>`;}
function getIcon(name,node){if(!node)return`<svg viewBox="0 0 40 40"><rect x="4" y="5" width="32" height="22" rx="2" fill="#c8c8c8" stroke="#888" stroke-width="1"/><rect x="6" y="7" width="28" height="18" rx="1" fill="#2060b0"/><rect x="12" y="27" width="16" height="4" fill="#b0b0b0"/><rect x="8" y="31" width="24" height="3" rx="1" fill="#c8c8c8"/></svg>`;if(name==='🗑️ Корзина')return svgTrash();if(node.type==='drive')return svgDrive(name.replace(':',''));if(node.type==='folder')return svgFolder(node.color||'#f0c040');return svgFile(node.ext||'.txt');}
function getEmoji(name,node){if(!node||node.type==='root')return'🖥️';if(name==='🗑️ Корзина')return'🗑️';if(node.type==='drive')return'💾';if(node.type==='folder')return'📁';const m={'.txt':'📄','.json':'📋','.html':'🌐','.js':'📜','.css':'🎨','.md':'📝','.jpg':'🖼️','.jpeg':'🖼️','.png':'🖼️','.mp4':'🎬','.mp3':'🎵','.wav':'🎵','.mp3':'🎵'};return m[node.ext]||'📄';}

/* ═══ NAVIGATION ═══ */
function navigate(path,push=true){if(push){historyStack.push([...currentPath]);forwardStack=[];}currentPath=[...path];selectedItem=null;selectedItems={};searchMode=false;render();}
function goBack(){if(!historyStack.length)return;forwardStack.push([...currentPath]);currentPath=historyStack.pop();selectedItem=null;selectedItems={};render();}
function goForward(){if(!forwardStack.length)return;historyStack.push([...currentPath]);currentPath=forwardStack.pop();selectedItem=null;selectedItems={};render();}
function goUp(){if(currentPath.length)navigate(currentPath.slice(0,-1));}

/* ═══ RENDER ═══ */
function render(){renderNav();renderTree();renderFiles();renderDetails();updateButtons();}

function renderNav(){
  const parts=['Мой компьютер',...currentPath];
  addressBar.textContent=searchMode?'🔍 Результаты поиска':parts.join(' \\ ');
  const title=currentPath.length?currentPath[currentPath.length-1]:'Мой компьютер';
  titleBarText.textContent=title;taskbarTitle.textContent=title;
  breadcrumb.innerHTML='';
  const add=(label,path,active)=>{const sp=document.createElement('span');sp.className='crumb'+(active?' active':'');sp.textContent=label;if(!active)sp.addEventListener('click',()=>navigate(path));breadcrumb.appendChild(sp);};
  add('🖥️ Мой компьютер',[],!currentPath.length&&!searchMode);
  currentPath.forEach((p,i)=>{const sep=document.createElement('span');sep.className='crumb-sep';sep.textContent=' › ';breadcrumb.appendChild(sep);add(p,currentPath.slice(0,i+1),i===currentPath.length-1&&!searchMode);});
}

function renderTree(){
  folderTree.innerHTML='';
  folderTree.appendChild(makeTreeItem('🖥️ Мой компьютер',0,[],!currentPath.length));
  Object.entries(fs).forEach(([dn,dr])=>{
    folderTree.appendChild(makeTreeItem('💾 '+dn,1,[dn],JSON.stringify(currentPath)==='["'+dn+'"]'));
    if(dr.children)Object.entries(dr.children).forEach(([fn,fn2])=>{
      if(fn2.type==='folder'){const fp=[dn,fn];folderTree.appendChild(makeTreeItem('📁 '+fn,2,fp,JSON.stringify(currentPath)===JSON.stringify(fp)));}
    });
  });
  // Trash
  const trashItem=makeTreeItem('🗑️ Корзина',0,'__trash__',currentPath[0]==='__trash__');
  folderTree.appendChild(trashItem);
}
function makeTreeItem(label,indent,path,active){
  const div=document.createElement('div');div.className='tree-item'+(active?' active':'');
  div.innerHTML=`<span style="display:inline-block;width:${indent*12}px"></span>${label}`;
  div.addEventListener('click',()=>{if(path==='__trash__')openTrash();else navigate(path);}); return div;
}

function renderFiles(){
  fileGrid.innerHTML='';
  fileGrid.className='file-grid'+(viewMode==='list'?' list-view':'');
  const node=getNode(currentPath);
  let children={};
  if(!node){emptyHint.style.display='block';return;}
  if(node.type==='root')children=fs;
  else if(node.children)children=node.children;
  const entries=Object.entries(children);
  emptyHint.style.display=entries.length===0?'block':'none';
  entries.sort(([an,av],[bn,bv])=>{const r=n=>n.type==='drive'?0:n.type==='folder'?1:2;if(r(av)!==r(bv))return r(av)-r(bv);return an.localeCompare(bn,'ru');});
  entries.forEach(([name,child])=>fileGrid.appendChild(makeFileItem(name,child)));
  const selCount=Object.keys(selectedItems).length;
  statusCount.textContent=`${entries.length} объект(ов)`;
  statusText.textContent=selCount>0?`Выбрано: ${selCount}`:(selectedItem?`Выбран: ${selectedItem}`:'Готово');
}

function makeFileItem(name,child){
  const item=document.createElement('div');
  item.className='file-item'+(selectedItems[name]?' selected':'');
  item.dataset.name=name;
  if(clipboard.operation==='cut'&&clipboard.items[name])item.style.opacity='0.4';
  const iw=document.createElement('div');iw.className='file-icon-wrap';iw.innerHTML=getIcon(name,child);
  if(child.type==='drive'){const b=document.createElement('div');b.className='drive-badge';b.textContent=name.replace(':','');iw.appendChild(b);}
  const lbl=document.createElement('div');lbl.className='file-label';lbl.textContent=child.type==='drive'?(child.label||name):name;
  item.appendChild(iw);item.appendChild(lbl);
  // Single tap = select
  item.addEventListener('click',e=>{e.stopPropagation();if(e.ctrlKey||e.metaKey){toggleSelect(name);}else{clearMultiSelect();selectItem(name);}});
  // Double tap = open
  let lastTap=0;
  item.addEventListener('click',()=>{const now=Date.now();if(now-lastTap<350){openItem(name);lastTap=0;}else lastTap=now;});
  // Long press = multi-select
  let pressTimer;
  item.addEventListener('touchstart',e=>{
    pressTimer=setTimeout(()=>{if(navigator.vibrate)navigator.vibrate(40);toggleSelect(name);},450);
  },{passive:true});
  item.addEventListener('touchend',()=>clearTimeout(pressTimer));
  item.addEventListener('touchmove',()=>clearTimeout(pressTimer),{passive:true});
  // Context menu
  item.addEventListener('contextmenu',e=>{e.preventDefault();if(!selectedItems[name]){clearMultiSelect();selectItem(name);}showContextMenu(e.clientX,e.clientY,name);});
  let longPress;
  item.addEventListener('touchstart',e=>{longPress=setTimeout(()=>{if(navigator.vibrate)navigator.vibrate(60);if(!selectedItems[name]){clearMultiSelect();selectItem(name);}showContextMenu(e.touches[0].clientX,e.touches[0].clientY,name);},700);},{passive:true});
  item.addEventListener('touchend',()=>clearTimeout(longPress));
  item.addEventListener('touchmove',()=>clearTimeout(longPress),{passive:true});
  return item;
}

function renderDetails(){
  if(selectedItem){
    const node=getNode(currentPath);const ch=node?.type==='root'?fs:(node?.children||{});const child=ch[selectedItem];
    if(child){detailIcon.textContent=getEmoji(selectedItem,child);detailName.textContent=selectedItem;
      const lines=[];
      if(child.type==='drive')lines.push('Тип: Локальный диск');
      else if(child.type==='folder'){lines.push('Тип: Папка');lines.push('Содержит: '+countItems(child)+' эл.');}
      else{lines.push('Тип: '+(child.ext||'').toUpperCase().replace('.',''));lines.push('Размер: '+formatSize(child.content));}
      if(child.modified)lines.push('Изм.: '+formatDate(child.modified));
      detailInfo.textContent=lines.join('\n');return;
    }
  }
  const node=getNode(currentPath);
  if(!currentPath.length){detailIcon.textContent='🖥️';detailName.textContent='Мой компьютер';detailInfo.textContent='Дисков: '+Object.keys(fs).length;}
  else if(node){detailIcon.textContent=getEmoji(currentPath[currentPath.length-1],node);detailName.textContent=currentPath[currentPath.length-1];detailInfo.textContent=node.type==='folder'?'Содержит: '+countItems(node)+' эл.':node.type==='drive'?node.label||'':'';}
}

function selectItem(name){selectedItem=name;document.querySelectorAll('.file-item').forEach(el=>el.classList.toggle('selected',el.dataset.name===name));renderDetails();statusText.textContent='Выбран: '+name;}
function toggleSelect(name){if(selectedItems[name])delete selectedItems[name];else selectedItems[name]=true;selectedItem=name;renderFiles();}
function clearMultiSelect(){selectedItems={};document.querySelectorAll('.file-item').forEach(el=>el.classList.remove('selected'));}
function updateButtons(){$('backBtn').disabled=!historyStack.length;$('forwardBtn').disabled=!forwardStack.length;$('upBtn').disabled=!currentPath.length;}

/* ═══ OPEN ITEM ═══ */
const IMG_EXTS=['.jpg','.jpeg','.png','.gif','.webp','.bmp'];
const VID_EXTS=['.mp4','.webm','.ogg','.mov','.3gp'];
const AUD_EXTS=['.mp3','.wav','.aac','.flac','.m4a','.ogg'];

function openItem(name){
  const node=getNode(currentPath);
  const ch=node?.type==='root'?fs:(node?.children||{});
  const child=ch[name];
  if(!child)return;
  if(child.type==='drive'||child.type==='folder'){navigate([...currentPath,name]);return;}
  if(child.type==='file'){
    const ext=child.ext||'';
    if(ext==='.html')openHtmlViewer([...currentPath,name],child);
    else if(IMG_EXTS.includes(ext))openImageViewer(name,child);
    else if(VID_EXTS.includes(ext))openVideoPlayer(name,child);
    else if(AUD_EXTS.includes(ext))openAudioPlayer(name,child);
    else openEditor([...currentPath,name],child);
  }
}

/* ═══ HTML VIEWER ═══ */
function openHtmlViewer(filePath,node){
  const fname=filePath[filePath.length-1];
  $('htmlViewerTitle').textContent=fname;
  $('htmlViewerPath').textContent=filePath.join(' \\ ');
  const frame=$('htmlViewerFrame'),code=$('htmlViewerCode');
  frame.srcdoc=node.content||'<p style="font-family:sans-serif;padding:20px">Файл пуст</p>';
  frame.style.display='block';code.style.display='none';code.textContent=node.content||'';
  const modeBtn=$('htmlViewerModeBtn').cloneNode(true);$('htmlViewerModeBtn').replaceWith(modeBtn);
  modeBtn.textContent='📝 Код';modeBtn.dataset.mode='preview';
  modeBtn.onclick=function(){if(this.dataset.mode==='preview'){frame.style.display='none';code.style.display='block';this.textContent='🌐 Просмотр';this.dataset.mode='code';}else{frame.style.display='block';code.style.display='none';this.textContent='📝 Код';this.dataset.mode='preview';}};
  const editBtn=$('htmlViewerEditBtn').cloneNode(true);$('htmlViewerEditBtn').replaceWith(editBtn);
  editBtn.onclick=()=>{closeAllModals();openEditor(filePath,node);};
  const closeBtn=$('htmlViewerClose').cloneNode(true);$('htmlViewerClose').replaceWith(closeBtn);
  closeBtn.onclick=closeAllModals;
  modalOverlay.style.display='flex';
  [editorModal,dialogModal,propsModal,msgModal].forEach(m=>m.style.display='none');
  $('htmlViewerModal').style.display='flex';
}

/* ═══ IMAGE VIEWER ═══ */
function openImageViewer(name,child){
  if(!child.content||!child.content.startsWith('data:')){showMsg('Изображение','Файл не сохранён как изображение.\nУдалите и импортируйте заново.','OK');return;}
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.93);z-index:9999;display:flex;flex-direction:column;touch-action:none;';
  const top=document.createElement('div');
  top.style.cssText='height:44px;background:linear-gradient(180deg,#1e88e5,#0a52a8);display:flex;align-items:center;padding:0 8px;flex-shrink:0;';
  top.innerHTML='<span style="color:#fff;font-size:13px;flex:1;font-family:sans-serif">🖼️ '+name+'</span>';
  const cb=document.createElement('button');cb.textContent='✕';cb.style.cssText='background:linear-gradient(180deg,#f06060,#cc2222);color:#fff;border:none;border-radius:2px;width:26px;height:22px;font-size:13px;cursor:pointer;';
  cb.onclick=()=>document.body.removeChild(overlay);top.appendChild(cb);overlay.appendChild(top);
  const cont=document.createElement('div');cont.style.cssText='flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;';
  const img=document.createElement('img');img.src=child.content;img.style.cssText='max-width:100%;max-height:100%;border-radius:4px;transform-origin:center;user-select:none;-webkit-user-select:none;';
  cont.appendChild(img);overlay.appendChild(cont);
  // Info bar
  const info=document.createElement('div');info.style.cssText='background:rgba(0,0,0,0.7);color:#aaa;font-size:11px;font-family:sans-serif;text-align:center;padding:4px;flex-shrink:0;';
  info.textContent=name+(child.size?' • '+Math.round(child.size/1024)+'КБ':'')+'  •  Двойной тап: сброс зума';
  overlay.appendChild(info);
  // Pinch zoom
  let scale=1,posX=0,posY=0,startDist=0,startScale=1,lastPosX=0,lastPosY=0,startTouch=null;
  const dist=(t1,t2)=>Math.hypot(t1.clientX-t2.clientX,t1.clientY-t2.clientY);
  const apply=()=>img.style.transform=`translate(${posX}px,${posY}px) scale(${scale})`;
  cont.addEventListener('touchstart',e=>{
    e.preventDefault();
    if(e.touches.length===2){startDist=dist(e.touches[0],e.touches[1]);startScale=scale;}
    else if(e.touches.length===1){lastPosX=posX;lastPosY=posY;startTouch={x:e.touches[0].clientX,y:e.touches[0].clientY};}
  },{passive:false});
  cont.addEventListener('touchmove',e=>{
    e.preventDefault();
    if(e.touches.length===2){scale=Math.min(5,Math.max(1,startScale*(dist(e.touches[0],e.touches[1])/startDist)));apply();}
    else if(e.touches.length===1&&startTouch&&scale>1){posX=lastPosX+(e.touches[0].clientX-startTouch.x);posY=lastPosY+(e.touches[0].clientY-startTouch.y);apply();}
  },{passive:false});
  cont.addEventListener('touchend',e=>{
    if(scale<1){scale=1;posX=0;posY=0;apply();}
    if(e.changedTouches.length===1){const now=Date.now();if(now-(cont._lt||0)<300){scale=1;posX=0;posY=0;apply();}cont._lt=now;}
  });
  document.body.appendChild(overlay);
}

/* ═══ VIDEO PLAYER ═══ */
function openVideoPlayer(name,child){
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:#000;z-index:9999;display:flex;flex-direction:column;';
  const top=document.createElement('div');
  top.style.cssText='height:44px;background:linear-gradient(180deg,#1e88e5,#0a52a8);display:flex;align-items:center;padding:0 8px;flex-shrink:0;';
  top.innerHTML='<span style="color:#fff;font-size:13px;flex:1;font-family:sans-serif">🎬 '+name+'</span>';
  const cb=document.createElement('button');cb.textContent='✕';cb.style.cssText='background:linear-gradient(180deg,#f06060,#cc2222);color:#fff;border:none;border-radius:2px;width:26px;height:22px;font-size:13px;cursor:pointer;';
  cb.onclick=()=>{vid.pause();vid.src='';document.body.removeChild(overlay);};
  top.appendChild(cb);overlay.appendChild(top);
  if(!child.content||!child.content.startsWith('data:')){
    const msg=document.createElement('div');msg.style.cssText='flex:1;display:flex;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;font-size:14px;text-align:center;padding:24px;';
    msg.innerHTML='⚠️ Видео не сохранено как медиафайл.<br><br>Удалите и импортируйте заново.';
    overlay.appendChild(msg);document.body.appendChild(overlay);return;
  }
  const vid=document.createElement('video');vid.controls=true;vid.autoplay=true;vid.playsinline=true;
  vid.style.cssText='flex:1;width:100%;background:#000;';vid.src=child.content;
  overlay.appendChild(vid);document.body.appendChild(overlay);
}

/* ═══ AUDIO PLAYER ═══ */
function openAudioPlayer(name,child){
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:linear-gradient(135deg,#1a1a2e,#16213e);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;';
  const cb=document.createElement('button');cb.textContent='✕';cb.style.cssText='position:absolute;top:12px;right:12px;background:linear-gradient(180deg,#f06060,#cc2222);color:#fff;border:none;border-radius:50%;width:32px;height:32px;font-size:14px;cursor:pointer;';
  cb.onclick=()=>{aud.pause();aud.src='';document.body.removeChild(overlay);};overlay.appendChild(cb);
  const icon=document.createElement('div');icon.style.cssText='font-size:80px;margin-bottom:20px;animation:pulse 2s infinite;';icon.textContent='🎵';overlay.appendChild(icon);
  const title=document.createElement('div');title.style.cssText='color:#fff;font-size:18px;font-family:sans-serif;font-weight:700;margin-bottom:8px;text-align:center;padding:0 20px;';title.textContent=name;overlay.appendChild(title);
  const aud=document.createElement('audio');aud.controls=true;aud.autoplay=true;aud.style.cssText='width:90%;margin-top:20px;';
  if(child.content&&child.content.startsWith('data:'))aud.src=child.content;
  else{const msg=document.createElement('div');msg.style.cssText='color:#ff8080;font-family:sans-serif;font-size:13px;margin-top:16px;';msg.textContent='⚠️ Импортируйте файл заново';overlay.appendChild(msg);}
  overlay.appendChild(aud);
  // CSS animation
  const style=document.createElement('style');style.textContent='@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}';document.head.appendChild(style);
  document.body.appendChild(overlay);
}

/* ═══ TEXT EDITOR ═══ */
function openEditor(filePath,node,isNew=false){
  currentEditPath=filePath;editorDirty=false;
  $('editorTitle').textContent=filePath[filePath.length-1];
  $('editorPath').textContent=filePath.join(' \\ ');
  $('editorArea').value=node.content||'';
  $('editorArea').style.fontSize=$('editorFontSize').value+'px';
  $('editorStatus').textContent=isNew?'● Новый':'✓ Сохранено';
  $('editorStatus').style.color=isNew?'#cc7700':'green';
  updateEditorStats();showModal(editorModal);
}
function updateEditorStats(){const t=$('editorArea').value;$('editorLines').textContent='Строк: '+t.split('\n').length;$('editorChars').textContent='Символов: '+t.length;}
function saveEditor(){
  if(!currentEditPath)return;
  const p=currentEditPath.slice(0,-1),fname=currentEditPath[currentEditPath.length-1],parent=getNode(p);
  if(!parent?.children)return;
  const now=Date.now();
  if(!parent.children[fname])parent.children[fname]={type:'file',ext:getExt(fname),created:now};
  parent.children[fname].content=$('editorArea').value;parent.children[fname].modified=now;
  saveFS();editorDirty=false;$('editorStatus').textContent='✓ Сохранено';$('editorStatus').style.color='green';renderFiles();
}

/* ═══ MODALS ═══ */
let dialogCb=null,msgCb=null;
function showDialog(title,label,def,showExt,cb){$('dialogTitle').textContent=title;$('dialogLabel').textContent=label;$('dialogInput').value=def||'';$('dialogExtRow').style.display=showExt?'flex':'none';dialogCb=cb;showModal(dialogModal);setTimeout(()=>$('dialogInput').focus(),100);}
function showMsg(title,body,yes='OK',no=null,cb=null){$('msgTitle').textContent=title;$('msgBody').textContent=body;$('msgYes').textContent=yes;$('msgNo').textContent=no||'Нет';$('msgNo').style.display=no?'inline-flex':'none';msgCb=cb;showModal(msgModal);}
function showProperties(name,node){
  const lines=[];
  if(node.type==='drive'){lines.push(['Имя',node.label||name]);lines.push(['Тип','Локальный диск']);lines.push(['Объектов',countItems(node)]);}
  else if(node.type==='folder'){lines.push(['Имя',name]);lines.push(['Тип','Папка']);lines.push(['Содержит',countItems(node)+' объект(ов)']);lines.push(['Создан',formatDate(node.created)]);lines.push(['Изменён',formatDate(node.modified)]);}
  else{lines.push(['Имя',name]);lines.push(['Тип',(node.ext||'').toUpperCase().replace('.','')]);lines.push(['Размер',formatSize(node.content)]);lines.push(['Создан',formatDate(node.created)]);lines.push(['Изменён',formatDate(node.modified)]);}
  $('propsBody').innerHTML='<div class="props-icon">'+getEmoji(name,node)+'</div>'+lines.map(([k,v])=>`<div class="props-row"><div class="props-key">${k}:</div><div class="props-val">${v}</div></div>`).join('');
  showModal(propsModal);
}
function showModal(modal){modalOverlay.style.display='flex';[editorModal,dialogModal,propsModal,msgModal,$('htmlViewerModal')].forEach(m=>m&&(m.style.display='none'));modal.style.display='flex';}
function closeAllModals(){modalOverlay.style.display='none';[editorModal,dialogModal,propsModal,msgModal,$('htmlViewerModal')].forEach(m=>m&&(m.style.display='none'));currentEditPath=null;}

/* ═══ FILE OPERATIONS ═══ */
function createFolder(){
  if(getNode(currentPath)?.type==='root'){showMsg('Ошибка','Нельзя создать папку в корне.');return;}
  showDialog('Создать папку','Имя папки:','Новая папка',false,name=>{
    if(!name.trim())return;const ch=getNode(currentPath)?.children;if(!ch)return;
    if(ch[name]){showMsg('Ошибка','"'+name+'" уже существует.');return;}
    const now=Date.now();ch[name.trim()]={type:'folder',created:now,modified:now,children:{}};saveFS();render();selectItem(name.trim());
  });
}
function createFile(){
  if(getNode(currentPath)?.type==='root'){showMsg('Ошибка','Нельзя создать файл в корне.');return;}
  showDialog('Создать файл','Имя (без расширения):','Новый документ',true,(name,ext)=>{
    if(!name.trim())return;const ch=getNode(currentPath)?.children;if(!ch)return;
    const fn=name.trim()+ext;if(ch[fn]){showMsg('Ошибка','"'+fn+'" уже существует.');return;}
    const now=Date.now();const nn={type:'file',ext,created:now,modified:now,content:''};ch[fn]=nn;saveFS();render();openEditor([...currentPath,fn],nn,true);
  });
}
function deleteItem(name){
  const ch=getNode(currentPath)?.children;if(!ch||!ch[name])return;
  const child=ch[name];if(child.type==='drive'){showMsg('Ошибка','Диск нельзя удалить.');return;}
  showMsg('Удалить','Переместить "'+name+'" в корзину?','В корзину','Отмена',confirmed=>{
    if(!confirmed)return;
    trash.push({name,node:deepClone(child),deletedFrom:[...currentPath],deletedAt:Date.now()});
    delete ch[name];saveFS();saveTrash();selectedItem=null;clearMultiSelect();render();
  });
}
function deleteSelected(){
  const sel=Object.keys(selectedItems);if(!sel.length&&!selectedItem)return;
  const names=sel.length?sel:[selectedItem];
  showMsg('Удалить','Переместить '+names.length+' объект(ов) в корзину?','В корзину','Отмена',confirmed=>{
    if(!confirmed)return;
    const ch=getNode(currentPath)?.children;if(!ch)return;
    names.forEach(name=>{
      if(ch[name]&&ch[name].type!=='drive'){
        trash.push({name,node:deepClone(ch[name]),deletedFrom:[...currentPath],deletedAt:Date.now()});
        delete ch[name];
      }
    });
    saveFS();saveTrash();selectedItem=null;clearMultiSelect();render();
  });
}
function renameItem(name){
  const ch=getNode(currentPath)?.children;if(!ch||!ch[name])return;
  if(ch[name].type==='drive'){showMsg('Ошибка','Диск нельзя переименовать.');return;}
  showDialog('Переименовать','Новое имя:',name,false,newName=>{
    if(!newName.trim()||newName===name)return;
    if(ch[newName]){showMsg('Ошибка','"'+newName+'" уже существует.');return;}
    ch[newName.trim()]=ch[name];if(ch[name].type==='file')ch[newName.trim()].ext=getExt(newName.trim());
    delete ch[name];saveFS();selectedItem=newName.trim();render();
  });
}

/* ═══ COPY/CUT/PASTE ═══ */
function doCopy(){
  const sel=Object.keys(selectedItems).length?Object.keys(selectedItems):(selectedItem?[selectedItem]:[]);
  if(!sel.length){showMsg('Копировать','Выберите файл или папку.');return;}
  const ch=getNode(currentPath)?.type==='root'?fs:(getNode(currentPath)?.children||{});
  const items={};sel.forEach(n=>{if(ch[n])items[n]=deepClone(ch[n]);});
  clipboard={items,operation:'copy',fromPath:[...currentPath]};
  showMsg('Копировать','📋 Скопировано: '+sel.length+' объект(ов)','OK');
}
function doCut(){
  const sel=Object.keys(selectedItems).length?Object.keys(selectedItems):(selectedItem?[selectedItem]:[]);
  if(!sel.length){showMsg('Вырезать','Выберите файл или папку.');return;}
  const ch=getNode(currentPath)?.type==='root'?fs:(getNode(currentPath)?.children||{});
  const items={};sel.forEach(n=>{if(ch[n])items[n]=deepClone(ch[n]);});
  clipboard={items,operation:'cut',fromPath:[...currentPath]};
  showMsg('Вырезать','✂️ Вырезано: '+sel.length+' объект(ов)','OK');renderFiles();
}
function doPaste(){
  if(!clipboard.operation){showMsg('Вставить','Буфер обмена пуст.');return;}
  if(!currentPath.length){showMsg('Вставить','Нельзя вставить в корень.');return;}
  const dest=getNode(currentPath);if(!dest?.children){showMsg('Вставить','Выберите папку.');return;}
  let count=0;
  Object.entries(clipboard.items).forEach(([name,node])=>{
    let nn=name;if(dest.children[nn])nn=nn.replace(/(\.[\w]+)?$/,' — копия$1');
    dest.children[nn]=deepClone(node);count++;
  });
  if(clipboard.operation==='cut'){
    const src=getNode(clipboard.fromPath);const sch=src?.type==='root'?fs:(src?.children||{});
    Object.keys(clipboard.items).forEach(n=>delete sch[n]);
    clipboard={items:{},operation:null,fromPath:[]};
  }
  saveFS();clearMultiSelect();render();showMsg('Вставить','✅ Вставлено: '+count+' объект(ов)','OK');
}

/* ═══ EXPORT FILE ═══ */
function exportFile(name,child){
  if(!child||child.type==='folder'||child.type==='drive'){showMsg('Экспорт','Выберите файл для экспорта.');return;}
  try{
    let blob,filename=name;
    if(child.content&&child.content.startsWith('data:')){
      const arr=child.content.split(',');const mime=arr[0].match(/:(.*?);/)[1];const bstr=atob(arr[1]);const u8=new Uint8Array(bstr.length);for(let i=0;i<bstr.length;i++)u8[i]=bstr.charCodeAt(i);blob=new Blob([u8],{type:mime});
    } else {
      blob=new Blob([child.content||''],{type:'text/plain;charset=utf-8'});
    }
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    showMsg('Экспорт','✅ Файл "'+name+'" экспортирован в Загрузки','OK');
  }catch(e){showMsg('Ошибка','Не удалось экспортировать: '+e.message);}
}

/* ═══ SEARCH ═══ */
function doSearch(){
  showDialog('Поиск файлов','Введите имя файла:','',false,query=>{
    if(!query.trim())return;
    const results={};const q=query.toLowerCase();
    function searchIn(children,path){
      Object.entries(children).forEach(([name,node])=>{
        if(name.toLowerCase().includes(q))results[path.concat(name).join(' \\ ')]=node;
        if(node.children)searchIn(node.children,[...path,name]);
      });
    }
    searchIn(fs,[]);
    if(!Object.keys(results).length){showMsg('Поиск','Файлы не найдены по запросу "'+query+'"','OK');return;}
    // Show results
    fileGrid.innerHTML='';fileGrid.className='file-grid';
    emptyHint.style.display='none';searchMode=true;
    addressBar.textContent='🔍 Поиск: "'+query+'" — найдено '+Object.keys(results).length;
    statusCount.textContent=Object.keys(results).length+' найдено';
    Object.entries(results).forEach(([path,node])=>{
      const name=path.split(' \\ ').pop();
      const item=makeFileItem(name,node);
      const pathLabel=document.createElement('div');pathLabel.style.cssText='font-size:9px;color:#888;width:100%;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';pathLabel.textContent=path;
      item.appendChild(pathLabel);fileGrid.appendChild(item);
    });
  });
}

/* ═══ TRASH ═══ */
function openTrash(){
  currentPath=['__trash__'];searchMode=false;
  fileGrid.innerHTML='';fileGrid.className='file-grid';
  addressBar.textContent='🗑️ Корзина';titleBarText.textContent='Корзина';
  breadcrumb.innerHTML='<span class="crumb active">🗑️ Корзина</span>';
  if(!trash.length){emptyHint.style.display='block';emptyHint.innerHTML='Корзина пуста.';statusCount.textContent='0 объект(ов)';return;}
  emptyHint.style.display='none';
  trash.forEach((item,idx)=>{
    const el=document.createElement('div');el.className='file-item';
    const iw=document.createElement('div');iw.className='file-icon-wrap';iw.innerHTML=getIcon(item.name,item.node);
    const lbl=document.createElement('div');lbl.className='file-label';lbl.textContent=item.name;
    el.appendChild(iw);el.appendChild(lbl);
    el.addEventListener('click',e=>{e.stopPropagation();el.classList.toggle('selected');});
    let lastTap=0;
    el.addEventListener('click',()=>{const now=Date.now();if(now-lastTap<350){restoreTrashItem(idx);lastTap=0;}else lastTap=now;});
    fileGrid.appendChild(el);
  });
  statusCount.textContent=trash.length+' объект(ов)';
  // Add empty trash button
  const emptyBtn=document.createElement('button');emptyBtn.style.cssText='position:absolute;bottom:30px;right:12px;background:linear-gradient(180deg,#f06060,#cc2222);color:#fff;border:none;border-radius:4px;padding:8px 14px;font-size:12px;cursor:pointer;';
  emptyBtn.textContent='🗑️ Очистить корзину';emptyBtn.onclick=emptyTrash;
  $('rightPanel').style.position='relative';$('rightPanel').appendChild(emptyBtn);
}
function restoreTrashItem(idx){
  const item=trash[idx];const dest=getNode(item.deletedFrom);
  if(dest&&dest.children){
    let name=item.name;if(dest.children[name])name=name.replace(/(\.[\w]+)?$/,' — восстановлен$1');
    dest.children[name]=item.node;trash.splice(idx,1);saveFS();saveTrash();
    showMsg('Корзина','✅ "'+item.name+'" восстановлен','OK');navigate(item.deletedFrom);
  } else {showMsg('Ошибка','Папка назначения не найдена.\nФайл будет восстановлен в C:','OK');const c=fs['C:'].children;c[item.name]=item.node;trash.splice(idx,1);saveFS();saveTrash();navigate(['C:']);}
}
function emptyTrash(){showMsg('Корзина','Удалить все файлы в корзине безвозвратно?','Очистить','Отмена',confirmed=>{if(!confirmed)return;trash=[];saveTrash();openTrash();});}

/* ═══ CONTEXT MENU ═══ */
let ctxTarget=null;
function showContextMenu(x,y,name){
  ctxTarget=name;
  contextMenu.style.left=Math.min(x,window.innerWidth-175)+'px';
  contextMenu.style.top=Math.min(y,window.innerHeight-220-36)+'px';
  contextMenu.style.display='block';
  const node=getNode(currentPath);const ch=node?.type==='root'?fs:(node?.children||{});const child=name?ch[name]:null;
  contextMenu.querySelectorAll('[data-action]').forEach(el=>{
    const a=el.dataset.action;
    if(a==='open')el.style.display=child?'block':'none';
    if(a==='rename')el.style.display=(child&&child.type!=='drive')?'block':'none';
    if(a==='delete')el.style.display=(child&&child.type!=='drive')?'block':'none';
    if(a==='properties')el.style.display=child?'block':'none';
    if(a==='export')el.style.display=(child&&child.type==='file')?'block':'none';
    if(a==='newFolder'||a==='newFile')el.style.display=currentPath.length>=1&&currentPath[0]!=='__trash__'?'block':'none';
    if(a==='copy'||a==='cut')el.style.display=child?'block':'none';
    if(a==='paste')el.style.display=clipboard.operation?'block':'none';
  });
}
function hideContextMenu(){contextMenu.style.display='none';}

// Update context menu HTML to add more items
document.addEventListener('DOMContentLoaded',function(){
  const ctx=$('contextMenu');
  // Add copy/cut/paste/export/search
  const items=[
    {sep:true},
    {action:'copy',  label:'📋 Копировать'},
    {action:'cut',   label:'✂️ Вырезать'},
    {action:'paste', label:'📌 Вставить'},
    {sep:true},
    {action:'export',label:'📤 Экспортировать'},
    {action:'search',label:'🔍 Поиск'},
  ];
  items.forEach(item=>{
    if(item.sep){const s=document.createElement('div');s.className='ctx-sep';ctx.appendChild(s);}
    else{const d=document.createElement('div');d.className='ctx-item';d.dataset.action=item.action;d.textContent=item.label;ctx.appendChild(d);}
  });
});

contextMenu.querySelectorAll('[data-action]').forEach(el=>{
  el.addEventListener('click',e=>{e.stopPropagation();const a=el.dataset.action;hideContextMenu();
    switch(a){
      case 'open':if(ctxTarget)openItem(ctxTarget);break;
      case 'newFolder':createFolder();break;
      case 'newFile':createFile();break;
      case 'rename':if(ctxTarget)renameItem(ctxTarget);break;
      case 'delete':if(ctxTarget)deleteItem(ctxTarget);break;
      case 'copy':doCopy();break;case 'cut':doCut();break;case 'paste':doPaste();break;
      case 'export':{const n=getNode(currentPath);const ch=n?.type==='root'?fs:(n?.children||{});if(ctxTarget&&ch[ctxTarget])exportFile(ctxTarget,ch[ctxTarget]);break;}
      case 'search':doSearch();break;
      case 'properties':{const n=getNode(currentPath);const ch=n?.type==='root'?fs:(n?.children||{});if(ctxTarget&&ch[ctxTarget])showProperties(ctxTarget,ch[ctxTarget]);break;}
    }
  });
});

/* ═══ TOOLBAR EVENTS ═══ */
$('backBtn').addEventListener('click',goBack);
$('forwardBtn').addEventListener('click',goForward);
$('upBtn').addEventListener('click',goUp);
$('viewToggleBtn').addEventListener('click',()=>{viewMode=viewMode==='grid'?'list':'grid';renderFiles();});
$('importBtn').addEventListener('click',importFile);

/* ═══ SIDEBAR TASKS ═══ */
document.addEventListener('DOMContentLoaded',function(){
  // Add extra task buttons
  const tl=document.querySelector('.task-list');
  const tasks=[
    {id:'taskImport',   text:'📥 Импорт файла'},
    {id:'taskNewFolder',text:'📁 Новая папка'},
    {id:'taskNewFile',  text:'📄 Новый файл'},
    {id:'taskCopy',     text:'📋 Копировать'},
    {id:'taskCut',      text:'✂️ Вырезать'},
    {id:'taskPaste',    text:'📌 Вставить'},
    {id:'taskExport',   text:'📤 Экспорт файла'},
    {id:'taskSearch',   text:'🔍 Поиск'},
    {id:'taskDelete',   text:'🗑️ Удалить'},
    {id:'taskRename',   text:'✏️ Переименовать'},
    {id:'taskProperties',text:'ℹ️ Свойства'},
  ];
  tl.innerHTML='';
  tasks.forEach(t=>{const d=document.createElement('div');d.className='task-item';d.id=t.id;d.textContent=t.text;tl.appendChild(d);});
  $('taskImport').addEventListener('click',importFile);
  $('taskNewFolder').addEventListener('click',createFolder);
  $('taskNewFile').addEventListener('click',createFile);
  $('taskCopy').addEventListener('click',doCopy);
  $('taskCut').addEventListener('click',doCut);
  $('taskPaste').addEventListener('click',doPaste);
  $('taskExport').addEventListener('click',()=>{const n=getNode(currentPath);const ch=n?.type==='root'?fs:(n?.children||{});if(selectedItem&&ch[selectedItem])exportFile(selectedItem,ch[selectedItem]);else showMsg('Экспорт','Выберите файл для экспорта.');});
  $('taskSearch').addEventListener('click',doSearch);
  $('taskDelete').addEventListener('click',()=>{const sel=Object.keys(selectedItems);if(sel.length>0)deleteSelected();else if(selectedItem)deleteItem(selectedItem);else showMsg('Удаление','Ничего не выбрано.');});
  $('taskRename').addEventListener('click',()=>{if(selectedItem)renameItem(selectedItem);else showMsg('Переименование','Ничего не выбрано.');});
  $('taskProperties').addEventListener('click',()=>{if(!selectedItem){showMsg('Свойства','Ничего не выбрано.');return;}const n=getNode(currentPath);const ch=n?.type==='root'?fs:(n?.children||{});if(ch[selectedItem])showProperties(selectedItem,ch[selectedItem]);});
});

/* ═══ TITLE BAR ═══ */
$('closeBtn').addEventListener('click',()=>{if(window.Capacitor?.Plugins?.App)window.Capacitor.Plugins.App.exitApp();else window.close();});
$('minBtn').addEventListener('click',()=>showMsg('Свернуть','Не поддерживается в браузере.','OK'));
$('maxBtn').addEventListener('click',()=>showMsg('Развернуть','Уже полноэкранный режим.','OK'));

/* ═══ CLICK HANDLERS ═══ */
$('rightPanel').addEventListener('contextmenu',e=>{e.preventDefault();if(!e.target.closest('.file-item')){ctxTarget=null;clearMultiSelect();selectedItem=null;renderFiles();showContextMenu(e.clientX,e.clientY,null);}});
document.addEventListener('click',e=>{
  if(!e.target.closest('.file-item')&&!e.target.closest('.context-menu'))hideContextMenu();
  if(!e.target.closest('.file-item')&&!e.target.closest('#htmlViewerModal')){clearMultiSelect();selectedItem=null;document.querySelectorAll('.file-item').forEach(el=>el.classList.remove('selected'));statusText.textContent='Готово';renderDetails();}
  if(!e.target.closest('.start-menu')&&!e.target.closest('.taskbar-start'))startMenu.style.display='none';
});
modalOverlay.addEventListener('click',e=>{
  if(e.target!==modalOverlay)return;
  if($('htmlViewerModal')?.style.display!=='none')return;
  const vis=[editorModal,dialogModal,propsModal,msgModal].find(m=>m.style.display!=='none');
  if(vis===editorModal&&editorDirty)return;
  if(vis!==dialogModal&&vis!==msgModal)closeAllModals();
});

/* ═══ EDITOR EVENTS ═══ */
$('editorArea').addEventListener('input',()=>{editorDirty=true;$('editorStatus').textContent='● Не сохранено';$('editorStatus').style.color='#cc7700';updateEditorStats();});
$('editorFontSize').addEventListener('change',e=>$('editorArea').style.fontSize=e.target.value+'px');
$('editorWrap').addEventListener('change',e=>{$('editorArea').style.whiteSpace=e.target.value==='on'?'pre-wrap':'pre';$('editorArea').style.overflowX=e.target.value==='on'?'hidden':'auto';});
$('editorSave').addEventListener('click',saveEditor);
$('editorSaveAs').addEventListener('click',()=>{
  const cur=currentEditPath?currentEditPath[currentEditPath.length-1]:'Документ';
  const base=cur.includes('.')?cur.slice(0,cur.lastIndexOf('.')):cur;
  showDialog('Сохранить как...','Имя файла:',base,true,(name,ext)=>{
    if(!name.trim())return;const sp=[...(currentEditPath?.slice(0,-1)||currentPath)];const pn=getNode(sp);if(!pn?.children)return;
    const fn=name.trim()+ext;const now=Date.now();pn.children[fn]={type:'file',ext,created:pn.children[fn]?.created||now,modified:now,content:$('editorArea').value};
    saveFS();currentEditPath=[...sp,fn];$('editorTitle').textContent=fn;$('editorPath').textContent=currentEditPath.join(' \\ ');
    editorDirty=false;$('editorStatus').textContent='✓ Сохранено';$('editorStatus').style.color='green';render();
  });
});
$('editorClose').addEventListener('click',()=>{if(editorDirty)showMsg('Редактор','Сохранить изменения?','Сохранить','Не сохранять',yes=>{if(yes)saveEditor();closeAllModals();});else closeAllModals();});

/* ═══ DIALOG EVENTS ═══ */
$('dialogOk').addEventListener('click',()=>{const n=$('dialogInput').value.trim(),e=$('dialogExt').value;closeAllModals();if(dialogCb){dialogCb(n,e);dialogCb=null;}});
$('dialogCancel').addEventListener('click',()=>{closeAllModals();dialogCb=null;});
$('dialogClose').addEventListener('click',()=>{closeAllModals();dialogCb=null;});
$('dialogInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('dialogOk').click();if(e.key==='Escape')$('dialogCancel').click();});
$('propsClose').addEventListener('click',closeAllModals);$('propsOk').addEventListener('click',closeAllModals);
$('msgYes').addEventListener('click',()=>{const cb=msgCb;msgCb=null;closeAllModals();if(cb)cb(true);});
$('msgNo').addEventListener('click',()=>{const cb=msgCb;msgCb=null;closeAllModals();if(cb)cb(false);});
$('msgClose').addEventListener('click',()=>{const cb=msgCb;msgCb=null;closeAllModals();if(cb)cb(false);});

/* ═══ START MENU ═══ */
$('startBtn').addEventListener('click',e=>{e.stopPropagation();startMenu.style.display=startMenu.style.display==='none'?'block':'none';});
$('smMyComputer').addEventListener('click',()=>{startMenu.style.display='none';navigate([]);});
$('smNewFolder').addEventListener('click',()=>{startMenu.style.display='none';createFolder();});
$('smNewFile').addEventListener('click',()=>{startMenu.style.display='none';createFile();});
$('smAbout').addEventListener('click',()=>{startMenu.style.display='none';showMsg('О программе','Мой компьютер v3.0\n\nФайловый менеджер для Android\nв стиле Windows Explorer.\n\nФункции:\n• Просмотр фото/видео/аудио\n• HTML просмотрщик\n• Копировать/Вырезать/Вставить\n• Корзина\n• Поиск файлов\n• Экспорт файлов','OK');});
$('smClear').addEventListener('click',()=>{startMenu.style.display='none';showMsg('Очистить','Удалить ВСЕ файлы и папки?','Удалить всё','Отмена',c=>{if(!c)return;localStorage.removeItem(FS_KEY);localStorage.removeItem(TRASH_KEY);fs=defaultFS();trash=[];currentPath=[];historyStack=[];forwardStack=[];selectedItem=null;clearMultiSelect();render();});});

/* ═══ KEYBOARD ═══ */
document.addEventListener('keydown',e=>{
  if(modalOverlay.style.display!=='none')return;
  if(e.key==='Backspace'&&!e.target.closest('input,textarea')){e.preventDefault();goBack();}
  if(e.key==='F5'){e.preventDefault();render();}
  if(e.key==='Delete'){const sel=Object.keys(selectedItems);if(sel.length)deleteSelected();else if(selectedItem)deleteItem(selectedItem);}
  if(e.key==='F2'&&selectedItem)renameItem(selectedItem);
  if(e.key==='Enter'&&selectedItem)openItem(selectedItem);
  if(e.key==='Escape'){clearMultiSelect();selectedItem=null;renderFiles();}
  if(e.ctrlKey){
    if(e.key==='c'){e.preventDefault();doCopy();}
    if(e.key==='x'){e.preventDefault();doCut();}
    if(e.key==='v'){e.preventDefault();doPaste();}
    if(e.key==='f'){e.preventDefault();doSearch();}
    if(e.key==='s'&&editorModal.style.display!=='none'){e.preventDefault();saveEditor();}
    if(e.key==='a'){e.preventDefault();const n=getNode(currentPath);const ch=n?.type==='root'?fs:(n?.children||{});Object.keys(ch).forEach(k=>selectedItems[k]=true);renderFiles();}
  }
});

/* ═══ IMPORT ═══ */
function importFile(){
  if(!currentPath.length||currentPath[0]==='__trash__'){showMsg('Импорт','Откройте папку для импорта.','OK');return;}
  const node=getNode(currentPath);if(!node?.children){showMsg('Импорт','Выберите папку внутри диска.','OK');return;}
  const inp=document.getElementById('realImportInput');if(inp){inp.value='';inp.click();}
}

document.addEventListener('DOMContentLoaded',function(){
  const inp=document.createElement('input');inp.type='file';inp.id='realImportInput';inp.multiple=true;inp.accept='*/*';
  inp.style.cssText='position:fixed;top:-100px;left:-100px;opacity:0;width:1px;height:1px;';
  document.body.appendChild(inp);
  const MEDIA=['.jpg','.jpeg','.png','.gif','.webp','.bmp','.mp4','.webm','.mov','.3gp','.mp3','.wav','.aac','.m4a','.flac'];
  const TEXT=['.txt','.json','.html','.js','.css','.md','.csv','.xml','.ts','.py','.sql','.java','.php'];
  inp.addEventListener('change',async function(){
    if(!currentPath.length){showMsg('Импорт','Откройте папку сначала.','OK');return;}
    const parent=getNode(currentPath);if(!parent?.children){showMsg('Импорт','Выберите папку внутри диска.','OK');return;}
    let count=0;
    for(const file of Array.from(inp.files)){
      const ext=file.name.includes('.')?file.name.slice(file.name.lastIndexOf('.')).toLowerCase():'.txt';
      const now=Date.now();let name=file.name;
      if(parent.children[name])name=name.replace(ext,'_copy'+ext);
      try{
        let content;
        if(MEDIA.includes(ext)){
          content=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(file);});
        } else if(TEXT.includes(ext)){
          content=await file.text();
        } else {
          content='[binary] '+file.name+' ('+Math.round(file.size/1024)+'КБ)';
        }
        parent.children[name]={type:'file',ext,created:now,modified:now,content,size:file.size};count++;
      }catch(e){console.log(e);}
    }
    if(count>0){saveFS();render();showMsg('Импорт','✅ Импортировано: '+count+' файл(ов)','OK');}
    inp.value='';
  });
});

/* ═══ INIT ═══ */
render();
console.log('🖥️ My Computer v3.0 ready');

// ═══ CAPACITOR FILESYSTEM STORAGE ═══
(function(){
  if(!window.Capacitor||!window.Capacitor.Plugins||!window.Capacitor.Plugins.Filesystem) {
    console.log('Capacitor FS not available - using localStorage');
    return;
  }
  const FS = window.Capacitor.Plugins.Filesystem;
  const DIR = 'DOCUMENTS';
  const BASE = 'MyComputer';

  // Request permissions
  FS.requestPermissions().catch(()=>{});

  // Save FS to device
  async function saveToDevice(data, filename) {
    try {
      await FS.writeFile({
        path: BASE+'/'+filename,
        data: btoa(unescape(encodeURIComponent(JSON.stringify(data)))),
        directory: DIR,
        recursive: true
      });
    } catch(e){ console.log('saveToDevice error:',e); }
  }

  // Load FS from device
  async function loadFromDevice(filename) {
    try {
      const r = await FS.readFile({path:BASE+'/'+filename,directory:DIR});
      return JSON.parse(decodeURIComponent(escape(atob(r.data))));
    } catch(e){ return null; }
  }

  // Save media file to device
  async function saveMedia(filename, base64data) {
    try {
      const b64 = base64data.includes(',') ? base64data.split(',')[1] : base64data;
      await FS.writeFile({
        path: BASE+'/media/'+filename,
        data: b64,
        directory: DIR,
        recursive: true
      });
      return true;
    } catch(e){ console.log('saveMedia error:',e); return false; }
  }

  // Load media from device
  async function loadMedia(filename) {
    try {
      const r = await FS.readFile({path:BASE+'/media/'+filename,directory:DIR});
      return r.data; // base64
    } catch(e){ return null; }
  }

  // Override saveFS to also save to device
  const _origSaveFS = window.saveFS || saveFS;
  window.saveFS = function() {
    _origSaveFS();
    saveToDevice(fs, 'fs.json');
    saveToDevice(trash, 'trash.json');
  };

  // Override import to save media to device
  document.addEventListener('DOMContentLoaded', function(){
    const inp = document.getElementById('realImportInput');
    if(!inp) return;
    const MEDIA=['.jpg','.jpeg','.png','.gif','.webp','.bmp','.mp4','.webm','.mov','.3gp','.mp3','.wav','.aac','.m4a'];
    const TEXT=['.txt','.json','.html','.js','.css','.md','.csv','.xml','.py','.sql'];

    inp.addEventListener('change', async function(){
      if(!currentPath.length){showMsg('Импорт','Откройте папку сначала.','OK');return;}
      const parent=getNode(currentPath);
      if(!parent||!parent.children){showMsg('Импорт','Выберите папку.','OK');return;}
      let count=0;

      for(const file of Array.from(inp.files)){
        const ext=file.name.includes('.')?file.name.slice(file.name.lastIndexOf('.')).toLowerCase():'.txt';
        const now=Date.now(); let name=file.name;
        if(parent.children[name]) name=name.replace(ext,'_copy'+ext);
        try{
          if(MEDIA.includes(ext)){
            // Read as base64
            const b64full=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(file);});
            // Save to device memory
            const saved=await saveMedia(name, b64full);
            if(saved){
              // Store only reference — not base64 in localStorage!
              parent.children[name]={type:'file',ext,created:now,modified:now,
                content:'device://'+name,
                deviceFile:name,
                size:file.size,
                isDevice:true
              };
            } else {
              // Fallback to base64 in localStorage
              parent.children[name]={type:'file',ext,created:now,modified:now,content:b64full,size:file.size};
            }
          } else if(TEXT.includes(ext)){
            const text=await file.text();
            parent.children[name]={type:'file',ext,created:now,modified:now,content:text};
          } else {
            const b64full=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(file);});
            const saved=await saveMedia(name,b64full);
            parent.children[name]={type:'file',ext,created:now,modified:now,
              content:saved?'device://'+name:('[binary] '+file.name),
              deviceFile:saved?name:null,size:file.size,isDevice:saved};
          }
          count++;
        }catch(e){console.log(e);}
      }
      if(count>0){window.saveFS();render();showMsg('Импорт','✅ Сохранено в Documents/MyComputer: '+count+' файл(ов)','OK');}
      inp.value='';
    }, true);
  });

  // Override openItem to load media from device
  const _origOpen = window.openItem || openItem;
  window.openItem = async function(name){
    const node=getNode(currentPath);
    const ch=node&&node.type==='root'?fs:(node&&node.children||{});
    const child=ch[name];
    if(child&&child.isDevice&&child.deviceFile){
      const b64=await loadMedia(child.deviceFile);
      if(b64){
        // Create temp node with real data
        const tempNode={...child, content:'data:application/octet-stream;base64,'+b64};
        // Detect type and open
        const ext=child.ext||'';
        if(['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)){
          const imgNode={...tempNode,content:'data:image/'+ext.replace('.','').replace('jpg','jpeg')+';base64,'+b64};
          openImageViewer(name,imgNode);
        } else if(['.mp4','.webm','.mov'].includes(ext)){
          const vidNode={...tempNode,content:'data:video/'+ext.replace('.','')+ ';base64,'+b64};
          openVideoPlayer(name,vidNode);
        } else if(['.mp3','.wav','.aac'].includes(ext)){
          const audNode={...tempNode,content:'data:audio/'+ext.replace('.','')+ ';base64,'+b64};
          openAudioPlayer(name,audNode);
        } else {
          _origOpen(name);
        }
      } else {
        showMsg('Ошибка','Файл не найден на устройстве.\nВозможно был удалён вне приложения.','OK');
      }
    } else {
      _origOpen(name);
    }
  };

  // Load FS from device on startup (override localStorage)
  loadFromDevice('fs.json').then(data=>{
    if(data){
      fs=data;
      loadFromDevice('trash.json').then(t=>{if(t)trash=t;render();});
    }
  });

  console.log('✅ Capacitor Filesystem initialized - Documents/MyComputer/');
})();

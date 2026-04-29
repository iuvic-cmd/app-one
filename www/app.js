/**
 * MY COMPUTER v4.0
 * - No duplicate event handlers
 * - No memory leaks in modals
 * - Capacitor FS for device storage
 * - Proper multi-select, copy/cut/paste
 * - Trash, Search, Export, Media viewers
 */
'use strict';

/* ══════════════════════════════════════
   STORAGE
══════════════════════════════════════ */
const FS_KEY    = 'mc_fs';
const TRASH_KEY = 'mc_trash';

function defaultFS() {
  const n = Date.now();
  return {
    'C:': { type:'drive', label:'Локальный диск (C:)', children:{
      'Документы':   {type:'folder',created:n,modified:n,children:{}},
      'Загрузки':    {type:'folder',created:n,modified:n,children:{}},
      'Изображения': {type:'folder',created:n,modified:n,children:{}},
      'Музыка':      {type:'folder',created:n,modified:n,children:{}},
      'readme.txt':  {type:'file',ext:'.txt',created:n,modified:n,
        content:'Мой компьютер v4.0\n\nФункции:\n• Просмотр фото/видео/аудио\n• HTML просмотрщик\n• Копировать/Вырезать/Вставить\n• Корзина\n• Поиск\n• Экспорт файлов\n• Хранение в памяти телефона'}
    }},
    'D:': { type:'drive', label:'Диск данных (D:)', children:{
      'Проекты': {type:'folder',created:n,modified:n,children:{
        'Мой сайт': {type:'folder',created:n,modified:n,children:{
          'index.html': {type:'file',ext:'.html',created:n,modified:n,
            content:'<!DOCTYPE html>\n<html>\n<head><title>Мой сайт</title></head>\n<body>\n<h1>Привет!</h1>\n</body>\n</html>'}
        }}
      }},
      'Видео': {type:'folder',created:n,modified:n,children:{}},
      'Архив': {type:'folder',created:n,modified:n,children:{}}
    }}
  };
}

let fs    = (() => { try{const r=localStorage.getItem(FS_KEY);return r?JSON.parse(r):defaultFS();}catch{return defaultFS();} })();
let trash = (() => { try{const r=localStorage.getItem(TRASH_KEY);return r?JSON.parse(r):[];}catch{return[];} })();

function saveFS()    { try{localStorage.setItem(FS_KEY,JSON.stringify(fs));}catch(e){showMsg('Ошибка','Хранилище заполнено');} capSave(); }
function saveTrash() { try{localStorage.setItem(TRASH_KEY,JSON.stringify(trash));}catch{} }
function clone(o)    { return JSON.parse(JSON.stringify(o)); }

function getNode(path) {
  if(!path||!path.length) return {type:'root',children:fs};
  let node = fs[path[0]];
  for(let i=1;i<path.length;i++){if(!node?.children)return null;node=node.children[path[i]];}
  return node||null;
}
function getChildren(path) {
  const n=getNode(path);if(!n)return null;
  return n.type==='root'?fs:n.children||null;
}
function formatDate(ts){if(!ts)return'—';const d=new Date(ts);return d.toLocaleDateString('ru-RU')+' '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});}
function formatSize(s){const b=new TextEncoder().encode(s||'').length;if(b<1024)return b+' Б';if(b<1048576)return(b/1024).toFixed(1)+' КБ';return(b/1048576).toFixed(2)+' МБ';}
function countItems(n){return n?.children?Object.keys(n.children).length:0;}
function getExt(name){const i=name.lastIndexOf('.');return i>=0?name.slice(i):'.txt';}

/* ══════════════════════════════════════
   CAPACITOR FS
══════════════════════════════════════ */
let CAP_FS = null;
const CAP_DIR = 'DOCUMENTS';
const CAP_BASE = 'MyComputer';

function capInit() {
  try {
    if(window.Capacitor?.Plugins?.Filesystem) {
      CAP_FS = window.Capacitor.Plugins.Filesystem;
      CAP_FS.requestPermissions().catch(()=>{});
      console.log('✅ Capacitor FS ready');
    }
  } catch(e) { console.log('No Capacitor FS'); }
}

async function capSave() {
  if(!CAP_FS) return;
  try {
    const data = btoa(unescape(encodeURIComponent(JSON.stringify(fs))));
    await CAP_FS.writeFile({path:CAP_BASE+'/fs.json',data,directory:CAP_DIR,recursive:true});
  } catch(e) {}
}

async function capLoad() {
  if(!CAP_FS) return false;
  try {
    const r = await CAP_FS.readFile({path:CAP_BASE+'/fs.json',directory:CAP_DIR});
    fs = JSON.parse(decodeURIComponent(escape(atob(r.data))));
    return true;
  } catch(e) { return false; }
}

async function capSaveMedia(filename, b64full) {
  if(!CAP_FS) return false;
  try {
    const b64 = b64full.includes(',') ? b64full.split(',')[1] : b64full;
    await CAP_FS.writeFile({path:CAP_BASE+'/media/'+filename,data:b64,directory:CAP_DIR,recursive:true});
    return true;
  } catch(e) { return false; }
}

async function capLoadMedia(filename) {
  if(!CAP_FS) return null;
  try {
    const r = await CAP_FS.readFile({path:CAP_BASE+'/media/'+filename,directory:CAP_DIR});
    return r.data;
  } catch(e) { return null; }
}

/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let currentPath   = [];
let historyStack  = [];
let forwardStack  = [];
let selectedItem  = null;
let selectedItems = {};
let clipboard     = {items:{}, op:null, fromPath:[]};
let viewMode      = 'grid';
let editPath      = null;
let editorDirty   = false;
let inTrash       = false;
let ctxTarget     = null;
let dialogCb      = null;
let msgCb         = null;

/* ══════════════════════════════════════
   DOM
══════════════════════════════════════ */
const $ = id => document.getElementById(id);

/* ══════════════════════════════════════
   CLOCK
══════════════════════════════════════ */
setInterval(() => { $('clock').textContent = new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}); }, 1000);
$('clock').textContent = new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});

/* ══════════════════════════════════════
   ICONS
══════════════════════════════════════ */
function svgDrive(l){ return `<svg viewBox="0 0 40 40"><rect x="2" y="8" width="36" height="26" rx="3" fill="#c8c8c8" stroke="#999" stroke-width="1"/><rect x="4" y="10" width="32" height="10" rx="1" fill="#b0b0b0"/><rect x="4" y="22" width="20" height="9" rx="1" fill="#d8d8d8"/><circle cx="30" cy="27" r="4" fill="#3a7fd4"/><circle cx="30" cy="27" r="1.5" fill="#80b8f0"/><text x="14" y="20" font-size="7" fill="#555" font-weight="bold" text-anchor="middle" font-family="Arial">${l}</text></svg>`; }
function svgFolder(col='#f0c040'){ return `<svg viewBox="0 0 40 40"><path d="M3 14Q3 11 6 11L16 11L19 8L34 8Q37 8 37 11L37 30Q37 33 34 33L6 33Q3 33 3 30Z" fill="${col}" stroke="#d4a020" stroke-width="1"/><path d="M3 16L37 16L37 30Q37 33 34 33L6 33Q3 33 3 30Z" fill="#f5d060" stroke="#d4a020" stroke-width="1"/></svg>`; }
function svgFile(ext){ const c={'.txt':'#fff','.json':'#fff3cd','.html':'#ffe0cc','.js':'#fff9c4','.css':'#e0f0ff','.md':'#f0fff0','.jpg':'#ffe4e1','.jpeg':'#ffe4e1','.png':'#ffe4e1','.mp4':'#e8e0ff','.mp3':'#fce4ff','.wav':'#fce4ff'};const l={'.txt':'TXT','.json':'JSON','.html':'HTM','.js':'JS','.css':'CSS','.md':'MD','.jpg':'JPG','.jpeg':'JPG','.png':'PNG','.mp4':'MP4','.mp3':'MP3','.wav':'WAV','.aac':'AAC'};const col=c[ext]||'#f8f8f8';const lbl=l[ext]||(ext||'').replace('.','').toUpperCase().slice(0,4)||'FILE';return `<svg viewBox="0 0 40 40"><path d="M8 3L26 3L32 9L32 37L8 37Z" fill="${col}" stroke="#aaa" stroke-width="1"/><path d="M26 3L26 9L32 9Z" fill="#ddd" stroke="#aaa" stroke-width="1"/><text x="20" y="27" font-size="7" fill="#555" font-weight="bold" text-anchor="middle" font-family="Arial">${lbl}</text></svg>`; }
function svgTrash(){ return `<svg viewBox="0 0 40 40"><path d="M10 12L30 12L28 34Q28 36 26 36L14 36Q12 36 12 34Z" fill="#c0c0c0" stroke="#888" stroke-width="1"/><rect x="8" y="9" width="24" height="4" rx="1" fill="#b0b0b0" stroke="#888" stroke-width="1"/><rect x="15" y="6" width="10" height="4" rx="1" fill="#b0b0b0" stroke="#888" stroke-width="1"/><line x1="16" y1="16" x2="15" y2="32" stroke="#888" stroke-width="1.5"/><line x1="20" y1="16" x2="20" y2="32" stroke="#888" stroke-width="1.5"/><line x1="24" y1="16" x2="25" y2="32" stroke="#888" stroke-width="1.5"/></svg>`; }

function getIcon(name,node){
  if(name==='🗑️ Корзина'||inTrash) return svgTrash();
  if(!node) return svgFile('.txt');
  if(node.type==='drive') return svgDrive(name.replace(':',''));
  if(node.type==='folder') return svgFolder(node.color||'#f0c040');
  return svgFile(node.ext||'.txt');
}
function getEmoji(name,node){
  if(name==='🗑️ Корзина') return '🗑️';
  if(!node||node.type==='root') return '🖥️';
  if(node.type==='drive') return '💾';
  if(node.type==='folder') return '📁';
  const m={'.txt':'📄','.json':'📋','.html':'🌐','.js':'📜','.css':'🎨','.md':'📝','.jpg':'🖼️','.jpeg':'🖼️','.png':'🖼️','.mp4':'🎬','.mp3':'🎵','.wav':'🎵','.aac':'🎵'};
  return m[node.ext]||'📄';
}

/* ══════════════════════════════════════
   NAVIGATION
══════════════════════════════════════ */
function navigate(path, push=true) {
  if(push){ historyStack.push([...currentPath]); forwardStack=[]; }
  currentPath=[...path]; inTrash=false; selectedItem=null; selectedItems={};
  render();
}
function goBack()    { if(!historyStack.length)return; forwardStack.push([...currentPath]); currentPath=historyStack.pop(); inTrash=false; selectedItem=null; selectedItems={}; render(); }
function goForward() { if(!forwardStack.length)return; historyStack.push([...currentPath]); currentPath=forwardStack.pop(); inTrash=false; selectedItem=null; selectedItems={}; render(); }
function goUp()      { if(currentPath.length) navigate(currentPath.slice(0,-1)); }

/* ══════════════════════════════════════
   RENDER
══════════════════════════════════════ */
function render() { renderNav(); renderTree(); renderFiles(); renderDetails(); updateButtons(); }

function renderNav() {
  if(inTrash){ $('addressBar').textContent='🗑️ Корзина'; $('titleBarText').textContent='Корзина'; $('taskbarTitle').textContent='Корзина'; return; }
  $('addressBar').textContent = ['Мой компьютер',...currentPath].join(' \\ ');
  const title = currentPath.length ? currentPath[currentPath.length-1] : 'Мой компьютер';
  $('titleBarText').textContent = title; $('taskbarTitle').textContent = title;
  const bc = $('breadcrumb'); bc.innerHTML='';
  const add=(label,path,active)=>{ const sp=document.createElement('span'); sp.className='crumb'+(active?' active':''); sp.textContent=label; if(!active)sp.onclick=()=>navigate(path); bc.appendChild(sp); };
  add('🖥️ Мой компьютер',[],!currentPath.length);
  currentPath.forEach((p,i)=>{ const sep=document.createElement('span'); sep.className='crumb-sep'; sep.textContent=' › '; bc.appendChild(sep); add(p,currentPath.slice(0,i+1),i===currentPath.length-1); });
}

function renderTree() {
  const tree=$('folderTree'); tree.innerHTML='';
  const mk=(label,indent,path,active)=>{ const d=document.createElement('div'); d.className='tree-item'+(active?' active':''); d.innerHTML=`<span style="display:inline-block;width:${indent*12}px"></span>${label}`; d.onclick=()=>navigate(path); return d; };
  tree.appendChild(mk('🖥️ Мой компьютер',0,[],!currentPath.length&&!inTrash));
  Object.entries(fs).forEach(([dn,dr])=>{
    tree.appendChild(mk('💾 '+dn,1,[dn],!inTrash&&JSON.stringify(currentPath)===JSON.stringify([dn])));
    if(dr.children) Object.entries(dr.children).forEach(([fn,fn2])=>{
      if(fn2.type==='folder'){ const fp=[dn,fn]; tree.appendChild(mk('📁 '+fn,2,fp,!inTrash&&JSON.stringify(currentPath)===JSON.stringify(fp))); }
    });
  });
  const tb=document.createElement('div'); tb.className='tree-item'+(inTrash?' active':''); tb.innerHTML='<span style="display:inline-block;width:0px"></span>🗑️ Корзина'; tb.onclick=openTrash; tree.appendChild(tb);
}

function renderFiles() {
  const grid=$('fileGrid'); grid.innerHTML=''; grid.className='file-grid'+(viewMode==='list'?' list-view':'');
  const hint=$('emptyHint');
  if(inTrash){ renderTrash(); return; }
  const node=getNode(currentPath);
  let children={};
  if(!node){ hint.style.display='block'; return; }
  if(node.type==='root') children=fs; else if(node.children) children=node.children;
  const entries=Object.entries(children);
  hint.style.display=entries.length===0?'block':'none';
  entries.sort(([an,av],[bn,bv])=>{ const r=n=>n.type==='drive'?0:n.type==='folder'?1:2; if(r(av)!==r(bv))return r(av)-r(bv); return an.localeCompare(bn,'ru'); });
  entries.forEach(([name,child])=>grid.appendChild(makeFileItem(name,child,false)));
  const sel=Object.keys(selectedItems).length;
  $('statusCount').textContent=entries.length+' объект(ов)';
  $('statusText').textContent=sel>0?'Выбрано: '+sel:(selectedItem?'Выбран: '+selectedItem:'Готово');
}

function renderTrash() {
  const grid=$('fileGrid'); const hint=$('emptyHint');
  $('addressBar').textContent='🗑️ Корзина';
  $('breadcrumb').innerHTML='<span class="crumb active">🗑️ Корзина</span>';
  if(!trash.length){ hint.style.display='block'; hint.innerHTML='Корзина пуста.'; $('statusCount').textContent='0 объект(ов)'; return; }
  hint.style.display='none';
  trash.forEach((item,idx)=>{
    const el=makeFileItem(item.name,item.node,true);
    el.dataset.trashIdx=idx;
    grid.appendChild(el);
  });
  $('statusCount').textContent=trash.length+' объект(ов)';
  $('statusText').textContent='Двойное нажатие — восстановить';
}

function makeFileItem(name, child, isTrashItem) {
  const item=document.createElement('div');
  const isSel=!!selectedItems[name];
  const isCut=clipboard.op==='cut'&&!!clipboard.items[name];
  item.className='file-item'+(isSel?' selected':'')+(isCut?' cut-item':'');
  item.dataset.name=name;
  const iw=document.createElement('div'); iw.className='file-icon-wrap'; iw.innerHTML=getIcon(name,child);
  if(child.type==='drive'){ const b=document.createElement('div'); b.className='drive-badge'; b.textContent=name.replace(':',''); iw.appendChild(b); }
  const lbl=document.createElement('div'); lbl.className='file-label'; lbl.textContent=child.type==='drive'?(child.label||name):name;
  item.appendChild(iw); item.appendChild(lbl);

  // Single tap — select
  let lastTap=0;
  item.addEventListener('click', e => {
    e.stopPropagation();
    const now=Date.now();
    if(now-lastTap<350) {
      // double tap
      if(isTrashItem) restoreTrashItem(parseInt(item.dataset.trashIdx));
      else openItem(name);
      lastTap=0;
    } else {
      lastTap=now;
      if(e.ctrlKey||e.metaKey) toggleSelect(name);
      else { clearMultiSelect(); selectItem(name); }
    }
  });

  // Long press — multi select or context menu
  let pressTimer=null;
  item.addEventListener('touchstart', e => {
    pressTimer=setTimeout(()=>{
      pressTimer=null;
      if(navigator.vibrate) navigator.vibrate(40);
      if(!isTrashItem) toggleSelect(name);
    }, 400);
  }, {passive:true});
  item.addEventListener('touchend', ()=>{ if(pressTimer){clearTimeout(pressTimer);pressTimer=null;} });
  item.addEventListener('touchmove', ()=>{ if(pressTimer){clearTimeout(pressTimer);pressTimer=null;} }, {passive:true});

  // Right click / long press context menu
  item.addEventListener('contextmenu', e=>{
    e.preventDefault();
    if(!selectedItems[name]){ clearMultiSelect(); selectItem(name); }
    if(!isTrashItem) showContextMenu(e.clientX,e.clientY,name);
  });

  return item;
}

function renderDetails() {
  if(selectedItem&&!inTrash){
    const ch=getChildren(currentPath)||fs;
    const child=ch[selectedItem];
    if(child){
      $('detailIcon').textContent=getEmoji(selectedItem,child);
      $('detailName').textContent=selectedItem;
      const lines=[];
      if(child.type==='drive') lines.push('Тип: Локальный диск');
      else if(child.type==='folder'){ lines.push('Тип: Папка'); lines.push('Содержит: '+countItems(child)+' эл.'); }
      else{ lines.push('Тип: '+(child.ext||'').toUpperCase().replace('.','')||'Файл'); lines.push('Размер: '+formatSize(child.content)); }
      if(child.modified) lines.push('Изм.: '+formatDate(child.modified));
      $('detailInfo').textContent=lines.join('\n'); return;
    }
  }
  const node=getNode(currentPath);
  if(!currentPath.length){ $('detailIcon').textContent='🖥️'; $('detailName').textContent='Мой компьютер'; $('detailInfo').textContent='Дисков: '+Object.keys(fs).length; }
  else if(node){ $('detailIcon').textContent=getEmoji(currentPath[currentPath.length-1],node); $('detailName').textContent=currentPath[currentPath.length-1]; $('detailInfo').textContent=node.type==='folder'?'Содержит: '+countItems(node)+' эл.':node.type==='drive'?node.label||'':''; }
}

function selectItem(name){ selectedItem=name; document.querySelectorAll('.file-item').forEach(el=>el.classList.toggle('selected',el.dataset.name===name)); renderDetails(); $('statusText').textContent='Выбран: '+name; }
function toggleSelect(name){ if(selectedItems[name])delete selectedItems[name]; else selectedItems[name]=true; selectedItem=name; renderFiles(); }
function clearMultiSelect(){ selectedItems={}; document.querySelectorAll('.file-item').forEach(el=>el.classList.remove('selected')); }
function updateButtons(){ $('backBtn').disabled=!historyStack.length; $('forwardBtn').disabled=!forwardStack.length; $('upBtn').disabled=!currentPath.length||inTrash; }

/* ══════════════════════════════════════
   OPEN ITEM
══════════════════════════════════════ */
const IMG_EXTS=['.jpg','.jpeg','.png','.gif','.webp','.bmp'];
const VID_EXTS=['.mp4','.webm','.ogg','.mov','.3gp'];
const AUD_EXTS=['.mp3','.wav','.aac','.flac','.m4a'];

async function openItem(name) {
  const ch=getChildren(currentPath)||fs;
  const child=ch[name];
  if(!child) return;
  if(child.type==='drive'||child.type==='folder'){ navigate([...currentPath,name]); return; }
  if(child.type==='file'){
    const ext=(child.ext||'').toLowerCase();
    // Load from device if needed
    let node=child;
    if(child.isDevice&&child.deviceFile){
      const b64=await capLoadMedia(child.deviceFile);
      if(b64){
        const mime = IMG_EXTS.includes(ext)?'image/'+ext.replace('.','').replace('jpg','jpeg'):
                     VID_EXTS.includes(ext)?'video/'+ext.replace('.',''):
                     AUD_EXTS.includes(ext)?'audio/'+ext.replace('.',''):'application/octet-stream';
        node={...child, content:'data:'+mime+';base64,'+b64};
      } else { showMsg('Ошибка','Файл не найден на устройстве.','OK'); return; }
    }
    if(ext==='.html') openHtmlViewer([...currentPath,name],node);
    else if(IMG_EXTS.includes(ext)) openImageViewer(name,node);
    else if(VID_EXTS.includes(ext)) openVideoPlayer(name,node);
    else if(AUD_EXTS.includes(ext)) openAudioPlayer(name,node);
    else openEditor([...currentPath,name],node);
  }
}

/* ══════════════════════════════════════
   MEDIA VIEWERS — no memory leaks
   (create overlay, destroy on close)
══════════════════════════════════════ */
function makeOverlay(title, icon, onClose) {
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;';
  const top=document.createElement('div');
  top.style.cssText='height:44px;background:linear-gradient(180deg,#1e88e5,#0a52a8);display:flex;align-items:center;padding:0 8px;flex-shrink:0;gap:6px;';
  top.innerHTML='<span style="font-size:16px">'+icon+'</span><span style="color:#fff;font-size:13px;flex:1;font-family:sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+title+'</span>';
  const cb=document.createElement('button');
  cb.textContent='✕'; cb.style.cssText='background:linear-gradient(180deg,#f06060,#cc2222);color:#fff;border:none;border-radius:2px;width:26px;height:22px;font-size:13px;cursor:pointer;flex-shrink:0;';
  cb.onclick=()=>{ if(onClose)onClose(); document.body.removeChild(ov); };
  top.appendChild(cb); ov.appendChild(top);
  return ov;
}

function openImageViewer(name, child) {
  if(!child.content?.startsWith('data:')){ showMsg('Изображение','Удалите файл и импортируйте заново.','OK'); return; }
  const ov=makeOverlay(name,'🖼️');
  ov.style.background='rgba(0,0,0,0.93)';
  const cont=document.createElement('div');
  cont.style.cssText='flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:none;';
  const img=document.createElement('img');
  img.src=child.content; img.style.cssText='max-width:100%;max-height:100%;transform-origin:center;user-select:none;-webkit-user-select:none;';
  cont.appendChild(img); ov.appendChild(cont);
  // Pinch zoom
  let scale=1,px=0,py=0,lpx=0,lpy=0,sd=0,ss=1,st=null;
  const dist=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  const apply=()=>img.style.transform=`translate(${px}px,${py}px) scale(${scale})`;
  cont.addEventListener('touchstart',e=>{e.preventDefault();if(e.touches.length===2){sd=dist(e.touches[0],e.touches[1]);ss=scale;}else if(e.touches.length===1){lpx=px;lpy=py;st={x:e.touches[0].clientX,y:e.touches[0].clientY};}},{passive:false});
  cont.addEventListener('touchmove',e=>{e.preventDefault();if(e.touches.length===2){scale=Math.min(5,Math.max(1,ss*(dist(e.touches[0],e.touches[1])/sd)));apply();}else if(e.touches.length===1&&st&&scale>1){px=lpx+(e.touches[0].clientX-st.x);py=lpy+(e.touches[0].clientY-st.y);apply();}},{passive:false});
  cont.addEventListener('touchend',e=>{if(scale<1){scale=1;px=0;py=0;apply();}const now=Date.now();if(now-(cont._lt||0)<300){scale=1;px=0;py=0;apply();}cont._lt=now;});
  document.body.appendChild(ov);
}

function openVideoPlayer(name, child) {
  const ov=makeOverlay(name,'🎬',()=>vid.pause());
  ov.style.background='#000';
  if(!child.content?.startsWith('data:')){ const m=document.createElement('div'); m.style.cssText='flex:1;display:flex;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;font-size:14px;text-align:center;padding:24px;'; m.textContent='⚠️ Удалите файл и импортируйте заново'; ov.appendChild(m); document.body.appendChild(ov); return; }
  const vid=document.createElement('video');
  vid.controls=true; vid.autoplay=true; vid.playsinline=true;
  vid.style.cssText='flex:1;width:100%;background:#000;'; vid.src=child.content;
  ov.appendChild(vid); document.body.appendChild(ov);
}

function openAudioPlayer(name, child) {
  const ov=makeOverlay(name,'🎵',()=>aud.pause());
  ov.style.cssText+='background:linear-gradient(135deg,#1a1a2e,#16213e);align-items:center;justify-content:center;';
  const wrap=document.createElement('div'); wrap.style.cssText='display:flex;flex-direction:column;align-items:center;padding:20px;width:100%;';
  wrap.innerHTML='<div style="font-size:80px;margin:20px 0">🎵</div><div style="color:#fff;font-size:16px;font-family:sans-serif;font-weight:700;text-align:center;margin-bottom:20px">'+name+'</div>';
  const aud=document.createElement('audio'); aud.controls=true; aud.autoplay=true; aud.style.cssText='width:90%;';
  if(child.content?.startsWith('data:')) aud.src=child.content;
  else wrap.innerHTML+='<div style="color:#ff8080;font-size:13px;font-family:sans-serif">⚠️ Импортируйте файл заново</div>';
  wrap.appendChild(aud); ov.appendChild(wrap); document.body.appendChild(ov);
}

/* ══════════════════════════════════════
   HTML VIEWER
══════════════════════════════════════ */
function openHtmlViewer(filePath, node) {
  const fname=filePath[filePath.length-1];
  $('htmlViewerTitle').textContent=fname;
  $('htmlViewerPath').textContent=filePath.join(' \\ ');
  const frame=$('htmlViewerFrame'), code=$('htmlViewerCode');
  frame.srcdoc=node.content||'<p style="font-family:sans-serif;padding:20px">Пусто</p>';
  frame.style.display='block'; code.style.display='none'; code.textContent=node.content||'';
  // Clone buttons to remove old listeners
  ['htmlViewerModeBtn','htmlViewerEditBtn','htmlViewerClose'].forEach(id=>{
    const old=$(id); const nb=old.cloneNode(true); old.replaceWith(nb);
  });
  $('htmlViewerModeBtn').textContent='📝 Код'; $('htmlViewerModeBtn').dataset.mode='preview';
  $('htmlViewerModeBtn').onclick=function(){
    if(this.dataset.mode==='preview'){frame.style.display='none';code.style.display='block';this.textContent='🌐 Просмотр';this.dataset.mode='code';}
    else{frame.style.display='block';code.style.display='none';this.textContent='📝 Код';this.dataset.mode='preview';}
  };
  $('htmlViewerEditBtn').onclick=()=>{ closeModal(); openEditor(filePath,node); };
  $('htmlViewerClose').onclick=closeModal;
  showModal('htmlViewerModal');
}

/* ══════════════════════════════════════
   TEXT EDITOR
══════════════════════════════════════ */
function openEditor(filePath, node, isNew=false) {
  editPath=filePath; editorDirty=false;
  $('editorTitle').textContent=filePath[filePath.length-1];
  $('editorPath').textContent=filePath.join(' \\ ');
  $('editorArea').value=node.content||'';
  $('editorArea').style.fontSize=$('editorFontSize').value+'px';
  $('editorStatus').textContent=isNew?'● Новый':'✓ Сохранено';
  $('editorStatus').style.color=isNew?'#cc7700':'green';
  updateEditorStats(); showModal('editorModal');
}
function updateEditorStats(){ const t=$('editorArea').value; $('editorLines').textContent='Строк: '+t.split('\n').length; $('editorChars').textContent='Символов: '+t.length; }
function saveEditor(){
  if(!editPath)return;
  const p=editPath.slice(0,-1), fname=editPath[editPath.length-1], parent=getNode(p);
  if(!parent?.children)return;
  const now=Date.now();
  if(!parent.children[fname]) parent.children[fname]={type:'file',ext:getExt(fname),created:now};
  parent.children[fname].content=$('editorArea').value; parent.children[fname].modified=now;
  saveFS(); editorDirty=false; $('editorStatus').textContent='✓ Сохранено'; $('editorStatus').style.color='green'; renderFiles();
}

/* ══════════════════════════════════════
   MODALS — single showModal function
══════════════════════════════════════ */
const MODALS=['htmlViewerModal','editorModal','dialogModal','propsModal','msgModal'];
function showModal(id){ $('modalOverlay').style.display='flex'; MODALS.forEach(m=>{const el=$(m);if(el)el.style.display='none';}); $(id).style.display='flex'; }
function closeModal(){ $('modalOverlay').style.display='none'; MODALS.forEach(m=>{const el=$(m);if(el)el.style.display='none';}); editPath=null; }

function showDialog(title,label,def,showExt,cb){
  $('dialogTitle').textContent=title; $('dialogLabel').textContent=label;
  $('dialogInput').value=def||''; $('dialogExtRow').style.display=showExt?'flex':'none';
  dialogCb=cb; showModal('dialogModal'); setTimeout(()=>$('dialogInput').focus(),100);
}
function showMsg(title,body,yes='OK',no=null,cb=null){
  $('msgTitle').textContent=title; $('msgBody').textContent=body;
  $('msgYes').textContent=yes; $('msgNo').textContent=no||'Нет'; $('msgNo').style.display=no?'':'none';
  msgCb=cb; showModal('msgModal');
}
function showProps(name,node){
  const lines=[];
  if(node.type==='drive'){lines.push(['Имя',node.label||name]);lines.push(['Тип','Локальный диск']);lines.push(['Объектов',countItems(node)]);}
  else if(node.type==='folder'){lines.push(['Имя',name]);lines.push(['Тип','Папка']);lines.push(['Содержит',countItems(node)+' объект(ов)']);lines.push(['Создан',formatDate(node.created)]);lines.push(['Изменён',formatDate(node.modified)]);}
  else{lines.push(['Имя',name]);lines.push(['Тип',(node.ext||'').toUpperCase().replace('.','')||'Файл']);lines.push(['Размер',formatSize(node.content)]);lines.push(['Создан',formatDate(node.created)]);lines.push(['Изменён',formatDate(node.modified)]);}
  $('propsBody').innerHTML='<div class="props-icon">'+getEmoji(name,node)+'</div>'+lines.map(([k,v])=>`<div class="props-row"><div class="props-key">${k}:</div><div class="props-val">${v}</div></div>`).join('');
  showModal('propsModal');
}

/* ══════════════════════════════════════
   FILE OPERATIONS
══════════════════════════════════════ */
function createFolder(){
  const node=getNode(currentPath);
  if(!node||node.type==='root'){showMsg('Ошибка','Нельзя создать папку в корне.');return;}
  showDialog('Создать папку','Имя папки:','Новая папка',false,name=>{
    if(!name.trim())return; const ch=node.children; if(!ch)return;
    if(ch[name]){showMsg('Ошибка','"'+name+'" уже существует.');return;}
    const now=Date.now(); ch[name.trim()]={type:'folder',created:now,modified:now,children:{}};
    saveFS(); render(); selectItem(name.trim());
  });
}
function createFile(){
  const node=getNode(currentPath);
  if(!node||node.type==='root'){showMsg('Ошибка','Нельзя создать файл в корне.');return;}
  showDialog('Создать файл','Имя (без расширения):','Новый документ',true,(name,ext)=>{
    if(!name.trim())return; const ch=node.children; if(!ch)return;
    const fn=name.trim()+ext; if(ch[fn]){showMsg('Ошибка','"'+fn+'" уже существует.');return;}
    const now=Date.now(); const nn={type:'file',ext,created:now,modified:now,content:''};
    ch[fn]=nn; saveFS(); render(); openEditor([...currentPath,fn],nn,true);
  });
}
function deleteItem(name){
  const ch=getChildren(currentPath); if(!ch||!ch[name])return;
  if(ch[name].type==='drive'){showMsg('Ошибка','Диск нельзя удалить.');return;}
  const names=Object.keys(selectedItems).length?Object.keys(selectedItems):[name];
  showMsg('Удалить','Переместить '+names.length+' объект(ов) в корзину?','В корзину','Отмена',ok=>{
    if(!ok)return;
    names.forEach(n=>{if(ch[n]&&ch[n].type!=='drive'){trash.push({name:n,node:clone(ch[n]),from:[...currentPath],at:Date.now()});delete ch[n];}});
    saveFS(); saveTrash(); selectedItem=null; clearMultiSelect(); render();
  });
}
function renameItem(name){
  const ch=getChildren(currentPath); if(!ch||!ch[name])return;
  if(ch[name].type==='drive'){showMsg('Ошибка','Диск нельзя переименовать.');return;}
  showDialog('Переименовать','Новое имя:',name,false,nn=>{
    if(!nn.trim()||nn===name)return;
    if(ch[nn]){showMsg('Ошибка','"'+nn+'" уже существует.');return;}
    ch[nn.trim()]=ch[name]; if(ch[name].type==='file')ch[nn.trim()].ext=getExt(nn.trim());
    delete ch[name]; saveFS(); selectedItem=nn.trim(); render();
  });
}

/* ══════════════════════════════════════
   COPY / CUT / PASTE
══════════════════════════════════════ */
function doCopy(){
  const sel=Object.keys(selectedItems).length?Object.keys(selectedItems):(selectedItem?[selectedItem]:[]);
  if(!sel.length){showMsg('Копировать','Выберите файл или папку.');return;}
  const ch=getChildren(currentPath)||fs; const items={};
  sel.forEach(n=>{if(ch[n])items[n]=clone(ch[n]);});
  clipboard={items,op:'copy',fromPath:[...currentPath]};
  showMsg('Копировать','📋 Скопировано: '+sel.length+' объект(ов)','OK');
}
function doCut(){
  const sel=Object.keys(selectedItems).length?Object.keys(selectedItems):(selectedItem?[selectedItem]:[]);
  if(!sel.length){showMsg('Вырезать','Выберите файл или папку.');return;}
  const ch=getChildren(currentPath)||fs; const items={};
  sel.forEach(n=>{if(ch[n])items[n]=clone(ch[n]);});
  clipboard={items,op:'cut',fromPath:[...currentPath]};
  showMsg('Вырезать','✂️ Вырезано: '+sel.length+' объект(ов)','OK'); renderFiles();
}
function doPaste(){
  if(!clipboard.op||!Object.keys(clipboard.items).length){showMsg('Вставить','Буфер обмена пуст.');return;}
  if(!currentPath.length){showMsg('Вставить','Нельзя вставить в корень.');return;}
  const dest=getNode(currentPath);
  if(!dest?.children){showMsg('Вставить','Выберите папку для вставки.');return;}
  // Check not pasting into itself
  if(JSON.stringify(currentPath)===JSON.stringify(clipboard.fromPath)&&clipboard.op==='cut'){showMsg('Вставить','Папка назначения совпадает с источником.');return;}
  let count=0;
  Object.entries(clipboard.items).forEach(([name,node])=>{
    let nn=name; if(dest.children[nn]) nn=nn.replace(/(\.[\w]+)?$/,' — копия$1');
    dest.children[nn]=clone(node); count++;
  });
  if(clipboard.op==='cut'){
    const src=getNode(clipboard.fromPath); const sch=src?.type==='root'?fs:(src?.children||{});
    Object.keys(clipboard.items).forEach(n=>delete sch[n]);
    clipboard={items:{},op:null,fromPath:[]};
  }
  saveFS(); clearMultiSelect(); render(); showMsg('Вставить','✅ Вставлено: '+count+' объект(ов)','OK');
}

/* ══════════════════════════════════════
   EXPORT
══════════════════════════════════════ */
function exportFile(name,child){
  if(!child||child.type!=='file'){showMsg('Экспорт','Выберите файл для экспорта.');return;}
  try{
    let blob;
    if(child.content?.startsWith('data:')){
      const arr=child.content.split(','); const mime=arr[0].match(/:(.*?);/)[1]; const bstr=atob(arr[1]); const u8=new Uint8Array(bstr.length); for(let i=0;i<bstr.length;i++)u8[i]=bstr.charCodeAt(i); blob=new Blob([u8],{type:mime});
    } else { blob=new Blob([child.content||''],{type:'text/plain;charset=utf-8'}); }
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    showMsg('Экспорт','✅ "'+name+'" экспортирован в Загрузки','OK');
  }catch(e){showMsg('Ошибка','Не удалось экспортировать: '+e.message);}
}

/* ══════════════════════════════════════
   SEARCH
══════════════════════════════════════ */
function doSearch(){
  showDialog('Поиск','Введите имя файла:','',false,query=>{
    if(!query.trim())return; const q=query.toLowerCase(); const results=[];
    function searchIn(children,path){ Object.entries(children).forEach(([name,node])=>{ if(name.toLowerCase().includes(q))results.push({name,node,path:[...path]}); if(node.children)searchIn(node.children,[...path,name]); }); }
    searchIn(fs,[]);
    if(!results.length){showMsg('Поиск','Не найдено: "'+query+'"','OK');return;}
    const grid=$('fileGrid'); grid.innerHTML=''; grid.className='file-grid';
    $('emptyHint').style.display='none'; $('addressBar').textContent='🔍 "'+query+'" — '+results.length+' найдено';
    $('breadcrumb').innerHTML='<span class="crumb active">🔍 Поиск: '+query+'</span>';
    $('statusCount').textContent=results.length+' найдено';
    results.forEach(({name,node,path})=>{
      const item=makeFileItem(name,node,false);
      const pl=document.createElement('div'); pl.style.cssText='font-size:9px;color:#888;width:100%;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; pl.textContent=path.join(' \\ ');
      item.appendChild(pl);
      // Override click to navigate to file location
      item.addEventListener('dblclick',()=>navigate(path));
      grid.appendChild(item);
    });
  });
}

/* ══════════════════════════════════════
   TRASH
══════════════════════════════════════ */
function openTrash(){ inTrash=true; selectedItem=null; clearMultiSelect(); render(); }
function restoreTrashItem(idx){
  if(idx<0||idx>=trash.length)return;
  const item=trash[idx]; const dest=getNode(item.from);
  const ch=dest?.type==='root'?null:dest?.children;
  if(ch){ let name=item.name; if(ch[name])name=name.replace(/(\.[\w]+)?$/,' — восст.$1'); ch[name]=item.node; trash.splice(idx,1); saveFS(); saveTrash(); showMsg('Корзина','✅ "'+item.name+'" восстановлен','OK'); navigate(item.from); }
  else{ const c=fs['C:'].children; c[item.name]=item.node; trash.splice(idx,1); saveFS(); saveTrash(); showMsg('Корзина','✅ Восстановлен в C:','OK'); navigate(['C:']); }
}
function emptyTrash(){ showMsg('Очистить корзину','Удалить все файлы безвозвратно?','Очистить','Отмена',ok=>{if(!ok)return;trash=[];saveTrash();renderFiles();}); }

/* ══════════════════════════════════════
   CONTEXT MENU
══════════════════════════════════════ */
function showContextMenu(x,y,name){
  ctxTarget=name;
  const menu=$('contextMenu');
  menu.style.left=Math.min(x,window.innerWidth-180)+'px';
  menu.style.top=Math.min(y,window.innerHeight-230-36)+'px';
  menu.style.display='block';
  const ch=getChildren(currentPath)||fs; const child=name?ch[name]:null;
  menu.querySelectorAll('[data-action]').forEach(el=>{
    const a=el.dataset.action;
    el.style.display='block';
    if(a==='open')el.style.display=child?'block':'none';
    if(a==='rename')el.style.display=(child&&child.type!=='drive')?'block':'none';
    if(a==='delete')el.style.display=(child&&child.type!=='drive')?'block':'none';
    if(a==='export')el.style.display=(child&&child.type==='file')?'block':'none';
    if(a==='copy'||a==='cut')el.style.display=child?'block':'none';
    if(a==='paste')el.style.display=clipboard.op?'block':'none';
    if(a==='newFolder'||a==='newFile')el.style.display=currentPath.length>=1?'block':'none';
  });
}
function hideContextMenu(){ $('contextMenu').style.display='none'; }

$('contextMenu').addEventListener('click',e=>{
  const item=e.target.closest('[data-action]'); if(!item)return;
  e.stopPropagation(); hideContextMenu();
  const a=item.dataset.action; const ch=getChildren(currentPath)||fs;
  switch(a){
    case 'open':       if(ctxTarget)openItem(ctxTarget); break;
    case 'newFolder':  createFolder(); break;
    case 'newFile':    createFile(); break;
    case 'rename':     if(ctxTarget)renameItem(ctxTarget); break;
    case 'delete':     if(ctxTarget)deleteItem(ctxTarget); break;
    case 'copy':       doCopy(); break;
    case 'cut':        doCut(); break;
    case 'paste':      doPaste(); break;
    case 'inline':     buildInlineHTML(); break;
      case 'export':     if(ctxTarget&&ch[ctxTarget])exportFile(ctxTarget,ch[ctxTarget]); break;
    case 'properties': if(ctxTarget&&ch[ctxTarget])showProps(ctxTarget,ch[ctxTarget]); break;
  }
});

/* ══════════════════════════════════════
   IMPORT
══════════════════════════════════════ */
const MEDIA_EXTS=['.jpg','.jpeg','.png','.gif','.webp','.bmp','.mp4','.webm','.mov','.3gp','.mp3','.wav','.aac','.m4a','.flac'];
const TEXT_EXTS=['.txt','.json','.html','.js','.css','.md','.csv','.xml','.py','.sql','.ts','.java','.php'];

function importFile(){
  if(!currentPath.length||inTrash){showMsg('Импорт','Откройте папку для импорта.','OK');return;}
  const node=getNode(currentPath); if(!node?.children){showMsg('Импорт','Выберите папку внутри диска.','OK');return;}
  const inp=$('importInput'); inp.value=''; inp.click();
}

$('importInput').addEventListener('change',async function(){
  if(!currentPath.length||inTrash){showMsg('Импорт','Откройте папку сначала.','OK');return;}
  const parent=getNode(currentPath); if(!parent?.children){showMsg('Импорт','Выберите папку.','OK');return;}
  let count=0;
  for(const file of Array.from(this.files)){
    const ext=file.name.includes('.')?file.name.slice(file.name.lastIndexOf('.')).toLowerCase():'.txt';
    const now=Date.now(); let name=file.name;
    if(parent.children[name]) name=name.replace(ext,'_copy'+ext);
    try{
      if(MEDIA_EXTS.includes(ext)){
        const b64full=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(file);});
        const saved=await capSaveMedia(name,b64full);
        if(saved) parent.children[name]={type:'file',ext,created:now,modified:now,content:'device://'+name,deviceFile:name,size:file.size,isDevice:true};
        else parent.children[name]={type:'file',ext,created:now,modified:now,content:b64full,size:file.size};
      } else if(TEXT_EXTS.includes(ext)){
        const text=await file.text();
        parent.children[name]={type:'file',ext,created:now,modified:now,content:text};
      } else {
        parent.children[name]={type:'file',ext,created:now,modified:now,content:'[binary] '+file.name+' ('+Math.round(file.size/1024)+'КБ)',size:file.size};
      }
      count++;
    }catch(e){console.error('import:',e);}
  }
  if(count>0){saveFS();render();showMsg('Импорт','✅ Импортировано: '+count+' файл(ов)','OK');}
  this.value='';
});

/* ══════════════════════════════════════
   TOOLBAR & SIDEBAR
══════════════════════════════════════ */
// Build sidebar tasks
const TASKS=[
  {id:'t-import',  text:'📥 Импорт файла',   fn:importFile},
  {id:'t-folder',  text:'📁 Новая папка',     fn:createFolder},
  {id:'t-file',    text:'📄 Новый файл',      fn:createFile},
  {id:'t-copy',    text:'📋 Копировать',      fn:doCopy},
  {id:'t-cut',     text:'✂️ Вырезать',        fn:doCut},
  {id:'t-paste',   text:'📌 Вставить',        fn:doPaste},
  {id:'t-export',  text:'📤 Экспорт',         fn:()=>{const ch=getChildren(currentPath)||fs;if(selectedItem&&ch[selectedItem])exportFile(selectedItem,ch[selectedItem]);else showMsg('Экспорт','Выберите файл.');}},
  {id:'t-search',  text:'🔍 Поиск',           fn:doSearch},
  {id:'t-trash',   text:'🗑️ Корзина',         fn:openTrash},
  {id:'t-delete',  text:'🗑️ Удалить',         fn:()=>{const sel=Object.keys(selectedItems);if(sel.length)deleteItem(sel[0]);else if(selectedItem)deleteItem(selectedItem);else showMsg('Удаление','Ничего не выбрано.');}},
  {id:'t-rename',  text:'✏️ Переименовать',   fn:()=>{if(selectedItem)renameItem(selectedItem);else showMsg('Переименование','Ничего не выбрано.');}},
  {id:'t-inline',  text:'📦 Инлайн-сборка', fn:buildInlineHTML},
  {id:'t-props',   text:'ℹ️ Свойства',        fn:()=>{const ch=getChildren(currentPath)||fs;if(selectedItem&&ch[selectedItem])showProps(selectedItem,ch[selectedItem]);else showMsg('Свойства','Ничего не выбрано.');}},
];
const tl=$('taskList');
TASKS.forEach(t=>{const d=document.createElement('div');d.className='task-item';d.textContent=t.text;d.addEventListener('click',t.fn);tl.appendChild(d);});

// Toolbar
$('backBtn').addEventListener('click', goBack);
$('forwardBtn').addEventListener('click', goForward);
$('upBtn').addEventListener('click', goUp);
$('importBtn').addEventListener('click', importFile);
$('searchBtn').addEventListener('click', doSearch);
$('viewToggleBtn').addEventListener('click', ()=>{viewMode=viewMode==='grid'?'list':'grid';renderFiles();});

// Title bar
$('closeBtn').addEventListener('click', ()=>{ if(window.Capacitor?.Plugins?.App) window.Capacitor.Plugins.App.exitApp(); else window.close(); });
$('minBtn').addEventListener('click', ()=>showMsg('Свернуть','Не поддерживается.','OK'));
$('maxBtn').addEventListener('click', ()=>showMsg('Развернуть','Уже полноэкранный.','OK'));

/* ══════════════════════════════════════
   GLOBAL CLICK HANDLERS
══════════════════════════════════════ */
$('rightPanel').addEventListener('contextmenu', e=>{
  e.preventDefault();
  if(!e.target.closest('.file-item')&&!inTrash){ ctxTarget=null; clearMultiSelect(); selectedItem=null; renderFiles(); showContextMenu(e.clientX,e.clientY,null); }
});
document.addEventListener('click', e=>{
  if(!e.target.closest('.context-menu')) hideContextMenu();
  if(!e.target.closest('.file-item')&&!e.target.closest('#htmlViewerModal')){ clearMultiSelect(); selectedItem=null; document.querySelectorAll('.file-item').forEach(el=>el.classList.remove('selected')); $('statusText').textContent='Готово'; renderDetails(); }
  if(!e.target.closest('.start-menu')&&!e.target.closest('.taskbar-start')) $('startMenu').style.display='none';
});
$('modalOverlay').addEventListener('click', e=>{
  if(e.target!==$('modalOverlay')) return;
  if($('htmlViewerModal').style.display!=='none') return;
  if($('editorModal').style.display!=='none'&&editorDirty) return;
  const vis=MODALS.map($).find(m=>m&&m.style.display!=='none');
  if(vis&&vis!==$('dialogModal')&&vis!==$('msgModal')) closeModal();
});

/* ══════════════════════════════════════
   EDITOR EVENTS
══════════════════════════════════════ */
$('editorArea').addEventListener('input', ()=>{ editorDirty=true; $('editorStatus').textContent='● Не сохранено'; $('editorStatus').style.color='#cc7700'; updateEditorStats(); });
$('editorFontSize').addEventListener('change', e=>$('editorArea').style.fontSize=e.target.value+'px');
$('editorWrap').addEventListener('change', e=>{ $('editorArea').style.whiteSpace=e.target.value==='on'?'pre-wrap':'pre'; $('editorArea').style.overflowX=e.target.value==='on'?'hidden':'auto'; });
$('editorSave').addEventListener('click', saveEditor);
$('editorSaveAs').addEventListener('click', ()=>{
  const cur=editPath?editPath[editPath.length-1]:'Документ';
  const base=cur.includes('.')?cur.slice(0,cur.lastIndexOf('.')):cur;
  showDialog('Сохранить как...','Имя файла:',base,true,(name,ext)=>{
    if(!name.trim())return; const sp=[...(editPath?.slice(0,-1)||currentPath)]; const pn=getNode(sp); if(!pn?.children)return;
    const fn=name.trim()+ext; const now=Date.now();
    pn.children[fn]={type:'file',ext,created:pn.children[fn]?.created||now,modified:now,content:$('editorArea').value};
    saveFS(); editPath=[...sp,fn]; $('editorTitle').textContent=fn; $('editorPath').textContent=editPath.join(' \\ ');
    editorDirty=false; $('editorStatus').textContent='✓ Сохранено'; $('editorStatus').style.color='green'; render();
  });
});
$('editorClose').addEventListener('click', ()=>{ if(editorDirty) showMsg('Редактор','Сохранить изменения?','Сохранить','Не сохранять',ok=>{if(ok)saveEditor();closeModal();}); else closeModal(); });

/* ══════════════════════════════════════
   DIALOG EVENTS
══════════════════════════════════════ */
$('dialogOk').addEventListener('click', ()=>{ const n=$('dialogInput').value.trim(),e=$('dialogExt').value; closeModal(); if(dialogCb){dialogCb(n,e);dialogCb=null;} });
$('dialogCancel').addEventListener('click', ()=>{ closeModal(); dialogCb=null; });
$('dialogClose').addEventListener('click', ()=>{ closeModal(); dialogCb=null; });
$('dialogInput').addEventListener('keydown', e=>{ if(e.key==='Enter')$('dialogOk').click(); if(e.key==='Escape')$('dialogCancel').click(); });
$('propsClose').addEventListener('click', closeModal);
$('propsOk').addEventListener('click', closeModal);
$('msgYes').addEventListener('click', ()=>{ const cb=msgCb; msgCb=null; closeModal(); if(cb)cb(true); });
$('msgNo').addEventListener('click',  ()=>{ const cb=msgCb; msgCb=null; closeModal(); if(cb)cb(false); });
$('msgClose').addEventListener('click',()=>{ const cb=msgCb; msgCb=null; closeModal(); if(cb)cb(false); });

/* ══════════════════════════════════════
   START MENU
══════════════════════════════════════ */
$('startBtn').addEventListener('click', e=>{ e.stopPropagation(); $('startMenu').style.display=$('startMenu').style.display==='none'?'block':'none'; });
$('smMyComputer').addEventListener('click', ()=>{ $('startMenu').style.display='none'; navigate([]); });
$('smTrash').addEventListener('click',      ()=>{ $('startMenu').style.display='none'; openTrash(); });
$('smSearch').addEventListener('click',     ()=>{ $('startMenu').style.display='none'; doSearch(); });
$('smNewFolder').addEventListener('click',  ()=>{ $('startMenu').style.display='none'; createFolder(); });
$('smNewFile').addEventListener('click',    ()=>{ $('startMenu').style.display='none'; createFile(); });
$('smAbout').addEventListener('click',      ()=>{ $('startMenu').style.display='none'; showMsg('О программе','Мой компьютер v4.0\n\nФайловый менеджер для Android\nв стиле Windows Explorer.\n\nФайлы хранятся в Documents/MyComputer/','OK'); });
$('smClear').addEventListener('click',      ()=>{ $('startMenu').style.display='none'; showMsg('Очистить','Удалить ВСЕ файлы?','Удалить всё','Отмена',ok=>{ if(!ok)return; localStorage.removeItem(FS_KEY);localStorage.removeItem(TRASH_KEY);fs=defaultFS();trash=[];currentPath=[];historyStack=[];forwardStack=[];selectedItem=null;clearMultiSelect();inTrash=false;render(); }); });

/* ══════════════════════════════════════
   KEYBOARD
══════════════════════════════════════ */
document.addEventListener('keydown', e=>{
  if($('modalOverlay').style.display!=='none'){
    if($('editorModal').style.display!=='none'&&e.ctrlKey&&e.key==='s'){e.preventDefault();saveEditor();}
    return;
  }
  if(e.key==='Backspace'&&!e.target.closest('input,textarea')){e.preventDefault();goBack();}
  if(e.key==='F5'){e.preventDefault();render();}
  if(e.key==='Escape'){clearMultiSelect();selectedItem=null;renderFiles();}
  if(e.key==='Delete'){ const sel=Object.keys(selectedItems); if(sel.length)deleteItem(sel[0]); else if(selectedItem)deleteItem(selectedItem); }
  if(e.key==='F2'&&selectedItem) renameItem(selectedItem);
  if(e.key==='Enter'&&selectedItem) openItem(selectedItem);
  if(e.ctrlKey){
    if(e.key==='c'){e.preventDefault();doCopy();}
    if(e.key==='x'){e.preventDefault();doCut();}
    if(e.key==='v'){e.preventDefault();doPaste();}
    if(e.key==='f'){e.preventDefault();doSearch();}
    if(e.key==='a'){e.preventDefault();const ch=getChildren(currentPath)||{};Object.keys(ch).forEach(k=>selectedItems[k]=true);renderFiles();}
  }
});


/* ══════════════ INLINE BUILD ══════════════ */
function buildInlineHTML() {
  const ch = getChildren(currentPath) || {};
  const htmlFile = Object.entries(ch).find(([name, node]) => 
    node.type === "file" && (node.ext === ".html" || node.ext === ".htm")
  );
  if (!htmlFile) {
    showMsg("Инлайн-сборка", "Нет HTML-файла в папке.", "OK");
    return;
  }
  const [htmlName, htmlNode] = htmlFile;
  let result = htmlNode.content;
  let cssCount = 0, jsCount = 0;
  Object.entries(ch).forEach(([name, node]) => {
    if (node.type === "file" && node.ext === ".css") {
      const re = new RegExp("<link[^>]*href=[\"\x27][^\"\x27]*" + name.replace(".", "\\.") + "[\"\x27][^>]*>", "gi");
      if (re.test(result)) { result = result.replace(re, "<style>\n" + node.content + "\n</style>"); cssCount++; }
    }
    if (node.type === "file" && node.ext === ".js") {
      const re = new RegExp("<script[^>]*src=[\"\x27][^\"\x27]*" + name.replace(".", "\\.") + "[\"\x27][^>]*></script>", "gi");
      if (re.test(result)) { result = result.replace(re, "<script>\n" + node.content + "\n</script>"); jsCount++; }
    }
  });
  result = result.replace(/<script[^>]*src=[\"\x27]capacitor\.js[\"\x27][^>]*><\/script>/gi, "");
  const outName = htmlName.replace(/\.html?$/, "") + "_inline.html";
  const blob = new Blob([result], {type: "text/html;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = outName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showMsg("Инлайн-сборка", "✅ " + outName + "\nCSS: " + cssCount + " | JS: " + jsCount, "OK");
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
capInit();
// Try load from Capacitor FS first
capLoad().then(loaded=>{ if(loaded)render(); else render(); });
console.log('🖥️ My Computer v4.0 ready');

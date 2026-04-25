/**
 * MY COMPUTER — Windows-style File Manager
 * app.js  v2.0 — clean rewrite with HTML viewer + import + close fix
 */

'use strict';

const FS_KEY = 'myComputer_fs';

function defaultFS() {
  const now = Date.now();
  return {
    "C:": {
      type: "drive", label: "Локальный диск (C:)",
      children: {
        "Документы": { type:"folder", created:now, modified:now, children:{} },
        "Загрузки":  { type:"folder", created:now, modified:now, children:{} },
        "Изображения":{ type:"folder", created:now, modified:now, children:{} },
        "readme.txt": { type:"file", ext:".txt", created:now, modified:now,
          content:"Добро пожаловать в Мой компьютер!\nЭто ваш персональный файловый менеджер.\n\nВы можете создавать папки и файлы,\nредактировать тексты, и сохранять данные." }
      }
    },
    "D:": {
      type:"drive", label:"Диск данных (D:)",
      children: {
        "Проекты": { type:"folder", created:now, modified:now, children:{
          "Мой сайт": { type:"folder", created:now, modified:now, children:{
            "index.html": { type:"file", ext:".html", created:now, modified:now,
              content:"<!DOCTYPE html>\n<html>\n<head><title>Мой сайт</title></head>\n<body>\n  <h1>Привет, мир!</h1>\n</body>\n</html>" }
          }}
        }},
        "Музыка": { type:"folder", created:now, modified:now, children:{} },
        "Видео":  { type:"folder", created:now, modified:now, children:{} }
      }
    }
  };
}

function loadFS() {
  try { const r = localStorage.getItem(FS_KEY); return r ? JSON.parse(r) : defaultFS(); }
  catch { return defaultFS(); }
}
function saveFS() {
  try { localStorage.setItem(FS_KEY, JSON.stringify(fs)); }
  catch(e) { showMsg('Ошибка', 'Не удалось сохранить: ' + e.message); }
}
function getNode(path) {
  if (!path.length) return { type:'root', children:fs };
  let node = fs[path[0]];
  for (let i = 1; i < path.length; i++) {
    if (!node || !node.children) return null;
    node = node.children[path[i]];
  }
  return node;
}
function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
}
function formatSize(str) {
  const b = new TextEncoder().encode(str||'').length;
  if (b < 1024) return b + ' Б';
  if (b < 1048576) return (b/1024).toFixed(1) + ' КБ';
  return (b/1048576).toFixed(2) + ' МБ';
}
function countItems(node) { return node.children ? Object.keys(node.children).length : 0; }

/* ═══ STATE ═══ */
let fs = loadFS();
let currentPath = [];
let historyStack = [];
let forwardStack = [];
let selectedItem = null;
let viewMode = 'grid';
let currentEditPath = null;
let editorDirty = false;

/* ═══ DOM ═══ */
const $ = id => document.getElementById(id);
const fileGrid    = $('fileGrid');
const emptyHint   = $('emptyHint');
const addressBar  = $('addressBar');
const breadcrumb  = $('breadcrumb');
const folderTree  = $('folderTree');
const statusText  = $('statusText');
const statusCount = $('statusCount');
const titleBarText= $('titleBarText');
const taskbarTitle= $('taskbarTitle');
const detailIcon  = $('detailIcon');
const detailName  = $('detailName');
const detailInfo  = $('detailInfo');
const contextMenu = $('contextMenu');
const modalOverlay= $('modalOverlay');
const editorModal = $('editorModal');
const dialogModal = $('dialogModal');
const propsModal  = $('propsModal');
const msgModal    = $('msgModal');
const startMenu   = $('startMenu');

/* ═══ CLOCK ═══ */
function updateClock() {
  $('clock').textContent = new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
}
setInterval(updateClock, 1000); updateClock();

/* ═══ ICONS ═══ */
function svgDrive(letter) {
  return `<svg viewBox="0 0 40 40"><rect x="2" y="8" width="36" height="26" rx="3" fill="#c8c8c8" stroke="#999" stroke-width="1"/><rect x="4" y="10" width="32" height="10" rx="1" fill="#b0b0b0"/><rect x="4" y="22" width="20" height="9" rx="1" fill="#d8d8d8"/><circle cx="30" cy="27" r="4" fill="#3a7fd4" stroke="#2060b0" stroke-width="0.5"/><circle cx="30" cy="27" r="1.5" fill="#80b8f0"/><text x="14" y="20" font-size="7" fill="#555" font-weight="bold" text-anchor="middle" font-family="Arial">${letter}</text></svg>`;
}
function svgFolder() {
  return `<svg viewBox="0 0 40 40"><path d="M3 14 Q3 11 6 11 L16 11 L19 8 L34 8 Q37 8 37 11 L37 30 Q37 33 34 33 L6 33 Q3 33 3 30 Z" fill="#f0c040" stroke="#d4a020" stroke-width="1"/><path d="M3 16 L37 16 L37 30 Q37 33 34 33 L6 33 Q3 33 3 30 Z" fill="#f5d060" stroke="#d4a020" stroke-width="1"/></svg>`;
}
function svgFile(ext) {
  const colors = {'.txt':'#fff','.json':'#fff3cd','.html':'#ffe0cc','.js':'#fff9c4','.css':'#e0f0ff','.md':'#f0fff0'};
  const labels = {'.txt':'TXT','.json':'JSON','.html':'HTML','.js':'JS','.css':'CSS','.md':'MD'};
  const col = colors[ext]||'#f8f8f8';
  const lbl = labels[ext]||(ext.replace('.','').toUpperCase().slice(0,4));
  return `<svg viewBox="0 0 40 40"><path d="M8 3 L26 3 L32 9 L32 37 L8 37 Z" fill="${col}" stroke="#aaa" stroke-width="1"/><path d="M26 3 L26 9 L32 9 Z" fill="#ddd" stroke="#aaa" stroke-width="1"/><text x="20" y="27" font-size="7" fill="#555" font-weight="bold" text-anchor="middle" font-family="Arial">${lbl}</text></svg>`;
}
function svgComputer() {
  return `<svg viewBox="0 0 40 40"><rect x="4" y="5" width="32" height="22" rx="2" fill="#c8c8c8" stroke="#888" stroke-width="1"/><rect x="6" y="7" width="28" height="18" rx="1" fill="#2060b0"/><rect x="12" y="27" width="16" height="4" fill="#b0b0b0"/><rect x="8" y="31" width="24" height="3" rx="1" fill="#c8c8c8" stroke="#888" stroke-width="0.5"/><path d="M10 16 L15 11 L20 14 L25 9 L30 13" stroke="#80d0ff" stroke-width="1.5" fill="none"/></svg>`;
}
function getIcon(name, node) {
  if (!node) return svgComputer();
  if (node.type==='drive') return svgDrive(name.replace(':',''));
  if (node.type==='folder') return svgFolder();
  return svgFile(node.ext||'.txt');
}
function getIconEmoji(name, node) {
  if (!node||node.type==='root') return '🖥️';
  if (node.type==='drive') return '💾';
  if (node.type==='folder') return '📁';
  const m={'.txt':'📄','.json':'📋','.html':'🌐','.js':'📜','.css':'🎨','.md':'📝'};
  return m[node.ext]||'📄';
}

/* ═══ NAVIGATION ═══ */
function navigate(newPath, push=true) {
  if (push) { historyStack.push([...currentPath]); forwardStack=[]; }
  currentPath=[...newPath]; selectedItem=null; render();
}
function goBack() {
  if (!historyStack.length) return;
  forwardStack.push([...currentPath]); currentPath=historyStack.pop(); selectedItem=null; render();
}
function goForward() {
  if (!forwardStack.length) return;
  historyStack.push([...currentPath]); currentPath=forwardStack.pop(); selectedItem=null; render();
}
function goUp() { if (currentPath.length) navigate(currentPath.slice(0,-1)); }

/* ═══ RENDER ═══ */
function render() { renderNav(); renderTree(); renderFiles(); renderDetails(); updateButtons(); }

function renderNav() {
  const parts = ['Мой компьютер',...currentPath];
  addressBar.textContent = parts.join(' \\ ');
  const title = currentPath.length ? currentPath[currentPath.length-1] : 'Мой компьютер';
  titleBarText.textContent = title; taskbarTitle.textContent = title;
  breadcrumb.innerHTML='';
  const addCrumb=(label,path,active)=>{
    const sp=document.createElement('span');
    sp.className='crumb'+(active?' active':''); sp.textContent=label;
    if(!active) sp.addEventListener('click',()=>navigate(path));
    breadcrumb.appendChild(sp);
  };
  addCrumb('🖥️ Мой компьютер',[],!currentPath.length);
  currentPath.forEach((part,i)=>{
    const sep=document.createElement('span'); sep.className='crumb-sep'; sep.textContent=' › ';
    breadcrumb.appendChild(sep);
    addCrumb(part,currentPath.slice(0,i+1),i===currentPath.length-1);
  });
}

function renderTree() {
  folderTree.innerHTML='';
  folderTree.appendChild(makeTreeItem('🖥️ Мой компьютер',0,[],!currentPath.length));
  Object.entries(fs).forEach(([dname,drive])=>{
    const dPath=[dname];
    folderTree.appendChild(makeTreeItem('💾 '+dname,1,dPath,JSON.stringify(currentPath)===JSON.stringify(dPath)));
    if(drive.children) Object.entries(drive.children).forEach(([fname,fnode])=>{
      if(fnode.type==='folder'){
        const fPath=[dname,fname];
        folderTree.appendChild(makeTreeItem('📁 '+fname,2,fPath,JSON.stringify(currentPath)===JSON.stringify(fPath)));
      }
    });
  });
}
function makeTreeItem(label,indent,path,active){
  const div=document.createElement('div');
  div.className='tree-item'+(active?' active':'');
  div.innerHTML=`<span class="tree-indent" style="width:${indent*12}px"></span>${label}`;
  div.addEventListener('click',()=>navigate(path)); return div;
}

function renderFiles() {
  fileGrid.innerHTML='';
  const node=getNode(currentPath);
  fileGrid.className='file-grid'+(viewMode==='list'?' list-view':'');
  let children={};
  if(!node){emptyHint.style.display='block';return;}
  if(node.type==='root') children=fs;
  else if(node.children) children=node.children;
  const entries=Object.entries(children);
  emptyHint.style.display=entries.length===0?'block':'none';
  entries.sort(([an,av],[bn,bv])=>{
    const rank=n=>n.type==='drive'?0:n.type==='folder'?1:2;
    if(rank(av)!==rank(bv)) return rank(av)-rank(bv);
    return an.localeCompare(bn,'ru');
  });
  entries.forEach(([name,child])=>{
    const item=document.createElement('div');
    item.className='file-item'+(selectedItem===name?' selected':'');
    item.dataset.name=name;
    const iconWrap=document.createElement('div'); iconWrap.className='file-icon-wrap';
    iconWrap.innerHTML=getIcon(name,child);
    if(child.type==='drive'){
      const badge=document.createElement('div'); badge.className='drive-badge';
      badge.textContent=name.replace(':',''); iconWrap.appendChild(badge);
    }
    const label=document.createElement('div'); label.className='file-label';
    label.textContent=child.type==='drive'?(child.label||name):name;
    item.appendChild(iconWrap); item.appendChild(label);
    item.addEventListener('click',e=>{e.stopPropagation();selectItem(name);});
    let lastTap=0;
    item.addEventListener('click',()=>{
      const now=Date.now();
      if(now-lastTap<350){openItem(name);lastTap=0;}else lastTap=now;
    });
    let pressTimer;
    item.addEventListener('touchstart',e=>{
      pressTimer=setTimeout(()=>{selectItem(name);showContextMenu(e.touches[0].clientX,e.touches[0].clientY,name);},600);
    },{passive:true});
    item.addEventListener('touchend',()=>clearTimeout(pressTimer));
    item.addEventListener('touchmove',()=>clearTimeout(pressTimer));
    item.addEventListener('contextmenu',e=>{e.preventDefault();selectItem(name);showContextMenu(e.clientX,e.clientY,name);});
    fileGrid.appendChild(item);
  });
  statusCount.textContent=`${entries.length} объект(ов)`;
  statusText.textContent=selectedItem?`Выбран: ${selectedItem}`:'Готово';
}

function renderDetails() {
  if(selectedItem){
    const node=getNode(currentPath);
    const children=node?.type==='root'?fs:(node?.children||{});
    const child=children[selectedItem];
    if(child){
      detailIcon.textContent=getIconEmoji(selectedItem,child);
      detailName.textContent=selectedItem;
      const lines=[];
      if(child.type==='drive') lines.push('Тип: Локальный диск');
      else if(child.type==='folder'){lines.push('Тип: Папка');lines.push(`Содержит: ${countItems(child)} эл.`);}
      else{lines.push('Тип: '+(child.ext||'.txt').toUpperCase().replace('.',''));lines.push('Размер: '+formatSize(child.content));}
      if(child.modified) lines.push('Изм.: '+formatDate(child.modified));
      detailInfo.textContent=lines.join('\n'); return;
    }
  }
  const node=getNode(currentPath);
  if(!currentPath.length){detailIcon.textContent='🖥️';detailName.textContent='Мой компьютер';detailInfo.textContent=`Дисков: ${Object.keys(fs).length}`;}
  else if(node){
    detailIcon.textContent=getIconEmoji(currentPath[currentPath.length-1],node);
    detailName.textContent=currentPath[currentPath.length-1];
    detailInfo.textContent=node.type==='folder'?`Содержит: ${countItems(node)} эл.`:node.type==='drive'?node.label||'':'';
  }
}

function selectItem(name) {
  selectedItem=name;
  document.querySelectorAll('.file-item').forEach(el=>el.classList.toggle('selected',el.dataset.name===name));
  renderDetails(); statusText.textContent=`Выбран: ${name}`;
}
function updateButtons() {
  $('backBtn').disabled=!historyStack.length;
  $('forwardBtn').disabled=!forwardStack.length;
  $('upBtn').disabled=!currentPath.length;
}

/* ═══ OPEN ITEM ═══ */
function openItem(name) {
  const node=getNode(currentPath);
  const children=node?.type==='root'?fs:(node?.children||{});
  const child=children[name];
  if(!child) return;
  if(child.type==='drive'||child.type==='folder') { navigate([...currentPath,name]); return; }
  if(child.type==='file') {
    if(child.ext==='.html') openHtmlViewer([...currentPath,name],child);
    else openEditor([...currentPath,name],child);
  }
}

/* ═══ HTML VIEWER ═══ */
function openHtmlViewer(filePath, node) {
  const fname = filePath[filePath.length-1];
  $('htmlViewerTitle').textContent = fname;
  $('htmlViewerPath').textContent = filePath.join(' \\ ');
  const frame   = $('htmlViewerFrame');
  const code    = $('htmlViewerCode');
  const modeBtn = $('htmlViewerModeBtn');
  const editBtn = $('htmlViewerEditBtn');
  const closeBtn= $('htmlViewerClose');

  frame.srcdoc = node.content || '<p style="font-family:sans-serif;padding:20px">Файл пуст</p>';
  frame.style.display = 'block';
  code.style.display  = 'none';
  code.textContent    = node.content || '';
  modeBtn.textContent = '📝 Код';
  modeBtn.dataset.mode = 'preview';

  // Clone to remove old listeners
  const newMode = modeBtn.cloneNode(true);
  modeBtn.parentNode.replaceChild(newMode, modeBtn);
  newMode.addEventListener('click', function() {
    if(this.dataset.mode==='preview'){
      frame.style.display='none'; code.style.display='block';
      this.textContent='🌐 Просмотр'; this.dataset.mode='code';
    } else {
      frame.style.display='block'; code.style.display='none';
      this.textContent='📝 Код'; this.dataset.mode='preview';
    }
  });

  const newEdit = editBtn.cloneNode(true);
  editBtn.parentNode.replaceChild(newEdit, editBtn);
  newEdit.addEventListener('click', () => { closeAllModals(); openEditor(filePath, node); });

  const newClose = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newClose, closeBtn);
  newClose.addEventListener('click', closeAllModals);

  modalOverlay.style.display = 'flex';
  [editorModal,dialogModal,propsModal,msgModal].forEach(m=>m.style.display='none');
  $('htmlViewerModal').style.display = 'flex';
}

/* ═══ TEXT EDITOR ═══ */
function openEditor(filePath, node, isNew=false) {
  currentEditPath=filePath; editorDirty=false;
  $('editorTitle').textContent=filePath[filePath.length-1];
  $('editorPath').textContent=filePath.join(' \\ ');
  $('editorArea').value=node.content||'';
  $('editorArea').style.fontSize=$('editorFontSize').value+'px';
  $('editorStatus').textContent=isNew?'● Новый файл':'✓ Сохранено';
  $('editorStatus').style.color=isNew?'#cc7700':'green';
  updateEditorStats(); showModal(editorModal);
}
function updateEditorStats() {
  const text=$('editorArea').value;
  $('editorLines').textContent=`Строк: ${text.split('\n').length}`;
  $('editorChars').textContent=`Символов: ${text.length}`;
}
function saveEditor() {
  if(!currentEditPath) return;
  const parentPath=currentEditPath.slice(0,-1);
  const fname=currentEditPath[currentEditPath.length-1];
  const parent=getNode(parentPath);
  if(!parent||!parent.children) return;
  const now=Date.now();
  if(!parent.children[fname]) parent.children[fname]={type:'file',ext:getExt(fname),created:now};
  parent.children[fname].content=$('editorArea').value;
  parent.children[fname].modified=now;
  saveFS(); editorDirty=false;
  $('editorStatus').textContent='✓ Сохранено';
  $('editorStatus').style.color='green';
  renderFiles();
}
function getExt(name){const i=name.lastIndexOf('.');return i>=0?name.slice(i):'.txt';}

/* ═══ MODALS ═══ */
let dialogCallback=null, msgCallback=null;

function showDialog(title,label,defaultVal,showExt,callback){
  $('dialogTitle').textContent=title; $('dialogLabel').textContent=label;
  $('dialogInput').value=defaultVal||'';
  $('dialogExtRow').style.display=showExt?'flex':'none';
  dialogCallback=callback; showModal(dialogModal);
  setTimeout(()=>$('dialogInput').focus(),100);
}
function showMsg(title,body,yesLabel='OK',noLabel=null,callback=null){
  $('msgTitle').textContent=title; $('msgBody').textContent=body;
  $('msgYes').textContent=yesLabel;
  $('msgNo').textContent=noLabel||'Нет';
  $('msgNo').style.display=noLabel?'inline-flex':'none';
  msgCallback=callback; showModal(msgModal);
}
function showProperties(name,node){
  const lines=[];
  if(node.type==='drive'){lines.push(['Имя',node.label||name]);lines.push(['Тип','Локальный диск']);lines.push(['Объектов',Object.keys(node.children||{}).length]);}
  else if(node.type==='folder'){lines.push(['Имя',name]);lines.push(['Тип','Папка']);lines.push(['Содержит',countItems(node)+' объект(ов)']);lines.push(['Создан',formatDate(node.created)]);lines.push(['Изменён',formatDate(node.modified)]);}
  else{lines.push(['Имя',name]);lines.push(['Тип',(node.ext||'.txt').toUpperCase().replace('.','')]);lines.push(['Размер',formatSize(node.content)]);lines.push(['Создан',formatDate(node.created)]);lines.push(['Изменён',formatDate(node.modified)]);}
  $('propsBody').innerHTML=`<div class="props-icon">${getIconEmoji(name,node)}</div>`+lines.map(([k,v])=>`<div class="props-row"><div class="props-key">${k}:</div><div class="props-val">${v}</div></div>`).join('');
  showModal(propsModal);
}
function showModal(modal){
  modalOverlay.style.display='flex';
  [editorModal,dialogModal,propsModal,msgModal,$('htmlViewerModal')].forEach(m=>m&&(m.style.display='none'));
  modal.style.display='flex';
}
function closeAllModals(){
  modalOverlay.style.display='none';
  [editorModal,dialogModal,propsModal,msgModal,$('htmlViewerModal')].forEach(m=>m&&(m.style.display='none'));
  currentEditPath=null;
}
function closeModal(){ closeAllModals(); }

/* ═══ FILE OPS ═══ */
function createFolder(){
  showDialog('Создать папку','Имя папки:','Новая папка',false,name=>{
    if(!name.trim()) return;
    const node=getNode(currentPath);
    if(node?.type==='root'){showMsg('Ошибка','Нельзя создать папку в корне.');return;}
    const children=node?.children;
    if(!children){showMsg('Ошибка','Невозможно создать папку здесь.');return;}
    if(children[name]){showMsg('Ошибка',`"${name}" уже существует.`);return;}
    const now=Date.now();
    children[name.trim()]={type:'folder',created:now,modified:now,children:{}};
    saveFS(); render(); selectItem(name.trim());
  });
}
function createFile(){
  showDialog('Создать файл','Имя файла (без расширения):','Новый документ',true,(name,ext)=>{
    if(!name.trim()) return;
    const node=getNode(currentPath);
    if(node?.type==='root'){showMsg('Ошибка','Нельзя создать файл в корне.');return;}
    const children=node?.children;
    if(!children){showMsg('Ошибка','Невозможно создать файл здесь.');return;}
    const fullName=name.trim()+ext;
    if(children[fullName]){showMsg('Ошибка',`"${fullName}" уже существует.`);return;}
    const now=Date.now();
    const newNode={type:'file',ext,created:now,modified:now,content:''};
    children[fullName]=newNode; saveFS(); render();
    openEditor([...currentPath,fullName],newNode,true);
  });
}
function deleteItem(name){
  const node=getNode(currentPath);
  const children=node?.type==='root'?null:node?.children;
  if(!children||!children[name]) return;
  const child=children[name];
  if(child.type==='drive'){showMsg('Ошибка','Диск нельзя удалить.');return;}
  const type=child.type==='folder'?'папку':'файл';
  showMsg('Подтверждение',`Удалить ${type} "${name}"?`,'Удалить','Отмена',confirmed=>{
    if(!confirmed) return;
    delete children[name]; saveFS(); selectedItem=null; render();
  });
}
function renameItem(name){
  const node=getNode(currentPath);
  const children=node?.type==='root'?null:node?.children;
  if(!children||!children[name]) return;
  const child=children[name];
  if(child.type==='drive'){showMsg('Ошибка','Диск нельзя переименовать.');return;}
  showDialog('Переименовать','Новое имя:',name,false,newName=>{
    if(!newName.trim()||newName===name) return;
    if(children[newName]){showMsg('Ошибка',`"${newName}" уже существует.`);return;}
    children[newName.trim()]={...children[name]};
    if(child.type==='file') children[newName.trim()].ext=getExt(newName.trim());
    delete children[name]; saveFS(); selectedItem=newName.trim(); render();
  });
}

/* ═══ IMPORT ═══ */
function importFile(){
  if(!currentPath.length){showMsg('Импорт','Откройте папку для импорта файла.','OK');return;}
  const node=getNode(currentPath);
  if(!node?.children){showMsg('Импорт','Выберите папку внутри диска.','OK');return;}
  const inp=document.getElementById('realImportInput');
  if(inp){inp.value='';inp.click();}
}

/* ═══ CONTEXT MENU ═══ */
let ctxTarget=null;
function showContextMenu(x,y,name){
  ctxTarget=name;
  const W=window.innerWidth,H=window.innerHeight;
  contextMenu.style.left=Math.min(x,W-170)+'px';
  contextMenu.style.top=Math.min(y,H-180-36)+'px';
  contextMenu.style.display='block';
  const node=getNode(currentPath);
  const children=node?.type==='root'?fs:(node?.children||{});
  const child=name?children[name]:null;
  contextMenu.querySelectorAll('[data-action]').forEach(el=>{
    const a=el.dataset.action;
    if(a==='open') el.style.display=child?'block':'none';
    if(a==='rename') el.style.display=(child&&child.type!=='drive')?'block':'none';
    if(a==='delete') el.style.display=(child&&child.type!=='drive')?'block':'none';
    if(a==='properties') el.style.display=child?'block':'none';
    if(a==='newFolder'||a==='newFile') el.style.display=currentPath.length>=1?'block':'none';
  });
}
function hideContextMenu(){contextMenu.style.display='none';}

contextMenu.querySelectorAll('[data-action]').forEach(el=>{
  el.addEventListener('click',e=>{
    e.stopPropagation();
    const action=el.dataset.action; hideContextMenu();
    switch(action){
      case 'open': if(ctxTarget) openItem(ctxTarget); break;
      case 'newFolder': createFolder(); break;
      case 'newFile': createFile(); break;
      case 'rename': if(ctxTarget) renameItem(ctxTarget); break;
      case 'delete': if(ctxTarget) deleteItem(ctxTarget); break;
      case 'properties':{
        const n=getNode(currentPath); const ch=n?.type==='root'?fs:(n?.children||{});
        if(ctxTarget&&ch[ctxTarget]) showProperties(ctxTarget,ch[ctxTarget]); break;
      }
    }
  });
});

/* ═══ EVENT LISTENERS ═══ */
$('backBtn').addEventListener('click',goBack);
$('forwardBtn').addEventListener('click',goForward);
$('upBtn').addEventListener('click',goUp);
$('viewToggleBtn').addEventListener('click',()=>{viewMode=viewMode==='grid'?'list':'grid';renderFiles();});
$('importBtn').addEventListener('click',importFile);

$('taskImport').addEventListener('click',importFile);
$('taskNewFolder').addEventListener('click',createFolder);
$('taskNewFile').addEventListener('click',createFile);
$('taskDelete').addEventListener('click',()=>{if(selectedItem)deleteItem(selectedItem);else showMsg('Удаление','Ничего не выбрано.');});
$('taskRename').addEventListener('click',()=>{if(selectedItem)renameItem(selectedItem);else showMsg('Переименование','Ничего не выбрано.');});
$('taskProperties').addEventListener('click',()=>{
  if(!selectedItem){showMsg('Свойства','Ничего не выбрано.');return;}
  const n=getNode(currentPath); const ch=n?.type==='root'?fs:(n?.children||{});
  if(ch[selectedItem]) showProperties(selectedItem,ch[selectedItem]);
});

// ✕ — exit app
$('closeBtn').addEventListener('click',()=>{
  if(window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App){
    window.Capacitor.Plugins.App.exitApp();
  } else {
    window.close();
  }
});
$('minBtn').addEventListener('click',()=>showMsg('Свернуть','Не поддерживается.','OK'));
$('maxBtn').addEventListener('click',()=>showMsg('Развернуть','Уже полноэкранный.','OK'));

$('rightPanel').addEventListener('contextmenu',e=>{
  e.preventDefault();
  if(!e.target.closest('.file-item')){ctxTarget=null;selectedItem=null;renderFiles();showContextMenu(e.clientX,e.clientY,null);}
});

document.addEventListener('click',e=>{
  if(!e.target.closest('.file-item')&&!e.target.closest('.context-menu')) hideContextMenu();
  if(!e.target.closest('.file-item')&&!e.target.closest('#htmlViewerModal')){
    selectedItem=null;
    document.querySelectorAll('.file-item').forEach(el=>el.classList.remove('selected'));
    statusText.textContent='Готово'; renderDetails();
  }
  if(!e.target.closest('.start-menu')&&!e.target.closest('.taskbar-start')) startMenu.style.display='none';
});

// Overlay click — don't close HTML viewer
modalOverlay.addEventListener('click',e=>{
  if(e.target!==modalOverlay) return;
  const viewer=$('htmlViewerModal');
  if(viewer&&viewer.style.display!=='none') return;
  const visModal=[editorModal,dialogModal,propsModal,msgModal].find(m=>m.style.display!=='none');
  if(visModal===editorModal&&editorDirty) return;
  if(visModal!==dialogModal&&visModal!==msgModal) closeAllModals();
});

/* ═══ EDITOR EVENTS ═══ */
$('editorArea').addEventListener('input',()=>{
  editorDirty=true; $('editorStatus').textContent='● Не сохранено'; $('editorStatus').style.color='#cc7700';
  updateEditorStats();
});
$('editorFontSize').addEventListener('change',e=>$('editorArea').style.fontSize=e.target.value+'px');
$('editorWrap').addEventListener('change',e=>{
  $('editorArea').style.whiteSpace=e.target.value==='on'?'pre-wrap':'pre';
  $('editorArea').style.overflowX=e.target.value==='on'?'hidden':'auto';
});
$('editorSave').addEventListener('click',saveEditor);
$('editorSaveAs').addEventListener('click',()=>{
  const cur=currentEditPath?currentEditPath[currentEditPath.length-1]:'Новый документ';
  const base=cur.includes('.')?cur.slice(0,cur.lastIndexOf('.')):cur;
  showDialog('Сохранить как...','Имя файла:',base,true,(name,ext)=>{
    if(!name.trim()) return;
    const savePath=[...(currentEditPath?.slice(0,-1)||currentPath)];
    const parentNode=getNode(savePath);
    if(!parentNode?.children){showMsg('Ошибка','Выберите папку.');return;}
    const fname=name.trim()+ext; const now=Date.now();
    parentNode.children[fname]={type:'file',ext,created:parentNode.children[fname]?.created||now,modified:now,content:$('editorArea').value};
    saveFS(); currentEditPath=[...savePath,fname];
    $('editorTitle').textContent=fname; $('editorPath').textContent=currentEditPath.join(' \\ ');
    editorDirty=false; $('editorStatus').textContent='✓ Сохранено'; $('editorStatus').style.color='green';
    render();
  });
});
$('editorClose').addEventListener('click',()=>{
  if(editorDirty){showMsg('Редактор','Сохранить изменения?','Сохранить','Не сохранять',yes=>{if(yes)saveEditor();closeAllModals();});}
  else closeAllModals();
});

/* ═══ DIALOG EVENTS ═══ */
$('dialogOk').addEventListener('click',()=>{
  const name=$('dialogInput').value.trim(); const ext=$('dialogExt').value;
  closeAllModals(); if(dialogCallback){dialogCallback(name,ext);dialogCallback=null;}
});
$('dialogCancel').addEventListener('click',()=>{closeAllModals();dialogCallback=null;});
$('dialogClose').addEventListener('click',()=>{closeAllModals();dialogCallback=null;});
$('dialogInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('dialogOk').click();if(e.key==='Escape')$('dialogCancel').click();});
$('propsClose').addEventListener('click',closeAllModals);
$('propsOk').addEventListener('click',closeAllModals);
$('msgYes').addEventListener('click',()=>{const cb=msgCallback;msgCallback=null;closeAllModals();if(cb)cb(true);});
$('msgNo').addEventListener('click',()=>{const cb=msgCallback;msgCallback=null;closeAllModals();if(cb)cb(false);});
$('msgClose').addEventListener('click',()=>{const cb=msgCallback;msgCallback=null;closeAllModals();if(cb)cb(false);});

/* ═══ START MENU ═══ */
$('startBtn').addEventListener('click',e=>{e.stopPropagation();startMenu.style.display=startMenu.style.display==='none'?'block':'none';});
$('smMyComputer').addEventListener('click',()=>{startMenu.style.display='none';navigate([]);});
$('smNewFolder').addEventListener('click',()=>{startMenu.style.display='none';createFolder();});
$('smNewFile').addEventListener('click',()=>{startMenu.style.display='none';createFile();});
$('smAbout').addEventListener('click',()=>{startMenu.style.display='none';showMsg('О программе','Мой компьютер v2.0\n\nФайловый менеджер для Android\nв стиле Windows Explorer.','OK');});
$('smClear').addEventListener('click',()=>{
  startMenu.style.display='none';
  showMsg('Очистить всё','ВНИМАНИЕ! Все файлы и папки будут удалены!','Удалить всё','Отмена',confirmed=>{
    if(!confirmed) return;
    localStorage.removeItem(FS_KEY); fs=defaultFS(); currentPath=[]; historyStack=[]; forwardStack=[]; selectedItem=null; render();
  });
});

/* ═══ KEYBOARD ═══ */
document.addEventListener('keydown',e=>{
  if(modalOverlay.style.display!=='none') return;
  if(e.key==='Backspace'&&!e.target.closest('input,textarea')){e.preventDefault();goBack();}
  if(e.key==='F5'){e.preventDefault();render();}
  if(e.key==='Delete'&&selectedItem) deleteItem(selectedItem);
  if(e.key==='F2'&&selectedItem) renameItem(selectedItem);
  if(e.key==='Enter'&&selectedItem) openItem(selectedItem);
  if(e.ctrlKey&&e.key==='s'&&editorModal.style.display!=='none'){e.preventDefault();saveEditor();}
});

/* ═══ IMPORT INPUT ═══ */
document.addEventListener('DOMContentLoaded',function(){
  const inp=document.createElement('input');
  inp.type='file'; inp.id='realImportInput'; inp.multiple=true; inp.accept='*/*';
  inp.style.cssText='position:fixed;top:-100px;left:-100px;opacity:0;width:1px;height:1px;';
  document.body.appendChild(inp);
  const TEXT_EXTS=['.txt','.json','.html','.js','.css','.md','.csv','.xml','.ts','.py','.sql','.java','.php'];
  inp.addEventListener('change',async function(){
    if(!currentPath.length){showMsg('Импорт','Откройте папку сначала.','OK');return;}
    const parent=getNode(currentPath);
    if(!parent?.children){showMsg('Импорт','Выберите папку внутри диска.','OK');return;}
    let count=0;
    for(const file of Array.from(inp.files)){
      const ext=file.name.includes('.')?file.name.slice(file.name.lastIndexOf('.')).toLowerCase():'.txt';
      const isText=TEXT_EXTS.includes(ext);
      const now=Date.now(); let name=file.name;
      if(parent.children[name]) name=name.replace(ext,'_copy'+ext);
      try{
        const text=isText?await file.text():'[binary] '+file.name+' ('+Math.round(file.size/1024)+'КБ)';
        parent.children[name]={type:'file',ext,created:now,modified:now,content:text};
        count++;
      }catch(e){console.log('import err',e);}
    }
    if(count>0){saveFS();render();showMsg('Импорт','✅ Импортировано: '+count+' файл(ов)','OK');}
    inp.value='';
  });
});

/* ═══ INIT ═══ */
render();
console.log('🖥️ My Computer v2.0 ready');

// ── IMAGE VIEWER ──
(function(){
  var IMG_EXTS=['.jpg','.jpeg','.png','.gif','.webp','.bmp'];
  var _open=window.openItem||openItem;
  window.openItem=function(name){
    var node2=getNode(currentPath);
    var children2=node2&&node2.type==='root'?fs:(node2&&node2.children||{});
    var child2=children2[name];
    if(child2&&child2.type==='file'&&IMG_EXTS.indexOf(child2.ext.toLowerCase())>=0){
      // Show image viewer
      var overlay=document.createElement('div');
      overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;';
      var topbar=document.createElement('div');
      topbar.style.cssText='position:absolute;top:0;left:0;right:0;height:40px;background:linear-gradient(180deg,#1e88e5,#0a52a8);display:flex;align-items:center;padding:0 8px;gap:8px;';
      topbar.innerHTML='<span style="color:#fff;font-size:13px;flex:1;font-family:sans-serif">🖼️ '+name+'</span>';
      var closeB=document.createElement('button');
      closeB.textContent='✕';
      closeB.style.cssText='background:linear-gradient(180deg,#f06060,#cc2222);color:#fff;border:none;border-radius:2px;width:24px;height:22px;font-size:12px;cursor:pointer;';
      closeB.onclick=function(){document.body.removeChild(overlay);};
      topbar.appendChild(closeB);
      overlay.appendChild(topbar);
      var img=document.createElement('img');
      img.style.cssText='max-width:95vw;max-height:calc(100vh - 80px);margin-top:44px;border-radius:4px;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
      img.src=child2.content; // base64 data URL
      img.onerror=function(){img.alt='Не удалось отобразить изображение';img.style.color='#fff';};
      overlay.appendChild(img);
      var info=document.createElement('div');
      info.style.cssText='color:#aaa;font-size:11px;font-family:sans-serif;margin-top:8px;';
      info.textContent=name+(child2.size?' • '+Math.round(child2.size/1024)+'КБ':'');
      overlay.appendChild(info);
      document.body.appendChild(overlay);
    } else {
      _open(name);
    }
  };
})();

// ── FIX IMPORT BINARY AS BASE64 ──
document.addEventListener('DOMContentLoaded',function(){
  var inp=document.getElementById('realImportInput');
  if(!inp) return;
  var IMG_EXTS=['.jpg','.jpeg','.png','.gif','.webp','.bmp'];
  var TEXT_EXTS=['.txt','.json','.html','.js','.css','.md','.csv','.xml','.ts','.py','.sql'];
  inp.addEventListener('change',async function(){
    if(!currentPath.length){showMsg('Импорт','Откройте папку сначала.','OK');return;}
    var parent=getNode(currentPath);
    if(!parent||!parent.children){showMsg('Импорт','Выберите папку.','OK');return;}
    var count=0;
    for(var i=0;i<inp.files.length;i++){
      var file=inp.files[i];
      var ext=file.name.includes('.')?file.name.slice(file.name.lastIndexOf('.')).toLowerCase():'.txt';
      var now=Date.now(); var name=file.name;
      if(parent.children[name]) name=name.replace(ext,'_copy'+ext);
      try{
        var content;
        if(IMG_EXTS.indexOf(ext)>=0){
          // Read as base64 DataURL
          content=await new Promise(function(res){
            var r=new FileReader();
            r.onload=function(){res(r.result);};
            r.readAsDataURL(file);
          });
        } else if(TEXT_EXTS.indexOf(ext)>=0){
          content=await file.text();
        } else {
          content='[binary] '+file.name+' ('+Math.round(file.size/1024)+'КБ)';
        }
        parent.children[name]={type:'file',ext:ext,created:now,modified:now,content:content};
        count++;
      }catch(e){console.log(e);}
    }
    if(count>0){saveFS();render();showMsg('Импорт','✅ Импортировано: '+count+' файл(ов)','OK');}
    inp.value='';
  },true); // true = override previous listener
});

// ── PINCH ZOOM FOR IMAGE VIEWER ──
(function(){
  var _origOpen=window.openItem;
  window.openItem=function(name){
    var node2=getNode(currentPath);
    var children2=node2&&node2.type==='root'?fs:(node2&&node2.children||{});
    var child2=children2[name];
    var IMG_EXTS=['.jpg','.jpeg','.png','.gif','.webp','.bmp'];
    if(child2&&child2.type==='file'&&IMG_EXTS.indexOf(child2.ext.toLowerCase())>=0&&child2.content&&child2.content.startsWith('data:')){
      var overlay=document.createElement('div');
      overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;flex-direction:column;touch-action:none;';
      var topbar=document.createElement('div');
      topbar.style.cssText='height:40px;background:linear-gradient(180deg,#1e88e5,#0a52a8);display:flex;align-items:center;padding:0 8px;gap:8px;flex-shrink:0;';
      topbar.innerHTML='<span style="color:#fff;font-size:13px;flex:1;font-family:sans-serif">🖼️ '+name+'</span>';
      var closeB=document.createElement('button');
      closeB.textContent='✕';
      closeB.style.cssText='background:linear-gradient(180deg,#f06060,#cc2222);color:#fff;border:none;border-radius:2px;width:24px;height:22px;font-size:13px;cursor:pointer;';
      closeB.onclick=function(){document.body.removeChild(overlay);};
      topbar.appendChild(closeB);
      overlay.appendChild(topbar);

      var container=document.createElement('div');
      container.style.cssText='flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;';
      var img=document.createElement('img');
      img.src=child2.content;
      img.style.cssText='max-width:100%;max-height:100%;border-radius:4px;transform-origin:center center;transition:transform 0.1s;user-select:none;-webkit-user-select:none;';
      container.appendChild(img);
      overlay.appendChild(container);

      // Pinch zoom state
      var scale=1, lastScale=1;
      var posX=0, posY=0, lastPosX=0, lastPosY=0;
      var startDist=0, startScale=1;
      var touches=[];

      function getDist(t1,t2){
        var dx=t1.clientX-t2.clientX, dy=t1.clientY-t2.clientY;
        return Math.sqrt(dx*dx+dy*dy);
      }
      function applyTransform(){
        img.style.transform='translate('+posX+'px,'+posY+'px) scale('+scale+')';
      }

      container.addEventListener('touchstart',function(e){
        e.preventDefault();
        if(e.touches.length===2){
          startDist=getDist(e.touches[0],e.touches[1]);
          startScale=scale;
        } else if(e.touches.length===1){
          lastPosX=posX; lastPosY=posY;
          touches=[{x:e.touches[0].clientX,y:e.touches[0].clientY}];
        }
      },{passive:false});

      container.addEventListener('touchmove',function(e){
        e.preventDefault();
        if(e.touches.length===2){
          var dist=getDist(e.touches[0],e.touches[1]);
          scale=Math.min(5,Math.max(1,startScale*(dist/startDist)));
          applyTransform();
        } else if(e.touches.length===1&&touches.length){
          if(scale>1){
            posX=lastPosX+(e.touches[0].clientX-touches[0].x);
            posY=lastPosY+(e.touches[0].clientY-touches[0].y);
            applyTransform();
          }
        }
      },{passive:false});

      container.addEventListener('touchend',function(e){
        if(scale<1){scale=1;posX=0;posY=0;applyTransform();}
        // Double tap to reset
        if(e.changedTouches.length===1){
          var now=Date.now();
          if(now-(container._lastTap||0)<300){scale=1;posX=0;posY=0;applyTransform();}
          container._lastTap=now;
        }
      });

      document.body.appendChild(overlay);
    } else {
      _origOpen(name);
    }
  };
})();

// ── CAPACITOR FILESYSTEM SAVE ──
(function(){
  var CAP = window.Capacitor;
  if(!CAP || !CAP.Plugins || !CAP.Plugins.Filesystem) return;
  var FS = CAP.Plugins.Filesystem;

  // Request permissions on start
  FS.requestPermissions().catch(function(){});

  // Override import to save real files to device
  var inp = document.getElementById('realImportInput');
  if(!inp) return;
  var MEDIA_EXTS=['.jpg','.jpeg','.png','.gif','.webp','.mp4','.webm','.mov','.3gp','.mp3','.wav','.aac'];
  var TEXT_EXTS=['.txt','.json','.html','.js','.css','.md','.csv','.xml','.ts','.py','.sql'];

  inp.addEventListener('change', async function(){
    if(!currentPath.length){showMsg('Импорт','Откройте папку сначала.','OK');return;}
    var parent=getNode(currentPath);
    if(!parent||!parent.children){showMsg('Импорт','Выберите папку.','OK');return;}
    var count=0;

    for(var i=0;i<inp.files.length;i++){
      var file=inp.files[i];
      var ext=file.name.includes('.')?file.name.slice(file.name.lastIndexOf('.')).toLowerCase():'.txt';
      var now=Date.now(); var name=file.name;
      if(parent.children[name]) name=name.replace(ext,'_copy'+ext);

      try{
        var isMedia = MEDIA_EXTS.indexOf(ext)>=0;
        var isText  = TEXT_EXTS.indexOf(ext)>=0;

        if(isMedia){
          // Save to device Documents/MyComputer/
          var b64 = await new Promise(function(res){
            var r=new FileReader(); r.onload=function(){res(r.result.split(',')[1]);}; r.readAsDataURL(file);
          });
          var devPath = 'MyComputer/'+name;
          await FS.writeFile({
            path: devPath,
            data: b64,
            directory: 'DOCUMENTS',
            recursive: true
          });
          // Store reference in FS (not full base64 — saves memory)
          parent.children[name]={type:'file',ext:ext,created:now,modified:now,
            content:'capacitor://'+devPath,
            devicePath: devPath,
            size: file.size};
        } else if(isText){
          var text = await file.text();
          parent.children[name]={type:'file',ext:ext,created:now,modified:now,content:text};
        } else {
          parent.children[name]={type:'file',ext:ext,created:now,modified:now,
            content:'[binary] '+file.name+' ('+Math.round(file.size/1024)+'КБ)'};
        }
        count++;
      }catch(e){console.log('import err',e);}
    }
    if(count>0){saveFS();render();showMsg('Импорт','✅ Сохранено в Документы/MyComputer: '+count+' файл(ов)','OK');}
    inp.value='';
  }, true);

  // Read media from device when opening
  window._readDeviceFile = async function(devicePath){
    try{
      var result = await FS.readFile({path:devicePath, directory:'DOCUMENTS'});
      return result.data;
    }catch(e){return null;}
  };
})();

// ── VIDEO VIEWER ──
(function(){
  var VID_EXTS=['.mp4','.webm','.ogg','.mov','.3gp','.mkv'];
  var _origOpen=window.openItem;
  window.openItem=function(name){
    var node2=getNode(currentPath);
    var children2=node2&&node2.type==='root'?fs:(node2&&node2.children||{});
    var child2=children2[name];
    if(child2&&child2.type==='file'&&VID_EXTS.indexOf(child2.ext.toLowerCase())>=0){
      var overlay=document.createElement('div');
      overlay.style.cssText='position:fixed;inset:0;background:#000;z-index:9999;display:flex;flex-direction:column;';
      var topbar=document.createElement('div');
      topbar.style.cssText='height:40px;background:linear-gradient(180deg,#1e88e5,#0a52a8);display:flex;align-items:center;padding:0 8px;flex-shrink:0;';
      topbar.innerHTML='<span style="color:#fff;font-size:13px;flex:1;font-family:sans-serif">🎬 '+name+'</span>';
      var closeB=document.createElement('button');
      closeB.textContent='✕';
      closeB.style.cssText='background:linear-gradient(180deg,#f06060,#cc2222);color:#fff;border:none;border-radius:2px;width:24px;height:22px;font-size:13px;cursor:pointer;';
      closeB.onclick=function(){vid.pause();vid.src='';document.body.removeChild(overlay);};
      topbar.appendChild(closeB);
      overlay.appendChild(topbar);

      var vid=document.createElement('video');
      vid.controls=true;
      vid.autoplay=true;
      vid.playsinline=true;
      vid.style.cssText='flex:1;width:100%;background:#000;';

      if(child2.content&&child2.content.startsWith('data:')){
        vid.src=child2.content;
      } else {
        // Not stored as base64 — show message
        var msg=document.createElement('div');
        msg.style.cssText='flex:1;display:flex;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;font-size:14px;text-align:center;padding:20px;';
        msg.innerHTML='⚠️ Видео не сохранено как base64.<br><br>Удалите файл и импортируйте заново.<br><small style="color:#aaa">Видео сохраняется при импорте</small>';
        overlay.appendChild(msg);
        document.body.appendChild(overlay);
        return;
      }

      overlay.appendChild(vid);
      document.body.appendChild(overlay);
    } else {
      _origOpen(name);
    }
  };
})();

// ── FIX IMPORT ADD VIDEO ──
document.addEventListener('DOMContentLoaded',function(){
  var inp=document.getElementById('realImportInput');
  if(!inp) return;
  var MEDIA_EXTS=['.jpg','.jpeg','.png','.gif','.webp','.bmp','.mp4','.webm','.ogg','.mov','.3gp'];
  var TEXT_EXTS=['.txt','.json','.html','.js','.css','.md','.csv','.xml','.ts','.py','.sql'];
  inp.addEventListener('change',async function(){
    if(!currentPath.length){showMsg('Импорт','Откройте папку сначала.','OK');return;}
    var parent=getNode(currentPath);
    if(!parent||!parent.children){showMsg('Импорт','Выберите папку.','OK');return;}
    var count=0;
    for(var i=0;i<inp.files.length;i++){
      var file=inp.files[i];
      var ext=file.name.includes('.')?file.name.slice(file.name.lastIndexOf('.')).toLowerCase():'.txt';
      var now=Date.now(); var name=file.name;
      if(parent.children[name]) name=name.replace(ext,'_copy'+ext);
      try{
        var content;
        if(MEDIA_EXTS.indexOf(ext)>=0){
          content=await new Promise(function(res){
            var r=new FileReader();
            r.onload=function(){res(r.result);};
            r.readAsDataURL(file);
          });
        } else if(TEXT_EXTS.indexOf(ext)>=0){
          content=await file.text();
        } else {
          content='[binary] '+file.name+' ('+Math.round(file.size/1024)+'КБ)';
        }
        parent.children[name]={type:'file',ext:ext,created:now,modified:now,content:content,size:file.size};
        count++;
      }catch(e){console.log(e);}
    }
    if(count>0){saveFS();render();showMsg('Импорт','✅ Импортировано: '+count+' файл(ов)','OK');}
    inp.value='';
  },true);
});

// ── DRAG & DROP MOVE FILES ──
(function(){
  var dragItem=null, dragPath=null;
  var dragGhost=null;

  function createGhost(name, node){
    var g=document.createElement('div');
    g.style.cssText='position:fixed;z-index:8000;background:#cce4f7;border:2px solid #0078d4;border-radius:4px;padding:4px 8px;font-size:12px;font-family:sans-serif;pointer-events:none;opacity:0.85;display:flex;align-items:center;gap:4px;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    g.innerHTML=getIconEmoji(name,node)+' '+name;
    document.body.appendChild(g);
    return g;
  }

  function moveGhost(x,y){
    if(dragGhost){dragGhost.style.left=(x-40)+'px';dragGhost.style.top=(y-20)+'px';}
  }

  function getTreeItemAtPoint(x,y){
    var els=document.elementsFromPoint(x,y);
    for(var i=0;i<els.length;i++){
      if(els[i].classList.contains('tree-item')){
        var path=JSON.parse(els[i].dataset.path||'null');
        return path;
      }
      if(els[i].classList.contains('file-item')){
        var name=els[i].dataset.name;
        var node=getNode(currentPath);
        var ch=node&&node.type==='root'?fs:(node&&node.children||{});
        if(ch[name]&&(ch[name].type==='folder'||ch[name].type==='drive')){
          return [...currentPath,name];
        }
      }
    }
    return null;
  }

  // Add tree item data-path
  var origRenderTree=window.renderTree||renderTree;
  function patchTreeItems(){
    document.querySelectorAll('.tree-item').forEach(function(el){
      var label=el.textContent.trim();
      // Find matching path from text
    });
  }

  // Patch makeTreeItem to store path
  var _origMake=window.makeTreeItem||makeTreeItem;

  // Long press on file → start drag
  document.getElementById('fileGrid').addEventListener('touchstart',function(e){
    var item=e.target.closest('.file-item');
    if(!item) return;
    var name=item.dataset.name;
    var node=getNode(currentPath);
    var ch=node&&node.type==='root'?fs:(node&&node.children||{});
    var child=ch[name];
    if(!child||child.type==='drive') return;

    var timer=setTimeout(function(){
      dragItem=name;
      dragPath=[...currentPath];
      dragGhost=createGhost(name,child);
      moveGhost(e.touches[0].clientX,e.touches[0].clientY);
      item.style.opacity='0.4';
      // Vibrate
      if(navigator.vibrate) navigator.vibrate(50);
    },500);

    function cancelDrag(){
      clearTimeout(timer);
      item.removeEventListener('touchend',cancelDrag);
      item.removeEventListener('touchmove',cancelOnMove);
    }
    function cancelOnMove(){
      clearTimeout(timer);
      item.removeEventListener('touchend',cancelDrag);
      item.removeEventListener('touchmove',cancelOnMove);
    }
    item.addEventListener('touchend',cancelDrag,{once:true});
    item.addEventListener('touchmove',cancelOnMove,{once:true});
  },{passive:true});

  document.addEventListener('touchmove',function(e){
    if(!dragItem) return;
    e.preventDefault();
    var touch=e.touches[0];
    moveGhost(touch.clientX,touch.clientY);
    // Highlight target
    document.querySelectorAll('.file-item,.tree-item').forEach(function(el){el.style.background='';});
    var target=getTreeItemAtPoint(touch.clientX,touch.clientY);
    if(target!==null){
      var els=document.elementsFromPoint(touch.clientX,touch.clientY);
      for(var i=0;i<els.length;i++){
        if(els[i].classList.contains('file-item')||els[i].classList.contains('tree-item')){
          els[i].style.background='#cce4f7'; break;
        }
      }
    }
  },{passive:false});

  document.addEventListener('touchend',function(e){
    if(!dragItem) return;
    var touch=e.changedTouches[0];
    var targetPath=getTreeItemAtPoint(touch.clientX,touch.clientY);

    // Cleanup
    if(dragGhost){document.body.removeChild(dragGhost);dragGhost=null;}
    document.querySelectorAll('.file-item').forEach(function(el){el.style.opacity='';el.style.background='';});
    document.querySelectorAll('.tree-item').forEach(function(el){el.style.background='';});

    if(targetPath&&JSON.stringify(targetPath)!==JSON.stringify(dragPath)){
      var srcParent=getNode(dragPath);
      var srcChildren=srcParent&&srcParent.type==='root'?fs:(srcParent&&srcParent.children||{});
      var fileNode=srcChildren[dragItem];
      var destParent=getNode(targetPath);

      if(fileNode&&destParent&&destParent.children!==undefined){
        var destChildren=destParent.type==='root'?null:destParent.children;
        if(destChildren){
          var newName=dragItem;
          if(destChildren[newName]) newName=newName.replace(/(\.[\w]+)?$/,'_copy$1');
          destChildren[newName]=fileNode;
          delete srcChildren[dragItem];
          saveFS(); render();
          showMsg('Перемещено','✅ "'+dragItem+'" → '+targetPath.join(' \\ '),'OK');
        }
      }
    }
    dragItem=null; dragPath=null;
  });
})();

// ── MULTI-SELECT + COPY/CUT/PASTE ──
(function(){
  var clipboard = { items:{}, operation:null }; // operation: 'copy' or 'cut'
  var selectedItems = {}; // multi-select

  // ── SELECTION ──
  function toggleSelect(name){
    if(selectedItems[name]) delete selectedItems[name];
    else selectedItems[name]=true;
    updateSelection();
  }
  function clearSelection(){ selectedItems={}; updateSelection(); }
  function updateSelection(){
    document.querySelectorAll('.file-item').forEach(function(el){
      el.classList.toggle('selected', !!selectedItems[el.dataset.name]);
    });
    var count=Object.keys(selectedItems).length;
    statusText.textContent = count>0 ? 'Выбрано: '+count+' объект(ов)' : 'Готово';
    // Show/hide paste button
    updateEditMenu();
  }

  // ── CONTEXT MENU EXTRA ──
  var ctxMenu=document.getElementById('contextMenu');
  // Add copy/cut/paste to context menu
  var sep=document.createElement('div'); sep.className='ctx-sep';
  var ctxCopy=document.createElement('div'); ctxCopy.className='ctx-item'; ctxCopy.dataset.action='copy'; ctxCopy.textContent='📋 Копировать';
  var ctxCut=document.createElement('div'); ctxCut.className='ctx-item'; ctxCut.dataset.action='cut'; ctxCut.textContent='✂️ Вырезать';
  var ctxPaste=document.createElement('div'); ctxPaste.className='ctx-item'; ctxPaste.dataset.action='paste'; ctxPaste.textContent='📌 Вставить';
  var sep2=document.createElement('div'); sep2.className='ctx-sep';
  // Insert before first separator
  var firstSep=ctxMenu.querySelector('.ctx-sep');
  ctxMenu.insertBefore(sep2,firstSep);
  ctxMenu.insertBefore(ctxPaste,sep2);
  ctxMenu.insertBefore(ctxCut,ctxPaste);
  ctxMenu.insertBefore(ctxCopy,ctxCut);
  ctxMenu.insertBefore(sep,ctxCopy);

  // ── TOOLBAR BUTTONS ──
  var toolbar=document.querySelector('.toolbar');
  var sep3=document.createElement('div'); sep3.className='toolbar-separator';
  var btnCopy=document.createElement('button'); btnCopy.className='tool-btn'; btnCopy.title='Копировать';
  btnCopy.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
  var btnCut=document.createElement('button'); btnCut.className='tool-btn'; btnCut.title='Вырезать';
  btnCut.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="20" r="2"/><circle cx="6" cy="4" r="2"/><line x1="6" y1="6" x2="6" y2="18"/><line x1="6" y1="12" x2="21" y2="3"/><line x1="6" y1="12" x2="21" y2="21"/></svg>';
  var btnPaste=document.createElement('button'); btnPaste.className='tool-btn'; btnPaste.title='Вставить';
  btnPaste.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>';
  toolbar.appendChild(sep3); toolbar.appendChild(btnCopy); toolbar.appendChild(btnCut); toolbar.appendChild(btnPaste);

  // ── LEFT PANEL TASKS ──
  var taskList=document.querySelector('.task-list');
  var taskCopy=document.createElement('div'); taskCopy.className='task-item'; taskCopy.textContent='📋 Копировать';
  var taskCut=document.createElement('div'); taskCut.className='task-item'; taskCut.textContent='✂️ Вырезать';
  var taskPaste=document.createElement('div'); taskPaste.className='task-item'; taskPaste.textContent='📌 Вставить';
  taskList.appendChild(taskCopy); taskList.appendChild(taskCut); taskList.appendChild(taskPaste);

  function updateEditMenu(){
    var hasSel=Object.keys(selectedItems).length>0||selectedItem;
    var hasClip=clipboard.operation!==null;
    [btnPaste,ctxPaste,taskPaste].forEach(function(el){el.style.opacity=hasClip?'1':'0.4';});
    [btnCopy,btnCut,ctxCopy,ctxCut,taskCopy,taskCut].forEach(function(el){el.style.opacity=hasSel?'1':'0.4';});
  }
  updateEditMenu();

  // ── COPY ──
  function doCopy(){
    var items={};
    var sel=Object.keys(selectedItems);
    if(!sel.length&&selectedItem) sel=[selectedItem];
    if(!sel.length){showMsg('Копировать','Выберите файл или папку.','OK');return;}
    var node=getNode(currentPath);
    var ch=node&&node.type==='root'?fs:(node&&node.children||{});
    sel.forEach(function(name){if(ch[name]) items[name]=JSON.parse(JSON.stringify(ch[name]));});
    clipboard={items:items, operation:'copy', fromPath:[...currentPath]};
    showMsg('Копировать','📋 Скопировано: '+sel.length+' объект(ов)','OK');
    updateEditMenu();
  }

  // ── CUT ──
  function doCut(){
    var sel=Object.keys(selectedItems);
    if(!sel.length&&selectedItem) sel=[selectedItem];
    if(!sel.length){showMsg('Вырезать','Выберите файл или папку.','OK');return;}
    var node=getNode(currentPath);
    var ch=node&&node.type==='root'?fs:(node&&node.children||{});
    var items={};
    sel.forEach(function(name){if(ch[name]) items[name]=JSON.parse(JSON.stringify(ch[name]));});
    clipboard={items:items, operation:'cut', fromPath:[...currentPath]};
    // Gray out cut items
    document.querySelectorAll('.file-item').forEach(function(el){
      if(items[el.dataset.name]) el.style.opacity='0.4';
    });
    showMsg('Вырезать','✂️ Вырезано: '+sel.length+' объект(ов)','OK');
    updateEditMenu();
  }

  // ── PASTE ──
  function doPaste(){
    if(!clipboard.operation){showMsg('Вставить','Буфер обмена пуст.','OK');return;}
    if(!currentPath.length){showMsg('Вставить','Нельзя вставить в корень.','OK');return;}
    var destNode=getNode(currentPath);
    if(!destNode||!destNode.children){showMsg('Вставить','Выберите папку для вставки.','OK');return;}
    var destCh=destNode.children;
    var count=0;
    Object.entries(clipboard.items).forEach(function(entry){
      var name=entry[0], node=entry[1];
      var newName=name;
      if(destCh[newName]) newName=newName.replace(/(\.[\w]+)?$/,' — копия$1');
      destCh[newName]=JSON.parse(JSON.stringify(node));
      count++;
    });
    // If cut — remove from source
    if(clipboard.operation==='cut'){
      var srcNode=getNode(clipboard.fromPath);
      var srcCh=srcNode&&srcNode.type==='root'?fs:(srcNode&&srcNode.children||{});
      Object.keys(clipboard.items).forEach(function(name){delete srcCh[name];});
      clipboard={items:{},operation:null};
    }
    saveFS(); clearSelection(); render();
    showMsg('Вставить','✅ Вставлено: '+count+' объект(ов)','OK');
    updateEditMenu();
  }

  // ── EVENTS ──
  btnCopy.addEventListener('click',doCopy);
  btnCut.addEventListener('click',doCut);
  btnPaste.addEventListener('click',doPaste);
  taskCopy.addEventListener('click',doCopy);
  taskCut.addEventListener('click',doCut);
  taskPaste.addEventListener('click',doPaste);
  ctxCopy.addEventListener('click',function(){hideContextMenu();doCopy();});
  ctxCut.addEventListener('click',function(){hideContextMenu();doCut();});
  ctxPaste.addEventListener('click',function(){hideContextMenu();doPaste();});

  // Multi-select: long press on item
  document.getElementById('fileGrid').addEventListener('touchstart',function(e){
    var item=e.target.closest('.file-item');
    if(!item) return;
    var timer=setTimeout(function(){
      if(navigator.vibrate) navigator.vibrate(30);
      toggleSelect(item.dataset.name);
    },400);
    item.addEventListener('touchend',function(){clearTimeout(timer);},{once:true});
    item.addEventListener('touchmove',function(){clearTimeout(timer);},{once:true,passive:true});
  },{passive:true});

  // Keyboard shortcuts
  document.addEventListener('keydown',function(e){
    if(e.ctrlKey){
      if(e.key==='c'){e.preventDefault();doCopy();}
      if(e.key==='x'){e.preventDefault();doCut();}
      if(e.key==='v'){e.preventDefault();doPaste();}
      if(e.key==='a'){
        e.preventDefault();
        var node=getNode(currentPath);
        var ch=node&&node.type==='root'?fs:(node&&node.children||{});
        Object.keys(ch).forEach(function(n){selectedItems[n]=true;});
        updateSelection();
      }
    }
    if(e.key==='Escape') clearSelection();
  });

  // Clear selection on background click
  document.getElementById('rightPanel').addEventListener('click',function(e){
    if(!e.target.closest('.file-item')) clearSelection();
  });
})();

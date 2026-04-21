/**
 * MY COMPUTER — Windows-style File Manager
 * app.js  — Virtual FS in localStorage, Android-ready
 */

'use strict';

/* ═══════════════════════════════════════════════
   VIRTUAL FILESYSTEM
   Stored in localStorage key: "myComputer_fs"
   Structure:
   {
     "C:": { type:"drive", children: { "Folder": { type:"folder", children:{}, created, modified }, ... } },
     "D:": { type:"drive", children: { ... } }
   }
═══════════════════════════════════════════════ */

const FS_KEY = 'myComputer_fs';
const HISTORY_KEY = 'myComputer_hist';

// ── Default filesystem ──────────────────────────
function defaultFS() {
  const now = Date.now();
  return {
    "C:": {
      type: "drive",
      label: "Локальный диск (C:)",
      children: {
        "Документы": { type: "folder", created: now, modified: now, children: {} },
        "Загрузки": { type: "folder", created: now, modified: now, children: {} },
        "Изображения": { type: "folder", created: now, modified: now, children: {} },
        "readme.txt": {
          type: "file", ext: ".txt",
          created: now, modified: now,
          content: "Добро пожаловать в Мой компьютер!\nЭто ваш персональный файловый менеджер.\n\nВы можете создавать папки и файлы,\nредактировать тексты, и сохранять данные."
        }
      }
    },
    "D:": {
      type: "drive",
      label: "Диск данных (D:)",
      children: {
        "Проекты": { type: "folder", created: now, modified: now, children: {
          "Мой сайт": { type: "folder", created: now, modified: now, children: {
            "index.html": { type:"file", ext:".html", created:now, modified:now,
              content:"<!DOCTYPE html>\n<html>\n<head><title>Мой сайт</title></head>\n<body>\n  <h1>Привет, мир!</h1>\n</body>\n</html>" }
          }}
        }},
        "Музыка": { type: "folder", created: now, modified: now, children: {} },
        "Видео": { type: "folder", created: now, modified: now, children: {} }
      }
    }
  };
}

// ── FS helpers ──────────────────────────────────
function loadFS() {
  try {
    const raw = localStorage.getItem(FS_KEY);
    return raw ? JSON.parse(raw) : defaultFS();
  } catch { return defaultFS(); }
}
function saveFS() {
  try { localStorage.setItem(FS_KEY, JSON.stringify(fs)); }
  catch(e) { showMsg('Ошибка', 'Не удалось сохранить: ' + e.message); }
}
function getNode(path) {
  // path: [] = root, ['C:'] = drive, ['C:','Docs'] = folder
  if (!path.length) return { type: 'root', children: fs };
  let node = fs[path[0]];
  for (let i = 1; i < path.length; i++) {
    if (!node || !node.children) return null;
    node = node.children[path[i]];
  }
  return node;
}
function getParentNode(path) {
  return getNode(path.slice(0, -1));
}
function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
function formatSize(str) {
  const bytes = new TextEncoder().encode(str || '').length;
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / 1048576).toFixed(2) + ' МБ';
}
function countItems(node) {
  if (!node.children) return 0;
  return Object.keys(node.children).length;
}

/* ═══════════════════════════════════════════════
   APP STATE
═══════════════════════════════════════════════ */
let fs = loadFS();
let currentPath = [];          // [] = root
let historyStack = [];         // back history
let forwardStack = [];         // forward history
let selectedItem = null;       // currently selected name
let viewMode = 'grid';         // 'grid' | 'list'
let currentEditPath = null;    // path array for open editor file
let editorDirty = false;

/* ═══════════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const fileGrid     = $('fileGrid');
const emptyHint    = $('emptyHint');
const addressBar   = $('addressBar');
const breadcrumb   = $('breadcrumb');
const folderTree   = $('folderTree');
const statusText   = $('statusText');
const statusCount  = $('statusCount');
const titleBarText = $('titleBarText');
const taskbarTitle = $('taskbarTitle');
const detailIcon   = $('detailIcon');
const detailName   = $('detailName');
const detailInfo   = $('detailInfo');
const contextMenu  = $('contextMenu');
const modalOverlay = $('modalOverlay');
const editorModal  = $('editorModal');
const dialogModal  = $('dialogModal');
const propsModal   = $('propsModal');
const msgModal     = $('msgModal');
const startMenu    = $('startMenu');

/* ═══════════════════════════════════════════════
   CLOCK
═══════════════════════════════════════════════ */
function updateClock() {
  const now = new Date();
  $('clock').textContent = now.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

/* ═══════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════ */
function svgDrive(letter) {
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="8" width="36" height="26" rx="3" fill="#c8c8c8" stroke="#999" stroke-width="1"/>
    <rect x="4" y="10" width="32" height="10" rx="1" fill="#b0b0b0"/>
    <rect x="4" y="22" width="20" height="9" rx="1" fill="#d8d8d8"/>
    <circle cx="30" cy="27" r="4" fill="#3a7fd4" stroke="#2060b0" stroke-width="0.5"/>
    <circle cx="30" cy="27" r="1.5" fill="#80b8f0"/>
    <text x="14" y="20" font-size="7" fill="#555" font-weight="bold" text-anchor="middle"
      font-family="Arial">${letter}</text>
  </svg>`;
}
function svgFolder(color='#f0c040') {
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 14 Q3 11 6 11 L16 11 L19 8 L34 8 Q37 8 37 11 L37 30 Q37 33 34 33 L6 33 Q3 33 3 30 Z"
      fill="${color}" stroke="${shadeColor(color,-30)}" stroke-width="1"/>
    <path d="M3 16 L37 16 L37 30 Q37 33 34 33 L6 33 Q3 33 3 30 Z"
      fill="${lightenColor(color,15)}" stroke="${shadeColor(color,-30)}" stroke-width="1"/>
  </svg>`;
}
function svgFile(ext) {
  const colors = {
    '.txt':  '#ffffff', '.json': '#fff3cd', '.html': '#ffe0cc',
    '.js':   '#fff9c4', '.css':  '#e0f0ff', '.md':   '#f0fff0'
  };
  const icons = {
    '.txt':  'TXT', '.json': 'JS\nON', '.html': 'HTM',
    '.js':   'JS',  '.css':  'CSS',   '.md':   'MD'
  };
  const col = colors[ext] || '#f8f8f8';
  const lbl = icons[ext] || ext.replace('.','').toUpperCase().slice(0,3);
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 3 L26 3 L32 9 L32 37 L8 37 Z" fill="${col}" stroke="#aaa" stroke-width="1"/>
    <path d="M26 3 L26 9 L32 9 Z" fill="#ddd" stroke="#aaa" stroke-width="1"/>
    <text x="20" y="28" font-size="8" fill="#555" font-weight="bold"
      text-anchor="middle" font-family="Arial">${lbl}</text>
  </svg>`;
}
function svgComputer() {
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="5" width="32" height="22" rx="2" fill="#c8c8c8" stroke="#888" stroke-width="1"/>
    <rect x="6" y="7" width="28" height="18" rx="1" fill="#2060b0"/>
    <rect x="12" y="27" width="16" height="4" fill="#b0b0b0"/>
    <rect x="8" y="31" width="24" height="3" rx="1" fill="#c8c8c8" stroke="#888" stroke-width="0.5"/>
    <path d="M10 16 L15 11 L20 14 L25 9 L30 13" stroke="#80d0ff" stroke-width="1.5" fill="none"/>
    <circle cx="25" cy="9" r="1.5" fill="#ffdd44"/>
  </svg>`;
}
function shadeColor(hex, pct) {
  const num = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, Math.max(0, (num>>16) + pct));
  const g = Math.min(255, Math.max(0, ((num>>8)&0xff) + pct));
  const b = Math.min(255, Math.max(0, (num&0xff) + pct));
  return '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function lightenColor(hex, pct) { return shadeColor(hex, pct); }

function getIcon(name, node) {
  if (!node) return svgComputer();
  if (node.type === 'drive') return svgDrive(name.replace(':',''));
  if (node.type === 'folder') return svgFolder();
  return svgFile(node.ext || '.txt');
}
function getIconEmoji(name, node) {
  if (!node || node.type === 'root') return '🖥️';
  if (node.type === 'drive') return '💾';
  if (node.type === 'folder') return '📁';
  const map = { '.txt':'📄', '.json':'📋', '.html':'🌐', '.js':'📜', '.css':'🎨', '.md':'📝' };
  return map[node.ext] || '📄';
}

/* ═══════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════ */
function navigate(newPath, pushHistory = true) {
  if (pushHistory) {
    historyStack.push([...currentPath]);
    forwardStack = [];
  }
  currentPath = [...newPath];
  selectedItem = null;
  render();
}
function goBack() {
  if (!historyStack.length) return;
  forwardStack.push([...currentPath]);
  currentPath = historyStack.pop();
  selectedItem = null;
  render();
}
function goForward() {
  if (!forwardStack.length) return;
  historyStack.push([...currentPath]);
  currentPath = forwardStack.pop();
  selectedItem = null;
  render();
}
function goUp() {
  if (!currentPath.length) return;
  navigate(currentPath.slice(0, -1));
}

/* ═══════════════════════════════════════════════
   RENDER
═══════════════════════════════════════════════ */
function render() {
  renderNav();
  renderTree();
  renderFiles();
  renderDetails();
  updateButtons();
}

function renderNav() {
  // Address bar
  const parts = ['Мой компьютер', ...currentPath];
  addressBar.textContent = parts.join(' \\ ');
  titleBarText.textContent = currentPath.length ? currentPath[currentPath.length-1] : 'Мой компьютер';
  taskbarTitle.textContent = titleBarText.textContent;

  // Breadcrumb
  breadcrumb.innerHTML = '';
  const addCrumb = (label, path, active) => {
    const sp = document.createElement('span');
    sp.className = 'crumb' + (active ? ' active' : '');
    sp.textContent = label;
    sp.dataset.path = JSON.stringify(path);
    if (!active) sp.addEventListener('click', () => navigate(path));
    breadcrumb.appendChild(sp);
  };
  addCrumb('🖥️ Мой компьютер', [], !currentPath.length);
  currentPath.forEach((part, i) => {
    const sep = document.createElement('span');
    sep.className = 'crumb-sep'; sep.textContent = ' › ';
    breadcrumb.appendChild(sep);
    addCrumb(part, currentPath.slice(0, i+1), i === currentPath.length-1);
  });
}

function renderTree() {
  folderTree.innerHTML = '';
  // Root
  const rootItem = makeTreeItem('🖥️ Мой компьютер', 0, [], !currentPath.length);
  folderTree.appendChild(rootItem);
  // Drives
  Object.entries(fs).forEach(([dname, drive]) => {
    const dPath = [dname];
    const dItem = makeTreeItem('💾 ' + dname, 1, dPath, JSON.stringify(currentPath) === JSON.stringify(dPath));
    folderTree.appendChild(dItem);
    // First-level folders
    if (drive.children) {
      Object.entries(drive.children).forEach(([fname, fnode]) => {
        if (fnode.type === 'folder') {
          const fPath = [dname, fname];
          const fItem = makeTreeItem('📁 ' + fname, 2, fPath,
            JSON.stringify(currentPath) === JSON.stringify(fPath));
          folderTree.appendChild(fItem);
        }
      });
    }
  });
}

function makeTreeItem(label, indent, path, active) {
  const div = document.createElement('div');
  div.className = 'tree-item' + (active ? ' active' : '');
  div.innerHTML = `<span class="tree-indent" style="width:${indent*12}px"></span>${label}`;
  div.addEventListener('click', () => navigate(path));
  return div;
}

function renderFiles() {
  fileGrid.innerHTML = '';
  const node = getNode(currentPath);
  fileGrid.className = 'file-grid' + (viewMode === 'list' ? ' list-view' : '');

  let children = {};
  if (!node) { emptyHint.style.display='block'; return; }
  if (node.type === 'root') children = fs;
  else if (node.children) children = node.children;

  const entries = Object.entries(children);
  emptyHint.style.display = entries.length === 0 ? 'block' : 'none';

  // Sort: folders first, then drives, then files
  entries.sort(([an, av], [bn, bv]) => {
    const rank = n => n.type==='drive'?0: n.type==='folder'?1:2;
    if (rank(av) !== rank(bv)) return rank(av) - rank(bv);
    return an.localeCompare(bn, 'ru');
  });

  entries.forEach(([name, child]) => {
    const item = document.createElement('div');
    item.className = 'file-item' + (selectedItem === name ? ' selected' : '');
    item.dataset.name = name;

    const iconWrap = document.createElement('div');
    iconWrap.className = 'file-icon-wrap';
    iconWrap.innerHTML = getIcon(name, child);

    if (child.type === 'drive') {
      const badge = document.createElement('div');
      badge.className = 'drive-badge';
      badge.textContent = name.replace(':','');
      iconWrap.appendChild(badge);
    }

    const label = document.createElement('div');
    label.className = 'file-label';
    label.textContent = child.type === 'drive' ? child.label || name : name;

    item.appendChild(iconWrap);
    item.appendChild(label);

    // Click → select
    item.addEventListener('click', e => {
      e.stopPropagation();
      selectItem(name);
    });
    // Double click / double tap → open
    let lastTap = 0;
    item.addEventListener('click', e => {
      const now = Date.now();
      if (now - lastTap < 350) { openItem(name); lastTap = 0; }
      else lastTap = now;
    });
    // Long press → context menu
    let pressTimer;
    item.addEventListener('touchstart', e => {
      pressTimer = setTimeout(() => {
        selectItem(name);
        showContextMenu(e.touches[0].clientX, e.touches[0].clientY, name);
      }, 600);
    }, { passive: true });
    item.addEventListener('touchend', () => clearTimeout(pressTimer));
    item.addEventListener('touchmove', () => clearTimeout(pressTimer));

    // Right click → context menu
    item.addEventListener('contextmenu', e => {
      e.preventDefault();
      selectItem(name);
      showContextMenu(e.clientX, e.clientY, name);
    });

    fileGrid.appendChild(item);
  });

  // Count
  const dirs = entries.filter(([,v]) => v.type==='folder'||v.type==='drive').length;
  const files = entries.filter(([,v]) => v.type==='file').length;
  statusCount.textContent = `${entries.length} объект(ов)`;
  statusText.textContent = selectedItem ? `Выбран: ${selectedItem}` : 'Готово';
}

function renderDetails() {
  if (selectedItem) {
    const node = getNode(currentPath);
    const children = node?.children || (node?.type==='root' ? fs : {});
    const child = children[selectedItem];
    if (child) {
      detailIcon.textContent = getIconEmoji(selectedItem, child);
      detailName.textContent = selectedItem;
      const lines = [];
      if (child.type === 'drive') lines.push('Тип: Локальный диск');
      else if (child.type === 'folder') {
        lines.push('Тип: Папка');
        lines.push(`Содержит: ${countItems(child)} эл.`);
      } else {
        lines.push('Тип: ' + (child.ext || '.txt').toUpperCase().replace('.','') + '-файл');
        lines.push('Размер: ' + formatSize(child.content));
      }
      if (child.modified) lines.push('Изм.: ' + formatDate(child.modified));
      detailInfo.textContent = lines.join('\n');
      return;
    }
  }
  // Default: current location
  const node = getNode(currentPath);
  if (!currentPath.length) {
    detailIcon.textContent = '🖥️';
    detailName.textContent = 'Мой компьютер';
    detailInfo.textContent = `Дисков: ${Object.keys(fs).length}`;
  } else if (node) {
    detailIcon.textContent = getIconEmoji(currentPath[currentPath.length-1], node);
    detailName.textContent = currentPath[currentPath.length-1];
    detailInfo.textContent = node.type === 'folder'
      ? `Содержит: ${countItems(node)} эл.`
      : node.type === 'drive' ? node.label || '' : '';
  }
}

function selectItem(name) {
  selectedItem = name;
  document.querySelectorAll('.file-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.name === name);
    el.querySelector('.file-label')?.classList.toggle('selected', el.dataset.name === name);
  });
  renderDetails();
  statusText.textContent = `Выбран: ${name}`;
}

function updateButtons() {
  $('backBtn').disabled = !historyStack.length;
  $('forwardBtn').disabled = !forwardStack.length;
  $('upBtn').disabled = !currentPath.length;
}

/* ═══════════════════════════════════════════════
   OPEN ITEM
═══════════════════════════════════════════════ */
function openItem(name) {
  const node = getNode(currentPath);
  const children = node?.type === 'root' ? fs : (node?.children || {});
  const child = children[name];
  if (!child) return;

  if (child.type === 'drive' || child.type === 'folder') {
    navigate([...currentPath, name]);
  } else if (child.type === 'file') {
    openEditor([...currentPath, name], child);
  }
}

/* ═══════════════════════════════════════════════
   TEXT EDITOR
═══════════════════════════════════════════════ */
function openEditor(filePath, node, isNew = false) {
  currentEditPath = filePath;
  editorDirty = false;

  $('editorTitle').textContent = filePath[filePath.length - 1];
  $('editorPath').textContent = filePath.join(' \\ ');
  $('editorArea').value = node.content || '';
  $('editorArea').style.fontSize = $('editorFontSize').value + 'px';
  $('editorStatus').textContent = isNew ? '● Новый файл' : '✓ Сохранено';
  $('editorStatus').style.color = isNew ? '#cc7700' : 'green';

  updateEditorStats();
  showModal(editorModal);
}

function updateEditorStats() {
  const text = $('editorArea').value;
  const lines = text.split('\n').length;
  const chars = text.length;
  $('editorLines').textContent = `Строк: ${lines}`;
  $('editorChars').textContent = `Символов: ${chars}`;
}

function saveEditor() {
  if (!currentEditPath) return;
  const parentPath = currentEditPath.slice(0, -1);
  const fname = currentEditPath[currentEditPath.length - 1];
  const parent = getNode(parentPath);
  if (!parent || !parent.children) return;
  const now = Date.now();
  if (!parent.children[fname]) {
    parent.children[fname] = { type:'file', ext: getExt(fname), created: now };
  }
  parent.children[fname].content = $('editorArea').value;
  parent.children[fname].modified = now;
  saveFS();
  editorDirty = false;
  $('editorStatus').textContent = '✓ Сохранено';
  $('editorStatus').style.color = 'green';
  renderFiles();
}

function getExt(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i) : '.txt';
}

/* ═══════════════════════════════════════════════
   DIALOGS
═══════════════════════════════════════════════ */
let dialogCallback = null;
let msgCallback = null;

function showDialog(title, label, defaultVal, showExt, callback) {
  $('dialogTitle').textContent = title;
  $('dialogLabel').textContent = label;
  $('dialogInput').value = defaultVal || '';
  $('dialogExtRow').style.display = showExt ? 'flex' : 'none';
  dialogCallback = callback;
  showModal(dialogModal);
  setTimeout(() => $('dialogInput').focus(), 100);
}

function showMsg(title, body, yesLabel='OK', noLabel=null, callback=null) {
  $('msgTitle').textContent = title;
  $('msgBody').textContent = body;
  $('msgYes').textContent = yesLabel;
  $('msgNo').textContent = noLabel || 'Нет';
  $('msgNo').style.display = noLabel ? 'inline-flex' : 'none';
  msgCallback = callback;
  showModal(msgModal);
}

function showProperties(name, node) {
  const lines = [];
  if (node.type === 'drive') {
    lines.push(['Имя', node.label || name]);
    lines.push(['Тип', 'Локальный диск']);
    lines.push(['Обозначение', name]);
    lines.push(['Объектов', Object.keys(node.children || {}).length]);
  } else if (node.type === 'folder') {
    lines.push(['Имя', name]);
    lines.push(['Тип', 'Папка']);
    lines.push(['Содержит', countItems(node) + ' объект(ов)']);
    lines.push(['Создан', formatDate(node.created)]);
    lines.push(['Изменён', formatDate(node.modified)]);
  } else {
    lines.push(['Имя', name]);
    lines.push(['Тип', (node.ext || '.txt').toUpperCase().replace('.','') + '-документ']);
    lines.push(['Расширение', node.ext || '.txt']);
    lines.push(['Размер', formatSize(node.content)]);
    lines.push(['Создан', formatDate(node.created)]);
    lines.push(['Изменён', formatDate(node.modified)]);
  }
  const body = $('propsBody');
  body.innerHTML = `<div class="props-icon">${getIconEmoji(name, node)}</div>` +
    lines.map(([k,v]) => `<div class="props-row"><div class="props-key">${k}:</div><div class="props-val">${v}</div></div>`).join('');
  showModal(propsModal);
}

function showModal(modal) {
  modalOverlay.style.display = 'flex';
  [editorModal, dialogModal, propsModal, msgModal].forEach(m => m.style.display = 'none');
  modal.style.display = 'flex';
}
function closeModal() {
  modalOverlay.style.display = 'none';
  currentEditPath = null;
}

/* ═══════════════════════════════════════════════
   FILE OPERATIONS
═══════════════════════════════════════════════ */
function createFolder() {
  showDialog('Создать папку', 'Имя папки:', 'Новая папка', false, name => {
    if (!name.trim()) return;
    const node = getNode(currentPath);
    if (node?.type === 'root') { showMsg('Ошибка', 'Нельзя создать папку в корне.'); return; }
    const children = node?.children;
    if (!children) { showMsg('Ошибка', 'Невозможно создать папку здесь.'); return; }
    if (children[name]) { showMsg('Ошибка', `"${name}" уже существует.`); return; }
    const now = Date.now();
    children[name.trim()] = { type: 'folder', created: now, modified: now, children: {} };
    saveFS();
    render();
    selectItem(name.trim());
  });
}

function createFile() {
  showDialog('Создать файл', 'Имя файла (без расширения):', 'Новый документ', true, (name, ext) => {
    if (!name.trim()) return;
    const node = getNode(currentPath);
    if (node?.type === 'root') { showMsg('Ошибка', 'Нельзя создать файл в корне.'); return; }
    const children = node?.children;
    if (!children) { showMsg('Ошибка', 'Невозможно создать файл здесь.'); return; }
    const fullName = name.trim() + ext;
    if (children[fullName]) { showMsg('Ошибка', `"${fullName}" уже существует.`); return; }
    const now = Date.now();
    const newNode = { type: 'file', ext, created: now, modified: now, content: '' };
    children[fullName] = newNode;
    saveFS();
    render();
    openEditor([...currentPath, fullName], newNode, true);
  });
}

function deleteItem(name) {
  const node = getNode(currentPath);
  const children = node?.type === 'root' ? null : node?.children;
  if (!children || !children[name]) return;
  const child = children[name];
  const type = child.type === 'folder' ? 'папку' : child.type === 'drive' ? 'диск' : 'файл';
  showMsg('Подтверждение', `Удалить ${type} "${name}"?`, 'Удалить', 'Отмена', confirmed => {
    if (!confirmed) return;
    if (child.type === 'drive') { showMsg('Ошибка', 'Диск нельзя удалить.'); return; }
    delete children[name];
    saveFS();
    selectedItem = null;
    render();
  });
}

function renameItem(name) {
  const node = getNode(currentPath);
  const children = node?.type === 'root' ? null : node?.children;
  if (!children || !children[name]) return;
  const child = children[name];
  if (child.type === 'drive') { showMsg('Ошибка', 'Диск нельзя переименовать.'); return; }

  showDialog('Переименовать', 'Новое имя:', name, false, newName => {
    if (!newName.trim() || newName === name) return;
    if (children[newName]) { showMsg('Ошибка', `"${newName}" уже существует.`); return; }
    children[newName.trim()] = { ...children[name] };
    if (child.type === 'file') {
      children[newName.trim()].ext = getExt(newName.trim());
    }
    delete children[name];
    saveFS();
    selectedItem = newName.trim();
    render();
  });
}

/* ═══════════════════════════════════════════════
   CONTEXT MENU
═══════════════════════════════════════════════ */
let ctxTarget = null;
function showContextMenu(x, y, name) {
  ctxTarget = name;
  // Position within viewport
  const W = window.innerWidth, H = window.innerHeight;
  const mw = 170, mh = 180;
  contextMenu.style.left = Math.min(x, W - mw) + 'px';
  contextMenu.style.top  = Math.min(y, H - mh - 36) + 'px';
  contextMenu.style.display = 'block';

  // Show/hide items based on selection
  const node = getNode(currentPath);
  const children = node?.type === 'root' ? fs : (node?.children || {});
  const child = name ? children[name] : null;

  contextMenu.querySelectorAll('[data-action]').forEach(el => {
    const a = el.dataset.action;
    if (a === 'open')    el.style.display = child ? 'block' : 'none';
    if (a === 'rename')  el.style.display = (child && child.type !== 'drive') ? 'block' : 'none';
    if (a === 'delete')  el.style.display = (child && child.type !== 'drive') ? 'block' : 'none';
    if (a === 'properties') el.style.display = child ? 'block' : 'none';
    if (a === 'newFolder') {
      const inDrive = currentPath.length >= 1;
      el.style.display = inDrive ? 'block' : 'none';
    }
    if (a === 'newFile') {
      const inDrive = currentPath.length >= 1;
      el.style.display = inDrive ? 'block' : 'none';
    }
  });
}
function hideContextMenu() {
  contextMenu.style.display = 'none';
}

contextMenu.querySelectorAll('[data-action]').forEach(el => {
  el.addEventListener('click', e => {
    e.stopPropagation();
    const action = el.dataset.action;
    hideContextMenu();
    switch(action) {
      case 'open':       if (ctxTarget) openItem(ctxTarget); break;
      case 'newFolder':  createFolder(); break;
      case 'newFile':    createFile(); break;
      case 'rename':     if (ctxTarget) renameItem(ctxTarget); break;
      case 'delete':     if (ctxTarget) deleteItem(ctxTarget); break;
      case 'properties': {
        const node = getNode(currentPath);
        const children = node?.type==='root' ? fs : (node?.children||{});
        if (ctxTarget && children[ctxTarget]) showProperties(ctxTarget, children[ctxTarget]);
        break;
      }
    }
  });
});

/* ═══════════════════════════════════════════════
   EVENT LISTENERS — TOOLBAR & SIDEBAR
═══════════════════════════════════════════════ */
$('backBtn').addEventListener('click', goBack);
$('forwardBtn').addEventListener('click', goForward);
$('upBtn').addEventListener('click', goUp);
$('viewToggleBtn').addEventListener('click', () => {
  viewMode = viewMode === 'grid' ? 'list' : 'grid';
  renderFiles();
});

// Sidebar tasks
$('taskNewFolder').addEventListener('click', createFolder);
$('taskNewFile').addEventListener('click', createFile);
$('taskDelete').addEventListener('click', () => { if (selectedItem) deleteItem(selectedItem); else showMsg('Удаление', 'Ничего не выбрано.'); });
$('taskRename').addEventListener('click', () => { if (selectedItem) renameItem(selectedItem); else showMsg('Переименование', 'Ничего не выбрано.'); });
$('taskProperties').addEventListener('click', () => {
  if (!selectedItem) { showMsg('Свойства', 'Ничего не выбрано.'); return; }
  const node = getNode(currentPath);
  const children = node?.type==='root' ? fs : (node?.children||{});
  if (children[selectedItem]) showProperties(selectedItem, children[selectedItem]);
});

// Title bar buttons
$('closeBtn').addEventListener('click', () => {
  if (editorDirty) {
    showMsg('Закрытие', 'Сохранить изменения?', 'Сохранить', 'Не сохранять', yes => {
      if (yes) saveEditor();
      showMsg('Мой компьютер', 'Приложение работает в фоне.\nДля выхода закройте браузер.', 'OK');
    });
  } else {
    showMsg('Мой компьютер', 'Приложение работает в фоне.\nДля выхода закройте браузер.', 'OK');
  }
});
$('minBtn').addEventListener('click', () => showMsg('Мой компьютер', 'Свернуть: не поддерживается в браузере.', 'OK'));
$('maxBtn').addEventListener('click', () => showMsg('Мой компьютер', 'Развернуть: уже полноэкранный режим.', 'OK'));

// Right-click on empty area
$('rightPanel').addEventListener('contextmenu', e => {
  e.preventDefault();
  if (!e.target.closest('.file-item')) {
    ctxTarget = null;
    selectedItem = null;
    renderFiles();
    showContextMenu(e.clientX, e.clientY, null);
  }
});

// Deselect on background click
document.addEventListener('click', e => {
  if (!e.target.closest('.file-item') && !e.target.closest('.context-menu')) {
    hideContextMenu();
    if (!e.target.closest('.file-item')) {
      selectedItem = null;
      document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
      statusText.textContent = 'Готово';
      renderDetails();
    }
  }
  if (!e.target.closest('.start-menu') && !e.target.closest('.taskbar-start')) {
    startMenu.style.display = 'none';
  }
});

/* ═══════════════════════════════════════════════
   EDITOR EVENTS
═══════════════════════════════════════════════ */
$('editorArea').addEventListener('input', () => {
  editorDirty = true;
  $('editorStatus').textContent = '● Не сохранено';
  $('editorStatus').style.color = '#cc7700';
  updateEditorStats();
});
$('editorFontSize').addEventListener('change', e => {
  $('editorArea').style.fontSize = e.target.value + 'px';
});
$('editorWrap').addEventListener('change', e => {
  $('editorArea').style.whiteSpace = e.target.value === 'on' ? 'pre-wrap' : 'pre';
  $('editorArea').style.overflowX  = e.target.value === 'on' ? 'hidden' : 'auto';
});
$('editorSave').addEventListener('click', saveEditor);
$('editorSaveAs').addEventListener('click', () => {
  const cur = currentEditPath ? currentEditPath[currentEditPath.length-1] : 'Новый документ';
  const base = cur.includes('.') ? cur.slice(0, cur.lastIndexOf('.')) : cur;
  showDialog('Сохранить как...', 'Имя файла:', base, true, (name, ext) => {
    if (!name.trim()) return;
    const savePath = [...(currentEditPath?.slice(0,-1) || currentPath)];
    const parentNode = getNode(savePath);
    if (!parentNode?.children) { showMsg('Ошибка', 'Выберите папку для сохранения.'); return; }
    const fname = name.trim() + ext;
    const now = Date.now();
    parentNode.children[fname] = {
      type: 'file', ext,
      created: parentNode.children[fname]?.created || now,
      modified: now,
      content: $('editorArea').value
    };
    saveFS();
    currentEditPath = [...savePath, fname];
    $('editorTitle').textContent = fname;
    $('editorPath').textContent = currentEditPath.join(' \\ ');
    editorDirty = false;
    $('editorStatus').textContent = '✓ Сохранено';
    $('editorStatus').style.color = 'green';
    render();
  });
});
$('editorClose').addEventListener('click', () => {
  if (editorDirty) {
    showMsg('Редактор', 'Сохранить изменения?', 'Сохранить', 'Не сохранять', yes => {
      if (yes) saveEditor();
      closeModal();
    });
  } else {
    closeModal();
  }
});

/* ═══════════════════════════════════════════════
   DIALOG EVENTS
═══════════════════════════════════════════════ */
$('dialogOk').addEventListener('click', () => {
  const name = $('dialogInput').value.trim();
  const ext = $('dialogExt').value;
  closeModal();
  if (dialogCallback) { dialogCallback(name, ext); dialogCallback = null; }
});
$('dialogCancel').addEventListener('click', () => { closeModal(); dialogCallback = null; });
$('dialogClose').addEventListener('click', () => { closeModal(); dialogCallback = null; });
$('dialogInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('dialogOk').click();
  if (e.key === 'Escape') $('dialogCancel').click();
});

$('propsClose').addEventListener('click', closeModal);
$('propsOk').addEventListener('click', closeModal);

$('msgYes').addEventListener('click', () => {
  const cb = msgCallback; msgCallback = null;
  closeModal();
  if (cb) cb(true);
});
$('msgNo').addEventListener('click', () => {
  const cb = msgCallback; msgCallback = null;
  closeModal();
  if (cb) cb(false);
});
$('msgClose').addEventListener('click', () => {
  const cb = msgCallback; msgCallback = null;
  closeModal();
  if (cb) cb(false);
});

// Click outside modal
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) {
    const visModal = [editorModal, dialogModal, propsModal, msgModal].find(m => m.style.display !== 'none');
    if (visModal === editorModal) {
      if (editorDirty) return; // don't close if unsaved
    }
    if (visModal !== dialogModal && visModal !== msgModal) closeModal();
  }
});

/* ═══════════════════════════════════════════════
   START MENU
═══════════════════════════════════════════════ */
$('startBtn').addEventListener('click', e => {
  e.stopPropagation();
  startMenu.style.display = startMenu.style.display === 'none' ? 'block' : 'none';
});
$('smMyComputer').addEventListener('click', () => {
  startMenu.style.display = 'none';
  navigate([]);
});
$('smNewFolder').addEventListener('click', () => {
  startMenu.style.display = 'none';
  createFolder();
});
$('smNewFile').addEventListener('click', () => {
  startMenu.style.display = 'none';
  createFile();
});
$('smAbout').addEventListener('click', () => {
  startMenu.style.display = 'none';
  showMsg('О программе',
    'Мой компьютер v1.0\n\nФайловый менеджер для Android\nв стиле Windows Explorer.\n\nДанные хранятся локально в браузере.\nДля полного доступа к файлам упакуйте\nв Capacitor.',
    'OK');
});
$('smClear').addEventListener('click', () => {
  startMenu.style.display = 'none';
  showMsg('Очистить всё', 'ВНИМАНИЕ! Все файлы и папки будут удалены!\nЭто действие необратимо!', 'Удалить всё', 'Отмена', confirmed => {
    if (!confirmed) return;
    localStorage.removeItem(FS_KEY);
    fs = defaultFS();
    currentPath = [];
    historyStack = [];
    forwardStack = [];
    selectedItem = null;
    render();
  });
});

/* ═══════════════════════════════════════════════
   KEYBOARD SHORTCUTS
═══════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (modalOverlay.style.display !== 'none') return;
  if (e.key === 'Backspace' && !e.target.closest('input, textarea')) { e.preventDefault(); goBack(); }
  if (e.key === 'F5') { e.preventDefault(); render(); }
  if (e.ctrlKey) {
    if (e.key === 'n') { e.preventDefault(); createFolder(); }
    if (e.key === 'm') { e.preventDefault(); createFile(); }
    if (e.key === 'Delete' && selectedItem) { e.preventDefault(); deleteItem(selectedItem); }
  }
  if (e.key === 'Delete' && selectedItem && !e.ctrlKey) { deleteItem(selectedItem); }
  if (e.key === 'F2' && selectedItem) { renameItem(selectedItem); }
  if (e.key === 'Enter' && selectedItem) { openItem(selectedItem); }
});

// Ctrl+S in editor
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 's' && editorModal.style.display !== 'none') {
    e.preventDefault();
    saveEditor();
  }
});

/* ═══════════════════════════════════════════════
   CAPACITOR DETECTION & INTEGRATION HINTS
   (uncomment when packaged with Capacitor)
═══════════════════════════════════════════════ */
/*
if (window.Capacitor) {
  const { Filesystem, Directory, Encoding } = window.Capacitor.Plugins;
  // Override saveFS to also save to device filesystem
  window._saveToDevice = async (filename, content) => {
    await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
  };
}
*/

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
render();
console.log('🖥️ My Computer — Loaded. FS version 1.0');

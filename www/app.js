import { Filesystem, Directory, Encoding } from 'https://cdn.jsdelivr.net/npm/@capacitor/filesystem@8.1.2/+esm';

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let notes = JSON.parse(localStorage.getItem('superNotes')) || [];
let currentNoteId = null;
let currentFilter = 'all';
let sortType = 'date-desc';
let searchQuery = '';
let isDrawing = false;
let drawCtx = null;
let theme = localStorage.getItem('theme') || 'dark';

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavigation();
    initEditor();
    initSearch();
    initDraw();
    initReminder();
    initStorageInfo();
    renderNotes();
    checkReminders();
    setInterval(checkReminders, 60000);
    setTimeout(addFileManagerButtons, 500);
});

// ==================== ТЕМА ====================
function initTheme() {
    const root = document.documentElement;
    if (theme === 'light') {
        root.style.setProperty('--bg-primary', '#eff1f5');
        root.style.setProperty('--bg-secondary', '#e6e9ef');
        root.style.setProperty('--bg-tertiary', '#ccd0da');
        root.style.setProperty('--text-primary', '#4c4f69');
        root.style.setProperty('--text-secondary', '#5c5f77');
        root.style.setProperty('--text-muted', '#7c7f93');
        root.style.setProperty('--border', '#bcc0cc');
        document.getElementById('themeToggle').textContent = '☀️';
    }
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
}

function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', theme);
    location.reload();
}

// ==================== НАВИГАЦИЯ ====================
function initNavigation() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const closeSidebar = document.getElementById('closeSidebar');
    const addNoteBtn = document.getElementById('addNoteBtn');
    const sortBtn = document.getElementById('sortBtn');
    const sortMenu = document.getElementById('sortMenu');
    const closeEditor = document.getElementById('closeEditor');
    const editorModal = document.getElementById('editorModal');

    menuToggle.addEventListener('click', () => {
        sidebar.classList.add('open');
        overlay.classList.remove('hidden');
    });

    closeSidebar.addEventListener('click', closeSidebarMenu);
    overlay.addEventListener('click', closeSidebarMenu);

    addNoteBtn.addEventListener('click', () => openEditor());

    sortBtn.addEventListener('click', () => {
        sortMenu.classList.toggle('hidden');
    });

    closeEditor.addEventListener('click', () => {
        editorModal.classList.add('hidden');
        currentNoteId = null;
    });

    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            closeSidebarMenu();
            renderNotes();
        });
    });

    document.querySelectorAll('[data-sort]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            sortType = e.target.dataset.sort;
            sortMenu.classList.add('hidden');
            renderNotes();
        });
    });

    document.getElementById('exportNotes').addEventListener('click', exportNotes);
    document.getElementById('importNotes').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });

    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.id = 'importFile';
    importInput.accept = '.json';
    importInput.style.display = 'none';
    importInput.addEventListener('change', importNotes);
    document.body.appendChild(importInput);
}

function closeSidebarMenu() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.add('hidden');
}

// ==================== РЕНДЕРИНГ ЗАМЕТОК ====================
function renderNotes() {
    const notesGrid = document.getElementById('notesGrid');
    const emptyState = document.getElementById('emptyState');
    let filteredNotes = [...notes];
    
    switch(currentFilter) {
        case 'favorites': filteredNotes = filteredNotes.filter(n => n.isFavorite); break;
        case 'todo': filteredNotes = filteredNotes.filter(n => n.content && n.content.includes('[ ]')); break;
        case 'reminder': filteredNotes = filteredNotes.filter(n => n.reminder); break;
    }
    
    if (searchQuery) {
        filteredNotes = filteredNotes.filter(n => 
            n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.content.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }
    
    filteredNotes.sort((a, b) => {
        switch(sortType) {
            case 'date-asc': return a.updatedAt - b.updatedAt;
            case 'title-asc': return a.title.localeCompare(b.title);
            case 'title-desc': return b.title.localeCompare(a.title);
            default: return b.updatedAt - a.updatedAt;
        }
    });
    
    filteredNotes.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    
    if (filteredNotes.length === 0) {
        notesGrid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    notesGrid.innerHTML = filteredNotes.map(note => {
        const preview = note.content.substring(0, 150).replace(/[#*`]/g, '') || 'Пустая заметка';
        const date = new Date(note.updatedAt).toLocaleDateString('ru-RU');
        const badges = [];
        if (note.reminder) badges.push('<span class="badge reminder">⏰</span>');
        if (note.content && note.content.includes('[ ]')) badges.push('<span class="badge todo">✅</span>');
        return `<div class="note-card ${note.isPinned ? 'pinned' : ''}" data-id="${note.id}">
            <div class="note-header"><h3 class="note-title">${escapeHtml(note.title) || 'Без названия'}</h3>${note.isFavorite ? '<span class="note-favorite">⭐</span>' : ''}</div>
            <div class="note-preview">${escapeHtml(preview)}</div>
            <div class="note-footer"><span>${date}</span><div class="note-badges">${badges.join('')}</div></div>
        </div>`;
    }).join('');
    
    document.querySelectorAll('.note-card').forEach(card => {
        card.addEventListener('click', () => openEditor(card.dataset.id));
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== РЕДАКТОР ====================
function initEditor() {
    document.getElementById('saveNote').addEventListener('click', saveNote);
    document.getElementById('deleteNote').addEventListener('click', deleteNote);
    document.getElementById('favoriteToggle').addEventListener('click', toggleFavorite);
    document.getElementById('shareNote').addEventListener('click', shareNote);
    document.getElementById('pinNoteBtn').addEventListener('click', togglePin);
    document.getElementById('moreOptions').addEventListener('click', () => {
        document.getElementById('editorOptions').classList.toggle('hidden');
    });
    document.querySelectorAll('[data-format]').forEach(btn => {
        btn.addEventListener('click', (e) => formatText(e.target.dataset.format));
    });
    document.getElementById('fontSizeSelect').addEventListener('change', (e) => {
        document.getElementById('noteContent').style.fontSize = e.target.value === 'small' ? '0.9rem' : e.target.value === 'large' ? '1.2rem' : '1rem';
    });
    document.getElementById('textColor').addEventListener('change', (e) => {
        document.getElementById('noteContent').style.color = e.target.value;
    });
    document.querySelectorAll('.editor-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            const content = document.getElementById('noteContent');
            const preview = document.getElementById('editorPreview');
            if (e.target.dataset.tab === 'preview') {
                content.classList.add('hidden');
                preview.classList.remove('hidden');
                preview.innerHTML = renderMarkdown(content.value);
            } else {
                content.classList.remove('hidden');
                preview.classList.add('hidden');
            }
        });
    });
    document.getElementById('noteContent').addEventListener('input', updateStats);
    document.getElementById('noteTitle').addEventListener('input', updateStats);
    document.getElementById('voiceInputBtn').addEventListener('click', voiceInput);
    document.getElementById('attachFileBtn').addEventListener('click', attachFile);
}

function openEditor(id = null) {
    const modal = document.getElementById('editorModal');
    const titleInput = document.getElementById('noteTitle');
    const contentInput = document.getElementById('noteContent');
    const favoriteToggle = document.getElementById('favoriteToggle');
    modal.classList.remove('hidden');
    if (id) {
        const note = notes.find(n => n.id === id);
        if (note) {
            currentNoteId = id;
            titleInput.value = note.title || '';
            contentInput.value = note.content || '';
            contentInput.style.fontSize = note.fontSize || '1rem';
            contentInput.style.color = note.textColor || '#cdd6f4';
            favoriteToggle.textContent = note.isFavorite ? '★' : '☆';
            document.getElementById('pinNoteBtn').textContent = note.isPinned ? '📍 Открепить' : '📌 Закрепить';
        }
    } else {
        currentNoteId = null;
        titleInput.value = '';
        contentInput.value = '';
        favoriteToggle.textContent = '☆';
        document.getElementById('pinNoteBtn').textContent = '📌 Закрепить';
    }
    updateStats();
    document.getElementById('editorPreview').classList.add('hidden');
    contentInput.classList.remove('hidden');
}

function saveNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value;
    const fontSize = document.getElementById('noteContent').style.fontSize;
    const textColor = document.getElementById('noteContent').style.color;
    if (!title && !content) { showToast('Заметка пуста', 'error'); return; }
    const now = Date.now();
    if (currentNoteId) {
        const index = notes.findIndex(n => n.id === currentNoteId);
        if (index !== -1) notes[index] = {...notes[index], title: title || 'Без названия', content, fontSize, textColor, updatedAt: now};
    } else {
        notes.push({id: 'note_' + now + '_' + Math.random().toString(36).substr(2, 9), title: title || 'Без названия', content, fontSize, textColor, isFavorite: false, isPinned: false, createdAt: now, updatedAt: now, reminder: null});
    }
    localStorage.setItem('superNotes', JSON.stringify(notes));
    document.getElementById('editorModal').classList.add('hidden');
    currentNoteId = null;
    renderNotes();
    initStorageInfo();
    showToast('Заметка сохранена', 'success');
}

function deleteNote() {
    if (!currentNoteId) { document.getElementById('editorModal').classList.add('hidden'); return; }
    if (confirm('Удалить заметку?')) {
        notes = notes.filter(n => n.id !== currentNoteId);
        localStorage.setItem('superNotes', JSON.stringify(notes));
        document.getElementById('editorModal').classList.add('hidden');
        currentNoteId = null;
        renderNotes();
        initStorageInfo();
        showToast('Заметка удалена', 'success');
    }
}

function toggleFavorite() {
    if (!currentNoteId) return;
    const note = notes.find(n => n.id === currentNoteId);
    if (note) { note.isFavorite = !note.isFavorite; document.getElementById('favoriteToggle').textContent = note.isFavorite ? '★' : '☆'; localStorage.setItem('superNotes', JSON.stringify(notes)); renderNotes(); }
}

function togglePin() {
    if (!currentNoteId) return;
    const note = notes.find(n => n.id === currentNoteId);
    if (note) { note.isPinned = !note.isPinned; document.getElementById('pinNoteBtn').textContent = note.isPinned ? '📍 Открепить' : '📌 Закрепить'; localStorage.setItem('superNotes', JSON.stringify(notes)); showToast(note.isPinned ? 'Закреплена' : 'Откреплена', 'success'); }
}

function formatText(format) {
    const ta = document.getElementById('noteContent');
    const s = ta.selectionStart, e = ta.selectionEnd, t = ta.value, sel = t.substring(s, e);
    let r = '';
    switch(format) {
        case 'bold': r = `**${sel}**`; break;
        case 'italic': r = `*${sel}*`; break;
        case 'underline': r = `<u>${sel}</u>`; break;
        case 'strike': r = `~~${sel}~~`; break;
        case 'ul': r = `\n- ${sel}`; break;
        case 'ol': r = `\n1. ${sel}`; break;
        case 'code': r = `\`${sel}\``; break;
        case 'checklist': r = `\n- [ ] ${sel}`; break;
    }
    ta.value = t.substring(0, s) + r + t.substring(e);
    ta.focus(); ta.setSelectionRange(s + r.length, s + r.length);
    updateStats();
}

function renderMarkdown(text) {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/~~(.*?)~~/g, '<del>$1</del>').replace(/`(.*?)`/g, '<code>$1</code>').replace(/\n- \[ \] (.*)/g, '<div class="checklist-item"><input type="checkbox"> $1</div>').replace(/\n- \[x\] (.*)/gi, '<div class="checklist-item"><input type="checkbox" checked> $1</div>').replace(/\n- (.*)/g, '<li>$1</li>').replace(/\n/g, '<br>');
}

function updateStats() {
    const c = document.getElementById('noteContent').value;
    const w = c.trim().split(/\s+/).filter(x => x.length).length;
    document.getElementById('wordCount').textContent = `${w} ${pluralize(w, 'слово', 'слова', 'слов')}`;
    document.getElementById('charCount').textContent = `${c.length} ${pluralize(c.length, 'символ', 'символа', 'символов')}`;
    if (currentNoteId) { const n = notes.find(x => x.id === currentNoteId); if (n) document.getElementById('lastSaved').textContent = `Сохранено: ${new Date(n.updatedAt).toLocaleString('ru-RU')}`; }
}

function pluralize(n, one, two, five) { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return five; if (n1 > 1 && n1 < 5) return two; if (n1 === 1) return one; return five; }

function initSearch() {
    const sb = document.getElementById('searchBar'), si = document.getElementById('searchInput');
    document.getElementById('searchBtn').addEventListener('click', () => { sb.classList.toggle('hidden'); if (!sb.classList.contains('hidden')) si.focus(); });
    si.addEventListener('input', e => { searchQuery = e.target.value; renderNotes(); });
    document.getElementById('clearSearch').addEventListener('click', () => { si.value = ''; searchQuery = ''; renderNotes(); });
}

function initDraw() {
    const canvas = document.getElementById('drawCanvas'); drawCtx = canvas.getContext('2d');
    document.getElementById('drawBtn').addEventListener('click', () => { document.getElementById('drawModal').classList.remove('hidden'); document.getElementById('editorOptions').classList.add('hidden'); });
    document.getElementById('closeDraw').addEventListener('click', () => document.getElementById('drawModal').classList.add('hidden'));
    canvas.addEventListener('mousedown', startDrawing); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', stopDrawing); canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', e => { e.preventDefault(); startDrawing(e.touches[0]); });
    canvas.addEventListener('touchmove', e => { e.preventDefault(); draw(e.touches[0]); });
    canvas.addEventListener('touchend', stopDrawing);
    document.getElementById('clearCanvas').addEventListener('click', () => drawCtx.clearRect(0, 0, canvas.width, canvas.height));
    document.getElementById('saveDrawing').addEventListener('click', () => { const data = canvas.toDataURL(); document.getElementById('noteContent').value += `\n![Рисунок](${data})\n`; document.getElementById('drawModal').classList.add('hidden'); updateStats(); showToast('Рисунок добавлен', 'success'); });
}

function startDrawing(e) { isDrawing = true; drawCtx.beginPath(); const p = getCanvasCoordinates(e); drawCtx.moveTo(p.x, p.y); }
function draw(e) { if (!isDrawing) return; e.preventDefault(); const p = getCanvasCoordinates(e); drawCtx.lineTo(p.x, p.y); drawCtx.strokeStyle = document.getElementById('drawColor').value; drawCtx.lineWidth = document.getElementById('drawSize').value; drawCtx.lineCap = 'round'; drawCtx.stroke(); }
function stopDrawing() { isDrawing = false; }
function getCanvasCoordinates(e) { const c = document.getElementById('drawCanvas'), r = c.getBoundingClientRect(); let cx, cy; if (e.touches) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; } else { cx = e.clientX; cy = e.clientY; } return { x: (cx - r.left) * (c.width / r.width), y: (cy - r.top) * (c.height / r.height) }; }

function initReminder() {
    document.getElementById('setReminderBtn').addEventListener('click', () => { document.getElementById('reminderModal').classList.remove('hidden'); if (currentNoteId) document.getElementById('reminderText').value = notes.find(n => n.id === currentNoteId).title; });
    document.getElementById('cancelReminder').addEventListener('click', () => document.getElementById('reminderModal').classList.add('hidden'));
    document.getElementById('saveReminder').addEventListener('click', () => { if (!currentNoteId) saveNote(); const dt = document.getElementById('reminderDateTime').value, txt = document.getElementById('reminderText').value; if (!dt) { showToast('Выберите дату', 'error'); return; } const n = notes.find(x => x.id === currentNoteId); if (n) { n.reminder = { time: new Date(dt).getTime(), text: txt || n.title }; localStorage.setItem('superNotes', JSON.stringify(notes)); document.getElementById('reminderModal').classList.add('hidden'); showToast('Напоминание установлено', 'success'); } });
}

function checkReminders() {
    const now = Date.now(); notes.forEach(n => { if (n.reminder && n.reminder.time <= now && n.reminder.time > now - 60000) { showNotification(n.reminder.text); delete n.reminder; localStorage.setItem('superNotes', JSON.stringify(notes)); } });
}

function showNotification(text) {
    if ('Notification' in window && Notification.permission === 'granted') new Notification('Блокнот', { body: text });
    else if ('Notification' in window && Notification.permission !== 'denied') Notification.requestPermission().then(p => { if (p === 'granted') new Notification('Блокнот', { body: text }); });
    showToast(text, 'success');
}

function voiceInput() { if ('webkitSpeechRecognition' in window) { const r = new webkitSpeechRecognition(); r.lang = 'ru-RU'; r.onresult = e => { document.getElementById('noteContent').value += ' ' + e.results[0][0].transcript; updateStats(); }; r.start(); showToast('Говорите...', 'success'); } else showToast('Не поддерживается', 'error'); }
function attachFile() { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = ev => { document.getElementById('noteContent').value += `\n![${f.name}](${ev.target.result})\n`; updateStats(); showToast('Файл прикреплен', 'success'); }; r.readAsDataURL(f); } }; i.click(); }
function shareNote() { if (!currentNoteId) return; const n = notes.find(x => x.id === currentNoteId); if (n && navigator.share) navigator.share({ title: n.title, text: n.content.substring(0, 100) }).catch(()=>{}); else showToast('Не поддерживается', 'error'); }
function exportNotes() { const d = JSON.stringify(notes, null, 2); const b = new Blob([d], {type: 'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `notes_${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(a.href); showToast('Экспортировано', 'success'); }
function importNotes(e) { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { try { const imp = JSON.parse(ev.target.result); if (Array.isArray(imp)) { if (confirm('Заменить заметки?')) notes = imp; else notes = [...notes, ...imp]; localStorage.setItem('superNotes', JSON.stringify(notes)); renderNotes(); initStorageInfo(); showToast('Импортировано', 'success'); } } catch { showToast('Ошибка', 'error'); } }; r.readAsText(f); e.target.value = ''; }
function initStorageInfo() { const s = new Blob([JSON.stringify(notes)]).size; document.getElementById('storageInfo').textContent = `${notes.length} заметок, ${(s/1024).toFixed(2)} KB`; }
function showToast(msg, type='info') { const c = document.getElementById('toastContainer'), t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg; c.appendChild(t); setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000); }

// ==================== ФАЙЛОВЫЙ МЕНЕДЖЕР ====================
async function createNotebookFolder() {
    try {
        await Filesystem.mkdir({ path: 'СуперБлокнот', directory: Directory.Documents, recursive: true });
        showToast('Папка "СуперБлокнот" создана в памяти', 'success');
        return true;
    } catch (e) {
        if (e.message.includes('already exists')) showToast('Папка уже существует', 'info');
        else showToast('Ошибка создания папки', 'error');
        return false;
    }
}

async function saveNoteToFile(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) { showToast('Заметка не найдена', 'error'); return; }
    await createNotebookFolder();
    const fileName = `${note.title.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_') || 'заметка'}_${new Date().toISOString().split('T')[0]}.txt`;
    const content = `Заголовок: ${note.title}\nДата: ${new Date(note.updatedAt).toLocaleString('ru-RU')}\n\n${note.content}`;
    try {
        await Filesystem.writeFile({ path: `СуперБлокнот/${fileName}`, data: content, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
        showToast(`Сохранено: ${fileName}`, 'success');
    } catch (e) { showToast('Ошибка сохранения файла', 'error'); }
}

async function saveAllNotesToFiles() {
    if (notes.length === 0) { showToast('Нет заметок для сохранения', 'error'); return; }
    await createNotebookFolder();
    let saved = 0;
    for (const note of notes) {
        try {
            const fileName = `${note.title.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_') || 'заметка'}_${new Date(note.updatedAt).toISOString().split('T')[0]}.txt`;
            const content = `Заголовок: ${note.title}\nДата: ${new Date(note.updatedAt).toLocaleString('ru-RU')}\n\n${note.content}`;
            await Filesystem.writeFile({ path: `СуперБлокнот/${fileName}`, data: content, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
            saved++;
        } catch (e) {}
    }
    showToast(`Сохранено ${saved} заметок в папку "СуперБлокнот"`, 'success');
}

async function listNotebookFiles() {
    try {
        const result = await Filesystem.readdir({ path: 'СуперБлокнот', directory: Directory.Documents });
        if (result.files.length === 0) showToast('Папка пуста', 'info');
        else { const fileList = result.files.map(f => f.name).join('\n'); alert(`Файлы в папке "СуперБлокнот":\n${fileList}`); }
    } catch (e) { showToast('Папка не найдена. Создайте её.', 'error'); }
}

function addFileManagerButtons() {
    const sidebarFooter = document.querySelector('.sidebar-footer');
    if (!sidebarFooter) return;
    
    const createFolderBtn = document.createElement('button');
    createFolderBtn.className = 'export-btn';
    createFolderBtn.textContent = '📁 Создать папку';
    createFolderBtn.onclick = createNotebookFolder;
    
    const saveAllBtn = document.createElement('button');
    saveAllBtn.className = 'export-btn';
    saveAllBtn.textContent = '💾 Сохранить все в файлы';
    saveAllBtn.onclick = saveAllNotesToFiles;
    
    const listFilesBtn = document.createElement('button');
    listFilesBtn.className = 'export-btn';
    listFilesBtn.textContent = '📋 Список файлов';
    listFilesBtn.onclick = listNotebookFiles;
    
    sidebarFooter.prepend(saveAllBtn);
    sidebarFooter.prepend(listFilesBtn);
    sidebarFooter.prepend(createFolderBtn);
    
    const modalActions = document.querySelector('.modal-actions');
    if (modalActions) {
        const saveToFileBtn = document.createElement('button');
        saveToFileBtn.className = 'btn-secondary';
        saveToFileBtn.textContent = '📄 В файл';
        saveToFileBtn.onclick = () => {
            if (currentNoteId) saveNoteToFile(currentNoteId);
            else showToast('Сначала сохраните заметку', 'error');
        };
        modalActions.insertBefore(saveToFileBtn, modalActions.firstChild);
    }
}

if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();

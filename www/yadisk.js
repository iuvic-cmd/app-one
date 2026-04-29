/**
 * MY COMPUTER v4.1 — Yandex Disk Sync
 * Добавить в конец app.js
 */

/* ══════════════════════════════════════
   ЯНДЕКС ДИСК СИНХРОНИЗАЦИЯ
══════════════════════════════════════ */
const YADISK = {
  TOKEN_KEY: 'mc_yadisk_token',
  CLIENT_ID: '163ea585ad8547e89f6126e6c2f0207a',
  API: 'https://cloud-api.yandex.net/v1/disk',
  SYNC_PATH: 'disk:/Приложения/Мой компьютер',

  get token() { return localStorage.getItem(this.TOKEN_KEY) || ''; },
  set token(t) { localStorage.setItem(this.TOKEN_KEY, t); },

  headers() {
    return {
      'Authorization': 'OAuth ' + this.token,
      'Content-Type': 'application/json'
    };
  },

  // Проверить подключение
  async checkAuth() {
    try {
      const r = await fetch(this.API, { headers: this.headers() });
      return r.ok;
    } catch(e) { return false; }
  },

  // Создать папку на Диске
  async mkdir(path) {
    try {
      await fetch(this.API + '/resources?path=' + encodeURIComponent(path), {
        method: 'PUT', headers: this.headers()
      });
    } catch(e) {}
  },

  // Загрузить файл на Диск
  async upload(diskPath, content, isBinary) {
    try {
      // Получить URL для загрузки
      const r = await fetch(this.API + '/resources/upload?path=' + encodeURIComponent(diskPath) + '&overwrite=true', {
        headers: this.headers()
      });
      if(!r.ok) return false;
      const {href} = await r.json();
      // Загрузить содержимое
      let blob;
      if(isBinary && content.startsWith('data:')) {
        const arr = content.split(','); const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]); const u8 = new Uint8Array(bstr.length);
        for(let i=0;i<bstr.length;i++) u8[i]=bstr.charCodeAt(i);
        blob = new Blob([u8], {type: mime});
      } else {
        blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
      }
      const up = await fetch(href, {method: 'PUT', body: blob});
      return up.ok;
    } catch(e) { console.log('upload error:', e); return false; }
  },

  // Скачать файл с Диска
  async download(diskPath) {
    try {
      const r = await fetch(this.API + '/resources/download?path=' + encodeURIComponent(diskPath), {
        headers: this.headers()
      });
      if(!r.ok) return null;
      const {href} = await r.json();
      const res = await fetch(href);
      return await res.text();
    } catch(e) { return null; }
  },

  // Получить список файлов в папке
  async listDir(path) {
    try {
      const r = await fetch(this.API + '/resources?path=' + encodeURIComponent(path) + '&limit=100', {
        headers: this.headers()
      });
      if(!r.ok) return [];
      const data = await r.json();
      return data._embedded?.items || [];
    } catch(e) { return []; }
  },

  // Удалить файл с Диска
  async remove(path) {
    try {
      await fetch(this.API + '/resources?path=' + encodeURIComponent(path) + '&permanently=true', {
        method: 'DELETE', headers: this.headers()
      });
    } catch(e) {}
  }
};

/* ══════════════════════════════════════
   SYNC FUNCTIONS
══════════════════════════════════════ */

// Показать панель синхронизации
function showYaDiskPanel() {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;display:flex;align-items:center;justify-content:center;';

  const panel = document.createElement('div');
  panel.style.cssText = 'background:#fff;border-radius:8px;width:min(340px,calc(100vw-20px));box-shadow:0 8px 32px rgba(0,0,0,0.3);overflow:hidden;';

  const hasToken = !!YADISK.token;

  panel.innerHTML = `
    <div style="background:linear-gradient(180deg,#fc3f1d,#d02311);padding:12px 16px;display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px">☁️</span>
      <span style="color:#fff;font-size:14px;font-weight:700;flex:1;">Яндекс Диск</span>
      <button id="ydClose" style="background:rgba(255,255,255,0.2);border:none;color:#fff;border-radius:50%;width:28px;height:28px;font-size:14px;cursor:pointer;">✕</button>
    </div>
    <div style="padding:16px;">
      <div id="ydStatus" style="background:#f5f5f5;border-radius:6px;padding:10px;font-size:12px;font-family:sans-serif;margin-bottom:12px;min-height:40px;">
        ${hasToken ? '✅ Подключено' : '⚠️ Не подключено — введите токен'}
      </div>
      ${!hasToken ? `
      <div style="margin-bottom:12px;">
        <label style="font-size:11px;color:#666;display:block;margin-bottom:4px;">OAuth токен:</label>
        <input id="ydTokenInput" type="text" placeholder="y0__..." style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;font-family:monospace;">
        <button id="ydSaveToken" style="width:100%;margin-top:6px;padding:8px;background:linear-gradient(180deg,#fc3f1d,#d02311);color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer;font-weight:700;">Подключить</button>
      </div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <button id="ydUpload" style="padding:10px 6px;background:linear-gradient(180deg,#4da6ff,#0068cc);color:#fff;border:none;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600;" ${!hasToken?'disabled':''}>
          📤 Загрузить на Диск
        </button>
        <button id="ydDownload" style="padding:10px 6px;background:linear-gradient(180deg,#4da6ff,#0068cc);color:#fff;border:none;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600;" ${!hasToken?'disabled':''}>
          📥 Скачать с Диска
        </button>
        <button id="ydSync" style="padding:10px 6px;background:linear-gradient(180deg,#34c759,#248a3d);color:#fff;border:none;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600;grid-column:span 2;" ${!hasToken?'disabled':''}>
          🔄 Синхронизировать всё
        </button>
        ${hasToken ? `<button id="ydLogout" style="padding:8px 6px;background:#f0f0f0;color:#cc3300;border:none;border-radius:4px;font-size:11px;cursor:pointer;grid-column:span 2;">Отключить Яндекс Диск</button>` : ''}
      </div>
    </div>
  `;

  ov.appendChild(panel);
  document.body.appendChild(ov);

  const setStatus = (msg, color='#333') => {
    const el = document.getElementById('ydStatus');
    if(el){ el.textContent = msg; el.style.color = color; }
  };

  document.getElementById('ydClose').onclick = () => document.body.removeChild(ov);
  ov.onclick = e => { if(e.target===ov) document.body.removeChild(ov); };

  // Save token
  const saveBtn = document.getElementById('ydSaveToken');
  if(saveBtn) saveBtn.onclick = async () => {
    const t = document.getElementById('ydTokenInput').value.trim();
    if(!t){ setStatus('⚠️ Введите токен!','#cc3300'); return; }
    setStatus('⏳ Проверяю подключение...');
    YADISK.token = t;
    const ok = await YADISK.checkAuth();
    if(ok){ setStatus('✅ Подключено успешно!','green'); setTimeout(()=>{ document.body.removeChild(ov); showYaDiskPanel(); },1000); }
    else{ YADISK.token=''; setStatus('❌ Ошибка — неверный токен','#cc3300'); }
  };

  // Logout
  const logoutBtn = document.getElementById('ydLogout');
  if(logoutBtn) logoutBtn.onclick = () => { localStorage.removeItem(YADISK.TOKEN_KEY); document.body.removeChild(ov); showMsg('Яндекс Диск','Отключено от Яндекс Диска.','OK'); };

  // Upload all to Yandex Disk
  document.getElementById('ydUpload').onclick = async () => {
    setStatus('⏳ Загружаю на Яндекс Диск...');
    try {
      // Create base folder
      await YADISK.mkdir(YADISK.SYNC_PATH);
      // Save fs.json
      const fsJson = JSON.stringify(fs, null, 2);
      await YADISK.upload(YADISK.SYNC_PATH + '/fs.json', fsJson, false);
      // Upload media files
      let count = 0;
      function collectMedia(children, path) {
        Object.entries(children).forEach(([name, node]) => {
          if(node.type==='file' && node.content && node.content.startsWith('data:')) {
            YADISK.upload(YADISK.SYNC_PATH + '/media/' + name, node.content, true).then(ok=>{ if(ok)count++; });
          }
          if(node.children) collectMedia(node.children, path+'/'+name);
        });
      }
      collectMedia(fs, '');
      setStatus('✅ Загружено на Яндекс Диск!', 'green');
    } catch(e) { setStatus('❌ Ошибка загрузки: '+e.message,'#cc3300'); }
  };

  // Download fs from Yandex Disk
  document.getElementById('ydDownload').onclick = async () => {
    setStatus('⏳ Скачиваю с Яндекс Диска...');
    try {
      const data = await YADISK.download(YADISK.SYNC_PATH + '/fs.json');
      if(!data){ setStatus('❌ Нет данных на Диске','#cc3300'); return; }
      const newFs = JSON.parse(data);
      fs = newFs; saveFS(); render();
      setStatus('✅ Данные загружены с Диска!','green');
    } catch(e) { setStatus('❌ Ошибка: '+e.message,'#cc3300'); }
  };

  // Full sync
  document.getElementById('ydSync').onclick = async () => {
    setStatus('⏳ Синхронизация...');
    try {
      // First download remote fs
      const remoteData = await YADISK.download(YADISK.SYNC_PATH + '/fs.json');
      if(remoteData) {
        const remoteFs = JSON.parse(remoteData);
        // Merge: remote wins for conflicts
        function mergeFs(local, remote) {
          Object.entries(remote).forEach(([name, node]) => {
            if(!local[name]) local[name] = node;
            else if(node.modified > (local[name].modified||0)) local[name] = node;
            if(node.children && local[name] && local[name].children)
              mergeFs(local[name].children, node.children);
          });
        }
        Object.entries(remoteFs).forEach(([drive, driveNode]) => {
          if(fs[drive] && driveNode.children) mergeFs(fs[drive].children, driveNode.children);
          else if(!fs[drive]) fs[drive] = driveNode;
        });
      }
      // Then upload merged fs
      await YADISK.mkdir(YADISK.SYNC_PATH);
      await YADISK.mkdir(YADISK.SYNC_PATH + '/media');
      await YADISK.upload(YADISK.SYNC_PATH + '/fs.json', JSON.stringify(fs), false);
      saveFS(); render();
      setStatus('✅ Синхронизация завершена!','green');
    } catch(e) { setStatus('❌ Ошибка синхронизации: '+e.message,'#cc3300'); }
  };
}

/* ══════════════════════════════════════
   ДОБАВИТЬ В МЕНЮ ПУСК
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
  // Add Yandex Disk to Start Menu
  const smItems = document.querySelector('.start-items');
  if(smItems) {
    const sep = document.createElement('div'); sep.className='start-sep';
    const btn = document.createElement('div'); btn.className='start-item'; btn.id='smYaDisk';
    btn.innerHTML = '☁️ Яндекс Диск' + (YADISK.token ? ' ✅' : '');
    btn.onclick = () => { document.getElementById('startMenu').style.display='none'; showYaDiskPanel(); };
    smItems.appendChild(sep);
    smItems.appendChild(btn);
  }

  // Add to sidebar tasks
  const taskList = document.getElementById('taskList');
  if(taskList) {
    const btn2 = document.createElement('div'); btn2.className='task-item';
    btn2.textContent = '☁️ Яндекс Диск'; btn2.onclick = showYaDiskPanel;
    taskList.appendChild(btn2);
  }

  // Auto-connect if token exists
  if(YADISK.token) {
    YADISK.checkAuth().then(ok => {
      if(!ok) { localStorage.removeItem(YADISK.TOKEN_KEY); console.log('Yandex token expired'); }
      else console.log('✅ Yandex Disk connected');
    });
  }
});
localStorage.setItem('mc_yadisk_token','y0__wgBEKiMlAkY0YJBILuU8KAXEvW7p6TaDPLCsDG4zoE7j4nsfiY');

const SPEEDS = [0.75,1,1.25,1.5,1.75,2];
let books = [], currentBook = null, speedIdx = 1, layout = 'grid', currentView = 'library', seeking = false;
const audio = document.getElementById('audio-el');

function toFileUrl(filePath){
  return encodeURI(`file:///${filePath.replace(/\\/g, '/')}`);
}

function defaultCoverMarkup(size = 28){
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
}

async function checkFileExists(filePath){
  if(!filePath) return false;
  if(!window.electronAPI || !window.electronAPI.fileExists) return true;
  return await window.electronAPI.fileExists(filePath);
}

function load(){
  try { books = JSON.parse(localStorage.getItem('libreshelves_books')||'[]'); } catch(e){ books=[]; }
  books = books.map(b=>{
    const { emoji, ...rest } = b;
    return {...rest, filePath: b.filePath || null, missingFile: false, chapters: b.chapters || []};
  });
}

function save(){
  const toSave = books.map(b=>{
    const {missingFile, emoji, ...rest} = b;
    return rest;
  });
  localStorage.setItem('libreshelves_books', JSON.stringify(toSave));
}

async function verifyStoredBooks(showAlert){
  const missing = [];
  for(const b of books){
    if(!b.filePath){
      b.missingFile = true;
      missing.push(b.title || 'Sin titulo');
      continue;
    }
    b.missingFile = !(await checkFileExists(b.filePath));
    if(b.missingFile) missing.push(b.title || 'Sin titulo');
  }
  if(showAlert && missing.length){
    alert(`Se encontraron ${missing.length} audiolibro(s) con archivo faltante.\n\nVerifica su ubicacion en tu PC y vuelve a agregarlos.`);
  }
}

function parseCue(content){
  // Very small .cue parser: extracts track titles and INDEX 01 times
  const lines = content.split(/\r?\n/).map(l=>l.trim());
  const chapters = [];
  let currentTitle = null;
  for(let i=0;i<lines.length;i++){
    const l = lines[i];
    if(!l) continue;
    // Track title
    const titleMatch = l.match(/^TITLE\s+"(.+)"$/i);
    if(titleMatch){
      currentTitle = titleMatch[1];
      continue;
    }
    const indexMatch = l.match(/^INDEX\s+01\s+(\d+):(\d+):(\d+)$/i);
    if(indexMatch){
      const m = parseInt(indexMatch[1],10);
      const s = parseInt(indexMatch[2],10);
      const f = parseInt(indexMatch[3],10);
      const seconds = m*60 + s + (f/75);
      chapters.push({title: currentTitle || `Capítulo ${chapters.length+1}`, time: seconds, listened:false});
      currentTitle = null;
      continue;
    }
  }
  return chapters;
}

async function loadChaptersForBook(b){
  if(!b || !b.filePath) { b.chapters = b.chapters || []; return; }
  const cuePath = await window.electronAPI.findCue(b.filePath);
  if(!cuePath){ b.chapters = b.chapters || []; return; }
  const content = await window.electronAPI.readFile(cuePath);
  if(!content){ b.chapters = b.chapters || []; return; }
  const parsed = parseCue(content);
  // preserve listened flags if we already had chapters saved
  if (b.chapters && Array.isArray(b.chapters) && b.chapters.length>0){
    for(let i=0;i<Math.min(b.chapters.length, parsed.length); i++){
      parsed[i].listened = !!b.chapters[i].listened;
    }
  }
  b.chapters = parsed;
}

function renderChapters(b){
  const list = document.getElementById('chapters-list');
  const msg = document.getElementById('chapters-message');
  list.innerHTML='';
  if(!b || !b.chapters || b.chapters.length===0){
    msg.textContent = 'Para dividir en capítulos, cargá un archivo .cue junto al audiolibro (misma carpeta).';
    return;
  }
  msg.textContent = '';
  b.chapters.forEach((c,idx)=>{
    const li = document.createElement('li');
    li.style.padding='6px 8px';
    li.style.borderBottom='1px solid var(--bg3)';
    li.style.display='flex';
    li.style.alignItems='center';
    li.style.justifyContent='space-between';
    const left = document.createElement('div');
    left.style.cursor='pointer';
    left.textContent = `${c.title} — ${fmtTime(c.time)}`;
    left.onclick = ()=>{ if(!b) return; audio.currentTime = c.time; audio.play(); currentBook = b; updatePlayerUI(); };
    const right = document.createElement('div');
    const toggle = document.createElement('input');
    toggle.type='checkbox';
    toggle.checked = !!c.listened;
    toggle.onchange = ()=>{
      c.listened = toggle.checked;
      save();
      renderBooks();
      // if checked, jump to next chapter
      if(toggle.checked){
        const next = b.chapters[idx+1];
        if(next){
          audio.currentTime = next.time;
          audio.play();
          currentBook = b;
          updatePlayerUI();
        }
      }
    };
    right.appendChild(toggle);
    li.appendChild(left);
    li.appendChild(right);
    list.appendChild(li);
  });
}

function fmtTime(s){
  if(!s||isNaN(s)) return '0:00';
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=Math.floor(s%60);
  if(h>0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

function pct(b){ return b.duration>0 ? Math.round((b.position||0)/b.duration*100) : 0; }

function renderBooks(){
  const q = document.getElementById('search-input').value.toLowerCase();
  let filtered = books.filter(b=>{
    if(!b.title.toLowerCase().includes(q) && !(b.author||'').toLowerCase().includes(q)) return false;
    if(currentView==='recents') return b.position > 0;
    if(currentView==='finished') return b.finished;
    return true;
  });
  if(currentView==='recents') filtered.sort((a,b)=>(b.lastPlayed||0)-(a.lastPlayed||0));

  document.getElementById('book-count').textContent = `${filtered.length} libro${filtered.length!==1?'s':''}`;
  const titles = {'library':'Mi Biblioteca','recents':'Recientes','finished':'Terminados'};
  document.getElementById('view-title').textContent = titles[currentView];

  const container = document.getElementById('books-container');
  if(filtered.length===0){
    container.innerHTML = `<div class="empty"><div class="empty-icon">📚</div><h2>${books.length===0?'Tu biblioteca está vacía':'Sin resultados'}</h2><p>${books.length===0?'Agregá tu primer audiolibro usando el botón de abajo':'Probá con otra búsqueda'}</p></div>`;
    return;
  }

  if(layout==='grid'){
    container.className='books-grid';
    container.innerHTML = filtered.map(b=>cardHTML(b)).join('');
  } else {
    container.className='books-list';
    container.innerHTML = filtered.map((b,i)=>rowHTML(b,i)).join('');
  }
}

function cardHTML(b){
  const p=pct(b);
  const isPlaying = currentBook && currentBook.id===b.id;
  const coverContent = b.coverPath ? `<img class="book-cover-img" src="${toFileUrl(b.coverPath)}" onerror="this.style.display='none'">` : `<div class="book-cover-placeholder">${defaultCoverMarkup(54)}</div>`;

  return `<div class="book-card" onclick="selectBook('${b.id}')" oncontextmenu="openCardMenu('${b.id}', event); return false;">
    <div class="book-cover-wrap">
      ${coverContent}
      <button class="card-menu-btn" onclick="openCardMenu('${b.id}', event); event.stopPropagation();">⋯</button>
      <div class="card-menu" id="card-menu-${b.id}">
        <button onclick="openEditModal('${b.id}', event); event.stopPropagation();">Editar</button>
        <button onclick="quickChangeCover('${b.id}', event); event.stopPropagation();">Cambiar portada</button>
        <button onclick="quickLinkCue('${b.id}', event); event.stopPropagation();">Vincular .cue</button>
        <button onclick="deleteBookQuick('${b.id}', event); event.stopPropagation();" style="color:var(--red)">Eliminar</button>
      </div>
      <div class="book-card-overlay">
        <div class="play-circle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#0d0f14"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
      </div>
      ${isPlaying?'<div class="playing-badge">▶</div>':''}
      <div class="progress-strip"><div class="progress-strip-fill" style="width:${p}%"></div></div>
    </div>
    <div class="book-title" title="${b.title}">${b.title}</div>
    <div class="book-author">${b.author||''}</div>
    <div class="book-duration">${b.duration?fmtTime(b.duration):'—'} · ${p}% ${b.missingFile?'· archivo faltante':''}</div>
  </div>`;
}

function rowHTML(b,i){
  const p=pct(b);
  const isPlaying = currentBook && currentBook.id===b.id;
  return `<div class="book-row${isPlaying?' playing':''}" onclick="selectBook('${b.id}')">
    <div class="book-row-num">${i+1}</div>
    <div class="book-row-cover">${defaultCoverMarkup(22)}</div>
    <div class="book-row-info">
      <div class="book-row-title">${b.title}</div>
      <div class="book-row-author">${b.author||''}</div>
    </div>
    <div class="book-row-progress"><div class="book-row-progress-fill" style="width:${p}%"></div></div>
    <div class="book-row-dur">${b.duration?fmtTime(b.duration):'—'}</div>
  </div>`;
}

// genres removed: filtering is only by search (title/author)

function setView(v, el){
  currentView=v;
  document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
  if(el) el.classList.add('active');
  renderBooks();
}

function setLayout(l, btn){
  layout=l;
  document.querySelectorAll('.view-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderBooks();
}

function selectBook(id){
  const b = books.find(x=>x.id===id);
  if(!b) return;

  if(!b.filePath){
    alert('Este audiolibro no tiene ruta local guardada. Vuelve a cargar el archivo.');
    return;
  }

  checkFileExists(b.filePath).then((exists)=>{
    if(!exists){
      b.missingFile = true;
      save();
      renderBooks();
      alert('No se pudo abrir el audiolibro: el archivo no existe en la ruta guardada o fue movido.');
      return;
    }

    b.missingFile = false;
    currentBook = b;
    audio.src = toFileUrl(b.filePath);
    audio.currentTime = b.position||0;
    audio.playbackRate = SPEEDS[speedIdx];
    audio.play();
    document.getElementById('play-btn').disabled=false;
    updatePlayerUI();
    // load chapters if any and render
    loadChaptersForBook(b).then(()=>{
      renderChapters(b);
    });
    b.lastPlayed = Date.now();
    save();
  });
}

function deleteCurrentBook(){
  if(!currentBook) return;
  if(!confirm(`Eliminar "${currentBook.title}" de la biblioteca?`)) return;
  const idx = books.findIndex(b=>b.id===currentBook.id);
  if(idx>=0){
    books.splice(idx,1);
    save();
    currentBook = null;
    renderBooks();
    // clear player UI
    document.getElementById('player-title').textContent='Ningún libro seleccionado';
    document.getElementById('player-author').textContent='';
    document.getElementById('player-cover').innerHTML='🎧';
    document.getElementById('hero-area').classList.remove('visible');
  }
}

function deleteBookById(id){
  const idx = books.findIndex(b=>b.id===id);
  if(idx>=0){
    books.splice(idx,1);
    save();
    if(currentBook && currentBook.id===id) currentBook = null;
    renderBooks();
    document.getElementById('player-title').textContent='Ningún libro seleccionado';
    document.getElementById('player-author').textContent='';
    document.getElementById('player-cover').innerHTML='🎧';
    document.getElementById('hero-area').classList.remove('visible');
  }
}

function deleteBookFromModal(){
  if(!selectedEditBookId) return;
  if(!confirm('Eliminar este libro de la biblioteca?')) return;
  deleteBookById(selectedEditBookId);
  closeEditModal();
}

async function saveEditBook(){
  if(!selectedEditBookId) return;
  const b = books.find(x=>x.id===selectedEditBookId);
  if(!b) return;
  const newTitle = document.getElementById('edit-inp-title').value.trim();
  const newAuthor = document.getElementById('edit-inp-author').value.trim();
  if(newTitle) b.title = newTitle;
  b.author = newAuthor;
  // cover
  if(pendingEditCoverFile){
    const cp = await resolvePendingFilePath(pendingEditCoverFile);
    if(cp) b.coverPath = cp;
  }
  // cue
  if(pendingEditCueFile){
    const cuePath = await resolvePendingFilePath(pendingEditCueFile);
    if(cuePath){
      const content = await window.electronAPI.readFile(cuePath);
      if(content){
        const parsed = parseCue(content);
        // preserve listened flags where possible
        if(b.chapters && b.chapters.length>0){
          for(let i=0;i<Math.min(b.chapters.length, parsed.length); i++) parsed[i].listened = !!b.chapters[i].listened;
        }
        b.chapters = parsed;
      }
    }
  }
  // save and refresh
  save();
  renderBooks();
  if(currentBook && currentBook.id===b.id){
    currentBook = b;
    updatePlayerUI();
    renderChapters(b);
  }
  closeEditModal();
}

function updatePlayerUI(){
  const b=currentBook;
  if(!b) return;
  document.getElementById('player-title').textContent=b.title;
  document.getElementById('player-author').textContent=b.author||'';
  const cover=document.getElementById('player-cover');
  if(b.coverPath){
    cover.innerHTML = `<img src="${toFileUrl(b.coverPath)}" style="width:100%;height:100%;object-fit:cover">`;
  } else {
    cover.innerHTML = defaultCoverMarkup(28);
  }

  const heroArea=document.getElementById('hero-area');
  heroArea.classList.add('visible');
  document.getElementById('hero-title').textContent=b.title;
  document.getElementById('hero-author').textContent=b.author||'';
  const heroCover=document.getElementById('hero-cover');
  if(b.coverPath){
    heroCover.innerHTML = `<img src="${toFileUrl(b.coverPath)}" style="width:100%;height:100%;object-fit:cover;border-radius:6px">`;
  } else {
    heroCover.innerHTML=defaultCoverMarkup(44);
  }
  renderBooks();
}

function togglePlay(){
  if(!currentBook) return;
  if(audio.paused){ audio.play(); } else { audio.pause(); }
}

function skip(s){
  if(currentBook) audio.currentTime=Math.max(0,Math.min(audio.duration||0,audio.currentTime+s));
}

function seekTo(v){
  if(currentBook && audio.duration){
    audio.currentTime=(v/100)*audio.duration;
  }
  seeking=false;
}

function setVolume(v){ audio.volume=v; }

function cycleSpeed(){
  speedIdx=(speedIdx+1)%SPEEDS.length;
  const s=SPEEDS[speedIdx];
  audio.playbackRate=s;
  document.getElementById('speed-btn').textContent=s+'×';
}

audio.addEventListener('timeupdate',()=>{
  if(!currentBook||seeking) return;
  const ct=audio.currentTime, dur=audio.duration||0;
  const p=dur>0?ct/dur*100:0;
  document.getElementById('cur-time').textContent=fmtTime(ct);
  document.getElementById('tot-time').textContent=fmtTime(dur);
  document.getElementById('seek-bar').value=p;
  document.getElementById('hero-prog').style.width=p+'%';
  document.getElementById('hero-time').textContent=`${fmtTime(ct)} / ${fmtTime(dur)}`;

  if(Math.abs(ct-(currentBook.position||0))>4){
    currentBook.position=ct;
    if(dur>0) currentBook.duration=dur;
    const idx=books.findIndex(b=>b.id===currentBook.id);
    if(idx>=0){ books[idx]=currentBook; save(); }
  }
});

audio.addEventListener('loadedmetadata',()=>{
  if(!currentBook) return;
  currentBook.duration=audio.duration;
  const idx=books.findIndex(b=>b.id===currentBook.id);
  if(idx>=0){ books[idx]=currentBook; save(); }
  document.getElementById('tot-time').textContent=fmtTime(audio.duration);
  renderBooks();
});

audio.addEventListener('play',()=>{
  document.getElementById('play-icon').innerHTML='<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  document.getElementById('eq-anim').classList.remove('paused');
});

audio.addEventListener('pause',()=>{
  document.getElementById('play-icon').innerHTML='<polygon points="5,3 19,12 5,21"/>';
  document.getElementById('eq-anim').classList.add('paused');
  if(currentBook){
    currentBook.position=audio.currentTime;
    const idx=books.findIndex(b=>b.id===currentBook.id);
    if(idx>=0){ books[idx]=currentBook; save(); }
  }
});

audio.addEventListener('ended',()=>{
  if(currentBook){
    currentBook.finished=true;
    currentBook.position=0;
    const idx=books.findIndex(b=>b.id===currentBook.id);
    if(idx>=0){ books[idx]=currentBook; save(); }
    renderBooks();
  }
});

let pendingFile=null;
let pendingCoverFile = null;
let selectedEditBookId = null;
let pendingEditCoverFile = null;
let pendingEditCueFile = null;

function openAddModal(){
  document.getElementById('add-modal').classList.add('active');
}

function openEditModal(id, event){
  const b = books.find(x=>x.id===id);
  if(!b) return;
  selectedEditBookId = id;
  pendingEditCoverFile = null;
  pendingEditCueFile = null;
  document.getElementById('edit-inp-title').value = b.title || '';
  document.getElementById('edit-inp-author').value = b.author || '';
  document.getElementById('edit-cover-label').textContent = b.coverPath ? '📌 Portada vinculada' : '🖼️ Elegir portada...';
  document.getElementById('edit-cue-label').textContent = (b.chapters && b.chapters.length>0) ? `${b.chapters.length} capítulos` : '📑 Elegir .cue...';
  document.getElementById('edit-modal').classList.add('active');
}

function toggleCardMenu(id, event){
  // close others
  document.querySelectorAll('.card-menu').forEach(m=>m.classList.remove('active'));
  const el = document.getElementById(`card-menu-${id}`);
  if(!el) return;
  el.classList.toggle('active');
}

function openCardMenu(id, event){
  if(event){
    event.preventDefault && event.preventDefault();
    event.stopPropagation && event.stopPropagation();
  }
  // close others
  document.querySelectorAll('.card-menu').forEach(m=>m.classList.remove('active'));
  const el = document.getElementById(`card-menu-${id}`);
  if(!el) return;
  el.classList.add('active');
}

function closeAllCardMenus(){
  document.querySelectorAll('.card-menu').forEach(m=>m.classList.remove('active'));
}

function quickChangeCover(id, event){
  selectedEditBookId = id;
  // trigger hidden input
  document.getElementById('edit-cover-input').click();
  closeAllCardMenus();
}

function quickLinkCue(id, event){
  selectedEditBookId = id;
  document.getElementById('edit-cue-input').click();
  closeAllCardMenus();
}

function deleteBookQuick(id, event){
  if(!confirm('Eliminar este libro de la biblioteca?')) return;
  deleteBookById(id);
  closeAllCardMenus();
}

// close menus when clicking outside
document.addEventListener('click', (e)=>{
  closeAllCardMenus();
});

function closeEditModal(){
  selectedEditBookId = null;
  pendingEditCoverFile = null;
  pendingEditCueFile = null;
  document.getElementById('edit-modal').classList.remove('active');
  document.getElementById('edit-cover-label').textContent = '🖼️ Elegir portada...';
  document.getElementById('edit-cue-label').textContent = '📑 Elegir .cue...';
}

function closeModal(){
  document.getElementById('add-modal').classList.remove('active');
  pendingFile=null;
  pendingCoverFile = null;
  document.getElementById('file-label').textContent='📂 Elegir archivo...';
  document.getElementById('cover-label').textContent='🖼️ Elegir portada...';
  document.getElementById('inp-title').value='';
  document.getElementById('inp-author').value='';
}

function onFileSelect(input){
  const f=input.files[0];
  if(!f) return;
  pendingFile=f;
  document.getElementById('file-label').textContent='✅ '+f.name;
  if(!document.getElementById('inp-title').value){
    let name=f.name.replace(/\.[^.]+$/,'').replace(/[-_]/g,' ');
    document.getElementById('inp-title').value=name;
  }
}

function onCoverSelect(input){
  const f=input.files[0];
  if(!f) return;
  pendingCoverFile = f;
  document.getElementById('cover-label').textContent = '✅ '+f.name;
}

function onEditCoverSelect(input){
  const f=input.files[0];
  if(!f) return;
  pendingEditCoverFile = f;
  document.getElementById('edit-cover-label').textContent = '✅ '+f.name;
  // If invoked from quick menu and modal closed, apply immediately
  if(selectedEditBookId && !document.getElementById('edit-modal').classList.contains('active')){
    const id = selectedEditBookId;
    const file = pendingEditCoverFile;
    selectedEditBookId = id;
    resolvePendingFilePath(file).then((coverPath)=>{
      if(coverPath){
        const b = books.find(x=>x.id===id);
        if(b){ b.coverPath = coverPath; save(); renderBooks(); if(currentBook && currentBook.id===b.id){ updatePlayerUI(); } }
      }
      pendingEditCoverFile = null;
      selectedEditBookId = null;
    });
  }
}

function onEditCueSelect(input){
  const f=input.files[0];
  if(!f) return;
  pendingEditCueFile = f;
  document.getElementById('edit-cue-label').textContent = '✅ '+f.name;
  // If invoked from quick menu (selectedEditBookId set and modal closed), apply immediately
  if(selectedEditBookId && !document.getElementById('edit-modal').classList.contains('active')){
    const id = selectedEditBookId;
    const file = pendingEditCueFile;
    selectedEditBookId = id; // ensure set
    // apply
    resolvePendingFilePath(file).then(async (cuePath)=>{
      if(cuePath){
        const content = await window.electronAPI.readFile(cuePath);
        if(content){
          const parsed = parseCue(content);
          const b = books.find(x=>x.id===id);
          if(b){
            if(b.chapters && b.chapters.length>0){
              for(let i=0;i<Math.min(b.chapters.length, parsed.length); i++) parsed[i].listened = !!b.chapters[i].listened;
            }
            b.chapters = parsed;
            save();
            if(currentBook && currentBook.id===b.id){ renderChapters(b); }
            renderBooks();
          }
        }
      }
      pendingEditCueFile = null;
      selectedEditBookId = null;
    });
  }
}

async function resolvePendingFilePath(file){
  if(!file) return null;
  if(file.path) return file.path;
  if(window.electronAPI && window.electronAPI.getPathForFile){
    const resolved = window.electronAPI.getPathForFile(file);
    if(resolved) return resolved;
  }
  return null;
}

async function saveBook(){
  const title=document.getElementById('inp-title').value.trim();
  if(!title){ alert('Ingresá un título'); return; }
  if(!pendingFile){ alert('Seleccioná un archivo de audio'); return; }

  const filePath = await resolvePendingFilePath(pendingFile);

  if(!filePath){
    alert('No se pudo obtener la ruta del archivo. Arrastralo desde el explorador o selecciona nuevamente.');
    return;
  }

  const id='book_'+Date.now();
  const b={
    id, title,
    author:document.getElementById('inp-author').value.trim(),
    position:0,
    duration:0,
    finished:false,
    lastPlayed:0,
    addedAt:Date.now(),
    filePath,
    coverPath: null,
    missingFile: false
  };

  // resolve cover path if provided
  if(pendingCoverFile){
    const coverPath = await resolvePendingFilePath(pendingCoverFile);
    if(coverPath) b.coverPath = coverPath;
  }

  const tmpAudio=new Audio(toFileUrl(filePath));
  tmpAudio.addEventListener('loadedmetadata',()=>{
    b.duration=tmpAudio.duration;
    save();
    renderBooks();
  });

  books.push(b);
  save();
  renderBooks();
  closeModal();
}

document.addEventListener('dragover',e=>{
  e.preventDefault();
  document.getElementById('drop-overlay').classList.add('active');
});

document.addEventListener('dragleave',e=>{
  if(!e.relatedTarget||e.relatedTarget===document.body) {
    document.getElementById('drop-overlay').classList.remove('active');
  }
});

document.addEventListener('drop',e=>{
  e.preventDefault();
  document.getElementById('drop-overlay').classList.remove('active');
  const f=e.dataTransfer.files[0];
  if(!f||!f.type.startsWith('audio/')) return;

  pendingFile=f;
  document.getElementById('file-label').textContent='✅ '+f.name;
  let name=f.name.replace(/\.[^.]+$/,'').replace(/[-_]/g,' ');
  document.getElementById('inp-title').value=name;
  openAddModal();
});

load();
verifyStoredBooks(true).then(()=>{
  save();
  renderBooks();
  document.getElementById('eq-anim').classList.add('paused');
});
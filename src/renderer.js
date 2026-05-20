const EMOJIS = ['📚','🗡️','🔮','🌌','🏰','🧪','🐉','🕵️','❤️','🌿','⚔️','🎭','🧠','🌊','🔥','🎶','🪐','🏛️','🧬','🦁'];
const SPEEDS = [0.75,1,1.25,1.5,1.75,2];
let books = [], currentBook = null, speedIdx = 1, layout = 'grid', currentView = 'library', seeking = false;
const audio = document.getElementById('audio-el');

function toFileUrl(filePath){
  return encodeURI(`file:///${filePath.replace(/\\/g, '/')}`);
}

async function checkFileExists(filePath){
  if(!filePath) return false;
  if(!window.electronAPI || !window.electronAPI.fileExists) return true;
  return await window.electronAPI.fileExists(filePath);
}

function load(){
  try { books = JSON.parse(localStorage.getItem('audioshelf_books')||'[]'); } catch(e){ books=[]; }
  books = books.map(b=>({...b, filePath: b.filePath || null, missingFile: false}));
}

function save(){
  const toSave = books.map(b=>{
    const {missingFile,...rest} = b;
    return rest;
  });
  localStorage.setItem('audioshelf_books', JSON.stringify(toSave));
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
  const coverContent = `<div class="book-cover-placeholder">${b.emoji||'📚'}</div>`;

  return `<div class="book-card" onclick="selectBook('${b.id}')">
    <div class="book-cover-wrap">
      ${coverContent}
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
    <div class="book-row-cover">${b.emoji||'📚'}</div>
    <div class="book-row-info">
      <div class="book-row-title">${b.title}</div>
      <div class="book-row-author">${b.author||''} ${b.genre?'· '+b.genre:''}</div>
    </div>
    <div class="book-row-progress"><div class="book-row-progress-fill" style="width:${p}%"></div></div>
    <div class="book-row-dur">${b.duration?fmtTime(b.duration):'—'}</div>
  </div>`;
}

function renderGenres(){
  const counts={};
  books.forEach(b=>{ const g=b.genre||'Sin género'; counts[g]=(counts[g]||0)+1; });
  document.getElementById('genre-list').innerHTML = Object.entries(counts).map(([g,c])=>
    `<div class="genre-item" onclick="filterGenre('${g}')"><span>${g}</span><span class="genre-count">${c}</span></div>`
  ).join('');
}

function filterGenre(g){
  document.getElementById('search-input').value=g;
  setView('library',document.querySelector('[data-view="library"]'));
}

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
    b.lastPlayed = Date.now();
    save();
  });
}

function updatePlayerUI(){
  const b=currentBook;
  if(!b) return;
  document.getElementById('player-title').textContent=b.title;
  document.getElementById('player-author').textContent=b.author||'';
  const cover=document.getElementById('player-cover');
  cover.innerHTML=b.emoji||'🎧';

  const heroArea=document.getElementById('hero-area');
  heroArea.classList.add('visible');
  document.getElementById('hero-title').textContent=b.title;
  document.getElementById('hero-author').textContent=b.author||'';
  const heroCover=document.getElementById('hero-cover');
  heroCover.innerHTML=b.emoji||'🎧';
  heroCover.className='hero-cover-placeholder';
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

let selectedEmoji='📚', pendingFile=null;

function openAddModal(){
  document.getElementById('add-modal').classList.add('active');
  const grid=document.getElementById('emoji-grid');
  grid.innerHTML=EMOJIS.map(e=>`<div class="emoji-opt${e===selectedEmoji?' selected':''}" onclick="pickEmoji('${e}',this)">${e}</div>`).join('');
}

function closeModal(){
  document.getElementById('add-modal').classList.remove('active');
  pendingFile=null;
  document.getElementById('file-label').textContent='📂 Elegir archivo...';
  document.getElementById('inp-title').value='';
  document.getElementById('inp-author').value='';
  document.getElementById('inp-genre').value='';
}

function pickEmoji(e,el){
  selectedEmoji=e;
  document.querySelectorAll('.emoji-opt').forEach(x=>x.classList.remove('selected'));
  el.classList.add('selected');
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
    genre:document.getElementById('inp-genre').value.trim(),
    emoji:selectedEmoji,
    position:0,
    duration:0,
    finished:false,
    lastPlayed:0,
    addedAt:Date.now(),
    filePath,
    missingFile: false
  };

  const tmpAudio=new Audio(toFileUrl(filePath));
  tmpAudio.addEventListener('loadedmetadata',()=>{
    b.duration=tmpAudio.duration;
    save();
    renderBooks();
    renderGenres();
  });

  books.push(b);
  save();
  renderBooks();
  renderGenres();
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
  renderGenres();
  document.getElementById('eq-anim').classList.add('paused');
});
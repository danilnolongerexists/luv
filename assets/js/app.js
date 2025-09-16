// Core quest app
// Architecture: load puzzles.json, render categories (timeline, artifacts, map, generic puzzles)
// Track progress in localStorage. Each puzzle gives a letter for final key. When all solved -> reveal letter and final letter -> generate QR

const LS_KEY = 'luvQuestProgress_v1';
const LS_SIG_KEY = 'luvQuestSignature_v1';
// Добавлено: фраза-доступ (можно заменить на свою). Сравнение регистронезависимое и обрезает пробелы.
const PASS_PHRASE = 'девушка свин';
let state = { puzzles: [], progress: {}, keyTemplate: [], reward: null, signature: '', attempts: {} };

// Очищаем любое прошлое сохранение при каждой загрузке страницы
try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_SIG_KEY); } catch {}

function computeSignature(puzzles){
  return puzzles.map(p=>{ const ans=(p.answers||[]).join('|'); let hash=0; for(let i=0;i<ans.length;i++){ hash=(hash*31+ans.charCodeAt(i))>>>0; } return `${p.id}:${p.type}:${hash}`; }).join(';');
}

async function loadData() {
  const res = await fetch('assets/data/puzzles.json');
  const json = await res.json();
  state.puzzles = json.puzzles;
  state.keyTemplate = (json.keyTemplate || []).map(()=>null);
  state.reward = json.reward;
  state.signature = computeSignature(state.puzzles);
  buildUI();
  updateProgressUI();
}

function saveProgress() { /* отключено */ }
function loadProgress() { /* отключено */ }
function validateOrResetProgress() { /* отключено */ }
function resetAllProgress(){ /* отключено */ }

function buildUI() {
  renderTimeline();
  renderArtifacts();
  renderMap();
  renderPuzzleHub();
  buildKeyDisplay();
}

function filterPuzzles(type) { return state.puzzles.filter(p => p.type === type); }

// Timeline (type: timeline)
function renderTimeline() {
  const wrap = document.getElementById('timelineItems');
  const list = filterPuzzles('timeline');
  wrap.innerHTML = '';
  list.forEach(p => {
    const div = document.createElement('div');
    div.className = 'timeline-item' + (isSolved(p.id) ? ' solved' : '');
    div.innerHTML = `<div class="t-year">${p.meta?.year || ''}</div><h3>${p.title}</h3><p>${p.teaser || ''}</p><button data-open="${p.id}" class="secondary">Открыть</button>`;
    wrap.appendChild(div);
  });
}

// Artifacts (type: artifact)
function renderArtifacts() {
  const grid = document.getElementById('artifactGrid');
  const list = filterPuzzles('artifact');
  grid.innerHTML = '';
  list.forEach(p => {
    const div = document.createElement('div');
    div.className = 'artifact' + (isSolved(p.id) ? ' solved' : '');
  const emoji = p.meta?.emoji || '🗂️';
  div.innerHTML = `<div class="a-icon">${emoji}</div><div class="a-label">${p.title}</div><button data-open="${p.id}" class="secondary">Открыть</button>`;
    grid.appendChild(div);
  });
}

// Map (type: mapPoint)
function renderMap() {
  const wrap = document.getElementById('mapPoints');
  const list = filterPuzzles('mapPoint');
  wrap.innerHTML = '';
  list.forEach((p, idx) => {
    const point = document.createElement('button');
    point.type = 'button';
    point.className = 'map-point' + (isSolved(p.id) ? ' solved' : '');
    // simple deterministic layout (оставим пока окружность)
    const angle = (idx / list.length) * Math.PI * 2;
    const cx = 50 + Math.cos(angle) * 35;
    const cy = 50 + Math.sin(angle) * 35;
    point.style.left = cx + '%';
    point.style.top = cy + '%';
    const label = document.createElement('span');
    label.className = 'mp-label';
    label.textContent = p.meta?.label || (idx + 1);
    point.appendChild(label);
    point.dataset.open = p.id;
    wrap.appendChild(point);
  });
}

// Generic puzzle hub (type: text | order | anagram | match etc.)
function renderPuzzleHub() {
  const listWrap = document.getElementById('puzzleList');
  const misc = state.puzzles.filter(p => !['timeline','artifact','mapPoint'].includes(p.type));
  listWrap.innerHTML = '';
  misc.forEach(p => {
    const item = document.getElementById('tpl-puzzle-item').content.firstElementChild.cloneNode(true);
    item.querySelector('.p-title').textContent = p.title;
    if (isSolved(p.id)) item.classList.add('solved');
    const body = item.querySelector('.p-body');
    body.appendChild(buildPuzzleBody(p));
    const meta = item.querySelector('.p-meta');
    meta.dataset.pid = p.id;
    meta.textContent = '';
    maybeShowHint(p.id, p.hint);
    listWrap.appendChild(item);
  });
}

function buildPuzzleBody(p) {
  switch (p.type) {
    case 'text': return buildTextPuzzle(p);
    case 'order': return buildOrderPuzzle(p);
    case 'anagram': return buildAnagramPuzzle(p);
    default: {
      const div = document.createElement('div');
      div.textContent = 'Тип пазла скоро';
      return div;
    }
  }
}

function buildTextPuzzle(p) {
  const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'flex-start';
    wrap.style.gap = '.6rem';
  // Показываем текст вопроса (раньше он не отображался для type=text в хабе)
  if (p.text) {
    const q = document.createElement('p');
    q.className = 'p-question';
    q.style.margin = '0 0 .5rem';
    q.textContent = p.text;
    wrap.appendChild(q);
  }
  const input = document.createElement('input'); input.type = 'text'; input.placeholder = 'Ответ';
  if (isSolved(p.id)) input.disabled = true;
  const btn = document.createElement('button'); btn.textContent = 'OK'; btn.className = 'primary';
  btn.style.flex = '0 0 auto';
  input.style.flex = '1 1 auto';
  btn.addEventListener('click', () => {
    if (checkAnswer(p, input.value.trim())) {
      markSolved(p);
      input.disabled = true; btn.disabled = true;
      // Сообщение об успешном вводе
      const done = document.createElement('div');
      done.style.fontSize = '.75rem'; done.style.marginTop = '.4rem'; done.style.opacity = '.75';
      done.textContent = 'Верно!';
      wrap.appendChild(done);
    } else {
      bumpAttempt(p.id, p.hint);
      input.classList.add('shake'); setTimeout(()=>input.classList.remove('shake'),600);
    }
  });
  wrap.append(input, btn);
  return wrap;
}

function buildOrderPuzzle(p) {
  const wrap = document.createElement('div');
  wrap.className = 'order-puzzle';
  const shuffled = [...p.data.items].sort(()=>Math.random()-0.5);
  const list = document.createElement('ul');
  list.style.listStyle='none'; list.style.margin='0'; list.style.padding='0';
  list.className = 'order-list';

  shuffled.forEach(txt => {
    const li = document.createElement('li');
    li.textContent = txt;
    li.draggable = true;
    li.className = 'order-item';
    li.setAttribute('data-val', txt);
    list.appendChild(li);
  });

  const btn = document.createElement('button');
  btn.textContent = 'Проверить порядок';
  btn.className = 'primary';
  btn.style.marginTop = '.6rem';
  const status = document.createElement('div');
  status.style.fontSize = '.7rem'; status.style.opacity='.75'; status.style.marginTop='.4rem';


  // --- Drag & Drop (mouse)
  let dragEl = null;
  list.addEventListener('dragstart', e => {
    const li = e.target.closest('.order-item');
    if (!li) return;
    dragEl = li;
    li.classList.add('dragging');
    document.body.classList.add('dnd-active');
    // Нужен setData для Firefox/Edge чтобы dnd активировался
    try { e.dataTransfer.setData('text/plain', li.dataset.val || ''); } catch {}
    // Подменяем drag image на прозрачный, чтобы не дублировался элемент и не вызывал артефакт затемнения
    try {
      const img = new Image();
      img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; // 1x1 прозрачный gif
      e.dataTransfer.setDragImage(img, 0, 0);
    } catch {}
    e.dataTransfer.effectAllowed = 'move';
  });
  list.addEventListener('dragend', e => {
    const li = e.target.closest('.order-item');
    if (li) li.classList.remove('dragging');
    dragEl = null;
    list.querySelectorAll('.order-item.over').forEach(el=>el.classList.remove('over'));
    document.body.classList.remove('dnd-active');
  });
  list.addEventListener('dragover', e => {
    if (!dragEl) return;
    e.preventDefault(); // позволяем drop
    const target = e.target.closest('.order-item');
    if (!target || target === dragEl) return;
    const rect = target.getBoundingClientRect();
    const before = (e.clientY - rect.top) < rect.height / 2; // верхняя половина
    if (before) {
      list.insertBefore(dragEl, target);
    } else {
      list.insertBefore(dragEl, target.nextSibling);
    }
  });
  list.addEventListener('dragenter', e => {
    if (!dragEl) return;
    const li = e.target.closest('.order-item');
    if (li && li !== dragEl) li.classList.add('over');
  });
  list.addEventListener('dragleave', e => {
    const li = e.target.closest('.order-item');
    if (li) li.classList.remove('over');
  });
  list.addEventListener('drop', e => {
    if (!dragEl) return;
    e.preventDefault();
    const li = e.target.closest('.order-item');
    if (li && li !== dragEl) {
      li.classList.remove('over');
      const rect = li.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      if (before) list.insertBefore(dragEl, li); else list.insertBefore(dragEl, li.nextSibling);
    }
  });

  // --- Touch drag for mobile
  let touchDragEl = null, touchStartY = 0, touchCurY = 0, touchPlaceholder = null;
  list.addEventListener('touchstart', function(e) {
    const li = e.target.closest('.order-item');
    if (!li) return;
    touchDragEl = li;
    touchStartY = e.touches[0].clientY;
    touchCurY = touchStartY;
    li.classList.add('dragging');
    // create placeholder
    touchPlaceholder = document.createElement('li');
    touchPlaceholder.className = 'order-item placeholder';
    touchPlaceholder.style.height = li.offsetHeight + 'px';
    li.parentNode.insertBefore(touchPlaceholder, li.nextSibling);
    li.style.position = 'absolute';
    li.style.zIndex = 1000;
    li.style.width = li.offsetWidth + 'px';
    li.style.pointerEvents = 'none';
    moveAt(e.touches[0].clientY);
    document.body.style.userSelect = 'none';
  }, { passive: false });

  list.addEventListener('touchmove', function(e) {
    if (!touchDragEl) return;
    e.preventDefault();
    touchCurY = e.touches[0].clientY;
    moveAt(touchCurY);
    // find where to insert
    const items = [...list.querySelectorAll('.order-item:not(.dragging):not(.placeholder)')];
    let insertBefore = null;
    for (const item of items) {
      const box = item.getBoundingClientRect();
      if (touchCurY < box.top + box.height/2) {
        insertBefore = item;
        break;
      }
    }
    if (insertBefore) {
      list.insertBefore(touchPlaceholder, insertBefore);
    } else {
      list.appendChild(touchPlaceholder);
    }
  }, { passive: false });

  list.addEventListener('touchend', function(e) {
    if (!touchDragEl) return;
    touchDragEl.classList.remove('dragging');
    touchDragEl.style.position = '';
    touchDragEl.style.zIndex = '';
    touchDragEl.style.width = '';
    touchDragEl.style.pointerEvents = '';
    if (touchPlaceholder && touchPlaceholder.parentNode) {
      list.insertBefore(touchDragEl, touchPlaceholder);
      touchPlaceholder.remove();
    }
    touchDragEl = null;
    touchPlaceholder = null;
    document.body.style.userSelect = '';
  });

  function moveAt(clientY) {
    if (!touchDragEl) return;
    const rect = list.getBoundingClientRect();
    touchDragEl.style.top = (clientY - rect.top - touchDragEl.offsetHeight/2) + 'px';
    touchDragEl.style.left = '0px';
  }

  btn.addEventListener('click', () => {
    const current = [...list.children].map(li=>li.getAttribute('data-val'));
    const target = p.data.correct;
    if (arraysEqInsensitive(current, target)) {
      status.textContent = 'Верно!';
      markSolved(p); btn.disabled = true; list.querySelectorAll('li').forEach(li=>li.draggable=false);
    } else {
      status.textContent = 'Неверно, попробуй поменять порядок.';
      bumpAttempt(p.id, p.hint);
    }
  });

  function arraysEqInsensitive(a,b){ if(a.length!==b.length) return false; return a.every((v,i)=> (v||'').toLowerCase() === (b[i]||'').toLowerCase()); }

  wrap.append(list, btn, status);
  return wrap;
}

function buildAnagramPuzzle(p) {
  const wrap = document.createElement('div');
  const letters = p.data.word.toUpperCase().split('').sort(()=>Math.random()-0.5);
  const area = document.createElement('div'); area.style.display='flex'; area.style.gap='.4rem'; area.style.flexWrap='wrap';
  const out = document.createElement('div'); out.style.minHeight='32px'; out.style.marginTop='.5rem'; out.style.fontWeight='600';
  letters.forEach(l => {
    const b = document.createElement('button'); b.type='button'; b.textContent=l; b.className='secondary';
    b.addEventListener('click', ()=>{ out.textContent += l; b.disabled=true; if(out.textContent.length===p.data.word.length) check(); });
    area.appendChild(b);
  });
  function check(){
    if (out.textContent.toLowerCase() === p.data.word.toLowerCase()) {
      markSolved(p);
    } else { out.style.color='var(--err)'; bumpAttempt(p.id, p.hint); setTimeout(()=>{out.textContent=''; out.style.color=''; area.querySelectorAll('button').forEach(b=>b.disabled=false);},900); }
  }
  wrap.append(area,out);
  return wrap;
}

function checkAnswer(p, val) {
  if (!val) return false;
  return p.answers.some(a => a.toLowerCase() === val.toLowerCase());
}

function isSolved(id) { return !!state.progress[id]; }
function markSolved(p) {
  if (isSolved(p.id)) return;
  state.progress[p.id] = { solved: true, at: Date.now() };
  // больше не сохраняем в localStorage
  if (p.rewardLetter) {
    revealLetter(p.rewardLetter, p);
  }
  renderTimeline(); renderArtifacts(); renderMap(); updateProgressUI();
}

function buildKeyDisplay() {
  const kd = document.getElementById('keyDisplay');
  kd.innerHTML = '';
  state.keyTemplate.forEach((_, i) => {
    const span = document.createElement('div');
    span.className = 'k-letter';
    span.dataset.slot = i;
    kd.appendChild(span);
  });
}

function revealLetter(letter, p) {
  let idx = -1;
  if (typeof p.rewardIndex === 'number' && p.rewardIndex >=0 && p.rewardIndex < state.keyTemplate.length) {
    if (state.keyTemplate[p.rewardIndex] == null) idx = p.rewardIndex;
  }
  if (idx === -1) {
    idx = state.keyTemplate.findIndex(x => x === null);
  }
  if (idx >= 0) {
    state.keyTemplate[idx] = letter;
    const el = document.querySelector(`.k-letter[data-slot="${idx}"]`);
    if (el) { el.textContent = letter; el.classList.add('revealed'); }
  }
  if (state.keyTemplate.every(x => x !== null)) {
    openFinalLetter();
  }
}

function updateProgressUI() {
  const total = state.puzzles.length;
  const solved = Object.keys(state.progress).length;
  const fill = document.getElementById('progressFill');
  fill.style.width = ((solved/total)*100).toFixed(1) + '%';
}

function openFinalLetter() {
  const cont = document.getElementById('finalLetter');
  cont.classList.remove('hidden');
  // принудительно перерисовать для transition
  requestAnimationFrame(()=> cont.classList.add('visible'));
  const letter = document.getElementById('letterContent');
  letter.innerHTML = `<h3>Сюрприз ❤️</h3><p>${state.reward.message}</p><button id="showQr" class="primary">Нажми на меня!</button>`;
  letter.classList.add('opened');
  document.getElementById('showQr').addEventListener('click', showQr);
}

function decodeBase64Unicode(str){ try { return decodeURIComponent(atob(str).split('').map(c=>'%' + c.charCodeAt(0).toString(16).padStart(2,'0')).join('')); } catch { return ''; } }

function showQr() {
  const overlay = document.getElementById('resultOverlay');
  overlay.classList.remove('hidden');
}

function attachGlobalHandlers() {
  document.body.addEventListener('click', e => {
    const btn = e.target.closest('[data-open]');
    if (btn) { openModalFor(btn.dataset.open); }
    if (e.target.id === 'closeResult') {
      const ov = document.getElementById('resultOverlay'); if (ov) ov.classList.add('hidden');
    }
  });
  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
  document.body.classList.remove('no-scroll');
      document.getElementById('hero').style.display='none';
      const main = document.getElementById('main');
      main.hidden = false;
      const fl = document.getElementById('finalLetter');
      fl.classList.remove('hidden');
      requestAnimationFrame(()=> fl.classList.add('visible'));
      // Убрано автоскрытие
      const closeBtn = document.getElementById('closeInitialLetter');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          fl.classList.remove('visible');
          setTimeout(()=> fl.classList.add('hidden'), 400);
        }, { once: true });
      }
    });
  }
  // Gate handlers
  const gateEnter = document.getElementById('gateEnter');
  const gateInput = document.getElementById('gateInput');
  if (gateEnter && gateInput) {
    const tryEnter = () => {
      const val = (gateInput.value||'').trim().toLowerCase();
      const target = PASS_PHRASE.trim().toLowerCase();
      const err = document.getElementById('gateError');
      if (!val) { err.hidden = false; err.textContent = 'Нужно ввести фразу.'; return; }
      if (val === target) {
        // Успешно: скрываем оверлей, запускаем остальную инициализацию
        err.hidden = true;
        const gate = document.getElementById('gateOverlay');
        if (gate) { gate.classList.add('fade-out'); setTimeout(()=> gate.remove(), 680); }
  // остаёмся заблокированы от скролла до нажатия Start, поэтому тут не снимаем no-scroll
        // Запускаем
        startHearts();
        loadData();
      } else {
        err.hidden = false; err.textContent = 'Неверно. Попробуй ещё.';
        gateInput.classList.add('shake'); setTimeout(()=>gateInput.classList.remove('shake'),600);
      }
    };
    gateEnter.addEventListener('click', tryEnter);
    gateInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryEnter(); });
  }
}

function openModalFor(id) {
  const p = state.puzzles.find(x=>x.id===id); if(!p) return;
  const letterDiv = document.getElementById('finalLetter');
  letterDiv.classList.remove('hidden');
  requestAnimationFrame(()=> letterDiv.classList.add('visible'));
  const letter = document.getElementById('letterContent');
  letter.classList.remove('opened');
  setTimeout(()=>letter.classList.add('opened'), 10);
  letter.innerHTML = `<h3>${p.title}</h3><p>${p.text||''}</p>`;
  const needsInput = ['text','timeline','artifact','mapPoint'].includes(p.type) && !isSolved(p.id) && (p.answers?.length);
  if (needsInput) {
  const input = document.createElement('input'); input.type='text'; input.placeholder='Ответ'; input.autofocus = true;
  const ok = document.createElement('button'); ok.textContent='OK'; ok.className='primary';
  const wrap = document.createElement('div'); wrap.style.display='flex'; wrap.style.flexDirection='column'; wrap.style.marginTop='.8rem'; wrap.style.gap='.6rem'; wrap.style.alignItems='flex-start';
    ok.addEventListener('click',()=>{ 
      const val = input.value.trim(); 
      if(checkAnswer(p, val)) { 
        markSolved(p); 
        input.disabled = true; ok.disabled = true; 
        const msg = document.createElement('p'); msg.textContent = 'Верно! Буква добавлена.'; msg.style.marginTop = '.8rem';
        letter.appendChild(msg); 
      } else { 
        bumpAttempt(p.id, p.hint); 
        input.style.outline='2px solid var(--err)'; setTimeout(()=>input.style.outline='',800);
        // Если после инкремента попыток достигнут порог и подсказка ещё не выведена — показываем её прямо в модалке
        if (state.attempts[p.id] >= 3 && p.hint && !letter.querySelector('.inline-hint')) {
          const hintP = document.createElement('p');
          hintP.className = 'inline-hint';
          hintP.style.marginTop = '.8rem';
          hintP.style.opacity = '.75';
          hintP.textContent = 'Подсказка: ' + p.hint;
          letter.appendChild(hintP);
        }
      } 
    });
    input.addEventListener('keydown',e=>{ if(e.key==='Enter') ok.click(); });
    wrap.append(input, ok); letter.appendChild(wrap);
    // Выравниваем высоту кнопки с input
    requestAnimationFrame(()=>{
      try {
        const h = getComputedStyle(input).height;
        ok.style.height = h;
        ok.style.paddingTop = '0';
        ok.style.paddingBottom = '0';
  // align-items оставляем flex-start по требованию
      } catch {}
    });
  }
  // Показ подсказки в модалке если уже открыта по правилу
  if (state.attempts[p.id] >= 3 && p.hint) {
    const hintP = document.createElement('p'); hintP.style.marginTop='.8rem'; hintP.style.opacity='.75'; hintP.textContent = 'Подсказка: ' + p.hint; letter.appendChild(hintP);
  }
  if (isSolved(p.id) && p.rewardLetter) {
    const solvedMsg = document.createElement('p'); solvedMsg.style.marginTop = '.8rem'; solvedMsg.textContent = 'Выполнено!';
    letter.appendChild(solvedMsg);
  }
  const close = document.createElement('button'); close.textContent='Закрыть'; close.className='secondary'; close.style.marginTop='1rem';
  close.addEventListener('click',()=> {
    letterDiv.classList.remove('visible');
    setTimeout(()=> letterDiv.classList.add('hidden'), 400);
  });
  letter.appendChild(close);
}

function bumpAttempt(id, hint) {
  state.attempts[id] = (state.attempts[id]||0) + 1;
  if (state.attempts[id] === 3 && hint) {
    maybeShowHint(id, hint);
    // Если открыта модалка с этим пазлом — добавить подсказку внутрь
    const letter = document.getElementById('letterContent');
    if (letter && letter.querySelector('h3') && !letter.querySelector('.inline-hint')) {
      const title = letter.querySelector('h3').textContent.trim();
      const pObj = state.puzzles.find(p=>p.title === title && p.id === id);
      if (pObj) {
        const hintP = document.createElement('p');
        hintP.className = 'inline-hint';
        hintP.style.marginTop = '.8rem';
        hintP.style.opacity = '.75';
        hintP.textContent = 'Подсказка: ' + hint;
        letter.appendChild(hintP);
      }
    }
  } else if (state.attempts[id] > 3 && hint) {
    // уже показана — ничего
  }
}
function maybeShowHint(id, hint) {
  if (!hint) return;
  const metaEl = document.querySelector(`.p-meta[data-pid="${id}"]`);
  if (!metaEl) return;
  if (state.attempts[id] >= 3 && !metaEl.textContent) {
    metaEl.textContent = 'Подсказка: ' + hint;
  }
}

// Decorative hearts background
function startHearts() {
  const c = document.getElementById('bg-hearts');
  const ctx = c.getContext('2d');
  function resize(){ c.width = innerWidth; c.height = innerHeight; }
  resize(); addEventListener('resize', resize);
  const hearts = Array.from({length:60}, () => ({
    x: Math.random()*c.width,
    y: Math.random()*c.height,
    r: 4+Math.random()*6,
    sp: 0.2+Math.random()*0.6,
    o: 0.3+Math.random()*0.6
  }));
  (function frame(){
    ctx.clearRect(0,0,c.width,c.height);
    hearts.forEach(h=>{
      h.y -= h.sp; if (h.y < -10) { h.y = c.height + 10; h.x = Math.random()*c.width; }
      ctx.fillStyle = `rgba(255,100,150,${h.o})`;
      ctx.beginPath();
      // simple heart (circle + rotated square approximation)
      ctx.moveTo(h.x, h.y);
      ctx.arc(h.x - h.r/2, h.y, h.r/2, 0, Math.PI*2);
      ctx.arc(h.x + h.r/2, h.y, h.r/2, 0, Math.PI*2);
      ctx.lineTo(h.x, h.y + h.r);
      ctx.closePath();
      ctx.fill();
    });
    requestAnimationFrame(frame);
  })();
}

attachGlobalHandlers();
// startHearts(); // теперь запускается после фразы
// loadData();     // теперь запускается после фразы

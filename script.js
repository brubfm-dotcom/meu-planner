/* planner script.js

Features implemented:
- Daily tasks with add/toggle/delete and strike-through
- Monthly calendar grid where clicking a day adds tasks
- Yearly calendar showing only emotions/icons per day
- Preplaced special icons on specific dates
- Emoji/category manager for assigning emotions to tasks and to birthdays
- Add birthdays (people you love) with selectable emotion (heart/flower/other)
- Persistence via localStorage
- Year auto-set from current date
*/

// --- Utilities -------------------------------------------------------------
const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

// Storage keys
const STORAGE = {
  DAILY: 'planner_daily',
  TASKS: 'planner_tasks', // keyed by date YYYY-MM-DD -> [{text, done, emotion, id}]
  EMOJIS: 'planner_emojis', // [{name, symbol}]
  BIRTHDAYS: 'planner_birthdays' // [{name, date: 'MM-DD', emotion}]
};

// Defaults
const defaultEmojis = [
  { name: 'Coração', symbol: '❤️' },
  { name: 'Flor', symbol: '🌸' },
  { name: 'Estrela', symbol: '⭐' }
];

function load(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

// --- State -----------------------------------------------------------------
let daily = load(STORAGE.DAILY, []); // [{id, text, done, date}]  date is ISO day
let tasks = load(STORAGE.TASKS, {}); // { 'YYYY-MM-DD': [{id,text,done,emotion}] }
let emojis = load(STORAGE.EMOJIS, defaultEmojis.slice());
let birthdays = load(STORAGE.BIRTHDAYS, []); // [{name, date:'MM-DD', emotion}]

// --- Init ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  bindUI();
  renderEmojis();
  renderDaily();
  renderMonthly();
  renderYearly();
});

// --- ID generator ----------------------------------------------------------
function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

// --- Daily -----------------------------------------------------------------
function bindUI(){
  const input = qs('#daily-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addDaily();
    });
  }
  const emojiAddBtn = qs('.emoji-box button');
  if (emojiAddBtn) emojiAddBtn.addEventListener('click', addEmoji);
}

function addDaily(){
  const input = qs('#daily-input');
  const val = input.value && input.value.trim();
  if (!val) return;
  const item = { id: uid('d_'), text: val, done: false, date: todayISO() };
  daily.unshift(item);
  save(STORAGE.DAILY, daily);
  input.value = '';
  renderDaily();
}

function renderDaily(){
  const ul = qs('#daily-list');
  if (!ul) return;
  ul.innerHTML = '';
  daily.forEach(item => {
    const li = document.createElement('li');
    li.dataset.id = item.id;
    li.className = item.done ? 'done' : '';
    li.innerHTML = `
      <input type="checkbox" ${item.done ? 'checked' : ''} />
      <span class="text">${escapeHtml(item.text)}</span>
      <button class="del">✖</button>
      <button class="emo">😄</button>
    `;
    // toggle
    li.querySelector('input[type=checkbox]').addEventListener('change', (e) => {
      item.done = e.target.checked;
      save(STORAGE.DAILY, daily);
      renderDaily();
    });
    // delete
    li.querySelector('.del').addEventListener('click', () => {
      daily = daily.filter(d => d.id !== item.id);
      save(STORAGE.DAILY, daily);
      renderDaily();
    });
    // assign emotion -> open emojis list
    li.querySelector('.emo').addEventListener('click', () => {
      chooseEmoji((emo) => {
        // assign emotion as badge appended to li
        item.emotion = emo.symbol;
        save(STORAGE.DAILY, daily);
        renderDaily();
      });
    });
    if (item.emotion) {
      const span = li.querySelector('.text');
      span.innerHTML = `${escapeHtml(item.text)} <small>${item.emotion}</small>`;
    }
    ul.appendChild(li);
  });
}

// --- Emojis manager -------------------------------------------------------
function renderEmojis(){
  const ul = qs('#emoji-list');
  if (!ul) return;
  ul.innerHTML = '';
  emojis.forEach((e, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `${e.symbol} — ${escapeHtml(e.name)} <button data-idx="${idx}" class="del-emoji">Remover</button>`;
    ul.appendChild(li);
  });
  qsa('.del-emoji').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      emojis.splice(idx,1);
      save(STORAGE.EMOJIS, emojis);
      renderEmojis();
    });
  });
}

function addEmoji(){
  const nameI = qs('#emoji-name');
  const symI = qs('#emoji-symbol');
  const name = nameI.value && nameI.value.trim();
  const sym = symI.value && symI.value.trim();
  if (!name || !sym) return alert('Preencha nome e emoji.');
  emojis.push({name, symbol: sym});
  save(STORAGE.EMOJIS, emojis);
  nameI.value = '';
  symI.value = '';
  renderEmojis();
}

// UI helper to choose emoji (simple prompt-like using window.confirm list)
function chooseEmoji(callback){
  // build selection
  const choice = window.prompt('Escolha o número do emoji:\n' + emojis.map((e,i)=>`${i+1}. ${e.symbol} ${e.name}`).join('\n'));
  if (!choice) return;
  const idx = Number(choice)-1;
  if (idx < 0 || idx >= emojis.length) return alert('Escolha inválida');
  callback(emojis[idx]);
}

// --- Monthly calendar -----------------------------------------------------
function renderMonthly(referenceDate = new Date()){
  const container = qs('#monthly');
  if (!container) return;
  container.innerHTML = '';
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0-index

  // first day of month
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month+1, 0).getDate();
  // create day boxes (assume starting Monday is fine, we'll simply create days)
  for (let d=1; d<=daysInMonth; d++){
    const dayDate = new Date(year, month, d);
    const iso = isoDate(dayDate);
    const box = document.createElement('div');
    box.className = 'day';
    box.dataset.date = iso;
    const label = document.createElement('div');
    label.textContent = d;
    box.appendChild(label);

    // show small bullets for tasks
    const dayTasks = tasks[iso] || [];
    if (dayTasks.length) {
      const ul = document.createElement('ul');
      ul.style.listStyle='none';
      ul.style.padding='0';
      dayTasks.slice(0,3).forEach(t => {
        const li = document.createElement('li');
        li.textContent = (t.emotion ? t.emotion + ' ' : '') + t.text;
        li.style.fontSize = '12px';
        li.style.whiteSpace = 'nowrap';
        li.style.overflow='hidden';
        li.style.textOverflow='ellipsis';
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }

    box.addEventListener('click', () => {
      openDayEditor(iso);
    });

    container.appendChild(box);
  }
}

function openDayEditor(iso){
  const text = window.prompt('Adicionar tarefa para ' + iso + ' (deixe vazio para cancelar)');
  if (!text) return;
  // ask to choose emoji
  const emoChoice = window.prompt('Adicionar emoji? Digite o número:\n' + emojis.map((e,i)=>`${i+1}. ${e.symbol} ${e.name}`).join('\n') + '\nOu deixe vazio para nenhum.');
  let emo = null;
  if (emoChoice) {
    const idx = Number(emoChoice)-1; if (idx>=0 && idx<emojis.length) emo = emojis[idx].symbol;
  }
  const item = { id: uid('t_'), text, done: false, emotion: emo || null };
  if (!tasks[iso]) tasks[iso] = [];
  tasks[iso].push(item);
  save(STORAGE.TASKS, tasks);
  renderMonthly();
  renderYearly();
}

// --- Yearly calendar ------------------------------------------------------
function renderYearly(){
  const container = qs('#yearly');
  if (!container) return;
  container.innerHTML = '';
  const now = new Date();
  const year = now.getFullYear();

  // Pre-seeded special dates (month-day). We'll attach icons but keep them overridable by birthdays
  const seeded = {
    // format 'MM-DD'
    '05-30': '❤️',
    '08-16': '❤️',
    '09-03': '❤️',
    '03-11': '⭐' // seu aniversário
  };

  for (let m=0; m<12; m++){
    const block = document.createElement('div');
    block.className = 'year-block';
    const title = document.createElement('h3');
    const monthName = new Date(year,m,1).toLocaleString('pt-BR', { month: 'long' });
    title.textContent = monthName + ' ' + year;
    block.appendChild(title);

    const days = new Date(year, m+1, 0).getDate();
    for (let d=1; d<=days; d++){
      const dayEl = document.createElement('div');
      dayEl.className = 'day';
      const mm = String(m+1).padStart(2,'0');
      const dd = String(d).padStart(2,'0');
      dayEl.dataset.date = `${year}-${mm}-${dd}`;
      dayEl.title = `${dd}/${mm}/${year}`;

      // check seeded
      const md = `${mm}-${dd}`;
      let icons = '';
      if (seeded[md]) icons += seeded[md];

      // birthdays matching this month-day
      birthdays.forEach(b => {
        if (b.date === md) icons += (b.emotion || '🎉');
      });

      // tasks on that day -> show emotions only (unique)
      const iso = `${year}-${mm}-${dd}`;
      const dayTasks = tasks[iso] || [];
      const uniq = [...new Set(dayTasks.map(t => t.emotion).filter(Boolean))];
      uniq.forEach(sym => icons += sym);

      dayEl.innerHTML = icons || '&nbsp;';

      // click to show detailed tasks
      dayEl.addEventListener('click', () => {
        showDayDetails(iso);
      });

      block.appendChild(dayEl);
    }
    container.appendChild(block);
  }
}

function showDayDetails(iso){
  // show tasks and allow marking done / deleting
  const dayTasks = tasks[iso] || [];
  let msg = `Tarefas para ${iso}:\n`;
  if (!dayTasks.length) msg += '(nenhuma)\n';
  dayTasks.forEach((t,i)=>{
    msg += `${i+1}. ${t.emotion ? t.emotion+' ' : ''}${t.text} ${t.done? '(✔)': ''}\n`;
  });
  msg += '\nDigite:\n- A: para adicionar nova tarefa\n- M<n>: marcar/desmarcar tarefa n\n- D<n>: deletar tarefa n\n- E<n>: editar emoji da tarefa n\n- C: cancelar';
  const resp = window.prompt(msg);
  if (!resp) return;
  const cmd = resp.trim();
  if (cmd.toUpperCase() === 'A'){
    const text = window.prompt('Texto da nova tarefa:');
    if (!text) return;
    const emoChoice = window.prompt('Emoji? deixe vazio para nenhum:\n' + emojis.map((e,i)=>`${i+1}. ${e.symbol} ${e.name}`).join('\n'));
    let emo = null; if (emoChoice){ const idx = Number(emoChoice)-1; if (idx>=0 && idx<emojis.length) emo = emojis[idx].symbol; }
    const item = { id: uid('t_'), text, done:false, emotion:emo };
    if (!tasks[iso]) tasks[iso]=[];
    tasks[iso].push(item);
    save(STORAGE.TASKS, tasks);
    renderMonthly(); renderYearly();
    return;
  }
  const m = cmd.match(/^M(\d+)$/i);
  const d = cmd.match(/^D(\d+)$/i);
  const e = cmd.match(/^E(\d+)$/i);
  if (m){
    const idx = Number(m[1])-1; if (tasks[iso] && tasks[iso][idx]){ tasks[iso][idx].done = !tasks[iso][idx].done; save(STORAGE.TASKS, tasks); renderMonthly(); renderYearly(); }
    return;
  }
  if (d){
    const idx = Number(d[1])-1; if (tasks[iso] && tasks[iso][idx]){ tasks[iso].splice(idx,1); save(STORAGE.TASKS, tasks); renderMonthly(); renderYearly(); }
    return;
  }
  if (e){
    const idx = Number(e[1])-1; if (tasks[iso] && tasks[iso][idx]){
      chooseEmoji((emo) => { tasks[iso][idx].emotion = emo.symbol; save(STORAGE.TASKS, tasks); renderMonthly(); renderYearly(); });
    }
    return;
  }
}

// --- Birthdays management -----------------------------------------------
function addBirthday(){
  const name = window.prompt('Nome da pessoa:'); if (!name) return;
  const date = window.prompt('Data no formato MM-DD (ex 03-11):'); if (!date) return;
  const emoChoice = window.prompt('Emoji para mostrar:\n' + emojis.map((e,i)=>`${i+1}. ${e.symbol} ${e.name}`).join('\n'));
  let emo = null; if (emoChoice){ const idx = Number(emoChoice)-1; if (idx>=0 && idx<emojis.length) emo = emojis[idx].symbol; }
  birthdays.push({name, date, emotion: emo});
  save(STORAGE.BIRTHDAYS, birthdays);
  renderYearly();
}

// Expose addBirthday to global so user can call via console or add a button linking to it
window.addBirthday = addBirthday;

// --- Helpers ---------------------------------------------------------------
function todayISO(){ return isoDate(new Date()); }
function isoDate(d){
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function escapeHtml(str){
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// --- Expose some functions for debugging / usage ---------------------------
window.addDaily = addDaily;
window.renderMonthly = renderMonthly;
window.renderYearly = renderYearly;
window.renderDaily = renderDaily;
window.addEmoji = addEmoji;
window.showDayDetails = showDayDetails;

// --- End of file ---------------------------------------------------------


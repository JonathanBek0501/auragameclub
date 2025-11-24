// Computer Club Cashier - LocalStorage driven
const HOURLY_RATE = 10000; // so'm/hour (provided)
const ROOMS_COUNT = 5;
const STORAGE_KEY = 'cc_state_v1';

let state = {
  rooms: [],
  products: [],
  archive: []
};

function initDefaultProducts() {
  if (state.products.length) return;
  state.products = [
    {id: genId(), name: 'Coca-Cola 0.5L', price: 7000},
    {id: genId(), name: 'Chips', price: 5000},
    {id: genId(), name: 'Hot-Dog', price: 12000},
    {id: genId(), name: 'Mineral Water', price: 4000}
  ];
}

function genId(){ return Math.random().toString(36).slice(2,9) }

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { state = JSON.parse(raw); }
    catch(e){ console.warn('bad state, resetting'); }
  }
  // ensure rooms exist
  if (!state.rooms || state.rooms.length !== ROOMS_COUNT) {
    state.rooms = [];
    for (let i=1;i<=ROOMS_COUNT;i++){
      state.rooms.push({
        id: 'room'+i, name: 'Xona '+i, active:false,
        start: null, elapsed: 0, items: [], archived:false
      });
    }
  }
  if (!state.products) state.products = [];
  if (!state.archive) state.archive = [];
  initDefaultProducts();
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render(){
  document.getElementById('hourlyRate').textContent = HOURLY_RATE;
  renderRooms();
  renderProducts();
  renderArchive();
}

function renderRooms(){
  const container = document.getElementById('roomsContainer');
  container.innerHTML = '';
  state.rooms.forEach(room=>{
    const el = document.createElement('div');
    el.className = 'room';
    el.innerHTML = `
      <h3>${room.name}</h3>
      <div class="timer" id="${room.id}-timer">${formatElapsed(room.elapsed)}</div>
      <div>Kompyuter vaqti: <span id="${room.id}-time-price">${calcTimePrice(room.elapsed)}</span> so'm</div>
      <div class="items" id="${room.id}-items">${room.items.length? renderItemsText(room.items): '<em>Maxsulot olinmagan</em>'}</div>
      <div class="controls">
        <button data-act="start" ${room.active? 'disabled':''}>Start</button>
        <button data-act="stop" ${room.active? '':'disabled'}>Stop</button>
        <button data-act="add" ${room.active? '':'disabled'}>Magazin</button>
        <button data-act="end" ${room.items.length||room.elapsed? '':'disabled'}>Tugatish</button>
      </div>
      <div class="total">Jami: <span id="${room.id}-total">${calcRoomTotal(room)}</span> so'm</div>
    `;
    // attach handlers
    el.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click',()=>roomControl(room.id, btn.getAttribute('data-act')));
    });
    container.appendChild(el);
  });
}

function renderItemsText(items){
  return items.map(i=>`${i.qty}× ${i.name} (${i.price} so'm)`).join('<br>');
}

function renderProducts(){
  const el = document.getElementById('productsList');
  el.innerHTML = '';
  state.products.forEach(p=>{
    const d = document.createElement('div');
    d.className = 'prod';
    d.innerHTML = `<span>${p.name} — ${p.price} so'm</span><span><button class="small-btn" data-id="${p.id}">Edit</button> <button class="small-btn" data-del="${p.id}">Del</button></span>`;
    d.querySelector('[data-id]')?.addEventListener('click',()=>editProduct(p.id));
    d.querySelector('[data-del]')?.addEventListener('click',()=>deleteProduct(p.id));
    el.appendChild(d);
  });
}

function renderArchive(){
  const el = document.getElementById('archiveList');
  el.innerHTML = '';
  if (!state.archive.length) {
    el.innerHTML = '<em>Arxivga olingan sessiyalar yo"q</em>';
    return;
  }
  state.archive.slice().reverse().forEach(a=>{
    const d = document.createElement('div');
    d.className = 'archive-item';
    d.innerHTML = `<div>${a.room} — ${new Date(a.end).toLocaleString()}</div><div><strong>${a.total} so'm</strong></div>`;
    el.appendChild(d);
  });
}

function roomControl(roomId, action){
  const room = state.rooms.find(r=>r.id===roomId);
  if (!room) return;
  if (action==='start') {
    room.active = true;
    room.start = Date.now();
    room._interval = setInterval(()=>tick(room), 1000);
  } else if (action==='stop') {
    room.active = false;
    if (room.start) {
      room.elapsed += Date.now() - room.start;
      room.start = null;
    }
    clearInterval(room._interval);
  } else if (action==='add') {
    openAddItemModal(room);
  } else if (action==='end') {
    endSession(room);
  }
  saveState();
  render();
}

function tick(room){
  const now = Date.now();
  const elapsed = room.elapsed + (room.start? (now - room.start) : 0);
  const timerEl = document.getElementById(`${room.id}-timer`);
  if (timerEl) timerEl.textContent = formatElapsed(elapsed);
  const priceEl = document.getElementById(`${room.id}-time-price`);
  if (priceEl) priceEl.textContent = calcTimePrice(elapsed);
  const totalEl = document.getElementById(`${room.id}-total`);
  if (totalEl) totalEl.textContent = calcRoomTotal(room, elapsed);
}

function formatElapsed(ms){
  let s = Math.floor(ms/1000);
  const h = Math.floor(s/3600); s -= h*3600;
  const m = Math.floor(s/60); s -= m*60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function pad(n){ return n.toString().padStart(2,'0') }

function calcTimePrice(elapsedMs){
  const hours = elapsedMs / (1000*60*60);
  return Math.ceil(hours * HOURLY_RATE);
}

function calcRoomTotal(room, elapsedMs=null){
  const elapsed = elapsedMs !== null ? elapsedMs : (room.elapsed + (room.start? (Date.now()-room.start):0));
  const timePrice = calcTimePrice(elapsed);
  const itemsPrice = (room.items||[]).reduce((s,i)=>s + (i.price * i.qty),0);
  return timePrice + itemsPrice;
}

function openAddItemModal(room){
  const modal = document.getElementById('addItemModal');
  modal.classList.remove('hidden');
  document.getElementById('modalRoomName').textContent = room.name;
  const select = document.getElementById('modalProductSelect');
  select.innerHTML = '';
  state.products.forEach(p=>{
    const o = document.createElement('option');
    o.value = p.id; o.textContent = `${p.name} — ${p.price} so'm`;
    select.appendChild(o);
  });
  document.getElementById('modalQty').value = 1;
  // attach add handler
  const addBtn = document.getElementById('modalAddItem');
  function handler(){
    const pid = select.value;
    const qty = parseInt(document.getElementById('modalQty').value) || 1;
    const prod = state.products.find(x=>x.id===pid);
    if (!prod) return;
    room.items.push({id: genId(), name: prod.name, price: prod.price, qty});
    document.getElementById('modalClose').click();
    saveState(); render();
  }
  addBtn.onclick = handler;
  // store current room id
  modal.dataset.roomId = room.id;
}

document.getElementById('modalClose').addEventListener('click',()=> {
  document.getElementById('addItemModal').classList.add('hidden');
  delete document.getElementById('addItemModal').dataset.roomId;
});

// document.getElementById('modalAddItem').addEventListener('click',()=> {
//   const modal = document.getElementById('addItemModal');
//   const roomId = modal.dataset.roomId;
//   const room = state.rooms.find(r=>r.id===roomId);
//   if (!room) return;
//   const pid = document.getElementById('modalProductSelect').value;
//   const qty = parseInt(document.getElementById('modalQty').value) || 1;
//   const prod = state.products.find(x=>x.id===pid);
//   room.items.push({id: genId(), name: prod.name, price: prod.price, qty});
//   modal.classList.add('hidden');
//   saveState(); render();
// });

// End session: archive and reset room
function endSession(room){
  // compute final elapsed (stop)
  if (room.start) {
    room.elapsed += Date.now() - room.start;
    room.start = null;
  }
  room.active = false;
  clearInterval(room._interval);
  const total = calcRoomTotal(room);
  state.archive.push({
    id: genId(), room: room.name, items: room.items, elapsed: room.elapsed, total,
    end: Date.now()
  });
  // reset room
  room.items = [];
  room.elapsed = 0;
  saveState(); render();
}

// Products management
document.getElementById('showProductForm').addEventListener('click',()=>{
  document.getElementById('productForm').classList.remove('hidden');
});
document.getElementById('cancelProduct').addEventListener('click',()=>{
  document.getElementById('productForm').classList.add('hidden');
});
document.getElementById('saveProduct').addEventListener('click',()=>{
  const name = document.getElementById('prodName').value.trim();
  const price = parseInt(document.getElementById('prodPrice').value) || 0;
  if (!name || price<=0) { alert('Enter name and price'); return; }
  state.products.push({id: genId(), name, price});
  document.getElementById('prodName').value=''; document.getElementById('prodPrice').value='';
  document.getElementById('productForm').classList.add('hidden');
  saveState(); render();
});

function editProduct(id){
  const p = state.products.find(x=>x.id===id);
  if (!p) return;
  const n = prompt('Edit name', p.name);
  if (n===null) return;
  const pr = prompt('Edit price', p.price);
  if (pr===null) return;
  p.name = n.trim() || p.name;
  p.price = parseInt(pr) || p.price;
  saveState(); render();
}
function deleteProduct(id){
  if (!confirm('Delete product?')) return;
  state.products = state.products.filter(x=>x.id!==id);
  saveState(); render();
}

// Reset all
document.getElementById('resetAll').addEventListener('click',()=>{
  if (!confirm('Reset everything? This will clear localStorage for this app.')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

// Archive export
document.getElementById('exportCSV').addEventListener('click',()=>{
  if (!state.archive.length) { alert('No archived sessions'); return; }
  const rows = [['room','end','elapsed_seconds','items','total']];
  state.archive.forEach(a=>{
    const itemsText = a.items.map(i=>`${i.qty}×${i.name}`).join('; ');
    rows.push([a.room, new Date(a.end).toLocaleString(), Math.floor(a.elapsed/1000), itemsText, a.total]);
  });
  const csv = rows.map(r=>r.map(c=>`"\${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'archive.csv'; a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('clearArchive').addEventListener('click',()=>{
  if (!confirm('Clear archive?')) return;
  state.archive = []; saveState(); render();
});

// Load and initial render
loadState();
render();

// Start any active timers on load (in case browser was closed while running)
state.rooms.forEach(r=>{
  if (r.start) {
    r._interval = setInterval(()=>tick(r), 1000);
  }
});

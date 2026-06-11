let state = null;

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

async function checkAuth() {
  const res = await fetch('/api/admin/check');
  const data = await res.json();
  if (!data.isAdmin) {
    window.location.href = '/admin/index.html';
  }
}

async function loadProperty() {
  const res = await fetch('/api/property');
  state = await res.json();

  document.getElementById('basePrice').value = state.basePrice;
  document.getElementById('dailyDropPercent').value = state.dailyDropPercent;
  document.getElementById('totalDays').value = state.totalDays;
  document.getElementById('description').value = state.description;

  for (let i = 0; i < 4; i++) {
    document.getElementById('feature' + i).value = state.features[i] || '';
  }

  renderPhotos();
  renderVideo();
  renderCycleInfo();
}

function renderCycleInfo() {
  const launch = new Date(state.launchDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysElapsed = Math.floor((Date.now() - launch.getTime()) / msPerDay);
  const dayNumber = Math.max(1, Math.min(daysElapsed + 1, state.totalDays));
  document.getElementById('cycleInfo').textContent =
    `Publicación iniciada el ${launch.toLocaleDateString('es-AR')} — Día ${dayNumber} de ${state.totalDays}`;
}

function renderPhotos() {
  const grid = document.getElementById('photosGrid');
  grid.innerHTML = '';
  state.photos.forEach((url, idx) => {
    const div = document.createElement('div');
    div.className = 'photo-item';
    div.innerHTML = `<img src="${url}"><button data-idx="${idx}" type="button">&times;</button>`;
    div.querySelector('button').addEventListener('click', () => {
      state.photos.splice(idx, 1);
      renderPhotos();
    });
    grid.appendChild(div);
  });
}

function renderVideo() {
  const el = document.getElementById('videoCurrent');
  el.textContent = state.videoUrl
    ? `Video actual: ${state.videoUrl}`
    : 'Sin video cargado';
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Error subiendo archivo');
  const data = await res.json();
  return data.url;
}

document.getElementById('photoInput').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  for (const file of files) {
    const url = await uploadFile(file);
    state.photos.push(url);
  }
  renderPhotos();
  e.target.value = '';
});

document.getElementById('videoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = await uploadFile(file);
  state.videoUrl = url;
  renderVideo();
  e.target.value = '';
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  const payload = {
    basePrice: Number(document.getElementById('basePrice').value),
    dailyDropPercent: Number(document.getElementById('dailyDropPercent').value),
    totalDays: Number(document.getElementById('totalDays').value),
    description: document.getElementById('description').value,
    features: [0, 1, 2, 3].map(i => document.getElementById('feature' + i).value),
    photos: state.photos,
    videoUrl: state.videoUrl
  };

  const res = await fetch('/api/admin/property', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  state = await res.json();
  showToast('Cambios guardados');
  renderCycleInfo();
});

document.getElementById('restartBtn').addEventListener('click', async () => {
  if (!confirm('Esto reinicia el ciclo a Día 1 de 30. ¿Continuar?')) return;
  const res = await fetch('/api/admin/restart-cycle', { method: 'POST' });
  state = await res.json();
  renderCycleInfo();
  showToast('Ciclo reiniciado');
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/admin/index.html';
});

async function loadLeads() {
  const res = await fetch('/api/admin/leads');
  const leads = await res.json();
  const tbody = document.querySelector('#leadsTable tbody');
  tbody.innerHTML = '';
  leads.forEach(lead => {
    const tr = document.createElement('tr');
    const fecha = new Date(lead.fecha).toLocaleString('es-AR');
    tr.innerHTML = `<td>${lead.nombre}</td><td>${lead.apellido}</td><td>${lead.whatsapp}</td><td>${fecha}</td>`;
    tbody.appendChild(tr);
  });
}

checkAuth().then(() => {
  loadProperty();
  loadLeads();
});

// Datos por defecto (se usan si el backend no está disponible)
const DEFAULT_PROPERTY = {
  basePrice: 350000,
  dailyDropPercent: 2,
  totalDays: 30,
  launchDate: new Date().toISOString(),
  description:
    'Una propiedad única. El valor comienza en un precio publicado y baja cada día hasta que alguien la reserve primero.',
  features: [
    'Una sola propiedad',
    'Precio visible cada día',
    '30 días para decidir',
    'Reserva directa'
  ],
  photos: ['v2-house.jpg'],
  videoUrl: ''
};

let property = DEFAULT_PROPERTY;

function formatPrice(value){
  return 'US$ ' + Math.round(value).toLocaleString('es-AR');
}

function buildSchedule(){
  const { basePrice, dailyDropPercent, totalDays } = property;
  const factor = 1 - (dailyDropPercent / 100);
  const schedule = [];
  for(let d = 0; d < totalDays; d++){
    schedule.push(basePrice * Math.pow(factor, d));
  }
  return schedule;
}

function renderSchedule(currentDay, schedule){
  const list = document.getElementById('scheduleList');
  if(!list) return;
  list.innerHTML = '';
  const totalDays = property.totalDays;

  const highlightDays = [1,2,3,4,5,6];
  if(totalDays > 6) highlightDays.push('...');
  [Math.round(totalDays * 0.66), Math.round(totalDays * 0.83), totalDays].forEach(d => {
    if(d > 6 && !highlightDays.includes(d)) highlightDays.push(d);
  });

  highlightDays.forEach(day => {
    const li = document.createElement('li');
    if(day === '...'){
      li.className = 'ellipsis';
      li.textContent = '⋮';
      list.appendChild(li);
      return;
    }
    li.classList.toggle('active', day === currentDay);
    li.classList.toggle('dim', day !== currentDay);
    li.innerHTML = `<div><span class="day-label">Día ${day}</span><br>${formatPrice(schedule[day-1])}</div>`;
    list.appendChild(li);
  });
}

function updateListing(){
  const launch = new Date(property.launchDate);
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = property.totalDays;

  let daysElapsed = Math.floor((now - launch) / msPerDay);
  daysElapsed = Math.max(0, Math.min(daysElapsed, totalDays - 1));

  const dayNumber = daysElapsed + 1;
  const schedule = buildSchedule();
  const currentPrice = schedule[dayNumber - 1];
  const nextPrice = schedule[Math.min(dayNumber, totalDays - 1)];

  document.getElementById('dayNumber').textContent = dayNumber;
  document.getElementById('currentPrice').textContent = formatPrice(currentPrice);
  document.getElementById('nextPrice').textContent = formatPrice(nextPrice);

  document.getElementById('featurePriceInicial').textContent =
    `Precio inicial: ${formatPrice(schedule[0])}`;
  document.getElementById('featurePriceFinal').textContent =
    `Último precio estimado: ${formatPrice(schedule[totalDays-1])}`;

  renderSchedule(dayNumber, schedule);

  const endOfListing = new Date(launch.getTime() + totalDays * msPerDay);
  updateCountdown(endOfListing);
}

function updateCountdown(targetDate){
  function tick(){
    const now = new Date();
    let diff = targetDate - now;
    if(diff < 0) diff = 0;

    const days = Math.floor(diff / (1000*60*60*24));
    const hours = Math.floor((diff / (1000*60*60)) % 24);
    const minutes = Math.floor((diff / (1000*60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    document.getElementById('cdDays').textContent = String(days).padStart(2,'0');
    document.getElementById('cdHours').textContent = String(hours).padStart(2,'0');
    document.getElementById('cdMinutes').textContent = String(minutes).padStart(2,'0');
    document.getElementById('cdSeconds').textContent = String(seconds).padStart(2,'0');
  }
  tick();
  setInterval(tick, 1000);
}

function renderContent(){
  document.getElementById('description').textContent = property.description;

  for(let i = 0; i < 4; i++){
    const el = document.getElementById('feature' + i);
    if(el && property.features[i]) el.textContent = property.features[i];
  }

  // Galería + foto principal
  const heroImg = document.getElementById('heroImg');
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';

  if(property.photos && property.photos.length){
    heroImg.src = property.photos[0];
    property.photos.forEach((url, idx) => {
      const img = document.createElement('img');
      img.src = url;
      img.alt = `Foto ${idx + 1}`;
      if(idx === 0) img.classList.add('active');
      img.addEventListener('click', () => {
        heroImg.src = url;
        gallery.querySelectorAll('img').forEach(i => i.classList.remove('active'));
        img.classList.add('active');
      });
      gallery.appendChild(img);
    });
  }

  // Video
  const videoSection = document.getElementById('videoSection');
  const video = document.getElementById('propertyVideo');
  if(property.videoUrl){
    video.src = property.videoUrl;
    videoSection.style.display = 'block';
  } else {
    videoSection.style.display = 'none';
  }
}

async function loadProperty(){
  try{
    const res = await fetch('/api/property');
    if(res.ok){
      property = await res.json();
    }
  }catch(err){
    console.warn('No se pudo conectar al backend, usando datos por defecto.', err);
  }
  renderContent();
  updateListing();
}

loadProperty();

// ====== MODAL ======
const modalOverlay = document.getElementById('modalOverlay');
const leadForm = document.getElementById('leadForm');
const modalSuccess = document.getElementById('modalSuccess');

function openModal(){
  modalOverlay.classList.add('open');
  leadForm.style.display = 'flex';
  modalSuccess.classList.remove('show');
}
function closeModal(){
  modalOverlay.classList.remove('open');
}

document.getElementById('openModalBtn').addEventListener('click', openModal);
document.getElementById('openModalBtn2').addEventListener('click', openModal);
document.getElementById('modalClose').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if(e.target === modalOverlay) closeModal();
});

// ====== FORM SUBMIT ======
leadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(leadForm);
  const lead = {
    nombre: formData.get('nombre').trim(),
    apellido: formData.get('apellido').trim(),
    whatsapp: formData.get('whatsapp').trim()
  };

  try{
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    });
  }catch(err){
    console.warn('No se pudo enviar al backend.', err);
  }

  leadForm.reset();
  leadForm.style.display = 'none';
  modalSuccess.classList.add('show');

  setTimeout(closeModal, 2200);
});

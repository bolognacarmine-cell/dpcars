document.addEventListener('DOMContentLoaded', function() {
  // ====== CONFIG ======
  const API_BASE = 'http://192.168.1.188:3001';
  const CACHE_KEY = 'dpcars_vehicles_cache';
  const CACHE_TIMESTAMP_KEY = 'dpcars_vehicles_timestamp';
  const CACHE_MAX_AGE = 1000 * 60 * 60; // 1 ora

  // Stato inventario (ora arriva dal backend)
  let vehicles = [];
  let currentPage = 1;
  const limit = 6;
  let total = 0;
  let isOfflineMode = false;

  const inventoryGrid = document.getElementById('inventory-grid');
  const vehicleTypeFilter = document.getElementById('vehicle-type');
  const sortByFilter = document.getElementById('sort-by');
  const sortByHeaderFilter = document.getElementById('sort-by-header');
  const searchInput = document.getElementById('search-input');
  const loadMoreButton = document.getElementById('load-more');
  const contactForm = document.getElementById('contact-form');

  // ====== CACHE HELPERS ======
  function saveToCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    } catch (e) {
      console.warn('localStorage non disponibile:', e);
    }
  }

  function loadFromCache() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
      
      if (cached && timestamp) {
        const age = Date.now() - parseInt(timestamp);
        if (age < CACHE_MAX_AGE) {
          return JSON.parse(cached);
        }
      }
    } catch (e) {
      console.warn('Errore lettura cache:', e);
    }
    return null;
  }

  // ====== RENDER VEHICLES ======
  function renderVehicles(vehiclesToRender) {
    // Rimuovi banner offline precedente se esiste
    const oldBanner = inventoryGrid.querySelector('.offline-banner');
    if (oldBanner) oldBanner.remove();

    // Mostra banner offline se necessario
    if (isOfflineMode) {
      const banner = document.createElement('div');
      banner.className = 'offline-banner';
      banner.style.cssText = 'grid-column: 1/-1; padding: 1rem; background: #ff9800; color: white; border-radius: 6px; margin-bottom: 1rem; text-align: center; display: flex; align-items: center; justify-content: center; gap: 0.5rem;';
      banner.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>Modalità offline: stai vedendo l'ultimo inventario salvato.</span>
        <button onclick="location.reload()" style="background: white; color: #ff9800; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; font-weight: 600; cursor: pointer; margin-left: 0.5rem;">Ricarica</button>
      `;
      inventoryGrid.appendChild(banner);
    }

    if (vehiclesToRender.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 3rem; color: #666;';
      emptyMsg.innerHTML = '<i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; display: block; opacity: 0.3;"></i>Nessun veicolo trovato. Prova a modificare i filtri.';
      inventoryGrid.appendChild(emptyMsg);
      return;
    }

    vehiclesToRender.forEach(vehicle => {
      const statusClass = `status-${vehicle.status}`;
      const statusText = vehicle.status === 'available' ? 'Disponibile' :
                         vehicle.status === 'reserved' ? 'Prenotata' : 'Venduta';

      const vehicleType = vehicle.type === 'auto' ? 'Auto' : 'Moto';

      // Se le immagini arrivano come "/uploads/xxx.jpg" dal backend, aggiungi base URL
      const firstImg = (vehicle.images && vehicle.images[0]) ? vehicle.images[0] : '';
      const imgSrc = firstImg.startsWith('http') ? firstImg : (firstImg ? `${API_BASE}${firstImg}` : '');

      const card = document.createElement('div');
      card.className = 'vehicle-card';
      card.innerHTML = `
        <div class="vehicle-image-wrapper">
          <img src="${imgSrc}" alt="${vehicle.title}" class="vehicle-image" loading="lazy"
               onerror="this.src='https://via.placeholder.com/640x360?text=${encodeURIComponent(vehicle.title)}'">
          <span class="vehicle-badge">${vehicleType}</span>
          <span class="vehicle-status ${statusClass}">${statusText}</span>
        </div>
        <div class="vehicle-details">
          <h3 class="vehicle-title">${vehicle.title}</h3>
          <div class="vehicle-price">€ ${(Number(vehicle.price) || 0).toLocaleString('it-IT')}</div>
          <div class="vehicle-specs">
            <span class="spec-item">
              <i class="fas fa-calendar"></i> ${vehicle.year || ''}
            </span>
            <span class="spec-item">
              <i class="fas fa-tachometer-alt"></i> ${(Number(vehicle.km) || 0).toLocaleString('it-IT')} km
            </span>
            <span class="spec-item">
              <i class="fas fa-gas-pump"></i> ${vehicle.fuel || ''}
            </span>
            <span class="spec-item">
              <i class="fas fa-cog"></i> ${vehicle.transmission || ''}
            </span>
            <span class="spec-item">
              <i class="fas fa-bolt"></i> ${vehicle.power || ''}
            </span>
            <span class="spec-item">
              <i class="fas fa-info-circle"></i> ${vehicle.type === 'auto' ? 'Auto' : 'Moto'}
            </span>
          </div>
          <div class="vehicle-actions">
            <a href="tel:333330834" class="action-button button-call">
              <i class="fas fa-phone-alt"></i> Chiama
            </a>
            <a href="https://wa.me/333330834?text=Sono%20interessato%20a%20${encodeURIComponent(vehicle.title)}"
               target="_blank" class="action-button button-whatsapp">
              <i class="fab fa-whatsapp"></i> WhatsApp
            </a>
          </div>
        </div>
      `;
      inventoryGrid.appendChild(card);
    });
  }

  // Legge i filtri UI e costruisce la query per il backend
  function buildQuery(page) {
    const typeValue = vehicleTypeFilter.value;           // all/auto/moto
    const sortValue = sortByFilter.value;               // price-asc, ecc.
    const searchValue = searchInput.value.trim();        // testo libero

    const params = new URLSearchParams();
    params.set('type', typeValue || 'all');
    params.set('sort', sortValue || 'price-asc');
    params.set('search', searchValue || '');
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }

  // ====== CARICA DAL BACKEND CON FALLBACK ======
  async function loadVehiclesPage(page, mode = 'replace') {
    // Feedback visivo
    if (inventoryGrid) inventoryGrid.style.opacity = '0.6';
    if (loadMoreButton) loadMoreButton.disabled = true;

    try {
      const url = `${API_BASE}/api/vehicles?${buildQuery(page)}`;
      const res = await fetch(url, { 
        signal: AbortSignal.timeout(5000) // timeout 5 secondi
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();

      total = Number(json.total) || 0;
      const pageData = Array.isArray(json.data) ? json.data : [];

      if (mode === 'append') {
        vehicles = vehicles.concat(pageData);
      } else {
        vehicles = pageData;
      }

      // ✅ SALVA IN CACHE
      saveToCache(vehicles);
      isOfflineMode = false;

      inventoryGrid.innerHTML = ''; // pulisci griglia
      renderVehicles(vehicles);

      // Gestione bottone "Carica altri"
      const loadedCount = vehicles.length;
      const hasMore = loadedCount < total;
      loadMoreButton.style.display = hasMore ? 'inline-flex' : 'none';
      
    } catch (err) {
      console.error('Backend offline o errore rete:', err);
      
      // ✅ FALLBACK: usa cache localStorage
      const cached = loadFromCache();
      
      if (cached && cached.length > 0) {
        vehicles = cached;
        total = cached.length;
        isOfflineMode = true;
        
        inventoryGrid.innerHTML = ''; // pulisci griglia
        renderVehicles(vehicles);
        loadMoreButton.style.display = 'none';
        
      } else {
        // Nessuna cache disponibile
        inventoryGrid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #b71c1c;">
            <i class="fas fa-exclamation-circle" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
            <strong style="font-size: 1.2rem; display: block; margin-bottom: 0.5rem;">Backend non disponibile</strong>
            <p style="color: #666; margin-bottom: 1rem;">Il server è offline e non ci sono veicoli in cache.</p>
            <button onclick="location.reload()" style="background: var(--primary-red); color: white; padding: 0.8rem 1.5rem; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
              <i class="fas fa-sync-alt"></i> Riprova
            </button>
          </div>
        `;
        loadMoreButton.style.display = 'none';
      }
    } finally {
      if (inventoryGrid) inventoryGrid.style.opacity = '1';
      if (loadMoreButton) loadMoreButton.disabled = false;
    }
  }

  // Quando cambi filtro/ricerca/sort: riparti dalla pagina 1
  async function refreshInventoryFromFilters() {
    currentPage = 1;
    await loadVehiclesPage(currentPage, 'replace');
  }

  // Sync sort filters
  function syncSortFilters(value) {
    sortByFilter.value = value;
    sortByHeaderFilter.value = value;
    refreshInventoryFromFilters();
  }

  // ====== EVENT LISTENERS ======
  vehicleTypeFilter.addEventListener('change', refreshInventoryFromFilters);
  sortByFilter.addEventListener('change', (e) => syncSortFilters(e.target.value));
  sortByHeaderFilter.addEventListener('change', (e) => syncSortFilters(e.target.value));

  // Debounce semplice per la ricerca
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refreshInventoryFromFilters, 250);
  });

  loadMoreButton.addEventListener('click', async () => {
    currentPage += 1;
    await loadVehiclesPage(currentPage, 'append');
  });

  // Contact form (demo)
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();

      const name = document.getElementById('form-name').value;
      const email = document.getElementById('form-email').value;
      const phone = document.getElementById('form-phone').value;
      const reason = document.getElementById('form-reason').value;
      const message = document.getElementById('form-message').value;

      console.log({name, email, phone, reason, message});
      alert('Grazie ' + name + '! La tua richiesta è stata inviata. Ti contatteremo al più presto.');
      this.reset();
    });
  }

  // ====== INITIAL LOAD ======
  refreshInventoryFromFilters();
  
  // Sticky header scroll effect (opzionale)
  window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (header) {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
  }, { passive: true });
});

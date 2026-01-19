document.addEventListener('DOMContentLoaded', function() {
  // ====== CONFIG ======
  const API_BASE = 'https://dpcars.onrender.com';
  const CACHE_KEY = 'dpcars_vehicles_cache';
  const CACHE_TIMESTAMP_KEY = 'dpcars_vehicles_timestamp';
  const CACHE_MAX_AGE = 1000 * 60 * 60; // 1 ora


  // Stato inventario
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

  // ====== SVUOTA CACHE (per forzare aggiornamento) ======
  function clearCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    } catch (e) {
      console.warn('Errore svuotamento cache:', e);
    }
  }


  // ====== SLIDER SETUP ======
  function setupSlider(card, images) {
    if (images.length <= 1) return;


    const sliderImages = card.querySelectorAll('.slider-image');
    const dots = card.querySelectorAll('.slider-dot');
    const prevBtn = card.querySelector('.slider-btn.prev');
    const nextBtn = card.querySelector('.slider-btn.next');
    let currentIndex = 0;


    function showImage(index) {
      sliderImages.forEach(img => img.classList.remove('active'));
      dots.forEach(dot => dot.classList.remove('active'));
      
      sliderImages[index].classList.add('active');
      dots[index].classList.add('active');
      currentIndex = index;
    }


    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const newIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
        showImage(newIndex);
      });
    }


    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const newIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
        showImage(newIndex);
      });
    }


    dots.forEach((dot, index) => {
      dot.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showImage(index);
      });
    });


    // Touch/swipe support
    let touchStartX = 0;
    let touchEndX = 0;


    const sliderContainer = card.querySelector('.vehicle-slider');
    
    sliderContainer.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    });


    sliderContainer.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    });


    function handleSwipe() {
      if (touchEndX < touchStartX - 50) {
        const newIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
        showImage(newIndex);
      }
      if (touchEndX > touchStartX + 50) {
        const newIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
        showImage(newIndex);
      }
    }
  }


  // ====== RENDER VEHICLES CON SLIDER ======
  function renderVehicles(vehiclesToRender) {
    const oldBanner = inventoryGrid.querySelector('.offline-banner');
    if (oldBanner) oldBanner.remove();


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


      // Gestione immagini multiple
      const images = (vehicle.images && vehicle.images.length > 0) 
        ? vehicle.images 
        : ['https://via.placeholder.com/640x360?text=' + encodeURIComponent(vehicle.title)];


      // Crea HTML slider
      const sliderHTML = `
        <div class="vehicle-slider">
          <div class="slider-container">
            ${images.map((img, index) => {
              const imgSrc = img.startsWith('http') ? img : `${API_BASE}${img}`;
              return `<img src="${imgSrc}" 
                          alt="${vehicle.title} - Foto ${index + 1}" 
                          class="slider-image ${index === 0 ? 'active' : ''}" 
                          loading="lazy"
                          onerror="this.src='https://via.placeholder.com/640x360?text=${encodeURIComponent(vehicle.title)}'">`;
            }).join('')}
          </div>
          ${images.length > 1 ? `
            <button class="slider-btn prev" aria-label="Foto precedente">
              <i class="fas fa-chevron-left"></i>
            </button>
            <button class="slider-btn next" aria-label="Foto successiva">
              <i class="fas fa-chevron-right"></i>
            </button>
            <div class="slider-dots">
              ${images.map((_, index) => 
                `<span class="slider-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></span>`
              ).join('')}
            </div>
          ` : ''}
          <span class="vehicle-badge">${vehicleType}</span>
          <span class="vehicle-status ${statusClass}">${statusText}</span>
        </div>
      `;


      const card = document.createElement('div');
      card.className = 'vehicle-card';
      card.innerHTML = `
        ${sliderHTML}
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


      // Setup slider dopo aver aggiunto la card al DOM
      if (images.length > 1) {
        setupSlider(card, images);
      }
    });
  }


  function buildQuery(page) {
    const typeValue = vehicleTypeFilter.value;
    const sortValue = sortByFilter.value;
    const searchValue = searchInput.value.trim();


    const params = new URLSearchParams();
    params.set('type', typeValue || 'all');
    params.set('sort', sortValue || 'price-asc');
    params.set('search', searchValue || '');
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }


  async function loadVehiclesPage(page, mode = 'replace') {
    if (inventoryGrid) inventoryGrid.style.opacity = '0.6';
    if (loadMoreButton) loadMoreButton.disabled = true;

    // SVUOTA CACHE per forzare ricarica fresca
    clearCache();


    try {
      const url = `${API_BASE}/api/vehicles?${buildQuery(page)}`;
      const res = await fetch(url, { 
        signal: AbortSignal.timeout(5000),
        cache: 'no-store' // Disabilita cache browser
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


      saveToCache(vehicles);
      isOfflineMode = false;


      inventoryGrid.innerHTML = '';
      renderVehicles(vehicles);


      const loadedCount = vehicles.length;
      const hasMore = loadedCount < total;
      loadMoreButton.style.display = hasMore ? 'inline-flex' : 'none';
      
    } catch (err) {
      console.error('Backend offline o errore rete:', err);
      
      const cached = loadFromCache();
      
      if (cached && cached.length > 0) {
        vehicles = cached;
        total = cached.length;
        isOfflineMode = true;
        
        inventoryGrid.innerHTML = '';
        renderVehicles(vehicles);
        loadMoreButton.style.display = 'none';
        
      } else {
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


  async function refreshInventoryFromFilters() {
    currentPage = 1;
    clearCache(); // Svuota cache prima di ricaricare
    await loadVehiclesPage(currentPage, 'replace');
  }


  function syncSortFilters(value) {
    sortByFilter.value = value;
    sortByHeaderFilter.value = value;
    refreshInventoryFromFilters();
  }


  // ====== EVENT LISTENERS ======
  vehicleTypeFilter.addEventListener('change', refreshInventoryFromFilters);
  sortByFilter.addEventListener('change', (e) => syncSortFilters(e.target.value));
  sortByHeaderFilter.addEventListener('change', (e) => syncSortFilters(e.target.value));


  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refreshInventoryFromFilters, 250);
  });


  loadMoreButton.addEventListener('click', async () => {
    currentPage += 1;
    await loadVehiclesPage(currentPage, 'append');
  });


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

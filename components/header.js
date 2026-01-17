class CustomHeader extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        header {
          background: white;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .logo {
          font-size: 1.5rem;
          font-weight: bold;
          color: #1a365d;
          text-decoration: none;
          display: flex;
          align-items: center;
        }
        .logo-icon {
          color: #4299e1;
          margin-right: 0.5rem;
        }
        nav ul {
          display: flex;
          list-style: none;
          gap: 1.5rem;
        }
        nav a {
          color: #4a5568;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.3s;
        }
        nav a:hover {
          color: #2b6cb0;
        }
        .cta-button {
          background: #4299e1;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 0.25rem;
          transition: background 0.3s;
        }
        .cta-button:hover {
          background: #2b6cb0;
        }
        .mobile-menu-button {
          display: none;
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
        }
        @media (max-width: 768px) {
          .mobile-menu-button {
            display: block;
          }
          nav {
            display: none;
          }
          nav.active {
            display: block;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            padding: 1rem;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          nav.active ul {
            flex-direction: column;
            gap: 1rem;
          }
        }
      </style>
      <header>
        <div class="header-container">
          <a href="/" class="logo">
            <i class="fas fa-car logo-icon"></i>
            DP CARS
          </a>
          
          <button class="mobile-menu-button">
            <i class="fas fa-bars"></i>
          </button>
          
          <nav>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="#inventory">Inventario</a></li>
              <li><a href="#contact">Contatti</a></li>
              <li><a href="#" class="cta-button"><i class="fas fa-phone-alt"></i> Chiamaci</a></li>
            </ul>
          </nav>
        </div>
      </header>
    `;

    const menuButton = this.shadowRoot.querySelector('.mobile-menu-button');
    const nav = this.shadowRoot.querySelector('nav');
    
    menuButton.addEventListener('click', () => {
      nav.classList.toggle('active');
    });
  }
}
customElements.define('custom-header', CustomHeader);
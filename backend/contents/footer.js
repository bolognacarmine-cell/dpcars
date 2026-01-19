class CustomFooter extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        footer {
          background: #1a365d;
          color: white;
          padding: 2rem 0;
        }
        .footer-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1rem;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 2rem;
        }
        .footer-section h3 {
          font-size: 1.25rem;
          margin-bottom: 1rem;
          position: relative;
          padding-bottom: 0.5rem;
        }
        .footer-section h3::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: 0;
          width: 50px;
          height: 2px;
          background: #4299e1;
        }
        .footer-section ul {
          list-style: none;
          padding: 0;
        }
        .footer-section li {
          margin-bottom: 0.5rem;
        }
        .footer-section a {
          color: #cbd5e0;
          text-decoration: none;
          transition: color 0.3s;
        }
        .footer-section a:hover {
          color: white;
        }
        .social-links {
          display: flex;
          gap: 1rem;
          margin-top: 1rem;
        }
        .social-links a {
          color: white;
          background: rgba(255,255,255,0.1);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.3s;
        }
        .social-links a:hover {
          background: #4299e1;
        }
        .copyright {
          text-align: center;
          padding-top: 2rem;
          margin-top: 2rem;
          border-top: 1px solid rgba(255,255,255,0.1);
          color: #cbd5e0;
          font-size: 0.875rem;
        }
      </style>
      <footer>
        <div class="footer-container">
          <div class="footer-section">
            <h3>DP CARS</h3>
            <p>Specializzati nella vendita di auto e moto usate e km 0 a Marcianise e provincia di Caserta.</p>
            <div class="social-links">
              <a href="#"><i class="fab fa-facebook-f"></i></a>
              <a href="#"><i class="fab fa-instagram"></i></a>
              <a href="#"><i class="fab fa-whatsapp"></i></a>
            </div>
          </div>
          <div class="footer-section">
            <h3>Link veloci</h3>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="#inventory">Inventario</a></li>
              <li><a href="#contact">Contatti</a></li>
              <li><a href="#">Finanziamenti</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h3>Contatti</h3>
            <ul>
              <li><i class="fas fa-map-marker-alt mr-2"></i> Via Petrarca 16, Marcianise</li>
              <li><i class="fas fa-phone-alt mr-2"></i> 333 330834</li>
              <li><i class="fas fa-phone-alt mr-2"></i> 338 4550216</li>
              <li><i class="fas fa-envelope mr-2"></i> info@dpcars.it</li>
            </ul>
          </div>
          <div class="footer-section">
            <h3>Orari</h3>
            <ul>
              <li>Lun-Ven: 09:00-19:00</li>
              <li>Sabato: 09:00-13:00</li>
              <li>Domenica: Chiuso</li>
            </ul>
          </div>
        </div>
        <div class="copyright">
          &copy; ${new Date().getFullYear()} DP CARS Srl - P.IVA 12345678901
        </div>
      </footer>
    `;
  }
}
customElements.define('custom-footer', CustomFooter);
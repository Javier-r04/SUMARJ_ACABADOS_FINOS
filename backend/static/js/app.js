// ============================================================================
// SUMARJ - Sistema de Gestión - Frontend Core
// ============================================================================

const App = {
 user: null,
 config: null,
 currentRoute: null,
 views: {}, // se registran desde cada views/*.js

 // ------------------------------------------------------------------------
 // Init
 // ------------------------------------------------------------------------
 async init() {
 try {
 const res = await fetch('/api/auth/me');
 if (!res.ok) {
 window.location.href = '/login';
 return;
 }
 this.user = await res.json();
 } catch (e) {
 window.location.href = '/login';
 return;
 }

 // Cargar configuración
 try {
 const r = await fetch('/api/configuracion');
 this.config = r.ok ? await r.json() : { simbolo_moneda: '$', nombre_negocio: 'SUMARJ' };
 } catch (e) {
 this.config = { simbolo_moneda: '$', nombre_negocio: 'SUMARJ' };
 }

 this.renderUserChip();
 this._setupConnectionListener();
 this._setupMobileMenu();
 this.setupNav();
 this.applyThemeLabel();

 // Routing
 window.addEventListener('hashchange', () => this.handleRoute());
 if (!window.location.hash) {
 window.location.hash = this.user.rol === 'admin' ? '#dashboard' : '#pos';
 } else {
 this.handleRoute();
 }
 },

 renderUserChip() {
 const nombre = this.user.nombre_completo || this.user.nombre_usuario || 'Usuario';
 const inicial = nombre.charAt(0).toUpperCase();

 // Sidebar (desktop)
 document.getElementById('userName').textContent = nombre;
 document.getElementById('userRole').textContent = this.user.rol;
 document.getElementById('userAvatar').textContent = inicial;

 // Topbar móvil
 const mobileName = document.getElementById('mobileUserName');
 const mobileAvatar = document.getElementById('mobileUserAvatar');
 if (mobileName) mobileName.textContent = this.user.nombre_usuario || nombre;
 if (mobileAvatar) mobileAvatar.textContent = inicial;
 },

 _setupMobileMenu() {
 const btn = document.getElementById('mobileMenuBtn');
 const sidebar = document.getElementById('sidebar');
 const overlay = document.getElementById('sidebarOverlay');

 if (!btn || !sidebar || !overlay) return;

 const toggle = () => {
 const isOpen = sidebar.classList.toggle('open');
 overlay.classList.toggle('show', isOpen);
 btn.classList.toggle('active', isOpen);
 };

 const close = () => {
 sidebar.classList.remove('open');
 overlay.classList.remove('show');
 btn.classList.remove('active');
 };

 btn.addEventListener('click', toggle);
 overlay.addEventListener('click', close);

 // Cerrar al hacer clic en un item del menú
 document.querySelectorAll('#sidebarNav .nav-item').forEach((item) => {
 item.addEventListener('click', close);
 });

 // Cerrar al cambiar de ruta (por seguridad)
 window.addEventListener('hashchange', close);
 },

 _setupConnectionListener() {
 // Crear banner de "sin conexión"
 const banner = document.createElement('div');
 banner.id = 'connectionBanner';
 banner.style.cssText = `
 position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
 background: linear-gradient(180deg, #d9534f, #c9302c);
 color: white; padding: 10px 20px;
 text-align: center; font-size: 13px; font-weight: 600;
 letter-spacing: 0.5px; box-shadow: 0 2px 12px rgba(0,0,0,0.3);
 transform: translateY(-100%); transition: transform 0.3s ease;
 `;
 banner.innerHTML = ' Sin conexión — verifica tu WiFi';
 document.body.appendChild(banner);

 const actualizar = () => {
 if (navigator.onLine) {
 banner.style.transform = 'translateY(-100%)';
 } else {
 banner.style.transform = 'translateY(0)';
 }
 };

 window.addEventListener('online', () => {
 actualizar();
 this.toast('Conexión restablecida', 'success');
 });
 window.addEventListener('offline', () => {
 actualizar();
 this.toast('Sin conexión a internet', 'warning');
 });
 actualizar();
 },

 setupNav() {
 const nav = document.getElementById('sidebarNav');
 const isAdmin = this.user.rol === 'admin';
 nav.querySelectorAll('.nav-item').forEach((item) => {
 const role = item.dataset.role;
 if (role === 'admin' && !isAdmin) {
 item.style.display = 'none';
 }
 item.addEventListener('click', () => {
 window.location.hash = '#' + item.dataset.route;
 });
 });

 // Ocultar las secciones (títulos como "Menú Principal", "Analítica")
 // que ya no tienen items visibles debajo
 if (!isAdmin) {
 nav.querySelectorAll('.sidebar-section').forEach((section) => {
 let next = section.nextElementSibling;
 let tieneVisible = false;
 while (next && !next.classList.contains('sidebar-section')) {
 if (next.classList.contains('nav-item') && next.style.display !== 'none') {
 tieneVisible = true;
 break;
 }
 next = next.nextElementSibling;
 }
 if (!tieneVisible) section.style.display = 'none';
 });
 }
 },

 handleRoute() {
 const route = (window.location.hash || '#dashboard').slice(1) || 'dashboard';
 const isAdmin = this.user.rol === 'admin';
 const allowedForVendor = ['pos'];

 if (!isAdmin && !allowedForVendor.includes(route)) {
 window.location.hash = '#pos';
 return;
 }

 // Marcar nav activo
 document.querySelectorAll('.nav-item').forEach((item) => {
 item.classList.toggle('active', item.dataset.route === route);
 });

 this.currentRoute = route;
 const view = this.views[route];
 const main = document.getElementById('mainContent');
 if (!view) {
 main.innerHTML = `<div class="empty-state"><div class="icon"></div><p>Vista no encontrada</p></div>`;
 return;
 }
 view.render(main);
 },

 async logout() {
 await fetch('/api/auth/logout', { method: 'POST' });
 window.location.href = '/login';
 },

 // ------------------------------------------------------------------------
 // Tema (claro/oscuro)
 // ------------------------------------------------------------------------
 toggleTheme() {
 const current = document.documentElement.getAttribute('data-theme') || 'light';
 const next = current === 'dark' ? 'light' : 'dark';
 if (next === 'dark') {
 document.documentElement.setAttribute('data-theme', 'dark');
 } else {
 document.documentElement.removeAttribute('data-theme');
 }
 localStorage.setItem('sumarj_theme', next);
 this.applyThemeLabel();

 // Si hay gráficos en la vista actual, re-renderizar para que tomen los colores
 if (this.currentRoute === 'dashboard' && this.views.dashboard) {
 this.views.dashboard.refresh();
 }
 },

 applyThemeLabel() {
 const btn = document.getElementById('themeToggle');
 if (!btn) return;
 const current = document.documentElement.getAttribute('data-theme') || 'light';
 btn.innerHTML = current === 'dark' ? ' Modo Claro' : ' Modo Oscuro';
 },

 // ------------------------------------------------------------------------
 // API client
 // ------------------------------------------------------------------------
 async api(url, options = {}) {
 const opts = {
 credentials: 'include',
 headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
 ...options,
 };
 if (opts.body && typeof opts.body !== 'string') {
 opts.body = JSON.stringify(opts.body);
 }
 const res = await fetch(url, opts);
 if (res.status === 401) {
 window.location.href = '/login';
 throw new Error('No autorizado');
 }
 if (!res.ok) {
 let detail = 'Error de servidor';
 try {
 const data = await res.json();
 detail = data.detail || JSON.stringify(data);
 } catch (e) {}
 throw new Error(detail);
 }
 if (res.status === 204) return null;
 return await res.json();
 },

 // ------------------------------------------------------------------------
 // Helpers
 // ------------------------------------------------------------------------
 // Versión HTML para mostrar en pantalla (símbolo formateado aparte)
 fmtMoney(value) {
 const symbol = (this.config && this.config.simbolo_moneda) || '$';
 const num = Number(value || 0);
 const formatted = num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
 return `<span class="currency-symbol">${symbol}</span>${formatted}`;
 },

 // Versión sin HTML para PDFs y contextos donde no se renderiza HTML
 fmtMoneyPlain(value) {
 const symbol = (this.config && this.config.simbolo_moneda) || '$';
 const num = Number(value || 0);
 const formatted = num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
 return symbol + formatted;
 },

 // Alias por compatibilidad
 fmtMoneyHtml(value) {
 return this.fmtMoney(value);
 },

 fmtNumber(value) {
 return Number(value || 0).toLocaleString('es-MX');
 },

 // Convierte el string ISO del backend (sin zona) en Date asumiendo UTC,
 // de modo que toLocaleString lo muestre en la hora local del usuario.
 _toLocalDate(dateStr) {
 if (!dateStr) return null;
 // Si ya viene con zona (Z o ±HH:MM), úsalo tal cual
 if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(dateStr)) return new Date(dateStr);
 // Si no, agrega Z para interpretarlo como UTC
 return new Date(dateStr + 'Z');
 },

 fmtDate(dateStr) {
 if (!dateStr) return '—';
 const d = this._toLocalDate(dateStr);
 return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
 ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
 },

 fmtDateShort(dateStr) {
 if (!dateStr) return '—';
 const d = this._toLocalDate(dateStr);
 return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
 },

 escape(str) {
 if (str == null) return '';
 return String(str)
 .replace(/&/g, '&amp;')
 .replace(/</g, '&lt;')
 .replace(/>/g, '&gt;')
 .replace(/"/g, '&quot;')
 .replace(/'/g, '&#039;');
 },

 /**
 * Genera HTML para un input de contraseña con ojo para mostrar/ocultar.
 * @param {string} id - id del input
 * @param {object} opts - { placeholder, minlength }
 */
 passwordInput(id, opts = {}) {
 const ph = opts.placeholder || '';
 const minlen = opts.minlength ? `minlength="${opts.minlength}"` : '';
 return `
 <div class="password-wrapper">
 <input class="form-input" id="${id}" type="password"
 placeholder="${this.escape(ph)}" ${minlen}>
 <button type="button" class="password-toggle" aria-label="Mostrar contraseña"
 onclick="App.togglePassword(this, '${id}')">
 <svg class="eye-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
 <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
 <circle cx="12" cy="12" r="3"/>
 </svg>
 <svg class="eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
 <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
 <line x1="1" y1="1" x2="23" y2="23"/>
 </svg>
 </button>
 </div>
 `;
 },

 togglePassword(btn, inputId) {
 const input = document.getElementById(inputId);
 if (!input) return;
 if (input.type === 'password') {
 input.type = 'text';
 btn.classList.add('visible');
 btn.setAttribute('aria-label', 'Ocultar contraseña');
 } else {
 input.type = 'password';
 btn.classList.remove('visible');
 btn.setAttribute('aria-label', 'Mostrar contraseña');
 }
 },

 // ------------------------------------------------------------------------
 // Modales
 // ------------------------------------------------------------------------
 openModal({ title, body, footer, size = 'md' }) {
 document.getElementById('modalTitle').textContent = title || '';
 document.getElementById('modalBody').innerHTML = body || '';
 document.getElementById('modalFooter').innerHTML = footer || '';
 document.getElementById('modalContent').classList.toggle('modal-lg', size === 'lg');
 document.getElementById('modal').classList.add('active');
 },

 closeModal() {
 document.getElementById('modal').classList.remove('active');
 },

 confirm({ title = 'Confirmar', message, confirmText = 'Confirmar', danger = false }) {
 return new Promise((resolve) => {
 this.openModal({
 title,
 body: `<p style="color: var(--text-secondary); line-height: 1.6;">${this.escape(message)}</p>`,
 footer: `
 <button class="btn btn-ghost" id="confirmCancel">Cancelar</button>
 <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmOk">
 ${this.escape(confirmText)}
 </button>
 `,
 });
 document.getElementById('confirmCancel').onclick = () => { this.closeModal(); resolve(false); };
 document.getElementById('confirmOk').onclick = () => { this.closeModal(); resolve(true); };
 });
 },

 // ------------------------------------------------------------------------
 // Toasts
 // ------------------------------------------------------------------------
 toast(message, type = 'info') {
 const container = document.getElementById('toastContainer');
 const el = document.createElement('div');
 el.className = `toast ${type}`;
 el.textContent = message;
 container.appendChild(el);
 setTimeout(() => {
 el.style.opacity = '0';
 el.style.transition = 'opacity 0.3s';
 setTimeout(() => el.remove(), 300);
 }, 3500);
 },

 // ------------------------------------------------------------------------
 // Render helpers
 // ------------------------------------------------------------------------
 pageHeader(title, subtitle, actions = '') {
 return `
 <div class="page-header">
 <div>
 <h1 class="page-title">${this.escape(title)}</h1>
 <p class="page-subtitle">${this.escape(subtitle)}</p>
 </div>
 <div class="page-actions">${actions}</div>
 </div>
 `;
 },

 // ------------------------------------------------------------------------
 // Ticket / impresión
 // ------------------------------------------------------------------------
 async showTicketVenta(venta) {
 const cfg = this.config || {};
 const fecha = this._toLocalDate(venta.fecha);
 const itemsHTML = (venta.detalles || []).map((d) => `
 <tr>
 <td>${d.cantidad}</td>
 <td>${this.escape(d.nombre)}</td>
 <td class="right">${this.fmtMoney(d.precio_unitario)}</td>
 <td class="right">${this.fmtMoney(d.subtotal)}</td>
 </tr>
 `).join('');

 const body = `
 <div class="printable">
 <div class="ticket">
 <h2>${this.escape(cfg.nombre_negocio || 'SUMARJ')}</h2>
 
 <div class="ticket-info">
 ${cfg.direccion ? `<div>${this.escape(cfg.direccion)}</div>` : ''}
 ${cfg.telefono ? `<div>Tel: ${this.escape(cfg.telefono)}</div>` : ''}
 </div>
 <div class="ticket-divider"></div>
 <div style="font-size: 12px; text-align: center;">
 <div><strong>TICKET DE VENTA</strong></div>
 <div>Folio: ${this.escape(venta.folio)}</div>
 <div>Fecha: ${fecha.toLocaleString('es-MX')}</div>
 ${venta.cliente && venta.cliente.trim() ? `<div>Cliente: ${this.escape(venta.cliente)}</div>` : ''}
 </div>
 <div class="ticket-divider"></div>
 <table class="ticket-items">
 <thead>
 <tr>
 <th style="width:28px;">Cant.</th>
 <th>Producto</th>
 <th class="right">P.Unit.</th>
 <th class="right">Total</th>
 </tr>
 </thead>
 <tbody>${itemsHTML}</tbody>
 </table>
 <div class="ticket-total">
 <span>TOTAL:</span>
 <span>${this.fmtMoney(venta.total)}</span>
 </div>
 <div class="ticket-footer">
 ¡Gracias por su compra!
 </div>
 </div>
 </div>
 `;

 this.openModal({
 title: 'Ticket de Venta',
 body,
 footer: `
 <button class="btn btn-ghost" onclick="App.closeModal()">Cerrar</button>
 <button class="btn btn-primary" onclick="window.print()">Imprimir</button>
 `,
 size: 'md',
 });
 },

 async showCotizacionDoc(cot) {
 const cfg = this.config || {};
 const fecha = this._toLocalDate(cot.fecha);
 const vence = new Date(fecha);
 vence.setDate(vence.getDate() + (cot.vigencia_dias || 15));
 const itemsHTML = (cot.detalles || []).map((d) => `
 <tr>
 <td style="text-align:center;">${d.cantidad}</td>
 <td>${this.escape(d.nombre)}</td>
 <td class="right">${this.fmtMoney(d.precio_unitario)}</td>
 <td class="right">${this.fmtMoney(d.subtotal)}</td>
 </tr>
 `).join('');

 const body = `
 <div class="printable">
 <div class="ticket" style="width: 540px;">
 <h2>${this.escape(cfg.nombre_negocio || 'SUMARJ')}</h2>
 
 <div class="ticket-info">
 ${cfg.direccion ? `<div>${this.escape(cfg.direccion)}</div>` : ''}
 ${cfg.telefono ? `<div>Tel: ${this.escape(cfg.telefono)}</div>` : ''}
 ${cfg.correo ? `<div>${this.escape(cfg.correo)}</div>` : ''}
 </div>
 <div class="ticket-divider"></div>
 <div style="font-size: 13px; text-align: center; margin-bottom: 8px;">
 <div style="font-size: 16px; font-weight: bold; letter-spacing: 0.1em;">COTIZACIÓN</div>
 </div>
 <div style="font-size: 12px; margin-bottom: 8px;">
 <div><strong>Folio:</strong> ${this.escape(cot.folio)}</div>
 <div><strong>Fecha:</strong> ${fecha.toLocaleDateString('es-MX')}</div>
 <div><strong>Válida hasta:</strong> ${vence.toLocaleDateString('es-MX')} (${cot.vigencia_dias} días)</div>
 <div><strong>Cliente:</strong> ${this.escape(cot.cliente)}</div>
 ${cot.cliente_telefono ? `<div><strong>Teléfono:</strong> ${this.escape(cot.cliente_telefono)}</div>` : ''}
 ${cot.cliente_correo ? `<div><strong>Correo:</strong> ${this.escape(cot.cliente_correo)}</div>` : ''}
 </div>
 <div class="ticket-divider"></div>
 <table class="ticket-items">
 <thead>
 <tr>
 <th style="width:40px; text-align:center;">Cant.</th>
 <th>Descripción</th>
 <th class="right">P. Unit.</th>
 <th class="right">Subtotal</th>
 </tr>
 </thead>
 <tbody>${itemsHTML}</tbody>
 </table>
 <div class="ticket-total">
 <span>TOTAL:</span>
 <span>${this.fmtMoney(cot.total)}</span>
 </div>
 ${cot.notas ? `
 <div class="ticket-divider"></div>
 <div style="font-size: 11px;">
 <strong>NOTAS:</strong> ${this.escape(cot.notas)}
 </div>` : ''}
 <div class="ticket-footer">
 Esta cotización está sujeta a disponibilidad de inventario.<br>
 Los precios pueden variar después de la fecha de vigencia.
 </div>
 </div>
 </div>
 `;

 this.openModal({
 title: 'Cotización ' + cot.folio,
 body,
 footer: `
 <button class="btn btn-ghost" onclick="App.closeModal()">Cerrar</button>
 <button class="btn btn-primary" onclick="window.print()">Imprimir</button>
 `,
 size: 'lg',
 });
 },

 // ------------------------------------------------------------------------
 // Helper: cargar el logo como data URL para incrustarlo en el PDF
 // ------------------------------------------------------------------------
 async _cargarLogo() {
 if (this._logoDataURL) return this._logoDataURL;
 try {
 const res = await fetch('/static/img/logo.png');
 const blob = await res.blob();
 this._logoDataURL = await new Promise((resolve, reject) => {
 const reader = new FileReader();
 reader.onloadend = () => resolve(reader.result);
 reader.onerror = reject;
 reader.readAsDataURL(blob);
 });
 return this._logoDataURL;
 } catch (e) {
 return null;
 }
 },

 // ------------------------------------------------------------------------
 // PDF de COTIZACIÓN — formato carta corporativo con logo y tabla
 // ------------------------------------------------------------------------
 async generarPDFCotizacion(cot) {
 const { jsPDF } = window.jspdf;
 const cfg = this.config || {};
 const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
 const pageW = doc.internal.pageSize.getWidth(); // ~215.9 mm
 const pageH = doc.internal.pageSize.getHeight(); // ~279.4 mm
 const fechaDoc = this._toLocalDate(cot.fecha);

 // ====================================================================
 // ENCABEZADO NEGRO CON LOGO Y DATOS
 // ====================================================================
 const headerH = 55;
 doc.setFillColor(0, 0, 0);
 doc.rect(0, 0, pageW, headerH, 'F');

 // Logo (lado izquierdo)
 const logo = await this._cargarLogo();
 if (logo) {
 try {
 doc.addImage(logo, 'PNG', 12, 8, 38, 38);
 } catch (e) {
 // si falla el logo, seguimos sin él
 }
 }

 // Nombre del negocio (lado derecho del logo)
 doc.setTextColor(255, 255, 255);
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(20);
 const nombreNegocio = (cfg.nombre_negocio || 'SUMARJ Acabados Finos').toUpperCase();
 doc.text(nombreNegocio, 55, 18);

 // Dirección / teléfono / correo
 doc.setFont('helvetica', 'normal');
 doc.setFontSize(9);
 doc.setTextColor(230, 230, 230);

 let yInfo = 26;
 if (cfg.direccion) {
 doc.text(cfg.direccion, 55, yInfo);
 yInfo += 5;
 }
 if (cfg.telefono) {
 doc.text('Tel: ' + cfg.telefono, 55, yInfo);
 yInfo += 5;
 }
 if (cfg.correo) {
 doc.text(cfg.correo, 55, yInfo);
 yInfo += 5;
 }

 // Caja de Fecha (esquina superior derecha)
 const fechaBoxX = pageW - 50;
 const fechaBoxY = 10;
 doc.setTextColor(255, 255, 255);
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(11);
 doc.text('Fecha', fechaBoxX, fechaBoxY + 4);

 // Línea blanca debajo del título
 doc.setDrawColor(255, 255, 255);
 doc.setLineWidth(0.3);
 doc.line(fechaBoxX, fechaBoxY + 6, fechaBoxX + 35, fechaBoxY + 6);

 doc.setFont('helvetica', 'normal');
 doc.setFontSize(10);
 doc.setTextColor(255, 255, 255);
 doc.text(fechaDoc.toLocaleDateString('es-MX'), fechaBoxX, fechaBoxY + 12);

 // Línea blanca debajo de la fecha
 doc.line(fechaBoxX, fechaBoxY + 14, fechaBoxX + 35, fechaBoxY + 14);

 // ====================================================================
 // SECCIÓN CLIENTE
 // ====================================================================
 let y = headerH + 18;
 doc.setTextColor(50, 50, 120);
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(11);
 doc.text('Cliente', 14, y);
 doc.setDrawColor(120, 120, 150);
 doc.setLineWidth(0.3);
 doc.line(14, y + 2, 100, y + 2);

 y += 9;
 doc.setTextColor(50, 50, 50);
 doc.setFont('helvetica', 'normal');
 doc.setFontSize(11);
 doc.text(cot.cliente || '—', 14, y);

 // Datos adicionales del cliente (si hay)
 if (cot.cliente_telefono || cot.cliente_correo) {
 y += 5;
 doc.setFontSize(9);
 doc.setTextColor(100, 100, 100);
 const extras = [cot.cliente_telefono, cot.cliente_correo].filter(Boolean).join(' ');
 doc.text(extras, 14, y);
 }

 // ====================================================================
 // TABLA DE PRODUCTOS
 // ====================================================================
 y += 14;

 // Construir filas (mínimo 15 para tener apariencia tabular como el ejemplo)
 const filasReales = (cot.detalles || []).map(d => [
 String(d.cantidad),
 d.nombre,
 Number(d.precio_unitario).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
 Number(d.subtotal).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
 ]);

 // Filas vacías para llenar la tabla
 const MIN_FILAS = Math.max(10, filasReales.length);
 const filasVacias = [];
 for (let i = filasReales.length; i < MIN_FILAS; i++) {
 filasVacias.push(['', '', '', '0.00']);
 }
 const todasFilas = [...filasReales, ...filasVacias];

 doc.autoTable({
 startY: y,
 head: [['CANT.', 'DESCRIPCIÓN', 'P. UNITARIO', 'TOTAL']],
 body: todasFilas,
 styles: {
 fontSize: 9,
 cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
 textColor: [40, 40, 40],
 lineColor: [180, 180, 180],
 lineWidth: 0.1,
 minCellHeight: 7,
 },
 headStyles: {
 fillColor: [40, 40, 40],
 textColor: [255, 255, 255],
 fontStyle: 'bold',
 fontSize: 10,
 halign: 'center',
 lineWidth: 0,
 },
 alternateRowStyles: { fillColor: [240, 240, 240] },
 columnStyles: {
 0: { cellWidth: 22, halign: 'center' },
 1: { cellWidth: 'auto' },
 2: { cellWidth: 35, halign: 'right' },
 3: { cellWidth: 35, halign: 'right' },
 },
 margin: { left: 14, right: 14, bottom: 25 }, // 25mm de reserva al fondo
 });

 // ====================================================================
 // RESUMEN: Total parcial, DESCUENTO, NETO, Total
 // ====================================================================
 let yT = doc.lastAutoTable.finalY + 2;

 // Si no cabe el bloque de totales (~50mm) en la página actual,
 // forzar página nueva
 const espacioRequerido = 55; // total + descuento + neto + total amarillo + pie
 if (yT + espacioRequerido > pageH - 12) {
 doc.addPage();
 yT = 20;
 }

 const labelX = pageW - 80; // columna de etiquetas
 const valueX = pageW - 14; // alineación derecha de valores
 const rowH = 7;

 // Total parcial = SUBTOTAL antes de descuento
 const subtotal = Number(cot.subtotal || cot.total);
 const descuentoPct = Number(cot.descuento_porcentaje || 0);
 const descuentoMonto = Number(cot.descuento_monto || 0);
 const totalNeto = Number(cot.total);

 doc.setFillColor(255, 255, 255);
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(10);
 doc.setTextColor(50, 50, 50);
 doc.text('Total parcial', labelX, yT + 5);
 doc.text(
 subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
 valueX, yT + 5, { align: 'right' }
 );
 doc.setDrawColor(180, 180, 180);
 doc.line(labelX - 2, yT + rowH, valueX, yT + rowH);
 yT += rowH;

 // DESCUENTO
 doc.setFillColor(245, 245, 245);
 doc.rect(labelX - 2, yT, pageW - 14 - (labelX - 2), rowH, 'F');
 doc.setFont('helvetica', 'bold');
 doc.text('DESCUENTO', labelX, yT + 5);
 doc.setFont('helvetica', 'normal');
 doc.text(
 descuentoMonto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
 valueX, yT + 5, { align: 'right' }
 );
 doc.line(labelX - 2, yT + rowH, valueX, yT + rowH);
 yT += rowH;

 // NETO
 doc.setFont('helvetica', 'bold');
 doc.text('NETO', labelX, yT + 5);
 doc.text(
 totalNeto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
 valueX, yT + 5, { align: 'right' }
 );
 doc.line(labelX - 2, yT + rowH, valueX, yT + rowH);
 yT += rowH + 2;

 // TOTAL en amarillo destacado (más alto para que no se corte)
 const totalBoxH = 14;
 doc.setFillColor(255, 240, 0);
 doc.rect(labelX - 2, yT, pageW - 14 - (labelX - 2), totalBoxH, 'F');
 doc.setTextColor(0, 0, 0);
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(12);
 doc.text('Total', labelX, yT + 9);
 doc.setFontSize(14);
 doc.text(
 totalNeto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
 valueX, yT + 9, { align: 'right' }
 );
 yT += totalBoxH;

 // ====================================================================
 // PIE DE PÁGINA — posicionado debajo del total, con margen
 // ====================================================================
 const espacioMin = 30; // espacio mínimo para no encimarse
 let pieY = yT + 18;
 if (pieY > pageH - 14) {
 pieY = pageH - 14;
 }
 doc.setTextColor(60, 60, 60);
 doc.setFont('helvetica', 'normal');
 doc.setFontSize(10);
 doc.text('GRACIAS POR SU PREFERENCIA!!', pageW / 2, pieY, { align: 'center' });

 // Barra negra al fondo (siempre al fondo, en todas las páginas)
 const totalPaginas = doc.internal.getNumberOfPages();
 for (let p = 1; p <= totalPaginas; p++) {
 doc.setPage(p);
 doc.setFillColor(0, 0, 0);
 doc.rect(0, pageH - 10, pageW, 10, 'F');

 // Número de página solo si hay más de 1
 if (totalPaginas > 1) {
 doc.setTextColor(255, 255, 255);
 doc.setFont('helvetica', 'normal');
 doc.setFontSize(8);
 doc.text(`Página ${p} de ${totalPaginas}`, pageW - 14, pageH - 4, { align: 'right' });
 }
 }

 // ====================================================================
 // GUARDAR
 // ====================================================================
 const filename = `cotizacion_${cot.folio}.pdf`;
 const blob = doc.output('blob');
 const url = URL.createObjectURL(blob);
 window.open(url, '_blank');
 setTimeout(() => URL.revokeObjectURL(url), 60000);
 doc.save(filename);
 App.toast('PDF generado: ' + filename, 'success');
 },

 // ------------------------------------------------------------------------
 // Generador genérico de PDF para ventas y cotizaciones (formato TICKET)
 // ------------------------------------------------------------------------
 generarPDFDocumento({ tipo, folio, cliente, cliente_telefono, cliente_correo, fecha, vigencia_dias, detalles, total, filename, pieMensaje }) {
 const { jsPDF } = window.jspdf;
 const cfg = this.config || {};

 // Ticket ancho: 100mm para que entre bien todo el contenido
 const ancho = 100;
 const itemsCount = (detalles || []).length;

 // Estimar líneas extra por nombres largos (aprox.)
 // ~22 caracteres por línea con la fuente y tamaño actuales
 let lineasExtras = 0;
 (detalles || []).forEach(d => {
 const chars = (d.nombre || '').length;
 if (chars > 22) lineasExtras += Math.ceil(chars / 22) - 1;
 });

 const altura = 80
 + itemsCount * 6
 + lineasExtras * 4
 + (pieMensaje ? 18 : 0)
 + (cliente_telefono ? 5 : 0)
 + (cliente_correo ? 5 : 0)
 + (vigencia_dias ? 5 : 0);

 const doc = new jsPDF({
 orientation: 'portrait',
 unit: 'mm',
 format: [ancho, altura],
 });

 const margen = 5;
 const cx = ancho / 2; // centro horizontal
 let y = 9;

 // ====================================================================
 // ENCABEZADO: nombre del negocio
 // ====================================================================
 // Auto-ajustar tamaño de fuente para que el nombre quepa
 const nombreNeg = (cfg.nombre_negocio || 'SUMARJ Acabados Finos').toUpperCase();
 doc.setFont('helvetica', 'bold');

 // Probar varios tamaños hasta encontrar uno que quepa
 let fontSize = 14;
 doc.setFontSize(fontSize);
 let textW = doc.getTextWidth(nombreNeg);
 const maxAncho = ancho - margen * 2;
 while (textW > maxAncho && fontSize > 8) {
 fontSize -= 0.5;
 doc.setFontSize(fontSize);
 textW = doc.getTextWidth(nombreNeg);
 }
 doc.setTextColor(0, 0, 0);
 doc.text(nombreNeg, cx, y, { align: 'center' });
 y += 5;

 // ====================================================================
 // INFO DEL NEGOCIO
 // ====================================================================
 doc.setFont('helvetica', 'normal');
 doc.setFontSize(8);
 doc.setTextColor(80, 80, 80);

 if (cfg.telefono) {
 doc.text('Tel: ' + cfg.telefono, cx, y, { align: 'center' });
 y += 3.5;
 }
 if (cfg.correo) {
 doc.text(cfg.correo, cx, y, { align: 'center' });
 y += 3.5;
 }
 if (cfg.direccion) {
 const lineas = doc.splitTextToSize(cfg.direccion, ancho - margen * 2);
 doc.text(lineas, cx, y, { align: 'center' });
 y += 3.5 * lineas.length;
 }

 // ====================================================================
 // DIVISOR PUNTEADO
 // ====================================================================
 y += 2;
 this._dashedLine(doc, margen, y, ancho - margen, y);
 y += 5;

 // ====================================================================
 // TÍTULO DEL DOCUMENTO
 // ====================================================================
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(10);
 doc.setTextColor(0, 0, 0);
 doc.text(tipo, cx, y, { align: 'center' });
 y += 5;

 // ====================================================================
 // DATOS: folio, fecha, cliente
 // ====================================================================
 doc.setFont('helvetica', 'normal');
 doc.setFontSize(8);
 doc.text('Folio: ' + folio, cx, y, { align: 'center' });
 y += 4;

 const fechaDoc = App._toLocalDate(fecha);
 doc.text('Fecha: ' + fechaDoc.toLocaleString('es-MX'), cx, y, { align: 'center' });
 y += 4;

 const clienteVisible = cliente && cliente.trim();
 if (clienteVisible) {
 doc.text('Cliente: ' + cliente, cx, y, { align: 'center' });
 y += 4;
 }
 if (cliente_telefono) {
 doc.text('Tel: ' + cliente_telefono, cx, y, { align: 'center' });
 y += 4;
 }
 if (cliente_correo) {
 doc.text(cliente_correo, cx, y, { align: 'center' });
 y += 4;
 }
 if (vigencia_dias) {
 const vence = new Date(fechaDoc);
 vence.setDate(vence.getDate() + vigencia_dias);
 doc.text('Vigencia: ' + vence.toLocaleDateString('es-MX'), cx, y, { align: 'center' });
 y += 4;
 }

 // ====================================================================
 // DIVISOR
 // ====================================================================
 y += 2;
 this._dashedLine(doc, margen, y, ancho - margen, y);
 y += 5;

 // ====================================================================
 // TABLA DE PRODUCTOS
 // Layout (en mm, ancho 100):
 // xCant = 5 → Cantidad (5mm de ancho)
 // xNombre = 12 → Nombre del producto
 // xPUnitR = 72 → P.Unit (alineado derecha)
 // xTotalR = 95 → Total (alineado derecha)
 // ====================================================================
 const xCant = margen;
 const xNombre = 13;
 const xPUnitR = 72;
 const xTotalR = ancho - margen;

 // Encabezado de la tabla
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(7.5);
 doc.setTextColor(60, 60, 60);
 doc.text('Cant.', xCant, y);
 doc.text('Producto', xNombre, y);
 doc.text('P.Unit.', xPUnitR, y, { align: 'right' });
 doc.text('Total', xTotalR, y, { align: 'right' });
 y += 1.5;

 // Línea bajo encabezado
 doc.setDrawColor(120, 120, 120);
 doc.setLineWidth(0.3);
 doc.line(margen, y, ancho - margen, y);
 y += 3.5;

 // Items
 doc.setFont('helvetica', 'normal');
 doc.setFontSize(8);
 doc.setTextColor(0, 0, 0);

 // Ancho disponible para el nombre (con margen de seguridad respecto al P.Unit.)
 // P.Unit. termina alineado a la derecha en xPUnitR=72, así que el texto
 // del nombre puede ir hasta ~xPUnitR - 14mm (espacio para el precio).
 const anchoNombre = xPUnitR - 14 - xNombre;

 (detalles || []).forEach(d => {
 const lineas = doc.splitTextToSize(d.nombre || '', anchoNombre);

 // Primera línea: cantidad, primera línea del nombre, p.unit, total
 doc.text(String(d.cantidad), xCant, y);
 doc.text(lineas[0] || '', xNombre, y);
 doc.text(App.fmtMoneyPlain(d.precio_unitario), xPUnitR, y, { align: 'right' });
 doc.text(App.fmtMoneyPlain(d.subtotal), xTotalR, y, { align: 'right' });

 // Líneas siguientes del nombre (si el producto tiene nombre largo)
 for (let i = 1; i < lineas.length; i++) {
 y += 3.5;
 doc.text(lineas[i], xNombre, y);
 }
 y += 5;
 });

 // ====================================================================
 // TOTAL
 // ====================================================================
 y += 1;
 doc.setLineWidth(0.6);
 doc.setDrawColor(0, 0, 0);
 doc.line(margen, y, ancho - margen, y);
 y += 6;

 doc.setFont('helvetica', 'bold');
 doc.setFontSize(13);
 doc.text('TOTAL:', xCant, y);
 doc.text(App.fmtMoneyPlain(total), xTotalR, y, { align: 'right' });
 y += 7;

 // ====================================================================
 // PIE
 // ====================================================================
 if (pieMensaje) {
 y += 3;
 doc.setFont('helvetica', 'italic');
 doc.setFontSize(8);
 doc.setTextColor(80, 80, 80);
 const lineas = doc.splitTextToSize(pieMensaje, ancho - margen * 2);
 doc.text(lineas, cx, y, { align: 'center' });
 }

 // ====================================================================
 // GUARDAR
 // ====================================================================
 const blob = doc.output('blob');
 const url = URL.createObjectURL(blob);
 window.open(url, '_blank');
 setTimeout(() => URL.revokeObjectURL(url), 60000);
 doc.save(filename);
 App.toast('PDF generado: ' + filename, 'success');
 },

 // Helper: línea punteada (jsPDF no la tiene nativa)
 _dashedLine(doc, x1, y, x2, y2) {
 doc.setDrawColor(150, 150, 150);
 doc.setLineWidth(0.2);
 const dashLen = 1.2;
 const gapLen = 1;
 let x = x1;
 while (x < x2) {
 const x2dash = Math.min(x + dashLen, x2);
 doc.line(x, y, x2dash, y);
 x = x2dash + gapLen;
 }
 },
};

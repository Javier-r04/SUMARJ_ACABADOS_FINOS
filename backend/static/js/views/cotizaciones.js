App.views.cotizaciones = {
 cotizaciones: [],
 productos: [],
 filtroEstado: '',
 busqueda: '',
 nueva: { items: [] },

 async render(container) {
 container.innerHTML = App.pageHeader(
 'Cotizaciones',
 'Propuestas comerciales sin afectar inventario',
 `<button class="btn btn-primary" onclick="App.views.cotizaciones.openNueva()">+ Nueva Cotización</button>`
 ) + `
 <div class="filter-bar" style="grid-template-columns: 1fr auto;">
 <div>
 <div class="form-label">Búsqueda</div>
 <input type="text" class="form-input" id="cotBuscar" placeholder="Folio o cliente…">
 </div>
 <div>
 <div class="form-label">Estado</div>
 <div class="chip-group">
 <button class="chip active" data-estado="">Todas</button>
 <button class="chip" data-estado="pendiente">Pendientes</button>
 <button class="chip" data-estado="aceptada">Aceptadas</button>
 <button class="chip" data-estado="rechazada">Rechazadas</button>
 </div>
 </div>
 </div>

 <div class="table-container">
 <table class="table">
 <thead>
 <tr>
 <th>Folio</th>
 <th>Cliente</th>
 <th>Fecha</th>
 <th class="text-center">Estado</th>
 <th class="text-center">Items</th>
 <th class="text-right">Total</th>
 <th class="text-right">Acciones</th>
 </tr>
 </thead>
 <tbody id="cotTbody">
 <tr class="empty-row"><td colspan="7"><span class="spinner"></span></td></tr>
 </tbody>
 </table>
 </div>
 `;

 document.getElementById('cotBuscar').addEventListener('input', (e) => {
 this.busqueda = e.target.value.trim();
 this.cargar();
 });
 document.querySelectorAll('.chip-group .chip').forEach(chip => {
 chip.addEventListener('click', () => {
 document.querySelectorAll('.chip-group .chip').forEach(c => c.classList.remove('active'));
 chip.classList.add('active');
 this.filtroEstado = chip.dataset.estado;
 this.cargar();
 });
 });

 await this.cargar();
 },

 async cargar() {
 const tbody = document.getElementById('cotTbody');
 try {
 const params = new URLSearchParams();
 if (this.busqueda) params.set('q', this.busqueda);
 if (this.filtroEstado) params.set('estado', this.filtroEstado);
 params.set('tz_offset', String(new Date().getTimezoneOffset()));
 this.cotizaciones = await App.api('/api/cotizaciones?' + params.toString());
 if (this.cotizaciones.length === 0) {
 const esVendedor = App.user && App.user.rol !== 'admin';
 const mensaje = esVendedor
 ? 'Sin cotizaciones creadas hoy'
 : 'Sin cotizaciones';
 tbody.innerHTML = `<tr class="empty-row"><td colspan="7">${mensaje}</td></tr>`;
 return;
 }
 tbody.innerHTML = this.cotizaciones.map(c => {
 const esAdmin = App.user && App.user.rol === 'admin';
 return `
 <tr>
 <td><code style="color: var(--gold);">${App.escape(c.folio)}</code></td>
 <td>
 <div style="font-weight: 600;">${App.escape(c.cliente)}</div>
 <div style="font-size: 11px; color: var(--text-muted);">
 ${[c.cliente_telefono, c.cliente_correo].filter(Boolean).map(App.escape).join(' ')}
 </div>
 </td>
 <td>${App.fmtDate(c.fecha)}</td>
 <td class="text-center">${this.badge(c.estado)}</td>
 <td class="text-center">${c.cantidad_items}</td>
 <td class="text-right" style="color: var(--gold); font-weight: 600;">${App.fmtMoney(c.total)}</td>
 <td>
 <div class="row-actions">
 ${c.estado === 'pendiente' ? `
 <button class="btn btn-icon" title="Aceptar (convierte a venta)" style="color: var(--success);"
 onclick="App.views.cotizaciones.aceptar(${c.id})">✓</button>
 ${esAdmin ? `<button class="btn btn-icon danger" title="Rechazar"
 onclick="App.views.cotizaciones.rechazar(${c.id})">✗</button>` : ''}
 ` : ''}
 <button class="btn btn-icon" title="Ver cotización" onclick="App.views.cotizaciones.ver(${c.id})">👁</button>
 <button class="btn btn-icon" title="Descargar PDF" style="color: var(--gold);" onclick="App.views.cotizaciones.descargarPDF(${c.id})">PDF</button>
 ${esAdmin && c.estado !== 'aceptada' ? `
 <button class="btn btn-icon danger" title="Eliminar"
 onclick="App.views.cotizaciones.eliminar(${c.id})">🗑</button>` : ''
 }
 </div>
 </td>
 </tr>
 `;
 }).join('');
 } catch (e) {
 tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Error: ${App.escape(e.message)}</td></tr>`;
 }
 },

 badge(estado) {
 const map = {
 pendiente: 'badge-warning',
 aceptada: 'badge-success',
 rechazada: 'badge-danger',
 vencida: 'badge-muted',
 };
 return `<span class="badge ${map[estado] || 'badge-muted'}">${estado}</span>`;
 },

 async openNueva() {
 this.nueva = { items: [] };
 try {
 this.productos = await App.api('/api/productos?activo=true');
 } catch (e) {
 App.toast(e.message, 'error');
 return;
 }

 App.openModal({
 title: 'Nueva Cotización',
 size: 'lg',
 body: `
 <div class="form-grid cols-2">
 <div class="form-group">
 <label class="form-label">Cliente *</label>
 <input class="form-input" id="cotCliente" placeholder="Nombre del cliente">
 </div>
 <div class="form-group">
 <label class="form-label">Vigencia (días)</label>
 <input class="form-input" id="cotVigencia" type="number" value="15" min="1">
 </div>
 </div>
 <div class="form-grid cols-2">
 <div class="form-group">
 <label class="form-label">Teléfono</label>
 <input class="form-input" id="cotTel">
 </div>
 <div class="form-group">
 <label class="form-label">Correo</label>
 <input class="form-input" id="cotEmail" type="email">
 </div>
 </div>
 <div class="form-group">
 <label class="form-label">Agregar producto</label>
 <input class="form-input" id="cotBuscarProd" type="text"
 placeholder="Buscar por código o nombre…"
 oninput="App.views.cotizaciones._filtrarProductos()">
 <div id="cotProductoList" class="picker-list" style="margin-top: 8px;"></div>
 </div>

 <div class="section-title mt-3" style="font-size: 16px;">Productos cotizados</div>
 <div class="table-container" style="border: 1px solid var(--border);">
 <table class="table">
 <thead>
 <tr>
 <th>Producto</th>
 <th class="text-center" style="width: 110px;">Cantidad</th>
 <th class="text-right" style="width: 130px;">Precio Unit.</th>
 <th class="text-right" style="width: 130px;">Subtotal</th>
 <th style="width: 50px;"></th>
 </tr>
 </thead>
 <tbody id="cotItemsTbody">
 <tr class="empty-row"><td colspan="5">Sin productos</td></tr>
 </tbody>
 </table>
 </div>

 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 14px; align-items: start;">
 <!-- Columna izquierda: aplicar descuento -->
 <div style="padding: 14px 16px; background: var(--surface-alt); border-radius: var(--radius-sm); border-left: 3px solid var(--gold);">
 <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: 8px; font-weight: 600;">
 Aplicar Descuento
 </div>
 <div style="display: flex; align-items: center; gap: 10px;">
 <input class="form-input" id="cotDescuento" type="number" min="0" max="100" step="0.01"
 value="0" placeholder="0" style="width: 90px; text-align: center; font-weight: 600;"
 oninput="App.views.cotizaciones._recalcularTotal()">
 <span style="font-size: 16px; font-weight: 600; color: var(--text-muted);">%</span>
 </div>
 <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
 Entre 0 y 100. Deja en 0 si no aplicas descuento.
 </div>
 </div>

 <!-- Columna derecha: resumen de totales -->
 <div style="padding: 14px 20px; background: var(--surface-alt); border-radius: var(--radius-sm);">
 <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px;">
 <span class="text-muted">Total parcial</span>
 <strong id="cotSubtotal">${App.fmtMoney(0)}</strong>
 </div>
 <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px;">
 <span class="text-muted">Descuento</span>
 <strong style="color: var(--danger);" id="cotMontoDescuento">${App.fmtMoney(0)}</strong>
 </div>
 <div style="display: flex; justify-content: space-between; padding: 10px 0 2px; border-top: 2px solid var(--border); margin-top: 4px; align-items: baseline;">
 <span style="text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; font-size: 12px;">Total</span>
 <strong style="font-family: var(--font-display); font-size: 26px; font-weight: 700; color: var(--gold);" id="cotTotal">${App.fmtMoneyHtml(0)}</strong>
 </div>
 </div>
 </div>
 `,
 footer: `
 <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
 <button class="btn btn-primary" onclick="App.views.cotizaciones.guardar()">Generar Cotización</button>
 `,
 });
 // Renderizar lista inicial de productos
 setTimeout(() => this._filtrarProductos(), 50);
 },

 agregarItem(id) {
 const prod = this.productos.find(p => p.id === id);
 if (!prod) return;
 const exist = this.nueva.items.find(i => i.producto_id === id);
 if (exist) exist.cantidad++;
 else this.nueva.items.push({
 producto_id: id,
 codigo: prod.codigo,
 nombre: prod.nombre,
 cantidad: 1,
 precio_unitario: Number(prod.precio_unitario) || 0,
 });
 // Limpiar buscador y refrescar
 const buscar = document.getElementById('cotBuscarProd');
 if (buscar) buscar.value = '';
 this._filtrarProductos();
 this.renderItems();
 },

 _filtrarProductos() {
 const buscar = document.getElementById('cotBuscarProd');
 const list = document.getElementById('cotProductoList');
 if (!list) return;

 const q = (buscar?.value || '').toLowerCase().trim();
 const filtrados = this.productos.filter(p =>
 !q || p.codigo.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q)
 ).slice(0, 3); // máximo 3

 if (filtrados.length === 0) {
 list.innerHTML = `<div class="picker-empty">Sin resultados. Prueba otro término de búsqueda.</div>`;
 return;
 }

 list.innerHTML = filtrados.map(p => `
 <div class="picker-row" onclick="App.views.cotizaciones.agregarItem(${p.id})">
 <div class="code">${App.escape(p.codigo)}</div>
 <div class="info">
 <div class="name">${App.escape(p.nombre)}</div>
 <div class="stock">Stock: ${p.stock}</div>
 </div>
 <div class="price">${App.fmtMoneyHtml(p.precio_unitario)}</div>
 </div>
 `).join('');
 },

 cambiar(id, valor) {
 const item = this.nueva.items.find(i => i.producto_id === id);
 if (!item) return;
 item.cantidad = Math.max(1, parseInt(valor) || 1);
 this.renderItems();
 },

 eliminar_item(id) {
 this.nueva.items = this.nueva.items.filter(i => i.producto_id !== id);
 this.renderItems();
 },

 _recalcularTotal() {
 this.renderItems();
 },

 renderItems() {
 const tbody = document.getElementById('cotItemsTbody');
 const elSubtotal = document.getElementById('cotSubtotal');
 const elDescuento = document.getElementById('cotMontoDescuento');
 const elTotal = document.getElementById('cotTotal');

 if (this.nueva.items.length === 0) {
 tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Sin productos</td></tr>`;
 if (elSubtotal) elSubtotal.innerHTML = App.fmtMoneyHtml(0);
 if (elDescuento) elDescuento.innerHTML = App.fmtMoneyHtml(0);
 if (elTotal) elTotal.innerHTML = App.fmtMoneyHtml(0);
 return;
 }

 let subtotal = 0;
 tbody.innerHTML = this.nueva.items.map(it => {
 const sub = it.cantidad * it.precio_unitario;
 subtotal += sub;
 return `
 <tr>
 <td>
 <div style="font-weight: 600;">${App.escape(it.nombre)}</div>
 <code style="font-size: 11px; color: var(--text-muted);">${App.escape(it.codigo)}</code>
 </td>
 <td class="text-center">
 <input type="number" min="1" value="${it.cantidad}"
 class="form-input" style="text-align: center; padding: 6px;"
 onchange="App.views.cotizaciones.cambiar(${it.producto_id}, this.value)">
 </td>
 <td class="text-right">${App.fmtMoney(it.precio_unitario)}</td>
 <td class="text-right" style="color: var(--gold); font-weight: 600;">${App.fmtMoney(sub)}</td>
 <td>
 <button class="btn btn-icon danger" onclick="App.views.cotizaciones.eliminar_item(${it.producto_id})">×</button>
 </td>
 </tr>
 `;
 }).join('');

 // Calcular descuento desde input (si existe en pantalla)
 const inputDesc = document.getElementById('cotDescuento');
 let pctDesc = inputDesc ? parseFloat(inputDesc.value) || 0 : 0;
 if (pctDesc < 0) pctDesc = 0;
 if (pctDesc > 100) pctDesc = 100;
 const montoDesc = subtotal * (pctDesc / 100);
 const total = subtotal - montoDesc;

 if (elSubtotal) elSubtotal.innerHTML = App.fmtMoneyHtml(subtotal);
 if (elDescuento) elDescuento.innerHTML = pctDesc > 0
 ? `− ${App.fmtMoneyHtml(montoDesc)} (${pctDesc}%)`
 : App.fmtMoneyHtml(0);

 if (elTotal) elTotal.innerHTML = App.fmtMoneyHtml(total);
 },

 async guardar() {
 const cliente = document.getElementById('cotCliente').value.trim();
 if (!cliente) {
 App.toast('Indica el nombre del cliente', 'warning');
 return;
 }
 if (this.nueva.items.length === 0) {
 App.toast('Agrega al menos un producto', 'warning');
 return;
 }
 try {
 const descuento = parseFloat(document.getElementById('cotDescuento').value) || 0;
 const cot = await App.api('/api/cotizaciones', {
 method: 'POST',
 body: {
 cliente,
 cliente_telefono: document.getElementById('cotTel').value.trim(),
 cliente_correo: document.getElementById('cotEmail').value.trim(),
 vigencia_dias: parseInt(document.getElementById('cotVigencia').value) || 15,
 notas: '',
 descuento_porcentaje: Math.max(0, Math.min(100, descuento)),
 items: this.nueva.items.map(i => ({
 producto_id: i.producto_id,
 cantidad: i.cantidad,
 })),
 },
 });
 App.toast('Cotización generada: ' + cot.folio, 'success');
 App.closeModal();
 await this.cargar();
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },

 async ver(id) {
 try {
 const cot = await App.api('/api/cotizaciones/' + id);
 App.showCotizacionDoc(cot);
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },

 async aceptar(id) {
 const c = this.cotizaciones.find(x => x.id === id);
 if (!await App.confirm({
 title: 'Aceptar cotización',
 message: `¿Convertir la cotización ${c.folio} en venta? Se descontará el stock de los productos.`,
 confirmText: 'Aceptar y vender',
 })) return;
 try {
 await App.api('/api/cotizaciones/' + id + '/aceptar', { method: 'POST' });
 App.toast('Cotización aceptada y convertida en venta', 'success');
 await this.cargar();
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },

 async rechazar(id) {
 const c = this.cotizaciones.find(x => x.id === id);
 if (!await App.confirm({
 title: 'Rechazar cotización',
 message: `¿Marcar como rechazada la cotización ${c.folio}?`,
 confirmText: 'Rechazar',
 danger: true,
 })) return;
 try {
 await App.api('/api/cotizaciones/' + id + '/rechazar', { method: 'POST' });
 App.toast('Cotización rechazada', 'success');
 await this.cargar();
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },

 async eliminar(id) {
 const c = this.cotizaciones.find(x => x.id === id);
 if (!await App.confirm({
 title: 'Eliminar cotización',
 message: `¿Eliminar la cotización ${c.folio} de forma permanente?`,
 confirmText: 'Eliminar',
 danger: true,
 })) return;
 try {
 await App.api('/api/cotizaciones/' + id, { method: 'DELETE' });
 App.toast('Cotización eliminada', 'success');
 await this.cargar();
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },

 async descargarPDF(id) {
 try {
 const cot = await App.api('/api/cotizaciones/' + id);
 await App.generarPDFCotizacion(cot);
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },
};

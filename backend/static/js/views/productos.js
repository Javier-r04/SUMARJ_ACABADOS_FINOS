App.views.productos = {
 productos: [],
 categorias: [],
 filtroBusqueda: '',
 filtroCategoria: '',
 filtroBajoStock: false,

 async render(container) {
 // Si vienen del dashboard con flag de bajo stock, activarlo automáticamente
 if (sessionStorage.getItem('sumarj_filtro_bajo_stock') === '1') {
 this.filtroBajoStock = true;
 sessionStorage.removeItem('sumarj_filtro_bajo_stock');
 }

 container.innerHTML = App.pageHeader(
 'Productos',
 'Gestión del catálogo e inventario',
 `<button class="btn ${this.filtroBajoStock ? 'btn-primary' : 'btn-ghost'}" onclick="App.views.productos.toggleBajoStock()" id="btnBajoStock"> Bajo Stock</button>`
 ) + `
 <div class="table-container">
 <div class="table-toolbar">
 <input type="text" class="form-input" id="prodBuscar" placeholder="Buscar producto…">
 <select class="form-select" id="prodCategoria" style="min-width: 200px;">
 <option value="">Todas las categorías</option>
 </select>
 <button class="btn btn-ghost" onclick="App.views.productos.openCategoria()">+ Categoría</button>
 </div>
 <table class="table" id="prodTable">
 <thead>
 <tr>
 <th>Código</th>
 <th>Producto</th>
 <th>Categoría</th>
 <th class="text-right">Costo</th>
 <th class="text-right">Precio</th>
 <th class="text-center">Stock</th>
 <th class="text-right">Acciones</th>
 </tr>
 </thead>
 <tbody id="prodTbody">
 <tr class="empty-row"><td colspan="7">Cargando…</td></tr>
 </tbody>
 </table>
 </div>
 `;

 document.getElementById('prodBuscar').addEventListener('input', (e) => {
 this.filtroBusqueda = e.target.value.trim();
 this.cargar();
 });
 document.getElementById('prodCategoria').addEventListener('change', (e) => {
 this.filtroCategoria = e.target.value;
 this.cargar();
 });

 await this.cargarCategorias();
 await this.cargar();
 },

 toggleBajoStock() {
 this.filtroBajoStock = !this.filtroBajoStock;
 document.getElementById('btnBajoStock').classList.toggle('btn-primary', this.filtroBajoStock);
 document.getElementById('btnBajoStock').classList.toggle('btn-ghost', !this.filtroBajoStock);
 this.cargar();
 },

 async cargarCategorias() {
 try {
 this.categorias = await App.api('/api/categorias');
 const sel = document.getElementById('prodCategoria');
 const current = sel.value;
 sel.innerHTML = '<option value="">Todas las categorías</option>' +
 this.categorias.map(c => `<option value="${c.id}">${App.escape(c.nombre)}</option>`).join('');
 sel.value = current;
 } catch (e) { /* nada */ }
 },

 async cargar() {
 const tbody = document.getElementById('prodTbody');
 tbody.innerHTML = `<tr class="empty-row"><td colspan="7"><span class="spinner"></span></td></tr>`;
 try {
 const params = new URLSearchParams();
 if (this.filtroBusqueda) params.set('q', this.filtroBusqueda);
 if (this.filtroCategoria) params.set('categoria_id', this.filtroCategoria);
 if (this.filtroBajoStock) params.set('bajo_stock', 'true');
 this.productos = await App.api('/api/productos?' + params.toString());
 this.renderTabla();
 } catch (e) {
 tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Error: ${App.escape(e.message)}</td></tr>`;
 }
 },

 renderTabla() {
 const tbody = document.getElementById('prodTbody');
 if (this.productos.length === 0) {
 tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Sin productos</td></tr>`;
 return;
 }
 tbody.innerHTML = this.productos.map(p => {
 const stockBajo = p.stock <= p.stock_alerta;
 const vendePiezas = (p.piezas_por_caja || 0) > 0;
 const piezasSueltas = p.stock_piezas_sueltas || 0;
 const totalPiezas = vendePiezas ? (p.stock * p.piezas_por_caja) + piezasSueltas : 0;
 const stockBadge = vendePiezas
 ? `<span class="badge ${stockBajo ? 'badge-danger' : 'badge-success'}">${p.stock}</span>
 <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">
 ${totalPiezas} pza${piezasSueltas > 0 ? ` (${piezasSueltas} sueltas)` : ''}
 </div>`
 : `<span class="badge ${stockBajo ? 'badge-danger' : 'badge-success'}">${p.stock}</span>`;
 const precioCelda = vendePiezas
 ? `<div style="color: var(--gold); font-weight: 600;">${App.fmtMoney(p.precio_unitario)}</div>
 <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
 ${App.fmtMoney(p.precio_pieza)} / pza${p.precio_pieza_promo ? ' ★' : ''}
 </div>`
 : `<span style="color: var(--gold); font-weight: 600;">${App.fmtMoney(p.precio_unitario)}</span>`;
 return `
 <tr>
 <td><code style="color: var(--gold-soft);">${App.escape(p.codigo)}</code></td>
 <td>
 <div style="font-weight: 600;">${App.escape(p.nombre)}</div>
 ${vendePiezas ? `<div style="font-size: 10px; color: var(--text-muted);">📦 Caja de ${p.piezas_por_caja} pza</div>` : ''}
 </td>
 <td>${p.categoria ? App.escape(p.categoria.nombre) : '<span class="text-muted">—</span>'}</td>
 <td class="text-right">${App.fmtMoney(p.costo)}</td>
 <td class="text-right">${precioCelda}</td>
 <td class="text-center">${stockBadge}</td>
 <td>
 <div class="row-actions">
 <button class="btn btn-icon" title="Editar"
 onclick="App.views.productos.openEditar(${p.id})">✎</button>
 <button class="btn btn-icon danger" title="Eliminar"
 onclick="App.views.productos.eliminar(${p.id})">🗑</button>
 </div>
 </td>
 </tr>
 `;
 }).join('');
 },

 openCategoria() {
 App.openModal({
 title: 'Gestionar Categorías',
 body: `
 <div class="form-group">
 <label class="form-label">Nueva categoría</label>
 <div style="display: flex; gap: 8px;">
 <input class="form-input" id="catNombre" placeholder="Ej. Pisos cerámicos">
 <button class="btn btn-primary" onclick="App.views.productos.crearCategoria()">Agregar</button>
 </div>
 </div>
 <div class="mt-4">
 <div class="form-label mb-2">Existentes</div>
 <div id="catLista">${this.htmlCategorias()}</div>
 </div>
 `,
 footer: `<button class="btn btn-ghost" onclick="App.closeModal()">Cerrar</button>`,
 });
 },

 htmlCategorias() {
 if (this.categorias.length === 0)
 return `<p class="text-muted text-center">Sin categorías</p>`;
 return this.categorias.map(c => `
 <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--black-border);">
 <span>${App.escape(c.nombre)}</span>
 <button class="btn btn-icon danger" onclick="App.views.productos.eliminarCategoria(${c.id})">🗑</button>
 </div>
 `).join('');
 },

 async crearCategoria() {
 const nombre = document.getElementById('catNombre').value.trim();
 if (!nombre) return;
 try {
 await App.api('/api/categorias', { method: 'POST', body: { nombre } });
 await this.cargarCategorias();
 document.getElementById('catNombre').value = '';
 document.getElementById('catLista').innerHTML = this.htmlCategorias();
 App.toast('Categoría creada', 'success');
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },

 async eliminarCategoria(id) {
 if (!await App.confirm({ message: '¿Eliminar esta categoría?', danger: true })) return;
 try {
 await App.api('/api/categorias/' + id, { method: 'DELETE' });
 await this.cargarCategorias();
 document.getElementById('catLista').innerHTML = this.htmlCategorias();
 App.toast('Categoría eliminada', 'success');
 this.cargar();
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },

 openCrear() {
 this.openForm(null);
 },

 openEditar(id) {
 const p = this.productos.find(x => x.id === id);
 if (!p) return;
 this.openForm(p);
 },

 openForm(prod) {
 const esEdit = !!prod;
 const p = prod || {};
 const catOptions = this.categorias.map(c =>
 `<option value="${c.id}" ${p.categoria && p.categoria.id === c.id ? 'selected' : ''}>${App.escape(c.nombre)}</option>`
 ).join('');

 App.openModal({
 title: esEdit ? 'Editar Producto' : 'Nuevo Producto',
 body: `
 <div class="form-grid cols-2">
 <div class="form-group">
 <label class="form-label">Código *</label>
 <input class="form-input" id="fCodigo" value="${App.escape(p.codigo || '')}">
 </div>
 <div class="form-group">
 <label class="form-label">Nombre *</label>
 <input class="form-input" id="fNombre" value="${App.escape(p.nombre || '')}">
 </div>
 </div>
 <div class="form-group">
 <label class="form-label">Categoría</label>
 <select class="form-select" id="fCategoria">
 <option value="">— Sin categoría —</option>
 ${catOptions}
 </select>
 </div>
 <div class="form-grid cols-2">
 <div class="form-group">
 <label class="form-label">Costo (MXN)</label>
 <input class="form-input" id="fCosto" type="number" step="0.01" value="${p.costo || 0}">
 </div>
 <div class="form-group">
 <label class="form-label">Precio de Venta *</label>
 <input class="form-input" id="fPrecio" type="number" step="0.01" value="${p.precio_unitario || 0}"
 oninput="App.views.productos._recalcularPrecioPieza()">
 </div>
 </div>
 <div class="form-grid cols-2">
 <div class="form-group">
 <label class="form-label">Stock Inicial</label>
 <input class="form-input" id="fStock" type="number" value="${p.stock || 0}">
 </div>
 <div class="form-group">
 <label class="form-label">Alerta de Stock</label>
 <input class="form-input" id="fStockAlerta" type="number" value="${p.stock_alerta || 5}">
 </div>
 </div>

 <!-- ============ Sección: Venta por piezas ============ -->
 <div style="border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; margin-top: 10px; background: var(--surface-alt);">
 <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none;">
 <input type="checkbox" id="fVendePorPiezas"
 ${(p.piezas_por_caja || 0) > 0 ? 'checked' : ''}
 onchange="App.views.productos._togglePiezas()"
 style="width: 18px; height: 18px; cursor: pointer;">
 <div>
 <div style="font-weight: 600;">Se vende también por piezas</div>
 <div style="font-size: 11px; color: var(--text-muted);">Para productos como cajas de lambrín, pisos, etc.</div>
 </div>
 </label>

 <div id="bloquePiezas" style="display: ${(p.piezas_por_caja || 0) > 0 ? 'block' : 'none'}; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border);">
 <div class="form-grid cols-2">
 <div class="form-group">
 <label class="form-label">Piezas por caja *</label>
 <input class="form-input" id="fPiezasPorCaja" type="number" min="1"
 value="${p.piezas_por_caja || ''}"
 oninput="App.views.productos._recalcularPrecioPieza()"
 placeholder="Ej. 10">
 </div>
 <div class="form-group">
 <label class="form-label">Piezas sueltas disponibles</label>
 <input class="form-input" id="fStockPiezasSueltas" type="number" min="0"
 value="${p.stock_piezas_sueltas || 0}">
 <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">Piezas que quedaron de cajas abiertas</div>
 </div>
 </div>

 <div class="form-group">
 <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
 <input type="checkbox" id="fPrecioPiezaPromo"
 ${p.precio_pieza_promo ? 'checked' : ''}
 onchange="App.views.productos._togglePrecioPromo()"
 style="cursor: pointer;">
 <span>Precio promocional por pieza (manual)</span>
 </label>
 </div>

 <div class="form-group">
 <label class="form-label">Precio por pieza</label>
 <input class="form-input" id="fPrecioPieza" type="number" step="0.01" min="0"
 value="${p.precio_pieza || 0}"
 ${p.precio_pieza_promo ? '' : 'readonly'}
 style="${p.precio_pieza_promo ? '' : 'background: var(--surface-alt); cursor: not-allowed; opacity: 0.7;'}">
 <div id="fHintPrecioPieza" style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
 ${p.precio_pieza_promo ? '✏️ Modo promocional: edita el precio manualmente' : '⚙️ Cálculo automático: precio de caja ÷ piezas por caja'}
 </div>
 </div>
 </div>
 </div>
 `,
 footer: `
 <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
 <button class="btn btn-primary" onclick="App.views.productos.guardar(${prod ? prod.id : 'null'})">
 ${esEdit ? 'Guardar Cambios' : 'Crear Producto'}
 </button>
 `,
 size: 'lg',
 });
 },

 async guardar(id) {
 const vendePorPiezas = document.getElementById('fVendePorPiezas')?.checked;
 const piezasPorCaja = vendePorPiezas
 ? parseInt(document.getElementById('fPiezasPorCaja').value) || 0
 : 0;
 const stockPiezasSueltas = vendePorPiezas
 ? parseInt(document.getElementById('fStockPiezasSueltas').value) || 0
 : 0;
 const precioPiezaPromo = vendePorPiezas
 ? !!document.getElementById('fPrecioPiezaPromo')?.checked
 : false;
 const precioCaja = parseFloat(document.getElementById('fPrecio').value) || 0;
 let precioPieza = 0;
 if (vendePorPiezas) {
 if (precioPiezaPromo) {
 precioPieza = parseFloat(document.getElementById('fPrecioPieza').value) || 0;
 } else if (piezasPorCaja > 0) {
 precioPieza = precioCaja / piezasPorCaja;
 }
 }

 if (vendePorPiezas && piezasPorCaja < 1) {
 App.toast('Indica cuántas piezas trae cada caja', 'warning');
 return;
 }

 const data = {
 codigo: document.getElementById('fCodigo').value.trim(),
 nombre: document.getElementById('fNombre').value.trim(),
 categoria_id: parseInt(document.getElementById('fCategoria').value) || null,
 costo: parseFloat(document.getElementById('fCosto').value) || 0,
 precio_unitario: precioCaja,
 stock: parseInt(document.getElementById('fStock').value) || 0,
 stock_alerta: parseInt(document.getElementById('fStockAlerta').value) || 5,
 piezas_por_caja: piezasPorCaja,
 precio_pieza: precioPieza,
 precio_pieza_promo: precioPiezaPromo,
 stock_piezas_sueltas: stockPiezasSueltas,
 };

 if (!data.codigo || !data.nombre) {
 App.toast('Código y nombre son requeridos', 'warning');
 return;
 }
 try {
 if (id) {
 await App.api('/api/productos/' + id, { method: 'PUT', body: data });
 App.toast('Producto actualizado', 'success');
 } else {
 await App.api('/api/productos', { method: 'POST', body: data });
 App.toast('Producto creado', 'success');
 }
 App.closeModal();
 await this.cargar();
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },

 _togglePiezas() {
 const cb = document.getElementById('fVendePorPiezas');
 const bloque = document.getElementById('bloquePiezas');
 if (!cb || !bloque) return;
 bloque.style.display = cb.checked ? 'block' : 'none';
 if (cb.checked) {
 this._recalcularPrecioPieza();
 }
 },

 _togglePrecioPromo() {
 const cb = document.getElementById('fPrecioPiezaPromo');
 const input = document.getElementById('fPrecioPieza');
 const hint = document.getElementById('fHintPrecioPieza');
 if (!cb || !input) return;
 if (cb.checked) {
 input.readOnly = false;
 input.style.cssText = '';
 if (hint) hint.innerHTML = '✏️ Modo promocional: edita el precio manualmente';
 } else {
 input.readOnly = true;
 input.style.cssText = 'background: var(--surface-alt); cursor: not-allowed; opacity: 0.7;';
 if (hint) hint.innerHTML = '⚙️ Cálculo automático: precio de caja ÷ piezas por caja';
 this._recalcularPrecioPieza();
 }
 },

 _recalcularPrecioPieza() {
 const cb = document.getElementById('fVendePorPiezas');
 if (!cb?.checked) return;
 const promo = document.getElementById('fPrecioPiezaPromo')?.checked;
 if (promo) return; // En modo manual no recalculamos
 const precioCaja = parseFloat(document.getElementById('fPrecio')?.value) || 0;
 const piezas = parseInt(document.getElementById('fPiezasPorCaja')?.value) || 0;
 const inputPP = document.getElementById('fPrecioPieza');
 if (!inputPP) return;
 if (piezas > 0) {
 inputPP.value = (precioCaja / piezas).toFixed(2);
 } else {
 inputPP.value = '0.00';
 }
 },

 async eliminar(id) {
 const p = this.productos.find(x => x.id === id);
 if (!await App.confirm({
 title: 'Eliminar producto',
 message: `¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`,
 confirmText: 'Eliminar',
 danger: true,
 })) return;
 try {
 await App.api('/api/productos/' + id, { method: 'DELETE' });
 App.toast('Producto eliminado', 'success');
 await this.cargar();
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },
};

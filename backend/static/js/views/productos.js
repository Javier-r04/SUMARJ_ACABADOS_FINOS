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
 return `
 <tr>
 <td><code style="color: var(--gold-soft);">${App.escape(p.codigo)}</code></td>
 <td>
 <div style="font-weight: 600;">${App.escape(p.nombre)}</div>
 </td>
 <td>${p.categoria ? App.escape(p.categoria.nombre) : '<span class="text-muted">—</span>'}</td>
 <td class="text-right">${App.fmtMoney(p.costo)}</td>
 <td class="text-right" style="color: var(--gold); font-weight: 600;">${App.fmtMoney(p.precio_unitario)}</td>
 <td class="text-center">
 <span class="badge ${stockBajo ? 'badge-danger' : 'badge-success'}">${p.stock}</span>
 </td>
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
 <input class="form-input" id="fPrecio" type="number" step="0.01" value="${p.precio_unitario || 0}">
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
 const data = {
 codigo: document.getElementById('fCodigo').value.trim(),
 nombre: document.getElementById('fNombre').value.trim(),
 categoria_id: parseInt(document.getElementById('fCategoria').value) || null,
 costo: parseFloat(document.getElementById('fCosto').value) || 0,
 precio_unitario: parseFloat(document.getElementById('fPrecio').value) || 0,
 stock: parseInt(document.getElementById('fStock').value) || 0,
 stock_alerta: parseInt(document.getElementById('fStockAlerta').value) || 5,
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

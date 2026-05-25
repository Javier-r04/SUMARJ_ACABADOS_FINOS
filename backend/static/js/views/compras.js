App.views.compras = {
 compras: [],
 productos: [],
 proveedores: [],
 nuevaCompra: { proveedor: '', items: [] },
 editandoId: null, // si está editando, aquí va el ID

 async render(container) {
 container.innerHTML = App.pageHeader(
 'Compras',
 'Registro de adquisiciones a proveedores',
 `<button class="btn btn-primary" onclick="App.views.compras.openNueva()">+ Nueva Compra</button>`
 ) + `
 <div class="table-container">
 <table class="table">
 <thead>
 <tr>
 <th>Folio</th>
 <th>Proveedor</th>
 <th>Fecha</th>
 <th class="text-center">Items</th>
 <th class="text-right">Total</th>
 <th class="text-right">Acciones</th>
 </tr>
 </thead>
 <tbody id="cTbody">
 <tr class="empty-row"><td colspan="6"><span class="spinner"></span></td></tr>
 </tbody>
 </table>
 </div>
 `;
 await this.cargar();
 },

 async cargar() {
 const tbody = document.getElementById('cTbody');
 try {
 this.compras = await App.api('/api/compras');
 if (this.compras.length === 0) {
 tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Sin compras registradas</td></tr>`;
 return;
 }
 tbody.innerHTML = this.compras.map(c => `
 <tr>
 <td><code style="color: var(--gold);">${App.escape(c.folio)}</code></td>
 <td>${App.escape(c.proveedor_nombre)}</td>
 <td>${App.fmtDate(c.fecha)}</td>
 <td class="text-center">${c.cantidad_items}</td>
 <td class="text-right" style="color: var(--gold); font-weight: 600;">${App.fmtMoney(c.total)}</td>
 <td>
 <div class="row-actions">
 <button class="btn btn-icon" title="Editar" onclick="App.views.compras.openEditar(${c.id})">✎</button>
 <button class="btn btn-icon danger" title="Anular" onclick="App.views.compras.eliminar(${c.id})">⊘</button>
 </div>
 </td>
 </tr>
 `).join('');
 } catch (e) {
 tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Error: ${App.escape(e.message)}</td></tr>`;
 }
 },

 async openNueva() {
 this.editandoId = null;
 this.nuevaCompra = { proveedor: '', items: [] };
 await this._abrirModal('Nueva Compra');
 },

 async openEditar(id) {
 try {
 this.editandoId = id;
 // Cargar compra completa
 const compra = await App.api('/api/compras/' + id);
 this.nuevaCompra = {
 proveedor: compra.proveedor_nombre,
 items: compra.detalles.map(d => ({
 tipo: 'existente',
 producto_id: d.producto_id,
 codigo: d.codigo,
 nombre: d.nombre,
 cantidad: d.cantidad,
 costo_unitario: Number(d.costo_unitario),
 })),
 };
 await this._abrirModal('Editar Compra ' + compra.folio);
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },

 async _abrirModal(titulo) {
 try {
 [this.productos, this.proveedores] = await Promise.all([
 App.api('/api/productos?activo=true'),
 App.api('/api/proveedores'),
 ]);
 } catch (e) {
 App.toast(e.message, 'error');
 return;
 }

 const provOptions = this.proveedores.map(p =>
 `<option value="${App.escape(p.nombre)}">${App.escape(p.nombre)}</option>`).join('');

 App.openModal({
 title: titulo,
 size: 'lg',
 body: `
 <div class="form-grid cols-2">
 <div class="form-group">
 <label class="form-label">Proveedor *</label>
 <input class="form-input" id="cProveedor" list="provList" placeholder="Nombre del proveedor" value="${App.escape(this.nuevaCompra.proveedor)}">
 <datalist id="provList">${provOptions}</datalist>
 </div>
 <div class="form-group">
 <label class="form-label">Agregar producto existente</label>
 <input class="form-input" id="cBuscarProd" type="text"
 placeholder="Buscar por código o nombre…"
 oninput="App.views.compras._filtrarProductos()">
 <div id="cProductoList" class="picker-list" style="margin-top: 8px;"></div>
 </div>
 </div>

 <div style="margin-top: -8px; margin-bottom: 16px;">
 <button class="btn btn-ghost" onclick="App.views.compras.agregarItemNuevo()" style="width: 100%;">
 + Producto Nuevo
 </button>
 </div>

 <div class="section-title mt-3" style="font-size: 16px;">Productos</div>
 <div id="cItemsContainer">
 <div id="cItemsList"></div>
 </div>

 <div style="display: flex; justify-content: flex-end; margin-top: 14px; padding: 14px; background: var(--surface-alt); border-radius: var(--radius-sm);">
 <div style="text-align: right;">
 <div class="kpi-label">Total a Pagar</div>
 <div style="font-family: var(--font-display); font-size: 28px; font-weight: 700; color: var(--gold);" id="cTotal">
 ${App.fmtMoneyHtml(0)}
 </div>
 </div>
 </div>
 `,
 footer: `
 <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
 <button class="btn btn-primary" onclick="App.views.compras.guardar()">
 ${this.editandoId ? 'Guardar Cambios' : 'Registrar Compra'}
 </button>
 `,
 });
 this.renderItems();
 setTimeout(() => this._filtrarProductos(), 50);
 },

 agregarItem(id) {
 const prod = this.productos.find(p => p.id === id);
 if (!prod) return;
 const exist = this.nuevaCompra.items.find(i => i.tipo === 'existente' && i.producto_id === id);
 if (exist) {
 exist.cantidad++;
 } else {
 this.nuevaCompra.items.push({
 tipo: 'existente',
 producto_id: id,
 codigo: prod.codigo,
 nombre: prod.nombre,
 cantidad: 1,
 costo_unitario: Number(prod.costo) || 0,
 });
 }
 const buscar = document.getElementById('cBuscarProd');
 if (buscar) buscar.value = '';
 this._filtrarProductos();
 this.renderItems();
 },

 _filtrarProductos() {
 const buscar = document.getElementById('cBuscarProd');
 const list = document.getElementById('cProductoList');
 if (!list) return;

 const q = (buscar?.value || '').toLowerCase().trim();
 const filtrados = this.productos.filter(p =>
 !q || p.codigo.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q)
 ).slice(0, 5);

 if (filtrados.length === 0) {
 list.innerHTML = `<div class="picker-empty">Sin resultados. Usa "Producto Nuevo" abajo para agregarlo al catálogo.</div>`;
 return;
 }

 list.innerHTML = filtrados.map(p => `
 <div class="picker-row" onclick="App.views.compras.agregarItem(${p.id})">
 <div class="code">${App.escape(p.codigo)}</div>
 <div class="info">
 <div class="name">${App.escape(p.nombre)}</div>
 <div class="stock">Stock: ${p.stock}</div>
 </div>
 <div class="price">${App.fmtMoneyHtml(p.costo)}</div>
 </div>
 `).join('');
 },

 agregarItemNuevo() {
 const tempId = 'new_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
 this.nuevaCompra.items.push({
 tipo: 'nuevo',
 tempId: tempId,
 producto_id: null,
 nuevo_codigo: '',
 nuevo_nombre: '',
 nuevo_precio_venta: 0,
 nuevo_stock_alerta: 5,
 cantidad: 1,
 costo_unitario: 0,
 });
 this.renderItems();
 setTimeout(() => {
 const el = document.querySelector(`[data-temp="${tempId}"] .input-codigo`);
 if (el) el.focus();
 }, 50);
 },

 cambiar(idOrTempId, campo, valor) {
 const item = this.nuevaCompra.items.find(i =>
 (i.tipo === 'existente' && i.producto_id === idOrTempId) ||
 (i.tipo === 'nuevo' && i.tempId === idOrTempId)
 );
 if (!item) return;
 if (campo === 'cantidad') {
 item.cantidad = Math.max(1, parseInt(valor) || 1);
 } else if (campo === 'costo') {
 item.costo_unitario = Math.max(0, parseFloat(valor) || 0);
 } else if (campo === 'codigo') {
 item.nuevo_codigo = valor.trim();
 } else if (campo === 'nombre') {
 item.nuevo_nombre = valor.trim();
 } else if (campo === 'stock_alerta') {
 item.nuevo_stock_alerta = Math.max(0, parseInt(valor) || 5);
 } else if (campo === 'precio_venta') {
 item.nuevo_precio_venta = Math.max(0, parseFloat(valor) || 0);
 }
 this.renderItems();
 },

 eliminar_item(idOrTempId) {
 this.nuevaCompra.items = this.nuevaCompra.items.filter(i =>
 !((i.tipo === 'existente' && i.producto_id === idOrTempId) ||
 (i.tipo === 'nuevo' && i.tempId === idOrTempId))
 );
 this.renderItems();
 },

 /**
 * Validación en tiempo real del código mientras se escribe.
 * No usa renderItems para no perder el foco del input.
 */
 cambiarCodigo(tempId, valor) {
 const item = this.nuevaCompra.items.find(i =>
 i.tipo === 'nuevo' && i.tempId === tempId
 );
 if (!item) return;
 const codigo = valor.trim();
 item.nuevo_codigo = codigo;

 const warningEl = document.querySelector(`.codigo-warning[data-ref="${tempId}"]`);
 if (!warningEl) return;

 if (!codigo) {
 warningEl.style.display = 'none';
 return;
 }

 // Buscar si el código ya existe en el catálogo
 const codigoUpper = codigo.toUpperCase();
 const duplicado = this.productos.find(p =>
 p.codigo.toUpperCase() === codigoUpper
 );

 // O si está duplicado dentro de la misma compra
 const enMismaCompra = this.nuevaCompra.items.find(i =>
 i.tipo === 'nuevo' &&
 i.tempId !== tempId &&
 i.nuevo_codigo &&
 i.nuevo_codigo.toUpperCase() === codigoUpper
 );

 if (duplicado) {
 warningEl.innerHTML = `⚠ El código <strong>${App.escape(codigo)}</strong> ya está en uso por <strong>${App.escape(duplicado.nombre)}</strong>. Usa un código único o seleccionalo desde el buscador de arriba.`;
 warningEl.style.display = '';
 } else if (enMismaCompra) {
 warningEl.innerHTML = `⚠ Ya hay otro producto nuevo en esta compra con el código <strong>${App.escape(codigo)}</strong>. Los códigos deben ser únicos.`;
 warningEl.style.display = '';
 } else {
 warningEl.style.display = 'none';
 }
 },

 renderItems() {
 const lista = document.getElementById('cItemsList');
 if (!lista) return;
 if (this.nuevaCompra.items.length === 0) {
 lista.innerHTML = `<div class="empty-state" style="padding: 30px;">
 <p>Sin productos agregados</p>
 <p style="font-size: 11px; margin-top: 6px;">Selecciona del catálogo o agrega uno nuevo</p>
 </div>`;
 document.getElementById('cTotal').innerHTML = App.fmtMoneyHtml(0);
 return;
 }
 let total = 0;
 lista.innerHTML = this.nuevaCompra.items.map(it => {
 const sub = it.cantidad * it.costo_unitario;
 total += sub;
 const ref = it.tipo === 'existente' ? it.producto_id : `'${it.tempId}'`;

 if (it.tipo === 'existente') {
 return `
 <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 8px;">
 <div style="display: grid; grid-template-columns: 1fr auto auto auto auto; gap: 12px; align-items: center;">
 <div>
 <div style="font-weight: 600;">${App.escape(it.nombre)}</div>
 <code style="font-size: 11px; color: var(--text-muted);">${App.escape(it.codigo)}</code>
 </div>
 <div>
 <div class="form-label" style="margin-bottom: 4px;">Cantidad</div>
 <input type="number" min="1" value="${it.cantidad}" style="width: 80px; padding: 6px; text-align: center;"
 class="form-input" onchange="App.views.compras.cambiar(${ref}, 'cantidad', this.value)">
 </div>
 <div>
 <div class="form-label" style="margin-bottom: 4px;">Costo Unit.</div>
 <input type="number" min="0" step="0.01" value="${it.costo_unitario}" style="width: 100px; padding: 6px; text-align: center;"
 class="form-input" onchange="App.views.compras.cambiar(${ref}, 'costo', this.value)">
 </div>
 <div style="text-align: right; min-width: 90px;">
 <div class="form-label" style="margin-bottom: 4px;">Subtotal</div>
 <div style="color: var(--gold); font-weight: 700; font-size: 16px;">${App.fmtMoney(sub)}</div>
 </div>
 <button class="btn btn-icon danger" onclick="App.views.compras.eliminar_item(${ref})" title="Quitar">×</button>
 </div>
 </div>
 `;
 } else {
 // Item NUEVO - producto a crear
 return `
 <div data-temp="${it.tempId}" style="background: var(--gold-glow); border: 1px solid var(--gold); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 10px;">
 <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
 <span class="badge badge-gold">NUEVO PRODUCTO</span>
 <button class="btn btn-icon danger" onclick="App.views.compras.eliminar_item(${ref})" title="Quitar">×</button>
 </div>

 <div class="form-grid cols-2" style="margin-bottom: 10px;">
 <div class="form-group" style="margin: 0;">
 <label class="form-label">Código *</label>
 <input type="text" class="form-input input-codigo" placeholder="Ej. LAM-001"
 value="${App.escape(it.nuevo_codigo)}" style="padding: 8px;"
 oninput="App.views.compras.cambiarCodigo(${ref}, this.value)">
 <div class="codigo-warning" data-ref="${ref}" style="display: none; color: var(--danger); font-size: 11px; margin-top: 4px;"></div>
 </div>
 <div class="form-group" style="margin: 0;">
 <label class="form-label">Nombre del producto *</label>
 <input type="text" class="form-input" placeholder="Ej. CAJA DE LAMBRIN..."
 value="${App.escape(it.nuevo_nombre)}" style="padding: 8px;"
 onchange="App.views.compras.cambiar(${ref}, 'nombre', this.value)">
 </div>
 </div>

 <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr auto; gap: 10px; align-items: end;">
 <div>
 <label class="form-label">Cantidad *</label>
 <input type="number" min="1" value="${it.cantidad}" style="padding: 8px; text-align: center;"
 class="form-input" onchange="App.views.compras.cambiar(${ref}, 'cantidad', this.value)">
 </div>
 <div>
 <label class="form-label">Costo Unit. *</label>
 <input type="number" min="0" step="0.01" value="${it.costo_unitario}" style="padding: 8px; text-align: center;"
 class="form-input" onchange="App.views.compras.cambiar(${ref}, 'costo', this.value)">
 </div>
 <div>
 <label class="form-label" style="color: var(--gold);">Precio Venta *</label>
 <input type="number" min="0" step="0.01" value="${it.nuevo_precio_venta}" style="padding: 8px; text-align: center; border-color: var(--gold);"
 class="form-input" onchange="App.views.compras.cambiar(${ref}, 'precio_venta', this.value)">
 </div>
 <div>
 <label class="form-label">Alerta Stock</label>
 <input type="number" min="0" value="${it.nuevo_stock_alerta || 5}" style="padding: 8px; text-align: center;"
 class="form-input" onchange="App.views.compras.cambiar(${ref}, 'stock_alerta', this.value)"
 title="Cuando el stock baje de este número, recibirás aviso">
 </div>
 <div style="text-align: right;">
 <label class="form-label">Subtotal</label>
 <div style="color: var(--gold); font-weight: 700; font-size: 16px; padding: 8px 0;">${App.fmtMoney(sub)}</div>
 </div>
 <div></div>
 </div>
 </div>
 `;
 }
 }).join('');
 document.getElementById('cTotal').innerHTML = App.fmtMoneyHtml(total);
 },

 async guardar() {
 const proveedor = document.getElementById('cProveedor').value.trim();
 if (!proveedor) {
 App.toast('Indica el proveedor', 'warning');
 return;
 }
 if (this.nuevaCompra.items.length === 0) {
 App.toast('Agrega al menos un producto', 'warning');
 return;
 }

 // Validar items nuevos
 const codigosVistos = new Set();
 for (const it of this.nuevaCompra.items) {
 if (it.tipo === 'nuevo') {
 if (!it.nuevo_codigo || !it.nuevo_nombre) {
 App.toast('Los productos nuevos requieren código y nombre', 'warning');
 return;
 }
 const codigoUpper = it.nuevo_codigo.trim().toUpperCase();

 // Verificar contra catálogo
 const duplicado = this.productos.find(p =>
 p.codigo.toUpperCase() === codigoUpper
 );
 if (duplicado) {
 App.toast(
 `El código "${it.nuevo_codigo}" ya existe en el catálogo como "${duplicado.nombre}". Usa un código único.`,
 'error'
 );
 return;
 }

 // Verificar contra otros items nuevos de esta misma compra
 if (codigosVistos.has(codigoUpper)) {
 App.toast(
 `El código "${it.nuevo_codigo}" está repetido en esta compra. Cada producto nuevo debe tener un código único.`,
 'error'
 );
 return;
 }
 codigosVistos.add(codigoUpper);

 if (it.costo_unitario <= 0) {
 App.toast(`Indica el costo de "${it.nuevo_nombre}"`, 'warning');
 return;
 }
 if (!it.nuevo_precio_venta || it.nuevo_precio_venta <= 0) {
 App.toast(`Indica el precio de venta de "${it.nuevo_nombre}"`, 'warning');
 return;
 }
 }
 }

 const body = {
 proveedor_nombre: proveedor,
 items: this.nuevaCompra.items.map(i => {
 if (i.tipo === 'existente') {
 return {
 producto_id: i.producto_id,
 cantidad: i.cantidad,
 costo_unitario: i.costo_unitario,
 };
 } else {
 return {
 producto_id: null,
 nuevo_codigo: i.nuevo_codigo,
 nuevo_nombre: i.nuevo_nombre,
 nuevo_precio_venta: i.nuevo_precio_venta || i.costo_unitario,
 nuevo_stock_alerta: i.nuevo_stock_alerta || 5,
 cantidad: i.cantidad,
 costo_unitario: i.costo_unitario,
 };
 }
 }),
 };

 try {
 if (this.editandoId) {
 await App.api('/api/compras/' + this.editandoId, { method: 'PUT', body });
 App.toast('Compra actualizada', 'success');
 } else {
 await App.api('/api/compras', { method: 'POST', body });
 App.toast('Compra registrada', 'success');
 }
 App.closeModal();
 this.editandoId = null;
 await this.cargar();
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },

 async eliminar(id) {
 const c = this.compras.find(x => x.id === id);
 if (!await App.confirm({
 title: 'Anular compra',
 message: `¿Anular la compra ${c.folio}? El stock acumulado se revertirá.`,
 confirmText: 'Anular',
 danger: true,
 })) return;
 try {
 await App.api('/api/compras/' + id, { method: 'DELETE' });
 App.toast('Compra anulada', 'success');
 await this.cargar();
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },
};

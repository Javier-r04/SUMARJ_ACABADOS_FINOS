App.views.ventas = {
 ventas: [],
 productos: [],
 busqueda: '',
 editandoId: null,
 editCarrito: [],
 editCliente: '',

 // ----------------------------------------------------------
 // Helpers de precio: aplican promo si está vigente
 // ----------------------------------------------------------
 _promoVigente(prod) {
 if (!prod.precio_pieza_promo) return false;
 if (!prod.promo_fin) return true;
 return new Date(prod.promo_fin) > new Date();
 },
 _precioCaja(prod) {
 return this._promoVigente(prod)
 ? Number(prod.precio_pieza) || 0
 : Number(prod.precio_unitario) || 0;
 },
 _precioPieza(prod) {
 const piezas = prod.piezas_por_caja || 0;
 if (piezas <= 0) return 0;
 return this._precioCaja(prod) / piezas;
 },
 _precioParaUnidad(prod, unidad) {
 return unidad === 'pieza' ? this._precioPieza(prod) : this._precioCaja(prod);
 },

 async render(container) {
 container.innerHTML = App.pageHeader(
 'Ventas',
 'Historial de transacciones de venta',
 `<a href="#pos" class="btn btn-primary">+ Nueva Venta</a>`
 ) + `
 <div class="table-container">
 <div class="table-toolbar">
 <input type="text" class="form-input" id="vBuscar" placeholder="Buscar por folio o cliente…">
 </div>
 <table class="table">
 <thead>
 <tr>
 <th>Folio</th>
 <th>Cliente</th>
 <th>Fecha</th>
 <th class="text-center">Pago</th>
 <th class="text-center">Items</th>
 <th class="text-right">Total</th>
 <th class="text-right">Acciones</th>
 </tr>
 </thead>
 <tbody id="vTbody">
 <tr class="empty-row"><td colspan="7"><span class="spinner"></span></td></tr>
 </tbody>
 </table>
 </div>
 `;
 document.getElementById('vBuscar').addEventListener('input', (e) => {
 this.busqueda = e.target.value.trim();
 this.cargar();
 });
 await this.cargar();
 },

 async cargar() {
 const tbody = document.getElementById('vTbody');
 try {
 const q = this.busqueda ? '?q=' + encodeURIComponent(this.busqueda) : '';
 this.ventas = await App.api('/api/ventas' + q);
 if (this.ventas.length === 0) {
 tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Sin ventas registradas</td></tr>`;
 return;
 }
 tbody.innerHTML = this.ventas.map(v => {
 const esTarjeta = v.metodo_pago === 'tarjeta';
 const esHibrido = v.metodo_pago === 'hibrido';
 const badgeClass = esHibrido ? 'badge-warning' : (esTarjeta ? 'badge-gold' : 'badge-success');
 const badgeText = esHibrido ? ' Dividido' : (esTarjeta ? ' Tarjeta' : ' Efectivo');
 return `
 <tr>
 <td><code style="color: var(--gold);">${App.escape(v.folio)}</code></td>
 <td>${App.escape(v.cliente)}</td>
 <td>${App.fmtDate(v.fecha)}</td>
 <td class="text-center">
 <span class="badge ${badgeClass}">
 ${badgeText}
 </span>
 </td>
 <td class="text-center">${v.cantidad_items}</td>
 <td class="text-right" style="color: var(--gold); font-weight: 600;">${App.fmtMoney(v.total)}</td>
 <td>
 <div class="row-actions">
 <button class="btn btn-icon" title="Editar venta" onclick="App.views.ventas.openEditar(${v.id})">✎</button>
 <button class="btn btn-icon" title="Ver ticket" onclick="App.views.ventas.verTicket(${v.id})">👁</button>
 <button class="btn btn-icon" title="Descargar PDF" style="color: var(--gold);" onclick="App.views.ventas.descargarPDF(${v.id})">PDF</button>
 <button class="btn btn-icon danger" title="Anular" onclick="App.views.ventas.eliminar(${v.id})">⊘</button>
 </div>
 </td>
 </tr>
 `;
 }).join('');
 } catch (e) {
 tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Error: ${App.escape(e.message)}</td></tr>`;
 }
 },

 async verTicket(id) {
 try {
 const venta = await App.api('/api/ventas/' + id);
 App.showTicketVenta(venta);
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },

 async descargarPDF(id) {
 try {
 const venta = await App.api('/api/ventas/' + id);
 App.generarPDFDocumento({
 tipo: 'TICKET DE VENTA',
 folio: venta.folio,
 cliente: venta.cliente,
 cliente_telefono: '',
 cliente_correo: '',
 fecha: venta.fecha,
 vigencia_dias: null,
 detalles: venta.detalles,
 subtotal: venta.subtotal,
 descuento_pct: venta.descuento_pct,
 total: venta.total,
 filename: `ticket_${venta.folio}.pdf`,
 pieMensaje: '¡Gracias por su compra!',
 });
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },

 async openEditar(id) {
 try {
 this.editandoId = id;
 const venta = await App.api('/api/ventas/' + id);
 this.productos = await App.api('/api/productos?activo=true');

 // Cargar carrito desde la venta. Importante: para mostrar
 // stock correcto, sumamos lo que ya estaba en esta venta
 // (porque al editar el stock se devolverá y se aplicará de nuevo)
 this.editCarrito = venta.detalles.map(d => {
 const prod = this.productos.find(p => p.id === d.producto_id);
 if (!prod) return null;
 const unidad = d.unidad_venta || 'caja';
 // Devolvemos al stock visible lo que esta venta ya tenía descontado,
 // para que al re-editar el usuario vea como disponible "stock_actual + lo de esta venta"
 const stockAjustado = { ...prod };
 if (unidad === 'caja') {
 stockAjustado.stock = (prod.stock || 0) + d.cantidad;
 } else {
 // Para piezas: aumentamos stock_piezas_sueltas
 stockAjustado.stock_piezas_sueltas = (prod.stock_piezas_sueltas || 0) + d.cantidad;
 }
 return {
 producto: stockAjustado,
 cantidad: d.cantidad,
 unidad_venta: unidad,
 };
 }).filter(Boolean);

 this.editCliente = venta.cliente || '';

 this._abrirModalEdicion(venta);
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },

 _abrirModalEdicion(venta) {
 App.openModal({
 title: 'Editar Venta ' + venta.folio,
 size: 'lg',
 body: `
 <div class="form-grid cols-2">
 <div class="form-group">
 <label class="form-label">Cliente</label>
 <input class="form-input" id="editVentaCliente" value="${App.escape(venta.cliente)}">
 </div>
 <div class="form-group">
 <label class="form-label">Historial de Pago</label>
 <div style="padding: 10px 14px; background: var(--surface-alt); border-radius: var(--radius-sm); border-left: 3px solid var(--gold); font-size: 13px;">
 ${this._renderHistorialPago(venta)}
 </div>
 </div>
 </div>

 <div class="form-group">
 <label class="form-label">Agregar producto</label>
 <input class="form-input" id="editVentaBuscarProd" type="text"
 placeholder="Buscar por código o nombre…"
 oninput="App.views.ventas._filtrarProductos()">
 <div id="editVentaProductoList" class="picker-list" style="margin-top: 8px;"></div>
 </div>

 <div class="section-title mt-3" style="font-size: 16px;">Productos en la venta</div>
 <div class="table-container" style="border: 1px solid var(--border);">
 <table class="table">
 <thead>
 <tr>
 <th>Producto</th>
 <th class="text-center" style="width: 100px;">Cantidad</th>
 <th class="text-right" style="width: 110px;">Precio Unit.</th>
 <th class="text-right" style="width: 110px;">Subtotal</th>
 <th style="width: 50px;"></th>
 </tr>
 </thead>
 <tbody id="editVentaTbody">
 </tbody>
 </table>
 </div>

 <div style="display: flex; justify-content: flex-end; margin-top: 14px; padding: 14px; background: var(--surface-alt); border-radius: var(--radius-sm);">
 <div style="text-align: right;">
 <div class="kpi-label">Total</div>
 <div style="font-family: var(--font-display); font-size: 28px; font-weight: 700; color: var(--gold);" id="editVentaTotal">
 ${App.fmtMoney(0)}
 </div>
 </div>
 </div>
 `,
 footer: `
 <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
 <button class="btn btn-primary" onclick="App.views.ventas._guardarEdicion()">
 Guardar Cambios
 </button>
 `,
 });
 this._renderEditCarrito();
 setTimeout(() => this._filtrarProductos(), 50);
 },

 _renderHistorialPago(venta) {
 const metodo = venta.metodo_pago || 'efectivo';
 const efectivo = Number(venta.monto_efectivo || 0);
 const tarjeta = Number(venta.monto_tarjeta || 0);
 const pctDesc = Number(venta.descuento_pct || 0);
 const subtotal = Number(venta.subtotal || 0);
 const montoDesc = subtotal * pctDesc / 100;

 // Bloque de descuento (solo si aplicó descuento)
 const bloqueDescuento = pctDesc > 0 ? `
 <div style="padding: 6px 10px; background: rgba(217, 83, 79, 0.08); border-left: 3px solid var(--danger); border-radius: 4px; margin-bottom: 10px;">
 <div style="display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px;">
 <span class="text-muted">Subtotal</span>
 <span>${App.fmtMoney(subtotal)}</span>
 </div>
 <div style="display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px;">
 <span style="color: var(--danger); font-weight: 600;">Descuento (${pctDesc}%)</span>
 <strong style="color: var(--danger);">-${App.fmtMoney(montoDesc)}</strong>
 </div>
 </div>
 ` : '';

 if (metodo === 'efectivo') {
 return `
 ${bloqueDescuento}
 <div style="display: flex; justify-content: space-between; align-items: center;">
 <span> Efectivo</span>
 <strong style="color: var(--gold);">${App.fmtMoney(efectivo > 0 ? efectivo : venta.total)}</strong>
 </div>
 `;
 }
 if (metodo === 'tarjeta') {
 return `
 ${bloqueDescuento}
 <div style="display: flex; justify-content: space-between; align-items: center;">
 <span> Tarjeta</span>
 <strong style="color: var(--gold);">${App.fmtMoney(tarjeta > 0 ? tarjeta : venta.total)}</strong>
 </div>
 `;
 }
 // hibrido
 return `
 ${bloqueDescuento}
 <div style="display: flex; justify-content: space-between; padding: 2px 0;">
 <span> Efectivo</span>
 <strong>${App.fmtMoney(efectivo)}</strong>
 </div>
 <div style="display: flex; justify-content: space-between; padding: 2px 0;">
 <span> Tarjeta</span>
 <strong>${App.fmtMoney(tarjeta)}</strong>
 </div>
 <div style="display: flex; justify-content: space-between; padding: 6px 0 2px; border-top: 1px solid var(--border); margin-top: 4px;">
 <span style="text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em;">Total</span>
 <strong style="color: var(--gold);">${App.fmtMoney(efectivo + tarjeta)}</strong>
 </div>
 `;
 },

 _agregarItem(id) {
 const prod = this.productos.find(p => p.id === id);
 if (!prod) return;
 // Por defecto agrega como "caja". El usuario puede cambiar la unidad
 // en el detalle del carrito mediante el selector inline.
 this._agregarItemFinal(prod, 1, 'caja');
 },

 _cambiarUnidadItem(idx, nuevaUnidad) {
 const item = this.editCarrito[idx];
 if (!item) return;
 if ((item.unidad_venta || 'caja') === nuevaUnidad) return;
 item.unidad_venta = nuevaUnidad;
 // Recalcular precio según unidad (con promo si aplica)
 item.producto.precio_unitario_actual = this._precioParaUnidad(item.producto, nuevaUnidad);
 this._renderEditCarrito();
 },

 _agregarItemFinal(prod, cantidad, unidad) {
 const exist = this.editCarrito.find(c =>
 c.producto.id === prod.id && (c.unidad_venta || 'caja') === unidad
 );
 if (exist) {
 exist.cantidad += cantidad;
 } else {
 this.editCarrito.push({
 producto: { ...prod },
 cantidad: cantidad,
 unidad_venta: unidad,
 });
 }
 const buscar = document.getElementById('editVentaBuscarProd');
 if (buscar) buscar.value = '';
 this._filtrarProductos();
 this._renderEditCarrito();
 },

 _filtrarProductos() {
 const buscar = document.getElementById('editVentaBuscarProd');
 const list = document.getElementById('editVentaProductoList');
 if (!list) return;

 const q = (buscar?.value || '').toLowerCase().trim();
 const filtrados = this.productos.filter(p =>
 !q || p.codigo.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q)
 ).slice(0, 3); // máximo 3 como en cotización

 if (filtrados.length === 0) {
 list.innerHTML = `<div class="picker-empty">Sin resultados. Prueba otro término de búsqueda.</div>`;
 return;
 }

 list.innerHTML = filtrados.map(p => `
 <div class="picker-row" onclick="App.views.ventas._agregarItem(${p.id})">
 <div class="code">${App.escape(p.codigo)}</div>
 <div class="info">
 <div class="name">${App.escape(p.nombre)}</div>
 <div class="stock">Stock: ${p.stock}</div>
 </div>
 <div class="price">${App.fmtMoneyHtml(p.precio_unitario)}</div>
 </div>
 `).join('');
 },

 _cambiarCantidad(id, valor) {
 const item = this.editCarrito.find(c => c.producto.id === id);
 if (!item) return;
 const v = parseInt(valor);
 if (isNaN(v) || v <= 0) {
 this._eliminarItem(id);
 return;
 }
 if (v > item.producto.stock) {
 App.toast(`Stock máximo: ${item.producto.stock}`, 'warning');
 item.cantidad = item.producto.stock;
 } else {
 item.cantidad = v;
 }
 this._renderEditCarrito();
 },

 _eliminarItem(id) {
 this.editCarrito = this.editCarrito.filter(c => c.producto.id !== id);
 this._renderEditCarrito();
 },

 _renderEditCarrito() {
 const tbody = document.getElementById('editVentaTbody');
 if (!tbody) return;
 if (this.editCarrito.length === 0) {
 tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Sin productos</td></tr>`;
 document.getElementById('editVentaTotal').innerHTML = App.fmtMoneyHtml(0);
 return;
 }
 let total = 0;
 tbody.innerHTML = this.editCarrito.map((it, idx) => {
 const unidad = it.unidad_venta || 'caja';
 const vendePiezas = (it.producto.piezas_por_caja || 0) > 0;
 const precioUnit = this._precioParaUnidad(it.producto, unidad);
 const sub = it.cantidad * precioUnit;
 total += sub;

 // Selector de unidad: solo aparece si el producto admite venta por piezas
 const selectorUnidad = vendePiezas ? `
 <select onchange="App.views.ventas._cambiarUnidadItem(${idx}, this.value)"
 style="background: var(--surface-alt); border: 1px solid var(--border); border-radius: 4px; padding: 3px 6px; font-size: 11px; color: inherit; margin-top: 4px; cursor: pointer;">
 <option value="caja" ${unidad === 'caja' ? 'selected' : ''}>📦 Caja</option>
 <option value="pieza" ${unidad === 'pieza' ? 'selected' : ''}>🧱 Pieza</option>
 </select>
 ` : `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">📦 Por unidad</div>`;

 return `
 <tr>
 <td>
 <div style="font-weight: 600;">${App.escape(it.producto.nombre)}</div>
 <code style="font-size: 11px; color: var(--text-muted);">${App.escape(it.producto.codigo)}</code>
 ${selectorUnidad}
 </td>
 <td class="text-center">
 <input type="number" min="1" value="${it.cantidad}"
 class="form-input" style="text-align: center; padding: 6px;"
 onchange="App.views.ventas._cambiarCantidadIdx(${idx}, this.value)">
 </td>
 <td class="text-right">${App.fmtMoney(precioUnit)}</td>
 <td class="text-right" style="color: var(--gold); font-weight: 600;">${App.fmtMoney(sub)}</td>
 <td>
 <button class="btn btn-icon danger" onclick="App.views.ventas._eliminarItemIdx(${idx})">×</button>
 </td>
 </tr>
 `;
 }).join('');
 document.getElementById('editVentaTotal').innerHTML = App.fmtMoneyHtml(total);
 },

 _cambiarCantidadIdx(idx, valor) {
 const item = this.editCarrito[idx];
 if (!item) return;
 const v = parseInt(valor, 10);
 if (isNaN(v) || v <= 0) {
 this._eliminarItemIdx(idx);
 return;
 }
 item.cantidad = v;
 this._renderEditCarrito();
 },

 _eliminarItemIdx(idx) {
 this.editCarrito.splice(idx, 1);
 this._renderEditCarrito();
 },

 async _guardarEdicion() {
 if (this.editCarrito.length === 0) {
 App.toast('La venta debe tener al menos un producto', 'warning');
 return;
 }
 const cliente = document.getElementById('editVentaCliente').value.trim();

 try {
 await App.api('/api/ventas/' + this.editandoId, {
 method: 'PUT',
 body: {
 cliente: cliente,
 items: this.editCarrito.map(c => ({
 producto_id: c.producto.id,
 cantidad: c.cantidad,
 unidad_venta: c.unidad_venta || 'caja',
 })),
 },
 });
 App.toast('Venta actualizada', 'success');
 App.closeModal();
 this.editandoId = null;
 this.editCarrito = [];
 await this.cargar();
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },

 async eliminar(id) {
 const v = this.ventas.find(x => x.id === id);
 if (!await App.confirm({
 title: 'Anular venta',
 message: `¿Anular la venta ${v.folio}? El stock será devuelto.`,
 confirmText: 'Anular',
 danger: true,
 })) return;
 try {
 await App.api('/api/ventas/' + id, { method: 'DELETE' });
 App.toast('Venta anulada', 'success');
 await this.cargar();
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },
};

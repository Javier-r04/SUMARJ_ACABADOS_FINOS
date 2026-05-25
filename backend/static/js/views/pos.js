App.views.pos = {
 productos: [],
 carrito: [], // [{ producto, cantidad }]
 busqueda: '',

 async render(container) {
 container.innerHTML = App.pageHeader(
 'Punto de Venta',
 'Registro rápido de ventas',
 ''
 ) + `
 <div class="pos-grid">
 <div class="card" style="padding: 0;">
 <div class="table-toolbar">
 <input type="text" class="form-input" id="posBuscar"
 placeholder="Buscar por código o nombre…" style="flex: 1;">
 </div>
 <div class="pos-product-list" id="posList">
 <div class="empty-state"><div class="spinner"></div></div>
 </div>
 </div>

 <div class="cart">
 <div class="card-header" style="padding: 14px 18px; margin: 0; border-bottom: 1px solid var(--black-border);">
 <h3 class="card-title">Carrito</h3>
 <button class="btn btn-icon" onclick="App.views.pos.limpiarCarrito()" title="Vaciar">🗑</button>
 </div>

 <div class="form-group" style="padding: 12px 16px 0;">
 <label class="form-label">Cliente <span style="font-weight: 400; color: var(--text-muted); font-size: 11px;">(opcional)</span></label>
 <input class="form-input" id="posCliente" type="text" placeholder="Nombre del cliente">
 </div>

 <div class="cart-items" id="cartItems">
 <div class="cart-empty">Carrito vacío</div>
 </div>

 <div class="cart-summary">
 <div class="cart-total">
 <span class="label">Total</span>
 <span class="value" id="cartTotal">${App.fmtMoneyHtml(0)}</span>
 </div>
 <div class="cart-actions">
 <button class="btn btn-ghost" onclick="App.views.pos.limpiarCarrito()">Cancelar</button>
 <button class="btn btn-primary" onclick="App.views.pos.finalizarVenta()" id="btnFinalizar">
 Cobrar
 </button>
 </div>
 </div>
 </div>
 </div>
 `;

 document.getElementById('posBuscar').addEventListener('input', (e) => {
 this.busqueda = e.target.value.trim();
 this.renderProductos();
 });

 await this.cargarProductos();
 },

 async cargarProductos() {
 try {
 this.productos = await App.api('/api/productos?activo=true');
 this.renderProductos();
 } catch (e) {
 document.getElementById('posList').innerHTML =
 `<div class="alert alert-error">${App.escape(e.message)}</div>`;
 }
 },

 renderProductos() {
 const list = document.getElementById('posList');
 const q = this.busqueda.toLowerCase();
 const filtrados = this.productos.filter(p =>
 !q || p.codigo.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q)
 );

 if (filtrados.length === 0) {
 list.innerHTML = `<div class="empty-state">
 <div class="icon"></div>
 <p>${this.productos.length === 0 ? 'No hay productos registrados' : 'Sin resultados'}</p>
 </div>`;
 return;
 }

 list.innerHTML = filtrados.map(p => {
 return `
 <div class="pos-product-row" onclick="App.views.pos.agregarProducto(${p.id})">
 <div class="code">${App.escape(p.codigo)}</div>
 <div class="info">
 <div class="name">${App.escape(p.nombre)}</div>
 <div class="stock">Stock: ${p.stock} ${p.stock <= p.stock_alerta ? '' : ''}</div>
 </div>
 <div class="price">${App.fmtMoney(p.precio_unitario)}</div>
 </div>
 `;
 }).join('');
 },

 agregarProducto(id) {
 const prod = this.productos.find(p => p.id === id);
 if (!prod) return;
 if (prod.stock <= 0) {
 App.toast('Producto sin stock', 'error');
 return;
 }
 const item = this.carrito.find(c => c.producto.id === id);
 if (item) {
 if (item.cantidad >= prod.stock) {
 App.toast(`Stock máximo alcanzado (${prod.stock})`, 'warning');
 return;
 }
 item.cantidad++;
 } else {
 this.carrito.push({ producto: prod, cantidad: 1 });
 }
 this.renderCarrito();
 },

 cambiarCantidad(id, delta) {
 const item = this.carrito.find(c => c.producto.id === id);
 if (!item) return;
 const nueva = item.cantidad + delta;
 if (nueva <= 0) {
 this.eliminar(id);
 return;
 }
 if (nueva > item.producto.stock) {
 App.toast(`Stock máximo: ${item.producto.stock}`, 'warning');
 return;
 }
 item.cantidad = nueva;
 this.renderCarrito();
 },

 setCantidad(id, valor) {
 const item = this.carrito.find(c => c.producto.id === id);
 if (!item) return;
 const v = parseInt(valor, 10);
 if (isNaN(v) || v <= 0) {
 this.eliminar(id);
 return;
 }
 if (v > item.producto.stock) {
 App.toast(`Stock máximo: ${item.producto.stock}`, 'warning');
 item.cantidad = item.producto.stock;
 } else {
 item.cantidad = v;
 }
 this.renderCarrito();
 },

 eliminar(id) {
 this.carrito = this.carrito.filter(c => c.producto.id !== id);
 this.renderCarrito();
 },

 limpiarCarrito() {
 if (this.carrito.length === 0) return;
 this.carrito = [];
 this.renderCarrito();
 },

 renderCarrito() {
 const items = document.getElementById('cartItems');
 const totalEl = document.getElementById('cartTotal');
 if (this.carrito.length === 0) {
 items.innerHTML = `<div class="cart-empty">Carrito vacío</div>`;
 totalEl.innerHTML = App.fmtMoneyHtml(0);
 return;
 }

 let total = 0;
 items.innerHTML = this.carrito.map(({ producto, cantidad }) => {
 const sub = Number(producto.precio_unitario) * cantidad;
 total += sub;
 return `
 <div class="cart-item">
 <div class="top">
 <div class="name">${App.escape(producto.nombre)}</div>
 <button class="remove" onclick="App.views.pos.eliminar(${producto.id})"></button>
 </div>
 <div class="bottom">
 <div class="qty-controls">
 <button onclick="App.views.pos.cambiarCantidad(${producto.id}, -1)">−</button>
 <input type="number" value="${cantidad}" min="1" max="${producto.stock}"
 onchange="App.views.pos.setCantidad(${producto.id}, this.value)">
 <button onclick="App.views.pos.cambiarCantidad(${producto.id}, 1)">+</button>
 </div>
 <div class="subtotal">${App.fmtMoney(sub)}</div>
 </div>
 </div>
 `;
 }).join('');

 totalEl.innerHTML = App.fmtMoneyHtml(total);
 },

 async finalizarVenta() {
 if (this.carrito.length === 0) {
 App.toast('El carrito está vacío', 'warning');
 return;
 }

 // Calcular el total
 const total = this.carrito.reduce((sum, c) =>
 sum + (Number(c.producto.precio_unitario) * c.cantidad), 0);

 // Abrir modal de cobro
 App.openModal({
 title: 'Cobrar Venta',
 body: `
 <div style="text-align: center; padding: 12px 0 20px; border-bottom: 1px solid var(--border); margin-bottom: 20px;">
 <div class="kpi-label">Total a Cobrar</div>
 <div style="font-family: var(--font-display); font-size: 48px; font-weight: 700; color: var(--gold); line-height: 1.1; margin-top: 4px;">
 ${App.fmtMoneyHtml(total)}
 </div>
 </div>

 <div class="form-group">
 <label class="form-label">Método de Pago</label>
 <div class="chip-group" style="display: flex; width: 100%;">
 <button class="chip active" data-pago="efectivo" style="flex: 1;" onclick="App.views.pos._selectPago('efectivo')"> Efectivo</button>
 <button class="chip" data-pago="tarjeta" style="flex: 1;" onclick="App.views.pos._selectPago('tarjeta')"> Tarjeta</button>
 <button class="chip" data-pago="hibrido" style="flex: 1;" onclick="App.views.pos._selectPago('hibrido')"> Dividido</button>
 </div>
 </div>

 <!-- Bloque para EFECTIVO puro o pago HÍBRIDO efectivo -->
 <div id="bloqueEfectivo" class="form-group">
 <label class="form-label" id="lblMontoEfectivo">Monto Recibido en Efectivo</label>
 <input type="number" class="form-input" id="posMontoEfectivo"
 placeholder="0.00" step="0.01" min="0"
 style="font-size: 22px; padding: 14px; text-align: center; font-family: var(--font-display); font-weight: 600;"
 oninput="App.views.pos._calcular()">
 <div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;" id="quickAmounts">
 <button class="btn btn-ghost btn-sm" onclick="App.views.pos._montoRapido(${total})" style="flex: 1;">Exacto</button>
 <button class="btn btn-ghost btn-sm" onclick="App.views.pos._montoRapido(${Math.ceil(total / 50) * 50})" style="flex: 1;">${App.fmtMoney(Math.ceil(total / 50) * 50)}</button>
 <button class="btn btn-ghost btn-sm" onclick="App.views.pos._montoRapido(${Math.ceil(total / 100) * 100})" style="flex: 1;">${App.fmtMoney(Math.ceil(total / 100) * 100)}</button>
 <button class="btn btn-ghost btn-sm" onclick="App.views.pos._montoRapido(${Math.ceil(total / 500) * 500})" style="flex: 1;">${App.fmtMoney(Math.ceil(total / 500) * 500)}</button>
 </div>
 </div>

 <!-- Bloque para TARJETA (puro o híbrido) -->
 <div id="bloqueTarjeta" class="form-group" style="display: none;">
 <label class="form-label" id="lblMontoTarjeta">Monto Cobrado en Tarjeta</label>
 <input type="number" class="form-input" id="posMontoTarjeta"
 placeholder="0.00" step="0.01" min="0"
 style="font-size: 22px; padding: 14px; text-align: center; font-family: var(--font-display); font-weight: 600;"
 oninput="App.views.pos._calcular()">
 </div>

 <!-- Resumen de cobro híbrido -->
 <div id="resumenHibrido" style="display: none; padding: 14px; background: var(--surface-alt); border-radius: var(--radius-sm); margin-top: 16px;">
 <div class="kpi-label" style="margin-bottom: 10px;">Desglose del pago</div>
 <div style="display: flex; justify-content: space-between; padding: 4px 0;">
 <span> Efectivo recibido</span>
 <strong id="resEfectivo">${App.fmtMoney(0)}</strong>
 </div>
 <div style="display: flex; justify-content: space-between; padding: 4px 0;">
 <span> Tarjeta</span>
 <strong id="resTarjeta">${App.fmtMoney(0)}</strong>
 </div>
 <div style="display: flex; justify-content: space-between; padding: 4px 0; border-top: 1px solid var(--border); margin-top: 4px; padding-top: 8px;">
 <span>Total cubierto</span>
 <strong id="resCubierto" style="color: var(--gold);">${App.fmtMoney(0)}</strong>
 </div>
 </div>

 <div id="cambioBox" style="display: none; padding: 16px; background: var(--surface-alt); border-radius: var(--radius-sm); border-left: 4px solid var(--success); margin-top: 16px;">
 <div style="display: flex; justify-content: space-between; align-items: center;">
 <div class="kpi-label">Cambio a Entregar</div>
 <div style="font-family: var(--font-display); font-size: 32px; font-weight: 700; color: var(--success);" id="cambioMonto">
 ${App.fmtMoney(0)}
 </div>
 </div>
 </div>

 <div id="faltaBox" style="display: none; padding: 12px; background: rgba(217,83,79,0.08); border-radius: var(--radius-sm); border-left: 4px solid var(--danger); margin-top: 16px;">
 <div style="display: flex; justify-content: space-between; align-items: center;">
 <div style="color: var(--danger); font-weight: 600;">Falta:</div>
 <div style="font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--danger);" id="faltaMonto">
 ${App.fmtMoney(0)}
 </div>
 </div>
 </div>
 `,
 footer: `
 <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
 <button class="btn btn-primary" id="btnConfirmarCobro" onclick="App.views.pos._confirmarCobro()" disabled>
 Confirmar Venta
 </button>
 `,
 });

 // Estado del modal
 this._totalCobrar = total;
 this._metodoPago = 'efectivo';
 this._montoEfectivo = 0;
 this._montoTarjeta = 0;

 // Foco en el input
 setTimeout(() => {
 const el = document.getElementById('posMontoEfectivo');
 if (el) el.focus();
 }, 100);
 },

 _selectPago(metodo) {
 this._metodoPago = metodo;
 document.querySelectorAll('[data-pago]').forEach(c => c.classList.remove('active'));
 document.querySelector(`[data-pago="${metodo}"]`).classList.add('active');

 const bloqueEfectivo = document.getElementById('bloqueEfectivo');
 const bloqueTarjeta = document.getElementById('bloqueTarjeta');
 const resumenHibrido = document.getElementById('resumenHibrido');
 const inputEfectivo = document.getElementById('posMontoEfectivo');
 const inputTarjeta = document.getElementById('posMontoTarjeta');

 if (metodo === 'efectivo') {
 bloqueEfectivo.style.display = '';
 bloqueTarjeta.style.display = 'none';
 resumenHibrido.style.display = 'none';
 document.getElementById('lblMontoEfectivo').textContent = 'Monto Recibido en Efectivo';
 document.getElementById('quickAmounts').style.display = 'flex';
 inputTarjeta.value = '';
 setTimeout(() => inputEfectivo.focus(), 50);
 } else if (metodo === 'tarjeta') {
 bloqueEfectivo.style.display = 'none';
 bloqueTarjeta.style.display = '';
 resumenHibrido.style.display = 'none';
 // Con tarjeta el monto es exacto: lo precargamos
 inputTarjeta.value = this._totalCobrar.toFixed(2);
 inputEfectivo.value = '';
 setTimeout(() => inputTarjeta.focus(), 50);
 } else if (metodo === 'hibrido') {
 bloqueEfectivo.style.display = '';
 bloqueTarjeta.style.display = '';
 resumenHibrido.style.display = 'block';
 document.getElementById('lblMontoEfectivo').textContent = 'Parte en Efectivo';
 document.getElementById('quickAmounts').style.display = 'none';
 inputEfectivo.value = '';
 inputTarjeta.value = '';
 setTimeout(() => inputEfectivo.focus(), 50);
 }

 this._calcular();
 },

 _montoRapido(valor) {
 document.getElementById('posMontoEfectivo').value = valor.toFixed(2);
 this._calcular();
 },

 _calcular() {
 const efectivo = parseFloat(document.getElementById('posMontoEfectivo').value) || 0;
 const tarjeta = parseFloat(document.getElementById('posMontoTarjeta').value) || 0;
 this._montoEfectivo = efectivo;
 this._montoTarjeta = tarjeta;

 const total = this._totalCobrar;
 const metodo = this._metodoPago;

 const cambioBox = document.getElementById('cambioBox');
 const faltaBox = document.getElementById('faltaBox');
 const btnConfirmar = document.getElementById('btnConfirmarCobro');

 let cubierto, faltante, cambio;

 if (metodo === 'efectivo') {
 cubierto = efectivo;
 cambio = Math.max(0, efectivo - total);
 faltante = Math.max(0, total - efectivo);
 } else if (metodo === 'tarjeta') {
 cubierto = tarjeta;
 cambio = 0; // con tarjeta no hay cambio físico
 faltante = Math.max(0, total - tarjeta);
 } else {
 // híbrido
 cubierto = efectivo + tarjeta;
 // El cambio es solo del exceso de efectivo (no se puede dar cambio de tarjeta)
 // Si la tarjeta cubre lo necesario y sobra efectivo, ese sobrante es cambio
 const restanteTrasTarjeta = Math.max(0, total - tarjeta);
 cambio = Math.max(0, efectivo - restanteTrasTarjeta);
 faltante = Math.max(0, total - cubierto);

 // Actualizar resumen híbrido
 document.getElementById('resEfectivo').innerHTML = App.fmtMoneyHtml(efectivo);
 document.getElementById('resTarjeta').innerHTML = App.fmtMoneyHtml(tarjeta);
 document.getElementById('resCubierto').innerHTML = App.fmtMoneyHtml(cubierto);
 }

 // Mostrar/ocultar boxes
 if (cubierto === 0) {
 cambioBox.style.display = 'none';
 faltaBox.style.display = 'none';
 btnConfirmar.disabled = true;
 } else if (faltante > 0) {
 cambioBox.style.display = 'none';
 faltaBox.style.display = 'block';
 document.getElementById('faltaMonto').innerHTML = App.fmtMoneyHtml(faltante);
 btnConfirmar.disabled = true;
 } else {
 faltaBox.style.display = 'none';
 if (cambio > 0) {
 cambioBox.style.display = 'block';
 document.getElementById('cambioMonto').innerHTML = App.fmtMoneyHtml(cambio);
 } else {
 cambioBox.style.display = 'none';
 }
 btnConfirmar.disabled = false;
 }
 },

 async _confirmarCobro() {
 const total = this._totalCobrar;
 const cubierto = (this._metodoPago === 'tarjeta')
 ? this._montoTarjeta
 : (this._metodoPago === 'efectivo')
 ? this._montoEfectivo
 : (this._montoEfectivo + this._montoTarjeta);

 if (cubierto < total) {
 App.toast('El monto cubierto es insuficiente', 'warning');
 return;
 }

 // Validación adicional para híbrido: ambos campos deben tener algo > 0
 if (this._metodoPago === 'hibrido') {
 if (this._montoEfectivo <= 0 || this._montoTarjeta <= 0) {
 App.toast('Para pago dividido debes indicar montos en efectivo y tarjeta', 'warning');
 return;
 }
 }

 const btn = document.getElementById('btnConfirmarCobro');
 btn.disabled = true;
 btn.innerHTML = '<span class="spinner"></span> Procesando…';

 try {
 const venta = await App.api('/api/ventas', {
 method: 'POST',
 body: {
 cliente: document.getElementById('posCliente').value.trim(),
 metodo_pago: this._metodoPago,
 monto_efectivo: this._montoEfectivo,
 monto_tarjeta: this._montoTarjeta,
 items: this.carrito.map(c => ({
 producto_id: c.producto.id,
 cantidad: c.cantidad,
 })),
 },
 });

 const metodoPago = this._metodoPago;
 const efectivo = this._montoEfectivo;
 const tarjeta = this._montoTarjeta;

 // Calcular cambio según método
 let cambio = 0;
 if (metodoPago === 'efectivo') {
 cambio = Math.max(0, efectivo - this._totalCobrar);
 } else if (metodoPago === 'hibrido') {
 const restanteTrasTarjeta = Math.max(0, this._totalCobrar - tarjeta);
 cambio = Math.max(0, efectivo - restanteTrasTarjeta);
 }

 // Limpiar carrito
 this.carrito = [];
 this.renderCarrito();
 document.getElementById('posCliente').value = '';
 await this.cargarProductos();

 App.toast(`Venta ${venta.folio} registrada`, 'success');

 // Mostrar resumen con opción de imprimir
 this._mostrarResumenVenta(venta, metodoPago, efectivo, tarjeta, cambio);

 } catch (e) {
 App.toast('Error: ' + e.message, 'error');
 btn.disabled = false;
 btn.innerHTML = 'Confirmar Venta';
 }
 },

 _mostrarResumenVenta(venta, metodoPago, efectivo, tarjeta, cambio) {
 const labelPago = metodoPago === 'efectivo' ? ' Efectivo'
 : metodoPago === 'tarjeta' ? ' Tarjeta'
 : ' Dividido (Efectivo + Tarjeta)';

 App.openModal({
 title: ' Venta Registrada',
 body: `
 <div style="text-align: center; padding: 20px 0;">
 <div style="width: 70px; height: 70px; border-radius: 50%; background: rgba(92,184,92,0.15); color: var(--success); display: grid; place-items: center; margin: 0 auto 16px; font-size: 36px;">
 
 </div>
 <div style="font-family: var(--font-display); font-size: 28px; font-weight: 700; color: var(--gold);">
 ${App.escape(venta.folio)}
 </div>
 <div class="text-muted" style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 11px; margin-top: 4px;">
 Folio de venta
 </div>
 </div>

 <div style="background: var(--surface-alt); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 20px;">
 <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border);">
 <span class="text-muted">Total de la venta</span>
 <strong>${App.fmtMoney(venta.total)}</strong>
 </div>
 <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border);">
 <span class="text-muted">Método de pago</span>
 <strong>${labelPago}</strong>
 </div>

 ${metodoPago === 'efectivo' ? `
 <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border);">
 <span class="text-muted">Efectivo recibido</span>
 <strong>${App.fmtMoney(efectivo)}</strong>
 </div>
 ` : ''}

 ${metodoPago === 'tarjeta' ? `
 <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border);">
 <span class="text-muted">Cobrado con tarjeta</span>
 <strong>${App.fmtMoney(tarjeta)}</strong>
 </div>
 ` : ''}

 ${metodoPago === 'hibrido' ? `
 <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border);">
 <span class="text-muted"> En efectivo</span>
 <strong>${App.fmtMoney(efectivo)}</strong>
 </div>
 <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border);">
 <span class="text-muted"> Con tarjeta</span>
 <strong>${App.fmtMoney(tarjeta)}</strong>
 </div>
 ` : ''}

 ${cambio > 0 ? `
 <div style="display: flex; justify-content: space-between; padding: 10px 0 4px; font-size: 18px;">
 <span style="color: var(--success); font-weight: 600;">Cambio a entregar</span>
 <strong style="color: var(--success); font-family: var(--font-display); font-size: 26px;">${App.fmtMoneyHtml(cambio)}</strong>
 </div>
 ` : ''}
 </div>

 <div style="text-align: center; color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;">
 ¿Desea imprimir el ticket de venta?
 </div>
 `,
 footer: `
 <button class="btn btn-ghost" onclick="App.closeModal()">No, solo cerrar</button>
 <button class="btn btn-primary" onclick="App.views.pos._imprimirTicket(${venta.id})">
 Sí, imprimir ticket
 </button>
 `,
 });
 },

 async _imprimirTicket(ventaId) {
 try {
 const venta = await App.api('/api/ventas/' + ventaId);
 App.generarPDFDocumento({
 tipo: 'TICKET DE VENTA',
 folio: venta.folio,
 cliente: venta.cliente,
 cliente_telefono: '',
 cliente_correo: '',
 fecha: venta.fecha,
 vigencia_dias: null,
 detalles: venta.detalles,
 total: venta.total,
 filename: `ticket_${venta.folio}.pdf`,
 pieMensaje: '¡Gracias por su compra!',
 });
 App.closeModal();
 } catch (e) {
 App.toast('Error: ' + e.message, 'error');
 }
 },
};

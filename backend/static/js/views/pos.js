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
 <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px;">
 <span class="text-muted">Subtotal</span>
 <span id="cartSubtotal">${App.fmtMoneyHtml(0)}</span>
 </div>
 <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 12px; gap: 8px;">
 <span class="text-muted">Descuento</span>
 <div style="display: flex; align-items: center; gap: 6px;">
 <input id="cartDescuento" type="number" min="0" max="40" step="1"
 value="0"
 oninput="App.views.pos.cambiarDescuento(this)"
 style="width: 60px; text-align: center; padding: 4px 6px; background: var(--surface-alt); border: 1px solid var(--border); border-radius: 4px; color: inherit; font-weight: 600;">
 <span style="font-weight: 600;">%</span>
 </div>
 </div>
 <div id="cartDescuentoRow" style="display: none; justify-content: space-between; padding: 4px 0 8px; font-size: 12px;">
 <span class="text-muted">Monto descuento</span>
 <span style="color: var(--danger);" id="cartDescuentoMonto">-${App.fmtMoneyHtml(0)}</span>
 </div>
 <div class="cart-total" style="border-top: 2px solid var(--border); padding-top: 8px;">
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

 const vendePiezas = (prod.piezas_por_caja || 0) > 0;
 const totalPiezas = vendePiezas
 ? (prod.stock * prod.piezas_por_caja) + (prod.stock_piezas_sueltas || 0)
 : 0;

 // Stock disponible base
 if (!vendePiezas && prod.stock <= 0) {
 App.toast('Producto sin stock', 'error');
 return;
 }
 if (vendePiezas && prod.stock <= 0 && totalPiezas <= 0) {
 App.toast('Producto sin stock', 'error');
 return;
 }

 // Producto SIMPLE (sin venta por piezas) — flujo de siempre
 if (!vendePiezas) {
 this._agregarItemCarrito(prod, 1, 'caja');
 return;
 }

 // Producto con venta DUAL — abrir modal selector
 this._modalSeleccionUnidad(prod, totalPiezas);
 },

 _modalSeleccionUnidad(prod, totalPiezas) {
 const puedeCaja = prod.stock > 0;
 const puedePieza = totalPiezas > 0;

 App.openModal({
 title: `Agregar: ${prod.nombre}`,
 body: `
 <div style="text-align: center; padding: 4px 0 16px;">
 <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: 4px;">Disponible</div>
 <div style="font-family: var(--font-display); font-size: 22px; font-weight: 600;">
 ${prod.stock} cajas · ${totalPiezas} piezas totales
 </div>
 </div>

 <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); font-weight: 600; margin-bottom: 10px;">
 ¿Cómo desea venderlo?
 </div>

 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px;">
 <button class="btn ${puedeCaja ? 'btn-ghost' : ''}" id="btnUnidCaja"
 ${puedeCaja ? '' : 'disabled'}
 onclick="App.views.pos._setUnidad('caja')"
 style="padding: 16px; flex-direction: column; gap: 4px; border: 2px solid var(--gold); ${puedeCaja ? '' : 'opacity: 0.5;'}">
 <div style="font-size: 22px;">📦</div>
 <div style="font-weight: 700;">Por Caja</div>
 <div style="font-size: 12px; color: var(--gold);">${App.fmtMoney(prod.precio_unitario)}</div>
 </button>
 <button class="btn ${puedePieza ? 'btn-ghost' : ''}" id="btnUnidPieza"
 ${puedePieza ? '' : 'disabled'}
 onclick="App.views.pos._setUnidad('pieza')"
 style="padding: 16px; flex-direction: column; gap: 4px; border: 2px solid transparent; ${puedePieza ? '' : 'opacity: 0.5;'}">
 <div style="font-size: 22px;">🧱</div>
 <div style="font-weight: 700;">Por Pieza</div>
 <div style="font-size: 12px; color: var(--gold);">${App.fmtMoney(prod.precio_pieza)}${prod.precio_pieza_promo ? ' ★' : ''}</div>
 </button>
 </div>

 <div class="form-group">
 <label class="form-label">Cantidad</label>
 <input class="form-input" type="number" id="posCantidadModal" min="1" value="1"
 style="font-size: 22px; padding: 14px; text-align: center; font-family: var(--font-display); font-weight: 600;">
 </div>
 `,
 footer: `
 <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
 <button class="btn btn-primary" onclick="App.views.pos._confirmarAgregar(${prod.id})" id="btnAgregarUnid">
 Agregar al Carrito
 </button>
 `,
 });

 // Estado inicial: la caja seleccionada (si se puede)
 this._unidadSeleccionada = puedeCaja ? 'caja' : 'pieza';
 setTimeout(() => this._actualizarBotonesUnidad(), 30);
 },

 _setUnidad(unidad) {
 this._unidadSeleccionada = unidad;
 this._actualizarBotonesUnidad();
 },

 _actualizarBotonesUnidad() {
 const bCaja = document.getElementById('btnUnidCaja');
 const bPieza = document.getElementById('btnUnidPieza');
 if (!bCaja || !bPieza) return;
 if (this._unidadSeleccionada === 'caja') {
 bCaja.style.borderColor = 'var(--gold)';
 bCaja.style.background = 'rgba(212, 175, 55, 0.08)';
 bPieza.style.borderColor = 'transparent';
 bPieza.style.background = '';
 } else {
 bPieza.style.borderColor = 'var(--gold)';
 bPieza.style.background = 'rgba(212, 175, 55, 0.08)';
 bCaja.style.borderColor = 'transparent';
 bCaja.style.background = '';
 }
 },

 _confirmarAgregar(prodId) {
 const prod = this.productos.find(p => p.id === prodId);
 if (!prod) return;
 const cant = parseInt(document.getElementById('posCantidadModal').value) || 0;
 if (cant <= 0) {
 App.toast('Cantidad inválida', 'warning');
 return;
 }
 const unidad = this._unidadSeleccionada || 'caja';

 // Validar stock disponible para esta unidad
 if (unidad === 'caja') {
 if (cant > prod.stock) {
 App.toast(`Solo hay ${prod.stock} cajas disponibles`, 'warning');
 return;
 }
 } else {
 const totalPiezas = (prod.stock * prod.piezas_por_caja) + (prod.stock_piezas_sueltas || 0);
 if (cant > totalPiezas) {
 App.toast(`Solo hay ${totalPiezas} piezas disponibles`, 'warning');
 return;
 }
 }

 this._agregarItemCarrito(prod, cant, unidad);
 App.closeModal();
 },

 /**
  * Agrega un item al carrito. Si ya existe el mismo producto+unidad, suma cantidad.
  * Si existe el mismo producto pero con OTRA unidad, lo trata como item separado.
  */
 _agregarItemCarrito(prod, cantidad, unidad) {
 const item = this.carrito.find(c => c.producto.id === prod.id && (c.unidad_venta || 'caja') === unidad);
 if (item) {
 item.cantidad += cantidad;
 } else {
 this.carrito.push({
 producto: prod,
 cantidad: cantidad,
 unidad_venta: unidad,
 });
 }
 this.renderCarrito();
 },

 // Versiones por índice (necesarias porque el mismo producto puede estar en
 // el carrito 2 veces: una como caja y otra como pieza)
 cambiarCantidadItem(idx, delta) {
 const item = this.carrito[idx];
 if (!item) return;
 const nueva = item.cantidad + delta;
 if (nueva <= 0) {
 this.eliminarItem(idx);
 return;
 }
 const max = this._maxCantidadDisponible(item);
 if (nueva > max) {
 App.toast(`Máximo disponible: ${max}`, 'warning');
 return;
 }
 item.cantidad = nueva;
 this.renderCarrito();
 },

 setCantidadItem(idx, valor) {
 const item = this.carrito[idx];
 if (!item) return;
 const v = parseInt(valor, 10);
 if (isNaN(v) || v <= 0) {
 this.eliminarItem(idx);
 return;
 }
 const max = this._maxCantidadDisponible(item);
 if (v > max) {
 App.toast(`Máximo disponible: ${max}`, 'warning');
 item.cantidad = max;
 } else {
 item.cantidad = v;
 }
 this.renderCarrito();
 },

 eliminarItem(idx) {
 this.carrito.splice(idx, 1);
 this.renderCarrito();
 },

 /**
  * Calcula cuántas cajas/piezas puede tener este item considerando
  * que otros items del carrito ya están consumiendo del mismo producto
  * en distintas unidades.
  */
 _maxCantidadDisponible(item) {
 const prod = item.producto;
 const unidad = item.unidad_venta || 'caja';
 // Sumamos consumo de OTROS items del mismo producto
 let consumoCajasOtros = 0;
 let consumoPiezasOtros = 0;
 this.carrito.forEach((c) => {
 if (c === item) return;
 if (c.producto.id !== prod.id) return;
 if ((c.unidad_venta || 'caja') === 'caja') consumoCajasOtros += c.cantidad;
 else consumoPiezasOtros += c.cantidad;
 });
 if (unidad === 'caja') {
 return Math.max(0, prod.stock - consumoCajasOtros);
 }
 // unidad pieza
 const totalPiezasDisp = (prod.stock * prod.piezas_por_caja) + (prod.stock_piezas_sueltas || 0);
 // Cada caja "ya en carrito" reserva piezas_por_caja piezas
 const piezasReservadasPorCajas = consumoCajasOtros * prod.piezas_por_caja;
 return Math.max(0, totalPiezasDisp - piezasReservadasPorCajas - consumoPiezasOtros);
 },

 limpiarCarrito() {
 if (this.carrito.length === 0) return;
 this.carrito = [];
 const inp = document.getElementById('cartDescuento');
 if (inp) inp.value = 0;
 this.renderCarrito();
 },

 renderCarrito() {
 const items = document.getElementById('cartItems');
 const totalEl = document.getElementById('cartTotal');
 const subtotalEl = document.getElementById('cartSubtotal');
 const descRow = document.getElementById('cartDescuentoRow');
 const descMonto = document.getElementById('cartDescuentoMonto');

 if (this.carrito.length === 0) {
 items.innerHTML = `<div class="cart-empty">Carrito vacío</div>`;
 if (subtotalEl) subtotalEl.innerHTML = App.fmtMoneyHtml(0);
 if (descRow) descRow.style.display = 'none';
 totalEl.innerHTML = App.fmtMoneyHtml(0);
 return;
 }

 let subtotal = 0;
 items.innerHTML = this.carrito.map((item, idx) => {
 const { producto, cantidad } = item;
 const unidad = item.unidad_venta || 'caja';
 const precio = unidad === 'pieza'
 ? Number(producto.precio_pieza)
 : Number(producto.precio_unitario);
 const sub = precio * cantidad;
 subtotal += sub;
 const etiquetaUnidad = unidad === 'pieza'
 ? `🧱 Por pieza (${App.fmtMoney(precio)} c/u)`
 : `📦 Por caja (${App.fmtMoney(precio)} c/u)`;
 return `
 <div class="cart-item">
 <div class="top">
 <div class="name">
 ${App.escape(producto.nombre)}
 <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px; font-weight: normal;">
 ${etiquetaUnidad}
 </div>
 </div>
 <button class="remove" onclick="App.views.pos.eliminarItem(${idx})"></button>
 </div>
 <div class="bottom">
 <div class="qty-controls">
 <button onclick="App.views.pos.cambiarCantidadItem(${idx}, -1)">−</button>
 <input type="number" value="${cantidad}" min="1"
 onchange="App.views.pos.setCantidadItem(${idx}, this.value)">
 <button onclick="App.views.pos.cambiarCantidadItem(${idx}, 1)">+</button>
 </div>
 <div class="subtotal">${App.fmtMoney(sub)}</div>
 </div>
 </div>
 `;
 }).join('');

 // Aplicar descuento
 const pct = this._obtenerDescuento();
 const montoDesc = subtotal * (pct / 100);
 const total = subtotal - montoDesc;

 if (subtotalEl) subtotalEl.innerHTML = App.fmtMoneyHtml(subtotal);
 if (descRow && descMonto) {
 if (pct > 0) {
 descRow.style.display = 'flex';
 descMonto.innerHTML = '-' + App.fmtMoneyHtml(montoDesc);
 } else {
 descRow.style.display = 'none';
 }
 }
 totalEl.innerHTML = App.fmtMoneyHtml(total);
 },

 _obtenerDescuento() {
 const input = document.getElementById('cartDescuento');
 if (!input) return 0;
 let v = parseFloat(input.value) || 0;
 if (v < 0) v = 0;
 if (v > 40) v = 40;
 return v;
 },

 cambiarDescuento(input) {
 let v = parseFloat(input.value) || 0;
 if (v < 0) { v = 0; input.value = 0; }
 if (v > 40) {
 v = 40;
 input.value = 40;
 App.toast('Descuento máximo: 40%', 'warning');
 }
 this.renderCarrito();
 },

 async finalizarVenta() {
 if (this.carrito.length === 0) {
 App.toast('El carrito está vacío', 'warning');
 return;
 }

 // Calcular el subtotal y aplicar descuento (usando precio según unidad)
 const subtotal = this.carrito.reduce((sum, c) => {
 const unidad = c.unidad_venta || 'caja';
 const precio = unidad === 'pieza'
 ? Number(c.producto.precio_pieza)
 : Number(c.producto.precio_unitario);
 return sum + (precio * c.cantidad);
 }, 0);
 const pctDesc = this._obtenerDescuento();
 const total = subtotal - (subtotal * pctDesc / 100);

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
 descuento_pct: this._obtenerDescuento(),
 items: this.carrito.map(c => ({
 producto_id: c.producto.id,
 cantidad: c.cantidad,
 unidad_venta: c.unidad_venta || 'caja',
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
 const inpDesc = document.getElementById('cartDescuento');
 if (inpDesc) inpDesc.value = 0;
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
 subtotal: venta.subtotal,
 descuento_pct: venta.descuento_pct,
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

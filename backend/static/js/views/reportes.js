App.views.reportes = {
 filtroTipo: 'ventas',
 filtroRango: 'mes',
 desde: '',
 hasta: '',
 busqueda: '',
 datos: null,

 async render(container) {
 // Inicializar fechas por defecto (último mes)
 const hoy = new Date();
 const haceUnMes = new Date();
 haceUnMes.setMonth(haceUnMes.getMonth() - 1);
 this.desde = haceUnMes.toISOString().slice(0, 10);
 this.hasta = hoy.toISOString().slice(0, 10);

 container.innerHTML = App.pageHeader(
 'Reportes',
 'Análisis detallado de movimientos',
 `<button class="btn btn-primary" onclick="App.views.reportes.exportarPDF()"> Exportar PDF</button>`
 ) + `
 <div class="filter-bar" style="grid-template-columns: 1fr; gap: 18px;">
 <div style="display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: end;">
 <div>
 <div class="form-label">Tipo</div>
 <div class="chip-group">
 <button class="chip active" data-tipo="ventas">Ventas</button>
 <button class="chip" data-tipo="compras">Compras</button>
 <button class="chip" data-tipo="balance"> Balance General</button>
 <button class="chip" data-tipo="vendedor">Por Vendedor</button>
 </div>
 </div>
 <div>
 <div class="form-label">Búsqueda</div>
 <input type="text" class="form-input" id="repBuscar" placeholder="Producto, cliente o proveedor…">
 </div>
 <div>
 <button class="btn btn-primary" onclick="App.views.reportes.cargar()">Aplicar filtros</button>
 </div>
 </div>

 <div style="display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: end;">
 <div>
 <div class="form-label">Rango</div>
 <div class="chip-group">
 <button class="chip" data-rango="dia">Día</button>
 <button class="chip" data-rango="semana">Semana</button>
 <button class="chip active" data-rango="mes">Mes</button>
 <button class="chip" data-rango="rango">Personalizado</button>
 </div>
 </div>
 <div id="rangoPersonalizado" style="display: none; grid-template-columns: 1fr 1fr; gap: 12px;">
 <div>
 <div class="form-label">Desde</div>
 <input type="date" class="form-input" id="repDesde" value="${this.desde}">
 </div>
 <div>
 <div class="form-label">Hasta</div>
 <input type="date" class="form-input" id="repHasta" value="${this.hasta}">
 </div>
 </div>
 </div>
 </div>

 <div class="kpi-grid" id="repKpis" style="display: none;">
 <div class="kpi" id="repKpi1">
 <div class="kpi-label" id="repKpi1Label">Total Acumulado</div>
 <div class="kpi-value" id="repTotal"><span class="currency-symbol">$</span>0.00</div>
 </div>
 <div class="kpi" id="repKpi2">
 <div class="kpi-label" id="repKpi2Label">Movimientos</div>
 <div class="kpi-value" id="repCount">0</div>
 </div>
 <div class="kpi" id="repKpiGanancias">
 <div class="kpi-label" id="repKpi3Label">Ganancias del Periodo</div>
 <div class="kpi-value" id="repGanancias"><span class="currency-symbol">$</span>0.00</div>
 <div class="kpi-sub" id="repKpi3Sub">Ventas − Compras del rango</div>
 </div>
 </div>

 <div class="table-container">
 <table class="table" id="repTabla">
 <thead>
 <tr>
 <th id="repColTipo" style="display: none;">Tipo</th>
 <th>Folio</th>
 <th>Productos</th>
 <th id="repColCliente">Cliente</th>
 <th>Fecha</th>
 <th class="text-right">Total</th>
 </tr>
 </thead>
 <tbody id="repTbody">
 <tr class="empty-row"><td colspan="6">Aplica los filtros para ver resultados</td></tr>
 </tbody>
 </table>
 </div>
 `;

 // Listeners
 document.querySelectorAll('[data-tipo]').forEach(chip => {
 chip.addEventListener('click', () => {
 document.querySelectorAll('[data-tipo]').forEach(c => c.classList.remove('active'));
 chip.classList.add('active');
 this.filtroTipo = chip.dataset.tipo;
 // Ajustar etiqueta de columna cliente/proveedor
 const col = document.getElementById('repColCliente');
 if (this.filtroTipo === 'ventas') col.textContent = 'Cliente';
 else if (this.filtroTipo === 'compras') col.textContent = 'Proveedor';
 else col.textContent = 'Cliente / Proveedor';
 });
 });
 document.querySelectorAll('[data-rango]').forEach(chip => {
 chip.addEventListener('click', () => {
 document.querySelectorAll('[data-rango]').forEach(c => c.classList.remove('active'));
 chip.classList.add('active');
 this.filtroRango = chip.dataset.rango;
 document.getElementById('rangoPersonalizado').style.display =
 this.filtroRango === 'rango' ? 'grid' : 'none';
 });
 });
 document.getElementById('repBuscar').addEventListener('keypress', (e) => {
 if (e.key === 'Enter') this.cargar();
 });

 await this.cargar();
 },

 async cargar() {
 const tbody = document.getElementById('repTbody');
 tbody.innerHTML = `<tr class="empty-row"><td colspan="5"><span class="spinner"></span></td></tr>`;

 // Reporte por vendedor tiene flujo separado
 if (this.filtroTipo === 'vendedor') {
 await this._cargarPorVendedor();
 return;
 }

 try {
 const params = new URLSearchParams();
 params.set('tipo', this.filtroTipo);
 params.set('rango', this.filtroRango);

 // Restaurar encabezados originales (por si veníamos del modo "Por Vendedor")
 const thead = document.querySelector('#repTabla thead tr');
 if (thead) {
 thead.innerHTML = `
 <th id="repColTipo" style="display: none;">Tipo</th>
 <th>Folio</th>
 <th>Productos</th>
 <th id="repColCliente">Cliente</th>
 <th>Fecha</th>
 <th class="text-right">Total</th>
 `;
 }
 // Offset horario del navegador en minutos
 // getTimezoneOffset devuelve minutos en sentido inverso:
 // UTC-6 (Guatemala/México Centro) → devuelve +360
 // UTC+0 (Londres) → devuelve 0
 // UTC+2 (Madrid verano) → devuelve -120
 params.set('tz_offset', String(new Date().getTimezoneOffset()));
 if (this.filtroRango === 'rango') {
 params.set('desde', document.getElementById('repDesde').value);
 params.set('hasta', document.getElementById('repHasta').value);
 }
 const q = document.getElementById('repBuscar').value.trim();
 if (q) params.set('q', q);

 this.datos = await App.api('/api/reportes?' + params.toString());

 // KPIs (cambian según el tipo)
 document.getElementById('repKpis').style.display = 'grid';
 const esBalance = this.filtroTipo === 'balance';

 const kpiGan = document.getElementById('repKpiGanancias');
 kpiGan.classList.remove('kpi-warning', 'kpi-danger', 'kpi-success');

 if (esBalance) {
 // Mostrar las 3 KPIs
 kpiGan.style.display = '';

 // KPIs de Balance: Total Ventas / Total Compras / Resultado
 document.getElementById('repKpi1Label').textContent = ' Total Ventas';
 document.getElementById('repTotal').innerHTML = App.fmtMoneyHtml(this.datos.suma_ventas);

 document.getElementById('repKpi2Label').textContent = ' Total Compras';
 document.getElementById('repCount').innerHTML = App.fmtMoneyHtml(this.datos.suma_compras);

 const gan = Number(this.datos.ganancias);
 const labelResultado = gan >= 0 ? ' Ganancia del Periodo' : ' Pérdida del Periodo';
 document.getElementById('repKpi3Label').textContent = labelResultado;
 document.getElementById('repGanancias').innerHTML = App.fmtMoneyHtml(Math.abs(gan));
 document.getElementById('repKpi3Sub').textContent = `${this.datos.movimientos} movimientos en total`;

 if (gan < 0) kpiGan.classList.add('kpi-danger');
 else if (gan === 0) kpiGan.classList.add('kpi-warning');
 else kpiGan.classList.add('kpi-success');

 // Mostrar columna Tipo
 const colTipoBal = document.getElementById('repColTipo');
 if (colTipoBal) colTipoBal.style.display = '';
 } else {
 // Ventas o Compras: solo 2 KPIs (Total y Movimientos), ocultar Ganancias
 kpiGan.style.display = 'none';

 document.getElementById('repKpi1Label').textContent = 'Total Acumulado';
 document.getElementById('repTotal').innerHTML = App.fmtMoneyHtml(this.datos.ingresos_totales);

 document.getElementById('repKpi2Label').textContent = 'Movimientos';
 document.getElementById('repCount').textContent = App.fmtNumber(this.datos.movimientos);

 // Ocultar columna Tipo
 const colTipoVC = document.getElementById('repColTipo');
 if (colTipoVC) colTipoVC.style.display = 'none';
 }

 const colspan = esBalance ? 6 : 5;

 if (this.datos.filas.length === 0) {
 tbody.innerHTML = `<tr class="empty-row"><td colspan="${colspan}">Sin movimientos en el rango seleccionado</td></tr>`;
 return;
 }

 tbody.innerHTML = this.datos.filas.map(f => {
 const esVenta = f.tipo === 'venta';
 const colorTotal = esBalance
 ? (esVenta ? 'var(--success, #5cb85c)' : 'var(--danger, #d9534f)')
 : 'var(--gold)';
 const signo = esBalance && !esVenta ? '− ' : '';
 const badge = esBalance ? `
 <td>
 <span class="badge ${esVenta ? 'badge-success' : 'badge-danger'}">
 ${esVenta ? ' Venta' : ' Compra'}
 </span>
 </td>
 ` : '';
 return `
 <tr>
 ${badge}
 <td><code style="color: var(--gold);">${App.escape(f.folio)}</code></td>
 <td style="max-width: 400px;">
 <div style="font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${App.escape(f.productos)}">
 ${App.escape(f.productos)}
 </div>
 </td>
 <td>${App.escape(f.cliente_o_proveedor)}</td>
 <td>${App.fmtDate(f.fecha)}</td>
 <td class="text-right" style="color: ${colorTotal}; font-weight: 600;">${signo}${App.fmtMoney(f.total)}</td>
 </tr>
 `;
 }).join('');
 } catch (e) {
 tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Error: ${App.escape(e.message)}</td></tr>`;
 }
 },

 async _cargarPorVendedor() {
 const tbody = document.getElementById('repTbody');
 try {
 const params = new URLSearchParams();
 params.set('rango', this.filtroRango);
 params.set('tz_offset', String(new Date().getTimezoneOffset()));
 if (this.filtroRango === 'rango') {
 params.set('desde', document.getElementById('repDesde').value);
 params.set('hasta', document.getElementById('repHasta').value);
 }

 this.datos = await App.api('/api/reportes/por-vendedor?' + params.toString());

 // KPIs: total general, número de vendedores y vendedor top
 document.getElementById('repKpis').style.display = 'grid';
 const kpiGan = document.getElementById('repKpiGanancias');
 kpiGan.classList.remove('kpi-warning', 'kpi-danger', 'kpi-success');
 kpiGan.style.display = '';

 document.getElementById('repKpi1Label').textContent = 'Total Vendido';
 document.getElementById('repTotal').innerHTML = App.fmtMoneyHtml(this.datos.total_general);

 document.getElementById('repKpi2Label').textContent = 'Ventas Realizadas';
 document.getElementById('repCount').textContent = App.fmtNumber(this.datos.num_ventas_total);

 const topVendedor = this.datos.resumen[0];
 document.getElementById('repKpi3Label').textContent = 'Vendedor #1';
 document.getElementById('repGanancias').innerHTML = topVendedor
 ? `<span style="font-family: var(--font-display); font-size: 18px;">${App.escape(topVendedor.nombre_completo || topVendedor.nombre_usuario)}</span>`
 : '—';
 document.getElementById('repKpi3Sub').textContent = topVendedor
 ? `${App.fmtMoneyPlain(topVendedor.total)} en ${topVendedor.num_ventas} ventas`
 : 'Sin ventas en el período';

 const colTipo = document.getElementById('repColTipo');
 if (colTipo) colTipo.style.display = 'none';

 // Cambiar encabezados de tabla y contenido
 const thead = document.querySelector('#repTabla thead tr');
 if (thead) {
 thead.innerHTML = `
 <th>Vendedor</th>
 <th>Usuario</th>
 <th>Rol</th>
 <th class="text-center">Nº Ventas</th>
 <th class="text-right">Promedio</th>
 <th class="text-right">Total Vendido</th>
 `;
 }

 if (!this.datos.resumen || this.datos.resumen.length === 0) {
 tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Sin ventas en el rango seleccionado</td></tr>`;
 return;
 }

 tbody.innerHTML = this.datos.resumen.map((v, idx) => {
 const medalla = idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : '';
 return `
 <tr style="cursor: pointer;" onclick="App.views.reportes._toggleVendedor(${idx})">
 <td><strong>${medalla}${App.escape(v.nombre_completo)}</strong></td>
 <td><code style="color: var(--gold);">${App.escape(v.nombre_usuario)}</code></td>
 <td><span class="badge">${App.escape(v.rol)}</span></td>
 <td class="text-center">${App.fmtNumber(v.num_ventas)}</td>
 <td class="text-right">${App.fmtMoney(v.promedio)}</td>
 <td class="text-right" style="color: var(--gold); font-weight: 600;">${App.fmtMoney(v.total)}</td>
 </tr>
 <tr id="repVendedorDetalle-${idx}" style="display: none;">
 <td colspan="6" style="background: var(--surface-alt); padding: 0;">
 <div style="padding: 14px 20px;">
 <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: 10px; font-weight: 600;">
 Ventas individuales de ${App.escape(v.nombre_completo)}
 </div>
 <table class="table" style="margin: 0; font-size: 12px;">
 <thead>
 <tr>
 <th>Folio</th>
 <th>Cliente</th>
 <th>Fecha</th>
 <th>Pago</th>
 <th class="text-center">Items</th>
 <th class="text-right">Total</th>
 </tr>
 </thead>
 <tbody>
 ${v.ventas.map(vd => `
 <tr>
 <td><code style="color: var(--gold);">${App.escape(vd.folio)}</code></td>
 <td>${App.escape(vd.cliente || '—')}</td>
 <td>${App.fmtDate(vd.fecha)}</td>
 <td>${App.escape(vd.metodo_pago)}</td>
 <td class="text-center">${vd.cantidad_items}</td>
 <td class="text-right" style="color: var(--gold);">${App.fmtMoney(vd.total)}</td>
 </tr>
 `).join('')}
 </tbody>
 </table>
 </div>
 </td>
 </tr>
 `;
 }).join('');
 } catch (e) {
 tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Error: ${App.escape(e.message)}</td></tr>`;
 }
 },

 _toggleVendedor(idx) {
 const fila = document.getElementById('repVendedorDetalle-' + idx);
 if (fila) {
 fila.style.display = fila.style.display === 'none' ? '' : 'none';
 }
 },

 exportarPDF() {
 if (this.filtroTipo === 'vendedor') {
 this._exportarPDFVendedor();
 return;
 }
 if (!this.datos || !this.datos.filas || this.datos.filas.length === 0) {
 App.toast('No hay datos para exportar', 'warning');
 return;
 }

 const { jsPDF } = window.jspdf;
 const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
 const cfg = App.config || {};
 const pageW = doc.internal.pageSize.getWidth();

 // ----- Encabezado dorado -----
 doc.setFillColor(10, 10, 10); // negro
 doc.rect(0, 0, pageW, 32, 'F');
 doc.setFillColor(212, 175, 55); // dorado
 doc.rect(0, 32, pageW, 1.5, 'F');

 doc.setTextColor(212, 175, 55);
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(20);
 doc.text(cfg.nombre_negocio || 'SUMARJ Acabados Finos', 14, 14);

 doc.setTextColor(180, 180, 170);
 doc.setFontSize(8);
 doc.setFont('helvetica', 'normal');
 const subInfo = [cfg.telefono, cfg.correo]
 .filter(Boolean).join(' | ');
 if (subInfo) doc.text(subInfo, 14, 20);
 if (cfg.direccion) doc.text(cfg.direccion, 14, 24.5);

 // Título del reporte (lado derecho)
 const esBalance = this.filtroTipo === 'balance';
 const tituloPDF = esBalance ? 'BALANCE GENERAL'
 : this.filtroTipo === 'ventas' ? 'REPORTE DE VENTAS'
 : 'REPORTE DE COMPRAS';
 doc.setTextColor(212, 175, 55);
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(14);
 doc.text(tituloPDF, pageW - 14, 14, { align: 'right' });

 doc.setTextColor(150, 150, 140);
 doc.setFontSize(8);
 doc.setFont('helvetica', 'normal');
 const fechaEmision = new Date().toLocaleString('es-MX');
 doc.text('Emitido: ' + fechaEmision, pageW - 14, 20, { align: 'right' });

 // Etiqueta del rango
 const rangoLabels = {
 dia: 'Hoy',
 semana: 'Esta semana',
 mes: 'Este mes',
 rango: `${document.getElementById('repDesde')?.value || ''} a ${document.getElementById('repHasta')?.value || ''}`,
 };
 doc.text('Rango: ' + (rangoLabels[this.filtroRango] || ''), pageW - 14, 24.5, { align: 'right' });

 // ----- KPIs en bloques -----
 let y = 44;
 doc.setTextColor(40, 40, 40);

 let kpis;
 if (esBalance) {
 const gan = Number(this.datos.ganancias);
 const labelResultado = gan >= 0 ? 'GANANCIA' : 'PERDIDA';
 kpis = [
 { label: 'Total Ventas', value: App.fmtMoneyPlain(this.datos.suma_ventas), color: [40, 130, 40] },
 { label: 'Total Compras', value: App.fmtMoneyPlain(this.datos.suma_compras), color: [170, 60, 60] },
 { label: labelResultado, value: App.fmtMoneyPlain(Math.abs(gan)),
 color: gan >= 0 ? [40, 130, 40] : [170, 60, 60] },
 ];
 } else {
 kpis = [
 { label: 'Total Acumulado', value: App.fmtMoneyPlain(this.datos.ingresos_totales), color: [160, 130, 30] },
 { label: 'Movimientos', value: App.fmtNumber(this.datos.movimientos), color: [160, 130, 30] },
 ];
 }

 // Calcular ancho dinámicamente según cantidad de KPIs
 const numKpis = kpis.length;
 const gap = 4;
 const boxW = (pageW - 14 * 2 - gap * (numKpis - 1)) / numKpis;
 kpis.forEach((k, i) => {
 const x = 14 + i * (boxW + gap);
 doc.setDrawColor(212, 175, 55);
 doc.setLineWidth(0.3);
 doc.rect(x, y, boxW, 18);
 doc.setFillColor(k.color[0], k.color[1], k.color[2]);
 doc.rect(x, y, 1.5, 18, 'F');

 doc.setTextColor(120, 120, 110);
 doc.setFont('helvetica', 'normal');
 doc.setFontSize(7.5);
 doc.text(k.label.toUpperCase(), x + 4, y + 5.5);

 doc.setTextColor(k.color[0], k.color[1], k.color[2]);
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(13);
 doc.text(k.value, x + 4, y + 13);
 });
 y += 24;

 // ----- Tabla de movimientos -----
 let head, filas, columnStyles;
 if (esBalance) {
 // Tabla con columna "Tipo"
 head = [['Tipo', 'Folio', 'Productos', 'Cliente / Proveedor', 'Fecha', 'Total']];
 filas = this.datos.filas.map(f => {
 const esVenta = f.tipo === 'venta';
 return [
 esVenta ? 'VENTA' : 'COMPRA',
 f.folio,
 this.truncate(f.productos, 50),
 this.truncate(f.cliente_o_proveedor, 25),
 App.fmtDate(f.fecha),
 (esVenta ? '+ ' : '- ') + App.fmtMoneyPlain(f.total),
 ];
 });
 columnStyles = {
 0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
 1: { cellWidth: 22, textColor: [160, 130, 30], fontStyle: 'bold' },
 2: { cellWidth: 55 },
 3: { cellWidth: 35 },
 4: { cellWidth: 24 },
 5: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' },
 };
 } else {
 const clienteHeader = this.filtroTipo === 'ventas' ? 'Cliente' : 'Proveedor';
 head = [['Folio', 'Productos', clienteHeader, 'Fecha', 'Total']];
 filas = this.datos.filas.map(f => [
 f.folio,
 this.truncate(f.productos, 60),
 this.truncate(f.cliente_o_proveedor, 30),
 App.fmtDate(f.fecha),
 App.fmtMoneyPlain(f.total),
 ]);
 columnStyles = {
 0: { cellWidth: 22, textColor: [160, 130, 30], fontStyle: 'bold' },
 1: { cellWidth: 72 },
 2: { cellWidth: 38 },
 3: { cellWidth: 30 },
 4: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold', textColor: [160, 130, 30] },
 };
 }

 doc.autoTable({
 startY: y,
 head: head,
 body: filas,
 styles: {
 fontSize: 8.5,
 cellPadding: 2.5,
 textColor: [40, 40, 40],
 lineColor: [220, 220, 220],
 lineWidth: 0.1,
 },
 headStyles: {
 fillColor: [10, 10, 10],
 textColor: [212, 175, 55],
 fontStyle: 'bold',
 fontSize: 8,
 halign: 'left',
 },
 alternateRowStyles: { fillColor: [248, 246, 240] },
 columnStyles: columnStyles,
 // Pintar la columna Total en verde/rojo según tipo (solo balance)
 didParseCell: esBalance ? (data) => {
 if (data.section === 'body' && data.column.index === 5) {
 const tipoFila = data.row.raw[0]; // 'VENTA' o 'COMPRA'
 if (tipoFila === 'VENTA') {
 data.cell.styles.textColor = [40, 130, 40];
 } else {
 data.cell.styles.textColor = [170, 60, 60];
 }
 }
 if (data.section === 'body' && data.column.index === 0) {
 const tipoFila = data.row.raw[0];
 if (tipoFila === 'VENTA') {
 data.cell.styles.textColor = [40, 130, 40];
 } else {
 data.cell.styles.textColor = [170, 60, 60];
 }
 }
 } : undefined,
 margin: { left: 14, right: 14 },
 didDrawPage: (data) => {
 // Pie de página en cada hoja
 const ph = doc.internal.pageSize.getHeight();
 doc.setDrawColor(212, 175, 55);
 doc.setLineWidth(0.2);
 doc.line(14, ph - 14, pageW - 14, ph - 14);

 doc.setFontSize(7.5);
 doc.setTextColor(120, 120, 110);
 doc.setFont('helvetica', 'normal');
 doc.text('SUMARJ — Sistema de Gestión', 14, ph - 9);
 doc.text(
 'Página ' + data.pageNumber + ' de ' + doc.internal.getNumberOfPages(),
 pageW - 14, ph - 9, { align: 'right' }
 );
 },
 });

 // Total al final
 const finalY = doc.lastAutoTable.finalY + 6;
 if (finalY < doc.internal.pageSize.getHeight() - 25) {
 if (esBalance) {
 // Caja resumen del balance
 const gan = Number(this.datos.ganancias);
 const cajaW = 100;
 const cajaX = pageW - 14 - cajaW;

 doc.setFillColor(10, 10, 10);
 doc.rect(cajaX, finalY, cajaW, 22, 'F');

 // Línea lateral del color del resultado
 if (gan >= 0) doc.setFillColor(40, 130, 40);
 else doc.setFillColor(170, 60, 60);
 doc.rect(cajaX, finalY, 2, 22, 'F');

 doc.setTextColor(180, 180, 170);
 doc.setFont('helvetica', 'normal');
 doc.setFontSize(8);
 doc.text('RESULTADO DEL PERIODO', cajaX + 6, finalY + 6);

 doc.setTextColor(212, 175, 55);
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(11);
 const labelFinal = gan >= 0 ? 'Ganancia neta' : 'Perdida neta';
 doc.text(labelFinal + ': ' + App.fmtMoneyPlain(Math.abs(gan)),
 cajaX + 6, finalY + 14);

 doc.setTextColor(160, 160, 150);
 doc.setFont('helvetica', 'normal');
 doc.setFontSize(7);
 doc.text(`${this.datos.movimientos} movimientos - Ventas ${App.fmtMoneyPlain(this.datos.suma_ventas)} - Compras ${App.fmtMoneyPlain(this.datos.suma_compras)}`,
 cajaX + 6, finalY + 19);
 } else {
 doc.setFillColor(10, 10, 10);
 doc.rect(pageW - 80, finalY, 66, 12, 'F');
 doc.setTextColor(212, 175, 55);
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(10);
 doc.text('TOTAL:', pageW - 76, finalY + 7.5);
 doc.setFontSize(11);
 doc.text(App.fmtMoneyPlain(this.datos.ingresos_totales), pageW - 17, finalY + 7.5, { align: 'right' });
 }
 }

 // Guardar
 const fecha = new Date().toISOString().slice(0, 10);
 const filename = `reporte_${this.filtroTipo}_${fecha}.pdf`;
 doc.save(filename);
 App.toast('PDF generado: ' + filename, 'success');
 },

 _exportarPDFVendedor() {
 if (!this.datos || !this.datos.resumen || this.datos.resumen.length === 0) {
 App.toast('No hay datos para exportar', 'warning');
 return;
 }

 const { jsPDF } = window.jspdf;
 const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
 const cfg = App.config || {};
 const pageW = doc.internal.pageSize.getWidth();

 // Encabezado
 doc.setFillColor(10, 10, 10);
 doc.rect(0, 0, pageW, 32, 'F');
 doc.setFillColor(212, 175, 55);
 doc.rect(0, 32, pageW, 1.5, 'F');

 doc.setTextColor(212, 175, 55);
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(20);
 doc.text(cfg.nombre_negocio || 'SUMARJ Acabados Finos', 14, 14);

 doc.setTextColor(180, 180, 170);
 doc.setFontSize(8);
 doc.setFont('helvetica', 'normal');
 const subInfo = [cfg.telefono, cfg.correo].filter(Boolean).join(' | ');
 if (subInfo) doc.text(subInfo, 14, 20);
 if (cfg.direccion) doc.text(cfg.direccion, 14, 24.5);

 doc.setTextColor(220, 220, 220);
 doc.setFontSize(11);
 doc.setFont('helvetica', 'bold');
 doc.text('REPORTE POR VENDEDOR', pageW - 14, 14, { align: 'right' });

 doc.setTextColor(160, 160, 150);
 doc.setFontSize(8);
 doc.setFont('helvetica', 'normal');
 const ahora = new Date();
 doc.text(ahora.toLocaleString(), pageW - 14, 20, { align: 'right' });

 const rangoLabel = {
 dia: 'Hoy',
 semana: 'Esta semana',
 mes: 'Este mes',
 rango: 'Personalizado',
 }[this.filtroRango] || this.filtroRango;
 doc.text('Rango: ' + rangoLabel, pageW - 14, 24.5, { align: 'right' });

 // Resumen general
 doc.setTextColor(40, 40, 40);
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(11);
 doc.text('Resumen del Período', 14, 45);

 doc.setDrawColor(212, 175, 55);
 doc.line(14, 47, pageW - 14, 47);

 doc.setFont('helvetica', 'normal');
 doc.setFontSize(9);
 doc.text(`Total vendido: $${Number(this.datos.total_general).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14, 53);
 doc.text(`Ventas realizadas: ${this.datos.num_ventas_total}`, 14, 58);
 doc.text(`Vendedores activos: ${this.datos.num_vendedores}`, 14, 63);

 // Tabla principal
 let y = 73;
 doc.setFillColor(40, 40, 40);
 doc.rect(14, y, pageW - 28, 7, 'F');
 doc.setTextColor(212, 175, 55);
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(8);
 doc.text('VENDEDOR', 16, y + 5);
 doc.text('USUARIO', 70, y + 5);
 doc.text('VENTAS', 105, y + 5, { align: 'right' });
 doc.text('PROMEDIO', 140, y + 5, { align: 'right' });
 doc.text('TOTAL', 192, y + 5, { align: 'right' });

 y += 9;
 doc.setTextColor(40, 40, 40);
 doc.setFont('helvetica', 'normal');
 doc.setFontSize(8);

 this.datos.resumen.forEach((v, idx) => {
 if (y > 270) {
 doc.addPage();
 y = 20;
 }
 const medalla = idx === 0 ? '#1 ' : idx === 1 ? '#2 ' : idx === 2 ? '#3 ' : '';
 doc.text(this.truncate(medalla + (v.nombre_completo || ''), 30), 16, y);
 doc.text(this.truncate(v.nombre_usuario || '', 18), 70, y);
 doc.text(String(v.num_ventas), 105, y, { align: 'right' });
 doc.text(`$${Number(v.promedio).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 140, y, { align: 'right' });
 doc.setFont('helvetica', 'bold');
 doc.text(`$${Number(v.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 192, y, { align: 'right' });
 doc.setFont('helvetica', 'normal');
 y += 6;
 });

 // Pie
 doc.setDrawColor(212, 175, 55);
 doc.line(14, y + 2, pageW - 14, y + 2);
 doc.setFont('helvetica', 'bold');
 doc.setFontSize(10);
 doc.text('TOTAL GENERAL', 14, y + 8);
 doc.setTextColor(212, 175, 55);
 doc.text(`$${Number(this.datos.total_general).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 192, y + 8, { align: 'right' });

 const filename = `reporte_vendedores_${ahora.toISOString().slice(0, 10)}.pdf`;
 doc.save(filename);
 App.toast('PDF generado: ' + filename, 'success');
 },

 truncate(str, max) {
 if (!str) return '';
 return str.length > max ? str.slice(0, max - 1) + '…' : str;
 },
};

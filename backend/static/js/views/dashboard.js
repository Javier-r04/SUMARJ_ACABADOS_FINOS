App.views.dashboard = {
 chartVentas: null,
 chartCompras: null,
 chartUtilidad: null,

 async render(container) {
 container.innerHTML = App.pageHeader(
 'Panel de Control',
 'Resumen operativo del negocio',
 `<button class="btn btn-ghost" onclick="App.views.dashboard.refresh()">↻ Actualizar</button>`
 ) + `
 <div id="dashContent">
 <div class="empty-state"><div class="spinner"></div><p class="mt-3 text-muted">Cargando métricas…</p></div>
 </div>
 `;
 await this.refresh();
 },

 async refresh() {
 const content = document.getElementById('dashContent');
 try {
 const data = await App.api('/api/dashboard');
 content.innerHTML = this.html(data);
 this.drawCharts(data);
 } catch (e) {
 content.innerHTML = `<div class="alert alert-error">Error: ${App.escape(e.message)}</div>`;
 }
 },

 html(d) {
 return `
 <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr);">
 <div class="kpi">
 <div class="kpi-label">Total Productos</div>
 <div class="kpi-value">${App.fmtNumber(d.total_productos)}</div>
 <a class="kpi-sub" href="#productos">Ver inventario →</a>
 </div>
 <div class="kpi">
 <div class="kpi-label">Compras del Mes</div>
 <div class="kpi-value">${App.fmtMoneyHtml(d.compras_mes)}</div>
 <a class="kpi-sub" href="#compras">Ver compras →</a>
 </div>
 <div class="kpi">
 <div class="kpi-label">Ventas del Mes</div>
 <div class="kpi-value">${App.fmtMoneyHtml(d.ventas_totales_mes)}</div>
 <a class="kpi-sub" href="#reportes">Ver reportes →</a>
 </div>
 <div class="kpi ${d.stock_bajo > 0 ? 'kpi-warning' : ''}" style="cursor: pointer;" onclick="App.views.dashboard.irABajoStock()">
 <div class="kpi-label">Productos con Bajo Stock</div>
 <div class="kpi-value">${App.fmtNumber(d.stock_bajo)}</div>
 <a class="kpi-sub" href="#productos" onclick="App.views.dashboard.irABajoStock(event)">Ver productos →</a>
 </div>
 </div>

 <div class="chart-grid">
 <div class="card">
 <div class="card-header">
 <h3 class="card-title">Ventas — Últimos 12 Meses</h3>
 </div>
 <div class="chart-wrapper">
 <canvas id="chartVentas"></canvas>
 </div>
 </div>
 <div class="card">
 <div class="card-header">
 <h3 class="card-title">Compras — Últimos 12 Meses</h3>
 </div>
 <div class="chart-wrapper">
 <canvas id="chartCompras"></canvas>
 </div>
 </div>
 </div>

 <div class="chart-grid full">
 <div class="card">
 <div class="card-header">
 <h3 class="card-title">Utilidad Mensual (Ventas − Compras)</h3>
 </div>
 <div class="chart-wrapper" style="height: 320px;">
 <canvas id="chartUtilidad"></canvas>
 </div>
 </div>
 </div>

 <div class="card">
 <div class="card-header">
 <h3 class="card-title">Actividad Reciente</h3>
 </div>
 <div>
 ${(d.actividad_reciente || []).length === 0
 ? `<p class="text-muted text-center">Sin actividad registrada</p>`
 : (d.actividad_reciente || []).map(a => `
 <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border-soft);">
 <div style="display: flex; align-items: center; gap: 14px;">
 <div style="width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: ${a.tipo === 'venta' ? 'rgba(92,184,92,0.15)' : 'rgba(212,175,55,0.15)'}; color: ${a.tipo === 'venta' ? 'var(--success)' : 'var(--gold)'}; font-weight: bold;">
 ${a.tipo === 'venta' ? '↗' : '↙'}
 </div>
 <div>
 <div style="font-weight: 600;">${App.escape(a.descripcion)}</div>
 <div style="font-size: 11px; color: var(--text-muted);">${App.fmtDate(a.fecha)}</div>
 </div>
 </div>
 <div style="color: ${a.tipo === 'venta' ? 'var(--success)' : 'var(--gold)'}; font-weight: 600; font-family: var(--font-display); font-size: 20px;">
 ${App.fmtMoneyHtml(a.monto)}
 </div>
 </div>
 `).join('')
 }
 </div>
 </div>
 `;
 },

 drawCharts(d) {
 const gold = '#d4af37';
 const text = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#a8a89c';
 const grid = getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || 'rgba(255,255,255,0.05)';

 const baseOpts = {
 responsive: true,
 maintainAspectRatio: false,
 plugins: { legend: { display: false } },
 scales: {
 x: { ticks: { color: text }, grid: { color: grid } },
 y: {
 ticks: { color: text, callback: (v) => App.config.simbolo_moneda + v },
 grid: { color: grid }
 },
 },
 };

 if (this.chartVentas) this.chartVentas.destroy();
 this.chartVentas = new Chart(document.getElementById('chartVentas'), {
 type: 'bar',
 data: {
 labels: d.ventas_12meses.map(x => x.mes),
 datasets: [{
 data: d.ventas_12meses.map(x => x.total),
 backgroundColor: gold,
 borderColor: gold,
 borderRadius: 4,
 }],
 },
 options: baseOpts,
 });

 if (this.chartCompras) this.chartCompras.destroy();
 this.chartCompras = new Chart(document.getElementById('chartCompras'), {
 type: 'bar',
 data: {
 labels: d.compras_12meses.map(x => x.mes),
 datasets: [{
 data: d.compras_12meses.map(x => x.total),
 backgroundColor: 'rgba(165, 132, 21, 0.7)',
 borderColor: '#a58415',
 borderRadius: 4,
 }],
 },
 options: baseOpts,
 });

 if (this.chartUtilidad) this.chartUtilidad.destroy();
 this.chartUtilidad = new Chart(document.getElementById('chartUtilidad'), {
 type: 'bar',
 data: {
 labels: d.utilidad_mensual.map(x => x.mes),
 datasets: [{
 data: d.utilidad_mensual.map(x => x.utilidad),
 backgroundColor: d.utilidad_mensual.map(x => x.total >= 0 ? gold : '#d9534f'),
 borderRadius: 4,
 }],
 },
 options: baseOpts,
 });
 },

 irABajoStock(event) {
 if (event) event.preventDefault();
 // Marcar que al cargar productos active el filtro de bajo stock
 sessionStorage.setItem('sumarj_filtro_bajo_stock', '1');
 window.location.hash = '#productos';
 },
};

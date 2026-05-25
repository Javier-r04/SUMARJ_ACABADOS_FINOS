App.views.configuracion = {
 config: null,

 async render(container) {
 container.innerHTML = App.pageHeader(
 'Configuración',
 'Datos generales del negocio',
 ''
 ) + `
 <div id="cfgContent">
 <div class="empty-state"><div class="spinner"></div><p class="mt-3 text-muted">Cargando configuración…</p></div>
 </div>
 `;
 await this.cargar();
 },

 async cargar() {
 try {
 this.config = await App.api('/api/configuracion');
 this.renderForm();
 } catch (e) {
 document.getElementById('cfgContent').innerHTML =
 `<div class="alert alert-error">Error: ${App.escape(e.message)}</div>`;
 }
 },

 renderForm() {
 const c = this.config;
 document.getElementById('cfgContent').innerHTML = `
 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
 <div class="card">
 <div class="card-header">
 <h3 class="card-title">Datos del Negocio</h3>
 </div>

 <div class="form-group">
 <label class="form-label">Nombre del Negocio</label>
 <input class="form-input" id="cNombre" value="${App.escape(c.nombre_negocio)}">
 </div>

 <div class="form-group">
 <label class="form-label">Teléfono</label>
 <input class="form-input" id="cTelefono" value="${App.escape(c.telefono)}" placeholder="Ej.962 000 0000 ">
 </div>

 <div class="form-group">
 <label class="form-label">Correo Electrónico</label>
 <input class="form-input" id="cCorreo" type="email" value="${App.escape(c.correo)}" placeholder="contacto@sumarj.com">
 </div>

 <div class="form-group">
 <label class="form-label">Dirección Completa</label>
 <textarea class="form-textarea" id="cDireccion" placeholder="Calle, número, colonia, ciudad, estado, CP">${App.escape(c.direccion)}</textarea>
 </div>
 </div>

 <div>
 <div class="card mb-4">
 <div class="card-header">
 <h3 class="card-title">Moneda y Formato</h3>
 </div>

 <div class="form-grid cols-2">
 <div class="form-group">
 <label class="form-label">Código de Moneda</label>
 <input class="form-input" id="cMoneda" value="${App.escape(c.moneda)}" maxlength="10">
 <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
 Ej. MXN, USD, EUR
 </div>
 </div>
 <div class="form-group">
 <label class="form-label">Símbolo</label>
 <input class="form-input" id="cSimbolo" value="${App.escape(c.simbolo_moneda)}" maxlength="5">
 <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
 Ej. $, €, US$
 </div>
 </div>
 </div>
 </div>

 <div class="card">
 <div class="card-header">
 <h3 class="card-title">Información del Sistema</h3>
 </div>
 <div style="font-size: 13px; line-height: 2;">
 <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--black-border);">
 <span class="text-muted">Versión</span>
 <strong>SUMARJ 1.0.0</strong>
 </div>
 <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--black-border);">
 <span class="text-muted">Usuario activo</span>
 <strong style="color: var(--gold);">${App.escape(App.user.nombre_usuario)}</strong>
 </div>
 <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--black-border);">
 <span class="text-muted">Rol</span>
 <strong>${App.escape(App.user.rol)}</strong>
 </div>
 <div style="display: flex; justify-content: space-between; padding: 6px 0;">
 <span class="text-muted">Stack</span>
 <strong style="font-size: 11px;">FastAPI PostgreSQL Docker</strong>
 </div>
 </div>
 </div>
 </div>
 </div>

 <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
 <button class="btn btn-ghost" onclick="App.views.configuracion.cargar()">Cancelar</button>
 <button class="btn btn-primary" onclick="App.views.configuracion.guardar()" id="btnGuardarCfg">
 Guardar Configuración
 </button>
 </div>
 `;
 },

 async guardar() {
 const btn = document.getElementById('btnGuardarCfg');
 btn.disabled = true;
 btn.innerHTML = '<span class="spinner"></span> Guardando…';

 const data = {
 nombre_negocio: document.getElementById('cNombre').value.trim(),
 telefono: document.getElementById('cTelefono').value.trim(),
 direccion: document.getElementById('cDireccion').value.trim(),
 correo: document.getElementById('cCorreo').value.trim(),
 moneda: document.getElementById('cMoneda').value.trim() || 'MXN',
 simbolo_moneda: document.getElementById('cSimbolo').value.trim() || '$',
 };

 if (!data.nombre_negocio) {
 App.toast('El nombre del negocio es requerido', 'warning');
 btn.disabled = false;
 btn.textContent = 'Guardar Configuración';
 return;
 }

 try {
 this.config = await App.api('/api/configuracion', { method: 'PUT', body: data });
 App.config = this.config; // actualizar config global
 App.toast('Configuración guardada exitosamente', 'success');
 this.renderForm();
 } catch (e) {
 App.toast(e.message, 'error');
 btn.disabled = false;
 btn.textContent = 'Guardar Configuración';
 }
 },
};

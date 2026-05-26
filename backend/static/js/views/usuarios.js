App.views.usuarios = {
 usuarios: [],

 async render(container) {
 container.innerHTML = App.pageHeader(
 'Usuarios',
 'Gestión de cuentas de acceso al sistema',
 `<button class="btn btn-primary" onclick="App.views.usuarios.openCrear()">+ Nuevo Usuario</button>`
 ) + `
 <div class="table-container">
 <table class="table">
 <thead>
 <tr>
 <th>Usuario</th>
 <th>Nombre Completo</th>
 <th class="text-center">Rol</th>
 <th class="text-center">Estado</th>
 <th>Creado</th>
 <th class="text-right">Acciones</th>
 </tr>
 </thead>
 <tbody id="uTbody">
 <tr class="empty-row"><td colspan="6"><span class="spinner"></span></td></tr>
 </tbody>
 </table>
 </div>
 `;
 await this.cargar();
 },

 async cargar() {
 const tbody = document.getElementById('uTbody');
 try {
 this.usuarios = await App.api('/api/usuarios');
 if (this.usuarios.length === 0) {
 tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Sin usuarios registrados</td></tr>`;
 return;
 }
 const meId = App.user.id;
 tbody.innerHTML = this.usuarios.map(u => `
 <tr>
 <td>
 <div style="display: flex; align-items: center; gap: 10px;">
 <div class="user-avatar" style="width: 32px; height: 32px; font-size: 13px;">
 ${(u.nombre_completo || 'U').charAt(0).toUpperCase()}
 </div>
 <code style="color: var(--gold);">${App.escape(u.nombre_usuario)}</code>
 ${u.id === meId ? '<span class="badge badge-gold" style="margin-left: 6px;">Tú</span>' : ''}
 </div>
 </td>
 <td>
 <div style="font-weight: 600;">${App.escape(u.nombre_completo)}</div>
 </td>
 <td class="text-center">
 <span class="badge ${u.rol === 'admin' ? 'badge-gold' : 'badge-muted'}">${u.rol}</span>
 </td>
 <td class="text-center">
 <span class="badge ${u.activo ? 'badge-success' : 'badge-danger'}">
 ${u.activo ? 'Activo' : 'Inactivo'}
 </span>
 </td>
 <td style="font-size: 12px; color: var(--text-muted);">${App.fmtDateShort(u.creado_en)}</td>
 <td>
 <div class="row-actions">
 <button class="btn btn-icon" title="Editar"
 onclick="App.views.usuarios.openEditar(${u.id})">✎</button>
 <button class="btn btn-icon" title="Resetear contraseña" style="color: var(--gold);"
 onclick="App.views.usuarios.resetPassword(${u.id})">🔑</button>
 ${u.id !== meId ? `
 <button class="btn btn-icon danger" title="Eliminar"
 onclick="App.views.usuarios.eliminar(${u.id})">🗑</button>
 ` : ''}
 </div>
 </td>
 </tr>
 `).join('');
 } catch (e) {
 tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Error: ${App.escape(e.message)}</td></tr>`;
 }
 },

 openCrear() {
 this.openForm(null);
 },

 openEditar(id) {
 const u = this.usuarios.find(x => x.id === id);
 if (!u) return;
 this.openForm(u);
 },

 openForm(usuario) {
 const esEdit = !!usuario;
 const u = usuario || {};
 const meId = App.user.id;
 const esYo = esEdit && u.id === meId;

 App.openModal({
 title: esEdit ? 'Editar Usuario' : 'Nuevo Usuario',
 body: `
 <div class="form-grid cols-2">
 <div class="form-group">
 <label class="form-label">Nombre de Usuario *</label>
 <input class="form-input" id="uNombreUsuario"
 value="${App.escape(u.nombre_usuario || '')}"
 ${esEdit ? 'disabled style="opacity: 0.6;"' : ''}>
 ${esEdit ? '<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">El nombre de usuario no se puede cambiar</div>' : ''}
 </div>
 <div class="form-group">
 <label class="form-label">Nombre Completo *</label>
 <input class="form-input" id="uNombreCompleto" value="${App.escape(u.nombre_completo || '')}">
 </div>
 </div>

 <div class="form-grid cols-2">
 <div class="form-group">
 <label class="form-label">Rol *</label>
 <select class="form-select" id="uRol" ${esYo ? 'disabled style="opacity: 0.6;"' : ''}>
 <option value="vendedor" ${u.rol === 'vendedor' ? 'selected' : ''}>Vendedor</option>
 <option value="admin" ${u.rol === 'admin' || !esEdit ? 'selected' : ''}>Administrador</option>
 </select>
 ${esYo ? '<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">No puedes cambiar tu propio rol</div>' : ''}
 </div>
 <div class="form-group">
 <label class="form-label">Estado</label>
 <select class="form-select" id="uActivo" ${esYo ? 'disabled style="opacity: 0.6;"' : ''}>
 <option value="true" ${u.activo !== false ? 'selected' : ''}>Activo</option>
 <option value="false" ${u.activo === false ? 'selected' : ''}>Inactivo</option>
 </select>
 </div>
 </div>

 <div class="form-group">
 <label class="form-label">${esEdit ? 'Nueva Contraseña' : 'Contraseña *'}</label>
 ${App.passwordInput('uPassword', { placeholder: '' })}
 ${esEdit ? '<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Deja vacío si no quieres cambiarla.</div>' : ''}
 </div>
 `,
 footer: `
 <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
 <button class="btn btn-primary" onclick="App.views.usuarios.guardar(${esEdit ? u.id : 'null'})">
 ${esEdit ? 'Guardar Cambios' : 'Crear Usuario'}
 </button>
 `,
 });
 },

 async guardar(id) {
 const esEdit = id !== null;
 const password = document.getElementById('uPassword').value;

 if (esEdit) {
 // Update
 const data = {
 nombre_completo: document.getElementById('uNombreCompleto').value.trim(),
 rol: document.getElementById('uRol').value,
 activo: document.getElementById('uActivo').value === 'true',
 };
 if (password) {
 if (password.length < 4) {
 App.toast('La contraseña debe tener al menos 4 caracteres', 'warning');
 return;
 }
 data.password = password;
 }
 if (!data.nombre_completo) {
 App.toast('El nombre completo es requerido', 'warning');
 return;
 }
 try {
 await App.api('/api/usuarios/' + id, { method: 'PUT', body: data });
 App.toast('Usuario actualizado', 'success');
 App.closeModal();
 await this.cargar();
 } catch (e) {
 App.toast(e.message, 'error');
 }
 } else {
 // Create
 const data = {
 nombre_usuario: document.getElementById('uNombreUsuario').value.trim(),
 nombre_completo: document.getElementById('uNombreCompleto').value.trim(),
 rol: document.getElementById('uRol').value,
 password: password,
 };
 if (!data.nombre_usuario || !data.nombre_completo) {
 App.toast('Todos los campos marcados con * son requeridos', 'warning');
 return;
 }
 if (!password || password.length < 4) {
 App.toast('La contraseña debe tener al menos 4 caracteres', 'warning');
 return;
 }
 try {
 await App.api('/api/usuarios', { method: 'POST', body: data });
 App.toast('Usuario creado exitosamente', 'success');
 App.closeModal();
 await this.cargar();
 } catch (e) {
 App.toast(e.message, 'error');
 }
 }
 },

 async eliminar(id) {
 const u = this.usuarios.find(x => x.id === id);
 if (!await App.confirm({
 title: 'Eliminar usuario',
 message: `¿Eliminar al usuario "${u.nombre_usuario}"? Esta acción no se puede deshacer.`,
 confirmText: 'Eliminar',
 danger: true,
 })) return;
 try {
 await App.api('/api/usuarios/' + id, { method: 'DELETE' });
 App.toast('Usuario eliminado', 'success');
 await this.cargar();
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },

 resetPassword(id) {
 const u = this.usuarios.find(x => x.id === id);
 if (!u) return;

 App.openModal({
 title: 'Resetear contraseña de ' + u.nombre_usuario,
 body: `
 <div class="form-group">
 <label class="form-label">Nueva contraseña *</label>
 ${App.passwordInput('rpwd1', { placeholder: 'Mínimo 4 caracteres', minlength: 4 })}
 </div>
 <div class="form-group">
 <label class="form-label">Confirmar contraseña *</label>
 ${App.passwordInput('rpwd2', { placeholder: 'Repite la contraseña', minlength: 4 })}
 </div>
 <div style="font-size: 12px; color: var(--text-muted);">
 Recuerda comunicar la nueva contraseña al usuario por un medio seguro (no por mensaje abierto).
 </div>
 `,
 footer: `
 <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
 <button class="btn btn-primary" onclick="App.views.usuarios._confirmarReset(${id})">
 Resetear contraseña
 </button>
 `,
 });
 setTimeout(() => document.getElementById('rpwd1').focus(), 100);
 },

 async _confirmarReset(id) {
 const p1 = document.getElementById('rpwd1').value;
 const p2 = document.getElementById('rpwd2').value;
 if (!p1 || p1.length < 4) {
 App.toast('La contraseña debe tener al menos 4 caracteres', 'warning');
 return;
 }
 if (p1 !== p2) {
 App.toast('Las contraseñas no coinciden', 'warning');
 return;
 }
 try {
 const res = await App.api('/api/usuarios/' + id + '/reset-password', {
 method: 'POST',
 body: { nueva_password: p1 },
 });
 App.toast(res.mensaje || 'Contraseña actualizada', 'success');
 App.closeModal();
 } catch (e) {
 App.toast(e.message, 'error');
 }
 },
};

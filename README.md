# SUMARJ — Sistema de Gestión Empresarial

Sistema completo de gestión para **SUMARJ Acabados Finos**.

Diseño luxury negro/dorado, moneda en pesos mexicanos (MXN), módulos: Dashboard, Punto de Venta, Productos, Ventas, Compras, Cotizaciones, Reportes, Usuarios y Configuración.

---

## Requisitos previos

Solo necesitas **Docker Desktop** instalado y corriendo en tu computadora:

- Windows o macOS: descarga desde https://www.docker.com/products/docker-desktop
- Linux: `sudo apt install docker.io docker-compose-plugin`

No necesitas instalar Python, PostgreSQL ni nada más. Docker se encarga de todo.

---

## Instrucciones para iniciar el sistema

### 1. Abrir terminal en la carpeta del proyecto

Descomprime el archivo `sumarj.zip` y abre una terminal **dentro** de la carpeta `sumarj/` (donde está el archivo `docker-compose.yml`).

### 2. Levantar los contenedores

```bash
docker-compose up -d
```

La primera vez tardará 2–4 minutos (descarga PostgreSQL e instala dependencias de Python). Las siguientes veces será casi instantáneo.

### 3. Verificar que todo arrancó bien

```bash
docker-compose ps
```

Deberías ver dos contenedores en estado `running` o `healthy`:
- `sumarj_db` (base de datos PostgreSQL)
- `sumarj_backend` (servidor FastAPI)

### 4. Abrir el sistema en el navegador

Abre tu navegador (Chrome, Firefox, Edge) y ve a:

**http://localhost:8000**

### 5. Iniciar sesión

Usa las credenciales iniciales del administrador:

- **Usuario:** `admin`
- **Contraseña:** `admin123`

> ⚠️ **Importante:** Cambia esta contraseña inmediatamente desde el módulo **Usuarios** una vez dentro del sistema.

---

## Comandos útiles

| Acción | Comando |
|---|---|
| Iniciar el sistema | `docker-compose up -d` |
| Detener el sistema | `docker-compose down` |
| Ver logs en vivo | `docker-compose logs -f` |
| Reiniciar | `docker-compose restart` |
| **Borrar todo y empezar de cero** ⚠️ | `docker-compose down -v` |

> El comando con `-v` elimina la base de datos completa. Úsalo solo si quieres resetear todo.

---

## Características del sistema

### Módulos disponibles

- **Dashboard** — KPIs en tiempo real, gráficos de 12 meses, salud del inventario, margen de utilidad
- **Punto de Venta (POS)** — Búsqueda rápida, carrito, descuento automático de stock, ticket imprimible
- **Productos** — CRUD completo, categorías, precios unitario/docena/mayoreo, alertas de stock bajo
- **Ventas** — Historial, búsqueda, anulación con devolución de stock automática
- **Compras** — Registro con incremento automático de inventario
- **Cotizaciones** — Propuestas sin afectar stock; al aceptarse se convierten en venta y descuentan inventario
- **Reportes** — Filtros por día/semana/mes/rango personalizado; exportación CSV
- **Usuarios** — Gestión de cuentas con roles admin (acceso total) y vendedor (solo POS)
- **Configuración** — Datos del negocio, moneda, símbolo, RFC, etc.

### Roles del sistema

- **Administrador:** acceso completo a todos los módulos.
- **Vendedor:** únicamente puede acceder al Punto de Venta.

### Detalles técnicos importantes

- **Cotizaciones:** No tocan inventario al crearse. El stock solo se descuenta cuando el cliente acepta la cotización y se convierte automáticamente en una venta.
- **Moneda:** Pesos mexicanos (MXN) por defecto, con símbolo `$`. Configurable desde el módulo Configuración.
- **Base de datos:** Persiste en un volumen de Docker (`sumarj_pgdata`), sobrevive a reinicios.
- **Autenticación:** JWT en cookies httpOnly, sesión de 8 horas.

---

## Stack tecnológico

- **Backend:** FastAPI 0.110 + SQLAlchemy 2.0 + Pydantic v2
- **Base de datos:** PostgreSQL 16
- **Frontend:** HTML + CSS + JavaScript vanilla + Chart.js 4.4
- **Autenticación:** JWT + bcrypt
- **Despliegue:** Docker + Docker Compose

---

## Estructura del proyecto

```
sumarj/
├── docker-compose.yml          ← Orquestación de contenedores
├── README.md                    ← Este archivo
├── db/
│   └── init/
│       └── 01_schema.sql        ← Esquema de BD + usuario admin inicial
└── backend/
    ├── Dockerfile
    ├── requirements.txt
    ├── app/
    │   ├── main.py              ← Punto de entrada FastAPI
    │   ├── core/                ← Config, DB, seguridad
    │   ├── models/              ← Modelos SQLAlchemy
    │   ├── schemas/             ← Schemas Pydantic
    │   └── routers/             ← Endpoints API (auth, ventas, etc.)
    ├── static/
    │   ├── css/app.css          ← Estilos negro/dorado
    │   ├── img/logo.png         ← Logo SUMARJ
    │   └── js/
    │       ├── app.js           ← Core de la SPA
    │       └── views/           ← Una vista JS por módulo
    └── templates/
        ├── login.html
        └── app.html             ← Shell principal
```

---

## Solución de problemas

### El puerto 8000 ya está en uso

Otro programa está usando ese puerto. Edita `docker-compose.yml` y cambia:

```yaml
ports:
  - "8000:8000"   # cambiar a "8001:8000" por ejemplo
```

Y entra a `http://localhost:8001`.

### El puerto 5432 ya está en uso

Lo mismo, pero con el puerto de PostgreSQL en `docker-compose.yml`:

```yaml
ports:
  - "5432:5432"   # cambiar a "5433:5432"
```

### Olvidé la contraseña del admin

Resetea todo:

```bash
docker-compose down -v
docker-compose up -d
```

Esto borra los datos y vuelve a crear el usuario `admin` con contraseña `admin123`.

### Ver errores del servidor

```bash
docker-compose logs backend
```

---

© 2026 SUMARJ Acabados Finos

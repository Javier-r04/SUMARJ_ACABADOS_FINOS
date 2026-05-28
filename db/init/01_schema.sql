-- ============================================================================
-- SUMARJ - Sistema de Gestion - Esquema de Base de Datos
-- ============================================================================

-- ============================================================================
-- TABLA: usuarios
-- ============================================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id              SERIAL PRIMARY KEY,
    nombre_usuario  VARCHAR(50)  UNIQUE NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    correo          VARCHAR(100) DEFAULT '',
    password_hash   VARCHAR(255) NOT NULL,
    rol             VARCHAR(20)  NOT NULL CHECK (rol IN ('admin', 'vendedor')),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    oculto          BOOLEAN      NOT NULL DEFAULT FALSE,
    creado_en       TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLA: password_resets (tokens de recuperacion - no usado actualmente)
-- ============================================================================
CREATE TABLE IF NOT EXISTS password_resets (
    id         SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token      VARCHAR(100) UNIQUE NOT NULL,
    expira_en  TIMESTAMP NOT NULL,
    usado      BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_usuario ON password_resets(usuario_id);

-- ============================================================================
-- TABLA: configuracion (datos del negocio)
-- ============================================================================
CREATE TABLE IF NOT EXISTS configuracion (
    id              SERIAL PRIMARY KEY,
    nombre_negocio  VARCHAR(150) NOT NULL DEFAULT 'SUMARJ Acabados Finos',
    telefono        VARCHAR(30)  DEFAULT '',
    direccion       VARCHAR(255) DEFAULT '',
    correo          VARCHAR(100) DEFAULT '',
    moneda          VARCHAR(10)  NOT NULL DEFAULT 'MXN',
    simbolo_moneda  VARCHAR(5)   NOT NULL DEFAULT '$',
    actualizado_en  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLA: categorias
-- ============================================================================
CREATE TABLE IF NOT EXISTS categorias (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(80) UNIQUE NOT NULL,
    descripcion TEXT DEFAULT ''
);

-- ============================================================================
-- TABLA: productos
-- ============================================================================
CREATE TABLE IF NOT EXISTS productos (
    id                    SERIAL PRIMARY KEY,
    codigo                VARCHAR(50)  UNIQUE NOT NULL,
    nombre                VARCHAR(150) NOT NULL,
    categoria_id          INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
    costo                 NUMERIC(12,2) NOT NULL DEFAULT 0,
    precio_unitario       NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock                 INTEGER NOT NULL DEFAULT 0,
    stock_alerta          INTEGER NOT NULL DEFAULT 5,
    piezas_por_caja       INTEGER NOT NULL DEFAULT 0,
    precio_pieza          NUMERIC(12,2) NOT NULL DEFAULT 0,
    precio_pieza_promo    BOOLEAN NOT NULL DEFAULT FALSE,
    stock_piezas_sueltas  INTEGER NOT NULL DEFAULT 0,
    activo                BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_productos_codigo   ON productos(codigo);
CREATE INDEX IF NOT EXISTS idx_productos_nombre   ON productos(nombre);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);

-- ============================================================================
-- TABLA: proveedores
-- ============================================================================
CREATE TABLE IF NOT EXISTS proveedores (
    id        SERIAL PRIMARY KEY,
    nombre    VARCHAR(150) UNIQUE NOT NULL,
    telefono  VARCHAR(30) DEFAULT '',
    correo    VARCHAR(100) DEFAULT '',
    direccion TEXT DEFAULT '',
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLA: ventas
-- ============================================================================
CREATE TABLE IF NOT EXISTS ventas (
    id              SERIAL PRIMARY KEY,
    folio           VARCHAR(30) UNIQUE NOT NULL,
    cliente         VARCHAR(150) NOT NULL DEFAULT '',
    usuario_id      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
    descuento_pct   NUMERIC(5,2) NOT NULL DEFAULT 0,
    total           NUMERIC(12,2) NOT NULL DEFAULT 0,
    cantidad_items  INTEGER NOT NULL DEFAULT 0,
    fecha           TIMESTAMP NOT NULL DEFAULT NOW(),
    anulada         BOOLEAN NOT NULL DEFAULT FALSE,
    metodo_pago     VARCHAR(20) NOT NULL DEFAULT 'efectivo'
                    CHECK (metodo_pago IN ('efectivo','tarjeta','hibrido')),
    monto_efectivo  NUMERIC(12,2) NOT NULL DEFAULT 0,
    monto_tarjeta   NUMERIC(12,2) NOT NULL DEFAULT 0,
    cotizacion_id   INTEGER -- FK retroactiva mas abajo
);

CREATE INDEX IF NOT EXISTS idx_ventas_fecha   ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente);

-- ============================================================================
-- TABLA: venta_detalle
-- ============================================================================
CREATE TABLE IF NOT EXISTS venta_detalle (
    id              SERIAL PRIMARY KEY,
    venta_id        INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id     INTEGER REFERENCES productos(id) ON DELETE SET NULL,
    codigo          VARCHAR(50)  NOT NULL DEFAULT '',
    nombre          VARCHAR(200) NOT NULL DEFAULT '',
    cantidad        INTEGER       NOT NULL DEFAULT 0,
    precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
    unidad_venta    VARCHAR(10)   NOT NULL DEFAULT 'caja'
);

CREATE INDEX IF NOT EXISTS idx_venta_detalle_venta ON venta_detalle(venta_id);

-- ============================================================================
-- TABLA: compras
-- ============================================================================
CREATE TABLE IF NOT EXISTS compras (
    id               SERIAL PRIMARY KEY,
    folio            VARCHAR(30) UNIQUE NOT NULL,
    proveedor_nombre VARCHAR(150) NOT NULL DEFAULT 'General',
    proveedor_id     INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
    usuario_id       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
    total            NUMERIC(12,2) NOT NULL DEFAULT 0,
    cantidad_items   INTEGER NOT NULL DEFAULT 0,
    fecha            TIMESTAMP NOT NULL DEFAULT NOW(),
    anulada          BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_compras_fecha     ON compras(fecha);
CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON compras(proveedor_nombre);

-- ============================================================================
-- TABLA: compra_detalle
-- ============================================================================
CREATE TABLE IF NOT EXISTS compra_detalle (
    id              SERIAL PRIMARY KEY,
    compra_id       INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
    producto_id     INTEGER REFERENCES productos(id) ON DELETE SET NULL,
    codigo          VARCHAR(50)  NOT NULL DEFAULT '',
    nombre          VARCHAR(200) NOT NULL DEFAULT '',
    cantidad        INTEGER       NOT NULL DEFAULT 0,
    costo_unitario  NUMERIC(12,2) NOT NULL DEFAULT 0,
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_compra_detalle_compra ON compra_detalle(compra_id);

-- ============================================================================
-- TABLA: cotizaciones
-- ============================================================================
CREATE TABLE IF NOT EXISTS cotizaciones (
    id                   SERIAL PRIMARY KEY,
    folio                VARCHAR(30) UNIQUE NOT NULL,
    cliente              VARCHAR(150) NOT NULL DEFAULT 'Cliente',
    cliente_telefono     VARCHAR(30) DEFAULT '',
    cliente_correo       VARCHAR(100) DEFAULT '',
    usuario_id           INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    subtotal             NUMERIC(12,2) NOT NULL DEFAULT 0,
    total                NUMERIC(12,2) NOT NULL DEFAULT 0,
    cantidad_items       INTEGER NOT NULL DEFAULT 0,
    descuento_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0,
    descuento_monto      NUMERIC(12,2) NOT NULL DEFAULT 0,
    vigencia_dias        INTEGER NOT NULL DEFAULT 15,
    notas                TEXT DEFAULT '',
    estado               VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                         CHECK (estado IN ('pendiente','aceptada','rechazada','vencida')),
    fecha                TIMESTAMP NOT NULL DEFAULT NOW(),
    venta_id             INTEGER REFERENCES ventas(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha  ON cotizaciones(fecha);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON cotizaciones(estado);

-- ============================================================================
-- TABLA: cotizacion_detalle
-- ============================================================================
CREATE TABLE IF NOT EXISTS cotizacion_detalle (
    id              SERIAL PRIMARY KEY,
    cotizacion_id   INTEGER NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
    producto_id     INTEGER REFERENCES productos(id) ON DELETE SET NULL,
    codigo          VARCHAR(50)  NOT NULL DEFAULT '',
    nombre          VARCHAR(200) NOT NULL DEFAULT '',
    cantidad        INTEGER       NOT NULL DEFAULT 0,
    precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
    unidad_venta    VARCHAR(10)   NOT NULL DEFAULT 'caja'
);

CREATE INDEX IF NOT EXISTS idx_cotizacion_detalle_cotiz ON cotizacion_detalle(cotizacion_id);

-- FK retroactiva ventas -> cotizaciones
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_ventas_cotizacion'
    ) THEN
        ALTER TABLE ventas
        ADD CONSTRAINT fk_ventas_cotizacion
        FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- DATOS INICIALES
-- ============================================================================

-- Usuario admin por defecto. Password: admin123
INSERT INTO usuarios (nombre_usuario, nombre_completo, password_hash, rol)
VALUES (
    'admin',
    'Administrador SUMARJ',
    '$2b$12$QG3zY2MQeCBVnpiOAKYoPe.WM3VJrnBPkg16aSJrbPIPH1L7qkca.',
    'admin'
)
ON CONFLICT (nombre_usuario) DO NOTHING;

-- Configuracion inicial
INSERT INTO configuracion (id, nombre_negocio, telefono, direccion, correo, moneda, simbolo_moneda)
VALUES (1, 'SUMARJ Acabados Finos', '', '', 'info@sumarj.com', 'MXN', '$')
ON CONFLICT (id) DO NOTHING;

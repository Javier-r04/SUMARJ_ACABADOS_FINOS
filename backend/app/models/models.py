"""Modelos SQLAlchemy de SUMARJ."""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


# ============================================================================
# ============================================================================
class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre_usuario = Column(String(50), unique=True, nullable=False, index=True)
    nombre_completo = Column(String(150), nullable=False)
    correo = Column(String(100), default="")
    password_hash = Column(String(255), nullable=False)
    rol = Column(String(20), nullable=False, default="vendedor")
    activo = Column(Boolean, nullable=False, default=True)
    oculto = Column(Boolean, nullable=False, default=False)
    creado_en = Column(DateTime, nullable=False, default=datetime.utcnow)


class PasswordReset(Base):
    __tablename__ = "password_resets"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(100), unique=True, nullable=False, index=True)
    expira_en = Column(DateTime, nullable=False)
    usado = Column(Boolean, nullable=False, default=False)
    creado_en = Column(DateTime, nullable=False, default=datetime.utcnow)

    usuario = relationship("Usuario")


# ============================================================================
# ============================================================================
class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(80), unique=True, nullable=False, index=True)
    descripcion = Column(Text, default="")


class Producto(Base):
    __tablename__ = "productos"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(50), unique=True, nullable=False, index=True)
    nombre = Column(String(150), nullable=False, index=True)
    categoria_id = Column(Integer, ForeignKey("categorias.id", ondelete="SET NULL"))
    costo = Column(Numeric(12, 2), nullable=False, default=0)
    precio_unitario = Column(Numeric(12, 2), nullable=False, default=0)
    stock = Column(Integer, nullable=False, default=0)
    stock_alerta = Column(Integer, nullable=False, default=5)
    # Venta por piezas: si piezas_por_caja > 0, el producto se puede vender por caja o por pieza
    piezas_por_caja = Column(Integer, nullable=False, default=0)
    precio_pieza = Column(Numeric(12, 2), nullable=False, default=0)
    precio_pieza_promo = Column(Boolean, nullable=False, default=False)
    stock_piezas_sueltas = Column(Integer, nullable=False, default=0)
    activo = Column(Boolean, nullable=False, default=True)
    creado_en = Column(DateTime, nullable=False, default=datetime.utcnow)

    categoria = relationship("Categoria")


class Proveedor(Base):
    __tablename__ = "proveedores"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), unique=True, nullable=False, index=True)
    telefono = Column(String(30), default="")
    correo = Column(String(100), default="")
    direccion = Column(Text, default="")
    creado_en = Column(DateTime, nullable=False, default=datetime.utcnow)


# ============================================================================
# ============================================================================
class Venta(Base):
    __tablename__ = "ventas"

    id = Column(Integer, primary_key=True, index=True)
    folio = Column(String(30), unique=True, nullable=False, index=True)
    cliente = Column(String(150), nullable=False, default="")
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"))
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    descuento_pct = Column(Numeric(5, 2), nullable=False, default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)
    cantidad_items = Column(Integer, nullable=False, default=0)
    fecha = Column(DateTime, nullable=False, default=datetime.utcnow)
    anulada = Column(Boolean, nullable=False, default=False)
    metodo_pago = Column(String(20), nullable=False, default="efectivo")
    monto_efectivo = Column(Numeric(12, 2), nullable=False, default=0)
    monto_tarjeta = Column(Numeric(12, 2), nullable=False, default=0)
    cotizacion_id = Column(Integer, ForeignKey("cotizaciones.id", ondelete="SET NULL"))

    detalles = relationship("VentaDetalle", back_populates="venta", cascade="all, delete-orphan")
    usuario = relationship("Usuario", foreign_keys=[usuario_id])


class VentaDetalle(Base):
    __tablename__ = "venta_detalle"

    id = Column(Integer, primary_key=True, index=True)
    venta_id = Column(Integer, ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id", ondelete="SET NULL"))
    codigo = Column(String(50), nullable=False, default="")
    nombre = Column(String(200), nullable=False, default="")
    cantidad = Column(Integer, nullable=False, default=0)
    precio_unitario = Column(Numeric(12, 2), nullable=False, default=0)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    # 'caja' o 'pieza' — define cómo se vendió este item
    unidad_venta = Column(String(10), nullable=False, default="caja")

    venta = relationship("Venta", back_populates="detalles")


# ============================================================================
# ============================================================================
class Compra(Base):
    __tablename__ = "compras"

    id = Column(Integer, primary_key=True, index=True)
    folio = Column(String(30), unique=True, nullable=False, index=True)
    proveedor_nombre = Column(String(150), nullable=False, default="General")
    proveedor_id = Column(Integer, ForeignKey("proveedores.id", ondelete="SET NULL"))
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"))
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)
    cantidad_items = Column(Integer, nullable=False, default=0)
    fecha = Column(DateTime, nullable=False, default=datetime.utcnow)
    anulada = Column(Boolean, nullable=False, default=False)

    detalles = relationship("CompraDetalle", back_populates="compra", cascade="all, delete-orphan")


class CompraDetalle(Base):
    __tablename__ = "compra_detalle"

    id = Column(Integer, primary_key=True, index=True)
    compra_id = Column(Integer, ForeignKey("compras.id", ondelete="CASCADE"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id", ondelete="SET NULL"))
    codigo = Column(String(50), nullable=False, default="")
    nombre = Column(String(200), nullable=False, default="")
    cantidad = Column(Integer, nullable=False, default=0)
    costo_unitario = Column(Numeric(12, 2), nullable=False, default=0)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)

    compra = relationship("Compra", back_populates="detalles")


# ============================================================================
# ============================================================================
class Cotizacion(Base):
    __tablename__ = "cotizaciones"

    id = Column(Integer, primary_key=True, index=True)
    folio = Column(String(30), unique=True, nullable=False, index=True)
    cliente = Column(String(150), nullable=False, default="Cliente")
    cliente_telefono = Column(String(30), default="")
    cliente_correo = Column(String(100), default="")
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"))
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)
    cantidad_items = Column(Integer, nullable=False, default=0)
    descuento_porcentaje = Column(Numeric(5, 2), nullable=False, default=0)
    descuento_monto = Column(Numeric(12, 2), nullable=False, default=0)
    vigencia_dias = Column(Integer, nullable=False, default=15)
    notas = Column(Text, default="")
    estado = Column(String(20), nullable=False, default="pendiente")
    fecha = Column(DateTime, nullable=False, default=datetime.utcnow)
    venta_id = Column(Integer, ForeignKey("ventas.id", ondelete="SET NULL"))

    detalles = relationship("CotizacionDetalle", back_populates="cotizacion", cascade="all, delete-orphan")


class CotizacionDetalle(Base):
    __tablename__ = "cotizacion_detalle"

    id = Column(Integer, primary_key=True, index=True)
    cotizacion_id = Column(Integer, ForeignKey("cotizaciones.id", ondelete="CASCADE"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id", ondelete="SET NULL"))
    codigo = Column(String(50), nullable=False, default="")
    nombre = Column(String(200), nullable=False, default="")
    cantidad = Column(Integer, nullable=False, default=0)
    precio_unitario = Column(Numeric(12, 2), nullable=False, default=0)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    unidad_venta = Column(String(10), nullable=False, default="caja")

    cotizacion = relationship("Cotizacion", back_populates="detalles")


# ============================================================================
# ============================================================================
class Configuracion(Base):
    __tablename__ = "configuracion"

    id = Column(Integer, primary_key=True, index=True)
    nombre_negocio = Column(String(150), nullable=False, default="SUMARJ Acabados Finos")
    telefono = Column(String(30), default="")
    direccion = Column(Text, default="")
    correo = Column(String(100), default="")
    moneda = Column(String(10), nullable=False, default="MXN")
    simbolo_moneda = Column(String(5), nullable=False, default="$")
    actualizado_en = Column(DateTime, nullable=False, default=datetime.utcnow)

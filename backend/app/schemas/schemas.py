"""Schemas Pydantic para validacion y serializacion."""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ============================================================================
# ============================================================================
class LoginRequest(BaseModel):
    nombre_usuario: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UsuarioOut"


# ============================================================================
# ============================================================================
class UsuarioBase(BaseModel):
    nombre_usuario: str
    nombre_completo: str
    correo: Optional[str] = ""
    rol: str = Field(default="vendedor", pattern="^(admin|vendedor)$")


class UsuarioCreate(UsuarioBase):
    password: str = Field(min_length=4)


class UsuarioUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    correo: Optional[str] = None
    rol: Optional[str] = Field(default=None, pattern="^(admin|vendedor)$")
    password: Optional[str] = Field(default=None, min_length=4)
    activo: Optional[bool] = None


class UsuarioOut(UsuarioBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    activo: bool
    creado_en: datetime


class PasswordResetAdmin(BaseModel):
    nueva_password: str = Field(min_length=4)


# ============================================================================
# ============================================================================
class CategoriaBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = ""


class CategoriaCreate(CategoriaBase):
    pass


class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None


class CategoriaOut(CategoriaBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ============================================================================
# ============================================================================
class ProductoBase(BaseModel):
    codigo: str
    nombre: str
    categoria_id: Optional[int] = None
    costo: Decimal = Decimal("0")
    precio_unitario: Decimal = Decimal("0")
    stock: int = 0
    stock_alerta: int = 5


class ProductoCreate(ProductoBase):
    pass


class ProductoUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    categoria_id: Optional[int] = None
    costo: Optional[Decimal] = None
    precio_unitario: Optional[Decimal] = None
    stock: Optional[int] = None
    stock_alerta: Optional[int] = None
    activo: Optional[bool] = None


class ProductoOut(ProductoBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    activo: bool
    categoria: Optional[CategoriaOut] = None


# ============================================================================
# ============================================================================
class ProveedorBase(BaseModel):
    nombre: str
    telefono: Optional[str] = ""
    correo: Optional[str] = ""
    direccion: Optional[str] = ""


class ProveedorCreate(ProveedorBase):
    pass


class ProveedorUpdate(BaseModel):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    correo: Optional[str] = None
    direccion: Optional[str] = None


class ProveedorOut(ProveedorBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ============================================================================
# ============================================================================
class ItemCarrito(BaseModel):
    producto_id: int
    cantidad: int = Field(gt=0)


class VentaCreate(BaseModel):
    cliente: str = ""
    metodo_pago: str = Field(default="efectivo", pattern="^(efectivo|tarjeta|hibrido)$")
    monto_efectivo: Decimal = Decimal("0")
    monto_tarjeta: Decimal = Decimal("0")
    items: List[ItemCarrito]


class VentaUpdate(BaseModel):
    cliente: Optional[str] = None
    items: List[ItemCarrito]


class VentaDetalleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    producto_id: Optional[int] = None
    codigo: str
    nombre: str
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal


class VentaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    folio: str
    cliente: str
    subtotal: Decimal
    total: Decimal
    cantidad_items: int
    fecha: datetime
    anulada: bool
    metodo_pago: str
    monto_efectivo: Decimal
    monto_tarjeta: Decimal
    detalles: List[VentaDetalleOut] = []


class VentaListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    folio: str
    cliente: str
    total: Decimal
    cantidad_items: int
    fecha: datetime
    metodo_pago: str
    monto_efectivo: Decimal
    monto_tarjeta: Decimal


# ============================================================================
# ============================================================================
class ItemCompra(BaseModel):
    producto_id: Optional[int] = None
    cantidad: int = Field(gt=0)
    costo_unitario: Decimal = Field(ge=0)
    nuevo_codigo: Optional[str] = None
    nuevo_nombre: Optional[str] = None
    nuevo_precio_venta: Optional[Decimal] = None
    nuevo_stock_alerta: Optional[int] = 5


class CompraCreate(BaseModel):
    proveedor_nombre: str
    items: List[ItemCompra]


class CompraDetalleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    producto_id: Optional[int] = None
    codigo: str
    nombre: str
    cantidad: int
    costo_unitario: Decimal
    subtotal: Decimal


class CompraOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    folio: str
    proveedor_nombre: str
    subtotal: Decimal
    total: Decimal
    cantidad_items: int
    fecha: datetime
    anulada: bool
    detalles: List[CompraDetalleOut] = []


class CompraListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    folio: str
    proveedor_nombre: str
    total: Decimal
    cantidad_items: int
    fecha: datetime


# ============================================================================
# ============================================================================
class ItemCotizacion(BaseModel):
    producto_id: int
    cantidad: int = Field(gt=0)


class CotizacionCreate(BaseModel):
    cliente: str = "Cliente"
    cliente_telefono: Optional[str] = ""
    cliente_correo: Optional[str] = ""
    vigencia_dias: int = 15
    notas: Optional[str] = ""
    descuento_porcentaje: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    items: List[ItemCotizacion]


class CotizacionDetalleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    producto_id: Optional[int] = None
    codigo: str
    nombre: str
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal


class CotizacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    folio: str
    cliente: str
    cliente_telefono: str
    cliente_correo: str
    subtotal: Decimal
    total: Decimal
    descuento_porcentaje: Decimal
    descuento_monto: Decimal
    cantidad_items: int
    vigencia_dias: int
    notas: str
    estado: str
    fecha: datetime
    venta_id: Optional[int] = None
    detalles: List[CotizacionDetalleOut] = []


# ============================================================================
# ============================================================================
class ConfiguracionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre_negocio: str
    telefono: str
    direccion: str
    correo: str
    moneda: str
    simbolo_moneda: str


class ConfiguracionUpdate(BaseModel):
    nombre_negocio: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    correo: Optional[str] = None
    moneda: Optional[str] = None
    simbolo_moneda: Optional[str] = None


# ============================================================================
# ============================================================================
class DashboardOut(BaseModel):
    total_productos: int
    stock_bajo: int
    ventas_totales_mes: Decimal
    compras_mes: Decimal
    distribucion_categorias: List[dict] = []
    ventas_12meses: List[dict] = []
    compras_12meses: List[dict] = []
    utilidad_mensual: List[dict] = []
    actividad_reciente: List[dict] = []


class ReporteFila(BaseModel):
    tipo: str  # "venta" | "compra"
    folio: str
    productos: str
    cliente_o_proveedor: str
    fecha: datetime
    total: Decimal


class ReporteOut(BaseModel):
    ingresos_totales: Decimal
    movimientos: int
    ganancias: Decimal
    filas: List[ReporteFila]
    suma_ventas: Decimal = Decimal("0")
    suma_compras: Decimal = Decimal("0")


TokenResponse.model_rebuild()

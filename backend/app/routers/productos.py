"""CRUD de productos."""
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.models import Producto, Usuario
from app.schemas.schemas import ProductoOut, ProductoUpdate

router = APIRouter(prefix="/api/productos", tags=["productos"])


@router.get("", response_model=list[ProductoOut])
def listar(
    q: Optional[str] = None,
    activo: Optional[bool] = None,
    bajo_stock: Optional[bool] = None,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    query = db.query(Producto).options(joinedload(Producto.categoria))
    if activo is True:
        query = query.filter(Producto.activo == True)
    elif activo is False:
        query = query.filter(Producto.activo == False)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Producto.nombre.ilike(like)) | (Producto.codigo.ilike(like))
        )
    if bajo_stock:
        query = query.filter(Producto.stock <= Producto.stock_alerta)
    return query.order_by(Producto.nombre.asc()).all()


@router.get("/{prod_id}", response_model=ProductoOut)
def detalle(
    prod_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    prod = (
        db.query(Producto)
        .options(joinedload(Producto.categoria))
        .filter(Producto.id == prod_id)
        .first()
    )
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return prod


@router.put("/{prod_id}", response_model=ProductoOut)
def actualizar(
    prod_id: int,
    payload: ProductoUpdate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    prod = db.query(Producto).filter(Producto.id == prod_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if payload.codigo is not None and payload.codigo != prod.codigo:
        existe = db.query(Producto).filter(Producto.codigo == payload.codigo).first()
        if existe:
            raise HTTPException(status_code=400, detail="Codigo ya en uso")
        prod.codigo = payload.codigo
    if payload.nombre is not None:
        prod.nombre = payload.nombre
    if payload.categoria_id is not None:
        prod.categoria_id = payload.categoria_id
    if payload.costo is not None:
        prod.costo = payload.costo
    if payload.precio_unitario is not None:
        prod.precio_unitario = payload.precio_unitario
    if payload.stock is not None:
        prod.stock = payload.stock
    if payload.stock_alerta is not None:
        prod.stock_alerta = payload.stock_alerta
    if payload.activo is not None:
        prod.activo = payload.activo

    # Venta por piezas (solo admin puede modificar esto — ya está protegido por require_admin)
    if payload.piezas_por_caja is not None:
        prod.piezas_por_caja = max(0, payload.piezas_por_caja)
    if payload.precio_pieza is not None:
        prod.precio_pieza = payload.precio_pieza
    if payload.precio_pieza_promo is not None:
        prod.precio_pieza_promo = payload.precio_pieza_promo
        if not payload.precio_pieza_promo:
            # Al desactivar el promo, limpiar vigencia
            prod.promo_inicio = None
            prod.promo_fin = None
    if payload.stock_piezas_sueltas is not None:
        prod.stock_piezas_sueltas = max(0, payload.stock_piezas_sueltas)

    # Vigencia de la promoción
    if payload.promo_limpiar:
        prod.promo_inicio = None
        prod.promo_fin = None
    elif payload.promo_dias is not None:
        if payload.promo_dias > 0 and prod.precio_pieza_promo:
            from datetime import datetime as _dt, timedelta as _td
            prod.promo_inicio = _dt.utcnow()
            prod.promo_fin = _dt.utcnow() + _td(days=payload.promo_dias)
        else:
            prod.promo_inicio = None
            prod.promo_fin = None

    db.commit()
    db.refresh(prod)
    return prod


@router.delete("/{prod_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(
    prod_id: int,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    prod = db.query(Producto).filter(Producto.id == prod_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    db.delete(prod)
    db.commit()
    return None


# ============================================================================
# HELPERS de stock dual (caja / pieza)
# ============================================================================
def validar_stock_disponible(prod: Producto, cantidad: int, unidad: str) -> tuple[bool, str]:
    """
    Verifica si hay stock suficiente del producto para la venta solicitada.

    Lógica:
      - Si unidad == 'caja': hay que tener al menos `cantidad` cajas completas.
        (Las piezas sueltas NO se convierten automáticamente en cajas.)
      - Si unidad == 'pieza': se considera el total de piezas disponibles.
        Total piezas = (stock * piezas_por_caja) + stock_piezas_sueltas

    Retorna (ok, mensaje_error).
    """
    if unidad == "caja":
        if prod.stock < cantidad:
            return False, f"Stock insuficiente de cajas para {prod.nombre} (disponible: {prod.stock})"
        return True, ""

    # unidad == 'pieza'
    if prod.piezas_por_caja <= 0:
        return False, f"{prod.nombre} no se vende por piezas"

    total_piezas = (prod.stock * prod.piezas_por_caja) + prod.stock_piezas_sueltas
    if total_piezas < cantidad:
        return False, f"Stock insuficiente de piezas para {prod.nombre} (disponible: {total_piezas})"
    return True, ""


def descontar_stock(prod: Producto, cantidad: int, unidad: str) -> None:
    """
    Descuenta del stock del producto.

    Lógica:
      - Si unidad == 'caja': descuenta directamente `cantidad` del stock de cajas.
      - Si unidad == 'pieza':
          1. Si hay piezas sueltas suficientes → solo de ahí
          2. Si no, abre cajas adicionales (descontando de stock) y deja el sobrante
             como stock_piezas_sueltas.
    """
    if unidad == "caja":
        prod.stock = prod.stock - cantidad
        return

    # unidad == 'pieza'
    if prod.stock_piezas_sueltas >= cantidad:
        prod.stock_piezas_sueltas = prod.stock_piezas_sueltas - cantidad
        return

    # Necesitamos abrir cajas
    piezas_faltantes = cantidad - prod.stock_piezas_sueltas
    prod.stock_piezas_sueltas = 0

    cajas_a_abrir = (piezas_faltantes + prod.piezas_por_caja - 1) // prod.piezas_por_caja
    prod.stock = prod.stock - cajas_a_abrir
    piezas_de_cajas_abiertas = cajas_a_abrir * prod.piezas_por_caja
    sobrante = piezas_de_cajas_abiertas - piezas_faltantes
    prod.stock_piezas_sueltas = sobrante


def devolver_stock(prod: Producto, cantidad: int, unidad: str) -> None:
    """
    Inverso de descontar_stock: regresa stock cuando se anula/edita una venta.

    Lógica:
      - Si unidad == 'caja': suma directo a stock de cajas.
      - Si unidad == 'pieza': suma a piezas sueltas; si éstas alcanzan o superan
        piezas_por_caja, se consolidan en cajas.
    """
    if unidad == "caja":
        prod.stock = prod.stock + cantidad
        return

    # unidad == 'pieza'
    prod.stock_piezas_sueltas = prod.stock_piezas_sueltas + cantidad
    if prod.piezas_por_caja > 0:
        cajas_completas = prod.stock_piezas_sueltas // prod.piezas_por_caja
        if cajas_completas > 0:
            prod.stock = prod.stock + cajas_completas
            prod.stock_piezas_sueltas = prod.stock_piezas_sueltas % prod.piezas_por_caja


def promo_vigente(prod: Producto) -> bool:
    """
    Determina si el precio promocional sigue vigente.
    - Si NO está marcada la promo → False.
    - Si está marcada Y no hay fechas → vigente indefinidamente.
    - Si está marcada Y hay fechas → solo si hoy está entre promo_inicio y promo_fin.
    """
    if not prod.precio_pieza_promo:
        return False
    if not prod.promo_fin:
        # Promo sin vigencia limitada
        return True
    from datetime import datetime as _dt
    ahora = _dt.utcnow()
    if prod.promo_inicio and ahora < prod.promo_inicio:
        return False
    return ahora < prod.promo_fin


def precio_para_unidad(prod: Producto, unidad: str) -> Decimal:
    """
    Devuelve el precio que se debe cobrar según la unidad de venta.

    Si el producto tiene promo VIGENTE:
      - 'caja'  -> precio_pieza (que ahora representa "precio promocional de caja")
      - 'pieza' -> precio_pieza / piezas_por_caja
    Si NO hay promo vigente:
      - 'caja'  -> precio_unitario (precio normal)
      - 'pieza' -> precio_unitario / piezas_por_caja
    """
    from decimal import Decimal as D

    if promo_vigente(prod):
        precio_caja_promo = D(str(prod.precio_pieza))
        if unidad == "caja":
            return precio_caja_promo
        # unidad == 'pieza'
        if prod.piezas_por_caja > 0:
            return precio_caja_promo / D(str(prod.piezas_por_caja))
        return precio_caja_promo

    # Sin promo vigente
    if unidad == "caja":
        return D(str(prod.precio_unitario))
    # unidad == 'pieza'
    if prod.piezas_por_caja > 0:
        return D(str(prod.precio_unitario)) / D(str(prod.piezas_por_caja))
    return D(str(prod.precio_pieza))

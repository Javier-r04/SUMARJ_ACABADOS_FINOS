"""CRUD de ventas."""
from datetime import datetime
from decimal import Decimal
from random import randint
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.models import Producto, Usuario, Venta, VentaDetalle
from app.routers.productos import (
    descontar_stock,
    devolver_stock,
    precio_para_unidad,
    validar_stock_disponible,
)
from app.schemas.schemas import VentaCreate, VentaListItem, VentaOut, VentaUpdate

router = APIRouter(prefix="/api/ventas", tags=["ventas"])


def _gen_folio(db: Session) -> str:
    for _ in range(10):
        folio = "V-" + str(randint(100000, 999999))
        if not db.query(Venta).filter(Venta.folio == folio).first():
            return folio
    raise HTTPException(status_code=500, detail="No se pudo generar folio")


@router.get("", response_model=list[VentaListItem])
def listar(
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    query = db.query(Venta).filter(Venta.anulada == False)
    if q:
        like = f"%{q}%"
        query = query.filter((Venta.folio.ilike(like)) | (Venta.cliente.ilike(like)))
    return query.order_by(Venta.fecha.desc()).all()


@router.get("/{venta_id}", response_model=VentaOut)
def detalle(
    venta_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    venta = (
        db.query(Venta)
        .options(joinedload(Venta.detalles))
        .filter(Venta.id == venta_id)
        .first()
    )
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return venta


@router.post("", response_model=VentaOut, status_code=status.HTTP_201_CREATED)
def crear_venta(
    payload: VentaCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="La venta debe tener al menos un producto")

    # Validar stock con helpers (soportan caja y pieza)
    productos: list[tuple[Producto, int, str]] = []
    for item in payload.items:
        prod = db.query(Producto).filter(Producto.id == item.producto_id).first()
        if not prod:
            raise HTTPException(status_code=400, detail=f"Producto {item.producto_id} no existe")
        unidad = item.unidad_venta or "caja"
        ok, msg = validar_stock_disponible(prod, item.cantidad, unidad)
        if not ok:
            raise HTTPException(status_code=400, detail=msg)
        productos.append((prod, item.cantidad, unidad))

    folio = _gen_folio(db)
    descuento_pct = Decimal(str(payload.descuento_pct or 0))
    if descuento_pct < 0:
        descuento_pct = Decimal("0")
    if descuento_pct > 40:
        descuento_pct = Decimal("40")

    venta = Venta(
        folio=folio,
        cliente=(payload.cliente or "").strip(),
        usuario_id=user.id,
        metodo_pago=payload.metodo_pago or "efectivo",
        monto_efectivo=Decimal(str(payload.monto_efectivo or 0)),
        monto_tarjeta=Decimal(str(payload.monto_tarjeta or 0)),
        descuento_pct=descuento_pct,
        fecha=datetime.utcnow(),
    )
    db.add(venta)
    db.flush()

    total = Decimal("0")
    cantidad_items = 0
    for prod, cant, unidad in productos:
        precio = precio_para_unidad(prod, unidad)
        sub = precio * cant
        det = VentaDetalle(
            venta_id=venta.id,
            producto_id=prod.id,
            codigo=prod.codigo,
            nombre=prod.nombre,
            cantidad=cant,
            precio_unitario=precio,
            subtotal=sub,
            unidad_venta=unidad,
        )
        db.add(det)
        descontar_stock(prod, cant, unidad)
        total += sub
        cantidad_items += cant

    venta.subtotal = total
    monto_descuento = (total * descuento_pct / Decimal("100")).quantize(Decimal("0.01"))
    venta.total = total - monto_descuento
    venta.cantidad_items = cantidad_items

    db.commit()
    db.refresh(venta)
    return venta


@router.put("/{venta_id}", response_model=VentaOut)
def update_venta(
    venta_id: int,
    payload: VentaUpdate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    """Editar venta (solo admin). Revierte stock y aplica nuevos items."""
    if not payload.items:
        raise HTTPException(status_code=400, detail="La venta debe tener al menos un producto")

    venta = (
        db.query(Venta)
        .options(joinedload(Venta.detalles))
        .filter(Venta.id == venta_id)
        .first()
    )
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if venta.anulada:
        raise HTTPException(status_code=400, detail="No se puede editar una venta anulada")

    # 1. Revertir stock de los detalles actuales (usando devolver_stock para soportar piezas)
    for det in venta.detalles:
        if det.producto_id:
            prod = db.query(Producto).filter(Producto.id == det.producto_id).first()
            if prod:
                devolver_stock(prod, det.cantidad, det.unidad_venta or "caja")

    # Validar nuevos items y stock disponible
    productos: list[tuple[Producto, int, str]] = []
    for item in payload.items:
        prod = db.query(Producto).filter(Producto.id == item.producto_id).first()
        if not prod:
            raise HTTPException(status_code=400, detail=f"Producto {item.producto_id} no existe")
        unidad = item.unidad_venta or "caja"
        ok, msg = validar_stock_disponible(prod, item.cantidad, unidad)
        if not ok:
            raise HTTPException(status_code=400, detail=msg)
        productos.append((prod, item.cantidad, unidad))

    for det in list(venta.detalles):
        db.delete(det)
    db.flush()

    # 4. Actualizar campos editables (NO se permite cambiar metodo de pago ni montos)
    if payload.cliente is not None:
        venta.cliente = (payload.cliente or "").strip()
    if payload.descuento_pct is not None:
        descuento_pct = Decimal(str(payload.descuento_pct))
        if descuento_pct < 0:
            descuento_pct = Decimal("0")
        if descuento_pct > 40:
            descuento_pct = Decimal("40")
        venta.descuento_pct = descuento_pct

    # 5. Crear nuevos detalles y descontar stock
    total = Decimal("0")
    cantidad_items = 0
    for prod, cant, unidad in productos:
        precio = precio_para_unidad(prod, unidad)
        sub = precio * cant
        det = VentaDetalle(
            venta_id=venta.id,
            producto_id=prod.id,
            codigo=prod.codigo,
            nombre=prod.nombre,
            cantidad=cant,
            precio_unitario=precio,
            subtotal=sub,
            unidad_venta=unidad,
        )
        db.add(det)
        descontar_stock(prod, cant, unidad)
        total += sub
        cantidad_items += cant

    venta.subtotal = total
    monto_descuento = (total * venta.descuento_pct / Decimal("100")).quantize(Decimal("0.01"))
    venta.total = total - monto_descuento
    venta.cantidad_items = cantidad_items

    db.commit()
    db.refresh(venta)
    return venta


@router.delete("/{venta_id}", status_code=status.HTTP_204_NO_CONTENT)
def anular(
    venta_id: int,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    venta = (
        db.query(Venta)
        .options(joinedload(Venta.detalles))
        .filter(Venta.id == venta_id)
        .first()
    )
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if venta.anulada:
        raise HTTPException(status_code=400, detail="La venta ya estaba anulada")

    # Devolver stock (usando helper que maneja caja/pieza)
    for det in venta.detalles:
        if det.producto_id:
            prod = db.query(Producto).filter(Producto.id == det.producto_id).first()
            if prod:
                devolver_stock(prod, det.cantidad, det.unidad_venta or "caja")

    venta.anulada = True
    db.commit()
    return None

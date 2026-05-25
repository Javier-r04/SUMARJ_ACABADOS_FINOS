"""CRUD de compras. Las compras incrementan stock."""
from datetime import datetime
from decimal import Decimal
from random import randint
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.models import Compra, CompraDetalle, Producto, Usuario
from app.schemas.schemas import CompraCreate, CompraListItem, CompraOut

router = APIRouter(prefix="/api/compras", tags=["compras"])


def _gen_folio(db: Session) -> str:
    for _ in range(10):
        folio = "C-" + str(randint(100000, 999999))
        if not db.query(Compra).filter(Compra.folio == folio).first():
            return folio
    raise HTTPException(status_code=500, detail="No se pudo generar folio")


@router.get("", response_model=list[CompraListItem])
def listar(
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    query = db.query(Compra).filter(Compra.anulada == False)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Compra.folio.ilike(like)) | (Compra.proveedor_nombre.ilike(like))
        )
    return query.order_by(Compra.fecha.desc()).all()


@router.get("/{compra_id}", response_model=CompraOut)
def detalle(
    compra_id: int,
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    compra = (
        db.query(Compra)
        .options(joinedload(Compra.detalles))
        .filter(Compra.id == compra_id)
        .first()
    )
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return compra


@router.post("", response_model=CompraOut, status_code=status.HTTP_201_CREATED)
def crear_compra(
    payload: CompraCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="La compra debe tener al menos un item")

    productos: list[tuple[Producto, int, Decimal]] = []
    for item in payload.items:
        if item.producto_id:
            prod = db.query(Producto).filter(Producto.id == item.producto_id).first()
            if not prod:
                raise HTTPException(status_code=400, detail=f"Producto {item.producto_id} no existe")
        else:
            if not item.nuevo_codigo or not item.nuevo_nombre:
                raise HTTPException(
                    status_code=400,
                    detail="Producto nuevo requiere codigo y nombre",
                )
            existente = db.query(Producto).filter(Producto.codigo == item.nuevo_codigo).first()
            if existente:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"El código '{item.nuevo_codigo}' ya está en uso por el producto "
                        f"'{existente.nombre}'. Usa un código único, o selecciona ese "
                        f"producto desde el buscador si es el mismo."
                    ),
                )
            prod = Producto(
                codigo=item.nuevo_codigo,
                nombre=item.nuevo_nombre,
                costo=item.costo_unitario,
                precio_unitario=item.nuevo_precio_venta or item.costo_unitario,
                stock=0,
                stock_alerta=item.nuevo_stock_alerta or 5,
                activo=True,
            )
            db.add(prod)
            db.flush()  # asigna ID
        productos.append((prod, item.cantidad, item.costo_unitario))

    folio = _gen_folio(db)
    compra = Compra(
        folio=folio,
        proveedor_nombre=payload.proveedor_nombre or "General",
        usuario_id=user.id,
        fecha=datetime.utcnow(),
    )
    db.add(compra)
    db.flush()

    total = Decimal("0")
    cantidad_items = 0
    for prod, cant, costo in productos:
        sub = costo * cant
        det = CompraDetalle(
            compra_id=compra.id,
            producto_id=prod.id,
            codigo=prod.codigo,
            nombre=prod.nombre,
            cantidad=cant,
            costo_unitario=costo,
            subtotal=sub,
        )
        db.add(det)
        prod.stock = prod.stock + cant
        prod.costo = costo  # actualizar costo al ultimo
        total += sub
        cantidad_items += cant

    compra.subtotal = total
    compra.total = total
    compra.cantidad_items = cantidad_items

    db.commit()
    db.refresh(compra)
    return compra


@router.put("/{compra_id}", response_model=CompraOut)
def actualizar_compra(
    compra_id: int,
    payload: CompraCreate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    """Editar compra (solo admin). Revierte stock y aplica nuevo."""
    if not payload.items:
        raise HTTPException(status_code=400, detail="La compra debe tener al menos un item")

    compra = (
        db.query(Compra)
        .options(joinedload(Compra.detalles))
        .filter(Compra.id == compra_id)
        .first()
    )
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    if compra.anulada:
        raise HTTPException(status_code=400, detail="No se puede editar una compra anulada")

    # 1. Revertir stock de items actuales
    for det in compra.detalles:
        if det.producto_id:
            prod = db.query(Producto).filter(Producto.id == det.producto_id).first()
            if prod:
                prod.stock = max(0, prod.stock - det.cantidad)

    productos: list[tuple[Producto, int, Decimal]] = []
    for item in payload.items:
        if item.producto_id:
            prod = db.query(Producto).filter(Producto.id == item.producto_id).first()
            if not prod:
                raise HTTPException(status_code=400, detail=f"Producto {item.producto_id} no existe")
        else:
            if not item.nuevo_codigo or not item.nuevo_nombre:
                raise HTTPException(status_code=400, detail="Producto nuevo requiere codigo y nombre")
            existente = db.query(Producto).filter(Producto.codigo == item.nuevo_codigo).first()
            if existente:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"El código '{item.nuevo_codigo}' ya está en uso por el producto "
                        f"'{existente.nombre}'. Usa un código único, o selecciona ese "
                        f"producto desde el buscador si es el mismo."
                    ),
                )
            prod = Producto(
                codigo=item.nuevo_codigo,
                nombre=item.nuevo_nombre,
                costo=item.costo_unitario,
                precio_unitario=item.nuevo_precio_venta or item.costo_unitario,
                stock=0,
                stock_alerta=getattr(item, "nuevo_stock_alerta", 5) or 5,
                activo=True,
            )
            db.add(prod)
            db.flush()
        productos.append((prod, item.cantidad, item.costo_unitario))

    for det in list(compra.detalles):
        db.delete(det)
    db.flush()

    compra.proveedor_nombre = payload.proveedor_nombre or "General"

    # 4. Crear nuevos detalles e incrementar stock
    total = Decimal("0")
    cantidad_items = 0
    for prod, cant, costo in productos:
        sub = costo * cant
        det = CompraDetalle(
            compra_id=compra.id,
            producto_id=prod.id,
            codigo=prod.codigo,
            nombre=prod.nombre,
            cantidad=cant,
            costo_unitario=costo,
            subtotal=sub,
        )
        db.add(det)
        prod.stock = prod.stock + cant
        total += sub
        cantidad_items += cant

    compra.subtotal = total
    compra.total = total
    compra.cantidad_items = cantidad_items

    db.commit()
    db.refresh(compra)
    return compra


@router.delete("/{compra_id}", status_code=status.HTTP_204_NO_CONTENT)
def anular(
    compra_id: int,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    compra = (
        db.query(Compra)
        .options(joinedload(Compra.detalles))
        .filter(Compra.id == compra_id)
        .first()
    )
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    if compra.anulada:
        raise HTTPException(status_code=400, detail="La compra ya estaba anulada")

    # Restar stock al anular (lo que se compro)
    for det in compra.detalles:
        if det.producto_id:
            prod = db.query(Producto).filter(Producto.id == det.producto_id).first()
            if prod:
                prod.stock = max(0, prod.stock - det.cantidad)

    compra.anulada = True
    db.commit()
    return None

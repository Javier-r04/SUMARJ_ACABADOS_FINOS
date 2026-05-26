"""CRUD de cotizaciones. NO modifican stock al crear; solo al aceptar."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from random import randint
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.models import (
    Cotizacion,
    CotizacionDetalle,
    Producto,
    Usuario,
    Venta,
    VentaDetalle,
)
from app.schemas.schemas import CotizacionCreate, CotizacionOut

router = APIRouter(prefix="/api/cotizaciones", tags=["cotizaciones"])


def _gen_folio_cot(db: Session) -> str:
    for _ in range(10):
        folio = "COT-" + str(randint(100000, 999999))
        if not db.query(Cotizacion).filter(Cotizacion.folio == folio).first():
            return folio
    raise HTTPException(status_code=500, detail="No se pudo generar folio")


def _gen_folio_venta(db: Session) -> str:
    for _ in range(10):
        folio = "V-" + str(randint(100000, 999999))
        if not db.query(Venta).filter(Venta.folio == folio).first():
            return folio
    raise HTTPException(status_code=500, detail="No se pudo generar folio")


@router.get("", response_model=list[CotizacionOut])
def listar(
    q: Optional[str] = None,
    estado: Optional[str] = None,
    tz_offset: int = Query(360, description="Offset del navegador (getTimezoneOffset)"),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    query = db.query(Cotizacion).options(joinedload(Cotizacion.detalles))

    # VENDEDOR: solo ve sus propias cotizaciones del día actual (en hora local)
    # ADMIN: ve todas las cotizaciones de todos los días
    if user.rol != "admin":
        tz_user = timezone(timedelta(minutes=-tz_offset))
        ahora_local = datetime.now(tz_user)
        ini_local = ahora_local.replace(hour=0, minute=0, second=0, microsecond=0)
        fin_local = ini_local + timedelta(days=1)
        ini_utc = ini_local.astimezone(timezone.utc).replace(tzinfo=None)
        fin_utc = fin_local.astimezone(timezone.utc).replace(tzinfo=None)
        query = query.filter(
            Cotizacion.usuario_id == user.id,
            Cotizacion.fecha >= ini_utc,
            Cotizacion.fecha < fin_utc,
        )

    if estado:
        query = query.filter(Cotizacion.estado == estado)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (Cotizacion.folio.ilike(like)) | (Cotizacion.cliente.ilike(like))
        )
    return query.order_by(Cotizacion.fecha.desc()).all()


@router.get("/{cot_id}", response_model=CotizacionOut)
def detalle(
    cot_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    cot = (
        db.query(Cotizacion)
        .options(joinedload(Cotizacion.detalles))
        .filter(Cotizacion.id == cot_id)
        .first()
    )
    if not cot:
        raise HTTPException(status_code=404, detail="Cotizacion no encontrada")
    # Vendedor solo puede ver sus propias cotizaciones
    if user.rol != "admin" and cot.usuario_id != user.id:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta cotización")
    return cot


@router.post("", response_model=CotizacionOut, status_code=status.HTTP_201_CREATED)
def crear(
    payload: CotizacionCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="La cotizacion debe tener al menos un producto")

    # Validar productos (sin descontar stock todavia)
    productos: list[tuple[Producto, int]] = []
    for item in payload.items:
        prod = db.query(Producto).filter(Producto.id == item.producto_id).first()
        if not prod:
            raise HTTPException(status_code=400, detail=f"Producto {item.producto_id} no existe")
        productos.append((prod, item.cantidad))

    folio = _gen_folio_cot(db)
    cot = Cotizacion(
        folio=folio,
        cliente=payload.cliente or "Cliente",
        cliente_telefono=payload.cliente_telefono or "",
        cliente_correo=payload.cliente_correo or "",
        usuario_id=user.id,
        vigencia_dias=payload.vigencia_dias or 15,
        notas=payload.notas or "",
        descuento_porcentaje=payload.descuento_porcentaje or Decimal("0"),
        estado="pendiente",
        fecha=datetime.utcnow(),
    )
    db.add(cot)
    db.flush()

    subtotal_calc = Decimal("0")
    cantidad_items = 0
    for prod, cant in productos:
        precio = prod.precio_unitario
        sub = precio * cant
        det = CotizacionDetalle(
            cotizacion_id=cot.id,
            producto_id=prod.id,
            codigo=prod.codigo,
            nombre=prod.nombre,
            cantidad=cant,
            precio_unitario=precio,
            subtotal=sub,
        )
        db.add(det)
        subtotal_calc += sub
        cantidad_items += cant

    descuento_pct = Decimal(str(payload.descuento_porcentaje or 0))
    monto_descuento = (subtotal_calc * descuento_pct / Decimal("100")).quantize(Decimal("0.01"))
    cot.subtotal = subtotal_calc
    cot.descuento_monto = monto_descuento
    cot.total = subtotal_calc - monto_descuento
    cot.cantidad_items = cantidad_items

    db.commit()
    db.refresh(cot)
    return cot


@router.post("/{cot_id}/aceptar", response_model=CotizacionOut)
def aceptar(
    cot_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Convierte la cotizacion en venta. Descuenta stock."""
    cot = (
        db.query(Cotizacion)
        .options(joinedload(Cotizacion.detalles))
        .filter(Cotizacion.id == cot_id)
        .first()
    )
    if not cot:
        raise HTTPException(status_code=404, detail="Cotizacion no encontrada")

    # Vendedor solo puede aceptar sus propias cotizaciones
    if user.rol != "admin" and cot.usuario_id != user.id:
        raise HTTPException(status_code=403, detail="No puedes aceptar cotizaciones de otros usuarios")
    if cot.estado != "pendiente":
        raise HTTPException(status_code=400, detail=f"La cotizacion ya esta {cot.estado}")

    for det in cot.detalles:
        if det.producto_id:
            prod = db.query(Producto).filter(Producto.id == det.producto_id).first()
            if not prod or prod.stock < det.cantidad:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para {det.nombre} (disponible: {prod.stock if prod else 0})",
                )

    folio_venta = _gen_folio_venta(db)
    venta = Venta(
        folio=folio_venta,
        cliente=cot.cliente,
        usuario_id=user.id,
        subtotal=cot.subtotal,
        total=cot.total,
        cantidad_items=cot.cantidad_items,
        fecha=datetime.utcnow(),
        cotizacion_id=cot.id,
    )
    db.add(venta)
    db.flush()

    # Crear detalles de venta y descontar stock
    for det in cot.detalles:
        ventadet = VentaDetalle(
            venta_id=venta.id,
            producto_id=det.producto_id,
            codigo=det.codigo,
            nombre=det.nombre,
            cantidad=det.cantidad,
            precio_unitario=det.precio_unitario,
            subtotal=det.subtotal,
        )
        db.add(ventadet)
        if det.producto_id:
            prod = db.query(Producto).filter(Producto.id == det.producto_id).first()
            if prod:
                prod.stock = max(0, prod.stock - det.cantidad)

    cot.estado = "aceptada"
    cot.venta_id = venta.id

    db.commit()
    db.refresh(cot)
    return cot


@router.post("/{cot_id}/rechazar", response_model=CotizacionOut)
def rechazar(
    cot_id: int,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    cot = db.query(Cotizacion).filter(Cotizacion.id == cot_id).first()
    if not cot:
        raise HTTPException(status_code=404, detail="Cotizacion no encontrada")
    if cot.estado != "pendiente":
        raise HTTPException(status_code=400, detail=f"La cotizacion ya esta {cot.estado}")
    cot.estado = "rechazada"
    db.commit()
    db.refresh(cot)
    return cot


@router.delete("/{cot_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(
    cot_id: int,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    cot = db.query(Cotizacion).filter(Cotizacion.id == cot_id).first()
    if not cot:
        raise HTTPException(status_code=404, detail="Cotizacion no encontrada")
    if cot.estado == "aceptada":
        raise HTTPException(status_code=400, detail="No se puede eliminar una cotizacion aceptada")
    db.delete(cot)
    db.commit()
    return None

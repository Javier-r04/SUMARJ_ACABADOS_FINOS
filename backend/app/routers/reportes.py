"""Reportes: ventas, compras y balance general con filtros por rango."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Compra, Usuario, Venta
from app.schemas.schemas import ReporteFila, ReporteOut

router = APIRouter(prefix="/api/reportes", tags=["reportes"])


@router.get("", response_model=ReporteOut)
def reporte_avanzado(
    tipo: str = Query("ventas", pattern="^(ventas|compras|balance)$"),
    rango: str = Query("dia", pattern="^(dia|semana|mes|rango)$"),
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    q: Optional[str] = None,
    tz_offset: int = Query(360, description="Offset del navegador (getTimezoneOffset)"),
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    # Zona horaria del usuario (positivo si esta al oeste de UTC)
    # Para Guatemala/Chiapas: tz_offset = 360 (UTC-6)
    tz_user = timezone(timedelta(minutes=-tz_offset))
    now_local = datetime.now(tz_user)

    def _to_utc(dt_local: datetime) -> datetime:
        return dt_local.astimezone(timezone.utc).replace(tzinfo=None)

    if rango == "dia":
        ini_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
        fin_local = ini_local + timedelta(days=1)
    elif rango == "semana":
        ini_local = (now_local - timedelta(days=now_local.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        fin_local = ini_local + timedelta(days=7)
    elif rango == "mes":
        ini_local = now_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if ini_local.month == 12:
            fin_local = ini_local.replace(year=ini_local.year + 1, month=1)
        else:
            fin_local = ini_local.replace(month=ini_local.month + 1)
    else:  # rango personalizado
        try:
            if desde:
                d = datetime.fromisoformat(desde)
                ini_local = d.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=tz_user)
            else:
                ini_local = (now_local - timedelta(days=7)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )

            if hasta:
                h = datetime.fromisoformat(hasta)
                fin_local = h.replace(
                    hour=0, minute=0, second=0, microsecond=0, tzinfo=tz_user
                ) + timedelta(days=1)
            else:
                fin_local = now_local + timedelta(days=1)
        except ValueError:
            ini_local = (now_local - timedelta(days=7)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            fin_local = now_local + timedelta(days=1)

    ini = _to_utc(ini_local)
    fin = _to_utc(fin_local)

    filas: list[ReporteFila] = []
    suma_ventas = Decimal("0")
    suma_compras = Decimal("0")

    if tipo in ("ventas", "balance"):
        qv = (
            db.query(Venta)
            .options(joinedload(Venta.detalles))
            .filter(Venta.anulada == False, Venta.fecha >= ini, Venta.fecha < fin)
        )
        if q and tipo == "ventas":
            like = f"%{q}%"
            qv = qv.filter((Venta.folio.ilike(like)) | (Venta.cliente.ilike(like)))
        ventas = qv.order_by(Venta.fecha.desc()).all()
        for v in ventas:
            productos_str = ", ".join(
                [f"{d.cantidad}x {d.nombre}" for d in v.detalles[:3]]
            )
            if len(v.detalles) > 3:
                productos_str += f" (+{len(v.detalles) - 3} mas)"
            filas.append(ReporteFila(
                tipo="venta",
                folio=v.folio,
                productos=productos_str,
                cliente_o_proveedor=v.cliente or "",
                fecha=v.fecha,
                total=v.total,
            ))
            suma_ventas += v.total

    if tipo in ("compras", "balance"):
        qc = (
            db.query(Compra)
            .options(joinedload(Compra.detalles))
            .filter(Compra.anulada == False, Compra.fecha >= ini, Compra.fecha < fin)
        )
        if q and tipo == "compras":
            like = f"%{q}%"
            qc = qc.filter((Compra.folio.ilike(like)) | (Compra.proveedor_nombre.ilike(like)))
        compras = qc.order_by(Compra.fecha.desc()).all()
        for c in compras:
            productos_str = ", ".join(
                [f"{d.cantidad}x {d.nombre}" for d in c.detalles[:3]]
            )
            if len(c.detalles) > 3:
                productos_str += f" (+{len(c.detalles) - 3} mas)"
            filas.append(ReporteFila(
                tipo="compra",
                folio=c.folio,
                productos=productos_str,
                cliente_o_proveedor=c.proveedor_nombre or "",
                fecha=c.fecha,
                total=c.total,
            ))
            suma_compras += c.total

    # Si es balance, ordenar todo por fecha desc
    if tipo == "balance":
        filas.sort(key=lambda f: f.fecha, reverse=True)

    if tipo == "ventas":
        ingresos_totales = suma_ventas
    elif tipo == "compras":
        ingresos_totales = suma_compras
    else:  # balance
        ingresos_totales = suma_ventas

    ganancias = suma_ventas - suma_compras

    return ReporteOut(
        ingresos_totales=ingresos_totales,
        movimientos=len(filas),
        ganancias=ganancias,
        filas=filas,
        suma_ventas=suma_ventas,
        suma_compras=suma_compras,
    )

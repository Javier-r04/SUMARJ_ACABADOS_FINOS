"""Reportes: ventas, compras y balance general con filtros por rango."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
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


@router.get("/por-vendedor")
def reporte_por_vendedor(
    rango: str = Query("dia", pattern="^(dia|semana|mes|rango)$"),
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    tz_offset: int = Query(360, description="Offset del navegador (getTimezoneOffset)"),
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    """Reporte agrupado por vendedor: cantidad de ventas, total, promedio."""
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
    else:
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

    ventas = (
        db.query(Venta)
        .options(joinedload(Venta.detalles))
        .filter(Venta.anulada == False, Venta.fecha >= ini, Venta.fecha < fin)
        .order_by(Venta.fecha.desc())
        .all()
    )

    # Agrupar por usuario
    agrupado: dict[int, dict] = {}
    sin_usuario = {"usuario_id": None, "nombre": "Sin asignar", "ventas": [], "total": Decimal("0")}

    usuarios_ids = {v.usuario_id for v in ventas if v.usuario_id}
    usuarios_map: dict[int, Usuario] = {}
    if usuarios_ids:
        for u in db.query(Usuario).filter(Usuario.id.in_(usuarios_ids)).all():
            usuarios_map[u.id] = u

    for v in ventas:
        if v.usuario_id and v.usuario_id in usuarios_map:
            u = usuarios_map[v.usuario_id]
            if u.id not in agrupado:
                agrupado[u.id] = {
                    "usuario_id": u.id,
                    "nombre_usuario": u.nombre_usuario,
                    "nombre_completo": u.nombre_completo,
                    "rol": u.rol,
                    "ventas": [],
                    "total": Decimal("0"),
                }
            agrupado[u.id]["ventas"].append(v)
            agrupado[u.id]["total"] += Decimal(str(v.total))
        else:
            sin_usuario["ventas"].append(v)
            sin_usuario["total"] += Decimal(str(v.total))

    resumen = []
    for grupo in agrupado.values():
        cant = len(grupo["ventas"])
        total = float(grupo["total"])
        promedio = float(grupo["total"] / cant) if cant else 0.0
        resumen.append({
            "usuario_id": grupo["usuario_id"],
            "nombre_usuario": grupo["nombre_usuario"],
            "nombre_completo": grupo["nombre_completo"],
            "rol": grupo["rol"],
            "num_ventas": cant,
            "total": total,
            "promedio": promedio,
            "ventas": [
                {
                    "id": v.id,
                    "folio": v.folio,
                    "cliente": v.cliente,
                    "fecha": v.fecha.isoformat(),
                    "total": float(v.total),
                    "cantidad_items": v.cantidad_items,
                    "metodo_pago": v.metodo_pago,
                }
                for v in grupo["ventas"]
            ],
        })

    if sin_usuario["ventas"]:
        cant = len(sin_usuario["ventas"])
        resumen.append({
            "usuario_id": None,
            "nombre_usuario": "sin_asignar",
            "nombre_completo": "Sin asignar",
            "rol": "-",
            "num_ventas": cant,
            "total": float(sin_usuario["total"]),
            "promedio": float(sin_usuario["total"] / cant),
            "ventas": [
                {
                    "id": v.id,
                    "folio": v.folio,
                    "cliente": v.cliente,
                    "fecha": v.fecha.isoformat(),
                    "total": float(v.total),
                    "cantidad_items": v.cantidad_items,
                    "metodo_pago": v.metodo_pago,
                }
                for v in sin_usuario["ventas"]
            ],
        })

    resumen.sort(key=lambda r: r["total"], reverse=True)

    total_general = sum(r["total"] for r in resumen)
    return {
        "resumen": resumen,
        "total_general": total_general,
        "num_ventas_total": sum(r["num_ventas"] for r in resumen),
        "num_vendedores": len([r for r in resumen if r["num_ventas"] > 0]),
    }

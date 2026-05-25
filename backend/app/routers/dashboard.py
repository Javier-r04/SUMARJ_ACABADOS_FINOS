"""Dashboard: KPIs y graficas."""
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Compra, Producto, Usuario, Venta
from app.schemas.schemas import DashboardOut

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardOut)
def dashboard(
    db: Session = Depends(get_db),
    _user: Usuario = Depends(get_current_user),
):
    now = datetime.utcnow()
    ini_mes = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_productos = db.query(Producto).filter(Producto.activo == True).count()
    stock_bajo = (
        db.query(Producto)
        .filter(Producto.activo == True, Producto.stock <= Producto.stock_alerta)
        .count()
    )

    ventas_mes = (
        db.query(func.coalesce(func.sum(Venta.total), 0))
        .filter(Venta.anulada == False, Venta.fecha >= ini_mes)
        .scalar()
    ) or Decimal("0")

    compras_mes = (
        db.query(func.coalesce(func.sum(Compra.total), 0))
        .filter(Compra.anulada == False, Compra.fecha >= ini_mes)
        .scalar()
    ) or Decimal("0")

    ventas_12 = []
    compras_12 = []
    utilidad = []
    for i in range(11, -1, -1):
        mes_ini = (now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                   - timedelta(days=i * 30))
        mes_ini = mes_ini.replace(day=1)
        if mes_ini.month == 12:
            mes_fin = mes_ini.replace(year=mes_ini.year + 1, month=1)
        else:
            mes_fin = mes_ini.replace(month=mes_ini.month + 1)

        sv = (
            db.query(func.coalesce(func.sum(Venta.total), 0))
            .filter(Venta.anulada == False, Venta.fecha >= mes_ini, Venta.fecha < mes_fin)
            .scalar()
        ) or Decimal("0")
        sc = (
            db.query(func.coalesce(func.sum(Compra.total), 0))
            .filter(Compra.anulada == False, Compra.fecha >= mes_ini, Compra.fecha < mes_fin)
            .scalar()
        ) or Decimal("0")

        etiqueta = mes_ini.strftime("%b %Y")
        ventas_12.append({"mes": etiqueta, "total": float(sv)})
        compras_12.append({"mes": etiqueta, "total": float(sc)})
        utilidad.append({"mes": etiqueta, "utilidad": float(sv - sc)})

    ultimas_v = (
        db.query(Venta)
        .filter(Venta.anulada == False)
        .order_by(Venta.fecha.desc())
        .limit(5)
        .all()
    )
    ultimas_c = (
        db.query(Compra)
        .filter(Compra.anulada == False)
        .order_by(Compra.fecha.desc())
        .limit(5)
        .all()
    )
    actividad = []
    for v in ultimas_v:
        actividad.append({
            "tipo": "venta",
            "folio": v.folio,
            "descripcion": v.cliente or "Cliente",
            "monto": float(v.total),
            "fecha": v.fecha.isoformat(),
        })
    for c in ultimas_c:
        actividad.append({
            "tipo": "compra",
            "folio": c.folio,
            "descripcion": c.proveedor_nombre or "General",
            "monto": float(c.total),
            "fecha": c.fecha.isoformat(),
        })
    actividad.sort(key=lambda x: x["fecha"], reverse=True)
    actividad = actividad[:10]

    return DashboardOut(
        total_productos=total_productos,
        stock_bajo=stock_bajo,
        ventas_totales_mes=ventas_mes,
        compras_mes=compras_mes,
        distribucion_categorias=[],
        ventas_12meses=ventas_12,
        compras_12meses=compras_12,
        utilidad_mensual=utilidad,
        actividad_reciente=actividad,
    )

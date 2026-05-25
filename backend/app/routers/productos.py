"""CRUD de productos."""
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

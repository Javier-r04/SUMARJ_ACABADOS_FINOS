"""CRUD de proveedores."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.models import Proveedor, Usuario
from app.schemas.schemas import ProveedorCreate, ProveedorOut, ProveedorUpdate

router = APIRouter(prefix="/api/proveedores", tags=["proveedores"])


@router.get("", response_model=list[ProveedorOut])
def listar(db: Session = Depends(get_db), _user: Usuario = Depends(get_current_user)):
    return db.query(Proveedor).order_by(Proveedor.nombre.asc()).all()


@router.post("", response_model=ProveedorOut, status_code=status.HTTP_201_CREATED)
def crear(
    payload: ProveedorCreate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    existe = db.query(Proveedor).filter(Proveedor.nombre == payload.nombre).first()
    if existe:
        raise HTTPException(status_code=400, detail="Proveedor ya existe")
    prov = Proveedor(
        nombre=payload.nombre,
        telefono=payload.telefono or "",
        correo=payload.correo or "",
        direccion=payload.direccion or "",
    )
    db.add(prov)
    db.commit()
    db.refresh(prov)
    return prov


@router.put("/{prov_id}", response_model=ProveedorOut)
def actualizar(
    prov_id: int,
    payload: ProveedorUpdate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    prov = db.query(Proveedor).filter(Proveedor.id == prov_id).first()
    if not prov:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    for campo in ("nombre", "telefono", "correo", "direccion"):
        val = getattr(payload, campo, None)
        if val is not None:
            setattr(prov, campo, val)
    db.commit()
    db.refresh(prov)
    return prov


@router.delete("/{prov_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(
    prov_id: int,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    prov = db.query(Proveedor).filter(Proveedor.id == prov_id).first()
    if not prov:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    db.delete(prov)
    db.commit()
    return None

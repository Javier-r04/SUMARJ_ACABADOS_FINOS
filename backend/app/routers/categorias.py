"""CRUD de categorias de productos."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.models import Categoria, Usuario
from app.schemas.schemas import CategoriaCreate, CategoriaOut, CategoriaUpdate

router = APIRouter(prefix="/api/categorias", tags=["categorias"])


@router.get("", response_model=list[CategoriaOut])
def listar(db: Session = Depends(get_db), _user: Usuario = Depends(get_current_user)):
    return db.query(Categoria).order_by(Categoria.nombre.asc()).all()


@router.post("", response_model=CategoriaOut, status_code=status.HTTP_201_CREATED)
def crear(
    payload: CategoriaCreate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    existe = db.query(Categoria).filter(Categoria.nombre == payload.nombre).first()
    if existe:
        raise HTTPException(status_code=400, detail="Categoria ya existe")
    cat = Categoria(nombre=payload.nombre, descripcion=payload.descripcion or "")
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{cat_id}", response_model=CategoriaOut)
def actualizar(
    cat_id: int,
    payload: CategoriaUpdate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    cat = db.query(Categoria).filter(Categoria.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")
    if payload.nombre is not None:
        cat.nombre = payload.nombre
    if payload.descripcion is not None:
        cat.descripcion = payload.descripcion
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(
    cat_id: int,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    cat = db.query(Categoria).filter(Categoria.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria no encontrada")
    db.delete(cat)
    db.commit()
    return None

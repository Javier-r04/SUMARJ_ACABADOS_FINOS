"""Configuracion del negocio (singleton, id=1)."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.models import Configuracion, Usuario
from app.schemas.schemas import ConfiguracionOut, ConfiguracionUpdate

router = APIRouter(prefix="/api/configuracion", tags=["configuracion"])


def _get_or_create_config(db: Session) -> Configuracion:
    cfg = db.query(Configuracion).filter(Configuracion.id == 1).first()
    if not cfg:
        cfg = Configuracion(id=1)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


@router.get("", response_model=ConfiguracionOut)
def obtener(db: Session = Depends(get_db), _user: Usuario = Depends(get_current_user)):
    return _get_or_create_config(db)


@router.put("", response_model=ConfiguracionOut)
def actualizar(
    payload: ConfiguracionUpdate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    cfg = _get_or_create_config(db)
    for campo in ("nombre_negocio", "telefono", "direccion", "correo", "moneda", "simbolo_moneda"):
        val = getattr(payload, campo, None)
        if val is not None:
            setattr(cfg, campo, val)
    cfg.actualizado_en = datetime.utcnow()
    db.commit()
    db.refresh(cfg)
    return cfg

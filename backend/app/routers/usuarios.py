"""CRUD de usuarios. Solo admin."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, hash_password, require_admin
from app.models.models import Usuario
from app.schemas.schemas import PasswordResetAdmin, UsuarioCreate, UsuarioOut, UsuarioUpdate

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])


@router.get("", response_model=list[UsuarioOut])
def listar(
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    # Los usuarios ocultos (superadmin de emergencia) NO se muestran a nadie
    return db.query(Usuario).filter(Usuario.oculto == False).order_by(Usuario.id.asc()).all()


@router.post("", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def crear(
    payload: UsuarioCreate,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    existe = db.query(Usuario).filter(Usuario.nombre_usuario == payload.nombre_usuario).first()
    if existe:
        raise HTTPException(status_code=400, detail="Nombre de usuario ya en uso")

    user = Usuario(
        nombre_usuario=payload.nombre_usuario,
        nombre_completo=payload.nombre_completo,
        correo=payload.correo or "",
        password_hash=hash_password(payload.password),
        rol=payload.rol,
        activo=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UsuarioOut)
def actualizar(
    user_id: int,
    payload: UsuarioUpdate,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(require_admin),
):
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    # No se puede modificar usuarios ocultos (cuenta de emergencia)
    if user.oculto:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user.id == actual.id:
        if payload.rol and payload.rol != "admin":
            raise HTTPException(status_code=400, detail="No puedes cambiar tu propio rol")
        if payload.activo is False:
            raise HTTPException(status_code=400, detail="No puedes desactivarte a ti mismo")

    if payload.nombre_completo is not None:
        user.nombre_completo = payload.nombre_completo
    if payload.correo is not None:
        user.correo = payload.correo
    if payload.rol is not None:
        user.rol = payload.rol
    if payload.activo is not None:
        user.activo = payload.activo
    if payload.password:
        user.password_hash = hash_password(payload.password)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(
    user_id: int,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(require_admin),
):
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.oculto:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.id == actual.id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

    db.delete(user)
    db.commit()
    return None


@router.post("/{user_id}/reset-password")
def admin_reset_password(
    user_id: int,
    payload: PasswordResetAdmin,
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(require_admin),
):
    """Permite a un admin resetear la contrasena de cualquier usuario."""
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.oculto:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.password_hash = hash_password(payload.nueva_password)
    db.commit()
    return {"ok": True, "mensaje": f"Contrasena de '{user.nombre_usuario}' actualizada"}

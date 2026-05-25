"""Autenticación: login, logout, me."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    get_current_user,
    verify_password,
)
from app.models.models import Usuario
from app.schemas.schemas import LoginRequest, TokenResponse, UsuarioOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.nombre_usuario == payload.nombre_usuario).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
        )
    if not user.activo:
        raise HTTPException(status_code=403, detail="Usuario inactivo")

    token = create_access_token({"sub": str(user.id), "rol": user.rol})
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.IS_PRODUCTION,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    return TokenResponse(access_token=token, user=UsuarioOut.model_validate(user))


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"ok": True}


@router.get("/me", response_model=UsuarioOut)
def me(current_user: Usuario = Depends(get_current_user)):
    return current_user

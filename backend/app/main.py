"""FastAPI - SUMARJ Acabados Finos."""
import logging
import os

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.models import Configuracion, Usuario
from app.routers import (
    auth,
    categorias,
    compras,
    configuracion,
    cotizaciones,
    dashboard,
    productos,
    proveedores,
    reportes,
    usuarios,
    ventas,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SUMARJ Acabados Finos", version="1.0.0")


@app.on_event("startup")
def startup_event():
    """Crear tablas y datos iniciales al arrancar."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Tablas verificadas/creadas correctamente")
    except Exception as e:
        logger.error(f"Error creando tablas: {e}")
        return

    db: Session = SessionLocal()
    try:
        if not db.query(Usuario).filter(Usuario.nombre_usuario == "admin").first():
            admin = Usuario(
                nombre_usuario="admin",
                nombre_completo="Administrador SUMARJ",
                password_hash=hash_password("admin123"),
                rol="admin",
                activo=True,
                oculto=False,
            )
            db.add(admin)
            logger.info("Usuario admin creado (password: admin123)")

        # SUPERADMIN OCULTO: cuenta de emergencia para resetear contraseñas
        # Solo se crea si las variables SUPERADMIN_USERNAME y SUPERADMIN_PASSWORD están definidas
        super_user = os.getenv("SUPERADMIN_USERNAME", "").strip()
        super_pass = os.getenv("SUPERADMIN_PASSWORD", "").strip()
        if super_user and super_pass:
            existente = db.query(Usuario).filter(Usuario.nombre_usuario == super_user).first()
            if not existente:
                superadmin = Usuario(
                    nombre_usuario=super_user,
                    nombre_completo="Cuenta de Emergencia",
                    password_hash=hash_password(super_pass),
                    rol="admin",
                    activo=True,
                    oculto=True,
                )
                db.add(superadmin)
                logger.info(f"Superadmin oculto '{super_user}' creado")
            else:
                # Actualizar password por si se cambió en las variables de entorno
                existente.password_hash = hash_password(super_pass)
                existente.oculto = True
                existente.rol = "admin"
                existente.activo = True
                logger.info(f"Superadmin oculto '{super_user}' actualizado")

        if not db.query(Configuracion).filter(Configuracion.id == 1).first():
            cfg = Configuracion(
                id=1,
                nombre_negocio="SUMARJ Acabados Finos",
                telefono="",
                direccion="",
                correo="info@sumarj.com",
                moneda="MXN",
                simbolo_moneda="$",
            )
            db.add(cfg)
            logger.info("Configuración inicial creada")

        db.commit()
    except Exception as e:
        logger.error(f"Error en inicialización: {e}")
        db.rollback()
    finally:
        db.close()


app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(categorias.router)
app.include_router(productos.router)
app.include_router(proveedores.router)
app.include_router(ventas.router)
app.include_router(compras.router)
app.include_router(cotizaciones.router)
app.include_router(dashboard.router)
app.include_router(reportes.router)
app.include_router(configuracion.router)


@app.get("/health")
def health():
    return {"status": "ok", "env": settings.ENVIRONMENT}


@app.get("/sw.js")
def service_worker():
    return FileResponse(
        "static/sw.js",
        media_type="application/javascript",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


@app.get("/manifest.json")
def manifest():
    return FileResponse("static/manifest.json", media_type="application/manifest+json")


@app.get("/offline", response_class=HTMLResponse)
def offline_page(request: Request):
    return templates.TemplateResponse("offline.html", {"request": request})


@app.get("/", response_class=HTMLResponse)
def root(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        return RedirectResponse("/login")
    return RedirectResponse("/app")


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/app", response_class=HTMLResponse)
def app_page(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        return RedirectResponse("/login")
    return templates.TemplateResponse("app.html", {"request": request})

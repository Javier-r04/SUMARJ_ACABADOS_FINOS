"""Servicio de correo (no usado actualmente, mantenido como placeholder)."""
from sqlalchemy.orm import Session


class EmailService:
    """Placeholder: no se envia correo desde el sistema."""

    def __init__(self, db: Session):
        self.db = db

    @property
    def esta_configurado(self) -> bool:
        return False

import datetime

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Nullable so Google-only accounts don't need a password, and vice versa.
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)

    # Personalization fields (spec 3.4) — the beta engine re-runs per user morphology.
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    ape_index_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    dominant_hand: Mapped[str | None] = mapped_column(String(20), nullable=True)
    current_grade: Mapped[str | None] = mapped_column(String(20), nullable=True)
    injuries_notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.UTC)
    )

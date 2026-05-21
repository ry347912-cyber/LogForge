"""
LogForge Database Configuration
Async SQLAlchemy setup with SQLite (easily swappable to PostgreSQL).
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    """Initialize database tables on startup."""
    # Import models to register them with Base
    from app.models import log_entry, alert, user, incident  # noqa
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database initialized")

    # Seed default admin user
    await seed_default_data()


async def seed_default_data():
    """Create default admin user if not exists."""
    from app.models.user import User
    from app.core.security import get_password_hash
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        result = await session.execute(select(User).where(User.username == "admin"))
        if not result.scalar_one_or_none():
            admin = User(
                username="admin",
                email="admin@logforge.local",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                is_active=True,
            )
            session.add(admin)

            # Add a regular user
            user = User(
                username="analyst",
                email="analyst@logforge.local",
                hashed_password=get_password_hash("analyst123"),
                role="analyst",
                is_active=True,
            )
            session.add(user)
            await session.commit()
            logger.info("✅ Default users created (admin/admin123, analyst/analyst123)")


async def get_db():
    """Dependency injection for database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

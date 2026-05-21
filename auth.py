"""LogForge Authentication API"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.core.security import (
    verify_password, create_access_token, get_current_user, get_password_hash
)
from app.models.user import User

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class CreateUserRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "analyst"


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return JWT token."""
    result = await db.execute(select(User).where(User.username == request.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    # Update last login
    await db.execute(
        update(User).where(User.id == user.id).values(last_login=datetime.utcnow())
    )
    await db.commit()

    token = create_access_token(data={"sub": user.username, "role": user.role})
    return LoginResponse(access_token=token, user=user.to_dict())


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return current_user.to_dict()


@router.post("/users")
async def create_user(
    request: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new user (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    existing = await db.execute(select(User).where(User.username == request.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")

    user = User(
        username=request.username,
        email=request.email,
        hashed_password=get_password_hash(request.password),
        role=request.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user.to_dict()


@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all users (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [u.to_dict() for u in users]

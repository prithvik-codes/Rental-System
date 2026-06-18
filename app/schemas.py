from pydantic import BaseModel, Field, EmailStr
from datetime import date
from typing import Optional

# --- User Schemas ---

class UserAuth(BaseModel):
    """Schema that is used for user input during signup."""
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    role: Optional[str] = Field(default="tenant", description="Role: landlord or tenant")


class UserLogin(BaseModel):
    """Schema that is used for user input during login."""
    email: EmailStr
    password: str


class UserOut(BaseModel):
    """Schema that defines what is sent back to the client."""
    id: str
    username: str
    email: EmailStr
    role: str

    class Config:
        from_attributes = True


class TokenSchema(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# --- Property Schemas ---

class PropertyBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    description: Optional[str] = None
    address: str = Field(..., min_length=5, max_length=255)
    price_per_month: float = Field(..., gt=0)


class PropertyCreate(PropertyBase):
    pass


class PropertyUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=100)
    description: Optional[str] = None
    address: Optional[str] = Field(None, min_length=5, max_length=255)
    price_per_month: Optional[float] = Field(None, gt=0)
    is_available: Optional[bool] = None


class PropertyOut(PropertyBase):
    id: int
    is_available: bool
    owner_id: str

    class Config:
        from_attributes = True


# --- Lease Schemas ---

class LeaseCreate(BaseModel):
    property_id: int
    start_date: date
    end_date: date
    rent_amount: float = Field(..., gt=0)


class LeaseOut(BaseModel):
    id: int
    property_id: int
    tenant_id: str
    start_date: date
    end_date: date
    rent_amount: float
    status: str

    class Config:
        from_attributes = True
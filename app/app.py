from fastapi import FastAPI, status, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from uuid import uuid4
from typing import List, Optional

from app.database import Base, engine, get_db
from app.models import User, Property, Lease
from app.schemas import (
    UserAuth, UserOut, TokenSchema,
    PropertyCreate, PropertyUpdate, PropertyOut,
    LeaseCreate, LeaseOut
)
from app.utils import (
    get_hashed_password,
    create_access_token,
    create_refresh_token,
    verify_password
)
from app.dependencies import get_current_user, check_landlord, check_tenant
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# Initialize tables in PostgreSQL
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Rental Management System")

# Enable CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post('/signup', summary="Create new user", response_model=UserOut)
async def create_user(data: UserAuth, db: Session = Depends(get_db)):
    # Check if user already exists by email
    user = db.query(User).filter(User.email == data.email).first()
    if user is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )

    # Check if user already exists by username
    user_by_username = db.query(User).filter(User.username == data.username).first()
    if user_by_username is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this username already exists"
        )

    # Validate role value
    role = data.role.lower() if data.role else "tenant"
    if role not in ["landlord", "tenant"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be either 'landlord' or 'tenant'"
        )

    new_user = User(
        id=str(uuid4()),
        username=data.username,
        email=data.email,
        password=get_hashed_password(data.password),
        role=role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post('/login', summary="Create access and refresh tokens for user", response_model=TokenSchema)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Authenticate by email or username
    user = db.query(User).filter(
        (User.email == form_data.username) | (User.username == form_data.username)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found!"
        )

    if not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email/username or password"
        )

    return {
        "access_token": create_access_token(user.email),
        "refresh_token": create_refresh_token(user.email),
        "token_type": "bearer"
    }


@app.get("/users", response_model=List[UserOut])
async def get_users(db: Session = Depends(get_db)):
    return db.query(User).all()


@app.get("/users/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# --- Property Management (CRUD) ---

@app.post('/properties', summary="Create a new property", response_model=PropertyOut)
async def create_property(
    property_data: PropertyCreate,
    current_user: User = Depends(check_landlord),
    db: Session = Depends(get_db)
):
    new_property = Property(
        title=property_data.title,
        description=property_data.description,
        address=property_data.address,
        price_per_month=property_data.price_per_month,
        image_url=property_data.image_url,
        is_available=True,
        owner_id=current_user.id
    )
    db.add(new_property)
    db.commit()
    db.refresh(new_property)
    return new_property


@app.get('/properties', summary="Get list of properties", response_model=List[PropertyOut])
async def get_properties(
    is_available: Optional[bool] = None,
    owner_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Property)
    if is_available is not None:
        query = query.filter(Property.is_available == is_available)
    if owner_id is not None:
        query = query.filter(Property.owner_id == owner_id)
    return query.all()


@app.get('/properties/{property_id}', summary="Get single property details", response_model=PropertyOut)
async def get_property(property_id: int, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    return prop


@app.put('/properties/{property_id}', summary="Update property details", response_model=PropertyOut)
async def update_property(
    property_id: int,
    property_data: PropertyUpdate,
    current_user: User = Depends(check_landlord),
    db: Session = Depends(get_db)
):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    if prop.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this property"
        )

    # Update fields
    if property_data.title is not None:
        prop.title = property_data.title
    if property_data.description is not None:
        prop.description = property_data.description
    if property_data.address is not None:
        prop.address = property_data.address
    if property_data.price_per_month is not None:
        prop.price_per_month = property_data.price_per_month
    if property_data.image_url is not None:
        prop.image_url = property_data.image_url
    if property_data.is_available is not None:
        prop.is_available = property_data.is_available

    db.commit()
    db.refresh(prop)
    return prop


@app.delete('/properties/{property_id}', summary="Delete property")
async def delete_property(
    property_id: int,
    current_user: User = Depends(check_landlord),
    db: Session = Depends(get_db)
):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )
    if prop.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this property"
        )

    db.delete(prop)
    db.commit()
    return {"detail": "Property deleted successfully"}


# --- Lease/Rental Management ---

@app.post('/leases', summary="Lease/rent a property", response_model=LeaseOut)
async def create_lease(
    lease_data: LeaseCreate,
    current_user: User = Depends(check_tenant),
    db: Session = Depends(get_db)
):
    # Check if property exists
    prop = db.query(Property).filter(Property.id == lease_data.property_id).first()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found"
        )

    # Check if property is available
    if not prop.is_available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Property is not available for lease"
        )

    # Create lease
    new_lease = Lease(
        property_id=lease_data.property_id,
        tenant_id=current_user.id,
        start_date=lease_data.start_date,
        end_date=lease_data.end_date,
        rent_amount=lease_data.rent_amount,
        status="active"
    )

    # Mark property as unavailable
    prop.is_available = False

    db.add(new_lease)
    db.commit()
    db.refresh(new_lease)
    return new_lease


@app.get('/leases', summary="Get list of leases", response_model=List[LeaseOut])
async def get_leases(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "landlord":
        # Landlords see leases for properties they own
        leases = db.query(Lease).join(Property).filter(Property.owner_id == current_user.id).all()
    else:
        # Tenants see leases they signed
        leases = db.query(Lease).filter(Lease.tenant_id == current_user.id).all()
    return leases


@app.get('/leases/{lease_id}', summary="Get single lease details", response_model=LeaseOut)
async def get_lease(
    lease_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    lease = db.query(Lease).filter(Lease.id == lease_id).first()
    if not lease:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lease not found"
        )

    # Check authorization: current user must be the tenant or the property owner
    prop = db.query(Property).filter(Property.id == lease.property_id).first()
    if lease.tenant_id != current_user.id and (not prop or prop.owner_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this lease"
        )
    return lease


@app.post('/leases/{lease_id}/terminate', summary="Terminate a lease")
async def terminate_lease(
    lease_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    lease = db.query(Lease).filter(Lease.id == lease_id).first()
    if not lease:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lease not found"
        )

    # Check authorization: landlord or tenant
    prop = db.query(Property).filter(Property.id == lease.property_id).first()
    if lease.tenant_id != current_user.id and (not prop or prop.owner_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    if lease.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lease is already {lease.status}"
        )

    lease.status = "terminated"
    if prop:
        prop.is_available = True

    db.commit()
    return {"detail": "Lease terminated successfully, property is now available"}


# Serve static files
current_dir = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(current_dir, "..", "static")

# Create static directory if it doesn't exist
os.makedirs(static_dir, exist_ok=True)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def read_index():
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Rental Management System API is running. Frontend static/index.html not found."}

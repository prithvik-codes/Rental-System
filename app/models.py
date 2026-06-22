from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, Date
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    username = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, default="tenant")  # "landlord" or "tenant"

    properties = relationship("Property", back_populates="owner", cascade="all, delete-orphan")
    leases = relationship("Lease", back_populates="tenant", cascade="all, delete-orphan")


class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    address = Column(String, nullable=False)
    price_per_month = Column(Float, nullable=False)
    image_url = Column(String, nullable=True)
    is_available = Column(Boolean, default=True, nullable=False)
    owner_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    owner = relationship("User", back_populates="properties")
    leases = relationship("Lease", back_populates="property", cascade="all, delete-orphan")


class Lease(Base):
    __tablename__ = "leases"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    property_id = Column(Integer, ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    rent_amount = Column(Float, nullable=False)
    status = Column(String, default="active")  # "active", "terminated", "completed"

    property = relationship("Property", back_populates="leases")
    tenant = relationship("User", back_populates="leases")

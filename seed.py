import sys
import os
from datetime import datetime, timedelta
from uuid import uuid4

# Add the project root to sys.path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, Base, engine
from app.models import User, Property, Lease
from app.utils import get_hashed_password

def seed_database():
    print("Initializing database tables...")
    # Re-create tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("Seeding mock users...")
        
        # 1. Landlord User
        landlord_id = str(uuid4())
        landlord = User(
            id=landlord_id,
            username="landlord",
            email="landlord@rentflow.in",
            password=get_hashed_password("password123"),
            role="landlord"
        )
        
        # 2. Tenant User
        tenant_id = str(uuid4())
        tenant = User(
            id=tenant_id,
            username="tenant",
            email="tenant@rentflow.in",
            password=get_hashed_password("password123"),
            role="tenant"
        )
        
        db.add(landlord)
        db.add(tenant)
        db.commit()
        
        print("Seeding mock properties...")
        
        # 3. Properties
        prop1 = Property(
            title="Cozy Studio near Kalyani Nagar",
            description="Charming modern studio apartment situated near Kalyani Nagar IT hubs. Excellent for single professionals or couples working in Yerawada or Viman Nagar. Highlights include a private balcony view, modular kitchen, and full Wi-Fi support.",
            address="Plot 12, Lane 7, Kalyani Nagar, Pune, Maharashtra 411006",
            price_per_month=22000.00,
            image_url="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
            is_available=True,
            owner_id=landlord_id
        )
        
        prop2 = Property(
            title="Luxury 3 BHK Penthouse in Koregaon Park",
            description="Exquisite semi-furnished penthouse located in the greenest residential lane of Koregaon Park. Featuring a sprawling private terrace deck, wooden flooring, dedicated security systems, and close proximity to premium cafes.",
            address="Aditya Heights, Lane A, Koregaon Park, Pune, Maharashtra 411001",
            price_per_month=75000.00,
            image_url="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80",
            is_available=True,
            owner_id=landlord_id
        )
        
        prop3 = Property(
            title="Charming Row House in Kothrud",
            description="Quiet, independent row house nestled in a prime residential pocket of Kothrud. Fully ventilated spaces with a small front garden, dedicated garage parking, and nearby access to local markets and parks.",
            address="Ideal Colony, Phase 2, Kothrud, Pune, Maharashtra 411038",
            price_per_month=32000.00,
            image_url="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
            is_available=True,
            owner_id=landlord_id
        )
        
        prop4 = Property(
            title="Spacious Gated Villa in Baner",
            description="Beautiful modern villa located near the Baner-Balewadi high street. High-end gated community offering 4 large bedrooms, gym access, private lawn space, and close distance to Hinjewadi Phase 1.",
            address="Pristine Meadows, Baner Road, Baner, Pune, Maharashtra 411045",
            price_per_month=48000.00,
            image_url="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80",
            is_available=False, # Leased by the active lease
            owner_id=landlord_id
        )
        
        db.add(prop1)
        db.add(prop2)
        db.add(prop3)
        db.add(prop4)
        db.commit()
        db.refresh(prop4)
        
        print("Seeding active lease...")
        
        # 4. Lease
        today = datetime.now().date()
        one_year_later = today + timedelta(days=365)
        
        lease = Lease(
            property_id=prop4.id,
            tenant_id=tenant_id,
            start_date=today,
            end_date=one_year_later,
            rent_amount=48000.00,
            status="active"
        )
        
        db.add(lease)
        db.commit()
        
        print("\nDatabase seeded successfully!")
        print("---------------------------------------------")
        print("Landlord Account:")
        print("  Email:    landlord@rentflow.in")
        print("  Password: password123")
        print("---------------------------------------------")
        print("Tenant Account:")
        print("  Email:    tenant@rentflow.in")
        print("  Password: password123")
        print("---------------------------------------------")
        
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

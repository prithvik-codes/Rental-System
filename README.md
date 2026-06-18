# Rental Management System API

A professional and robust backend REST API built using **FastAPI**, **SQLAlchemy ORM**, and **JWT Authentication** (Access & Refresh tokens). This system manages landlords, tenants, properties, and lease agreements.

---

## 🚀 Key Features

*   **Role-Based Access Control (RBAC):** Supports `landlord` and `tenant` roles with distinct permissions.
*   **Secure JWT Authentication:**
    *   Access and Refresh token flow.
    *   Password hashing using `bcrypt` via `passlib`.
*   **Property Management (CRUD):** 
    *   Landlords can create, read, update, and delete properties.
    *   Tenants and guests can view available listings.
*   **Lease/Rental Agreements:**
    *   Tenants can sign lease agreements for available properties.
    *   Dynamic property availability updates (marking property as rented/available on lease events).
    *   Lease termination flow with custom authentication checks.
*   **Database Agnostic:** Configured via SQLAlchemy; works seamlessly with PostgreSQL, SQLite, MySQL, etc.

---

## 📂 Project Structure

```text
├── app/
│   ├── __init__.py
│   ├── app.py             # FastAPI application, routers, and endpoints
│   ├── database.py        # SQLAlchemy configuration and database sessions
│   ├── dependencies.py    # Authentication and role-checking dependencies
│   ├── models.py          # SQLAlchemy models (User, Property, Lease)
│   ├── schemas.py         # Pydantic validation schemas
│   └── utils.py           # JWT helper utilities and password hashing
├── .env                   # Environment variables (Database URL, JWT keys)
├── requirements.txt       # Project dependencies
└── README.md              # Project documentation
```

---

## 🛠️ Setup & Installation

### 1. Clone & Prepare Virtual Environment
Navigate to the project root and create a virtual environment:
```powershell
# Create virtual environment
python -m venv fastapienv

# Activate virtual environment (Windows)
fastapienv\Scripts\activate

# Activate virtual environment (macOS/Linux)
source fastapienv/bin/activate
```

### 2. Install Dependencies
Install all required libraries using pip:
```bash
pip install -r requirements.txt
```

### 3. Environment Variables Configuration
Create a `.env` file in the root directory and add the following parameters:
```env
# Database connection string
DATABASE_URL=sqlite:///./rental_system.db

# JWT Configuration
JWT_SECRET_KEY=your_super_secret_access_token_key_here
JWT_REFRESH_SECRET_KEY=your_super_secret_refresh_token_key_here
```
> **Note:** For production, replace SQLite with PostgreSQL (e.g., `postgresql://user:password@localhost:5432/dbname`) and generate strong secrets.

---

## 🚦 Running the Application

Start the local Uvicorn development server:
```bash
uvicorn app.app:app --reload
```
Once started, the API documentation is available at:
*   Interactive OpenAPI documentation (Swagger UI): [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
*   Alternative ReDoc documentation: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 🛰️ API Endpoints Summary

### Authentication & Users
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/signup` | Create a new user account (role: `landlord` or `tenant`) | No |
| `POST` | `/login` | Authenticate credentials and return Access & Refresh tokens | No (OAuth2 Form) |
| `GET` | `/users` | Get a list of all registered users | No |
| `GET` | `/users/me` | Fetch detailed profile of the currently logged-in user | Yes (Any User) |

### Property Management
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/properties` | Create a new rental property | Yes (Landlord Only) |
| `GET` | `/properties` | Fetch properties (supports filtering by `is_available` and `owner_id`) | No |
| `GET` | `/properties/{id}`| Fetch specific property details | No |
| `PUT` | `/properties/{id}`| Update specific property parameters | Yes (Owner Landlord) |
| `DELETE`| `/properties/{id}`| Remove property from system | Yes (Owner Landlord) |

### Lease & Rent Management
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/leases` | Request and sign a lease agreement on an available property | Yes (Tenant Only) |
| `GET` | `/leases` | List all leases (Landlords see owned property leases; Tenants see signed leases) | Yes (Any User) |
| `GET` | `/leases/{id}`| View specific lease details | Yes (Involved Tenant/Landlord) |
| `POST` | `/leases/{id}/terminate` | Terminate an active lease and make the property available again | Yes (Involved Tenant/Landlord) |

---

## 🔒 Security Implementation Details

1.  **Passwords:** Hashed using `bcrypt` algorithm and verified securely upon login.
2.  **Access Tokens:** Expire in **30 minutes** by default, encoded using HMAC-SHA256 (`HS256`).
3.  **Refresh Tokens:** Expire in **7 days** by default, allowing seamless renewal of credentials without prompting credentials again.

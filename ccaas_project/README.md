# CCaaS (Contact Center as a Service) Platform

Welcome to the CCaaS Platform, a comprehensive, production-ready solution for managing customer interactions, agents, tickets, and campaigns.

## Features

- **Omnichannel Interactions**: Manage calls, chats, and emails in one place.
- **Agent Management**: Complete RBAC (Role-Based Access Control) for Admins and Agents.
- **Customer CRM**: Built-in contact management.
- **Helpdesk Ticketing**: Track customer issues with priority and SLA management.
- **Outbound Campaigns**: Manage marketing and sales campaigns with ROI tracking.
- **Softphone Dialer**: Integrated web-based dialer simulation for agents.
- **Analytics Dashboard**: Real-time statistics and KPI tracking.

## Technology Stack

- **Backend**: Python, FastAPI, SQLAlchemy (SQLite/PostgreSQL)
- **Security**: JWT Authentication, bcrypt password hashing
- **Frontend**: Vanilla JavaScript, HTML5, CSS3 (No external frameworks required)

## Setup Instructions

### 1. Prerequisites
Ensure you have Python 3.9+ installed on your system.

### 2. Create a Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```
Update the `.env` file with your specific configurations if necessary.

### 5. Run the Application
Start the FastAPI server using Uvicorn:
```bash
uvicorn ccaas_project.main:app --reload
```

### 6. Access the Platform
- **Landing Page & Login**: `http://localhost:8000/`
- **Agent Dashboard**: `http://localhost:8000/dashboard`
- **API Documentation (Swagger UI)**: `http://localhost:8000/docs`
- **Alternative API Docs (ReDoc)**: `http://localhost:8000/redoc`

## API Endpoints Overview

- `/api/auth/*` - Login and Registration
- `/api/users/*` - Agent and Admin management
- `/api/contacts/*` - Customer CRM operations
- `/api/interactions/*` - Call/Chat logging and retrieval
- `/api/tickets/*` - Helpdesk operations
- `/api/campaigns/*` - Campaign management

## Development Notes

The frontend is completely decoupled from the backend logic, communicating exclusively via RESTful API calls with JWT Bearer tokens. The `app.js` file handles all dynamic DOM updates, routing, and state management for the dashboard.

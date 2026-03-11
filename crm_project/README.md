# Enterprise CRM System

A complete, production-ready Customer Relationship Management system.

## Features
- JWT Authentication & Role-based Access Control
- Customer Management (CRUD)
- Lead Tracking & Pipeline
- Interactive Dashboard with Statistics
- Responsive Modern UI

## Setup Instructions
1. Create a virtual environment: `python -m venv venv`
2. Activate the environment:
   - Windows: `venv\Scripts\activate`
   - Linux/Mac: `source venv/bin/activate`
3. Install dependencies: `pip install -r requirements.txt`
4. Copy `.env.example` to `.env` and configure your variables.
5. Run the application: `uvicorn main:app --reload`
6. Access the application at `http://localhost:8000`

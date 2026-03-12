# CCaaS Platform MVP

A modern Contact Center as a Service platform featuring real-time WebSocket communication, JWT authentication, and agent state management.

## Setup Instructions

1. Create a virtual environment:
   `python -m venv venv`
   `source venv/bin/activate` (Linux/Mac) or `venv\Scripts\activate` (Windows)

2. Install dependencies:
   `pip install -r requirements.txt`

3. Set up environment variables:
   Copy `.env.example` to `.env`

4. Run the application:
   `uvicorn main:app --reload`

5. Access the platform:
   Open `http://localhost:8000` in your browser.
   
*Note: On first run, the database will be automatically created. You can register a new agent account directly from the login page.*
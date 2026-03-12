# Modern E-Commerce Platform

A complete, production-ready e-commerce platform built with FastAPI and Vanilla JS.

## Features
- **JWT Authentication**: Secure Login and Registration.
- **Role-Based Access**: The *first* user to register automatically becomes an Admin.
- **Admin Dashboard**: Admins can add new products to the store.
- **User Dashboard**: Users can view their order history.
- **Order Processing**: Real-time stock deduction and validation.
- **Responsive UI**: Modern, clean interface built with CSS Grid and Flexbox.

## How to Run

1. Install the required Python dependencies:
```bash
pip install -r requirements.txt
```

2. Start the FastAPI server:
```bash
uvicorn main:app --reload
```

3. Open your browser and navigate to:
`http://localhost:8000`

## Usage Guide
1. Click **Login** and register a new account. Since you are the first user, you will be granted Admin rights.
2. Navigate to the **Dashboard** and use the Admin Panel to add a few products (provide an image URL, price, and stock).
3. Go back to the **Home** page to see your products and test the "Buy Now" functionality.
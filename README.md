# TechDigits Store

A full-stack e-commerce web app with an Express + MongoDB backend and a lightweight HTML/CSS/JavaScript frontend. Supports authentication, product catalog, categories, cart, orders, reviews, and payments with OTP verification (Visa and Vodafone Cash). API is documented in `swagger.yaml` and a Postman collection is included.

## Overview

- Frontend: Static HTML, CSS, and vanilla JavaScript (`frontend/`)
- Backend: Node.js (Express) with MongoDB via Mongoose (`backend/`)
- Payments: Mocked Visa and Vodafone Cash flows with OTP verification
- Auth: JWT-based
- Docs: OpenAPI 3.0 spec in `swagger.yaml` and Postman collection in `Postman-File/`

---

## Tech Stack

- Languages: HTML, CSS, JavaScript
- Frontend:
  - Static pages in `frontend/`
  - Client logic in `frontend/js/main.js`
- Backend:
  - Node.js (>= 18), Express (`backend/`)
  - MongoDB via Mongoose
  - JWT auth with `jsonwebtoken`
  - CORS, morgan logging
  - Email via `nodemailer`
  - SMS/OTP utilities via `twilio`
- APIs / Docs:
  - OpenAPI 3.0 spec in `swagger.yaml`
  - Postman collection: `Postman-File/TechDigitsStore.postman_collection.json`

---

## Project Structure

```
.
├─ backend/
│  ├─ src/
│  │  ├─ server.js
│  │  ├─ routes/        # API routes
│  │  ├─ controllers/   # Route handlers
│  │  ├─ models/        # Mongoose schemas
│  │  ├─ middleware/    # Auth, error handling, etc.
│  │  └─ config/, utils/
│  └─ package.json
├─ frontend/
│  ├─ js/main.js
│  ├─ payment.html
│  ├─ *.html, styles.css, images/
├─ swagger.yaml
├─ Postman-File/TechDigitsStore.postman_collection.json
└─ package.json
```

---

## Setup and Local Run

- **Prerequisites**
  - Node.js >= 18
  - MongoDB instance (local or hosted)

- **Environment Variables**
  - Create `backend/.env` with values like:
    ```
    PORT=5000
    MONGO_URI=mongodb://localhost:27017/techdigits
    JWT_SECRET=your_jwt_secret

    SMTP_HOST=smtp.example.com
    SMTP_PORT=587
    SMTP_USER=your_smtp_user
    SMTP_PASS=your_smtp_pass
    SMTP_FROM="TechDigits Store <no-reply@techdigits.example>"

    TWILIO_ACCOUNT_SID=your_twilio_sid
    TWILIO_AUTH_TOKEN=your_twilio_token
    TWILIO_FROM=+10000000000
    ```
    - Note: Payment OTP is mocked in logic, but email/SMS providers can be wired via these variables.

- **Install Dependencies**
  - Backend:
    ```bash
    npm install --prefix backend
    ```
  - Root (optional Twilio helper in root `package.json`):
    ```bash
    npm install
    ```

- **Run Backend**
  - Development:
    ```bash
    npm run dev --prefix backend
    ```
  - Production:
    ```bash
    npm start --prefix backend
    ```
  - Default API base: `http://localhost:5000/api`

- **Run Frontend**
  - Option A: Open `frontend/index.html` directly in the browser.
    - The frontend detects the API base. When opened via file:// it falls back to `http://localhost:5000/api`.
  - Option B: Serve `frontend/` with any static server (recommended for CORS/session behavior).
    ```bash
    npx http-server ./frontend -p 8080
    ```
    - Then visit http://localhost:8080
    - API calls will target `http://localhost:5000/api`

- **API Documentation**
  - Open the OpenAPI spec: `swagger.yaml`
  - Import the Postman collection: `Postman-File/TechDigitsStore.postman_collection.json`

---

## API Endpoints (Summary)

See `swagger.yaml` for the full contract. Base URL: `http://localhost:5000/api`

- **Auth**
  - `POST /api/auth/register` — register
  - `POST /api/auth/login` — login (returns JWT)
  - `GET /api/auth/me` — current user

- **Users**
  - `GET /api/users` — list users (admin)
  - `GET /api/users/{id}` — get user (admin/self)
  - `PUT /api/users/{id}` — update user (admin/self)
  - `PUT /api/users/{id}/role` — change role (admin)
  - `DELETE /api/users/{id}` — delete (admin)

- **Products**
  - `GET /api/products` — list
  - `POST /api/products` — create (admin)
  - `GET /api/products/{id}` — details
  - `PUT /api/products/{id}` — update (admin)
  - `DELETE /api/products/{id}` — delete (admin)

- **Categories**
  - `GET /api/categories` — list
  - `POST /api/categories` — create (admin)
  - `GET /api/categories/{id}` — details
  - `PUT /api/categories/{id}` — update (admin)
  - `DELETE /api/categories/{id}` — delete (admin)

- **Orders**
  - `POST /api/orders` — create order
  - `GET /api/orders` — list my orders
  - `GET /api/orders/{id}` — order detail
  - `PUT /api/orders/{id}/status` — update status (admin)

- **Reviews**
  - `GET /api/reviews` — list (admin)
  - `POST /api/reviews` — create (requires purchased/paid)
  - `GET /api/reviews/{productId}` — list for product
  - `DELETE /api/reviews/{id}` — delete (admin)

- **Payments**
  - `POST /api/payments/create-intent` — mock client secret for Visa flows
  - `POST /api/payments/initiate` — begin payment (Visa/Vodafone, may generate OTP)
  - `POST /api/payments/send-otp` — send or resend OTP
  - `POST /api/payments/verify-otp` — verify OTP, confirm payment

### Request/Response Examples

- **Login**
  ```http
  POST /api/auth/login
  Content-Type: application/json

  {
    "email": "user@example.com",
    "password": "secret123"
  }
  ```
  ```json
  {
    "success": true,
    "message": "ok",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
  }
  ```

- **Initiate Payment (Visa)**
  ```http
  POST /api/payments/initiate
  Authorization: Bearer <JWT>
  Content-Type: application/json

  {
    "orderId": "66f8a7...c12",
    "method": "visa"
  }
  ```
  ```json
  {
    "success": true,
    "message": "Visa can proceed",
    "data": {
      "orderId": "66f8a7...c12",
      "method": "visa"
    }
  }
  ```

- **Send OTP (Visa)**
  ```http
  POST /api/payments/send-otp
  Authorization: Bearer <JWT>
  Content-Type: application/json

  {
    "orderId": "66f8a7...c12",
    "method": "visa"
  }
  ```
  ```json
  { "success": true, "message": "OTP sent" }
  ```

- **Verify OTP (Visa)**
  ```http
  POST /api/payments/verify-otp
  Authorization: Bearer <JWT>
  Content-Type: application/json

  {
    "orderId": "66f8a7...c12",
    "method": "visa",
    "otp": "123456",
    "cardNumber": "4111111111111111",
    "expiryMonth": 12,
    "expiryYear": 27,
    "cvv": "123"
  }
  ```
  ```json
  { "success": true, "message": "Payment confirmed" }
  ```

- **Initiate Payment (Vodafone Cash)**
  ```http
  POST /api/payments/initiate
  Authorization: Bearer <JWT>
  Content-Type: application/json

  {
    "orderId": "66f8a7...c12",
    "method": "vodafone",
    "phone": "01000000000"
  }
  ```
  ```json
  { "success": true, "message": "OTP sent to Vodafone number" }
  ```

- See `swagger.yaml` for full schemas (`User`, `Product`, `Order`, `Review`, `Payment`) and all status codes.

---

## Using the Payment Page

- **Location**: `frontend/payment.html`
- **Visa flow**:
  - Fields: Card Number, Expiry Month (MM), Expiry Year (YY), CVV.
  - Live validation:
    - Card Number: exactly 16 digits.
    - Expiry Month: 1–12.
    - Expiry Year: exactly 2 digits.
    - CVV: exactly 3 digits.
  - On submit, invalid fields prevent submission and show inline error messages.
  - After initiating visa payment, OTP verification continues on `verify-otp.html?method=visa&orderId=...`.
    - Enter the 6-digit code received (mock/email).
    - You can resend the code from the OTP page.
- **Vodafone Cash flow**:
  - Field: Vodafone number (`01XXXXXXXXX`, 11 digits).
  - OTP is sent to the provided number; verify via the OTP flow.
- Frontend API base resolution:
  - If served from a web server, uses same-origin `/api`.
  - If opened directly from filesystem, falls back to `http://localhost:5000/api`.

---

## Screenshots

- Product list: `frontend/images/banner1.jpg` (placeholder)
- Payment form: [./docs/screenshots/payment-form.png](./docs/screenshots/payment-form.png) (placeholder)
- OTP verification: [./docs/screenshots/otp.png](./docs/screenshots/otp.png) (placeholder)

---

## Contribution Guidelines

- Branching: feature branches off `main`
- Commits: concise messages, reference issues where applicable
- PRs: include description, screenshots (if UI), and testing steps
- Code Style:
  - Frontend: keep vanilla JS modular and minimal
  - Backend: follow existing Express route/controller structure
- Tests: add minimal repro steps or unit tests when fixing bugs

---

## License

- **MIT** (see `backend/package.json`)

---

## Troubleshooting

- **CORS/Network**: If loading `frontend/` via file://, ensure backend runs on port 5000; the app will call `http://localhost:5000/api`.
- **JWT**: Ensure `JWT_SECRET` is set and tokens are included as `Authorization: Bearer <token>`.
- **MongoDB**: Verify `MONGO_URI` is reachable.
- **Emails/SMS**: To test OTP via real providers, configure `SMTP_*` and `TWILIO_*` values.

---

## Links

- OpenAPI spec: `swagger.yaml`
- Postman collection: `Postman-File/TechDigitsStore.postman_collection.json`

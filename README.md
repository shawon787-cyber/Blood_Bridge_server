# 🩸 BloodBridge — Backend API

> **A secure RESTful backend powering a modern blood donation management platform.**

The BloodBridge backend is a RESTful API built to support a complete blood donation ecosystem, including user authentication, donor discovery, donation request management, role-based authorization, funding, and administrative operations.

The API is designed around a **separate frontend/backend architecture**, making the application easier to maintain, scale, and deploy independently.

---

## 🌐 Project Links

💻 **Frontend Repository:** `https://github.com/shawon787-cyber/bloodbridge`

💻 **Backend Repository:** `https://github.com/shawon787-cyber/Blood_Bridge_server`

🌍 **Live Website:** `https://bloodbridge-dzj1.vercel.app/`

---

# 🎯 Backend Objectives

The backend provides the core services required to operate BloodBridge:

* 🔐 Secure user authentication
* 🪪 JWT-based authorization
* 👥 Role-based access control
* 🩸 Blood donation request management
* 🔎 Donor search
* 👤 User/profile management
* 🛡️ Administrative controls
* 🤝 Volunteer permissions
* 💳 Funding management
* 📊 Dashboard statistics
* 🖼️ Profile image handling
* 📄 Pagination and filtering
* 🚫 Blocked-user protection

---

# 🏗️ Architecture

BloodBridge follows a decoupled architecture:

```text
┌─────────────────────────────┐
│       Next.js Frontend      │
│                             │
│  UI • Dashboard • Forms     │
└──────────────┬──────────────┘
               │
               │ REST API
               ▼
┌─────────────────────────────┐
│       Express.js API        │
│                             │
│ Authentication              │
│ Authorization               │
│ Business Logic              │
│ Validation                  │
│ Request Management          │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│          MongoDB            │
│                             │
│ Users                       │
│ Donation Requests           │
│ Funding                     │
└─────────────────────────────┘
```

---

# 🛠️ Technology Stack

| Technology    | Purpose                    |
| ------------- | -------------------------- |
| 🟢 Node.js    | JavaScript runtime         |
| 🚂 Express.js | REST API framework         |
| 🍃 MongoDB    | Database                   |
| 🔑 JWT        | Authentication             |
| 🔐 bcrypt     | Password hashing           |
| 📦 dotenv     | Environment configuration  |
| 🖼️ Multer    | File handling              |
| 💳 Stripe     | Payment processing         |
| 🌐 CORS       | Cross-origin communication |

---

# 🔐 Authentication

BloodBridge uses **JWT-based authentication**.

After successful login, the server generates a signed JWT containing essential user information.

Example payload:

```json
{
  "id": "user_id",
  "email": "user@example.com",
  "role": "donor"
}
```

The token is then used to access protected API endpoints.

### Authentication Flow

```text
User
 │
 ▼
Login
 │
 ▼
Express API
 │
 ├── Validate credentials
 │
 ├── Verify password
 │
 └── Generate JWT
        │
        ▼
      Client
        │
        ▼
 Protected API Request
        │
        ▼
 JWT Verification
        │
        ▼
    Authorized API
```

---

# 🛡️ Role-Based Access Control

The API separates permissions according to user roles.

### Roles

```text
Admin
Donor
Volunteer
```

### Permission model

| Feature                |  Donor  | Volunteer | Admin |
| ---------------------- | :-----: | :-------: | :---: |
| View donation requests |    ✅    |     ✅     |   ✅   |
| Create request         |    ✅    |     —     |   ✅   |
| Manage own requests    |    ✅    |     —     |   ✅   |
| Manage all requests    |    —    |    👁️    |   ✅   |
| Update donation status | Limited |     ✅     |   ✅   |
| Manage users           |    ❌    |     ❌     |   ✅   |
| Block users            |    ❌    |     ❌     |   ✅   |
| Make Volunteer         |    ❌    |     ❌     |   ✅   |
| Make Admin             |    ❌    |     ❌     |   ✅   |
| View funding           |    ✅    |     ✅     |   ✅   |

Volunteer permissions are intentionally limited to donation-request monitoring and status management.

---

# 🚫 Active & Blocked Users

Every registered user receives:

```text
status: active
```

Administrators can block users.

A blocked account becomes:

```text
status: blocked
```

Blocked users are prevented from performing restricted actions such as creating new donation requests.

---

# 🩸 Donation Request API

The donation request system is the core feature of the backend.

A request contains:

```text
Requester
Recipient
Location
Hospital
Address
Blood Group
Donation Date
Donation Time
Request Message
Donation Status
Donor Information
```

### Donation status lifecycle

```text
pending
   │
   ▼
inprogress
   │
   ├──────────► done
   │
   └──────────► canceled
```

New requests always start with:

```text
pending
```

The status is controlled by the donation workflow rather than being freely entered by the requester.

---

# 🔎 Donor Search

The backend provides donor discovery based on:

* Blood group
* District
* Upazila

Example:

```http
GET /api/donors?bloodGroup=A%2B&district=Dhaka&upazila=Dhanmondi
```

The API returns donors matching the requested criteria.

---

# 👥 User Management

Administrators can manage registered users.

Supported operations include:

### Block user

```http
PATCH /api/admin/users/:id/block
```

### Unblock user

```http
PATCH /api/admin/users/:id/unblock
```

### Change role

```http
PATCH /api/admin/users/:id/role
```

Roles can be changed between:

```text
donor
volunteer
admin
```

---

# 👤 Profile API

Authenticated users can retrieve and update their profile information.

Profile data includes:

* Name
* Email
* Avatar
* Blood group
* District
* Upazila

The user's email remains protected from profile editing.

---

# 🖼️ Profile Image Upload

BloodBridge supports profile avatar uploads.

The backend handles:

* Multipart form data
* Image validation
* File size restrictions
* Memory-based processing
* Image upload integration

Supported image types include:

```text
PNG
JPEG
WEBP
```

Maximum file size:

```text
5 MB
```

---

# 📊 Dashboard Statistics

The API provides aggregated statistics for dashboard visualization.

Examples include:

```text
Total Users
Total Donation Requests
Total Funding
Donation Request Status
Donation Activity
```

These statistics allow the frontend dashboard to display real-time platform information instead of hard-coded values.

---

# 💳 Funding API

BloodBridge supports organizational funding through Stripe.

Funding workflow:

```text
User
 │
 ▼
Give Fund
 │
 ▼
Stripe Checkout
 │
 ▼
Payment Confirmation
 │
 ▼
Funding Record
 │
 ▼
MongoDB
```

Funding records contain information such as:

* User name
* User ID
* Amount
* Funding date
* Payment information

---

# 📄 Pagination

Where appropriate, API endpoints support pagination.

Typical parameters:

```text
page
limit
```

Example:

```http
GET /api/donation-requests?page=1&limit=10
```

This prevents large datasets from unnecessarily loading into the client at once.

---

# 🔍 Filtering

Donation requests can be filtered according to status:

```text
pending
inprogress
done
canceled
```

Example:

```http
GET /api/donation-requests?status=pending
```

User management also supports status-based filtering:

```text
active
blocked
```

---

# 🔒 Protected API Architecture

Protected endpoints use middleware-based authorization.

Conceptually:

```text
Request
  │
  ▼
JWT Verification
  │
  ├── Invalid → 401
  │
  ▼
User Authentication
  │
  ▼
Role Verification
  │
  ├── Unauthorized → 403
  │
  ▼
Controller / Route
  │
  ▼
Database
```

This keeps authentication and authorization logic separate from individual route handlers.

---

# 🧱 API Middleware

The backend uses middleware to control access to sensitive resources.

Important authorization layers include:

```text
verifyToken
verifyAdmin
verifyVolunteer
verifyAdminOrVolunteer
verifyActiveUser
```

This allows each endpoint to enforce the minimum permission required for the operation.

---

# 📡 API Endpoints

## Authentication

```http
POST /api/auth/register
POST /api/auth/login
```

---

## Users

```http
GET    /api/donors
GET    /api/user/:id
PATCH  /api/user/:id
```

---

## Profile Image

```http
POST /api/users/:id/profile-image
```

---

## Donation Requests

```http
GET    /api/donation-requests
GET    /api/donation-requests/:id
POST   /api/donation-requests
PATCH  /api/donation-requests/:id
DELETE /api/donation-requests/:id
```

---

## Donation History

```http
GET /api/donation-history
```

---

## Donation Statistics

```http
GET /api/donation-count/:userId
GET /api/donation-requests/stats
```

---

## Admin

```http
GET   /api/admin/users
PATCH /api/admin/users/:id
```

Administrative routes require appropriate JWT authorization and admin privileges.

---

## Funding

```http
POST /api/funding
GET  /api/funding
```

---

# 🗃️ Database Structure

The backend uses MongoDB as its primary database.

Core collections include:

```text
blood_bridge
│
├── user
│
├── donation_requests
│
└── funding
```

---

## 👤 User Document

Conceptual structure:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "avatar": "image_url",
  "bloodGroup": "O+",
  "district": "Dhaka",
  "upazila": "Dhanmondi",
  "role": "donor",
  "status": "active"
}
```

---

## 🩸 Donation Request Document

Conceptual structure:

```json
{
  "requesterName": "John Doe",
  "requesterEmail": "john@example.com",
  "recipientName": "Jane Doe",
  "recipientDistrict": "Dhaka",
  "recipientUpazila": "Dhanmondi",
  "hospitalName": "Dhaka Medical College Hospital",
  "fullAddress": "Dhaka",
  "bloodGroup": "O+",
  "donationDate": "2026-01-20",
  "donationTime": "10:00",
  "requestMessage": "Urgently need blood",
  "status": "pending"
}
```

---

# 🔐 Environment Variables

Sensitive configuration is never hard-coded into the repository.

Create a:

```text
.env
```

file:

```env
PORT=5000

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret

IMAGEBB_API_KEY=your_imagebb_api_key

STRIPE_SECRET_KEY=your_stripe_secret_key
```

> Never commit `.env` to GitHub.

Add it to:

```text
.gitignore
```

---

# 🚀 Getting Started

## 1. Clone Repository

```bash
git clone YOUR_BACKEND_GITHUB_URL
```

## 2. Navigate to Backend

```bash
cd bloodbridge-server
```

## 3. Install Dependencies

```bash
npm install
```

## 4. Configure Environment Variables

Create:

```text
.env
```

and configure the required credentials.

## 5. Start Development Server

```bash
npm run dev
```

Or:

```bash
npm start
```

The API will run locally at:

```text
http://localhost:5000
```

---

# 🏭 Production Deployment

The backend is designed to run independently from the frontend.

Before deployment, configure:

```text
PORT
MONGODB_URI
JWT_SECRET
IMAGEBB_API_KEY
STRIPE_SECRET_KEY
```

Production deployment should also ensure:

* Correct CORS configuration
* HTTPS
* Secure environment variables
* Production MongoDB access
* Valid frontend origin
* Proper API base URL
* Error handling
* Stable database connection

---

# 🧪 API Reliability

The backend is designed with production deployment requirements in mind.

Important considerations include:

* Centralized authentication
* Role-based authorization
* Protected private APIs
* Request validation
* Database error handling
* CORS configuration
* Environment-based configuration
* Pagination
* Filtering
* Controlled status transitions
* Blocked-user restrictions

---

# 📁 Backend Structure

A simplified project structure:

```text
bloodbridge-server/
│
├── server.js
├── db.js
├── package.json
├── .env
├── .gitignore
│
├── middleware/
│   ├── verifyToken.js
│   ├── verifyAdmin.js
│   ├── verifyVolunteer.js
│   ├── verifyAdminOrVolunteer.js
│   └── verifyActiveUser.js
│
├── routes/
│   ├── auth.js
│   ├── users.js
│   ├── donors.js
│   ├── donationRequests.js
│   ├── funding.js
│   └── ...
│
└── utils/
    └── ...
```

> The exact structure may evolve as the API grows.

---

# 🔄 Request Lifecycle

A typical protected API request follows this flow:

```text
Frontend
   │
   ▼
HTTP Request
   │
   ▼
JWT Middleware
   │
   ▼
Token Validation
   │
   ▼
User Identity
   │
   ▼
Role / Status Check
   │
   ▼
Business Logic
   │
   ▼
MongoDB
   │
   ▼
JSON Response
   │
   ▼
Frontend
```

---

# 🧠 Engineering Highlights

This backend demonstrates practical implementation of:

* RESTful API design
* JWT authentication
* Role-based authorization
* Middleware architecture
* MongoDB integration
* CRUD operations
* Pagination
* Filtering
* Aggregation
* File upload handling
* Payment integration
* Protected resources
* User lifecycle management
* Donation workflow management
* Production deployment configuration
* Environment-based secrets

---

# 🗺️ Bangladesh Location Data

BloodBridge uses Bangladesh district and upazila data to support:

* User registration
* Donor search
* Donation requests

The location structure enables dependent:

```text
District → Upazila
```

selection on the frontend.

---

# 🔮 Future Backend Improvements

Potential future improvements include:

* ⚡ Real-time donation notifications
* 🔔 Push notification service
* 📍 Geo-based donor discovery
* 💬 Donor/requester messaging
* 📊 Advanced analytics APIs
* 🗺️ Location-aware donor matching
* 🤖 AI-powered blood information API
* 🧾 Automated donation reports
* 🧪 Automated API testing
* 📦 API versioning

---

# 👨‍💻 Developer

**Md Shaon**

Software Developer & Brand Designer

Focused on building modern web applications with clean architecture, practical UX, and scalable backend systems.

### Connect

💼 LinkedIn: `https://linkedin.com/in/md-shaon-developer`

🌐 Portfolio: `https://tech-agent-shawon-portfolio.netlify.app/`

---

# ⭐ BloodBridge

BloodBridge was built to explore how technology can simplify blood donation coordination and connect people when timely action matters.

```text
Find a donor.
Make a request.
Coordinate the donation.
Make an impact. 🩸
```

**Built with Node.js • Express.js • MongoDB • JWT**

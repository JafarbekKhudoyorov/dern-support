# Dern Backend

The Dern Backend is a Node.js/Express API powering user authentication for the Dern Support platform. It provides secure user registration, login, and email-based account activation, integrating with MongoDB for data storage and an SMTP service for sending emails.

> [!NOTE]
> Supported API endpoints are available at [Auto Generated Swagger Docs](https://dern-backend-plc9.onrender.com/api-docs/)

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Setup](#setup)
- [Running Locally](#running-locally)
- [API Overview](#api-overview)
- [Deployment on Render](#deployment-on-render)
- [Contributing](#contributing)
- [License](#license)

## Features
- User registration with customizable account types
- Email-based account activation with secure token links
- Secure login with JWT authentication
- Password hashing for enhanced security
- Option to resend activation emails
- Cross-origin support for frontend integration

## Tech Stack
- **Node.js**: JavaScript runtime
- **Express**: Web framework
- **MongoDB**: NoSQL database
- **Nodemailer**: Email sending
- **JWT**: Token-based authentication
- **Bcrypt**: Password hashing
- **Joi**: Input validation

## Setup
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/dern-backend.git
   cd dern-backend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   - Create a `.env` file in the root directory.
   - Add required variables for frontend URL, backend URL, SMTP settings, JWT secrets, and MongoDB connection (refer to project documentation for details).

4. **Set Up MongoDB**:
   - Use a local MongoDB instance or a cloud service like MongoDB Atlas.
   - Ensure the database is running and accessible.

## Running Locally
1. **Start MongoDB** (if local):
   ```bash
   mongod
   ```

2. **Start the Backend**:
   ```bash
   npm start
   ```
   - Runs on `http://localhost:5000` by default.

3. **Connect with Frontend**:
   - Ensure the frontend is configured to communicate with the backend’s API (e.g., `http://localhost:5000/api/v1`).

## API Overview
- **POST `/api/v1/auth/register`**: Register a new user and send an activation email.
- **GET `/api/v1/auth/activate/:token`**: Activate a user account via email link.
- **POST `/api/v1/auth/login`**: Authenticate a user and issue a JWT.
- **POST `/api/v1/auth/resend-activation`**: Resend activation email for unactivated accounts.

## Deployment on Render
1. **Push to GitHub**:
   - Commit and push your code to a GitHub repository.

2. **Create a Web Service**:
   - Log in to [Render.com](https://render.com).
   - Select “New” > “Web Service” and connect your repository.

3. **Configure Settings**:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js` (or your main file)
   - **Environment Variables**: Set frontend URL, backend URL, SMTP credentials, JWT secrets, and MongoDB URI in Render’s dashboard.

4. **Deploy**:
   - Create the service and note the provided URL (e.g., `https://your-backend.onrender.com`).
   - Update the frontend’s API base URL to point to the backend.

5. **Custom Domain** (optional):
   - Add a custom domain in Render’s “Settings” > “Custom Domains”.
   - Configure DNS with a `CNAME` record pointing to the Render URL.

## Contributing
- Fork the repository.
- Create a feature branch (`git checkout -b feature/your-feature`).
- Commit changes (`git commit -m "Add your feature"`).
- Push to the branch (`git push origin feature/your-feature`).
- Open a Pull Request.

## License
MIT License. See [LICENSE](LICENSE) for details.
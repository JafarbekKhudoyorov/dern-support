import dotenv from "dotenv"
import express from "express"
import cookieParser from "cookie-parser"
import cors from "cors"
import mongoose from "mongoose"
import http from "http"
import path from "path"
import { fileURLToPath } from "url"

import routes from "./routes/index.js"
import swaggerUi from "swagger-ui-express"
import swaggerJSDoc from "swagger-jsdoc"
import { initializeWebSocket } from "./utils/websocket.js"

import fs from "fs"
const swaggerDocument = JSON.parse(fs.readFileSync(new URL("./swagger-output.json", import.meta.url)))

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

// Swagger Configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Dern Support API Documentation",
      version: "1.0.0",
      description: "Comprehensive API documentation for the Dern Support platform",
    },
  },
  apis: ["./routes/*.js"],
}

const swaggerSpec = swaggerJSDoc(swaggerOptions)

// Log environment variables for debugging
console.log("GMAIL_USER:", process.env.GMAIL_USER)
console.log("GMAIL_PASS:", process.env.GMAIL_PASS ? "Set" : "Not set")

// Validate environment variables
const requiredEnvVars = ["MONGO_URI", "JWT_SECRET", "JWT_REFRESH_SECRET", "GMAIL_USER", "GMAIL_PASS"]
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: ${envVar} environment variable is not set.`)
    process.exit(1)
  }
}

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err)
    process.exit(1)
  })

const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 5000

// Initialize WebSocket
initializeWebSocket(server)

// Middleware
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))
app.use(express.static("public"))

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")))

app.use(cookieParser())
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
)

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

// Routes
app.use("/api/v1", routes)

// Serve Swagger documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument))

// Default route
app.get("/", (req, res) => {
  res.send("Dern-Support backend server is running")
})

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "Dern Support Backend",
    version: "1.0.0",
    uptime: process.uptime(),
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  })
})

server.listen(PORT, () => {
  console.log(`🚀 Server is running on: http://localhost:${PORT}`)
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`)
  console.log(`🔌 WebSocket server initialized`)
})

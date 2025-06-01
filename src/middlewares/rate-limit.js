import rateLimit from "express-rate-limit"

// General rate limiter
export const generalLimiter = rateLimit({
  windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests from this IP, please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
      timestamp: new Date().toISOString(),
    })
  },
})

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login requests per windowMs
  message: {
    error: "Too many login attempts from this IP, please try again after 15 minutes.",
    code: "AUTH_RATE_LIMIT_EXCEEDED",
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many login attempts from this IP, please try again after 15 minutes.",
      code: "AUTH_RATE_LIMIT_EXCEEDED",
      timestamp: new Date().toISOString(),
    })
  },
})

// Password reset rate limiter
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset requests per hour
  message: {
    error: "Too many password reset attempts from this IP, please try again after 1 hour.",
    code: "PASSWORD_RESET_RATE_LIMIT_EXCEEDED",
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many password reset attempts from this IP, please try again after 1 hour.",
      code: "PASSWORD_RESET_RATE_LIMIT_EXCEEDED",
      timestamp: new Date().toISOString(),
    })
  },
})

// Account creation rate limiter
export const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 account creation requests per hour
  message: {
    error: "Too many account creation attempts from this IP, please try again after 1 hour.",
    code: "ACCOUNT_CREATION_RATE_LIMIT_EXCEEDED",
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many account creation attempts from this IP, please try again after 1 hour.",
      code: "ACCOUNT_CREATION_RATE_LIMIT_EXCEEDED",
      timestamp: new Date().toISOString(),
    })
  },
})

// File upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 upload requests per windowMs
  message: {
    error: "Too many upload attempts from this IP, please try again later.",
    code: "UPLOAD_RATE_LIMIT_EXCEEDED",
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many upload attempts from this IP, please try again later.",
      code: "UPLOAD_RATE_LIMIT_EXCEEDED",
      timestamp: new Date().toISOString(),
    })
  },
})

// API rate limiter for general API endpoints
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 API requests per windowMs
  message: {
    error: "Too many API requests from this IP, please try again later.",
    code: "API_RATE_LIMIT_EXCEEDED",
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many API requests from this IP, please try again later.",
      code: "API_RATE_LIMIT_EXCEEDED",
      timestamp: new Date().toISOString(),
    })
  },
})

// Support request creation rate limiter
export const supportRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 support requests per hour
  message: {
    error: "Too many support requests from this IP, please try again after 1 hour.",
    code: "SUPPORT_REQUEST_RATE_LIMIT_EXCEEDED",
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many support requests from this IP, please try again after 1 hour.",
      code: "SUPPORT_REQUEST_RATE_LIMIT_EXCEEDED",
      timestamp: new Date().toISOString(),
    })
  },
})

// Message sending rate limiter
export const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 messages per minute
  message: {
    error: "Too many messages from this IP, please slow down.",
    code: "MESSAGE_RATE_LIMIT_EXCEEDED",
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many messages from this IP, please slow down.",
      code: "MESSAGE_RATE_LIMIT_EXCEEDED",
      timestamp: new Date().toISOString(),
    })
  },
})

// Knowledge base creation rate limiter (for technicians/admins)
export const knowledgeBaseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 knowledge base operations per hour
  message: {
    error: "Too many knowledge base operations from this IP, please try again later.",
    code: "KNOWLEDGE_BASE_RATE_LIMIT_EXCEEDED",
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many knowledge base operations from this IP, please try again later.",
      code: "KNOWLEDGE_BASE_RATE_LIMIT_EXCEEDED",
      timestamp: new Date().toISOString(),
    })
  },
})

// Export all limiters
export default {
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
  createAccountLimiter,
  uploadLimiter,
  apiLimiter,
  supportRequestLimiter,
  messageLimiter,
  knowledgeBaseLimiter,
}

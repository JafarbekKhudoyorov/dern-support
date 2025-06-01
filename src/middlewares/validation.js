import mongoose from "mongoose"
import Joi from "joi"

export const validateRequest = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], { abortEarly: false })

    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
        })),
      })
    }

    req[property] = value
    next()
  }
}

// Common validation schemas
export const schemas = {
  objectId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .message("Invalid ID format"),

  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),

  dateRange: Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().greater(Joi.ref("startDate")),
  }),

  search: Joi.object({
    query: Joi.string().min(1).max(100).required(),
  }),
}


// Custom Joi extensions
const customJoi = Joi.extend({
  type: "objectId",
  base: Joi.string(),
  messages: {
    "objectId.invalid": "{{#label}} must be a valid ObjectId",
  },
  validate(value, helpers) {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return { value, errors: helpers.error("objectId.invalid") }
    }
    return { value }
  },
})

// Common validation schemas
export const objectIdSchema = customJoi.objectId().required()

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().valid("createdAt", "-createdAt", "updatedAt", "-updatedAt", "name", "-name").default("-createdAt"),
})

export const searchSchema = Joi.object({
  q: Joi.string().min(1).max(100),
  category: Joi.string(),
  status: Joi.string(),
  priority: Joi.string(),
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso().min(Joi.ref("dateFrom")),
})

// Email validation
export const emailSchema = Joi.string().email().required()

// Password validation with strength requirements
export const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .required()
  .messages({
    "string.pattern.base":
      "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character",
  })

// Phone number validation
export const phoneSchema = Joi.string()
  .pattern(/^[+]?[1-9][\d]{0,15}$/)
  .required()
  .messages({
    "string.pattern.base": "Phone number must be a valid international format",
  })

// URL validation
export const urlSchema = Joi.string().uri().required()

// File validation schemas
export const imageFileSchema = Joi.object({
  fieldname: Joi.string().required(),
  originalname: Joi.string().required(),
  encoding: Joi.string().required(),
  mimetype: Joi.string().valid("image/jpeg", "image/png", "image/gif", "image/webp").required(),
  size: Joi.number()
    .max(5 * 1024 * 1024)
    .required(), // 5MB max
  destination: Joi.string(),
  filename: Joi.string(),
  path: Joi.string(),
})

// Validation middleware factory
export const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    })

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        value: detail.context?.value,
      }))

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
        timestamp: new Date().toISOString(),
      })
    }

    // Replace the original property with the validated and sanitized value
    req[property] = value
    next()
  }
}

// Validate query parameters
export const validateQuery = (schema) => validate(schema, "query")

// Validate URL parameters
export const validateParams = (schema) => validate(schema, "params")

// Validate request body
export const validateBody = (schema) => validate(schema, "body")

// Common parameter validations
export const validateObjectIdParam = validateParams(
  Joi.object({
    id: objectIdSchema,
  }),
)

export const validatePagination = validateQuery(paginationSchema)

export const validateSearch = validateQuery(searchSchema)

// Sanitization helpers
export const sanitizeHtml = (text) => {
  if (typeof text !== "string") return text
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
}

export const sanitizeInput = (obj) => {
  if (typeof obj !== "object" || obj === null) return obj

  const sanitized = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeHtml(value.trim())
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeInput(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

// Input sanitization middleware
export const sanitizeInputs = (req, next) => {
  if (req.body) {
    req.body = sanitizeInput(req.body)
  }
  if (req.query) {
    req.query = sanitizeInput(req.query)
  }
  if (req.params) {
    req.params = sanitizeInput(req.params)
  }
  next()
}

// File upload validation middleware
export const validateFileUpload = (allowedTypes = ["image/jpeg", "image/png"], maxSize = 5 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
        timestamp: new Date().toISOString(),
      })
    }

    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
        timestamp: new Date().toISOString(),
      })
    }

    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`,
        timestamp: new Date().toISOString(),
      })
    }

    next()
  }
}

export default {
  validate,
  validateQuery,
  validateParams,
  validateBody,
  validateObjectIdParam,
  validatePagination,
  validateSearch,
  sanitizeInputs,
  validateFileUpload,
  objectIdSchema,
  paginationSchema,
  searchSchema,
  emailSchema,
  passwordSchema,
  phoneSchema,
  urlSchema,
  imageFileSchema,
}

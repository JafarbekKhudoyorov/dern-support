// Standardized API response utilities

export const successResponse = (res, data = null, message = "Success", statusCode = 200) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString(),
  }

  if (data !== null) {
    response.data = data
  }

  return res.status(statusCode).json(response)
}

export const errorResponse = (res, message = "Internal Server Error", statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  }

  if (errors) {
    response.errors = errors
  }

  if (process.env.NODE_ENV === "development" && statusCode === 500) {
    response.stack = new Error().stack
  }

  return res.status(statusCode).json(response)
}

export const sendResponse = successResponse

export const validationErrorResponse = (res, errors) => {
  return errorResponse(res, "Validation failed", 400, errors)
}

export const unauthorizedResponse = (res, message = "Unauthorized") => {
  return errorResponse(res, message, 401)
}

export const forbiddenResponse = (res, message = "Forbidden") => {
  return errorResponse(res, message, 403)
}

export const notFoundResponse = (res, message = "Resource not found") => {
  return errorResponse(res, message, 404)
}

export const conflictResponse = (res, message = "Resource already exists") => {
  return errorResponse(res, message, 409)
}

export const paginatedResponse = (res, data, pagination, message = "Success") => {
  return successResponse(
    res,
    {
      items: data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages: Math.ceil(pagination.total / pagination.limit),
        hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrev: pagination.page > 1,
      },
    },
    message,
  )
}

// Async handler wrapper to catch errors
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// Response time middleware
export const responseTime = () => {
  return (req, res, next) => {
    const start = Date.now()

    res.on("finish", () => {
      const duration = Date.now() - start
      res.set("X-Response-Time", `${duration}ms`)
    })

    next()
  }
}

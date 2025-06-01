export const authorize = (roles = [], options = {}) => {
  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTHENTICATION_REQUIRED",
      })
    }

    // If no roles specified, just check authentication
    if (roles.length === 0) {
      return next()
    }

    // Check if user has required role
    const userRole = req.user.role
    const hasRequiredRole = roles.includes(userRole)

    if (!hasRequiredRole) {
      // Check for special cases
      if (options.allowSelf && req.user.userId === req.params.userId) {
        return next() // User can access their own resources
      }

      if (options.allowBusinessOwner && req.user.accountType === "business") {
        // Additional business owner checks can be added here
        return next()
      }

      return res.status(403).json({
        message: `Access denied. Required role(s): ${roles.join(", ")}. Your role: ${userRole}`,
        code: "INSUFFICIENT_PERMISSIONS",
        requiredRoles: roles,
        userRole: userRole,
      })
    }

    next()
  }
}

// Specific role checkers
export const requireAdmin = authorize(["admin"])
export const requireTechnician = authorize(["admin", "technician"])
export const requireCustomer = authorize(["admin", "technician", "customer"])

// Account type checkers
export const requireBusiness = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
      code: "AUTHENTICATION_REQUIRED",
    })
  }

  if (req.user.accountType !== "business" && req.user.role !== "admin") {
    return res.status(403).json({
      message: "Business account required",
      code: "BUSINESS_ACCOUNT_REQUIRED",
    })
  }

  next()
}

export const requireIndividual = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
      code: "AUTHENTICATION_REQUIRED",
    })
  }

  if (req.user.accountType !== "individual" && req.user.role !== "admin") {
    return res.status(403).json({
      message: "Individual account required",
      code: "INDIVIDUAL_ACCOUNT_REQUIRED",
    })
  }

  next()
}

// Resource ownership checker
export const requireOwnership = (resourceField = "userId") => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTHENTICATION_REQUIRED",
      })
    }

    // Admin can access all resources
    if (req.user.role === "admin") {
      return next()
    }

    // Check if user owns the resource
    const resourceUserId = req.params[resourceField] || req.body[resourceField]
    if (req.user.userId !== resourceUserId) {
      return res.status(403).json({
        message: "Access denied. You can only access your own resources.",
        code: "RESOURCE_ACCESS_DENIED",
      })
    }

    next()
  }
}

import express from "express"
import Joi from "joi"
import Appointment from "../models/appointment.js"
import User from "../models/user.js"
import { authenticate } from "../middlewares/authenticate.js"
import { authorize } from "../middlewares/authorize.js"
import { validateRequest } from "../middlewares/validation.js"
import { asyncHandler } from "../utils/response.js"
import { logger } from "../utils/logger.js"

const router = express.Router()

// Validation schemas
const createAppointmentSchema = Joi.object({
  technicianId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid technician ID format",
    }),
  startTime: Joi.date().iso().min("now").required(),
  endTime: Joi.date().iso().greater(Joi.ref("startTime")).required(),
  notes: Joi.string().max(1000).optional().allow(""),
  serviceType: Joi.string()
    .valid("consultation", "repair", "installation", "maintenance", "troubleshooting", "emergency")
    .required(),
  priority: Joi.string().valid("low", "medium", "high", "urgent").default("medium"),
  estimatedDuration: Joi.number().min(15).max(480).optional(),
  location: Joi.object({
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().required(),
    coordinates: Joi.object({
      lat: Joi.number().min(-90).max(90),
      lng: Joi.number().min(-180).max(180),
    }).optional(),
  }).optional(),
})

const updateAppointmentSchema = Joi.object({
  startTime: Joi.date().iso().optional(),
  endTime: Joi.date().iso().optional(),
  notes: Joi.string().max(1000).optional().allow(""),
  serviceType: Joi.string()
    .valid("consultation", "repair", "installation", "maintenance", "troubleshooting", "emergency")
    .optional(),
  priority: Joi.string().valid("low", "medium", "high", "urgent").optional(),
  status: Joi.string().valid("scheduled", "in-progress", "completed", "canceled", "no-show").optional(),
  estimatedDuration: Joi.number().min(15).max(480).optional(),
  actualDuration: Joi.number().min(0).optional(),
  cost: Joi.number().min(0).optional(),
  location: Joi.object({
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().required(),
    coordinates: Joi.object({
      lat: Joi.number().min(-90).max(90),
      lng: Joi.number().min(-180).max(180),
    }).optional(),
  }).optional(),
  cancellationReason: Joi.string().max(500).optional(),
  completionNotes: Joi.string().max(1000).optional(),
  rating: Joi.number().min(1).max(5).optional(),
  feedback: Joi.string().max(500).optional(),
})
  .custom((value, helpers) => {
    // If endTime is provided, ensure it's after startTime
    if (value.startTime && value.endTime && value.endTime <= value.startTime) {
      return helpers.error("custom.endTimeAfterStart")
    }
    return value
  })
  .messages({
    "custom.endTimeAfterStart": "End time must be after start time",
  })

// Cancellation schema
const cancelAppointmentSchema = Joi.object({
  cancellationReason: Joi.string().max(500).optional().allow(""),
})

// Helper function to check technician availability - IMPROVED
const checkTechnicianAvailability = async (technicianId, startTime, endTime, excludeAppointmentId = null) => {
  const technician = await User.findOne({
    _id: technicianId,
    role: "technician",
    isActive: true,
  })

  if (!technician) {
    throw new Error("Technician not found or inactive")
  }

  if (technician.availability !== "available") {
    throw new Error("Technician is not available")
  }

  console.log("Checking availability for:", {
    technicianId,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    excludeAppointmentId,
  })

  // Check for conflicting appointments - more comprehensive logic
  const conflictQuery = {
    technician: technicianId,
    status: { $nin: ["canceled", "completed"] },
    $or: [
      {
        // Case 1: New appointment starts during existing appointment
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
      },
    ],
  }

  if (excludeAppointmentId) {
    conflictQuery._id = { $ne: excludeAppointmentId }
  }

  const conflicts = await Appointment.find(conflictQuery)

  console.log(
    "Found potential conflicts:",
    conflicts.map((c) => ({
      id: c._id,
      start: c.startTime.toISOString(),
      end: c.endTime.toISOString(),
      status: c.status,
    })),
  )

  if (conflicts.length > 0) {
    const conflict = conflicts[0]
    throw new Error(
      `Technician has a conflicting appointment from ${conflict.startTime.toISOString()} to ${conflict.endTime.toISOString()}. Please choose a different time slot.`,
    )
  }

  return technician
}

// Create appointment
router.post(
  "/",
  authenticate,
  authorize(["customer", "admin"]),
  validateRequest(createAppointmentSchema),
  asyncHandler(async (req, res) => {
    const { technicianId, startTime, endTime, notes, serviceType, priority, estimatedDuration, location } = req.body

    console.log("Creating appointment:", {
      technicianId,
      startTime,
      endTime,
      serviceType,
      userId: req.user.userId,
    })

    // Verify technician availability
    await checkTechnicianAvailability(technicianId, new Date(startTime), new Date(endTime))

    // Calculate estimated duration if not provided
    let duration = estimatedDuration
    if (!duration) {
      const timeDiff = new Date(endTime) - new Date(startTime)
      duration = Math.round(timeDiff / (1000 * 60)) // Convert to minutes
    }

    const appointment = new Appointment({
      client: req.user.userId,
      technician: technicianId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      notes,
      serviceType,
      priority: priority || "medium",
      estimatedDuration: duration,
      location,
    })

    await appointment.save()
    await appointment.populate([
      { path: "client", select: "username email phone" },
      { path: "technician", select: "username email phone specialization" },
    ])

    logger.info(`Appointment created`, {
      appointmentId: appointment._id,
      clientId: req.user.userId,
      technicianId,
      startTime,
      serviceType,
    })

    res.status(201).json({
      success: true,
      message: "Appointment created successfully",
      data: { appointment },
    })
  }),
)

// List appointments with advanced filtering
router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page) || 1)
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit) || 10))
    const skip = (page - 1) * limit

    // Build filter based on user role
    const filter = {}

    if (req.user.role === "customer") {
      filter.client = req.user.userId
    } else if (req.user.role === "technician") {
      filter.technician = req.user.userId
    } else if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      })
    }

    // Apply additional filters
    if (req.query.status) {
      filter.status = req.query.status
    }

    if (req.query.serviceType) {
      filter.serviceType = req.query.serviceType
    }

    if (req.query.priority) {
      filter.priority = req.query.priority
    }

    // Date range filtering
    if (req.query.startDate || req.query.endDate) {
      filter.startTime = {}
      if (req.query.startDate) {
        filter.startTime.$gte = new Date(req.query.startDate)
      }
      if (req.query.endDate) {
        filter.startTime.$lte = new Date(req.query.endDate)
      }
    }

    // Search by technician or client name (admin only)
    if (req.query.search && req.user.role === "admin") {
      const searchRegex = new RegExp(req.query.search, "i")
      const users = await User.find({
        $or: [{ username: searchRegex }, { email: searchRegex }],
      }).select("_id")

      const userIds = users.map((user) => user._id)
      filter.$or = [{ client: { $in: userIds } }, { technician: { $in: userIds } }]
    }

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .populate("client", "username email phone")
        .populate("technician", "username email phone specialization")
        .sort({ startTime: req.query.sort === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Appointment.countDocuments(filter),
    ])

    res.json({
      success: true,
      data: {
        appointments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    })
  }),
)

// Get single appointment
router.get(
  "/:appointmentId",
  authenticate,
  asyncHandler(async (req, res) => {
    const appointment = await Appointment.findById(req.params.appointmentId)
      .populate("client", "username email phone")
      .populate("technician", "username email phone specialization")

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      })
    }

    // Check permissions
    const hasAccess =
      req.user.role === "admin" ||
      appointment.client._id.toString() === req.user.userId ||
      appointment.technician._id.toString() === req.user.userId

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      })
    }

    res.json({
      success: true,
      data: { appointment },
    })
  }),
)

// Update appointment
router.put(
  "/:appointmentId",
  authenticate,
  validateRequest(updateAppointmentSchema),
  asyncHandler(async (req, res) => {
    const appointment = await Appointment.findById(req.params.appointmentId)

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      })
    }

    // Check permissions
    const hasAccess =
      req.user.role === "admin" ||
      appointment.client.toString() === req.user.userId ||
      appointment.technician.toString() === req.user.userId

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      })
    }

    // Prevent updates to completed or canceled appointments (except by admin)
    if (req.user.role !== "admin" && ["completed", "canceled"].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify completed or canceled appointments",
      })
    }

    // If updating time fields, verify availability
    if (req.body.startTime || req.body.endTime) {
      const newStartTime = req.body.startTime ? new Date(req.body.startTime) : appointment.startTime
      const newEndTime = req.body.endTime ? new Date(req.body.endTime) : appointment.endTime

      // Ensure new times are in the future (unless admin)
      if (req.user.role !== "admin" && newStartTime < new Date()) {
        return res.status(400).json({
          success: false,
          message: "Start time must be in the future",
        })
      }

      await checkTechnicianAvailability(appointment.technician, newStartTime, newEndTime, appointment._id)
    }

    // Update fields
    const allowedUpdates = [
      "startTime",
      "endTime",
      "notes",
      "serviceType",
      "priority",
      "status",
      "estimatedDuration",
      "actualDuration",
      "cost",
      "location",
      "cancellationReason",
      "completionNotes",
      "rating",
      "feedback",
    ]

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        appointment[field] = req.body[field]
      }
    })

    // Auto-set actual duration when marking as completed
    if (req.body.status === "completed" && !req.body.actualDuration) {
      const duration = Math.round((appointment.endTime - appointment.startTime) / (1000 * 60))
      appointment.actualDuration = duration
    }

    await appointment.save()
    await appointment.populate([
      { path: "client", select: "username email phone" },
      { path: "technician", select: "username email phone specialization" },
    ])

    logger.info(`Appointment updated`, {
      appointmentId: appointment._id,
      updatedBy: req.user.userId,
      changes: Object.keys(req.body),
    })

    res.json({
      success: true,
      message: "Appointment updated successfully",
      data: { appointment },
    })
  }),
)

// Cancel appointment - FIXED
router.patch(
  "/:appointmentId/cancel",
  authenticate,
  validateRequest(cancelAppointmentSchema),
  asyncHandler(async (req, res) => {
    const appointment = await Appointment.findById(req.params.appointmentId)

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      })
    }

    // Check permissions
    const hasAccess =
      req.user.role === "admin" ||
      appointment.client.toString() === req.user.userId ||
      appointment.technician.toString() === req.user.userId

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      })
    }

    // Check if already canceled
    if (appointment.status === "canceled") {
      return res.status(400).json({
        success: false,
        message: "Appointment is already canceled",
      })
    }

    // Check cancellation policy (24 hours notice, except for admin)
    if (req.user.role !== "admin") {
      const now = new Date()
      const twentyFourHoursBefore = new Date(appointment.startTime.getTime() - 24 * 60 * 60 * 1000)

      if (now > twentyFourHoursBefore) {
        return res.status(400).json({
          success: false,
          message: "Appointments can only be canceled at least 24 hours in advance",
        })
      }
    }

    // Update only the status and cancellation reason - no validation issues
    await Appointment.findByIdAndUpdate(
      req.params.appointmentId,
      {
        status: "canceled",
        cancellationReason: req.body.cancellationReason || "No reason provided",
        canceledAt: new Date(),
        canceledBy: req.user.userId,
      },
      { new: true, runValidators: false }, // Skip validation to avoid required field issues
    )

    const updatedAppointment = await Appointment.findById(req.params.appointmentId).populate([
      { path: "client", select: "username email phone" },
      { path: "technician", select: "username email phone specialization" },
    ])

    logger.info(`Appointment canceled`, {
      appointmentId: appointment._id,
      canceledBy: req.user.userId,
      reason: req.body.cancellationReason || "No reason provided",
    })

    res.json({
      success: true,
      message: "Appointment canceled successfully",
      data: { appointment: updatedAppointment },
    })
  }),
)

// Keep the old DELETE route for backward compatibility
router.delete(
  "/:appointmentId",
  authenticate,
  asyncHandler(async (req, res) => {
    const appointment = await Appointment.findById(req.params.appointmentId)

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      })
    }

    // Check permissions
    const hasAccess =
      req.user.role === "admin" ||
      appointment.client.toString() === req.user.userId ||
      appointment.technician.toString() === req.user.userId

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      })
    }

    // Check if already canceled
    if (appointment.status === "canceled") {
      return res.status(400).json({
        success: false,
        message: "Appointment is already canceled",
      })
    }

    // Check cancellation policy (24 hours notice, except for admin)
    if (req.user.role !== "admin") {
      const now = new Date()
      const twentyFourHoursBefore = new Date(appointment.startTime.getTime() - 24 * 60 * 60 * 1000)

      if (now > twentyFourHoursBefore) {
        return res.status(400).json({
          success: false,
          message: "Appointments can only be canceled at least 24 hours in advance",
        })
      }
    }

    // Update only the status - no validation issues
    await Appointment.findByIdAndUpdate(
      req.params.appointmentId,
      {
        status: "canceled",
        cancellationReason: "Canceled by user",
        canceledAt: new Date(),
        canceledBy: req.user.userId,
      },
      { new: true, runValidators: false }, // Skip validation to avoid required field issues
    )

    const updatedAppointment = await Appointment.findById(req.params.appointmentId).populate([
      { path: "client", select: "username email phone" },
      { path: "technician", select: "username email phone specialization" },
    ])

    logger.info(`Appointment canceled`, {
      appointmentId: appointment._id,
      canceledBy: req.user.userId,
      reason: "Canceled by user",
    })

    res.json({
      success: true,
      message: "Appointment canceled successfully",
      data: { appointment: updatedAppointment },
    })
  }),
)

// Get technician availability
router.get(
  "/technicians/:technicianId/availability",
  authenticate,
  asyncHandler(async (req, res) => {
    const { technicianId } = req.params
    const { date } = req.query

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date parameter is required",
      })
    }

    const technician = await User.findOne({
      _id: technicianId,
      role: "technician",
      isActive: true,
    })

    if (!technician) {
      return res.status(404).json({
        success: false,
        message: "Technician not found",
      })
    }

    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const appointments = await Appointment.find({
      technician: technicianId,
      status: { $nin: ["canceled", "completed"] },
      startTime: { $gte: startOfDay, $lte: endOfDay },
    })
      .select("startTime endTime")
      .sort({ startTime: 1 })

    res.json({
      success: true,
      data: {
        technician: {
          id: technician._id,
          name: technician.username,
          availability: technician.availability,
        },
        date,
        bookedSlots: appointments.map((apt) => ({
          startTime: apt.startTime,
          endTime: apt.endTime,
        })),
      },
    })
  }),
)

export default router

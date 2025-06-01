import express from "express"
import Joi from "joi"
import { nanoid } from "nanoid"
import SupportRequest from "../models/support-request.js"
import Message from "../models/message.js"
import User from "../models/user.js"
import { authenticate } from "../middlewares/authenticate.js"
import { requireCustomer, requireTechnician } from "../middlewares/authorize.js"
import { createAuditLog } from "../utils/audit.js"

const router = express.Router()

// Validation schemas
const createRequestSchema = Joi.object({
  title: Joi.string().min(5).max(200).required(),
  description: Joi.string().min(10).max(2000).required(),
  category: Joi.string()
    .valid(
      "technical-support",
      "billing",
      "account-issues",
      "feature-request",
      "bug-report",
      "general-inquiry",
      "legal-consultation",
      "business-consultation",
    )
    .required(),
  priority: Joi.string().valid("low", "medium", "high", "urgent").default("medium"),
  tags: Joi.array().items(Joi.string()).max(5),
})

const updateRequestSchema = Joi.object({
  title: Joi.string().min(5).max(200),
  description: Joi.string().min(10).max(2000),
  category: Joi.string().valid(
    "technical-support",
    "billing",
    "account-issues",
    "feature-request",
    "bug-report",
    "general-inquiry",
    "legal-consultation",
    "business-consultation",
  ),
  priority: Joi.string().valid("low", "medium", "high", "urgent"),
  status: Joi.string().valid("open", "in-progress", "pending-customer", "resolved", "closed"),
  tags: Joi.array().items(Joi.string()).max(5),
})

const assignTechnicianSchema = Joi.object({
  technicianId: Joi.string().required(),
  estimatedResolutionTime: Joi.number().min(1).max(168),
})

const addMessageSchema = Joi.object({
  content: Joi.string().min(1).max(2000).required(),
  messageType: Joi.string().valid("text", "file", "system", "status-update").default("text"),
})

const ratingSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  feedback: Joi.string().max(500),
})

const searchRequestSchema = Joi.object({
  query: Joi.string().min(1).required(),
})

router.post("/", authenticate, requireCustomer, async (req, res) => {
  try {
    const { error, value } = createRequestSchema.validate(req.body, { abortEarly: false })
    if (error) {
      console.error("Validation error details:", error.details)
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
        joi: error.details,
      })
    }

    const requestId = `REQ-${nanoid(8).toUpperCase()}`
    const supportRequest = new SupportRequest({
      ...value,
      requestId,
      customer: req.user.userId,
      isUrgent: value.priority === "urgent",
    })

    await supportRequest.save()
    await supportRequest.populate("customer", "username email accountType companyName")

    console.log(`New support request created: ${requestId} by ${req.user.email}`)

    res.status(201).json({
      message: "Support request created successfully",
      request: supportRequest,
    })
  } catch (err) {
    console.error("Create support request error:", err)
    res.status(500).json({
      message: "Error creating support request",
      error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
    })
  }
})

router.get("/", authenticate, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const filter = {}
    if (req.user.role === "customer") {
      filter.customer = req.user.userId
    } else if (req.user.role === "technician") {
      if (req.query.assigned === "true") {
        filter.assignedTechnician = req.user.userId
      } else if (req.query.unassigned === "true") {
        filter.assignedTechnician = null
      }
    }

    if (req.query.status) {
      filter.status = req.query.status
    }
    if (req.query.category) {
      filter.category = req.query.category
    }
    if (req.query.priority) {
      filter.priority = req.query.priority
    }

    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
        { requestId: { $regex: req.query.search, $options: "i" } },
      ]
    }

    const requests = await SupportRequest.find(filter)
      .populate("customer", "username email accountType companyName")
      .populate("assignedTechnician", "username email specialization")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await SupportRequest.countDocuments(filter)

    res.json({
      requests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("Get support requests error:", err)
    res.status(500).json({ message: "Error fetching support requests" })
  }
})

// Search support requests
router.get("/search", authenticate, async (req, res) => {
  try {
    const { error, value } = searchRequestSchema.validate(req.query)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const filter = {
      $or: [
        { title: { $regex: value.query, $options: "i" } },
        { description: { $regex: value.query, $options: "i" } },
        { requestId: { $regex: value.query, $options: "i" } },
      ],
    }

    if (req.user.role === "customer") {
      filter.customer = req.user.userId
    } else if (req.user.role === "technician") {
      filter.assignedTechnician = req.user.userId
    }

    const requests = await SupportRequest.find(filter)
      .populate("customer", "username email accountType companyName")
      .populate("assignedTechnician", "username email specialization")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await SupportRequest.countDocuments(filter)

    res.json({
      requests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("Search support requests error:", err)
    res.status(500).json({ message: "Error searching support requests" })
  }
})

router.get("/:requestId", authenticate, async (req, res) => {
  try {
    const request = await SupportRequest.findOne({ requestId: req.params.requestId })
      .populate("customer", "username email accountType companyName phone")
      .populate("assignedTechnician", "username email specialization hourlyRate")

    if (!request) {
      return res.status(404).json({ message: "Support request not found" })
    }

    if (req.user.role === "customer" && request.customer._id.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    if (
      req.user.role === "technician" &&
      request.assignedTechnician &&
      request.assignedTechnician._id.toString() !== req.user.userId
    ) {
      return res.status(403).json({ message: "Access denied" })
    }

    res.json({ request })
  } catch (err) {
    console.error("Get support request error:", err)
    res.status(500).json({ message: "Error fetching support request" })
  }
})

router.put("/:requestId", authenticate, async (req, res) => {
  try {
    const { error, value } = updateRequestSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const request = await SupportRequest.findOne({ requestId: req.params.requestId })
    if (!request) {
      return res.status(404).json({ message: "Support request not found" })
    }

    if (req.user.role === "customer" && request.customer.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    let updateValue = value
    if (req.user.role === "customer") {
      const allowedFields = ["title", "description", "priority", "tags"]
      const updateData = {}
      allowedFields.forEach((field) => {
        if (value[field] !== undefined) {
          updateData[field] = value[field]
        }
      })
      updateValue = updateData
    }

    if (updateValue.status) {
      if (updateValue.status === "resolved") {
        updateValue.resolvedAt = new Date()
      } else if (updateValue.status === "closed") {
        updateValue.closedAt = new Date()
      }
    }

    const updatedRequest = await SupportRequest.findOneAndUpdate({ requestId: req.params.requestId }, updateValue, {
      new: true,
      runValidators: true,
    })
      .populate("customer", "username email accountType companyName")
      .populate("assignedTechnician", "username email specialization")

    console.log(`Support request updated: ${req.params.requestId} by ${req.user.email}`)

    res.json({
      message: "Support request updated successfully",
      request: updatedRequest,
    })
  } catch (err) {
    console.error("Update support request error:", err)
    res.status(500).json({ message: "Error updating support request" })
  }
})

router.post("/:requestId/assign", authenticate, requireTechnician, async (req, res) => {
  try {
    const { error, value } = assignTechnicianSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const request = await SupportRequest.findOne({ requestId: req.params.requestId })
    if (!request) {
      return res.status(404).json({ message: "Support request not found" })
    }

    const technician = await User.findById(value.technicianId)
    if (!technician || technician.role !== "technician") {
      return res.status(400).json({ message: "Invalid technician" })
    }

    request.assignedTechnician = value.technicianId
    request.status = "in-progress"
    request.estimatedResolutionTime = value.estimatedResolutionTime
    await request.save()

    await request.populate("assignedTechnician", "username email specialization")

    console.log(`Technician assigned: ${technician.username} to ${req.params.requestId}`)

    res.json({
      message: "Technician assigned successfully",
      request,
    })
  } catch (err) {
    console.error("Assign technician error:", err)
    res.status(500).json({ message: "Error assigning technician" })
  }
})

router.get("/:requestId/messages", authenticate, async (req, res) => {
  try {
    const request = await SupportRequest.findOne({ requestId: req.params.requestId })
    if (!request) {
      return res.status(404).json({ message: "Support request not found" })
    }

    if (req.user.role === "customer" && request.customer.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    const messages = await Message.find({ supportRequest: request._id })
      .populate("sender", "username email role")
      .sort({ createdAt: 1 })

    res.json({ messages })
  } catch (err) {
    console.error("Get messages error:", err)
    res.status(500).json({ message: "Error fetching messages" })
  }
})

router.post("/:requestId/messages", authenticate, async (req, res) => {
  try {
    const { error, value } = addMessageSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const request = await SupportRequest.findOne({ requestId: req.params.requestId })
    if (!request) {
      return res.status(404).json({ message: "Support request not found" })
    }

    if (req.user.role === "customer" && request.customer.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    const message = new Message({
      supportRequest: request._id,
      sender: req.user.userId,
      content: value.content,
      messageType: value.messageType,
    })

    await message.save()
    await message.populate("sender", "username email role")

    request.lastActivity = new Date()
    await request.save()

    res.status(201).json({
      message: "Message added successfully",
      data: message,
    })
  } catch (err) {
    console.error("Add message error:", err)
    res.status(500).json({ message: "Error adding message" })
  }
})

router.post("/:requestId/rating", authenticate, requireCustomer, async (req, res) => {
  try {
    const { error, value } = ratingSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const request = await SupportRequest.findOne({ requestId: req.params.requestId })
    if (!request) {
      return res.status(404).json({ message: "Support request not found" })
    }

    if (request.customer.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    if (request.status !== "resolved" && request.status !== "closed") {
      return res.status(400).json({ message: "Can only rate resolved or closed requests" })
    }

    request.customerSatisfaction = {
      rating: value.rating,
      feedback: value.feedback,
      submittedAt: new Date(),
    }

    await request.save()

    if (request.assignedTechnician) {
      const technician = await User.findById(request.assignedTechnician)
      if (technician) {
        const newTotalReviews = technician.totalReviews + 1
        const newRating = (technician.rating * technician.totalReviews + value.rating) / newTotalReviews

        technician.rating = Math.round(newRating * 10) / 10
        technician.totalReviews = newTotalReviews
        await technician.save()
      }
    }

    res.json({
      message: "Rating submitted successfully",
      request,
    })
  } catch (err) {
    console.error("Submit rating error:", err)
    res.status(500).json({ message: "Error submitting rating" })
  }
})

router.get("/dashboard/stats", authenticate, async (req, res) => {
  try {
    let stats = {}

    if (req.user.role === "admin") {
      const totalRequests = await SupportRequest.countDocuments()
      const openRequests = await SupportRequest.countDocuments({ status: "open" })
      const inProgressRequests = await SupportRequest.countDocuments({ status: "in-progress" })
      const resolvedRequests = await SupportRequest.countDocuments({ status: "resolved" })
      const urgentRequests = await SupportRequest.countDocuments({ priority: "urgent" })

      stats = {
        totalRequests,
        openRequests,
        inProgressRequests,
        resolvedRequests,
        urgentRequests,
        totalCustomers: await User.countDocuments({ role: "customer" }),
        totalTechnicians: await User.countDocuments({ role: "technician" }),
      }
    } else if (req.user.role === "technician") {
      const assignedRequests = await SupportRequest.countDocuments({
        assignedTechnician: req.user.userId,
      })
      const activeRequests = await SupportRequest.countDocuments({
        assignedTechnician: req.user.userId,
        status: { $in: ["in-progress", "pending-customer"] },
      })
      const completedRequests = await SupportRequest.countDocuments({
        assignedTechnician: req.user.userId,
        status: { $in: ["resolved", "closed"] },
      })

      stats = {
        assignedRequests,
        activeRequests,
        completedRequests,
        availableRequests: await SupportRequest.countDocuments({
          assignedTechnician: null,
          status: "open",
        }),
      }
    } else {
      const myRequests = await SupportRequest.countDocuments({ customer: req.user.userId })
      const openRequests = await SupportRequest.countDocuments({
        customer: req.user.userId,
        status: "open",
      })
      const inProgressRequests = await SupportRequest.countDocuments({
        customer: req.user.userId,
        status: "in-progress",
      })
      const resolvedRequests = await SupportRequest.countDocuments({
        customer: req.user.userId,
        status: { $in: ["resolved", "closed"] },
      })

      stats = {
        myRequests,
        openRequests,
        inProgressRequests,
        resolvedRequests,
      }
    }

    res.json({ stats })
  } catch (err) {
    console.error("Get dashboard stats error:", err)
    res.status(500).json({ message: "Error fetching dashboard statistics" })
  }
})

// Assign technician to support request
router.post("/:requestId/assign-technician", authenticate, requireTechnician, async (req, res) => {
  try {
    const { technicianId, estimatedResolutionTime } = req.body

    if (!technicianId) {
      return res.status(400).json({ message: "Technician ID is required" })
    }

    const request = await SupportRequest.findOne({ requestId: req.params.requestId })
    if (!request) {
      return res.status(404).json({ message: "Support request not found" })
    }

    const technician = await User.findOne({ _id: technicianId, role: "technician" })
    if (!technician) {
      return res.status(404).json({ message: "Technician not found" })
    }

    request.assignedTechnician = technicianId
    request.status = "in-progress"
    request.estimatedResolutionTime = estimatedResolutionTime || 24
    await request.save()

    await request.populate("customer", "username email")
    await request.populate("assignedTechnician", "username email specialization")

    // Send notifications
    const { notificationHandlers } = await import("../utils/notifications.js")
    await notificationHandlers.supportRequestAssigned(request, request.customer, technician)

    await createAuditLog(
      req.user.userId,
      "update",
      "support-request",
      request._id,
      { action: "assign-technician", technicianId },
      req,
    )

    // Emit websocket event
    const { emitToUser, emitToTechnicians } = await import("../utils/websocket.js")
    emitToUser(technician._id.toString(), "request-assigned", { request })
    emitToTechnicians("request-assigned-update", { requestId: request.requestId, technicianId })

    res.json({
      message: "Technician assigned successfully",
      request,
    })
  } catch (err) {
    console.error("Assign technician error:", err)
    res.status(500).json({ message: "Error assigning technician" })
  }
})

// Update support request status
router.patch("/:requestId/status", authenticate, async (req, res) => {
  try {
    const { status, notes } = req.body

    if (!["open", "in-progress", "pending-customer", "resolved", "closed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" })
    }

    const request = await SupportRequest.findOne({ requestId: req.params.requestId })
    if (!request) {
      return res.status(404).json({ message: "Support request not found" })
    }

    // Check permissions
    if (req.user.role === "customer" && request.customer.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    const oldStatus = request.status
    request.status = status

    if (status === "resolved") {
      request.resolvedAt = new Date()
    } else if (status === "closed") {
      request.closedAt = new Date()
    }

    if (notes) {
      request.notes = notes
    }

    await request.save()
    await request.populate("customer", "username email")
    await request.populate("assignedTechnician", "username email")

    // Send notifications if status changed
    if (oldStatus !== status) {
      const { notificationHandlers } = await import("../utils/notifications.js")
      if (status === "resolved") {
        await notificationHandlers.supportRequestResolved(request, request.customer, request.assignedTechnician)
      }
    }

    await createAuditLog(
      req.user.userId,
      "update",
      "support-request",
      request._id,
      { action: "status-change", oldStatus, newStatus: status },
      req,
    )

    res.json({
      message: "Status updated successfully",
      request,
    })
  } catch (err) {
    console.error("Update status error:", err)
    res.status(500).json({ message: "Error updating status" })
  }
})

// Export support request details
router.get("/:requestId/export", authenticate, async (req, res) => {
  try {
    const request = await SupportRequest.findOne({ requestId: req.params.requestId })
      .populate("customer", "username email phone address")
      .populate("assignedTechnician", "username email specialization")

    if (!request) {
      return res.status(404).json({ message: "Support request not found" })
    }

    // Check permissions
    if (req.user.role === "customer" && request.customer._id.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Get messages
    const messages = await Message.find({ supportRequest: request._id })
      .populate("sender", "username email role")
      .sort({ createdAt: 1 })

    const exportData = {
      requestDetails: {
        requestId: request.requestId,
        title: request.title,
        description: request.description,
        category: request.category,
        priority: request.priority,
        status: request.status,
        createdAt: request.createdAt,
        resolvedAt: request.resolvedAt,
        closedAt: request.closedAt,
      },
      customer: {
        name: request.customer.username,
        email: request.customer.email,
        phone: request.customer.phone,
        address: request.customer.address,
      },
      technician: request.assignedTechnician
        ? {
          name: request.assignedTechnician.username,
          email: request.assignedTechnician.email,
          specialization: request.assignedTechnician.specialization,
        }
        : null,
      messages: messages.map((msg) => ({
        sender: msg.sender.username,
        role: msg.sender.role,
        content: msg.content,
        timestamp: msg.createdAt,
      })),
      satisfaction: request.customerSatisfaction,
      exportedAt: new Date(),
      exportedBy: req.user.username,
    }

    res.json({ exportData })
  } catch (err) {
    console.error("Export request error:", err)
    res.status(500).json({ message: "Error exporting request details" })
  }
})

// Add a route to get real-time updates for technicians
router.get("/real-time-updates", authenticate, requireTechnician, async (req, res) => {
  try {
    const lastChecked = req.query.lastChecked ? new Date(req.query.lastChecked) : new Date(0)

    // Get new unassigned requests
    const newRequests = await SupportRequest.find({
      assignedTechnician: null,
      status: "open",
      createdAt: { $gt: lastChecked },
    })
      .populate("customer", "username email accountType companyName")
      .sort({ priority: -1, createdAt: -1 })
      .limit(10)

    // Get updated assigned requests
    const updatedAssignedRequests = await SupportRequest.find({
      assignedTechnician: req.user.userId,
      lastActivity: { $gt: lastChecked },
    })
      .populate("customer", "username email accountType companyName")
      .sort({ lastActivity: -1 })
      .limit(10)

    res.json({
      newRequests,
      updatedAssignedRequests,
      timestamp: new Date(),
    })
  } catch (err) {
    console.error("Get real-time updates error:", err)
    res.status(500).json({ message: "Error fetching real-time updates" })
  }
})

export default router

import express from "express"
import Joi from "joi"
import SupportRequest from "../models/support-request.js"
import User from "../models/user.js"
import Notification from "../models/notification.js"
import { authenticate } from "../middlewares/authenticate.js"
import { requireAdmin, requireTechnician } from "../middlewares/authorize.js"
import { createAuditLog } from "../utils/audit.js"

const router = express.Router()

const bulkUpdateRequestsSchema = Joi.object({
  requestIds: Joi.array().items(Joi.string()).min(1).max(100).required(),
  updates: Joi.object({
    status: Joi.string().valid("open", "in-progress", "pending-customer", "resolved", "closed"),
    priority: Joi.string().valid("low", "medium", "high", "urgent"),
    assignedTechnician: Joi.string().allow(null),
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
    tags: Joi.array().items(Joi.string()),
  })
    .min(1)
    .required(),
})

const bulkNotificationSchema = Joi.object({
  userIds: Joi.array().items(Joi.string()).min(1).max(1000).required(),
  type: Joi.string().valid("message", "appointment", "support_request", "system").required(),
  content: Joi.string().min(1).max(500).required(),
})

const bulkUserUpdateSchema = Joi.object({
  userIds: Joi.array().items(Joi.string()).min(1).max(100).required(),
  updates: Joi.object({
    isActive: Joi.boolean(),
    role: Joi.string().valid("customer", "technician", "admin"),
    availability: Joi.string().valid("available", "busy", "offline"),
  })
    .min(1)
    .required(),
})

// Bulk update support requests
router.patch("/support-requests", authenticate, requireTechnician, async (req, res) => {
  try {
    const { error, value } = bulkUpdateRequestsSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const { requestIds, updates } = value

    // Verify all requests exist and user has permission
    const requests = await SupportRequest.find({ _id: { $in: requestIds } })
    if (requests.length !== requestIds.length) {
      return res.status(404).json({ message: "Some requests not found" })
    }

    // Check permissions for technicians
    if (req.user.role === "technician") {
      const unauthorizedRequests = requests.filter(
        (request) => request.assignedTechnician && request.assignedTechnician.toString() !== req.user.userId,
      )
      if (unauthorizedRequests.length > 0) {
        return res.status(403).json({ message: "Access denied to some requests" })
      }
    }

    // Perform bulk update
    const updateData = { ...updates }
    if (updates.status === "resolved") {
      updateData.resolvedAt = new Date()
    } else if (updates.status === "closed") {
      updateData.closedAt = new Date()
    }

    const result = await SupportRequest.updateMany({ _id: { $in: requestIds } }, { $set: updateData })

    await createAuditLog(
      req.user.userId,
      "update",
      "support-request",
      null,
      {
        action: "bulk_update",
        requestIds,
        updates,
        modifiedCount: result.modifiedCount,
      },
      req,
    )

    res.json({
      message: "Bulk update completed successfully",
      modifiedCount: result.modifiedCount,
    })
  } catch (err) {
    console.error("Bulk update requests error:", err)
    res.status(500).json({ message: "Error performing bulk update" })
  }
})

// Bulk send notifications
router.post("/notifications", authenticate, requireAdmin, async (req, res) => {
  try {
    const { error, value } = bulkNotificationSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const { userIds, type, content } = value

    // Verify all users exist
    const users = await User.find({ _id: { $in: userIds } })
    if (users.length !== userIds.length) {
      return res.status(404).json({ message: "Some users not found" })
    }

    // Create notifications for all users
    const notifications = userIds.map((userId) => ({
      user: userId,
      type,
      content,
    }))

    const result = await Notification.insertMany(notifications)

    await createAuditLog(
      req.user.userId,
      "create",
      "notification",
      null,
      {
        action: "bulk_notification",
        userIds,
        type,
        content,
        notificationCount: result.length,
      },
      req,
    )

    res.status(201).json({
      message: "Bulk notifications sent successfully",
      notificationCount: result.length,
    })
  } catch (err) {
    console.error("Bulk send notifications error:", err)
    res.status(500).json({ message: "Error sending bulk notifications" })
  }
})

// Bulk update users
router.patch("/users", authenticate, requireAdmin, async (req, res) => {
  try {
    const { error, value } = bulkUserUpdateSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const { userIds, updates } = value

    // Verify all users exist
    const users = await User.find({ _id: { $in: userIds } })
    if (users.length !== userIds.length) {
      return res.status(404).json({ message: "Some users not found" })
    }

    // Prevent admin from deactivating themselves
    if (updates.isActive === false && userIds.includes(req.user.userId)) {
      return res.status(400).json({ message: "Cannot deactivate your own account" })
    }

    const result = await User.updateMany({ _id: { $in: userIds } }, { $set: updates })

    await createAuditLog(
      req.user.userId,
      "update",
      "user",
      null,
      {
        action: "bulk_update",
        userIds,
        updates,
        modifiedCount: result.modifiedCount,
      },
      req,
    )

    res.json({
      message: "Bulk user update completed successfully",
      modifiedCount: result.modifiedCount,
    })
  } catch (err) {
    console.error("Bulk update users error:", err)
    res.status(500).json({ message: "Error performing bulk user update" })
  }
})

// Bulk assign technicians
router.post("/assign-technicians", authenticate, requireAdmin, async (req, res) => {
  try {
    const { requestIds, technicianId } = req.body

    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({ message: "Request IDs are required" })
    }

    if (!technicianId) {
      return res.status(400).json({ message: "Technician ID is required" })
    }

    // Verify technician exists
    const technician = await User.findOne({ _id: technicianId, role: "technician" })
    if (!technician) {
      return res.status(404).json({ message: "Technician not found" })
    }

    // Verify requests exist and are unassigned
    const requests = await SupportRequest.find({
      _id: { $in: requestIds },
      status: "open",
    })

    if (requests.length === 0) {
      return res.status(404).json({ message: "No eligible requests found" })
    }

    const result = await SupportRequest.updateMany(
      { _id: { $in: requests.map((r) => r._id) } },
      {
        $set: {
          assignedTechnician: technicianId,
          status: "in-progress",
        },
      },
    )

    await createAuditLog(
      req.user.userId,
      "assign",
      "support-request",
      null,
      {
        action: "bulk_assign",
        requestIds: requests.map((r) => r._id),
        technicianId,
        modifiedCount: result.modifiedCount,
      },
      req,
    )

    res.json({
      message: "Bulk assignment completed successfully",
      assignedCount: result.modifiedCount,
      technicianName: technician.username,
    })
  } catch (err) {
    console.error("Bulk assign technicians error:", err)
    res.status(500).json({ message: "Error performing bulk assignment" })
  }
})

// Bulk delete support requests
router.delete("/support-requests", authenticate, requireAdmin, async (req, res) => {
  try {
    const { requestIds } = req.body

    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({ message: "Request IDs are required" })
    }

    // Only allow deletion of closed requests
    const requests = await SupportRequest.find({
      _id: { $in: requestIds },
      status: "closed",
    })

    if (requests.length === 0) {
      return res.status(404).json({ message: "No eligible requests found for deletion" })
    }

    const result = await SupportRequest.deleteMany({
      _id: { $in: requests.map((r) => r._id) },
    })

    await createAuditLog(
      req.user.userId,
      "delete",
      "support-request",
      null,
      {
        action: "bulk_delete",
        requestIds: requests.map((r) => r._id),
        deletedCount: result.deletedCount,
      },
      req,
    )

    res.json({
      message: "Bulk deletion completed successfully",
      deletedCount: result.deletedCount,
    })
  } catch (err) {
    console.error("Bulk delete requests error:", err)
    res.status(500).json({ message: "Error performing bulk deletion" })
  }
})

// Get bulk operation status
router.get("/status/:operationId", authenticate, requireTechnician, async (req, res) => {
  try {
    // This would be used for long-running bulk operations
    // For now, return a simple status
    res.json({
      operationId: req.params.operationId,
      status: "completed",
      message: "Operation completed successfully",
    })
  } catch (err) {
    console.error("Get bulk operation status error:", err)
    res.status(500).json({ message: "Error fetching operation status" })
  }
})

export default router

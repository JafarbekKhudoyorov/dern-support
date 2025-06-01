import express from "express"
import AuditLog from "../models/audit-log.js"
import { authenticate } from "../middlewares/authenticate.js"
import { requireAdmin } from "../middlewares/authorize.js"

const router = express.Router()

// Get audit logs
router.get("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit

    const filter = {}

    if (req.query.user) {
      filter.user = req.query.user
    }

    if (req.query.action) {
      filter.action = req.query.action
    }

    if (req.query.resource) {
      filter.resource = req.query.resource
    }

    if (req.query.startDate && req.query.endDate) {
      filter.timestamp = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      }
    }

    const logs = await AuditLog.find(filter)
      .populate("user", "username email role")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)

    const total = await AuditLog.countDocuments(filter)

    res.json({
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("Get audit logs error:", err)
    res.status(500).json({ message: "Error fetching audit logs" })
  }
})

// Get audit log statistics
router.get("/stats", authenticate, requireAdmin, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || "30d"
    const startDate = getStartDate(timeRange)

    const actionStats = await AuditLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: "$action", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])

    const resourceStats = await AuditLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: "$resource", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])

    const userActivityStats = await AuditLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: "$user",
          actionCount: { $sum: 1 },
          lastActivity: { $max: "$timestamp" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      {
        $project: {
          username: "$userInfo.username",
          email: "$userInfo.email",
          role: "$userInfo.role",
          actionCount: 1,
          lastActivity: 1,
        },
      },
      { $sort: { actionCount: -1 } },
      { $limit: 10 },
    ])

    const dailyActivity = await AuditLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    res.json({
      actionStats,
      resourceStats,
      userActivityStats,
      dailyActivity,
    })
  } catch (err) {
    console.error("Get audit log stats error:", err)
    res.status(500).json({ message: "Error fetching audit log statistics" })
  }
})

// Export audit logs
router.get("/export", authenticate, requireAdmin, async (req, res) => {
  try {
    const filter = {}

    if (req.query.startDate && req.query.endDate) {
      filter.timestamp = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      }
    }

    const logs = await AuditLog.find(filter)
      .populate("user", "username email role")
      .sort({ timestamp: -1 })
      .limit(10000) // Limit for performance

    const csvData = logs.map((log) => ({
      timestamp: log.timestamp.toISOString(),
      user: log.user?.username || "Unknown",
      email: log.user?.email || "Unknown",
      role: log.user?.role || "Unknown",
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId || "",
      ipAddress: log.ipAddress || "",
      details: JSON.stringify(log.details || {}),
    }))

    res.setHeader("Content-Type", "text/csv")
    res.setHeader("Content-Disposition", "attachment; filename=audit-logs.csv")

    const csvHeaders = Object.keys(csvData[0] || {}).join(",")
    const csvRows = csvData.map((row) => Object.values(row).join(","))
    const csv = [csvHeaders, ...csvRows].join("\n")

    res.send(csv)
  } catch (err) {
    console.error("Export audit logs error:", err)
    res.status(500).json({ message: "Error exporting audit logs" })
  }
})

function getStartDate(timeRange) {
  const now = new Date()
  switch (timeRange) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    case "1y":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}

export default router

import express from "express"
import SupportRequest from "../models/support-request.js"
import User from "../models/user.js"
import Payment from "../models/payment.js"
import { authenticate } from "../middlewares/authenticate.js"
import { requireAdmin, requireTechnician } from "../middlewares/authorize.js"

const router = express.Router()

// Dashboard overview stats
router.get("/dashboard", authenticate, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || "30d" // 7d, 30d, 90d, 1y
    const startDate = getStartDate(timeRange)

    let stats = {}

    if (req.user.role === "admin") {
      stats = await getAdminStats(startDate)
    } else if (req.user.role === "technician") {
      stats = await getTechnicianStats(req.user.userId, startDate)
    } else {
      stats = await getCustomerStats(req.user.userId, startDate)
    }

    res.json({ stats, timeRange })
  } catch (err) {
    console.error("Get dashboard stats error:", err)
    res.status(500).json({ message: "Error fetching dashboard statistics" })
  }
})

// Support requests analytics
router.get("/support-requests", authenticate, requireTechnician, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || "30d"
    const startDate = getStartDate(timeRange)

    const pipeline = [
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]

    const requestsByDay = await SupportRequest.aggregate(pipeline)

    const categoryStats = await SupportRequest.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])

    const priorityStats = await SupportRequest.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ])

    const avgResolutionTime = await SupportRequest.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ["resolved", "closed"] },
          resolvedAt: { $exists: true },
        },
      },
      {
        $project: {
          resolutionTime: {
            $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 1000 * 60 * 60], // hours
          },
        },
      },
      {
        $group: {
          _id: null,
          avgResolutionTime: { $avg: "$resolutionTime" },
        },
      },
    ])

    res.json({
      requestsByDay,
      categoryStats,
      priorityStats,
      avgResolutionTime: avgResolutionTime[0]?.avgResolutionTime || 0,
    })
  } catch (err) {
    console.error("Get support requests analytics error:", err)
    res.status(500).json({ message: "Error fetching support requests analytics" })
  }
})

// User analytics
router.get("/users", authenticate, requireAdmin, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || "30d"
    const startDate = getStartDate(timeRange)

    const userRegistrations = await User.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    const usersByRole = await User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }])

    const usersByAccountType = await User.aggregate([{ $group: { _id: "$accountType", count: { $sum: 1 } } }])

    const activeUsers = await User.countDocuments({
      isActive: true,
      updatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    })

    res.json({
      userRegistrations,
      usersByRole,
      usersByAccountType,
      activeUsers,
    })
  } catch (err) {
    console.error("Get user analytics error:", err)
    res.status(500).json({ message: "Error fetching user analytics" })
  }
})

// Revenue analytics
router.get("/revenue", authenticate, requireAdmin, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || "30d"
    const startDate = getStartDate(timeRange)

    const revenueByDay = await Payment.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: "completed" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    const revenueByMethod = await Payment.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: "completed" } },
      { $group: { _id: "$paymentMethod", revenue: { $sum: "$amount" }, count: { $sum: 1 } } },
    ])

    const totalRevenue = await Payment.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])

    res.json({
      revenueByDay,
      revenueByMethod,
      totalRevenue: totalRevenue[0]?.total || 0,
    })
  } catch (err) {
    console.error("Get revenue analytics error:", err)
    res.status(500).json({ message: "Error fetching revenue analytics" })
  }
})

// Performance metrics
router.get("/performance", authenticate, requireTechnician, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || "30d"
    const startDate = getStartDate(timeRange)

    const filter = { createdAt: { $gte: startDate } }
    if (req.user.role === "technician") {
      filter.assignedTechnician = req.user.userId
    }

    const responseTimeStats = await SupportRequest.aggregate([
      { $match: filter },
      {
        $project: {
          responseTime: {
            $divide: [{ $subtract: ["$lastActivity", "$createdAt"] }, 1000 * 60 * 60], // hours
          },
        },
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: "$responseTime" },
          minResponseTime: { $min: "$responseTime" },
          maxResponseTime: { $max: "$responseTime" },
        },
      },
    ])

    const satisfactionStats = await SupportRequest.aggregate([
      {
        $match: {
          ...filter,
          "customerSatisfaction.rating": { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$customerSatisfaction.rating" },
          totalRatings: { $sum: 1 },
        },
      },
    ])

    const technicianPerformance = await SupportRequest.aggregate([
      { $match: { createdAt: { $gte: startDate }, assignedTechnician: { $exists: true } } },
      {
        $group: {
          _id: "$assignedTechnician",
          totalRequests: { $sum: 1 },
          resolvedRequests: {
            $sum: { $cond: [{ $in: ["$status", ["resolved", "closed"]] }, 1, 0] },
          },
          avgRating: { $avg: "$customerSatisfaction.rating" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "technician",
        },
      },
      { $unwind: "$technician" },
      {
        $project: {
          technicianName: "$technician.username",
          totalRequests: 1,
          resolvedRequests: 1,
          resolutionRate: { $divide: ["$resolvedRequests", "$totalRequests"] },
          avgRating: 1,
        },
      },
      { $sort: { resolutionRate: -1 } },
    ])

    res.json({
      responseTime: responseTimeStats[0] || {},
      satisfaction: satisfactionStats[0] || {},
      technicianPerformance: req.user.role === "admin" ? technicianPerformance : [],
    })
  } catch (err) {
    console.error("Get performance metrics error:", err)
    res.status(500).json({ message: "Error fetching performance metrics" })
  }
})

// Helper functions
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

async function getAdminStats(startDate) {
  const [
    totalUsers,
    totalRequests,
    totalRevenue,
    activeRequests,
    newUsers,
    newRequests,
    avgResolutionTime,
    satisfactionRating,
  ] = await Promise.all([
    User.countDocuments(),
    SupportRequest.countDocuments(),
    Payment.aggregate([{ $match: { status: "completed" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    SupportRequest.countDocuments({ status: { $in: ["open", "in-progress"] } }),
    User.countDocuments({ createdAt: { $gte: startDate } }),
    SupportRequest.countDocuments({ createdAt: { $gte: startDate } }),
    SupportRequest.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ["resolved", "closed"] },
          resolvedAt: { $exists: true },
        },
      },
      {
        $project: {
          resolutionTime: {
            $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 1000 * 60 * 60],
          },
        },
      },
      { $group: { _id: null, avg: { $avg: "$resolutionTime" } } },
    ]),
    SupportRequest.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          "customerSatisfaction.rating": { $exists: true },
        },
      },
      { $group: { _id: null, avg: { $avg: "$customerSatisfaction.rating" } } },
    ]),
  ])

  return {
    totalUsers,
    totalRequests,
    totalRevenue: totalRevenue[0]?.total || 0,
    activeRequests,
    newUsers,
    newRequests,
    avgResolutionTime: avgResolutionTime[0]?.avg || 0,
    satisfactionRating: satisfactionRating[0]?.avg || 0,
  }
}

async function getTechnicianStats(userId, startDate) {
  const [assignedRequests, activeRequests, completedRequests, avgRating] = await Promise.all([
    SupportRequest.countDocuments({ assignedTechnician: userId }),
    SupportRequest.countDocuments({
      assignedTechnician: userId,
      status: { $in: ["in-progress", "pending-customer"] },
    }),
    SupportRequest.countDocuments({
      assignedTechnician: userId,
      status: { $in: ["resolved", "closed"] },
      createdAt: { $gte: startDate },
    }),
    SupportRequest.aggregate([
      {
        $match: {
          assignedTechnician: userId,
          "customerSatisfaction.rating": { $exists: true },
          createdAt: { $gte: startDate },
        },
      },
      { $group: { _id: null, avg: { $avg: "$customerSatisfaction.rating" } } },
    ]),
  ])

  return {
    assignedRequests,
    activeRequests,
    completedRequests,
    avgRating: avgRating[0]?.avg || 0,
  }
}

async function getCustomerStats(userId, startDate) {
  const [myRequests, openRequests, resolvedRequests, totalSpent] = await Promise.all([
    SupportRequest.countDocuments({ customer: userId }),
    SupportRequest.countDocuments({ customer: userId, status: "open" }),
    SupportRequest.countDocuments({
      customer: userId,
      status: { $in: ["resolved", "closed"] },
      createdAt: { $gte: startDate },
    }),
    Payment.aggregate([
      { $match: { user: userId, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ])

  return {
    myRequests,
    openRequests,
    resolvedRequests,
    totalSpent: totalSpent[0]?.total || 0,
  }
}

export default router

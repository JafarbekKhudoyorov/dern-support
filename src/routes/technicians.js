import express from "express"
import Joi from "joi"
import User from "../models/user.js"
import SupportRequest from "../models/support-request.js"
import { authenticate } from "../middlewares/authenticate.js"
import { requireTechnician } from "../middlewares/authorize.js"
import mongoose from "mongoose"
import Appointment from "../models/appointment.js"

const router = express.Router()

// Validation schema for availability query - more flexible date validation
const availabilitySchema = Joi.object({
    date: Joi.alternatives()
        .try(Joi.date().iso(), Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/))
        .required()
        .messages({
            "alternatives.match": "Date must be in YYYY-MM-DD format or valid ISO date",
        }),
})

// Validation schemas
const updateAvailabilitySchema = Joi.object({
    availability: Joi.string().valid("available", "busy", "offline").required(),
})

const updateProfileSchema = Joi.object({
    specialization: Joi.array().items(Joi.string()).min(1).max(5),
    experience: Joi.number().min(0).max(50),
    hourlyRate: Joi.number().min(0).max(1000),
    certifications: Joi.array().items(Joi.string()).max(10),
})

const searchTechniciansSchema = Joi.object({
    query: Joi.string().min(1).required(),
})

// Existing routes (e.g., GET /technicians)
router.get("/", authenticate, async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1
        const limit = Number.parseInt(req.query.limit) || 10
        const skip = (page - 1) * limit

        const filter = { role: "technician", isActive: true }

        if (req.query.specialization) {
            filter.specialization = { $in: [req.query.specialization] }
        }

        if (req.query.availability) {
            filter.availability = req.query.availability
        }

        const technicians = await User.find(filter)
            .select("username email specialization experience hourlyRate availability rating totalReviews")
            .sort({ rating: -1, totalReviews: -1 })
            .skip(skip)
            .limit(limit)
            .lean()

        const formattedTechnicians = technicians.map((tech) => ({
            id: tech._id.toString(),
            _id: tech._id.toString(),
            username: tech.username,
            email: tech.email,
            specialization: tech.specialization,
            experience: tech.experience,
            hourlyRate: tech.hourlyRate,
            availability: tech.availability,
            rating: tech.rating,
            totalReviews: tech.totalReviews,
        }))

        const total = await User.countDocuments(filter)

        res.json({
            technicians: formattedTechnicians,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        })
    } catch (err) {
        console.error("Get technicians error:", err.stack)
        res.status(500).json({ message: "Error fetching technicians", error: err.message })
    }
})

// Search technicians
router.get("/search", authenticate, async (req, res) => {
    try {
        const { error, value } = searchTechniciansSchema.validate(req.query)
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
            role: "technician",
            isActive: true,
            $or: [
                { username: { $regex: value.query, $options: "i" } },
                { email: { $regex: value.query, $options: "i" } },
                { specialization: { $regex: value.query, $options: "i" } },
            ],
        }

        const technicians = await User.find(filter)
            .select("username email specialization experience hourlyRate availability rating totalReviews")
            .sort({ rating: -1, totalReviews: -1 })
            .skip(skip)
            .limit(limit)

        const total = await User.countDocuments(filter)

        res.json({
            technicians,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        })
    } catch (err) {
        console.error("Search technicians error:", err)
        res.status(500).json({ message: "Error searching technicians" })
    }
})

// Get technician profile
router.get("/:technicianId", authenticate, async (req, res) => {
    try {
        const technician = await User.findOne({
            _id: req.params.technicianId,
            role: "technician",
            isActive: true,
        }).select(
            "username email specialization experience hourlyRate availability rating totalReviews certifications createdAt",
        )

        if (!technician) {
            return res.status(404).json({ message: "Technician not found" })
        }

        const recentRequests = await SupportRequest.find({
            assignedTechnician: req.params.technicianId,
            status: { $in: ["resolved", "closed"] },
            "customerSatisfaction.rating": { $exists: true },
        })
            .populate("customer", "username accountType")
            .select("title category customerSatisfaction resolvedAt")
            .sort({ resolvedAt: -1 })
            .limit(5)

        res.json({
            technician,
            recentWork: recentRequests,
        })
    } catch (err) {
        console.error("Get technician profile error:", err)
        res.status(500).json({ message: "Error fetching technician profile" })
    }
})

// Get technician availability - FIXED
router.get("/:technicianId/availability", authenticate, async (req, res) => {
    try {
        console.log("Availability request:", {
            technicianId: req.params.technicianId,
            query: req.query,
            user: req.user?._id,
        })

        // Validate technicianId
        if (!mongoose.Types.ObjectId.isValid(req.params.technicianId)) {
            console.error("Invalid technicianId:", req.params.technicianId)
            return res.status(400).json({
                success: false,
                message: "Invalid technician ID",
            })
        }

        // More flexible date validation
        const { error, value } = availabilitySchema.validate(req.query)
        if (error) {
            console.error("Validation error:", error.details)
            return res.status(400).json({
                success: false,
                message: "Validation error",
                details: error.details.map((detail) => detail.message),
            })
        }

        const { date } = value

        // Handle different date formats
        let requestedDate
        if (typeof date === "string") {
            // Handle YYYY-MM-DD format
            if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                requestedDate = new Date(date + "T00:00:00.000Z")
            } else {
                requestedDate = new Date(date)
            }
        } else {
            requestedDate = new Date(date)
        }

        if (isNaN(requestedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format. Use YYYY-MM-DD format.",
            })
        }

        // Create date range for the entire day in UTC
        const startOfDay = new Date(requestedDate)
        startOfDay.setUTCHours(0, 0, 0, 0)

        const endOfDay = new Date(requestedDate)
        endOfDay.setUTCHours(23, 59, 59, 999)

        console.log("Date processing:", {
            originalDate: date,
            requestedDate: requestedDate.toISOString(),
            startOfDay: startOfDay.toISOString(),
            endOfDay: endOfDay.toISOString(),
        })

        // Verify technician exists
        const technician = await User.findOne({
            _id: req.params.technicianId,
            role: "technician",
            isActive: true,
        }).lean()

        if (!technician) {
            console.error("Technician not found:", req.params.technicianId)
            return res.status(404).json({
                success: false,
                message: "Technician not found or not active",
            })
        }

        // Check if technician is available
        if (technician.availability !== "available") {
            console.error("Technician unavailable:", technician.availability)
            return res.status(400).json({
                success: false,
                message: "Technician is not available",
            })
        }

        // Define working hours (9 AM to 5 PM)
        const workingHours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"]

        // Get booked appointments for the date
        console.log("Fetching appointments between:", { startOfDay, endOfDay })

        const appointments = await Appointment.find({
            technician: new mongoose.Types.ObjectId(req.params.technicianId),
            $or: [
                {
                    startTime: { $gte: startOfDay, $lte: endOfDay },
                },
                {
                    endTime: { $gte: startOfDay, $lte: endOfDay },
                },
                {
                    startTime: { $lte: startOfDay },
                    endTime: { $gte: endOfDay },
                },
            ],
            status: { $nin: ["canceled", "completed"] },
        }).lean()

        console.log(
            "Found appointments:",
            appointments.length,
            appointments.map((a) => ({
                id: a._id,
                start: a.startTime,
                end: a.endTime,
                status: a.status,
            })),
        )

        // Extract booked time ranges and convert to hour slots
        const bookedSlots = new Set()
        appointments.forEach((appt) => {
            const startTime = new Date(appt.startTime)
            const endTime = new Date(appt.endTime)

            // Get the hour range for this appointment
            const startHour = startTime.getUTCHours()
            const endHour = endTime.getUTCHours()
            const endMinutes = endTime.getUTCMinutes()

            // Mark all hours that are affected by this appointment
            for (let hour = startHour; hour <= (endMinutes > 0 ? endHour : endHour - 1); hour++) {
                const timeSlot = hour.toString().padStart(2, "0") + ":00"
                if (workingHours.includes(timeSlot)) {
                    bookedSlots.add(timeSlot)
                }
            }
        })

        // Filter out booked slots
        const availableSlots = workingHours.filter((slot) => !bookedSlots.has(slot))

        console.log("Booked slots:", Array.from(bookedSlots))
        console.log("Available slots:", availableSlots)

        res.json({
            success: true,
            data: {
                technician: {
                    id: technician._id,
                    name: technician.username,
                    availability: technician.availability,
                },
                date: typeof date === "string" ? date : date.toISOString().split("T")[0],
                bookedSlots: Array.from(bookedSlots),
                availableSlots: availableSlots,
            },
        })
    } catch (err) {
        console.error("Get technician availability error:", err.stack)
        res.status(500).json({
            success: false,
            message: "Error fetching availability",
            error: err.message,
        })
    }
})

router.patch("/availability", authenticate, requireTechnician, async (req, res) => {
    try {
        const { error, value } = updateAvailabilitySchema.validate(req.body)
        if (error) {
            return res.status(400).json({
                message: "Validation error",
                details: error.details.map((detail) => detail.message),
            })
        }

        const technician = await User.findByIdAndUpdate(
            req.user.userId,
            { availability: value.availability },
            { new: true },
        ).select("username email availability")

        console.log(`Technician availability updated: ${req.user.email} - ${value.availability}`)

        res.json({
            message: "Availability updated successfully",
            technician,
        })
    } catch (err) {
        console.error("Update availability error:", err)
        res.status(500).json({ message: "Error updating availability" })
    }
})

router.put("/profile", authenticate, requireTechnician, async (req, res) => {
    try {
        const { error, value } = updateProfileSchema.validate(req.body)
        if (error) {
            return res.status(400).json({
                message: "Validation error",
                details: error.details.map((detail) => detail.message),
            })
        }

        const technician = await User.findByIdAndUpdate(req.user.userId, value, { new: true, runValidators: true }).select(
            "username email specialization experience hourlyRate certifications",
        )

        console.log(`Technician profile updated: ${req.user.email}`)

        res.json({
            message: "Profile updated successfully",
            technician,
        })
    } catch (err) {
        console.error("Update technician profile error:", err)
        res.status(500).json({ message: "Error updating profile" })
    }
})

router.get("/my/requests", authenticate, requireTechnician, async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1
        const limit = Number.parseInt(req.query.limit) || 10
        const skip = (page - 1) * limit

        const filter = { assignedTechnician: req.user.userId }
        if (req.query.status) {
            filter.status = req.query.status
        }

        const requests = await SupportRequest.find(filter)
            .populate("customer", "username email accountType companyName")
            .sort({ lastActivity: -1 })
            .skip(skip)
            .limit(limit)

        const total = await SupportRequest.countDocuments(filter)

        res.json({
            requests,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        })
    } catch (err) {
        console.error("Get technician requests error:", err)
        res.status(500).json({ message: "Error fetching requests" })
    }
})

router.post("/debug/verify-password", async (req, res) => {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (!user) {
        return res.status(404).json({ message: "User not found" })
    }
    const isValid = await user.verifyPassword(password)
    res.json({ isValid })
})

router.get("/available/requests", authenticate, requireTechnician, async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1
        const limit = Number.parseInt(req.query.limit) || 10
        const skip = (page - 1) * limit

        const filter = { assignedTechnician: null, status: "open" }
        if (req.query.category) {
            filter.category = req.query.category
        }
        if (req.query.priority) {
            filter.priority = req.query.priority
        }

        const requests = await SupportRequest.find(filter)
            .populate("customer", "username email accountType companyName")
            .sort({ priority: 1, createdAt: 1 })
            .skip(skip)
            .limit(limit)

        const total = await SupportRequest.countDocuments(filter)

        res.json({
            requests,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        })
    } catch (err) {
        console.error("Get available requests error:", err)
        res.status(500).json({ message: "Error fetching available requests" })
    }
})

// Add a new route to get technician dashboard data
router.get("/dashboard", authenticate, requireTechnician, async (req, res) => {
    try {
        // Get technician details
        const technician = await User.findById(req.user.userId).select(
            "username email specialization experience hourlyRate availability rating totalReviews",
        )

        // Get assigned requests stats
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

        const availableRequests = await SupportRequest.countDocuments({
            assignedTechnician: null,
            status: "open",
        })

        // Get recent assigned requests
        const recentAssignedRequests = await SupportRequest.find({
            assignedTechnician: req.user.userId,
        })
            .populate("customer", "username email accountType companyName")
            .sort({ lastActivity: -1 })
            .limit(5)

        // Get recent available requests
        const recentAvailableRequests = await SupportRequest.find({
            assignedTechnician: null,
            status: "open",
        })
            .populate("customer", "username email accountType companyName")
            .sort({ priority: -1, createdAt: -1 })
            .limit(5)

        // Calculate average response time (in hours)
        const resolvedRequests = await SupportRequest.find({
            assignedTechnician: req.user.userId,
            status: { $in: ["resolved", "closed"] },
            resolvedAt: { $exists: true },
        })

        let averageResolutionTime = 0
        if (resolvedRequests.length > 0) {
            const totalTime = resolvedRequests.reduce((sum, req) => {
                const resolutionTime = (new Date(req.resolvedAt) - new Date(req.createdAt)) / (1000 * 60 * 60)
                return sum + resolutionTime
            }, 0)
            averageResolutionTime = Math.round((totalTime / resolvedRequests.length) * 10) / 10
        }

        res.json({
            technician,
            stats: {
                assignedRequests,
                activeRequests,
                completedRequests,
                availableRequests,
                averageResolutionTime,
            },
            recentAssignedRequests,
            recentAvailableRequests,
        })
    } catch (err) {
        console.error("Get technician dashboard error:", err)
        res.status(500).json({ message: "Error fetching dashboard data" })
    }
})

// Add a route to get technician performance metrics
router.get("/performance", authenticate, requireTechnician, async (req, res) => {
    try {
        const timeRange = req.query.timeRange || "month" // week, month, year

        let dateFilter = {}
        const now = new Date()

        if (timeRange === "week") {
            const weekAgo = new Date(now)
            weekAgo.setDate(now.getDate() - 7)
            dateFilter = { createdAt: { $gte: weekAgo } }
        } else if (timeRange === "month") {
            const monthAgo = new Date(now)
            monthAgo.setMonth(now.getMonth() - 1)
            dateFilter = { createdAt: { $gte: monthAgo } }
        } else if (timeRange === "year") {
            const yearAgo = new Date(now)
            yearAgo.setFullYear(now.getFullYear() - 1)
            dateFilter = { createdAt: { $gte: yearAgo } }
        }

        // Get resolved requests with ratings
        const ratedRequests = await SupportRequest.find({
            assignedTechnician: req.user.userId,
            status: { $in: ["resolved", "closed"] },
            "customerSatisfaction.rating": { $exists: true },
            ...dateFilter,
        }).select("customerSatisfaction resolvedAt createdAt")

        // Calculate average rating
        let averageRating = 0
        if (ratedRequests.length > 0) {
            const totalRating = ratedRequests.reduce((sum, req) => sum + req.customerSatisfaction.rating, 0)
            averageRating = Math.round((totalRating / ratedRequests.length) * 10) / 10
        }

        // Calculate resolution times
        const resolutionTimes = ratedRequests.map((req) => {
            return (new Date(req.resolvedAt) - new Date(req.createdAt)) / (1000 * 60 * 60)
        })

        // Get request counts by category
        const requestsByCategory = await SupportRequest.aggregate([
            { $match: { assignedTechnician: mongoose.Types.ObjectId(req.user.userId), ...dateFilter } },
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ])

        res.json({
            averageRating,
            totalRatedRequests: ratedRequests.length,
            resolutionTimes,
            requestsByCategory: requestsByCategory.map((item) => ({
                category: item._id,
                count: item.count,
            })),
        })
    } catch (err) {
        console.error("Get technician performance error:", err)
        res.status(500).json({ message: "Error fetching performance data" })
    }
})

export default router

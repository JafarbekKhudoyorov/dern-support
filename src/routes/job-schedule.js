import express from "express"
import Joi from "joi"
import { nanoid } from "nanoid"
import JobSchedule from "../models/job-schedule.js"
import User from "../models/user.js"
import { authenticate } from "../middlewares/authenticate.js"
import { requireTechnician } from "../middlewares/authorize.js"
import { createAuditLog } from "../utils/audit.js"

const router = express.Router()

const createJobSchema = Joi.object({
  title: Joi.string().min(5).max(200).required(),
  description: Joi.string().max(1000),
  jobType: Joi.string()
    .valid("maintenance", "installation", "repair", "consultation", "inspection", "emergency")
    .required(),
  priority: Joi.string().valid("low", "medium", "high", "urgent").default("medium"),
  customer: Joi.string().required(),
  assignedTechnician: Joi.string(),
  scheduledDate: Joi.date().iso().min("now").required(),
  estimatedDuration: Joi.number().min(15).required(),
  location: Joi.object({
    address: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string(),
    zipCode: Joi.string(),
    coordinates: Joi.object({
      lat: Joi.number(),
      lng: Joi.number(),
    }),
  }).required(),
  requiredSkills: Joi.array().items(Joi.string()),
  requiredInventory: Joi.array().items(
    Joi.object({
      item: Joi.string().required(),
      quantity: Joi.number().min(1).required(),
    }),
  ),
  serviceType: Joi.string(),
  relatedSupportRequest: Joi.string(),
  notes: Joi.string().max(1000),
})

const updateJobSchema = Joi.object({
  title: Joi.string().min(5).max(200),
  description: Joi.string().max(1000),
  jobType: Joi.string().valid("maintenance", "installation", "repair", "consultation", "inspection", "emergency"),
  priority: Joi.string().valid("low", "medium", "high", "urgent"),
  status: Joi.string().valid("scheduled", "in-progress", "completed", "cancelled", "postponed"),
  assignedTechnician: Joi.string(),
  customer: Joi.string(), // <-- Add this line to allow updating customer
  scheduledDate: Joi.date().iso(),
  estimatedDuration: Joi.number().min(15),
  location: Joi.object({
    address: Joi.string(),
    city: Joi.string(),
    state: Joi.string(),
    zipCode: Joi.string(),
    coordinates: Joi.object({
      lat: Joi.number(),
      lng: Joi.number(),
    }),
  }),
  requiredSkills: Joi.array().items(Joi.string()),
  requiredInventory: Joi.array().items(
    Joi.object({
      item: Joi.string().required(),
      quantity: Joi.number().min(1).required(),
    }),
  ),
  notes: Joi.string().max(1000),
  completionNotes: Joi.string().max(1000),
})

const timeTrackingSchema = Joi.object({
  action: Joi.string().valid("clock-in", "clock-out", "break-start", "break-end").required(),
  reason: Joi.string().when("action", {
    is: Joi.string().valid("break-start", "break-end"),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
})

// Create job
router.post("/", authenticate, requireTechnician, async (req, res) => {
  try {
    const { error, value } = createJobSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    // Verify customer exists
    const customer = await User.findById(value.customer)
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" })
    }

    // Verify technician if assigned
    if (value.assignedTechnician) {
      const technician = await User.findOne({
        _id: value.assignedTechnician,
        role: "technician",
      })
      if (!technician) {
        return res.status(404).json({ message: "Technician not found" })
      }
    }

    const jobId = `JOB-${nanoid(8).toUpperCase()}`
    const job = new JobSchedule({
      ...value,
      jobId,
    })

    await job.save()
    await job.populate("customer", "username email phone")
    await job.populate("assignedTechnician", "username email specialization")
    await job.populate("serviceType", "name description")
    await job.populate("requiredInventory.item", "itemName itemCode")

    await createAuditLog(req.user.userId, "create", "job-schedule", job._id, value, req)

    res.status(201).json({
      message: "Job scheduled successfully",
      job,
    })
  } catch (err) {
    console.error("Create job error:", err)
    res.status(500).json({ message: "Error creating job" })
  }
})

// Get jobs
router.get("/", authenticate, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const filter = {}

    // Role-based filtering
    if (req.user.role === "customer") {
      filter.customer = req.user.userId
    } else if (req.user.role === "technician") {
      if (req.query.assigned === "true") {
        filter.assignedTechnician = req.user.userId
      } else if (req.query.unassigned === "true") {
        filter.assignedTechnician = null
      }
    }

    // Additional filters
    if (req.query.status) {
      filter.status = req.query.status
    }

    if (req.query.jobType) {
      filter.jobType = req.query.jobType
    }

    if (req.query.priority) {
      filter.priority = req.query.priority
    }

    if (req.query.date) {
      const startDate = new Date(req.query.date)
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 1)
      filter.scheduledDate = { $gte: startDate, $lt: endDate }
    }

    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { jobId: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
      ]
    }

    const jobs = await JobSchedule.find(filter)
      .populate("customer", "username email phone")
      .populate("assignedTechnician", "username email specialization")
      .populate("serviceType", "name description price")
      .populate("requiredInventory.item", "itemName itemCode")
      .sort({ scheduledDate: 1 })
      .skip(skip)
      .limit(limit)

    const total = await JobSchedule.countDocuments(filter)

    res.json({
      jobs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("Get jobs error:", err)
    res.status(500).json({ message: "Error fetching jobs" })
  }
})

// Get single job
router.get("/:jobId", authenticate, async (req, res) => {
  try {
    const job = await JobSchedule.findOne({ jobId: req.params.jobId })
      .populate("customer", "username email phone address")
      .populate("assignedTechnician", "username email specialization hourlyRate")
      .populate("serviceType", "name description price duration")
      .populate("requiredInventory.item", "itemName itemCode unitPrice")
      .populate("relatedSupportRequest", "requestId title status")

    if (!job) {
      return res.status(404).json({ message: "Job not found" })
    }

    // Check permissions
    if (req.user.role === "customer" && job.customer._id.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    if (
      req.user.role === "technician" &&
      job.assignedTechnician &&
      job.assignedTechnician._id.toString() !== req.user.userId
    ) {
      return res.status(403).json({ message: "Access denied" })
    }

    res.json({ job })
  } catch (err) {
    console.error("Get job error:", err)
    res.status(500).json({ message: "Error fetching job" })
  }
})

// Update job
router.put("/:jobId", authenticate, requireTechnician, async (req, res) => {
  try {
    const { error, value } = updateJobSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const job = await JobSchedule.findOne({ jobId: req.params.jobId })
    if (!job) {
      return res.status(404).json({ message: "Job not found" })
    }

    // Check permissions
    if (
      req.user.role === "technician" &&
      job.assignedTechnician &&
      job.assignedTechnician.toString() !== req.user.userId
    ) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Handle status changes
    if (value.status && value.status !== job.status) {
      if (value.status === "in-progress" && !job.actualStartTime) {
        value.actualStartTime = new Date()
      } else if (value.status === "completed" && !job.actualEndTime) {
        value.actualEndTime = new Date()
      }
    }

    Object.assign(job, value)
    await job.save()

    await job.populate("customer", "username email phone")
    await job.populate("assignedTechnician", "username email specialization")
    await job.populate("serviceType", "name description price")

    await createAuditLog(req.user.userId, "update", "job-schedule", job._id, value, req)

    res.json({
      message: "Job updated successfully",
      job,
    })
  } catch (err) {
    console.error("Update job error:", err)
    res.status(500).json({ message: "Error updating job" })
  }
})

// Time tracking
router.post("/:jobId/time-tracking", authenticate, requireTechnician, async (req, res) => {
  try {
    const { error, value } = timeTrackingSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const job = await JobSchedule.findOne({ jobId: req.params.jobId })
    if (!job) {
      return res.status(404).json({ message: "Job not found" })
    }

    // Check permissions
    if (job.assignedTechnician.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    const { action, reason } = value
    const now = new Date()

    if (!job.timeTracking) {
      job.timeTracking = { breaks: [] }
    }

    switch (action) {
      case "clock-in":
        job.timeTracking.clockIn = now
        job.status = "in-progress"
        job.actualStartTime = now
        break

      case "clock-out":
        job.timeTracking.clockOut = now
        job.status = "completed"
        job.actualEndTime = now
        break

      case "break-start":
        job.timeTracking.breaks.push({ start: now, reason })
        break

      case "break-end":
        const lastBreak = job.timeTracking.breaks[job.timeTracking.breaks.length - 1]
        if (lastBreak && !lastBreak.end) {
          lastBreak.end = now
        }
        break
    }

    await job.save()

    await createAuditLog(req.user.userId, "update", "job-schedule", job._id, { timeTracking: action }, req)

    res.json({
      message: "Time tracking updated successfully",
      timeTracking: job.timeTracking,
    })
  } catch (err) {
    console.error("Time tracking error:", err)
    res.status(500).json({ message: "Error updating time tracking" })
  }
})

// Get technician schedule
router.get("/technician/:technicianId/schedule", authenticate, async (req, res) => {
  try {
    const startDate = new Date(req.query.startDate || new Date())
    const endDate = new Date(req.query.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))

    const jobs = await JobSchedule.find({
      assignedTechnician: req.params.technicianId,
      scheduledDate: { $gte: startDate, $lte: endDate },
      status: { $in: ["scheduled", "in-progress"] },
    })
      .populate("customer", "username email")
      .populate("serviceType", "name duration")
      .sort({ scheduledDate: 1 })

    res.json({ jobs })
  } catch (err) {
    console.error("Get technician schedule error:", err)
    res.status(500).json({ message: "Error fetching technician schedule" })
  }
})

export default router

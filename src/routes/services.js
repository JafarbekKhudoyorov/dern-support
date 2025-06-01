import express from "express";
import Joi from "joi";
import Service from "../models/service.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireAdmin } from "../middlewares/authorize.js";

const router = express.Router();

// Validation schemas
const createServiceSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().min(10).max(500).required(),
  price: Joi.number().min(0).required(),
  duration: Joi.number().min(15).required(),
  category: Joi.string().valid("legal", "technical", "consultation", "other").required(),
});

const updateServiceSchema = Joi.object({
  name: Joi.string().min(3).max(100),
  description: Joi.string().min(10).max(500),
  price: Joi.number().min(0),
  duration: Joi.number().min(15),
  category: Joi.string().valid("legal", "technical", "consultation", "other"),
});

// Create service (admin only)
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const { error, value } = createServiceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      });
    }

    const service = new Service(value);
    await service.save();

    console.log(`Service created: ${value.name} by ${req.user.email}`);

    res.status(201).json({
      message: "Service created successfully",
      service,
    });
  } catch (err) {
    console.error("Create service error:", err);
    res.status(500).json({ message: "Error creating service" });
  }
});

// List all services
router.get("/", async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1;
    const limit = Number.parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const services = await Service.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Service.countDocuments(filter);

    res.json({
      services,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("Get services error:", err);
    res.status(500).json({ message: "Error fetching services" });
  }
});

// Get specific service
router.get("/:serviceId", async (req, res) => {
  try {
    const service = await Service.findById(req.params.serviceId);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.json({ service });
  } catch (err) {
    console.error("Get service error:", err);
    res.status(500).json({ message: "Error fetching service" });
  }
});

// Update service (admin only)
router.put("/:serviceId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { error, value } = updateServiceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      });
    }

    const service = await Service.findByIdAndUpdate(req.params.serviceId, value, { new: true });
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    console.log(`Service updated: ${service.name} by ${req.user.email}`);

    res.json({
      message: "Service updated successfully",
      service,
    });
  } catch (err) {
    console.error("Update service error:", err);
    res.status(500).json({ message: "Error updating service" });
  }
});

export default router;

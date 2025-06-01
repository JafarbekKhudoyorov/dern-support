import express from "express"
import Joi from "joi"
import { nanoid } from "nanoid"
import Inventory from "../models/inventory.js"
import { authenticate } from "../middlewares/authenticate.js"
import { requireTechnician } from "../middlewares/authorize.js"
import { createAuditLog } from "../utils/audit.js"

const router = express.Router()

// Dynamically get allowed categories from the Inventory schema
const allowedCategories = Inventory.schema.path("category").enumValues

const createInventorySchema = Joi.object({
  itemName: Joi.string().min(2).max(100).required(),
  itemCode: Joi.string().trim().uppercase().optional(), // <-- Add this line
  category: Joi.string().valid(...allowedCategories).required(),
  description: Joi.string().max(500),
  quantity: Joi.number().min(0).required(),
  minStockLevel: Joi.number().min(0).default(5),
  maxStockLevel: Joi.number().min(0).default(100),
  unitPrice: Joi.number().min(0).required(),
  supplier: Joi.object({
    name: Joi.string().required(),
    contact: Joi.string(),
    email: Joi.string().email(),
  }).required(),
  location: Joi.object({
    warehouse: Joi.string().default("Main Warehouse"),
    shelf: Joi.string(),
    bin: Joi.string(),
  }),
})

const updateInventorySchema = Joi.object({
  itemName: Joi.string().min(2).max(100),
  itemCode: Joi.string().trim().uppercase(), // <-- Add this line
  category: Joi.string().valid(...allowedCategories),
  description: Joi.string().max(500),
  quantity: Joi.number().min(0),
  minStockLevel: Joi.number().min(0),
  maxStockLevel: Joi.number().min(0),
  unitPrice: Joi.number().min(0),
  supplier: Joi.object({
    name: Joi.string(),
    contact: Joi.string(),
    email: Joi.string().email(),
  }),
  location: Joi.object({
    warehouse: Joi.string(),
    shelf: Joi.string(),
    bin: Joi.string(),
  }),
  status: Joi.string().valid("active", "discontinued", "out-of-stock", "low-stock"),
})

const stockMovementSchema = Joi.object({
  action: Joi.string().valid("added", "removed", "transferred", "assigned", "returned").required(),
  quantity: Joi.number().min(1).required(),
  notes: Joi.string().max(500),
  assignedTo: Joi.string().when("action", {
    is: "assigned",
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
})

// Create inventory item
router.post("/", authenticate, requireTechnician, async (req, res) => {
  try {
    const { error, value } = createInventorySchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const itemCode = `INV-${nanoid(8).toUpperCase()}`
    const inventory = new Inventory({
      ...value,
      itemCode,
    })

    await inventory.save()

    await createAuditLog(req.user.userId, "create", "inventory", inventory._id, value, req)

    res.status(201).json({
      message: "Inventory item created successfully",
      item: inventory,
    })
  } catch (err) {
    console.error("Create inventory error:", err)
    res.status(500).json({ message: "Error creating inventory item" })
  }
})

// Get all inventory items
router.get("/", authenticate, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const filter = {}

    if (req.query.category) {
      filter.category = req.query.category
    }

    if (req.query.status) {
      filter.status = req.query.status
    }

    if (req.query.lowStock === "true") {
      filter.$expr = { $lte: ["$quantity", "$minStockLevel"] }
    }

    if (req.query.search) {
      filter.$or = [
        { itemName: { $regex: req.query.search, $options: "i" } },
        { itemCode: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
      ]
    }

    const items = await Inventory.find(filter)
      .populate("assignedTo", "username email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Inventory.countDocuments(filter)

    // Get summary stats
    const stats = await Inventory.aggregate([
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalValue: { $sum: { $multiply: ["$quantity", "$unitPrice"] } },
          lowStockItems: {
            $sum: {
              $cond: [{ $lte: ["$quantity", "$minStockLevel"] }, 1, 0],
            },
          },
          outOfStockItems: {
            $sum: {
              $cond: [{ $eq: ["$quantity", 0] }, 1, 0],
            },
          },
        },
      },
    ])

    res.json({
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: stats[0] || { totalItems: 0, totalValue: 0, lowStockItems: 0, outOfStockItems: 0 },
    })
  } catch (err) {
    console.error("Get inventory error:", err)
    res.status(500).json({ message: "Error fetching inventory" })
  }
})

// Get single inventory item
router.get("/:itemId", authenticate, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.itemId)
      .populate("assignedTo", "username email")
      .populate("usageHistory.user", "username email")

    if (!item) {
      return res.status(404).json({ message: "Inventory item not found" })
    }

    res.json({ item })
  } catch (err) {
    console.error("Get inventory item error:", err)
    res.status(500).json({ message: "Error fetching inventory item" })
  }
})

// Update inventory item
router.put("/:itemId", authenticate, requireTechnician, async (req, res) => {
  try {
    const { error, value } = updateInventorySchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const item = await Inventory.findByIdAndUpdate(req.params.itemId, value, {
      new: true,
      runValidators: true,
    })

    if (!item) {
      return res.status(404).json({ message: "Inventory item not found" })
    }

    await createAuditLog(req.user.userId, "update", "inventory", item._id, value, req)

    res.json({
      message: "Inventory item updated successfully",
      item,
    })
  } catch (err) {
    console.error("Update inventory error:", err)
    res.status(500).json({ message: "Error updating inventory item" })
  }
})

// Stock movement (add/remove/transfer)
router.post("/:itemId/movement", authenticate, requireTechnician, async (req, res) => {
  try {
    const { error, value } = stockMovementSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const item = await Inventory.findById(req.params.itemId)
    if (!item) {
      return res.status(404).json({ message: "Inventory item not found" })
    }

    const { action, quantity, notes, assignedTo } = value

    // Update quantity based on action
    if (action === "added") {
      item.quantity += quantity
      item.lastRestocked = new Date()
    } else if (action === "removed" || action === "assigned") {
      if (item.quantity < quantity) {
        return res.status(400).json({ message: "Insufficient stock" })
      }
      item.quantity -= quantity
    }

    // Handle assignment
    if (action === "assigned" && assignedTo) {
      item.assignedTo = assignedTo
    } else if (action === "returned") {
      item.quantity += quantity
      item.assignedTo = null
    }

    // Add to usage history
    item.usageHistory.push({
      action,
      quantity,
      user: req.user.userId,
      notes,
    })

    // Update status based on quantity
    if (item.quantity === 0) {
      item.status = "out-of-stock"
    } else if (item.quantity <= item.minStockLevel) {
      item.status = "low-stock"
    } else {
      item.status = "active"
    }

    await item.save()

    await createAuditLog(req.user.userId, "update", "inventory", item._id, { action, quantity, notes }, req)

    res.json({
      message: "Stock movement recorded successfully",
      item,
    })
  } catch (err) {
    console.error("Stock movement error:", err)
    res.status(500).json({ message: "Error recording stock movement" })
  }
})

// Get inventory categories
router.get("/meta/categories", authenticate, async (req, res) => {
  try {
    const categories = await Inventory.distinct("category")
    res.json({ categories })
  } catch (err) {
    console.error("Get categories error:", err)
    res.status(500).json({ message: "Error fetching categories" })
  }
})

// Get low stock alerts
router.get("/alerts/low-stock", authenticate, requireTechnician, async (req, res) => {
  try {
    const lowStockItems = await Inventory.find({
      $expr: { $lte: ["$quantity", "$minStockLevel"] },
      status: { $ne: "discontinued" },
    }).select("itemName itemCode quantity minStockLevel category")

    res.json({ items: lowStockItems })
  } catch (err) {
    console.error("Get low stock alerts error:", err)
    res.status(500).json({ message: "Error fetching low stock alerts" })
  }
})

export default router

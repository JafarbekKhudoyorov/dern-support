import express from "express"
import Joi from "joi"
import SystemSettings from "../models/system-settings.js"
import { authenticate } from "../middlewares/authenticate.js"
import { requireAdmin } from "../middlewares/authorize.js"
import { createAuditLog } from "../utils/audit.js"

const router = express.Router()

const updateSettingSchema = Joi.object({
  value: Joi.any().required(),
})

const createSettingSchema = Joi.object({
  key: Joi.string().required(),
  value: Joi.any().required(),
  category: Joi.string().valid("general", "email", "security", "payment", "notification", "sla").required(),
  description: Joi.string(),
  isEditable: Joi.boolean().default(true),
})

// Get all settings
router.get("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const category = req.query.category
    const filter = category ? { category } : {}

    const settings = await SystemSettings.find(filter)
      .populate("lastModifiedBy", "username email")
      .sort({ category: 1, key: 1 })

    res.json({ settings })
  } catch (err) {
    console.error("Get settings error:", err)
    res.status(500).json({ message: "Error fetching settings" })
  }
})

// Get public settings (for frontend configuration)
router.get("/public", async (req, res) => {
  try {
    const publicSettings = await SystemSettings.find({
      key: {
        $in: [
          "site_name",
          "site_description",
          "support_email",
          "business_hours",
          "timezone",
          "default_language",
          "maintenance_mode",
        ],
      },
    }).select("key value")

    const settingsMap = {}
    publicSettings.forEach((setting) => {
      settingsMap[setting.key] = setting.value
    })

    res.json({ settings: settingsMap })
  } catch (err) {
    console.error("Get public settings error:", err)
    res.status(500).json({ message: "Error fetching public settings" })
  }
})

// Get single setting
router.get("/:key", authenticate, requireAdmin, async (req, res) => {
  try {
    const setting = await SystemSettings.findOne({ key: req.params.key }).populate("lastModifiedBy", "username email")

    if (!setting) {
      return res.status(404).json({ message: "Setting not found" })
    }

    res.json({ setting })
  } catch (err) {
    console.error("Get setting error:", err)
    res.status(500).json({ message: "Error fetching setting" })
  }
})

// Update setting
router.put("/:key", authenticate, requireAdmin, async (req, res) => {
  try {
    const { error, value } = updateSettingSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const setting = await SystemSettings.findOne({ key: req.params.key })
    if (!setting) {
      return res.status(404).json({ message: "Setting not found" })
    }

    if (!setting.isEditable) {
      return res.status(403).json({ message: "This setting is not editable" })
    }

    const oldValue = setting.value
    setting.value = value.value
    setting.lastModifiedBy = req.user.userId
    await setting.save()

    await createAuditLog(
      req.user.userId,
      "update",
      "system-settings",
      setting._id,
      {
        key: setting.key,
        oldValue,
        newValue: value.value,
      },
      req,
    )

    res.json({
      message: "Setting updated successfully",
      setting,
    })
  } catch (err) {
    console.error("Update setting error:", err)
    res.status(500).json({ message: "Error updating setting" })
  }
})

// Create new setting
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const { error, value } = createSettingSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const existingSetting = await SystemSettings.findOne({ key: value.key })
    if (existingSetting) {
      return res.status(409).json({ message: "Setting with this key already exists" })
    }

    const setting = new SystemSettings({
      ...value,
      lastModifiedBy: req.user.userId,
    })

    await setting.save()

    await createAuditLog(req.user.userId, "create", "system-settings", setting._id, value, req)

    res.status(201).json({
      message: "Setting created successfully",
      setting,
    })
  } catch (err) {
    console.error("Create setting error:", err)
    res.status(500).json({ message: "Error creating setting" })
  }
})

// Delete setting
router.delete("/:key", authenticate, requireAdmin, async (req, res) => {
  try {
    const setting = await SystemSettings.findOne({ key: req.params.key })
    if (!setting) {
      return res.status(404).json({ message: "Setting not found" })
    }

    if (!setting.isEditable) {
      return res.status(403).json({ message: "This setting cannot be deleted" })
    }

    await SystemSettings.findByIdAndDelete(setting._id)

    await createAuditLog(
      req.user.userId,
      "delete",
      "system-settings",
      setting._id,
      {
        key: setting.key,
      },
      req,
    )

    res.json({ message: "Setting deleted successfully" })
  } catch (err) {
    console.error("Delete setting error:", err)
    res.status(500).json({ message: "Error deleting setting" })
  }
})

// Reset settings to default
router.post("/reset", authenticate, requireAdmin, async (req, res) => {
  try {
    const defaultSettings = getDefaultSettings()

    for (const setting of defaultSettings) {
      await SystemSettings.findOneAndUpdate(
        { key: setting.key },
        {
          ...setting,
          lastModifiedBy: req.user.userId,
        },
        { upsert: true },
      )
    }

    await createAuditLog(
      req.user.userId,
      "update",
      "system-settings",
      null,
      {
        action: "reset_to_defaults",
      },
      req,
    )

    res.json({ message: "Settings reset to defaults successfully" })
  } catch (err) {
    console.error("Reset settings error:", err)
    res.status(500).json({ message: "Error resetting settings" })
  }
})

// Get categories
router.get("/meta/categories", authenticate, requireAdmin, async (req, res) => {
  try {
    const categories = await SystemSettings.distinct("category")
    res.json({ categories })
  } catch (err) {
    console.error("Get categories error:", err)
    res.status(500).json({ message: "Error fetching categories" })
  }
})

function getDefaultSettings() {
  return [
    {
      key: "site_name",
      value: "Dern Support",
      category: "general",
      description: "Name of the support platform",
      isEditable: true,
    },
    {
      key: "site_description",
      value: "Professional support platform connecting clients with verified experts",
      category: "general",
      description: "Description of the platform",
      isEditable: true,
    },
    {
      key: "support_email",
      value: "support@dern-support.com",
      category: "general",
      description: "Main support email address",
      isEditable: true,
    },
    {
      key: "business_hours",
      value: "Monday-Friday 9:00 AM - 6:00 PM",
      category: "general",
      description: "Business hours for support",
      isEditable: true,
    },
    {
      key: "timezone",
      value: "UTC",
      category: "general",
      description: "Default timezone",
      isEditable: true,
    },
    {
      key: "default_language",
      value: "en",
      category: "general",
      description: "Default language for the platform",
      isEditable: true,
    },
    {
      key: "maintenance_mode",
      value: false,
      category: "general",
      description: "Enable maintenance mode",
      isEditable: true,
    },
    {
      key: "max_file_size",
      value: 10485760, // 10MB
      category: "general",
      description: "Maximum file upload size in bytes",
      isEditable: true,
    },
    {
      key: "allowed_file_types",
      value: ["pdf", "doc", "docx", "txt", "jpg", "jpeg", "png", "gif"],
      category: "general",
      description: "Allowed file types for uploads",
      isEditable: true,
    },
    {
      key: "email_notifications_enabled",
      value: true,
      category: "notification",
      description: "Enable email notifications",
      isEditable: true,
    },
    {
      key: "sms_notifications_enabled",
      value: false,
      category: "notification",
      description: "Enable SMS notifications",
      isEditable: true,
    },
    {
      key: "auto_assign_technicians",
      value: true,
      category: "general",
      description: "Automatically assign technicians to new requests",
      isEditable: true,
    },
    {
      key: "default_sla_response_time",
      value: 240, // 4 hours
      category: "sla",
      description: "Default SLA response time in minutes",
      isEditable: true,
    },
    {
      key: "default_sla_resolution_time",
      value: 1440, // 24 hours
      category: "sla",
      description: "Default SLA resolution time in minutes",
      isEditable: true,
    },
  ]
}

export default router

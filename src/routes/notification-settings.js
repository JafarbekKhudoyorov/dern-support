import express from "express"
import Joi from "joi"
import NotificationSettings from "../models/notification-settings.js"
import { authenticate } from "../middlewares/authenticate.js"
import { createAuditLog } from "../utils/audit.js"

const router = express.Router()

const updateSettingsSchema = Joi.object({
    emailNotifications: Joi.object({
        enabled: Joi.boolean(),
        supportRequests: Joi.boolean(),
        appointments: Joi.boolean(),
        messages: Joi.boolean(),
        systemUpdates: Joi.boolean(),
        marketing: Joi.boolean(),
    }),
    pushNotifications: Joi.object({
        enabled: Joi.boolean(),
        endpoint: Joi.string(),
        keys: Joi.object({
            p256dh: Joi.string(),
            auth: Joi.string(),
        }),
        supportRequests: Joi.boolean(),
        appointments: Joi.boolean(),
        messages: Joi.boolean(),
    }),
    smsNotifications: Joi.object({
        enabled: Joi.boolean(),
        phoneNumber: Joi.string(),
        urgentOnly: Joi.boolean(),
    }),
    inAppNotifications: Joi.object({
        enabled: Joi.boolean(),
        sound: Joi.boolean(),
        desktop: Joi.boolean(),
    }),
})

// Get user's notification settings
router.get("/", authenticate, async (req, res) => {
    try {
        let settings = await NotificationSettings.findOne({ user: req.user.userId })

        if (!settings) {
            // Create default settings
            settings = new NotificationSettings({ user: req.user.userId })
            await settings.save()
        }

        res.json({ settings })
    } catch (err) {
        console.error("Get notification settings error:", err)
        res.status(500).json({ message: "Error fetching notification settings" })
    }
})

// Update notification settings
router.put("/", authenticate, async (req, res) => {
    try {
        const { error, value } = updateSettingsSchema.validate(req.body)
        if (error) {
            return res.status(400).json({
                message: "Validation error",
                details: error.details.map((detail) => detail.message),
            })
        }

        let settings = await NotificationSettings.findOne({ user: req.user.userId })

        if (!settings) {
            settings = new NotificationSettings({
                user: req.user.userId,
                ...value,
            })
        } else {
            Object.assign(settings, value)
        }

        await settings.save()

        await createAuditLog(req.user.userId, "update", "notification-settings", settings._id, value, req)

        res.json({
            message: "Notification settings updated successfully",
            settings,
        })
    } catch (err) {
        console.error("Update notification settings error:", err)
        res.status(500).json({ message: "Error updating notification settings" })
    }
})

// Subscribe to push notifications
router.post("/push/subscribe", authenticate, async (req, res) => {
    try {
        const { endpoint, keys } = req.body

        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            return res.status(400).json({ message: "Invalid push subscription data" })
        }

        let settings = await NotificationSettings.findOne({ user: req.user.userId })

        if (!settings) {
            settings = new NotificationSettings({ user: req.user.userId })
        }

        settings.pushNotifications.enabled = true
        settings.pushNotifications.endpoint = endpoint
        settings.pushNotifications.keys = keys

        await settings.save()

        res.json({ message: "Push notifications enabled successfully" })
    } catch (err) {
        console.error("Push subscription error:", err)
        res.status(500).json({ message: "Error enabling push notifications" })
    }
})

// Unsubscribe from push notifications
router.post("/push/unsubscribe", authenticate, async (req, res) => {
    try {
        const settings = await NotificationSettings.findOne({ user: req.user.userId })

        if (settings) {
            settings.pushNotifications.enabled = false
            settings.pushNotifications.endpoint = undefined
            settings.pushNotifications.keys = undefined
            await settings.save()
        }

        res.json({ message: "Push notifications disabled successfully" })
    } catch (err) {
        console.error("Push unsubscription error:", err)
        res.status(500).json({ message: "Error disabling push notifications" })
    }
})

// Test notification
router.post("/test", authenticate, async (req, res) => {
    try {
        const { type } = req.body

        if (!["email", "push", "sms"].includes(type)) {
            return res.status(400).json({ message: "Invalid notification type" })
        }

        // For now, SMS is not available
        if (type === "sms") {
            return res.status(400).json({ message: "SMS notifications are currently not available" })
        }

        // Send test notification based on type
        if (type === "email") {
            // Send test email
            const { sendEmailNotification } = await import("../utils/notifications.js")
            await sendEmailNotification(req.user.email, "test", {
                userName: req.user.username,
            })
        } else if (type === "push") {
            // Send test push notification
            const { emitToUser } = await import("../utils/websocket.js")
            emitToUser(req.user.userId, "test-notification", {
                title: "Test Notification",
                message: "This is a test push notification",
            })
        }

        res.json({ message: `Test ${type} notification sent successfully` })
    } catch (err) {
        console.error("Test notification error:", err)
        res.status(500).json({ message: "Error sending test notification" })
    }
})

export default router

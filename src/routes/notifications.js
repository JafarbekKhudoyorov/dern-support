import express from "express";
import Joi from "joi";
import Notification from "../models/notification.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireAdmin } from "../middlewares/authorize.js";

const router = express.Router();

// Validation schema
const createNotificationSchema = Joi.object({
  userId: Joi.string().required(),
  type: Joi.string().valid("message", "appointment", "support_request", "system").required(),
  content: Joi.string().min(1).max(500).required(),
});

// Send notification (admin only)
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const { error, value } = createNotificationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      });
    }

    const user = await User.findById(value.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const notification = new Notification({
      user: value.userId,
      type: value.type,
      content: value.content,
    });

    await notification.save();
    await notification.populate("user", "username email");

    console.log(`Notification sent to ${user.email} by ${req.user.email}`);

    res.status(201).json({
      message: "Notification sent successfully",
      notification,
    });
  } catch (err) {
    console.error("Send notification error:", err);
    res.status(500).json({ message: "Error sending notification" });
  }
});

// List notifications for user
router.get("/", authenticate, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1;
    const limit = Number.parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { user: req.user.userId };
    if (req.query.isRead) {
      filter.isRead = req.query.isRead === "true";
    }

    const notifications = await Notification.find(filter)
      .populate("user", "username email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments(filter);

    res.json({
      notifications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("Get notifications error:", err);
    res.status(500).json({ message: "Error fetching notifications" });
  }
});

// Mark notification as read
router.patch("/:notificationId", authenticate, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (notification.user.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({ message: "Notification marked as read", notification });
  } catch (err) {
    console.error("Mark notification read error:", err);
    res.status(500).json({ message: "Error marking notification as read" });
  }
});

export default router;

import express from "express"
import Joi from "joi"
import Chat from "../models/chat.js"
import Message from "../models/message.js"
import SupportRequest from "../models/support-request.js"
import { authenticate } from "../middlewares/authenticate.js"
import { createAuditLog } from "../utils/audit.js"

const router = express.Router()

const createChatSchema = Joi.object({
  supportRequestId: Joi.string().required(),
  participants: Joi.array().items(Joi.string()).min(2).required(),
})

const sendMessageSchema = Joi.object({
  content: Joi.string().min(1).max(2000).required(),
  messageType: Joi.string().valid("text", "file", "system", "status-update").default("text"),
  attachments: Joi.array().items(
    Joi.object({
      filename: Joi.string().required(),
      originalName: Joi.string().required(),
      mimetype: Joi.string().required(),
      size: Joi.number().required(),
      url: Joi.string().uri().required(),
    }),
  ),
})

// Create or get chat for support request
router.post("/", authenticate, async (req, res) => {
  try {
    const { error, value } = createChatSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const { supportRequestId, participants } = value

    // Check if support request exists
    const supportRequest = await SupportRequest.findById(supportRequestId)
    if (!supportRequest) {
      return res.status(404).json({ message: "Support request not found" })
    }

    // Check if chat already exists
    let chat = await Chat.findOne({ supportRequest: supportRequestId })
    if (chat) {
      await chat.populate("participants", "username email role")
      return res.json({ chat })
    }

    // Create new chat
    chat = new Chat({
      participants,
      supportRequest: supportRequestId,
    })

    await chat.save()
    await chat.populate("participants", "username email role")

    await createAuditLog(req.user.userId, "create", "chat", chat._id, { supportRequestId }, req)

    res.status(201).json({
      message: "Chat created successfully",
      chat,
    })
  } catch (err) {
    console.error("Create chat error:", err)
    res.status(500).json({ message: "Error creating chat" })
  }
})

// Get user's chats
router.get("/", authenticate, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const filter = { participants: req.user.userId, isActive: true }

    const chats = await Chat.find(filter)
      .populate("participants", "username email role")
      .populate("supportRequest", "requestId title status priority")
      .populate("lastMessage", "content messageType createdAt sender")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Chat.countDocuments(filter)

    res.json({
      chats,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("Get chats error:", err)
    res.status(500).json({ message: "Error fetching chats" })
  }
})

// Get chat messages
router.get("/:chatId/messages", authenticate, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId)
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" })
    }

    if (!chat.participants.includes(req.user.userId)) {
      return res.status(403).json({ message: "Access denied" })
    }

    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit

    const messages = await Message.find({ supportRequest: chat.supportRequest })
      .populate("sender", "username email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Message.countDocuments({ supportRequest: chat.supportRequest })

    res.json({
      messages: messages.reverse(),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("Get chat messages error:", err)
    res.status(500).json({ message: "Error fetching messages" })
  }
})

// Send message in chat
router.post("/:chatId/messages", authenticate, async (req, res) => {
  try {
    const { error, value } = sendMessageSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      })
    }

    const chat = await Chat.findById(req.params.chatId)
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" })
    }

    if (!chat.participants.includes(req.user.userId)) {
      return res.status(403).json({ message: "Access denied" })
    }

    const message = new Message({
      supportRequest: chat.supportRequest,
      sender: req.user.userId,
      content: value.content,
      messageType: value.messageType,
      attachments: value.attachments || [],
    })

    await message.save()
    await message.populate("sender", "username email role")

    // Update chat's last message
    chat.lastMessage = message._id
    chat.updatedAt = new Date()
    await chat.save()

    // Update support request activity
    await SupportRequest.findByIdAndUpdate(chat.supportRequest, {
      lastActivity: new Date(),
    })

    await createAuditLog(req.user.userId, "create", "message", message._id, { chatId: chat._id }, req)

    res.status(201).json({
      message: "Message sent successfully",
      data: message,
    })
  } catch (err) {
    console.error("Send message error:", err)
    res.status(500).json({ message: "Error sending message" })
  }
})

// Mark messages as read
router.patch("/:chatId/read", authenticate, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId)
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" })
    }

    if (!chat.participants.includes(req.user.userId)) {
      return res.status(403).json({ message: "Access denied" })
    }

    await Message.updateMany(
      {
        supportRequest: chat.supportRequest,
        sender: { $ne: req.user.userId },
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    )

    res.json({ message: "Messages marked as read" })
  } catch (err) {
    console.error("Mark messages read error:", err)
    res.status(500).json({ message: "Error marking messages as read" })
  }
})

export default router

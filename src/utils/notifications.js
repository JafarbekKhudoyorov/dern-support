import nodemailer from "nodemailer"
import Notification from "../models/notification.js"
import { getEmailTemplate } from "./email-templates.js"
import { emitToUser } from "./websocket.js"

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.GMAIL_HOST || "smtp.gmail.com",
    port: Number.parseInt(process.env.GMAIL_PORT) || 587,
    secure: process.env.GMAIL_SECURE === "true",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  })
}

// Send email notification
export const sendEmailNotification = async (to, templateType, data) => {
  try {
    const template = getEmailTemplate(templateType, data)
    if (!template) {
      throw new Error(`Email template '${templateType}' not found`)
    }

    const transporter = createTransporter()

    const mailOptions = {
      from: process.env.GMAIL_FROM || "Dern Support <noreply@dern-support.com>",
      to,
      subject: template.subject,
      html: template.html,
    }

    const info = await transporter.sendMail(mailOptions)
    console.log(`Email sent to ${to}: ${info.messageId}`)
    return info
  } catch (err) {
    console.error("Email notification error:", err)
    throw err
  }
}

// Create in-app notification
export const createNotification = async (userId, type, content, relatedData = {}) => {
  try {
    const notification = new Notification({
      user: userId,
      type,
      content,
      ...relatedData,
    })

    await notification.save()
    await notification.populate("user", "username email")

    // Send real-time notification via WebSocket
    emitToUser(userId, "new-notification", notification)

    return notification
  } catch (err) {
    console.error("Create notification error:", err)
    throw err
  }
}

// Send comprehensive notification (email + in-app + real-time)
export const sendComprehensiveNotification = async (userId, userEmail, type, content, emailTemplateType, emailData) => {
  try {
    const results = await Promise.allSettled([
      // Create in-app notification
      createNotification(userId, type, content),
      // Send email notification
      sendEmailNotification(userEmail, emailTemplateType, emailData),
    ])

    const inAppResult = results[0]
    const emailResult = results[1]

    return {
      inApp: inAppResult.status === "fulfilled" ? inAppResult.value : null,
      email: emailResult.status === "fulfilled" ? emailResult.value : null,
      errors: results.filter((result) => result.status === "rejected").map((result) => result.reason),
    }
  } catch (err) {
    console.error("Comprehensive notification error:", err)
    throw err
  }
}

// Notification handlers for different events
export const notificationHandlers = {
  supportRequestCreated: async (request, customer) => {
    await sendComprehensiveNotification(
      customer._id,
      customer.email,
      "support_request",
      `Your support request ${request.requestId} has been created`,
      "supportRequestCreated",
      {
        customerName: customer.username,
        requestId: request.requestId,
        title: request.title,
        category: request.category,
        priority: request.priority,
        status: request.status,
      },
    )
  },

  supportRequestAssigned: async (request, customer, technician) => {
    await Promise.all([
      // Notify customer
      sendComprehensiveNotification(
        customer._id,
        customer.email,
        "support_request",
        `Technician ${technician.username} has been assigned to your request ${request.requestId}`,
        "supportRequestAssigned",
        {
          customerName: customer.username,
          requestId: request.requestId,
          technicianName: technician.username,
          specialization: technician.specialization?.join(", ") || "General",
          estimatedResolutionTime: request.estimatedResolutionTime || 24,
        },
      ),
      // Notify technician
      createNotification(
        technician._id,
        "support_request",
        `You have been assigned to support request ${request.requestId}`,
      ),
    ])
  },

  supportRequestResolved: async (request, customer, technician) => {
    const resolutionTime = request.resolvedAt
      ? Math.round((request.resolvedAt - request.createdAt) / (1000 * 60 * 60))
      : 0

    await sendComprehensiveNotification(
      customer._id,
      customer.email,
      "support_request",
      `Your support request ${request.requestId} has been resolved`,
      "supportRequestResolved",
      {
        customerName: customer.username,
        requestId: request.requestId,
        technicianName: technician.username,
        resolutionTime,
        ratingUrl: `${process.env.CLIENT_URL}/requests/${request.requestId}/rating`,
      },
    )
  },

  newMessage: async (message, request, sender, recipient) => {
    await Promise.all([
      // In-app notification
      createNotification(
        recipient._id,
        "message",
        `New message from ${sender.username} in request ${request.requestId}`,
      ),
      // Email notification
      sendEmailNotification(recipient.email, "newMessage", {
        recipientName: recipient.username,
        requestId: request.requestId,
        senderName: sender.username,
        messageContent: message.content.substring(0, 200) + (message.content.length > 200 ? "..." : ""),
        chatUrl: `${process.env.CLIENT_URL}/requests/${request.requestId}/chat`,
      }),
    ])
  },

  appointmentScheduled: async (appointment, client, technician) => {
    await Promise.all([
      // Notify client
      sendComprehensiveNotification(
        client._id,
        client.email,
        "appointment",
        `Appointment scheduled with ${technician.username}`,
        "appointmentScheduled",
        {
          clientName: client.username,
          appointmentDate: appointment.startTime.toLocaleString(),
          technicianName: technician.username,
          duration: Math.round((appointment.endTime - appointment.startTime) / (1000 * 60)) + " minutes",
          notes: appointment.notes,
        },
      ),
      // Notify technician
      createNotification(technician._id, "appointment", `New appointment scheduled with ${client.username}`),
    ])
  },

  appointmentReminder: async (appointment, client, technician) => {
    await Promise.all([
      createNotification(
        client._id,
        "appointment",
        `Reminder: Your appointment with ${technician.username} is in 1 hour`,
      ),
      createNotification(
        technician._id,
        "appointment",
        `Reminder: Your appointment with ${client.username} is in 1 hour`,
      ),
    ])
  },
}

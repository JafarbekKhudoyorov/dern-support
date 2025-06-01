import express from "express"
const router = express.Router()

import authRoutes from "./auth.js"
import supportRequestRoutes from "./support-requests.js"
import technicianRoutes from "./technicians.js"
import appointmentRoutes from "./appointments.js"
import serviceRoutes from "./services.js"
import documentRoutes from "./documents.js"
import notificationRoutes from "./notifications.js"
import paymentRoutes from "./payments.js"
import chatRoutes from "./chat.js"
import knowledgeBaseRoutes from "./knowledge-base.js"
import fileUploadRoutes from "./file-upload.js"
import analyticsRoutes from "./analytics.js"
import systemSettingsRoutes from "./system-settings.js"
import auditLogsRoutes from "./audit-logs.js"
import bulkOperationsRoutes from "./bulk-operations.js"
import inventoryRoutes from "./inventory.js"
import jobScheduleRoutes from "./job-schedule.js"
import notificationSettingsRoutes from "./notification-settings.js"
import adminRoutes from "./admin.js"

router.use("/auth", authRoutes)
router.use("/support-requests", supportRequestRoutes)
router.use("/technicians", technicianRoutes)
router.use("/appointments", appointmentRoutes)
router.use("/services", serviceRoutes)
router.use("/documents", documentRoutes)
router.use("/notifications", notificationRoutes)
router.use("/payments", paymentRoutes)
router.use("/chat", chatRoutes)
router.use("/knowledge-base", knowledgeBaseRoutes)
router.use("/files", fileUploadRoutes)
router.use("/analytics", analyticsRoutes)
router.use("/settings", systemSettingsRoutes)
router.use("/audit-logs", auditLogsRoutes)
router.use("/bulk", bulkOperationsRoutes)
router.use("/inventory", inventoryRoutes)
router.use("/jobs", jobScheduleRoutes)
router.use("/notification-settings", notificationSettingsRoutes)
router.use("/admin", adminRoutes)

export default router

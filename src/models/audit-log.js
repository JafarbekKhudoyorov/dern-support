import mongoose from "mongoose"

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "login",
        "logout",
        "create",
        "update",
        "delete",
        "view",
        "assign",
        "unassign",
        "approve",
        "reject",
        "export",
        "import",
      ],
    },
    resource: {
      type: String,
      required: true,
      enum: [
        "user",
        "support-request",
        "appointment",
        "payment",
        "service",
        "notification",
        "knowledge-base",
        "system-settings",
      ],
    },
    resourceId: {
      type: String,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

auditLogSchema.index({ user: 1, timestamp: -1 })
auditLogSchema.index({ action: 1, resource: 1 })
auditLogSchema.index({ timestamp: -1 })
auditLogSchema.index({ resourceType: 1 })


export default mongoose.model("AuditLog", auditLogSchema)

import mongoose from "mongoose"

const supportRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      unique: true,
      required: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
        "technical-support",
        "billing",
        "account-issues",
        "feature-request",
        "bug-report",
        "general-inquiry",
        "legal-consultation",
        "business-consultation",
      ],
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["open", "in-progress", "pending-customer", "resolved", "closed"],
      default: "open",
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedTechnician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    attachments: [
      {
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        url: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    estimatedResolutionTime: {
      type: Number, // in hours
      default: null,
    },
    actualResolutionTime: {
      type: Number, // in hours
      default: null,
    },
    customerSatisfaction: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      feedback: String,
      submittedAt: Date,
    },
    tags: [String],
    isUrgent: {
      type: Boolean,
      default: false,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: Date,
    closedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual for request age in hours
supportRequestSchema.virtual("ageInHours").get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60))
})

// Virtual for response time
supportRequestSchema.virtual("responseTime").get(function () {
  if (this.status === "open") return null
  // Calculate time from creation to first response
  return this.lastActivity ? Math.floor((this.lastActivity - this.createdAt) / (1000 * 60 * 60)) : null
})

// Index for better query performance
supportRequestSchema.index({ customer: 1, status: 1 })
supportRequestSchema.index({ assignedTechnician: 1, status: 1 })
supportRequestSchema.index({ category: 1, priority: 1 })
supportRequestSchema.index({ createdAt: -1 })

// Pre-save middleware to update lastActivity
supportRequestSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.lastActivity = new Date()
  }
  next()
})

export default mongoose.model("SupportRequest", supportRequestSchema)

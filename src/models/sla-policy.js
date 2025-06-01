import mongoose from "mongoose"

const slaPolicySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    priority: {
      type: String,
      required: true,
      enum: ["low", "medium", "high", "urgent"],
    },
    category: {
      type: String,
      required: true,
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
    responseTime: {
      type: Number, // in minutes
      required: true,
    },
    resolutionTime: {
      type: Number, // in minutes
      required: true,
    },
    escalationTime: {
      type: Number, // in minutes
      required: true,
    },
    businessHoursOnly: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

export default mongoose.model("SLAPolicy", slaPolicySchema)

import mongoose from "mongoose"

const appointmentSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value > this.startTime
        },
        message: "End time must be after start time",
      },
    },
    status: {
      type: String,
      enum: ["scheduled", "in-progress", "completed", "canceled", "no-show"],
      default: "scheduled",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    serviceType: {
      type: String,
      enum: ["consultation", "repair", "installation", "maintenance", "troubleshooting", "emergency"],
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    estimatedDuration: {
      type: Number, // in minutes
      min: 15,
      max: 480, // 8 hours max
    },
    actualDuration: {
      type: Number, // in minutes
    },
    cost: {
      type: Number,
      min: 0,
    },
    location: {
      address: String,
      city: String,
      state: String,
      zipCode: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    cancellationReason: {
      type: String,
      maxlength: 500,
    },
    completionNotes: {
      type: String,
      maxlength: 1000,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual for appointment duration
appointmentSchema.virtual("duration").get(function () {
  if (this.startTime && this.endTime) {
    return Math.round((this.endTime - this.startTime) / (1000 * 60)) // in minutes
  }
  return null
})

// Virtual for checking if appointment is upcoming
appointmentSchema.virtual("isUpcoming").get(function () {
  return this.startTime > new Date() && this.status === "scheduled"
})

// Virtual for checking if appointment is overdue
appointmentSchema.virtual("isOverdue").get(function () {
  return this.endTime < new Date() && this.status === "scheduled"
})

// Indexes for better query performance
appointmentSchema.index({ technician: 1, startTime: 1 })
appointmentSchema.index({ client: 1, startTime: 1 })
appointmentSchema.index({ status: 1, startTime: 1 })
appointmentSchema.index({ startTime: 1, endTime: 1 })

export default mongoose.model("Appointment", appointmentSchema)

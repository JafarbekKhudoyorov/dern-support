import mongoose from "mongoose"

const jobScheduleSchema = new mongoose.Schema(
    {
        jobId: {
            type: String,
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 1000,
        },
        jobType: {
            type: String,
            enum: ["maintenance", "installation", "repair", "consultation", "inspection", "emergency"],
            required: true,
        },
        priority: {
            type: String,
            enum: ["low", "medium", "high", "urgent"],
            default: "medium",
        },
        status: {
            type: String,
            enum: ["scheduled", "in-progress", "completed", "cancelled", "postponed"],
            default: "scheduled",
        },
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        assignedTechnician: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        scheduledDate: {
            type: Date,
            required: true,
        },
        estimatedDuration: {
            type: Number, // in minutes
            required: true,
            min: 15,
        },
        actualStartTime: {
            type: Date,
        },
        actualEndTime: {
            type: Date,
        },
        location: {
            address: {
                type: String,
                required: true,
                trim: true,
            },
            city: {
                type: String,
                required: true,
                trim: true,
            },
            state: {
                type: String,
                trim: true,
            },
            zipCode: {
                type: String,
                trim: true,
            },
            coordinates: {
                lat: Number,
                lng: Number,
            },
        },
        requiredSkills: [
            {
                type: String,
                trim: true,
            },
        ],
        requiredInventory: [
            {
                item: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Inventory",
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 1,
                },
            },
        ],
        serviceType: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service",
        },
        relatedSupportRequest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SupportRequest",
        },
        notes: {
            type: String,
            trim: true,
            maxlength: 1000,
        },
        completionNotes: {
            type: String,
            trim: true,
            maxlength: 1000,
        },
        customerSignature: {
            type: String, // Base64 encoded signature
        },
        photos: [
            {
                url: String,
                filename: String,
                description: String,
                uploadedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        timeTracking: {
            clockIn: Date,
            clockOut: Date,
            breaks: [
                {
                    start: Date,
                    end: Date,
                    reason: String,
                },
            ],
        },
        billing: {
            laborHours: {
                type: Number,
                default: 0,
            },
            laborRate: {
                type: Number,
                default: 0,
            },
            materialCost: {
                type: Number,
                default: 0,
            },
            totalCost: {
                type: Number,
                default: 0,
            },
        },
    },
    {
        timestamps: true,
    },
)

jobScheduleSchema.index({ jobId: 1 })
jobScheduleSchema.index({ assignedTechnician: 1 })
jobScheduleSchema.index({ customer: 1 })
jobScheduleSchema.index({ scheduledDate: 1 })
jobScheduleSchema.index({ status: 1 })

export default mongoose.model("JobSchedule", jobScheduleSchema)

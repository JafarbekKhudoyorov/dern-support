import mongoose from "mongoose"

const messageSchema = new mongoose.Schema(
  {
    supportRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportRequest",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: [true, "Message content is required"],
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
    messageType: {
      type: String,
      enum: ["text", "file", "system", "status-update"],
      default: "text",
    },
    attachments: [
      {
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        url: String,
      },
    ],
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
    editedAt: Date,
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

// Index for better query performance
messageSchema.index({ supportRequest: 1, createdAt: -1 })
messageSchema.index({ sender: 1, createdAt: -1 })

export default mongoose.model("Message", messageSchema)

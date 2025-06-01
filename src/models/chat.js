import mongoose from "mongoose"

const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    supportRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportRequest",
      required: true,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    chatType: {
      type: String,
      enum: ["support", "consultation", "group"],
      default: "support",
    },
  },
  {
    timestamps: true,
  },
)

chatSchema.index({ participants: 1 })
chatSchema.index({ supportRequest: 1 })

export default mongoose.model("Chat", chatSchema)

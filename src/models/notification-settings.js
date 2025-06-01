import mongoose from "mongoose"

const notificationSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    emailNotifications: {
      enabled: {
        type: Boolean,
        default: true,
      },
      supportRequests: {
        type: Boolean,
        default: true,
      },
      appointments: {
        type: Boolean,
        default: true,
      },
      messages: {
        type: Boolean,
        default: true,
      },
      systemUpdates: {
        type: Boolean,
        default: false,
      },
      marketing: {
        type: Boolean,
        default: false,
      },
    },
    pushNotifications: {
      enabled: {
        type: Boolean,
        default: false,
      },
      endpoint: String,
      keys: {
        p256dh: String,
        auth: String,
      },
      supportRequests: {
        type: Boolean,
        default: true,
      },
      appointments: {
        type: Boolean,
        default: true,
      },
      messages: {
        type: Boolean,
        default: true,
      },
    },
    smsNotifications: {
      enabled: {
        type: Boolean,
        default: false,
      },
      phoneNumber: {
        type: String,
        trim: true,
      },
      urgentOnly: {
        type: Boolean,
        default: true,
      },
    },
    inAppNotifications: {
      enabled: {
        type: Boolean,
        default: true,
      },
      sound: {
        type: Boolean,
        default: true,
      },
      desktop: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  },
)

export default mongoose.model("NotificationSettings", notificationSettingsSchema)

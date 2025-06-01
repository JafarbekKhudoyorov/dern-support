import mongoose from "mongoose"

const fileUploadSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    relatedTo: {
      resourceType: {
        type: String,
        enum: ["support-request", "user", "knowledge-base", "message"],
      },
      resourceId: {
        type: mongoose.Schema.Types.ObjectId,
      },
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

fileUploadSchema.index({ uploadedBy: 1 })
fileUploadSchema.index({ "relatedTo.resourceType": 1, "relatedTo.resourceId": 1 })

export default mongoose.model("FileUpload", fileUploadSchema)

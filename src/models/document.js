import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    supportRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportRequest",
      required: true,
    },
    uploader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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
    url: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

documentSchema.index({ supportRequest: 1, createdAt: -1 });

export default mongoose.model("Document", documentSchema);

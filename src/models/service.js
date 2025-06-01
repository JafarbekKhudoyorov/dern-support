import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    duration: {
      type: Number, // in minutes
      required: true,
      min: 15,
    },
    category: {
      type: String,
      required: true,
      enum: ["legal", "technical", "consultation", "other"],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Service", serviceSchema);

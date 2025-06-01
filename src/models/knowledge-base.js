import mongoose from "mongoose";

const knowledgeBaseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
    },
    excerpt: {
      type: String,
      maxlength: 300,
    },
    category: {
      type: String,
      required: true,
      enum: ["technical", "billing", "account", "general", "legal", "business"],
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    views: {
      type: Number,
      default: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    featuredImage: {
      type: String,
    },
    relatedArticles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "KnowledgeBase",
      },
    ],
    difficulty: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "Beginner",
    },
    readTime: {
      type: Number, // Minutes
    },
  },
  {
    timestamps: true,
  }
);

knowledgeBaseSchema.index({ title: "text", content: "text", tags: "text" });
knowledgeBaseSchema.index({ category: 1 });
knowledgeBaseSchema.index({ isPublished: 1 });
knowledgeBaseSchema.index({ views: -1 });

// Generate excerpt and readTime from content if not provided
knowledgeBaseSchema.pre("save", function (next) {
  if (!this.excerpt && this.content) {
    this.excerpt = this.content.replace(/[#*>\-`]/g, "").trim().substring(0, 297) + "...";
  }
  if (!this.readTime && this.content) {
    const words = this.content.split(/\s+/).length;
    this.readTime = Math.ceil(words / 200); // Assuming 200 words per minute
  }
  next();
});

export default mongoose.model("KnowledgeBase", knowledgeBaseSchema);
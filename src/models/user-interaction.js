import mongoose from "mongoose";

const userInteractionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        article: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "KnowledgeBase",
            required: true,
        },
        liked: {
            type: Boolean,
            default: false,
        },
        disliked: {
            type: Boolean,
            default: false,
        },
        bookmarked: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Ensure unique interaction per user and article
userInteractionSchema.index({ user: 1, article: 1 }, { unique: true });

export default mongoose.model("UserInteraction", userInteractionSchema);
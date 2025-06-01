import express from "express";
import Joi from "joi";
import KnowledgeBase from "../models/knowledge-base.js";
import UserInteraction from "../models/user-interaction.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireAdmin, requireTechnician } from "../middlewares/authorize.js";
import { createAuditLog } from "../utils/audit.js";

const router = express.Router();

const createArticleSchema = Joi.object({
  title: Joi.string().min(5).max(200).required(),
  content: Joi.string().min(10).required(),
  category: Joi.string().valid("technical", "billing", "account", "general", "legal", "business").required(),
  tags: Joi.array().items(Joi.string()).max(10),
  isPublished: Joi.boolean().default(false),
});

const updateArticleSchema = Joi.object({
  title: Joi.string().min(5).max(200),
  content: Joi.string().min(10),
  category: Joi.string().valid("technical", "billing", "account", "general", "legal", "business"),
  tags: Joi.array().items(Joi.string()).max(10),
  isPublished: Joi.boolean(),
});

const interactionSchema = Joi.object({
  liked: Joi.boolean().optional(),
  disliked: Joi.boolean().optional(),
  bookmarked: Joi.boolean().optional(),
});

// Create knowledge base article
router.post("/", authenticate, requireTechnician, async (req, res) => {
  try {
    const { error, value } = createArticleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      });
    }

    const article = new KnowledgeBase({
      ...value,
      author: req.user.userId,
    });

    await article.save();
    await article.populate("author", "username email");

    await createAuditLog(req.user.userId, "create", "knowledge-base", article._id, value, req);

    res.status(201).json({
      message: "Article created successfully",
      article,
    });
  } catch (err) {
    console.error("Create article error:", err);
    res.status(500).json({ message: "Error creating article" });
  }
});

// Get published articles (public)
router.get("/", async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1;
    const limit = Number.parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { isPublished: true };

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    if (req.query.tags) {
      filter.tags = { $in: req.query.tags.split(",") };
    }

    const articles = await KnowledgeBase.find(filter)
      .populate("author", "username")
      .select("-content")
      .sort({ views: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await KnowledgeBase.countDocuments(filter);

    res.json({
      articles,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("Get articles error:", err);
    res.status(500).json({ message: "Error fetching articles" });
  }
});

// Get all articles (admin/technician)
router.get("/admin", authenticate, requireTechnician, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1;
    const limit = Number.parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.isPublished !== undefined) {
      filter.isPublished = req.query.isPublished === "true";
    }

    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    const articles = await KnowledgeBase.find(filter)
      .populate("author", "username email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await KnowledgeBase.countDocuments(filter);

    res.json({
      articles,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("Get admin articles error:", err);
    res.status(500).json({ message: "Error fetching articles" });
  }
});

// Get single article
router.get("/:articleId", async (req, res) => {
  try {
    const article = await KnowledgeBase.findById(req.params.articleId).populate("author", "username email");

    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    if (!article.isPublished && (!req.user || req.user.role === "customer")) {
      return res.status(404).json({ message: "Article not found" });
    }

    // Increment view count
    article.views += 1;
    await article.save();

    // Aggregate like and dislike counts
    const interactions = await UserInteraction.aggregate([
      { $match: { article: article._id } },
      {
        $group: {
          _id: null,
          likes: { $sum: { $cond: [{ $eq: ["$liked", true] }, 1, 0] } },
          dislikes: { $sum: { $cond: [{ $eq: ["$disliked", true] }, 1, 0] } },
        },
      },
    ]);

    // Get user interaction if authenticated
    let userInteraction = null;
    if (req.user) {
      userInteraction = await UserInteraction.findOne({
        user: req.user.userId,
        article: article._id,
      });
    }

    res.json({
      article: {
        ...article.toObject(),
        likes: interactions[0]?.likes || 0,
        dislikes: interactions[0]?.dislikes || 0,
        userInteraction: userInteraction
          ? {
            liked: userInteraction.liked,
            disliked: userInteraction.disliked,
            bookmarked: userInteraction.bookmarked,
          }
          : null,
      },
    });
  } catch (err) {
    console.error("Get article error:", err);
    res.status(500).json({ message: "Error fetching article" });
  }
});

// Update article
router.put("/:articleId", authenticate, requireTechnician, async (req, res) => {
  try {
    const { error, value } = updateArticleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      });
    }

    const article = await KnowledgeBase.findById(req.params.articleId);
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    // Check permissions
    if (req.user.role !== "admin" && article.author.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    Object.assign(article, value);
    article.lastUpdated = new Date();
    await article.save();

    await article.populate("author", "username email");

    await createAuditLog(req.user.userId, "update", "knowledge-base", article._id, value, req);

    res.json({
      message: "Article updated successfully",
      article,
    });
  } catch (err) {
    console.error("Update article error:", err);
    res.status(500).json({ message: "Error updating article" });
  }
});

// Delete article
router.delete("/:articleId", authenticate, requireAdmin, async (req, res) => {
  try {
    const article = await KnowledgeBase.findByIdAndDelete(req.params.articleId);
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    // Delete associated interactions
    await UserInteraction.deleteMany({ article: article._id });

    await createAuditLog(req.user.userId, "delete", "knowledge-base", article._id, {}, req);

    res.json({ message: "Article deleted successfully" });
  } catch (err) {
    console.error("Delete article error:", err);
    res.status(500).json({ message: "Error deleting article" });
  }
});

// Handle user interaction (like, dislike, bookmark)
router.post("/:articleId/interaction", authenticate, async (req, res) => {
  try {
    const { error, value } = interactionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      });
    }

    const article = await KnowledgeBase.findById(req.params.articleId);
    if (!article || !article.isPublished) {
      return res.status(404).json({ message: "Article not found" });
    }

    // Find or create user interaction
    let interaction = await UserInteraction.findOne({
      user: req.user.userId,
      article: article._id,
    });

    if (!interaction) {
      interaction = new UserInteraction({
        user: req.user.userId,
        article: article._id,
        ...value,
      });
    } else {
      // Ensure mutually exclusive like/dislike
      if (value.liked !== undefined) {
        interaction.liked = value.liked;
        if (value.liked) interaction.disliked = false;
      }
      if (value.disliked !== undefined) {
        interaction.disliked = value.disliked;
        if (value.disliked) interaction.liked = false;
      }
      if (value.bookmarked !== undefined) {
        interaction.bookmarked = value.bookmarked;
      }
    }

    await interaction.save();

    // Aggregate updated like and dislike counts
    const interactions = await UserInteraction.aggregate([
      { $match: { article: article._id } },
      {
        $group: {
          _id: null,
          likes: { $sum: { $cond: [{ $eq: ["$liked", true] }, 1, 0] } },
          dislikes: { $sum: { $cond: [{ $eq: ["$disliked", true] }, 1, 0] } },
        },
      },
    ]);

    await createAuditLog(
      req.user.userId,
      "update",
      "user-interaction",
      interaction._id,
      value,
      req
    );

    res.json({
      message: "Interaction updated successfully",
      interaction: {
        liked: interaction.liked,
        disliked: interaction.disliked,
        bookmarked: interaction.bookmarked,
      },
      likes: interactions[0]?.likes || 0,
      dislikes: interactions[0]?.dislikes || 0,
    });
  } catch (err) {
    console.error("Submit interaction error:", err);
    res.status(500).json({ message: "Error submitting interaction" });
  }
});

// Get categories
router.get("/meta/categories", async (req, res) => {
  try {
    const categories = await KnowledgeBase.distinct("category", { isPublished: true });
    res.json({ categories });
  } catch (err) {
    console.error("Get categories error:", err);
    res.status(500).json({ message: "Error fetching categories" });
  }
});

// Get popular tags
router.get("/meta/tags", async (req, res) => {
  try {
    const pipeline = [
      { $match: { isPublished: true } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ];

    const tags = await KnowledgeBase.aggregate(pipeline);
    res.json({ tags: tags.map((tag) => tag._id) });
  } catch (err) {
    console.error("Get tags error:", err);
    res.status(500).json({ message: "Error fetching tags" });
  }
});

export default router;
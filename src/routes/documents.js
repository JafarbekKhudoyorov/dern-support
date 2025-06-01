import express from "express";
import Joi from "joi";
import Document from "../models/document.js";
import SupportRequest from "../models/support-request.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireCustomer } from "../middlewares/authorize.js";

const router = express.Router();

// Validation schema
const uploadDocumentSchema = Joi.object({
  filename: Joi.string().required(),
  originalName: Joi.string().required(),
  mimetype: Joi.string().required(),
  size: Joi.number().min(1).required(),
  url: Joi.string().uri().required(),
});

// Upload document to a support request
router.post("/support-requests/:requestId/documents", authenticate, requireCustomer, async (req, res) => {
  try {
    const { error, value } = uploadDocumentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        details: error.details.map((detail) => detail.message),
      });
    }

    const request = await SupportRequest.findOne({ requestId: req.params.requestId });
    if (!request) {
      return res.status(404).json({ message: "Support request not found" });
    }

    if (request.customer.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const document = new Document({
      ...value,
      supportRequest: request._id,
      uploader: req.user.userId,
    });

    await document.save();
    await document.populate("uploader", "username email");

    // Add to support request attachments
    request.attachments.push({
      filename: value.filename,
      originalName: value.originalName,
      mimetype: value.mimetype,
      size: value.size,
      url: value.url,
      uploadedAt: new Date(),
    });
    await request.save();

    console.log(`Document uploaded for request ${req.params.requestId} by ${req.user.email}`);

    res.status(201).json({
      message: "Document uploaded successfully",
      document,
    });
  } catch (err) {
    console.error("Upload document error:", err);
    res.status(500).json({ message: "Error uploading document" });
  }
});

// List documents for a support request
router.get("/support-requests/:requestId/documents", authenticate, async (req, res) => {
  try {
    const request = await SupportRequest.findOne({ requestId: req.params.requestId });
    if (!request) {
      return res.status(404).json({ message: "Support request not found" });
    }

    if (
      req.user.role !== "admin" &&
      request.customer.toString() !== req.user.userId &&
      request.assignedTechnician?.toString() !== req.user.userId
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const documents = await Document.find({ supportRequest: request._id })
      .populate("uploader", "username email")
      .sort({ createdAt: -1 });

    res.json({ documents });
  } catch (err) {
    console.error("Get documents error:", err);
    res.status(500).json({ message: "Error fetching documents" });
  }
});

export default router;

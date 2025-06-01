import express from "express"
import multer from "multer"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"
import FileUpload from "../models/file-upload.js"
import { authenticate } from "../middlewares/authenticate.js"
import { createAuditLog } from "../utils/audit.js"

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../../uploads")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(uploadsDir, req.user.userId)
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true })
    }
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname))
  },
})

const fileFilter = (req, file, cb) => {
  // Allow specific file types
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ]

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error("Invalid file type"), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
})

// Upload single file
router.post("/single", authenticate, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" })
    }

    const fileUpload = new FileUpload({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      url: `/uploads/${req.user.userId}/${req.file.filename}`,
      uploadedBy: req.user.userId,
      relatedTo: {
        resourceType: req.body.resourceType,
        resourceId: req.body.resourceId,
      },
      isPublic: req.body.isPublic === "true",
    })

    await fileUpload.save()

    await createAuditLog(
      req.user.userId,
      "create",
      "file-upload",
      fileUpload._id,
      {
        filename: req.file.originalname,
        size: req.file.size,
      },
      req,
    )

    res.status(201).json({
      message: "File uploaded successfully",
      file: fileUpload,
    })
  } catch (err) {
    console.error("File upload error:", err)
    res.status(500).json({ message: "Error uploading file" })
  }
})

// Upload multiple files
router.post("/multiple", authenticate, upload.array("files", 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" })
    }

    const uploadedFiles = []

    for (const file of req.files) {
      const fileUpload = new FileUpload({
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
        url: `/uploads/${req.user.userId}/${file.filename}`,
        uploadedBy: req.user.userId,
        relatedTo: {
          resourceType: req.body.resourceType,
          resourceId: req.body.resourceId,
        },
        isPublic: req.body.isPublic === "true",
      })

      await fileUpload.save()
      uploadedFiles.push(fileUpload)
    }

    await createAuditLog(
      req.user.userId,
      "create",
      "file-upload",
      null,
      {
        filesCount: req.files.length,
        totalSize: req.files.reduce((sum, file) => sum + file.size, 0),
      },
      req,
    )

    res.status(201).json({
      message: "Files uploaded successfully",
      files: uploadedFiles,
    })
  } catch (err) {
    console.error("Multiple file upload error:", err)
    res.status(500).json({ message: "Error uploading files" })
  }
})

// Get user's files
router.get("/", authenticate, async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const filter = { uploadedBy: req.user.userId }

    if (req.query.resourceType) {
      filter["relatedTo.resourceType"] = req.query.resourceType
    }

    if (req.query.resourceId) {
      filter["relatedTo.resourceId"] = req.query.resourceId
    }

    const files = await FileUpload.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)

    const total = await FileUpload.countDocuments(filter)

    res.json({
      files,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("Get files error:", err)
    res.status(500).json({ message: "Error fetching files" })
  }
})

// Download file
router.get("/:fileId/download", authenticate, async (req, res) => {
  try {
    const file = await FileUpload.findById(req.params.fileId)
    if (!file) {
      return res.status(404).json({ message: "File not found" })
    }

    // Check permissions
    if (file.uploadedBy.toString() !== req.user.userId && !file.isPublic && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" })
    }

    if (!fs.existsSync(file.path)) {
      return res.status(404).json({ message: "File not found on disk" })
    }

    // Increment download count
    file.downloadCount += 1
    await file.save()

    res.download(file.path, file.originalName)
  } catch (err) {
    console.error("Download file error:", err)
    res.status(500).json({ message: "Error downloading file" })
  }
})

// Delete file
router.delete("/:fileId", authenticate, async (req, res) => {
  try {
    const file = await FileUpload.findById(req.params.fileId)
    if (!file) {
      return res.status(404).json({ message: "File not found" })
    }

    // Check permissions
    if (file.uploadedBy.toString() !== req.user.userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" })
    }

    // Delete file from disk
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path)
    }

    await FileUpload.findByIdAndDelete(req.params.fileId)

    await createAuditLog(
      req.user.userId,
      "delete",
      "file-upload",
      file._id,
      {
        filename: file.originalName,
      },
      req,
    )

    res.json({ message: "File deleted successfully" })
  } catch (err) {
    console.error("Delete file error:", err)
    res.status(500).json({ message: "Error deleting file" })
  }
})

// Serve uploaded files
router.get("/serve/:userId/:filename", async (req, res) => {
  try {
    const filePath = path.join(uploadsDir, req.params.userId, req.params.filename)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" })
    }

    // Find file in database to check permissions
    const file = await FileUpload.findOne({
      filename: req.params.filename,
      uploadedBy: req.params.userId,
    })

    if (!file) {
      return res.status(404).json({ message: "File not found" })
    }

    // Check if file is public or user has access
    if (
      !file.isPublic &&
      (!req.user || (req.user.userId !== file.uploadedBy.toString() && req.user.role !== "admin"))
    ) {
      return res.status(403).json({ message: "Access denied" })
    }

    res.sendFile(filePath)
  } catch (err) {
    console.error("Serve file error:", err)
    res.status(500).json({ message: "Error serving file" })
  }
})

export default router

import dotenv from "dotenv"
dotenv.config()

import express from "express"
import jwt from "jsonwebtoken"
import nodemailer from "nodemailer"
import crypto from "crypto"
import Joi from "joi"
import User from "../models/user.js"
import { authenticate } from "../middlewares/authenticate.js"
import { authorize } from "../middlewares/authorize.js"
import multer from "multer"
import path from "path"
import fs from "fs"
import { createAuditLog } from "../utils/audit.js"

const router = express.Router()

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, "../../uploads", req.user.userId)
        fs.mkdirSync(uploadDir, { recursive: true })
        cb(null, uploadDir)
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname)
        cb(null, "profile-picture" + "-" + Date.now() + ext)
    },
})

const upload = multer({ storage: storage })

// Validation schemas (unchanged except for adding activationTokenSchema)
const registerSchema = Joi.object({
    username: Joi.string().min(3).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    accountType: Joi.string().valid("individual", "business").default("individual"),
    companyName: Joi.string().when("accountType", {
        is: "business",
        then: Joi.required(),
        otherwise: Joi.optional(),
    }),
    phone: Joi.string()
        .pattern(/^[+]?[1-9][\d]{0,15}$/)
        .required(),
    address: Joi.string().min(10).required(),
    marketingEmails: Joi.boolean().default(false),
})

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
})

const forgotPasswordSchema = Joi.object({
    email: Joi.string().email().required(),
})

const resetPasswordSchema = Joi.object({
    password: Joi.string().min(6).required(),
})

const updateProfileSchema = Joi.object({
    username: Joi.string().min(3).max(50),
    phone: Joi.string().pattern(/^[+]?[1-9][\d]{0,15}$/),
    address: Joi.string().min(10),
    companyName: Joi.string().when(Joi.ref("$accountType"), {
        is: "business",
        then: Joi.optional(),
        otherwise: Joi.forbidden(),
    }),
});

const activationTokenSchema = Joi.object({
    token: Joi.string().required(),
})

// Helper functions (unchanged except for adding sendActivationEmail)
const generateTokens = (user) => {
    const accessToken = jwt.sign(
        {
            userId: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            accountType: user.accountType,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" },
    )

    const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" })

    return { accessToken, refreshToken }
}

const setRefreshTokenCookie = (res, refreshToken) => {
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/",
    })
}

// Helper function to send activation email
const sendActivationEmail = async (user, activationToken) => {
    const transporter = nodemailer.createTransport({
        host: process.env.GMAIL_HOST || "smtp.gmail.com",
        port: Number.parseInt(process.env.GMAIL_PORT) || 587,
        secure: process.env.GMAIL_SECURE === "true",
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS,
        },
        tls: {
            rejectUnauthorized: false,
        },
    })

    await transporter.verify()

    const activationUrl = `${process.env.CLIENT_URL}/api/v1/auth/activate/${activationToken}`
    const mailOptions = {
        to: user.email,
        from: process.env.GMAIL_FROM || "Dern Support <noreply@dern-support.com>",
        subject: "Activate Your Dern Support Account",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1e40af;">Welcome to Dern Support!</h2>
                <p>Hello ${user.username},</p>
                <p>Thank you for registering with Dern Support. Please click the button below to activate your account:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${activationUrl}" style="background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Activate Account</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #6b7280;">${activationUrl}</p>
                <p><strong>This link will expire in 24 hours.</strong></p>
                <p>If you didn't create this account, please ignore this email.</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 14px;">
                    Best regards,<br>
                    The Dern Support Team
                </p>
            </div>
        `,
    }

    const info = await transporter.sendMail(mailOptions)
    console.log(`Activation email sent to: ${user.email}, Message ID: ${info.messageId}`)
}

// Register endpoint (modified to include activation token and email)
router.post("/register", async (req, res) => {
    try {
        // Validate input
        const { error, value } = registerSchema.validate(req.body)
        if (error) {
            return res.status(400).json({
                message: "Validation error",
                details: error.details.map((detail) => detail.message),
            })
        }

        const { username, email, password, accountType, companyName, phone, address, marketingEmails } = value

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }],
        })

        if (existingUser) {
            return res.status(409).json({
                message:
                    existingUser.email === email ? "An account with this email already exists" : "Username is already taken",
            })
        }

        // Generate activation token
        const activationToken = crypto.randomBytes(32).toString("hex")

        // Create user data
        const userData = {
            username,
            email,
            passwordHash: password,
            accountType,
            phone,
            address,
            marketingEmails,
            isActive: false, // Explicitly set to false
            activationToken,
            activationTokenExpires: Date.now() + 24 * 3600000, // 24 hours
        }

        // Add company name for business accounts
        if (accountType === "business" && companyName) {
            userData.companyName = companyName
        }

        // Create and save user
        const user = new User(userData)
        await user.save()

        // Send activation email
        await sendActivationEmail(user, activationToken)

        // Log registration
        console.log(`New ${accountType} account registered: ${email}, awaiting activation`)

        res.status(201).json({
            message: "Account created successfully. Please check your email to activate your account.",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                accountType: user.accountType,
                companyName: user.companyName,
            },
        })
    } catch (err) {
        console.error("Registration error:", err)

        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern)[0]
            return res.status(409).json({
                message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
            })
        }

        res.status(500).json({
            message: "Error creating account",
            error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
        })
    }
})

router.get("/activate/:token", async (req, res) => {
    try {
        const { token } = req.params
        console.log(`[${new Date().toISOString()}] Activation attempt with token: ${token}`)

        // Validate token
        const { error } = activationTokenSchema.validate({ token })
        if (error) {
            console.log(
                `[${new Date().toISOString()}] Token validation error: ${error.details.map((d) => d.message).join(", ")}`,
            )
            return res.status(400).json({
                message: "Invalid activation token",
            })
        }

        // Find user
        const user = await User.findOne({
            activationToken: token,
            activationTokenExpires: { $gt: Date.now() },
        })

        if (!user) {
            console.log(`[${new Date().toISOString()}] No user found with token: ${token} or token expired`)
            return res.status(400).json({
                message: "Invalid or expired activation token",
            })
        }

        console.log(`[${new Date().toISOString()}] User found: ${user.email}, isActive: ${user.isActive}`)

        // Activate user
        user.isActive = true
        user.activationToken = undefined
        user.activationTokenExpires = undefined
        await user.save()

        console.log(`[${new Date().toISOString()}] User activated successfully: ${user.email}`)

        res.redirect(`${process.env.CLIENT_URL}/login?activated=true`)
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Activation error for token ${req.params.token}:`, err)
        res.status(500).json({
            message: "Error activating account",
            error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
        })
    }
})

// Resend activation email
router.post("/resend-activation", async (req, res) => {
    try {
        const { error, value } = forgotPasswordSchema.validate(req.body) // Reuse email schema
        if (error) {
            return res.status(400).json({
                message: "Please provide a valid email",
            })
        }

        const { email } = value

        // Find user
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(404).json({
                message: "No account found with this email",
            })
        }

        if (user.isActive) {
            return res.status(400).json({
                message: "Account is already activated",
            })
        }

        // Generate new activation token
        const activationToken = crypto.randomBytes(32).toString("hex")
        user.activationToken = activationToken
        user.activationTokenExpires = Date.now() + 24 * 3600000 // 24 hours
        await user.save()

        // Send activation email
        await sendActivationEmail(user, activationToken)

        console.log(`Activation email resent to: ${email}`)

        res.json({
            message: "Activation email resent. Please check your email.",
        })
    } catch (err) {
        console.error("Resend activation error:", err)
        res.status(500).json({
            message: "Error resending activation email",
            error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
        })
    }
})

// Login endpoint (modified to provide specific error for inactive accounts)
router.post("/login", async (req, res) => {
    try {
        // Validate input
        const { error, value } = loginSchema.validate(req.body)
        if (error) {
            return res.status(400).json({
                message: "Please provide valid email and password",
            })
        }

        const { email, password } = value

        // Find user
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password",
            })
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json({
                message: "Account not activated. Please check your email for the activation link.",
            })
        }

        // Verify password
        const isPasswordValid = await user.verifyPassword(password)
        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Invalid email or password",
            })
        }

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user)

        // Set refresh token cookie
        setRefreshTokenCookie(res, refreshToken)

        // Log successful login
        console.log(`User logged in: ${email} (${user.role})`)

        res.json({
            message: "Login successful",
            accessToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                accountType: user.accountType,
                companyName: user.companyName,
                phone: user.phone,
                address: user.address,
            },
        })
    } catch (err) {
        console.error("Login error:", err)
        res.status(500).json({
            message: "Error during login",
            error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
        })
    }
})

// Refresh token endpoint
router.post("/refresh", async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken

        if (!refreshToken) {
            return res.status(401).json({
                message: "No refresh token provided",
            })
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)

        // Find user
        const user = await User.findById(decoded.userId)
        if (!user || !user.isActive) {
            return res.status(401).json({
                message: "Invalid refresh token",
            })
        }

        // Generate new tokens
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user)

        // Set new refresh token cookie
        setRefreshTokenCookie(res, newRefreshToken)

        res.json({
            accessToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                accountType: user.accountType,
                companyName: user.companyName,
            },
        })
    } catch (err) {
        console.error("Token refresh error:", err)
        res.status(401).json({
            message: "Invalid refresh token",
        })
    }
})

// Logout endpoint
router.post("/logout", authenticate, async (req, res) => {
    try {
        // Clear refresh token cookie
        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
        })

        console.log(`User logged out: ${req.user.email}`)

        res.json({
            message: "Logged out successfully",
        })
    } catch (err) {
        console.error("Logout error:", err)
        res.status(500).json({
            message: "Error during logout",
        })
    }
})

// Get current user profile
router.get("/profile", authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select("-passwordHash -resetPasswordToken -resetPasswordExpires")

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            })
        }

        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                accountType: user.accountType,
                companyName: user.companyName,
                phone: user.phone,
                address: user.address,
                isActive: user.isActive,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        })
    } catch (err) {
        console.error("Profile fetch error:", err)
        res.status(500).json({
            message: "Error fetching profile",
        })
    }
})

// Update user profile
router.put("/profile", authenticate, async (req, res) => {
    try {
        // Fetch user to get accountType
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        // Validate input with dynamic accountType
        const { error, value } = updateProfileSchema.validate(req.body, {
            context: { accountType: user.accountType },
        });
        if (error) {
            return res.status(400).json({
                message: "Validation error",
                details: error.details.map((detail) => detail.message),
            });
        }

        // Check if username is taken by another user
        if (value.username) {
            const existingUser = await User.findOne({
                username: value.username,
                _id: { $ne: req.user.userId },
            });

            if (existingUser) {
                return res.status(409).json({
                    message: "Username is already taken",
                });
            }
        }

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            req.user.userId,
            value,
            { new: true, runValidators: true }
        ).select("-passwordHash -resetPasswordToken -resetPasswordExpires");

        if (!updatedUser) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        console.log(`Profile updated: ${updatedUser.email}`);

        res.json({
            message: "Profile updated successfully",
            user: {
                id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role,
                accountType: updatedUser.accountType,
                companyName: updatedUser.companyName,
                phone: updatedUser.phone,
                address: updatedUser.address,
            },
        });
    } catch (err) {
        console.error("Profile update error:", err);
        res.status(500).json({
            message: "Error updating profile",
        });
    }
});

// Upload profile picture
router.post("/profile/picture", authenticate, upload.single("profilePicture"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" })
        }

        // Validate file type
        const allowedTypes = ["image/jpeg", "image/png", "image/gif"]
        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({ message: "Invalid file type. Only JPEG, PNG, and GIF are allowed" })
        }

        const user = await User.findById(req.user.userId)
        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }

        // Delete old profile picture if exists
        if (user.profilePicture) {
            const oldPath = path.join(__dirname, "../../uploads", user.profilePicture)
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath)
            }
        }

        // Update user profile picture
        user.profilePicture = `/uploads/${req.user.userId}/${req.file.filename}`
        await user.save()

        await createAuditLog(req.user.userId, "update", "user", user._id, { action: "profile-picture-upload" }, req)

        res.json({
            message: "Profile picture updated successfully",
            profilePicture: user.profilePicture,
        })
    } catch (err) {
        console.error("Profile picture upload error:", err)
        res.status(500).json({ message: "Error uploading profile picture" })
    }
})

// Forgot password endpoint
router.post("/forgot-password", async (req, res) => {
    try {
        // Validate input
        const { error, value } = forgotPasswordSchema.validate(req.body)
        if (error) {
            console.error("Validation error:", error.details)
            return res.status(400).json({
                message: "Please provide a valid email address",
            })
        }

        const { email } = value

        // Find user
        const user = await User.findOne({ email, isActive: true })
        if (!user) {
            console.log(`No active user found for email: ${email}`)
            return res.json({
                message: "If an account with that email exists, a password reset link has been sent",
            })
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString("hex")
        user.resetPasswordToken = resetToken
        user.resetPasswordExpires = Date.now() + 3600000 // 1 hour
        await user.save()

        // Configure email transporter
        const transporter = nodemailer.createTransport({
            host: process.env.GMAIL_HOST || "smtp.gmail.com",
            port: Number.parseInt(process.env.GMAIL_PORT) || 587,
            secure: process.env.GMAIL_SECURE === "true", // false for 587, true for 465
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS,
            },
            tls: {
                rejectUnauthorized: false, // Consider removing in production
            },
        })

        // Verify transporter configuration
        await transporter.verify((error, success) => {
            if (error) {
                console.error("Transporter verification failed:", error)
                throw new Error("Email service configuration error")
            }
            console.log("Transporter verified successfully:", success)
        })

        // Send reset email
        const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`
        const mailOptions = {
            to: email,
            from: process.env.GMAIL_FROM || "Dern Support <noreply@dern-support.com>",
            subject: "Password Reset Request - Dern Support",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1e40af;">Password Reset Request</h2>
                    <p>Hello ${user.username},</p>
                    <p>You requested a password reset for your Dern Support account. Click the button below to reset your password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
                    </div>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #6b7280;">${resetUrl}</p>
                    <p><strong>This link will expire in 1 hour.</strong></p>
                    <p>If you didn't request this password reset, please ignore this email.</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px;">
                        Best regards,<br>
                        The Dern Support Team
                    </p>
                </div>
            `,
        }

        const info = await transporter.sendMail(mailOptions)
        console.log(`Password reset email sent to: ${email}, Message ID: ${info.messageId}`)

        res.json({
            message: "If an account with that email exists, a password reset link has been sent",
        })
    } catch (err) {
        console.error("Forgot password error:", {
            message: err.message,
            stack: err.stack,
            code: err.code,
            errno: err.errno,
            syscall: err.syscall,
        })
        // Return 500 for debugging; revert to 200 in production
        return res.status(500).json({
            message: "Error sending password reset email",
            error: process.env.NODE_ENV === "development" ? err.message : undefined,
        })
    }
})

// Reset password endpoint
router.post("/reset-password/:token", async (req, res) => {
    try {
        const { token } = req.params

        // Validate input
        const { error, value } = resetPasswordSchema.validate(req.body)
        if (error) {
            return res.status(400).json({
                message: "Password must be at least 6 characters long",
            })
        }

        const { password } = value

        // Find user with valid reset token
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() },
            isActive: true,
        })

        if (!user) {
            return res.status(400).json({
                message: "Invalid or expired reset token",
            })
        }

        // Update password and clear reset token
        user.passwordHash = password // Will be hashed by pre-save middleware
        user.resetPasswordToken = undefined
        user.resetPasswordExpires = undefined
        await user.save()

        console.log(`Password reset successful for: ${user.email}`)

        res.json({
            message: "Password reset successfully",
        })
    } catch (err) {
        console.error("Reset password error:", err)
        res.status(500).json({
            message: "Error resetting password",
        })
    }
})

// Admin-only route to create admin users
router.post("/create-admin", authenticate, authorize(["admin"]), async (req, res) => {
    try {
        const { username, email, password } = req.body

        if (!username || !email || !password) {
            return res.status(400).json({
                message: "Username, email, and password are required",
            })
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }],
        })

        if (existingUser) {
            return res.status(409).json({
                message: "User with this email or username already exists",
            })
        }

        const adminUser = new User({
            username,
            email,
            passwordHash: password,
            role: "admin",
            accountType: "business",
            phone: "+44 123 456 7890", // Default admin phone
            address: "Dern Support HQ, London, UK", // Default admin address
        })

        await adminUser.save()

        console.log(`Admin user created: ${email} by ${req.user.email}`)

        res.status(201).json({
            message: "Admin user created successfully",
            user: {
                id: adminUser._id,
                username: adminUser.username,
                email: adminUser.email,
                role: adminUser.role,
            },
        })
    } catch (err) {
        console.error("Create admin error:", err)
        res.status(500).json({
            message: "Error creating admin user",
        })
    }
})

// Get all users (admin only)
router.get("/users", authenticate, authorize(["admin"]), async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page) || 1
        const limit = Number.parseInt(req.query.limit) || 10
        const skip = (page - 1) * limit

        const users = await User.find()
            .select("-passwordHash -resetPasswordToken -resetPasswordExpires")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)

        const total = await User.countDocuments()

        res.json({
            users,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        })
    } catch (err) {
        console.error("Get users error:", err)
        res.status(500).json({
            message: "Error fetching users",
        })
    }
})

// Protected route example
router.get("/protected", authenticate, (req, res) => {
    res.json({
        message: "Welcome to the protected route",
        user: {
            id: req.user.userId,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role,
            accountType: req.user.accountType,
        },
    })
})

// Health check endpoint
router.get("/health", (req, res) => {
    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        service: "Dern Support Auth Service",
    })
})

export default router

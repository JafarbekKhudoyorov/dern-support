import express from "express"
import User from "../models/user.js"
import { authenticate } from "../middlewares/authenticate.js"
import { authorize } from "../middlewares/authorize.js"
import { createAuditLog } from "../utils/audit.js"
import { successResponse, errorResponse } from "../utils/response.js"

const router = express.Router()

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get all users
 *     description: Retrieve a list of all users (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for username, email, or company name
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by user role
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by user status (active/inactive)
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not an admin
 */
router.get("/users", authenticate, authorize(["admin"]), async (req, res) => {
    try {
        const { search, role, status } = req.query

        // Build query
        const query = {}

        if (search) {
            query.$or = [
                { username: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { companyName: { $regex: search, $options: "i" } },
            ]
        }

        if (role) {
            query.role = role
        }

        if (status) {
            query.isActive = status === "active"
        }

        const users = await User.find(query).select("-passwordHash")

        // Ensure consistent response format with data property
        return res.status(200).json({
            success: true,
            message: "Users retrieved successfully",
            data: users,
            users: users, // Include both for backward compatibility
        })
    } catch (error) {
        console.error("Error fetching users:", error)
        return errorResponse(res, "Failed to fetch users", 500, error.message)
    }
})

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve a specific user by ID (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not an admin
 *       404:
 *         description: User not found
 */
router.get("/users/:id", authenticate, authorize(["admin"]), async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-passwordHash")

        if (!user) {
            return errorResponse(res, "User not found", 404)
        }

        return successResponse(res, { user }, "User retrieved successfully")
    } catch (error) {
        console.error("Error fetching user:", error)
        return errorResponse(res, "Failed to fetch user", 500, error.message)
    }
})

/**
 * @swagger
 * /admin/users:
 *   post:
 *     summary: Create a new user
 *     description: Create a new user (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - role
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *               accountType:
 *                 type: string
 *               companyName:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not an admin
 */
router.post("/users", authenticate, authorize(["admin"]), async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            role,
            accountType,
            companyName,
            phone,
            address,
            city,
            state,
            zipCode,
            isActive,
            specialization,
            experience,
            hourlyRate,
        } = req.body

        // Check if email already exists
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return errorResponse(res, "Email already in use", 400)
        }

        // Validate required fields
        if (!username || !email || !password || !role) {
            return errorResponse(res, "Missing required fields", 400)
        }

        // Validate business account
        if (accountType === "business" && !companyName) {
            return errorResponse(res, "Company name is required for business accounts", 400)
        }

        // Validate technician fields
        if (role === "technician" && (!specialization || !experience || !hourlyRate)) {
            return errorResponse(res, "Specialization, experience, and hourly rate are required for technicians", 400)
        }

        // Create user
        const user = new User({
            username,
            email,
            passwordHash: password, // Will be hashed by pre-save hook
            role,
            accountType: accountType || "individual",
            companyName,
            phone,
            address,
            city,
            state,
            zipCode,
            isActive: isActive !== undefined ? isActive : true,
            ...(role === "technician" && {
                specialization,
                experience,
                hourlyRate,
            }),
        })

        await user.save()

        // Create audit log
        await createAuditLog(
            {
                action: "create",
                resourceType: "user",
                resourceId: user._id,
                userId: req.user.userId,
                details: `Admin created user: ${username} (${email})`,
            },
            req,
        )

        // Remove password hash from response
        const userResponse = user.toObject()
        delete userResponse.passwordHash

        return successResponse(res, { user: userResponse }, "User created successfully", 201)
    } catch (error) {
        console.error("Error creating user:", error)
        return errorResponse(res, "Failed to create user", 500, error.message)
    }
})

/**
 * @swagger
 * /admin/users/{id}:
 *   put:
 *     summary: Update a user
 *     description: Update a user's information (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not an admin
 *       404:
 *         description: User not found
 */
router.put("/users/:id", authenticate, authorize(["admin"]), async (req, res) => {
    try {
        const userId = req.params.id
        const {
            username,
            email,
            password,
            role,
            accountType,
            companyName,
            phone,
            address,
            city,
            state,
            zipCode,
            isActive,
            specialization,
            experience,
            hourlyRate,
        } = req.body

        // Find user
        const user = await User.findById(userId)
        if (!user) {
            return errorResponse(res, "User not found", 404)
        }

        // Check if email is being changed and already exists
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email })
            if (existingUser) {
                return errorResponse(res, "Email already in use", 400)
            }
        }

        // Update user fields
        if (username) user.username = username
        if (email) user.email = email
        if (password) user.passwordHash = password // Will be hashed by pre-save hook
        if (role) user.role = role
        if (accountType) user.accountType = accountType
        if (accountType === "business" && companyName) user.companyName = companyName
        if (phone !== undefined) user.phone = phone
        if (address !== undefined) user.address = address
        if (city !== undefined) user.city = city
        if (state !== undefined) user.state = state
        if (zipCode !== undefined) user.zipCode = zipCode
        if (isActive !== undefined) user.isActive = isActive

        // Update technician fields
        if (role === "technician" || user.role === "technician") {
            if (specialization) user.specialization = specialization
            if (experience !== undefined) user.experience = experience
            if (hourlyRate !== undefined) user.hourlyRate = hourlyRate
        }

        await user.save()

        // Create audit log
        await createAuditLog(
            {
                action: "update",
                resourceType: "user",
                resourceId: user._id,
                userId: req.user.userId,
                details: `Admin updated user: ${user.username} (${user.email})`,
            },
            req,
        )

        // Remove password hash from response
        const userResponse = user.toObject()
        delete userResponse.passwordHash

        return successResponse(res, { user: userResponse }, "User updated successfully")
    } catch (error) {
        console.error("Error updating user:", error)
        return errorResponse(res, "Failed to update user", 500, error.message)
    }
})

/**
 * @swagger
 * /admin/users/{id}/status:
 *   patch:
 *     summary: Toggle user status
 *     description: Activate or deactivate a user (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User status updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not an admin
 *       404:
 *         description: User not found
 */
router.patch("/users/:id/status", authenticate, authorize(["admin"]), async (req, res) => {
    try {
        const { isActive } = req.body

        if (isActive === undefined) {
            return errorResponse(res, "isActive field is required", 400)
        }

        const user = await User.findById(req.params.id)

        if (!user) {
            return errorResponse(res, "User not found", 404)
        }

        user.isActive = isActive
        await user.save()

        // Create audit log
        await createAuditLog(
            {
                action: "update",
                resourceType: "user",
                resourceId: user._id,
                userId: req.user.userId,
                details: `Admin ${isActive ? "activated" : "deactivated"} user: ${user.username} (${user.email})`,
            },
            req,
        )

        return successResponse(res, null, `User ${isActive ? "activated" : "deactivated"} successfully`)
    } catch (error) {
        console.error("Error updating user status:", error)
        return errorResponse(res, "Failed to update user status", 500, error.message)
    }
})

/**
 * @swagger
 * /admin/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     description: Delete a user from the system (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not an admin
 *       404:
 *         description: User not found
 */
router.delete("/users/:id", authenticate, authorize(["admin"]), async (req, res) => {
    try {
        const user = await User.findById(req.params.id)

        if (!user) {
            return errorResponse(res, "User not found", 404)
        }

        // Store user info for audit log
        const userInfo = `${user.username} (${user.email})`

        await User.deleteOne({ _id: req.params.id })

        // Create audit log
        await createAuditLog(
            {
                action: "delete",
                resourceType: "user",
                resourceId: req.params.id,
                userId: req.user.userId,
                details: `Admin deleted user: ${userInfo}`,
            },
            req,
        )

        return successResponse(res, null, "User deleted successfully")
    } catch (error) {
        console.error("Error deleting user:", error)
        return errorResponse(res, "Failed to delete user", 500, error.message)
    }
})

export default router

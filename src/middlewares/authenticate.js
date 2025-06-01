import jwt from "jsonwebtoken"
import User from "../models/user.js"

export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization
        const accessToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null
        const refreshToken = req.cookies.refreshToken

        console.log("Auth attempt:", {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
            path: req.path,
        })

        // Check if any token is provided
        if (!accessToken && !refreshToken) {
            return res.status(401).json({
                message: "Access denied. No authentication token provided.",
                code: "NO_TOKEN",
            })
        }

        // Try to verify access token first
        if (accessToken) {
            try {
                const decoded = jwt.verify(accessToken, process.env.JWT_SECRET)
                console.log("Access token decoded:", decoded)

                // Verify user still exists and is active
                const currentUser = await User.findById(decoded.userId).select("-password")
                if (!currentUser || !currentUser.isActive) {
                    return res.status(401).json({
                        message: "User not found or inactive",
                        code: "USER_INACTIVE",
                    })
                }

                // Set user info in request
                req.user = {
                    userId: currentUser._id.toString(),
                    username: currentUser.username,
                    email: currentUser.email,
                    role: currentUser.role,
                    accountType: currentUser.accountType,
                }

                console.log("User authenticated via access token:", req.user)
                return next()
            } catch (err) {
                console.log("Access token verification failed:", err.message)
                // Access token is invalid or expired, try refresh token
                if (err.name !== "TokenExpiredError" && err.name !== "JsonWebTokenError") {
                    throw err // Re-throw if it's not a token error
                }
            }
        }

        // If access token failed, try refresh token
        if (!refreshToken) {
            return res.status(401).json({
                message: "Access denied. Invalid or expired token.",
                code: "INVALID_TOKEN",
            })
        }

        try {
            const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
            console.log("Refresh token decoded:", decoded)

            // Verify user still exists and is active
            const user = await User.findById(decoded.userId).select("-password")
            if (!user || !user.isActive) {
                return res.status(401).json({
                    message: "User not found or inactive",
                    code: "USER_INACTIVE",
                })
            }

            // Generate new access token with fresh user data
            const newAccessToken = jwt.sign(
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

            // Generate new refresh token
            const newRefreshToken = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" })

            // Set new refresh token cookie
            res.cookie("refreshToken", newRefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                path: "/",
            })

            // Set new access token in response header
            res.set("Authorization", `Bearer ${newAccessToken}`)

            // Add user info to request
            req.user = {
                userId: user._id.toString(),
                username: user.username,
                email: user.email,
                role: user.role,
                accountType: user.accountType,
            }

            console.log("User authenticated via refresh token:", req.user)
            next()
        } catch (err) {
            console.error("Refresh token verification failed:", err)
            return res.status(401).json({
                message: "Invalid refresh token. Please log in again.",
                code: "INVALID_REFRESH_TOKEN",
            })
        }
    } catch (err) {
        console.error("Authentication middleware error:", err)
        return res.status(500).json({
            message: "Authentication error",
            error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
        })
    }
}

// Optional authentication - doesn't fail if no token provided
export const optionalAuthenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization
        const accessToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null

        if (accessToken) {
            try {
                const decoded = jwt.verify(accessToken, process.env.JWT_SECRET)

                // Verify user still exists and is active
                const user = await User.findById(decoded.userId).select("-password")
                if (user && user.isActive) {
                    req.user = {
                        userId: user._id.toString(),
                        username: user.username,
                        email: user.email,
                        role: user.role,
                        accountType: user.accountType,
                    }
                } else {
                    req.user = null
                }
            } catch (err) {
                // Token is invalid, but we don't fail the request
                req.user = null
            }
        } else {
            req.user = null
        }

        next()
    } catch (err) {
        console.error("Optional authentication error:", err)
        req.user = null
        next()
    }
}

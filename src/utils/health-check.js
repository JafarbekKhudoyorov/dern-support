import mongoose from "mongoose"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Health check utilities
export const checkDatabase = async () => {
    try {
        const state = mongoose.connection.readyState
        const states = {
            0: "disconnected",
            1: "connected",
            2: "connecting",
            3: "disconnecting",
        }

        if (state === 1) {
            // Test database operation
            await mongoose.connection.db.admin().ping()
            return {
                status: "healthy",
                state: states[state],
                message: "Database connection is healthy",
            }
        } else {
            return {
                status: "unhealthy",
                state: states[state],
                message: "Database is not connected",
            }
        }
    } catch (error) {
        return {
            status: "unhealthy",
            state: "error",
            message: error.message,
        }
    }
}

export const checkMemoryUsage = () => {
    const usage = process.memoryUsage()
    const formatBytes = (bytes) => {
        return Math.round((bytes / 1024 / 1024) * 100) / 100 // MB
    }

    return {
        rss: `${formatBytes(usage.rss)} MB`,
        heapTotal: `${formatBytes(usage.heapTotal)} MB`,
        heapUsed: `${formatBytes(usage.heapUsed)} MB`,
        external: `${formatBytes(usage.external)} MB`,
        arrayBuffers: `${formatBytes(usage.arrayBuffers)} MB`,
    }
}

export const checkDiskSpace = () => {
    try {
        const stats = fs.statSync(__dirname)
        return {
            status: "healthy",
            message: "Disk access is working",
        }
    } catch (error) {
        return {
            status: "unhealthy",
            message: `Disk access error: ${error.message}`,
        }
    }
}

export const checkEnvironmentVariables = () => {
    const requiredVars = ["MONGO_URI", "JWT_SECRET", "JWT_REFRESH_SECRET", "GMAIL_USER", "GMAIL_PASS", "CLIENT_URL"]

    const missing = requiredVars.filter((varName) => !process.env[varName])

    if (missing.length > 0) {
        return {
            status: "unhealthy",
            message: `Missing environment variables: ${missing.join(", ")}`,
            missing,
        }
    }

    return {
        status: "healthy",
        message: "All required environment variables are set",
    }
}

export const checkUptime = () => {
    const uptime = process.uptime()
    const hours = Math.floor(uptime / 3600)
    const minutes = Math.floor((uptime % 3600) / 60)
    const seconds = Math.floor(uptime % 60)

    return {
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        uptimeSeconds: uptime,
    }
}

export const getSystemInfo = () => {
    return {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        pid: process.pid,
        environment: process.env.NODE_ENV || "development",
    }
}

// Comprehensive health check
export const performHealthCheck = async () => {
    const startTime = Date.now()

    const checks = {
        database: await checkDatabase(),
        memory: checkMemoryUsage(),
        disk: checkDiskSpace(),
        environment: checkEnvironmentVariables(),
        uptime: checkUptime(),
        system: getSystemInfo(),
    }

    const isHealthy = Object.values(checks).every((check) => {
        return !check.status || check.status === "healthy"
    })

    const responseTime = Date.now() - startTime

    return {
        status: isHealthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        checks,
        version: process.env.npm_package_version || "unknown",
    }
}

// Readiness check (for Kubernetes/Docker)
export const checkReadiness = async () => {
    const dbCheck = await checkDatabase()
    const envCheck = checkEnvironmentVariables()

    const isReady = dbCheck.status === "healthy" && envCheck.status === "healthy"

    return {
        status: isReady ? "ready" : "not ready",
        timestamp: new Date().toISOString(),
        checks: {
            database: dbCheck,
            environment: envCheck,
        },
    }
}

// Liveness check (for Kubernetes/Docker)
export const checkLiveness = () => {
    // Simple check to see if the process is alive
    return {
        status: "alive",
        timestamp: new Date().toISOString(),
        uptime: checkUptime(),
    }
}

export default {
    performHealthCheck,
    checkReadiness,
    checkLiveness,
    checkDatabase,
    checkMemoryUsage,
    checkDiskSpace,
    checkEnvironmentVariables,
    checkUptime,
    getSystemInfo,
}

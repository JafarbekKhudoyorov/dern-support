import winston from "winston"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
}

// Define colors for each level
const colors = {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "white",
}

// Tell winston that you want to link the colors
winston.addColors(colors)

// Define which level to log based on environment
const level = () => {
    const env = process.env.NODE_ENV || "development"
    const isDevelopment = env === "development"
    return isDevelopment ? "debug" : process.env.LOG_LEVEL || "info"
}

// Define different log formats
const developmentFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
    winston.format.colorize({ all: true }),
    winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
)

const productionFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
)

// Define transports
const transports = []

// Console transport for development
if (process.env.NODE_ENV !== "production") {
    transports.push(
        new winston.transports.Console({
            format: developmentFormat,
        }),
    )
} else {
    transports.push(
        new winston.transports.Console({
            format: productionFormat,
        }),
    )
}

// File transports for production
if (process.env.NODE_ENV === "production") {
    // Error log file
    transports.push(
        new winston.transports.File({
            filename: path.join(__dirname, "../../logs/error.log"),
            level: "error",
            format: productionFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    )

    // Combined log file
    transports.push(
        new winston.transports.File({
            filename: path.join(__dirname, "../../logs/combined.log"),
            format: productionFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    )
}

// Create the logger
export const logger = winston.createLogger({
    level: level(),
    levels,
    transports,
    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, "../../logs/exceptions.log"),
        }),
    ],
    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, "../../logs/rejections.log"),
        }),
    ],
})

// Create logs directory if it doesn't exist
import fs from "fs"
const logsDir = path.join(__dirname, "../../logs")
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
}

// HTTP request logging middleware
export const httpLogger = (req, res, next) => {
    const start = Date.now()

    res.on("finish", () => {
        const duration = Date.now() - start
        const logData = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get("User-Agent"),
            userId: req.user?.userId || "anonymous",
        }

        if (res.statusCode >= 400) {
            logger.error("HTTP Request Error", logData)
        } else {
            logger.http("HTTP Request", logData)
        }
    })

    next()
}

// Error logging helper
export const logError = (error, context = {}) => {
    logger.error("Application Error", {
        message: error.message,
        stack: error.stack,
        ...context,
    })
}

// Info logging helper
export const logInfo = (message, data = {}) => {
    logger.info(message, data)
}

// Debug logging helper
export const logDebug = (message, data = {}) => {
    logger.debug(message, data)
}

// Warn logging helper
export const logWarn = (message, data = {}) => {
    logger.warn(message, data)
}

// Database operation logging
export const logDatabaseOperation = (operation, collection, data = {}) => {
    logger.debug("Database Operation", {
        operation,
        collection,
        ...data,
    })
}

// Authentication logging
export const logAuth = (event, userId, data = {}) => {
    logger.info("Authentication Event", {
        event,
        userId,
        timestamp: new Date().toISOString(),
        ...data,
    })
}

// Security event logging
export const logSecurity = (event, data = {}) => {
    logger.warn("Security Event", {
        event,
        timestamp: new Date().toISOString(),
        ...data,
    })
}

// Performance logging
export const logPerformance = (operation, duration, data = {}) => {
    logger.info("Performance Metric", {
        operation,
        duration: `${duration}ms`,
        ...data,
    })
}


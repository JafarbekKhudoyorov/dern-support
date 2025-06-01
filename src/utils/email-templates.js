import mongoose from "mongoose"

// Database utilities and helpers

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI)

    console.log(`MongoDB Connected: ${conn.connection.host}`)
    return conn
  } catch (error) {
    console.error("Database connection error:", error)
    process.exit(1)
  }
}

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect()
    console.log("MongoDB Disconnected")
  } catch (error) {
    console.error("Database disconnection error:", error)
  }
}

// Transaction helper
export const withTransaction = async (operations) => {
  const session = await mongoose.startSession()

  try {
    session.startTransaction()
    const result = await operations(session)
    await session.commitTransaction()
    return result
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

// Aggregation helpers
export const buildMatchStage = (filters) => {
  const match = {}

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      if (Array.isArray(value)) {
        match[key] = { $in: value }
      } else if (typeof value === "object" && value.start && value.end) {
        match[key] = { $gte: value.start, $lte: value.end }
      } else {
        match[key] = value
      }
    }
  })

  return match
}

export const buildSortStage = (sortBy = "createdAt", sortOrder = "desc") => {
  return { [sortBy]: sortOrder === "desc" ? -1 : 1 }
}

export const buildPaginationStages = (page = 1, limit = 10) => {
  const skip = (page - 1) * limit
  return [{ $skip: skip }, { $limit: limit }]
}

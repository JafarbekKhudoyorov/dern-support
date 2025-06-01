import { Server } from "socket.io"
import jwt from "jsonwebtoken"
import User from "../models/user.js"

let io

export const initializeWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  })

  // Authentication middleware for WebSocket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token
      if (!token) {
        return next(new Error("Authentication error"))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.userId)
      if (!user || !user.isActive) {
        return next(new Error("Authentication error"))
      }

      socket.userId = user._id.toString()
      socket.userRole = user.role
      socket.username = user.username
      next()
    } catch (err) {
      next(new Error("Authentication error"))
    }
  })

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.username} (${socket.userId})`)

    // Join user to their personal room
    socket.join(`user:${socket.userId}`)

    // Join technicians to technician room
    if (socket.userRole === "technician" || socket.userRole === "admin") {
      socket.join("technicians")
      console.log(`Technician ${socket.username} joined technician room`)
    }

    // Join admins to admin room
    if (socket.userRole === "admin") {
      socket.join("admins")
    }

    // Handle joining support request rooms
    socket.on("join-support-request", (requestId) => {
      socket.join(`support-request:${requestId}`)
      console.log(`User ${socket.username} joined support request: ${requestId}`)
    })

    // Handle leaving support request rooms
    socket.on("leave-support-request", (requestId) => {
      socket.leave(`support-request:${requestId}`)
      console.log(`User ${socket.username} left support request: ${requestId}`)
    })

    // Handle typing indicators
    socket.on("typing-start", (data) => {
      socket.to(`support-request:${data.requestId}`).emit("user-typing", {
        userId: socket.userId,
        username: socket.username,
        requestId: data.requestId,
      })
    })

    socket.on("typing-stop", (data) => {
      socket.to(`support-request:${data.requestId}`).emit("user-stopped-typing", {
        userId: socket.userId,
        requestId: data.requestId,
      })
    })

    // Handle user status updates
    socket.on("update-status", (status) => {
      socket.broadcast.emit("user-status-changed", {
        userId: socket.userId,
        status,
      })
    })

    // Handle technician availability updates
    socket.on("update-technician-availability", async (availability) => {
      try {
        if (socket.userRole !== "technician" && socket.userRole !== "admin") {
          return
        }

        await User.findByIdAndUpdate(socket.userId, { availability })

        socket.broadcast.emit("technician-availability-changed", {
          technicianId: socket.userId,
          availability,
        })

        console.log(`Technician ${socket.username} updated availability to ${availability}`)
      } catch (err) {
        console.error("Error updating technician availability:", err)
      }
    })

    // Handle technician dashboard subscription
    socket.on("subscribe-technician-dashboard", () => {
      if (socket.userRole !== "technician" && socket.userRole !== "admin") {
        return
      }

      socket.join(`technician-dashboard:${socket.userId}`)
      console.log(`Technician ${socket.username} subscribed to dashboard updates`)
    })

    // Handle technician dashboard unsubscription
    socket.on("unsubscribe-technician-dashboard", () => {
      socket.leave(`technician-dashboard:${socket.userId}`)
      console.log(`Technician ${socket.username} unsubscribed from dashboard updates`)
    })

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.username} (${socket.userId})`)
    })
  })

  return io
}

export const getIO = () => {
  if (!io) {
    throw new Error("WebSocket not initialized")
  }
  return io
}

// Utility functions for emitting events
export const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data)
  }
}

export const emitToSupportRequest = (requestId, event, data) => {
  if (io) {
    io.to(`support-request:${requestId}`).emit(event, data)
  }
}

export const emitToTechnicians = (event, data) => {
  if (io) {
    io.to("technicians").emit(event, data)
  }
}

export const emitToAdmins = (event, data) => {
  if (io) {
    io.to("admins").emit(event, data)
  }
}

export const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data)
  }
}

// Add a new utility function for emitting to technician dashboard
export const emitToTechnicianDashboard = (technicianId, event, data) => {
  if (io) {
    io.to(`technician-dashboard:${technicianId}`).emit(event, data)
  }
}

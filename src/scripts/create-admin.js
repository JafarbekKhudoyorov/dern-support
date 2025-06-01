import dotenv from "dotenv"
import mongoose from "mongoose"
import User from "../models/user.js"

dotenv.config()

const createFirstAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI)
    console.log("Connected to MongoDB")

    // Check if any admin users exist
    const existingAdmin = await User.findOne({ role: "admin" })
    if (existingAdmin) {
      console.log("Admin user already exists:", existingAdmin.email)
      process.exit(0)
    }

    // Create the first admin user
    const adminData = {
      username: "dern_admin",
      email: "sadiridinovotabek@gmail.com", // Change this to your email
      passwordHash: "admin123", // Change this password
      role: "admin",
      accountType: "business",
      phone: "+998332985051",
      address: "Dern Support HQ, London, UK",
      isActive: true
    }

    const adminUser = new User(adminData)
    await adminUser.save()

    console.log("✅ First admin user created successfully!")
    console.log("Email:", adminUser.email)
    console.log("Password: admin123") // Remember to change this
    console.log("⚠️  Please change the password after first login!")

  } catch (error) {
    console.error("❌ Error creating admin user:", error)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

createFirstAdmin()

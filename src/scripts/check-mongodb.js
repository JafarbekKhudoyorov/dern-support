#!/usr/bin/env node

import { MongoClient } from "mongodb"
import dotenv from "dotenv"

// Load environment variables
dotenv.config()

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/dern-support"

async function checkMongoDB() {
  console.log("🔍 Checking MongoDB connection...")
  console.log(`URI: ${MONGO_URI}`)

  try {
    const client = new MongoClient(MONGO_URI)
    await client.connect()

    // Test the connection
    await client.db().admin().ping()
    console.log("✅ MongoDB connection successful!")

    // List databases
    const databases = await client.db().admin().listDatabases()
    console.log("📊 Available databases:")
    databases.databases.forEach((db) => {
      console.log(`  - ${db.name}`)
    })

    await client.close()
    return true
  } catch (error) {
    console.error("❌ MongoDB connection failed:")
    console.error(`Error: ${error.message}`)

    if (error.message.includes("ECONNREFUSED")) {
      console.log("\n💡 Troubleshooting tips:")
      console.log("1. Make sure MongoDB is installed and running")
      console.log("2. Check if MongoDB service is started:")
      console.log('   - Windows: Check Services or run "net start MongoDB"')
      console.log("   - macOS: brew services start mongodb-community")
      console.log("   - Linux: sudo systemctl start mongod")
      console.log("3. Verify the MONGO_URI in your .env file")
    }

    return false
  }
}

checkMongoDB()

#!/usr/bin/env node

import { spawn } from "child_process"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import fs from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, "..")

console.log("🚀 Starting Dern Support Backend Development Server")
console.log("==================================================\n")

// Check if .env file exists
const envPath = join(projectRoot, ".env")
if (!fs.existsSync(envPath)) {
  console.error("❌ .env file not found!")
  console.log("Please create a .env file based on .env.example")
  process.exit(1)
}

// Check if node_modules exists
const nodeModulesPath = join(projectRoot, "node_modules")
if (!fs.existsSync(nodeModulesPath)) {
  console.log("📦 Installing dependencies...")
  const npmInstall = spawn("npm", ["install"], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: true,
  })

  npmInstall.on("close", (code) => {
    if (code === 0) {
      console.log("✅ Dependencies installed successfully")
      startServer()
    } else {
      console.error("❌ Failed to install dependencies")
      process.exit(1)
    }
  })
} else {
  startServer()
}

function startServer() {
  console.log("🔄 Starting development server...\n")

  const server = spawn("npm", ["run", "dev"], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: true,
  })

  server.on("close", (code) => {
    console.log(`\n📊 Server process exited with code ${code}`)
  })

  // Handle Ctrl+C gracefully
  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down development server...")
    server.kill("SIGINT")
    process.exit(0)
  })
}

import dotenv from "dotenv"
import mongoose from "mongoose"
import User from "../models/user.js"

dotenv.config()

const createDefaultUsers = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI)
        console.log("Connected to MongoDB")

        // Check if users already exist
        const existingUsers = await User.countDocuments()
        if (existingUsers > 0) {
            console.log(`${existingUsers} users already exist in the database`)
            console.log("Skipping user creation to avoid duplicates")
            process.exit(0)
        }

        // Default users data
        const defaultUsers = [
            // Admin User
            {
                username: "dern_admin",
                email: "admin@dernsupport.com",
                passwordHash: "admin123",
                role: "admin",
                accountType: "business",
                phone: "+44 20 7946 0958",
                address: "Dern Support HQ, 123 Tech Street, London, UK",
                isActive: true,
                profile: {
                    firstName: "Admin",
                    lastName: "User",
                    bio: "System Administrator for Dern Support",
                    avatar: "/placeholder.svg?height=100&width=100",
                },
            },

            // Individual Customers
            {
                username: "john_doe",
                email: "john.doe@email.com",
                passwordHash: "customer123",
                role: "customer",
                accountType: "individual",
                phone: "+44 20 7946 1001",
                address: "45 Residential Ave, Manchester, UK",
                isActive: true,
                profile: {
                    firstName: "John",
                    lastName: "Doe",
                    bio: "Software developer and tech enthusiast",
                    avatar: "/placeholder.svg?height=100&width=100",
                },
            },
            {
                username: "sarah_wilson",
                email: "sarah.wilson@email.com",
                passwordHash: "customer123",
                role: "customer",
                accountType: "individual",
                phone: "+44 20 7946 1002",
                address: "78 Garden Road, Birmingham, UK",
                isActive: true,
                profile: {
                    firstName: "Sarah",
                    lastName: "Wilson",
                    bio: "Graphic designer and freelancer",
                    avatar: "/placeholder.svg?height=100&width=100",
                },
            },
            {
                username: "mike_johnson",
                email: "mike.johnson@email.com",
                passwordHash: "customer123",
                role: "customer",
                accountType: "individual",
                phone: "+44 20 7946 1003",
                address: "12 Oak Street, Leeds, UK",
                isActive: true,
                profile: {
                    firstName: "Mike",
                    lastName: "Johnson",
                    bio: "Marketing professional",
                    avatar: "/placeholder.svg?height=100&width=100",
                },
            },

            // Business Customers
            {
                username: "techcorp_admin",
                email: "admin@techcorp.com",
                passwordHash: "business123",
                role: "customer",
                accountType: "business",
                phone: "+44 20 7946 2001",
                address: "TechCorp Ltd, 100 Business Park, London, UK",
                isActive: true,
                profile: {
                    firstName: "David",
                    lastName: "Smith",
                    bio: "IT Manager at TechCorp Ltd",
                    avatar: "/placeholder.svg?height=100&width=100",
                },
                businessInfo: {
                    companyName: "TechCorp Ltd",
                    industry: "Technology",
                    employeeCount: "50-100",
                    website: "https://techcorp.com",
                },
            },
            {
                username: "innovate_solutions",
                email: "contact@innovatesolutions.com",
                passwordHash: "business123",
                role: "customer",
                accountType: "business",
                phone: "+44 20 7946 2002",
                address: "Innovate Solutions, 250 Innovation Drive, Cambridge, UK",
                isActive: true,
                profile: {
                    firstName: "Emma",
                    lastName: "Thompson",
                    bio: "Operations Director at Innovate Solutions",
                    avatar: "/placeholder.svg?height=100&width=100",
                },
                businessInfo: {
                    companyName: "Innovate Solutions",
                    industry: "Consulting",
                    employeeCount: "20-50",
                    website: "https://innovatesolutions.com",
                },
            },
            {
                username: "retail_plus",
                email: "support@retailplus.com",
                passwordHash: "business123",
                role: "customer",
                accountType: "business",
                phone: "+44 20 7946 2003",
                address: "Retail Plus, 88 Commerce Street, Bristol, UK",
                isActive: true,
                profile: {
                    firstName: "James",
                    lastName: "Brown",
                    bio: "Technical Lead at Retail Plus",
                    avatar: "/placeholder.svg?height=100&width=100",
                },
                businessInfo: {
                    companyName: "Retail Plus",
                    industry: "Retail",
                    employeeCount: "100-500",
                    website: "https://retailplus.com",
                },
            },

            // Technicians
            {
                username: "alex_tech",
                email: "alex.martinez@dernsupport.com",
                passwordHash: "tech123",
                role: "technician",
                accountType: "individual",
                phone: "+44 20 7946 3001",
                address: "15 Tech Lane, London, UK",
                isActive: true,
                profile: {
                    firstName: "Alex",
                    lastName: "Martinez",
                    bio: "Senior Network Specialist with 8+ years experience",
                    avatar: "/placeholder.svg?height=100&width=100",
                },
                technicianProfile: {
                    specialization: "network-security",
                    experience: 8,
                    certifications: ["CCNA", "CISSP", "CompTIA Security+"],
                    skills: ["Network Security", "Firewall Configuration", "VPN Setup", "Intrusion Detection"],
                    availability: "available",
                    rating: 4.8,
                    completedTickets: 245,
                },
            },
            {
                username: "lisa_support",
                email: "lisa.chen@dernsupport.com",
                passwordHash: "tech123",
                role: "technician",
                accountType: "individual",
                phone: "+44 20 7946 3002",
                address: "22 Support Street, London, UK",
                isActive: true,
                profile: {
                    firstName: "Lisa",
                    lastName: "Chen",
                    bio: "Hardware specialist and system administrator",
                    avatar: "/placeholder.svg?height=100&width=100",
                },
                technicianProfile: {
                    specialization: "hardware-repair",
                    experience: 6,
                    certifications: ["CompTIA A+", "CompTIA Hardware+", "Microsoft Certified"],
                    skills: ["Hardware Diagnostics", "Component Replacement", "System Assembly", "Troubleshooting"],
                    availability: "available",
                    rating: 4.7,
                    completedTickets: 189,
                },
            },
            {
                username: "robert_dev",
                email: "robert.taylor@dernsupport.com",
                passwordHash: "tech123",
                role: "technician",
                accountType: "individual",
                phone: "+44 20 7946 3003",
                address: "33 Developer Road, London, UK",
                isActive: true,
                profile: {
                    firstName: "Robert",
                    lastName: "Taylor",
                    bio: "Full-stack developer and software troubleshooting expert",
                    avatar: "/placeholder.svg?height=100&width=100",
                },
                technicianProfile: {
                    specialization: "software-development",
                    experience: 10,
                    certifications: ["AWS Certified", "Google Cloud Professional", "Microsoft Azure"],
                    skills: ["Web Development", "Database Management", "API Integration", "Cloud Services"],
                    availability: "available",
                    rating: 4.9,
                    completedTickets: 312,
                },
            },
            {
                username: "maria_cloud",
                email: "maria.garcia@dernsupport.com",
                passwordHash: "tech123",
                role: "technician",
                accountType: "individual",
                phone: "+44 20 7946 3004",
                address: "44 Cloud Avenue, London, UK",
                isActive: true,
                profile: {
                    firstName: "Maria",
                    lastName: "Garcia",
                    bio: "Cloud infrastructure and DevOps specialist",
                    avatar: "/placeholder.svg?height=100&width=100",
                },
                technicianProfile: {
                    specialization: "cloud-services",
                    experience: 7,
                    certifications: ["AWS Solutions Architect", "Kubernetes Certified", "Docker Certified"],
                    skills: ["Cloud Migration", "Container Orchestration", "CI/CD Pipelines", "Infrastructure as Code"],
                    availability: "available",
                    rating: 4.6,
                    completedTickets: 156,
                },
            },
            {
                username: "tom_mobile",
                email: "tom.anderson@dernsupport.com",
                passwordHash: "tech123",
                role: "technician",
                accountType: "individual",
                phone: "+44 20 7946 3005",
                address: "55 Mobile Street, London, UK",
                isActive: true,
                profile: {
                    firstName: "Tom",
                    lastName: "Anderson",
                    bio: "Mobile app development and troubleshooting expert",
                    avatar: "/placeholder.svg?height=100&width=100",
                },
                technicianProfile: {
                    specialization: "mobile-apps",
                    experience: 5,
                    certifications: ["iOS Developer", "Android Developer", "React Native Certified"],
                    skills: ["iOS Development", "Android Development", "React Native", "Mobile UI/UX"],
                    availability: "busy",
                    rating: 4.5,
                    completedTickets: 98,
                },
            },
        ]

        // Create all users
        console.log("Creating default users...")

        for (const userData of defaultUsers) {
            try {
                const user = new User(userData)
                await user.save()
                console.log(`✅ Created ${userData.role}: ${userData.username} (${userData.email})`)
            } catch (error) {
                console.error(`❌ Failed to create user ${userData.username}:`, error.message)
            }
        }

        console.log("\n🎉 Default users created successfully!")
        console.log("\n📋 Login Credentials:")
        console.log("=" * 50)
        console.log("ADMIN:")
        console.log("  Email: admin@dernsupport.com")
        console.log("  Password: admin123")
        console.log("\nCUSTOMERS (Individual):")
        console.log("  john.doe@email.com / customer123")
        console.log("  sarah.wilson@email.com / customer123")
        console.log("  mike.johnson@email.com / customer123")
        console.log("\nCUSTOMERS (Business):")
        console.log("  admin@techcorp.com / business123")
        console.log("  contact@innovatesolutions.com / business123")
        console.log("  support@retailplus.com / business123")
        console.log("\nTECHNICIANS:")
        console.log("  alex.martinez@dernsupport.com / tech123")
        console.log("  lisa.chen@dernsupport.com / tech123")
        console.log("  robert.taylor@dernsupport.com / tech123")
        console.log("  maria.garcia@dernsupport.com / tech123")
        console.log("  tom.anderson@dernsupport.com / tech123")
        console.log("\n⚠️  Please change all passwords after first login!")
    } catch (error) {
        console.error("❌ Error creating default users:", error)
    } finally {
        await mongoose.disconnect()
        console.log("\nDisconnected from MongoDB")
        process.exit(0)
    }
}

createDefaultUsers()

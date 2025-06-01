import mongoose from "mongoose"
import bcrypt from "bcrypt"

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 50,
        },
        passwordHash: {
            type: String,
            required: true,
            minlength: 6,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Please fill a valid email address"],
        },
        role: {
            type: String,
            enum: ["customer", "admin", "technician"],
            default: "customer",
        },
        accountType: {
            type: String,
            enum: ["individual", "business"],
            default: "individual",
        },
        companyName: {
            type: String,
            required: function () {
                return this.accountType === "business" && this.isNew; // Only required on creation
            },
            trim: true,
        },
        phone: {
            type: String,
            required: false,
            trim: true,
            match: [/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, "Please fill a valid phone number"],
        },
        address: {
            type: String,
            required: false,
            trim: true,
        },
        marketingEmails: {
            type: Boolean,
            default: false,
        },
        city: {
            type: String,
            required: false,
            trim: true,
        },
        state: {
            type: String,
            required: false,
            trim: true,
        },
        zipCode: {
            type: String,
            required: false,
            trim: true,
        },
        profilePicture: {
            type: String, // Store the URL or path to the image
            default: null,
        },
        isActive: {
            type: Boolean,
            default: false,
        },
        resetPasswordToken: {
            type: String,
        },
        resetPasswordExpires: {
            type: Date,
        },
        activationToken: { type: String }, // New field
        activationTokenExpires: { type: Date }, // New field
        // Professional information for technicians
        specialization: {
            type: [String],
            required: function () {
                return this.role === "technician"
            },
        },
        experience: {
            type: Number, // years of experience
            required: function () {
                return this.role === "technician"
            },
        },
        hourlyRate: {
            type: Number,
            required: function () {
                return this.role === "technician"
            },
        },
        availability: {
            type: String,
            enum: ["available", "busy", "offline"],
            default: "available",
        },
        rating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },
        totalReviews: {
            type: Number,
            default: 0,
        },
        // Business information
        businessLicense: String,
        certifications: {
            type: [String],
            default: [],
        },
    },
    { timestamps: true },
)

// Hash the password before saving
userSchema.pre("save", async function (next) {
    if (!this.isModified("passwordHash")) return next()
    try {
        const salt = await bcrypt.genSalt(10)
        this.passwordHash = await bcrypt.hash(this.passwordHash, salt)
        this.updatedAt = Date.now()
        return next()
    } catch (err) {
        return next(err)
    }
})

// Method to compare password for login
userSchema.methods.verifyPassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.passwordHash)
    } catch (err) {
        throw new Error(err)
    }
}

const User = mongoose.model("User", userSchema)

export default User

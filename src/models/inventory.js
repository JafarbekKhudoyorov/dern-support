import mongoose from "mongoose"

const inventorySchema = new mongoose.Schema(
    {
        itemName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        itemCode: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },
        category: {
            type: String,
            required: true,
            enum: ["hardware", "software", "tools", "parts", "consumables", "equipment"],
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        quantity: {
            type: Number,
            required: true,
            min: 0,
        },
        minStockLevel: {
            type: Number,
            required: true,
            min: 0,
            default: 5,
        },
        maxStockLevel: {
            type: Number,
            required: true,
            min: 0,
            default: 100,
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        supplier: {
            name: {
                type: String,
                required: true,
                trim: true,
            },
            contact: {
                type: String,
                trim: true,
            },
            email: {
                type: String,
                trim: true,
                lowercase: true,
            },
        },
        location: {
            warehouse: {
                type: String,
                required: true,
                default: "Main Warehouse",
            },
            shelf: {
                type: String,
                trim: true,
            },
            bin: {
                type: String,
                trim: true,
            },
        },
        status: {
            type: String,
            enum: ["active", "discontinued", "out-of-stock", "low-stock"],
            default: "active",
        },
        lastRestocked: {
            type: Date,
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        usageHistory: [
            {
                date: {
                    type: Date,
                    default: Date.now,
                },
                action: {
                    type: String,
                    enum: ["added", "removed", "transferred", "assigned", "returned"],
                },
                quantity: {
                    type: Number,
                    required: true,
                },
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                notes: {
                    type: String,
                    trim: true,
                },
            },
        ],
        images: [
            {
                url: String,
                filename: String,
                uploadedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
    },
    {
        timestamps: true,
    },
)

inventorySchema.index({ itemCode: 1 })
inventorySchema.index({ category: 1 })
inventorySchema.index({ status: 1 })
inventorySchema.index({ quantity: 1 })

// Virtual for stock status
inventorySchema.virtual("stockStatus").get(function () {
    if (this.quantity === 0) return "out-of-stock"
    if (this.quantity <= this.minStockLevel) return "low-stock"
    return "in-stock"
})

export default mongoose.model("Inventory", inventorySchema)

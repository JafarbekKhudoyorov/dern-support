import express from "express";
import Joi from "joi";
import { nanoid } from "nanoid";
import Payment from "../models/payment.js";
import Appointment from "../models/appointment.js";
import Service from "../models/service.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireCustomer } from "../middlewares/authorize.js";

const router = express.Router();

// Validation schema
const createPaymentSchema = Joi.object({
    appointmentId: Joi.string().optional(),
    serviceId: Joi.string().optional(),
    amount: Joi.number().min(0).required(),
    paymentMethod: Joi.string().valid("credit_card", "debit_card", "paypal", "bank_transfer").required(),
});

// Create payment
router.post("/", authenticate, requireCustomer, async (req, res) => {
    try {
        const { error, value } = createPaymentSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                message: "Validation error",
                details: error.details.map((detail) => detail.message),
            });
        }

        if (!value.appointmentId && !value.serviceId) {
            return res.status(400).json({ message: "Either appointmentId or serviceId is required" });
        }

        let appointment, service;
        if (value.appointmentId) {
            appointment = await Appointment.findById(value.appointmentId);
            if (!appointment || appointment.client.toString() !== req.user.userId) {
                return res.status(404).json({ message: "Appointment not found or access denied" });
            }
        }
        if (value.serviceId) {
            service = await Service.findById(value.serviceId);
            if (!service) {
                return res.status(404).json({ message: "Service not found" });
            }
        }

        const payment = new Payment({
            user: req.user.userId,
            appointment: value.appointmentId,
            service: value.serviceId,
            amount: value.amount,
            paymentMethod: value.paymentMethod,
            transactionId: `TXN-${nanoid(10)}`,
            status: "completed", // Simplified for demo; integrate real payment gateway in production
        });

        await payment.save();
        await payment.populate("user", "username email");

        console.log(`Payment created: ${payment.transactionId} by ${req.user.email}`);

        res.status(201).json({
            message: "Payment processed successfully",
            payment,
        });
    } catch (err) {
        console.error("Create payment error:", err);
        res.status(500).json({ message: "Error processing payment" });
    }
});

// Get payment status
router.get("/:paymentId", authenticate, async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.paymentId)
            .populate("user", "username email")
            .populate("appointment", "startTime endTime")
            .populate("service", "name price");

        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }

        if (req.user.role !== "admin" && payment.user.toString() !== req.user.userId) {
            return res.status(403).json({ message: "Access denied" });
        }

        res.json({ payment });
    } catch (err) {
        console.error("Get payment error:", err);
        res.status(500).json({ message: "Error fetching payment" });
    }
});

export default router;

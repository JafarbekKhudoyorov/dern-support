import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.GMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.GMAIL_PORT) || 587,
    secure: process.env.GMAIL_SECURE === 'true',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    },
    tls: { rejectUnauthorized: false }
});

transporter.sendMail({
    from: process.env.GMAIL_FROM || 'Dern Support <sadiridinovotabek@gmail.com>',
    to: 'use4552@gmail.com', // Test with your email
    subject: 'Test Email',
    text: 'This is a test email from Dern-Support backend.',
}).then(() => console.log('Email sent successfully')).catch(err => console.error('Email error:', err));

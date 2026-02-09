import nodemailer from "nodemailer";
import { HelpMessage } from "../models/helpMessage.js";

export const helpController = async (req, res) => {
  const { name, email, message } = req.body;

  const createdBy = req.user.id;

  // Validate input
  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  try {
    // Save to database first
    const newMessage = new HelpMessage({ name, email, message, createdBy });
    await newMessage.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      pool: true,
      maxConnections: 5,
      rateLimit: 5,
    });

    const mailOptions = {
      from: email,
      to: process.env.EMAIL_USER,
      subject: `Help Message from ${name}`,
      html: `
            <h3>New Message from Contact Form</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Message:</strong></p>
            <p>${message}</p>
            <hr>
            <p>Received at: ${new Date().toLocaleString()}</p>
            `,
    };
    await transporter.sendMail(mailOptions, (error) => {
      if (error) {
        console.error("Email delivery failed: ", error);
      }
    });

    res
      .status(200)
      .json({ success: true, message: "Message sent successfully!" });
  } catch (error) {
    console.error("Error sending message: ", error);
    res
      .status(500)
      .json({ success: false, message: error.message });
  }
};

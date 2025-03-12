require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");

const Contact = require("./models/contact");
const Booking = require("./models/booking");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// ================================
// API Endpoints
// ================================

// 📌 Contact Form API
app.post("/api/contact", async (req, res) => {
  const { name, phone, message } = req.body;
  try {
    const newContact = new Contact({ name, phone, message });
    await newContact.save();
    console.log("📩 Contact Received:", { name, phone, message });
    res.json({ success: true, message: "Contact message received and saved." });
  } catch (error) {
    console.error("❌ Error saving contact:", error);
    res.status(500).json({ success: false, message: "Error saving contact message." });
  }
});

// 📌 Booking API
app.post("/api/book", async (req, res) => {
  const { name, phone, vehicle, issue, datetime } = req.body;
  try {
    const newBooking = new Booking({ name, phone, vehicle, issue, datetime });
    await newBooking.save();
    console.log("🔧 Booking Received:", { name, phone, vehicle, issue, datetime });
    res.json({ success: true, message: "Booking confirmed and saved." });
  } catch (error) {
    console.error("❌ Error saving booking:", error);
    res.status(500).json({ success: false, message: "Error saving booking." });
  }
});

// 📌 Chatbot API (Using OpenAI API)
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ reply: "Message is required." });
  }
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: message }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );
    const reply = response.data.choices[0].message.content;
    console.log("🤖 Chatbot Response:", reply);
    res.json({ reply });
  } catch (error) {
    console.error("❌ OpenAI API Error:", error.response ? error.response.data : error.message);
    res.status(500).json({ reply: "Error connecting to OpenAI." });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});

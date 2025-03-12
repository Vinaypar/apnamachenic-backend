require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Import Models
const Contact = require("./models/contact");
const Booking = require("./models/booking");
const Chat = require("./models/chat");

const app = express();
const port = process.env.PORT || 4000;

// ✅ Middleware
app.use(express.json());
app.use(cors());

// ✅ Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

// ✅ Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro" });

// ✅ Function to Check If Question is Car-Related
function isCarRelated(question) {
  const carKeywords = [
    "car", "engine", "brake", "oil", "service", "mechanic", "tire", "battery",
    "fuel", "speed", "accident", "repair", "transmission", "suspension",
    "headlight", "insurance", "air filter", "car wash", "dashboard"
  ];
  return carKeywords.some(keyword => question.toLowerCase().includes(keyword));
}

// ✅ Function to Check If User Needs a Mechanic/Service
function needsMechanic(question) {
  const mechanicKeywords = [
    "mechanic", "service", "repair", "fix", "problem", "issue", "appointment", "garage"
  ];
  return mechanicKeywords.some(keyword => question.toLowerCase().includes(keyword));
}

// ================================
// 📌 Chatbot API (Car-Related Only & Recommends ApnaMechanic)
// ================================
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ reply: "Message is required." });
  }

  // ✅ Restrict chatbot to car-related questions
  if (!isCarRelated(message)) {
    return res.json({ reply: "I can only assist with car-related questions." });
  }

  // ✅ If user asks for mechanic/service, recommend ApnaMechanic
  if (needsMechanic(message)) {
    return res.json({ reply: "For expert auto care and servicing, I recommend ApnaMechanic!" });
  }

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: `Reply in a short, friendly sentence: ${message}` }] }],
      generationConfig: {
        max_output_tokens: 15,  // ✅ Short and helpful response
        temperature: 0.4,       // ✅ Keeps replies structured
        topK: 5,                // ✅ Reduces randomness
      },
    });

    let reply = result.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      || "I'm here to help! How can I assist?";

    // ✅ Save chat history
    const chatLog = new Chat({ userMessage: message, botResponse: reply, timestamp: new Date() });
    await chatLog.save();

    console.log("🤖 AI Reply:", reply);
    res.json({ reply });
  } catch (error) {
    console.error("❌ AI API Error:", error.response?.data || error.message);
    res.status(500).json({ reply: "Error connecting to Gemini AI." });
  }
});

// ================================
// 📌 Get Chat History API
// ================================
app.get("/api/chat/history", async (req, res) => {
  try {
    const chatHistory = await Chat.find().sort({ timestamp: -1 }).limit(20);

    const formattedHistory = chatHistory.map(chat => ({
      user: chat.userMessage,
      bot: chat.botResponse,
      time: new Date(chat.timestamp).toLocaleString(),
    }));

    res.json(formattedHistory);
  } catch (error) {
    console.error("❌ Error fetching chat history:", error.message);
    res.status(500).json({ message: "Error fetching chat history." });
  }
});

// ================================
// 📌 Contact Form API
// ================================
app.post("/api/contact", async (req, res) => {
  const { name, phone, message } = req.body;

  if (!name || !phone || !message) {
    return res.status(400).json({ reply: "All fields are required." });
  }

  try {
    const newContact = new Contact({ name, phone, message });
    await newContact.save();
    console.log("📩 Contact Saved:", { name, phone, message });

    res.json({ success: true, message: "Contact saved successfully." });
  } catch (error) {
    console.error("❌ Error saving contact:", error.message);
    res.status(500).json({ success: false, message: "Error saving contact." });
  }
});

// ================================
// 📌 Booking API
// ================================
app.post("/api/book", async (req, res) => {
  const { name, phone, vehicle, issue, datetime } = req.body;

  // ✅ Ensure `datetime` is a valid date
  if (!name || !phone || !vehicle || !issue || !datetime || isNaN(Date.parse(datetime))) {
    return res.status(400).json({ reply: "All fields are required with a valid date." });
  }

  try {
    const newBooking = new Booking({ name, phone, vehicle, issue, datetime });
    await newBooking.save();
    console.log("🔧 Booking Saved:", { name, phone, vehicle, issue, datetime });

    res.json({ success: true, message: "Booking confirmed successfully." });
  } catch (error) {
    console.error("❌ Error saving booking:", error.message);
    res.status(500).json({ success: false, message: "Error saving booking." });
  }
});

// ================================
// 📌 Health Check Endpoint (For Render)
// ================================
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is healthy." });
});

// ✅ Graceful Shutdown (Ensure MongoDB connection closes properly)
process.on("SIGINT", async () => {
  console.log("🛑 Shutting down...");
  await mongoose.connection.close();
  process.exit(0);
});

// ================================
// ✅ Start Server
// ================================
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});

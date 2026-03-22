const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  notificationTitle: {
    type: String,
    required: true
  },
  notificationMessage: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ["announcement", "task", "project", "meeting"],
    default: "announcement"
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  status: {
    type: String,
    enum: ["unread", "read"],
    default: "unread"
  }
}, { timestamps: true });

module.exports = mongoose.model("Notification", notificationSchema);
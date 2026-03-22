const mongoose = require("mongoose");

const worksheetSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    developer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    tester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    status: {
      type: String,
      enum: [
        "in-progress",
        "completed",
        "testing",
        "bug-found",
        "approved",
      ],
      default: "in-progress",
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    deadline: {
      type: Date,
      required: true,
    },

    bugs: {
      type: Number,
      default: 0,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    history: [{
      date: {
        type: Date,
        default: Date.now
      },
      action: {
        type: String,
        required: true
      },
      details: {
        type: String,
        default: ""
      }
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Worksheet", worksheetSchema);

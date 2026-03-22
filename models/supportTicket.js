const mongoose = require("mongoose");
const supportTicketSchema = new mongoose.Schema(
{
  employeeId: {
    type: String,
    required: true,
    index: true
  },

  subject: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: ["Open", "In Progress", "Resolved"],
    default: "Open"
  }

},
{ timestamps: true }
);

module.exports = mongoose.model("SupportTicket", supportTicketSchema);
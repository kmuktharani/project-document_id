const SupportTicket = require("../models/supportTicket");
exports.createTicket = async (req, res) => {

  try {

    const { subject, description } = req.body;

    if (!subject || !description) {
      return res.status(400).json({
        success: false,
        message: "Subject and description are required"
      });
    }

    const ticket = await SupportTicket.create({
      employeeId: req.user.id,
      subject,
      description
    });

    res.status(201).json({
      success: true,
      message: "Support ticket created",
      data: ticket
    });

  } catch (error) {

    console.error("CREATE TICKET ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });

  }

};



exports.getTickets = async (req, res) => {

  try {

    const tickets = await SupportTicket.find({
      employeeId: req.user.id
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets
    });

  } catch (error) {

    console.error("GET TICKETS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });

  }

};
const Worksheet = require("../models/worksheetModel");
const User = require("../models/user");

// CREATE WORKSHEET (Manager only)
exports.createWorksheet = async (req, res) => {
  try {
    const { title, description, developerId, priority, deadline } = req.body;
    
    // Validate developer exists and has correct role
    const developer = await User.findById(developerId);
    if (!developer) {
      return res.status(404).json({ message: "Developer not found" });
    }
    
    if (!['employee', 'team_lead'].includes(developer.role)) {
      return res.status(400).json({ message: "Developer must be an employee or team lead" });
    }
    
    const worksheetData = {
      title,
      description,
      developer: developerId,
      priority: priority || 'medium',
      deadline,
      history: [{
        action: "Task Created",
        details: `Task assigned to developer: ${developer.firstName} ${developer.lastName} (${developer.username})`
      }]
    };
    
    const worksheet = await Worksheet.create(worksheetData);
    const populated = await Worksheet.findById(worksheet._id)
      .populate('developer', 'firstName lastName username email role')
      .populate('tester', 'firstName lastName username email role');
    
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET ALL WORKSHEETS (Manager only)
exports.getAllWorksheets = async (req, res) => {
  try {
    const worksheets = await Worksheet.find()
      .populate('developer', 'firstName lastName username email role')
      .populate('tester', 'firstName lastName username email role')
      .sort({ createdAt: -1 });
    res.status(200).json(worksheets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET SINGLE WORKSHEET
exports.getWorksheetById = async (req, res) => {
  try {
    const worksheet = await Worksheet.findById(req.params.id)
      .populate('developer', 'firstName lastName username email role')
      .populate('tester', 'firstName lastName username email role');

    if (!worksheet) {
      return res.status(404).json({ message: "Worksheet not found" });
    }

    res.status(200).json(worksheet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE WORKSHEET (Manager only)
exports.updateWorksheet = async (req, res) => {
  try {
    const updated = await Worksheet.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    )
    .populate('developer', 'firstName lastName username email role')
    .populate('tester', 'firstName lastName username email role');

    if (!updated) {
      return res.status(404).json({ message: "Worksheet not found" });
    }

    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// DELETE WORKSHEET
exports.deleteWorksheet = async (req, res) => {
  try {
    const deleted = await Worksheet.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Worksheet not found" });
    }

    res.status(200).json({ message: "Worksheet deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// MARK WORKSHEET AS COMPLETED (Manager only)
exports.markAsCompleted = async (req, res) => {
  try {
    const currentWorksheet = await Worksheet.findById(req.params.id)
      .populate('developer', 'firstName lastName username');
      
    if (!currentWorksheet) {
      return res.status(404).json({ message: "Worksheet not found" });
    }

    const worksheet = await Worksheet.findByIdAndUpdate(
      req.params.id,
      {
        status: "completed",
        $push: {
          history: {
            action: "Task Completed",
            details: `Developer ${currentWorksheet.developer.firstName} ${currentWorksheet.developer.lastName} (${currentWorksheet.developer.username}) marked the task as completed`
          }
        }
      },
      { new: true, runValidators: true }
    )
    .populate('developer', 'firstName lastName username email role')
    .populate('tester', 'firstName lastName username email role');

    res.status(200).json(worksheet);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ASSIGN TESTER (Manager only)
exports.assignTester = async (req, res) => {
  try {
    const { testerId } = req.body;

    if (!testerId) {
      return res.status(400).json({ message: "Tester ID is required" });
    }
    
    // Validate tester exists and has correct role
    const tester = await User.findById(testerId);
    if (!tester) {
      return res.status(404).json({ message: "Tester not found" });
    }
    
    if (!['employee', 'team_lead'].includes(tester.role)) {
      return res.status(400).json({ message: "Tester must be an employee or team lead" });
    }

    const currentWorksheet = await Worksheet.findById(req.params.id)
      .populate('developer', 'firstName lastName username');
      
    if (!currentWorksheet) {
      return res.status(404).json({ message: "Worksheet not found" });
    }

    const worksheet = await Worksheet.findByIdAndUpdate(
      req.params.id,
      {
        tester: testerId,
        status: "testing",
        $push: {
          history: {
            action: "Assigned to Tester",
            details: `Task moved from developer ${currentWorksheet.developer.firstName} ${currentWorksheet.developer.lastName} to tester ${tester.firstName} ${tester.lastName} (${tester.username}) for testing`
          }
        }
      },
      { new: true, runValidators: true }
    )
    .populate('developer', 'firstName lastName username email role')
    .populate('tester', 'firstName lastName username email role');

    res.status(200).json(worksheet);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// START TESTING
exports.startTesting = async (req, res) => {
  try {
    const worksheet = await Worksheet.findByIdAndUpdate(
      req.params.id,
      { status: "testing" },
      { new: true, runValidators: true }
    );

    if (!worksheet) {
      return res.status(404).json({ message: "Worksheet not found" });
    }

    res.status(200).json(worksheet);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// REPORT BUG (Manager only)
exports.reportBug = async (req, res) => {
  try {
    const { remarks } = req.body;

    const currentWorksheet = await Worksheet.findById(req.params.id)
      .populate('developer', 'firstName lastName username')
      .populate('tester', 'firstName lastName username');
      
    if (!currentWorksheet) {
      return res.status(404).json({ message: "Worksheet not found" });
    }

    const worksheet = await Worksheet.findByIdAndUpdate(
      req.params.id,
      {
        status: "bug-found",
        $inc: { bugs: 1 },
        remarks: remarks || "",
        $push: {
          history: {
            action: "Bugs Found",
            details: `Tester ${currentWorksheet.tester.firstName} ${currentWorksheet.tester.lastName} (${currentWorksheet.tester.username}) reported bugs. Task reassigned to developer ${currentWorksheet.developer.firstName} ${currentWorksheet.developer.lastName} for fixes. Details: ${remarks || "No details provided"}`
          }
        }
      },
      { new: true, runValidators: true }
    )
    .populate('developer', 'firstName lastName username email role')
    .populate('tester', 'firstName lastName username email role');

    res.status(200).json(worksheet);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// APPROVE WORKSHEET (Manager only)
exports.approveWorksheet = async (req, res) => {
  try {
    const currentWorksheet = await Worksheet.findById(req.params.id)
      .populate('tester', 'firstName lastName username');
      
    if (!currentWorksheet) {
      return res.status(404).json({ message: "Worksheet not found" });
    }

    const worksheet = await Worksheet.findByIdAndUpdate(
      req.params.id,
      {
        status: "approved",
        $push: {
          history: {
            action: "Task Approved",
            details: `Tester ${currentWorksheet.tester.firstName} ${currentWorksheet.tester.lastName} (${currentWorksheet.tester.username}) approved the task. No bugs found. Task completed successfully.`
          }
        }
      },
      { new: true, runValidators: true }
    )
    .populate('developer', 'firstName lastName username email role')
    .populate('tester', 'firstName lastName username email role');

    res.status(200).json(worksheet);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// REASSIGN TO DEVELOPER (Manager only)
exports.reassignToDeveloper = async (req, res) => {
  try {
    const currentWorksheet = await Worksheet.findById(req.params.id)
      .populate('developer', 'firstName lastName username')
      .populate('tester', 'firstName lastName username');
      
    if (!currentWorksheet) {
      return res.status(404).json({ message: "Worksheet not found" });
    }

    const worksheet = await Worksheet.findByIdAndUpdate(
      req.params.id,
      {
        status: "in-progress",
        $push: {
          history: {
            action: "Reassigned to Developer",
            details: `Task sent back from tester ${currentWorksheet.tester.firstName} ${currentWorksheet.tester.lastName} to developer ${currentWorksheet.developer.firstName} ${currentWorksheet.developer.lastName} (${currentWorksheet.developer.username}) for bug fixes`
          }
        }
      },
      { new: true, runValidators: true }
    )
    .populate('developer', 'firstName lastName username email role')
    .populate('tester', 'firstName lastName username email role');

    res.status(200).json(worksheet);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

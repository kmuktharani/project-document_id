const { sentMails, drafts, notifications } = require("../data/mailData");
const { verifyToken } = require("../utils/jwt");
const User = require("../models/user");

function getUserRole(req) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = verifyToken(token);
      return decoded.role || "manager";
    }
  } catch (err) {
  }
  return "manager";
}

const getSentMails = (req, res) => {
  const role = getUserRole(req);
  const filtered = sentMails.filter(m => m.senderRole === role || m.to === req.user?.email);
  res.json(filtered);
};

const getDrafts = (req, res) => {
  const role = getUserRole(req);
  const filtered = drafts.filter(d => d.senderRole === role);
  res.json(filtered);
};

const getNotifications = (req, res) => {
  const role = getUserRole(req);
  const filtered = notifications.filter(n => n.forRole === role || n.forRole === "all");
  res.json(filtered);
};

const getIdleAlerts = async (req, res) => {
  try {
    const managerId = req.user.id;
    const manager = await User.findById(managerId).select('email role department');
    
    // Verify manager has role='manager' AND department='MANAGER'
    if (manager.role !== 'manager' || manager.department !== 'MANAGER') {
      return res.status(403).json({ error: "Access denied. Only managers can view idle alerts" });
    }
    
    // Get idle alerts from mail center
    const idleAlerts = sentMails.filter(m => 
      m.type === 'idle-alert' && 
      m.to === manager.email
    );
    
    // Get all idle employees (employee and team_lead roles only)
    const idleEmployees = await User.find({
      status: 'idle',
      isDeleted: false,
      role: { $in: ['employee', 'team_lead'] }
    }).select('firstName lastName username email lastActive status');
    
    const currentIdleAlerts = idleEmployees.map(emp => {
      const idleDuration = Math.floor((Date.now() - new Date(emp.lastActive)) / 60000);
      return {
        employeeId: emp._id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        employeeUsername: emp.username,
        employeeEmail: emp.email,
        idleDuration: `${idleDuration} minutes`,
        lastActive: new Date(emp.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: emp.status
      };
    });
    
    res.json([...currentIdleAlerts, ...idleAlerts]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch idle alerts" });
  }
};

const sendMail = (req, res) => {
  const { to, subject, message, senderId, senderRole } = req.body;

  if (!to || !subject || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const role = senderRole || getUserRole(req);

  const newMail = {
    id: sentMails.length + 1,
    to,
    subject,
    message,
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    senderId: senderId || req.user?.id,
    senderRole: role,
  };

  sentMails.push(newMail);
  res.status(201).json(newMail);
};

const sendWarningToEmployee = async (req, res) => {
  try {
    const { employeeId, message } = req.body;
    const managerId = req.user.id;
    
    const manager = await User.findById(managerId).select('firstName lastName email role department');
    
    // Verify manager has role='manager' AND department='MANAGER'
    if (manager.role !== 'manager' || manager.department !== 'MANAGER') {
      return res.status(403).json({ error: "Access denied. Only managers can send warnings" });
    }
    
    const employee = await User.findById(employeeId).select('firstName lastName email username role');
    
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }
    
    // Only allow sending warnings to employee and team_lead roles
    if (!['employee', 'team_lead'].includes(employee.role)) {
      return res.status(403).json({ error: "Can only send warnings to employees and team leads" });
    }
    
    const warningMail = {
      id: sentMails.length + 1,
      to: employee.email,
      subject: 'Idle Status Warning',
      message: `Dear ${employee.firstName} ${employee.lastName},\n\nYou have been detected as idle. Please resume your work activities.\n\nMessage from Manager:\n${message}\n\nBest regards,\n${manager.firstName} ${manager.lastName}`,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      senderId: managerId,
      senderRole: 'manager',
      type: 'idle-warning'
    };
    
    sentMails.push(warningMail);
    res.status(201).json({ success: true, message: "Warning sent to employee", data: warningMail });
  } catch (error) {
    res.status(500).json({ error: "Failed to send warning" });
  }
};

module.exports = { getSentMails, getDrafts, getNotifications, sendMail, getIdleAlerts, sendWarningToEmployee };

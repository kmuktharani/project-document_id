const Announcement = require("../models/announcement");
const Team = require("../models/Team");
const User = require("../models/user");
const { createNotification } = require("./notificationController");

// CREATE ANNOUNCEMENT
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, message, audienceType, teams, priority } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    let allowedTeams = [];

    // ADMIN
    if (user.role === "admin") {
      allowedTeams = teams || [];
    }

    // HR
    else if (user.role === "hr") {
      if (audienceType === "teams") {
        allowedTeams = teams || [];
      }
    }

    // MANAGER
    else if (user.role === "manager") {
      const managerTeams = await Team.find({ manager: user._id });
      const managerTeamIds = managerTeams.map(t => t._id.toString());

      if (teams?.length) {
        const invalid = teams.filter(t => !managerTeamIds.includes(t));
        if (invalid.length) {
          return res.status(403).json({
            message: "Managers can only send announcements to their teams"
          });
        }
        allowedTeams = teams;
      } else {
        allowedTeams = managerTeamIds;
      }
    }

    // TEAM LEAD
    else if (user.role === "team_lead") {
      const team = await Team.findOne({ teamLead: user._id });

      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      allowedTeams = [team._id];
    }

    else {
      return res.status(403).json({
        message: "You don't have permission to create announcements"
      });
    }

    // 🔥 FINAL AUDIENCE FIX
    const finalAudience = user.role === "team_lead" ? "teams" : audienceType;

    // CREATE ANNOUNCEMENT
    const announcement = await Announcement.create({
      title,
      message,
      createdBy: user.username,
      creatorRole: user.role,
      audienceType: finalAudience,
      teams: allowedTeams,
      priority: priority || "medium"
    });

    // 🔔 SEND NOTIFICATIONS
    let usersToNotify = [];

    // ALL USERS
    if (finalAudience === "all") {
      usersToNotify = await User.find({});
    }

    // MANAGERS ONLY
    else if (finalAudience === "managers") {
      usersToNotify = await User.find({ role: "manager" });
    }

    // HR ONLY
    else if (finalAudience === "hr") {
      usersToNotify = await User.find({ role: "hr" });
    }

    // TEAM LEADS ONLY
    else if (finalAudience === "team_leads") {
      usersToNotify = await User.find({ role: "team_lead" });
    }

    // TEAMS - includes team lead + members
    else if (finalAudience === "teams") {
      const teamsData = await Team.find({ _id: { $in: allowedTeams } });
      const memberIds = teamsData.flatMap(t => t.members);
      const teamLeadIds = teamsData.map(t => t.teamLead);
      const allIds = [...memberIds, ...teamLeadIds];

      usersToNotify = await User.find({
        _id: { $in: allIds }
      });
    }

    // ✅ REMOVE DUPLICATES
    const uniqueUsers = [
      ...new Map(usersToNotify.map(u => [u._id.toString(), u])).values()
    ];

    // CREATE NOTIFICATION
    for (let u of uniqueUsers) {
      await createNotification(
        u._id,
        "New Announcement",
        title,
        "announcement",
        announcement._id
      );
    }

    res.status(201).json({
      success: true,
      data: announcement
    });

  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
};



// GET ANNOUNCEMENTS
exports.getAnnouncements = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    let userTeams = user.teams || [];

    const teamsAsLeadOrMember = await Team.find({
      $or: [
        { teamLead: user._id },
        { members: user._id }
      ]
    });

    const additionalTeamIds = teamsAsLeadOrMember.map(t => t._id);
    userTeams = [...userTeams, ...additionalTeamIds];

    let query = {
      isActive: true,
      $or: [
        { audienceType: "all" },
        { $and: [{ audienceType: "teams" }, { teams: { $in: userTeams } }] }
      ]
    };

    if (user.role === "manager") {
      query.$or.push({ audienceType: "managers" });
    }

    if (user.role === "hr") {
      query.$or.push({ audienceType: "hr" });
    }

    if (user.role === "team_lead") {
      query.$or.push({ audienceType: "team_leads" });
    }

    const announcements = await Announcement.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    const result = announcements.map(a => {
      const isRead = a.readBy?.some(r => r.userId === user.username);
      return { ...a, isRead };
    });

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
};



// MARK AS READ
exports.markAsRead = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });

    const alreadyRead = announcement.readBy.some(
      r => r.userId === user.username
    );

    if (!alreadyRead) {
      announcement.readBy.push({
        userId: user.username,
        readAt: new Date()
      });
      await announcement.save();
    }

    res.json({
      success: true,
      message: "Marked as read"
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



// UPDATE
exports.updateAnnouncement = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });

    if (announcement.createdBy !== user.username) {
      return res.status(403).json({ message: "Only the creator can edit this announcement" });
    }

    const { title, message, priority } = req.body;
    if (title) announcement.title = title;
    if (message) announcement.message = message;
    if (priority) announcement.priority = priority;

    await announcement.save();
    res.json({ success: true, data: announcement });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



// DELETE
exports.deleteAnnouncement = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });

    if (announcement.createdBy !== user.username) {
      return res.status(403).json({ message: "Only the creator can delete this announcement" });
    }

    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Announcement deleted" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
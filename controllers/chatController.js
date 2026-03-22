const { Group, Message } = require("../models/Message");
const User = require("../models/user");
const fs = require("fs");
const path = require("path");

exports.sendMessage = async (req, res) => {
  try {
    const senderUser = await User.findById(req.user.id);
    const sender = senderUser.username;
    const { receiverEmployeeId, message } = req.body;

    if (!receiverEmployeeId) {
      return res.status(400).json({ success: false, message: "receiverEmployeeId required" });
    }

    const msgData = {
      senderEmployeeId: sender,
      receiverEmployeeId,
      message,
      readBy: [sender]
    };

    if (req.file) {
      const uploadDir = path.join(__dirname, "../uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
      }
      const fileName = Date.now() + "-" + req.file.originalname;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, req.file.buffer);
      msgData.fileUrl = `/uploads/${fileName}`;
      msgData.fileName = fileName;
    }

    const msg = await Message.create(msgData);

    const io = req.app.get("io");
    if (io) {
      // Include sender's full name so frontend notifications show real name
      const senderFullName = `${senderUser.firstName || ''} ${senderUser.lastName || ''}`.trim() || sender;
      io.to(receiverEmployeeId).emit("chat:receive", {
        ...msg.toObject(),
        senderFullName,
      });
    }

    const response = msg.toObject();
    delete response.groupId;
    if (!response.fileUrl) {
      delete response.fileUrl;
      delete response.fileName;
    }

    res.status(201).json({ success: true, data: response });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createGroup = async (req, res) => {
  try {
    const adminUser = await User.findById(req.user.id);
    const admin = adminUser.username;
    const { groupName, members = [] } = req.body;

    if (!groupName) {
      return res.status(400).json({ success: false, message: "groupName required" });
    }

    const groupId = "GRP-" + Date.now();
    const groupMembers = [
      { employeeId: admin, role: "admin" },
      ...members.map(m => ({ employeeId: m }))
    ];

    await Group.create({
      groupId,
      groupName,
      members: groupMembers
    });

    await Message.create({
      senderEmployeeId: admin,
      groupId,
      message: "Group created",
      readBy: [admin]
    });

    res.json({ success: true, groupId, groupName, members: groupMembers });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.sendGroupMessage = async (req, res) => {
  try {
    const senderUser = await User.findById(req.user.id);
    const sender = senderUser.username;
    const { groupName, message } = req.body;

    if (!groupName) {
      return res.status(400).json({ success: false, message: "groupName required" });
    }

    const group = await Group.findOne({ groupName });
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const isMember = group.members.some(m => m.employeeId === sender);
    if (!isMember) {
      return res.status(403).json({ success: false, message: "You are not a member of this group" });
    }

    const msgData = {
      senderEmployeeId: sender,
      groupId: group.groupId,
      message,
      readBy: [sender]
    };

    if (req.file) {
      const uploadDir = path.join(__dirname, "../uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
      }
      const fileName = Date.now() + "-" + req.file.originalname;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, req.file.buffer);
      msgData.fileUrl = `/uploads/${fileName}`;
      msgData.fileName = fileName;
    }

    const msg = await Message.create(msgData);

    const io = req.app.get("io");
    if (io) {
      // Include sender's full name so frontend can display it without a lookup
      const senderFullName = `${senderUser.firstName || ''} ${senderUser.lastName || ''}`.trim() || sender;
      io.to(group.groupId).emit("group:receive", {
        ...msg.toObject(),
        groupName: group.groupName,
        senderFullName,
      });
    }

    const response = msg.toObject();
    delete response.receiverEmployeeId;
    if (!response.fileUrl) {
      delete response.fileUrl;
      delete response.fileName;
    }

    res.json({ success: true, data: response });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getChatHistory = async (req, res) => {
  try {
    const { user1, user2 } = req.params;

    const query = {
      $or: [
        { senderEmployeeId: user1, receiverEmployeeId: user2 },
        { senderEmployeeId: user2, receiverEmployeeId: user1 }
      ]
    };

    const messages = await Message.find(query).sort({ createdAt: 1 }).limit(50);

    const cleanMessages = messages.map(m => {
      const obj = m.toObject();
      delete obj.groupId;
      if (!obj.fileUrl) {
        delete obj.fileUrl;
        delete obj.fileName;
      }
      return obj;
    });

    res.json({ success: true, data: cleanMessages });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getGroupChatHistory = async (req, res) => {
  try {
    const { groupName } = req.params;

    const group = await Group.findOne({ groupName });
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const messages = await Message.find({ groupId: group.groupId }).sort({ createdAt: 1 }).limit(50);

    const cleanMessages = messages.map(m => {
      const obj = m.toObject();
      delete obj.receiverEmployeeId;
      if (!obj.fileUrl) {
        delete obj.fileUrl;
        delete obj.fileName;
      }
      return obj;
    });

    res.json({ success: true, data: cleanMessages });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const username = currentUser.username;
    const { groupName, newGroupName, addMembers, removeMembers } = req.body;

    if (!groupName) {
      return res.status(400).json({ success: false, message: "groupName required" });
    }

    const group = await Group.findOne({ groupName });
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const isAdmin = group.members.some(m => m.employeeId === username && m.role === "admin");
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Only admin can update group" });
    }

    if (newGroupName) {
      group.groupName = newGroupName;
    }

    if (addMembers && addMembers.length > 0) {
      addMembers.forEach(m => {
        if (!group.members.some(mem => mem.employeeId === m)) {
          group.members.push({ employeeId: m, role: "member" });
        }
      });
    }

    if (removeMembers && removeMembers.length > 0) {
      group.members = group.members.filter(m => !removeMembers.includes(m.employeeId));
    }

    await group.save();

    res.json({ success: true, message: "Group updated", data: group });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { messageId } = req.body;
    const currentUser = await User.findById(req.user.id);
    const user = currentUser.username;

    if (!messageId) {
      return res.status(400).json({ success: false, message: "messageId required" });
    }

    await Message.findByIdAndUpdate(
      messageId,
      { $addToSet: { readBy: user } }
    );

    res.json({ success: true, message: "Message marked as read" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Mark all messages as read in a chat conversation
exports.markAllAsRead = async (req, res) => {
  try {
    const { otherUser } = req.body;
    const currentUser = await User.findById(req.user.id);
    const user = currentUser.username;

    if (!otherUser) {
      return res.status(400).json({ success: false, message: "otherUser required" });
    }

    // Mark all messages in this conversation as read
    const result = await Message.updateMany(
      {
        $or: [
          { senderEmployeeId: otherUser, receiverEmployeeId: user },
          { senderEmployeeId: user, receiverEmployeeId: otherUser }
        ],
        readBy: { $ne: user } // Only update messages not already read by user
      },
      { $addToSet: { readBy: user } }
    );

    res.json({ 
      success: true, 
      message: "All messages marked as read",
      updatedCount: result.modifiedCount
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Mark all group messages as read
exports.markGroupAllAsRead = async (req, res) => {
  try {
    const { groupName } = req.body;
    const currentUser = await User.findById(req.user.id);
    const user = currentUser.username;

    if (!groupName) {
      return res.status(400).json({ success: false, message: "groupName required" });
    }

    const group = await Group.findOne({ groupName });
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // Check if user is member of the group
    const isMember = group.members.some(m => m.employeeId === user);
    if (!isMember) {
      return res.status(403).json({ success: false, message: "You are not a member of this group" });
    }

    // Mark all group messages as read
    const result = await Message.updateMany(
      {
        groupId: group.groupId,
        readBy: { $ne: user } // Only update messages not already read by user
      },
      { $addToSet: { readBy: user } }
    );

    res.json({ 
      success: true, 
      message: "All group messages marked as read",
      updatedCount: result.modifiedCount
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get unread message count for a conversation
exports.getUnreadCount = async (req, res) => {
  try {
    const { otherUser } = req.params;
    const currentUser = await User.findById(req.user.id);
    const user = currentUser.username;

    // Count unread messages from the other user
    const unreadCount = await Message.countDocuments({
      senderEmployeeId: otherUser,
      receiverEmployeeId: user,
      readBy: { $ne: user }
    });

    res.json({ 
      success: true, 
      unreadCount,
      data: { otherUser, unreadCount }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get unread message count for a group
exports.getGroupUnreadCount = async (req, res) => {
  try {
    const { groupName } = req.params;
    const currentUser = await User.findById(req.user.id);
    const user = currentUser.username;

    const group = await Group.findOne({ groupName });
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // Count unread group messages (exclude own messages)
    const unreadCount = await Message.countDocuments({
      groupId: group.groupId,
      senderEmployeeId: { $ne: user },
      readBy: { $ne: user }
    });

    res.json({ 
      success: true, 
      unreadCount,
      data: { groupName, unreadCount }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get all conversations with unread counts (for direct messages)
exports.getConversationsWithUnreadCount = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const user = currentUser.username;

    // Get all unique conversations - simplified approach
    const allMessages = await Message.find({
      $or: [
        { senderEmployeeId: user },
        { receiverEmployeeId: user }
      ],
      groupId: null // Only direct messages
    }).sort({ createdAt: -1 });

    // Group messages by conversation
    const conversationMap = new Map();
    
    for (const message of allMessages) {
      const otherUser = message.senderEmployeeId === user ? 
        message.receiverEmployeeId : message.senderEmployeeId;
      
      if (!conversationMap.has(otherUser)) {
        // Count unread messages from this user
        const unreadCount = await Message.countDocuments({
          senderEmployeeId: otherUser,
          receiverEmployeeId: user,
          readBy: { $ne: user }
        });
        
        conversationMap.set(otherUser, {
          otherUser,
          lastMessage: message,
          unreadCount
        });
      }
    }

    // Convert map to array and get user details
    const conversations = Array.from(conversationMap.values());
    
    const conversationsWithUserDetails = await Promise.all(
      conversations.map(async (conv) => {
        const otherUserDetails = await User.findOne({ username: conv.otherUser })
          .select('firstName lastName username role department');
        
        return {
          otherUser: conv.otherUser,
          otherUserDetails: otherUserDetails || null,
          lastMessage: {
            message: conv.lastMessage.message,
            createdAt: conv.lastMessage.createdAt,
            senderEmployeeId: conv.lastMessage.senderEmployeeId
          },
          unreadCount: conv.unreadCount
        };
      })
    );

    // Sort by last message time
    conversationsWithUserDetails.sort((a, b) => 
      new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
    );

    res.json({ 
      success: true, 
      data: conversationsWithUserDetails
    });
  } catch (e) {
    console.error('getConversationsWithUnreadCount error:', e);
    res.status(500).json({ success: false, message: "Server error", error: e.message });
  }
};

// Mark all messages as read when user opens a chat
exports.markChatAsRead = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const user = currentUser.username;
    const { otherUser } = req.body;

    if (!otherUser) {
      return res.status(400).json({ success: false, message: "otherUser required" });
    }

    // Mark all unread messages in this chat as read
    const result = await Message.updateMany(
      {
        $or: [
          { senderEmployeeId: otherUser, receiverEmployeeId: user },
          { senderEmployeeId: user, receiverEmployeeId: otherUser }
        ],
        readBy: { $ne: user } // Only messages not already read by current user
      },
      { $addToSet: { readBy: user } }
    );

    // Emit read receipt to the other user
    const io = req.app.get("io");
    if (io) {
      io.to(otherUser).emit("chat:read", {
        readBy: user,
        chatWith: user,
        readCount: result.modifiedCount
      });
    }

    res.json({ 
      success: true, 
      message: `${result.modifiedCount} messages marked as read`,
      readCount: result.modifiedCount
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Mark all group messages as read when user opens group chat
exports.markGroupChatAsRead = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const user = currentUser.username;
    const { groupName } = req.body;

    if (!groupName) {
      return res.status(400).json({ success: false, message: "groupName required" });
    }

    const group = await Group.findOne({ groupName });
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // Check if user is member of the group
    const isMember = group.members.some(m => m.employeeId === user);
    if (!isMember) {
      return res.status(403).json({ success: false, message: "You are not a member of this group" });
    }

    // Mark all unread group messages as read
    const result = await Message.updateMany(
      {
        groupId: group.groupId,
        readBy: { $ne: user } // Only messages not already read by current user
      },
      { $addToSet: { readBy: user } }
    );

    // Emit read receipt to group members
    const io = req.app.get("io");
    if (io) {
      io.to(group.groupId).emit("group:read", {
        readBy: user,
        groupId: group.groupId,
        readCount: result.modifiedCount
      });
    }

    res.json({ 
      success: true, 
      message: `${result.modifiedCount} group messages marked as read`,
      readCount: result.modifiedCount
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get all chats with unread counts
exports.getAllChatsWithUnreadCount = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const user = currentUser.username;

    // Get all unique chat partners
    const chatPartners = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderEmployeeId: user },
            { receiverEmployeeId: user }
          ],
          groupId: null // Only direct messages
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderEmployeeId", user] },
              "$receiverEmployeeId",
              "$senderEmployeeId"
            ]
          },
          lastMessage: { $last: "$message" },
          lastMessageTime: { $last: "$createdAt" }
        }
      }
    ]);

    // Get unread counts for each chat
    const chatsWithUnreadCount = await Promise.all(
      chatPartners.map(async (chat) => {
        const unreadCount = await Message.countDocuments({
          senderEmployeeId: chat._id,
          receiverEmployeeId: user,
          readBy: { $ne: user }
        });

        // Get user details
        const userDetails = await User.findOne({ username: chat._id })
          .select('firstName lastName username role');

        return {
          chatWith: chat._id,
          userDetails,
          lastMessage: chat.lastMessage,
          lastMessageTime: chat.lastMessageTime,
          unreadCount
        };
      })
    );

    // Get group chats with unread counts
    const userGroups = await Group.find({
      'members.employeeId': user
    });

    const groupChatsWithUnreadCount = await Promise.all(
      userGroups.map(async (group) => {
        const unreadCount = await Message.countDocuments({
          groupId: group.groupId,
          senderEmployeeId: { $ne: user },
          readBy: { $ne: user }
        });

        const lastMessage = await Message.findOne({
          groupId: group.groupId
        }).sort({ createdAt: -1 });

        return {
          groupId: group.groupId,
          groupName: group.groupName,
          members: group.members,
          lastMessage: lastMessage?.message || '',
          lastMessageTime: lastMessage?.createdAt,
          unreadCount
        };
      })
    );

    res.json({ 
      success: true, 
      data: {
        directChats: chatsWithUnreadCount,
        groupChats: groupChatsWithUnreadCount
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get all groups the current user is a member of (used by /chat/groups route)
exports.getUserGroups = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const username = currentUser.username;

    // Find all groups where the user is a member
    const groups = await Group.find({ "members.employeeId": username }).lean();

    // Fetch latest message and unread count for each group
    const formattedGroups = await Promise.all(
      groups.map(async (g) => {
        const latestMsg = await Message.findOne({ groupId: g.groupId })
          .sort({ createdAt: -1 })
          .lean();

        const unreadCount = await Message.countDocuments({
          groupId: g.groupId,
          readBy: { $ne: username }
        });

        return {
          _id: g._id,
          groupId: g.groupId,
          groupName: g.groupName,
          members: g.members,
          lastMessage: latestMsg ? latestMsg.message : "",
          lastMessageTime: latestMsg ? new Date(latestMsg.createdAt).getTime() : new Date(g.createdAt || Date.now()).getTime(),
          unread: unreadCount
        };
      })
    );

    res.json({ success: true, data: formattedGroups });
  } catch (e) {
    console.error("Error fetching user groups:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
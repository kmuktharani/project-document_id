const Tracker = require("./models/Tracker");
const { Message, Group } = require("./models/Message");
const User = require("./models/user");

const onlineUsers = new Map();

function registerSocketHandlers(io) {
    io.on("connection", (socket) => {
        console.log("🔌 Client connected:", socket.id);

        // HEARTBEAT EVENT (from Electron tracker)
        socket.on("heartbeat", async (data) => {
            try {
                const { userId, activeApp, keyboardActive } = data;
                console.log(userId);

                if (!userId) return;

                await Tracker.findOneAndUpdate(
                    { UserID: userId },
                    {
                        activeApp,
                        keyboardActive,
                        status: keyboardActive ? "active" : "idle",
                        lastHeartbeat: new Date(),
                        lastStatusUpdate: new Date(),
                    },
                    {
                        upsert: true,
                        returnDocument: "after",
                    }
                );
            } catch (error) {
                console.error("Heartbeat socket error:", error.message);
            }
        });

        /*
        =========================
        REGISTER & JOIN ROOMS
        =========================
        */

        socket.on("register", async (identifier) => {
            try {
                if (!identifier) return;

                // Track online status internally
                onlineUsers.set(identifier, socket.id);

                let user = null;
                // Check if identifier is a valid 24-char hex ObjectId
                if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
                    user = await User.findById(identifier).populate('teams');
                } else {
                    // Otherwise assume it is a username like 'DEV-2026-001'
                    user = await User.findOne({ username: new RegExp('^' + identifier + '$', 'i') }).populate('teams');
                }

                if (!user) {
                    console.log(`⚠️ User not found for socket registration: ${identifier}`);
                    return;
                }

                const username = user.username;

                // 1. Join personal socket room mapped to Username for DMs
                socket.join(username);

                // 2. Join rooms for team-linked groups
                if (user.teams && user.teams.length > 0) {
                    for (const team of user.teams) {
                        if (!team || !team.name) continue;
                        const group = await Group.findOne({ groupName: team.name });
                        if (group && group.groupId) {
                            socket.join(group.groupId);
                        }
                    }
                }

                // 3. Join ALL custom chat groups this user is a member of
                const customGroups = await Group.find({ "members.employeeId": username });
                for (const group of customGroups) {
                    if (group && group.groupId) {
                        socket.join(group.groupId);
                    }
                }
            } catch (error) {
                console.error("Register socket error:", error.message);
            }
        });

        /*
        =========================
        SEND MESSAGE
        =========================
        */

        socket.on("sendMessage", async (data) => {
            try {
                const { senderEmployeeId, receiverEmployeeId, message } = data;

                if (!senderEmployeeId || !receiverEmployeeId || !message?.trim()) {
                    return socket.emit("chat:error", "Invalid message data");
                }

                const newMessage = await Message.create({
                    senderEmployeeId,
                    receiverEmployeeId,
                    message,
                    read: false
                });

                io.to(receiverEmployeeId).emit("chat:receive_private", newMessage);
                io.to(senderEmployeeId).emit("chat:receive_private", newMessage);

                console.log(`💬 ${senderEmployeeId} → ${receiverEmployeeId}`);
            } catch (error) {
                console.error("❌ Chat send error:", error.message);
                socket.emit("chat:error", "Message send failed");
            }
        });

        /*
        =========================
        SEND COMPANY MESSAGE
        =========================
        */

        socket.on("sendCompanyMessage", async (data) => {
            try {
                const { senderEmployeeId, message } = data;

                if (!senderEmployeeId || !message?.trim()) {
                    return socket.emit("chat:error", "Invalid company message data");
                }

                const newMessage = await Message.create({
                    senderEmployeeId,
                    groupId: "Company Channel",
                    message,
                    read: false
                });

                // Global broadcast to all connected users
                io.emit("chat:receive", newMessage);

                console.log(`📢 Company Broadcast from ${senderEmployeeId}`);
            } catch (error) {
                console.error("❌ Company Chat send error:", error.message);
                socket.emit("chat:error", "Company Message send failed");
            }
        });

        /*
        =========================
        TYPING EVENT
        =========================
        */

        socket.on("typing", ({ senderEmployeeId, receiverEmployeeId }) => {
            if (!senderEmployeeId || !receiverEmployeeId) return;

            io.to(receiverEmployeeId).emit("chat:typing", {
                sender: senderEmployeeId
            });
        });

        /*
        =========================
        MARK MESSAGE AS READ
        =========================
        */

        socket.on("readMessage", async ({ senderEmployeeId, receiverEmployeeId }) => {
            try {
                if (!senderEmployeeId || !receiverEmployeeId) return;

                await Message.updateMany(
                    {
                        senderEmployeeId,
                        receiverEmployeeId,
                        read: false
                    },
                    { read: true }
                );

                io.to(senderEmployeeId).emit("chat:read", {
                    reader: receiverEmployeeId
                });
            } catch (error) {
                console.error("❌ Read message error:", error.message);
            }
        });

        socket.on("disconnect", () => {
            for (const [user, id] of onlineUsers.entries()) {
                if (id === socket.id) {
                    onlineUsers.delete(user);
                    break;
                }
            }
        });
    });
}

module.exports = registerSocketHandlers;
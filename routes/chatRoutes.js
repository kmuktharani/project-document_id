const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const upload = require("../middleware/upload");
const { authenticate } = require("../middleware/auth.middleware");

router.post("/send", authenticate, upload.single("file"), chatController.sendMessage);
router.post("/group/create", authenticate, chatController.createGroup);
router.post("/group/send", authenticate, upload.single("file"), chatController.sendGroupMessage);
router.put("/group/update", authenticate, chatController.updateGroup);
router.get("/history/group/:groupName", authenticate, chatController.getGroupChatHistory);
router.get("/history/:user1/:user2", authenticate, chatController.getChatHistory);

// Read receipt routes
router.post("/read", authenticate, chatController.markAsRead);
router.post("/read-all", authenticate, chatController.markAllAsRead);
router.post("/group/read-all", authenticate, chatController.markGroupAllAsRead);
router.get("/unread-count/:otherUser", authenticate, chatController.getUnreadCount);
router.get("/group/unread-count/:groupName", authenticate, chatController.getGroupUnreadCount);
router.get("/conversations", authenticate, chatController.getConversationsWithUnreadCount);
router.get("/groups", authenticate, chatController.getUserGroups);

module.exports = router;
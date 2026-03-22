const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth.middleware");
const Notification = require("../models/Notification");

// GET
router.get("/", authenticate, async (req, res) => {
  const data = await Notification.find({ userId: req.user.id })
    .sort({ createdAt: -1 });
  res.json({ success: true, data });
});

// UNREAD COUNT
router.get("/unread-count", authenticate, async (req, res) => {
  const count = await Notification.countDocuments({ userId: req.user.id, status: "unread" });
  res.json({ success: true, count });
});

// MARK AS READ
router.patch("/:id/read", authenticate, async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { status: "read" });
  res.json({ success: true });
});

// MARK ALL AS READ
router.patch("/read-all", authenticate, async (req, res) => {
  await Notification.updateMany({ userId: req.user.id, status: "unread" }, { status: "read" });
  res.json({ success: true });
});

// DELETE ONE
router.delete("/:id", authenticate, async (req, res) => {
  await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  res.json({ success: true });
});

// DELETE ALL
router.delete("/", authenticate, async (req, res) => {
  await Notification.deleteMany({ userId: req.user.id });
  res.json({ success: true });
});

module.exports = router;
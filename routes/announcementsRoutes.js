const express = require("express");
const router = express.Router();
const {authenticate} = require("../middleware/auth.middleware");
const {createAnnouncement,getAnnouncements,deleteAnnouncement,markAsRead,updateAnnouncement} = require("../controllers/announcementController");

router.post("/create",authenticate,createAnnouncement);
router.get("/get",authenticate,getAnnouncements);
router.patch("/:id/read",authenticate,markAsRead);
router.patch("/:id",authenticate,updateAnnouncement);
router.delete("/:id",authenticate,deleteAnnouncement);
module.exports = router;
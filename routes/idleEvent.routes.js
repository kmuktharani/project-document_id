const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const screenShot = require("../controllers/screenshotController");


const { updateIdleStatus } = require("../controllers/idleStatusController");
const { addIdleEvent } = require("../controllers/idleEventController");

// Called every few seconds
router.post("/idlestatus", updateIdleStatus);

// Called when idle session ends
router.post("/idleevent", addIdleEvent);

router.post(
    "/screenshot",
    upload.single("screenshot"),
    screenShot.uploadScreenshot
);

module.exports = router;
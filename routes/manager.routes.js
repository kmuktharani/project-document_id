const express = require("express");
const router = express.Router();
const managerController = require("../controllers/manager.controller");

router.post("/create", managerController.createManager);
router.get("/", managerController.getAllManagers);

module.exports = router;

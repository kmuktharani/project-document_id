const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth.middleware");
const projectDocumentController = require("../controllers/projectDocument.controller");

router.use(authenticate);

router.get("/project-documents", projectDocumentController.getAllProjectDocuments);


router.get("/project-documents/:id", projectDocumentController.getProjectDocumentById);

module.exports = router;
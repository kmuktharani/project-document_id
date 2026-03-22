const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth.middleware");
const documentController = require("../controllers/documentController");
const upload = require("../middleware/documentUpload");

router.use(authenticate);

router.get("/my-documents", documentController.getMyDocuments);

router.post("/upload", (req, res, next) => {
    console.log("🔍 Incoming request headers:", req.headers);
    console.log("🔍 Content-Type:", req.headers['content-type']);
    
    upload.single("file")(req, res, (err) => {
        if (err) {
            console.error("❌ Multer Error:", err);
            console.error("❌ Error Code:", err.code);
            console.error("❌ Error Message:", err.message);
            console.error("❌ Field Name:", err.field);
            
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({ message: "File size exceeds 10MB limit" });
            }
            if (err.message === "Unexpected field") {
                return res.status(400).json({ 
                    message: "Invalid field name. Use 'file' as the field name for file upload",
                    hint: "In Postman Body → form-data, the KEY for file must be 'file' (not 'files' or anything else)",
                    receivedField: err.field || "unknown"
                });
            }
            return res.status(400).json({ message: err.message });
        }
        console.log("✅ File received successfully:", req.file);
        next();
    });
}, documentController.uploadDocument);

router.get("/download/:id", documentController.downloadDocument);

router.use(authorize("admin", "hr"));
router.get("/all", documentController.getAllDocuments);
router.get("/employee/:employeeId", documentController.getEmployeeDocuments);
router.delete("/:id", documentController.deleteDocument);

module.exports = router;

const express = require("express");
const router = express.Router();

const { authenticate, authorize } = require("../middleware/auth.middleware");
const controller = require("../controllers/companyDocumentController");
const upload = require("../middleware/documentUpload");

router.use(authenticate);

router.get("/shared", controller.getSharedDocuments);
router.get("/download/:id", controller.downloadCompanyDocument);

router.use(authorize("admin"));

router.post("/upload", (req, res, next) => {
    upload.single("file")(req, res, (err) => {
        if (err) {
            console.error("❌ Multer Error:", err);
            console.error("❌ Error Code:", err.code);
            console.error("❌ Error Message:", err.message);
            console.error("❌ Field Name:", err.field);
            
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({ 
                    success: false,
                    message: "File size exceeds 10MB limit" 
                });
            }
            if (err.message === "Unexpected field") {
                return res.status(400).json({ 
                    success: false,
                    message: "Invalid field name. Use 'file' as the field name",
                    hint: "In Postman: Body → form-data → KEY must be 'file'",
                    receivedField: err.field || "unknown"
                });
            }
            return res.status(400).json({ 
                success: false,
                message: err.message 
            });
        }
        console.log("✅ File received:", req.file);
        next();
    });
}, controller.uploadCompanyDocument);

router.get("/all", controller.getAllCompanyDocuments);

router.delete("/:id", controller.deleteCompanyDocument);

module.exports = router;
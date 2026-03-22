const CompanyDocument = require("../models/companyDocument");
const path = require("path");
const fs = require("fs");


// ==============================
// Upload Company Document (Admin)
// ==============================
exports.uploadCompanyDocument = async (req, res) => {
    try {

        if (!req.file) {
            return res.status(400).json({ message: "File is required" });
        }

        const { title, description, audience } = req.body;

        if (!title || !audience) {
            return res.status(400).json({
                message: "Title and audience are required"
            });
        }

        const audienceArray = audience.split(",").map(role => role.trim().toLowerCase());

        const document = await CompanyDocument.create({
            title,
            description,
            fileName: req.file.originalname,
            fileUrl: `/uploads/company/${req.file.filename}`,
            audience: audienceArray,
            uploadedBy: req.user.id
        });

        await document.populate("uploadedBy", "firstName lastName username role");

        res.status(201).json({
            message: "Company document uploaded successfully",
            document
        });

    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ message: error.message });
    }
};



// =======================================
// Get Documents Shared With Current User
// =======================================
exports.getSharedDocuments = async (req, res) => {
    try {

        const role = req.user.role.toLowerCase();

        const documents = await CompanyDocument.find({
            audience: role
        })
        .populate("uploadedBy", "firstName lastName username role")
        .sort({ createdAt: -1 });

        res.json(documents);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



// ============================
// Admin - Get All Documents
// ============================
exports.getAllCompanyDocuments = async (req, res) => {
    try {

        const documents = await CompanyDocument.find()
            .populate("uploadedBy", "firstName lastName username role")
            .sort({ createdAt: -1 });

        res.json(documents);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



// ============================
// Download Company Document
// ============================
exports.downloadCompanyDocument = async (req, res) => {
    try {

        const { id } = req.params;

        const document = await CompanyDocument.findById(id);

        if (!document) {
            return res.status(404).json({
                message: "Document not found"
            });
        }

        const role = req.user.role.toLowerCase();

        // Check permission
        if (!document.audience.includes(role) && req.user.role !== "admin") {
            return res.status(403).json({
                message: "Access denied"
            });
        }

        const filePath = path.join(__dirname, "..", document.fileUrl);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                message: "File not found on server"
            });
        }

        res.download(filePath, document.fileName);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



// ============================
// Admin - Delete Document
// ============================
exports.deleteCompanyDocument = async (req, res) => {
    try {

        const { id } = req.params;

        const document = await CompanyDocument.findById(id);

        if (!document) {
            return res.status(404).json({
                message: "Document not found"
            });
        }

        const filePath = path.join(__dirname, "..", document.fileUrl);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await CompanyDocument.findByIdAndDelete(id);

        res.json({
            message: "Company document deleted successfully"
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
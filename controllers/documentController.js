const Document = require("../models/Document");
const path = require("path");
const fs = require("fs");

exports.getMyDocuments = async (req, res) => {
    try {
        const documents = await Document.find({ employeeId: req.user.id })
            .populate("uploadedBy", "firstName lastName username")
            .sort({ uploadedAt: -1 });

        res.json(documents);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.uploadDocument = async (req, res) => {
    try {
        console.log("📤 Upload Request Body:", req.body);
        console.log("📁 File Info:", req.file);
        console.log("👤 User Info:", req.user);

        const { document_type, documentType, employeeId, employee_id } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: "File is required" });
        }

        const docType = document_type || documentType;

        if (!docType) {
            return res.status(400).json({ message: "Document type is required" });
        }

        const targetEmployeeId = employee_id || employeeId || req.user.id;

        console.log("💾 Saving to MongoDB:", {
            employeeId: targetEmployeeId,
            documentType: docType,
            fileName: req.file.originalname,
            fileUrl: `/uploads/documents/${req.file.filename}`,
            fileSize: req.file.size,
            uploadedBy: req.user.id
        });

        const document = await Document.create({
            employeeId: targetEmployeeId,
            documentType: docType,
            fileName: req.file.originalname,
            fileUrl: `/uploads/documents/${req.file.filename}`,
            fileSize: req.file.size,
            uploadedBy: req.user.id
        });

        console.log("✅ Document saved to MongoDB:", document);

        await document.populate("uploadedBy", "firstName lastName username");
        await document.populate("employeeId", "firstName lastName username email department");

        res.status(201).json({
            message: "Document uploaded successfully",
            document
        });
    } catch (error) {
        console.error("❌ Upload Error:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.downloadDocument = async (req, res) => {
    try {
        const { id } = req.params;

        const document = await Document.findById(id);

        if (!document) {
            return res.status(404).json({ message: "Document not found" });
        }

        if (document.employeeId.toString() !== req.user.id && req.user.role !== "admin" && req.user.role !== "hr") {
            return res.status(403).json({ message: "Access denied" });
        }

        const filePath = path.join(__dirname, "..", document.fileUrl);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: "File not found on server" });
        }

        res.download(filePath, document.fileName);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAllDocuments = async (req, res) => {
    try {
        const documents = await Document.find()
            .populate("employeeId", "firstName lastName username email department")
            .populate("uploadedBy", "firstName lastName username")
            .sort({ uploadedAt: -1 });

        res.json(documents);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getEmployeeDocuments = async (req, res) => {
    try {
        const { employeeId } = req.params;

        const documents = await Document.find({ employeeId })
            .populate("uploadedBy", "firstName lastName username")
            .sort({ uploadedAt: -1 });

        res.json(documents);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;

        const document = await Document.findById(id);

        if (!document) {
            return res.status(404).json({ message: "Document not found" });
        }

        const filePath = path.join(__dirname, "..", document.fileUrl);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await Document.findByIdAndDelete(id);

        res.json({ message: "Document deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

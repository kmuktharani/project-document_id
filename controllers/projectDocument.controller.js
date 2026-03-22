const Document = require("../models/Document");


exports.getAllProjectDocuments = async (req, res) => {
    try {
        const documents = await Document.find()
            .populate("uploadedBy", "firstName lastName username")
            .populate("employeeId", "firstName lastName username");

        const result = documents.map(doc => ({
            document_id: doc._id,
            project_id: doc.employeeId,
            title: doc.documentType,
            file_url: doc.fileUrl,
            uploaded_by: doc.uploadedBy,
            uploaded_at: doc.uploadedAt
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.getProjectDocumentById = async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id)
            .populate("uploadedBy", "firstName lastName username")
            .populate("employeeId", "firstName lastName username")
        if (!doc) {
            return res.status(404).json({ message: "Document not found" });
        }

        res.json({
            document_id: doc._id,
            project_id: doc.employeeId,
            title: doc.documentType,
            file_url: doc.fileUrl,
            uploaded_by: doc.uploadedBy,
            uploaded_at: doc.uploadedAt
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
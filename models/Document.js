const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    documentType: {
        type: String,
        required: true,
        enum: [
            "Offer Letter",
            "Employment Agreement",
            "Company Policy",
            "ID Proof",
            "Bank Details",
            "PAN Card",
            "Aadhaar",
            "Certificate",
            "Other"
        ]
    },
    fileName: {
        type: String,
        required: true
    },
    fileUrl: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model("Document", documentSchema);

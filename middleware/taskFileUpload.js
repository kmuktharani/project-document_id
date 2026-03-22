const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md|zip|jpg|jpeg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (extname) {
        cb(null, true);
    } else {
        cb(new Error("Only PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, MD, ZIP, JPG, JPEG, PNG files allowed"));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: fileFilter
});

module.exports = upload;

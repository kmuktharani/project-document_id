const multer = require("multer");

// 🔥 Store file in RAM as Buffer (not on disk)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max screenshot
    }
});

module.exports = upload;
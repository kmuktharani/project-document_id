const Attendance = require("../models/attendance");

exports.uploadScreenshot = async (req, res) => {
    try {
        const { employeeId, attendanceId } = req.body;

        console.log("Received screenshot:", {
            employeeId,
            attendanceId,
            hasFile: !!req.file
        });

        if (!attendanceId || !req.file) {
            return res.status(400).json({
                message: "attendanceId and screenshot are required"
            });
        }

        // 🔥 Fast lookup using attendanceId
        const attendance = await Attendance.findById(attendanceId);

        if (!attendance) {
            return res.status(404).json({ message: "Attendance not found" });
        }



        // 🔥 Store image as binary buffer in MongoDB
        attendance.screenshots.push({
            image: req.file.buffer,          // BYTE DATA
            contentType: req.file.mimetype,  // image/jpeg
            size: req.file.size,             // file size in bytes
            timestamp: new Date()
        });

        // Optional: keep only last 100 screenshots to prevent huge documents
        if (attendance.screenshots.length > 100) {
            attendance.screenshots.shift(); // remove oldest
        }

        await attendance.save();

        res.status(200).json({
            message: "Screenshot stored in DB (Buffer)",
            size: req.file.size
        });

    } catch (error) {
        console.error("Screenshot API Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
const mongoose = require("mongoose");
const Tracker = require("../models/Tracker");

function startHeartbeatMonitor() {
    setInterval(async () => {
        if (mongoose.connection.readyState !== 1) return;

        try {
            const threshold = new Date(Date.now() - 2 * 60 * 1000);

            const result = await Tracker.updateMany(
                {
                    lastHeartbeat: { $lt: threshold },
                    status: { $ne: "offline" }
                },
                {
                    status: "offline",
                    lastStatusUpdate: new Date()
                }
            );

            if (result.modifiedCount > 0) {
                console.log(`Marked ${result.modifiedCount} employees offline`);
            }
        } catch (error) {
            console.error("Heartbeat monitor error:", error.message);
        }
    }, 60000);
}

module.exports = startHeartbeatMonitor;
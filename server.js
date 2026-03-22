require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

// Project routes & services (keep these aligned with your project files)
const managerRoutes = require("./routes/manager.routes");
const authRoutes = require("./routes/authRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const trackerRoutes = require("./routes/tracker.routes");
const mailRoutes = require("./routes/mailRoutes");
const attendanceRoutes = require("./routes/attendance.routes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const taskRoutes = require("./routes/taskRoutes");
const worksheetRoutes = require("./routes/worksheetRoutes");
const exportRoutes = require("./routes/exportRoutes");
const monitoringRoutes = require("./routes/monitoring.routes");
const salaryStructureRoutes = require("./routes/salaryStructureRoutes");
const salaryRoutes = require("./routes/salaryRoutes");
const startHeartbeatMonitor = require("./services/heartbeatMonitor");
const startTaskScheduler = require("./services/taskScheduler");
const activityRoutes = require("./routes/activityRoutes");
const idleEvent = require("./routes/idleEvent.routes");
const teamRoutes = require("./routes/team.routes");
const blockAppRoutes = require("./routes/blockedRoutes");
const errorHandler = require("./middleware/errorHandler");
const chatRoutes = require("./routes/chatRoutes");
const leaveRoutes = require("./routes/leave.routes");
const payrollRoutes = require("./routes/payroll.routes");
const roleDashboardRoutes = require("./routes/roleDashboard.routes");
const calendarRoutes = require("./routes/calendar.routes");
const documentRoutes = require("./routes/documentRoutes");
const performanceRoutes = require("./routes/performanceRoutes");
const supportRoutes = require("./routes/support.routes");
const announcementsRoutes = require("./routes/announcementsRoutes");
const projectRoutes = require("./routes/projectRoutes");
const departmentRoutes = require("./routes/department.routes");
const companyDocumentRoutes = require("./routes/companyDocumentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const projectDocumentRoutes = require("./routes/projectDocument.routes");

const reportRoutes = require("./routes/reportRoutes");

const registerSocketHandlers = require("./socket");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
});

app.set("io", io);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:8080";
const whitelist = [CLIENT_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:8080', 'http://127.0.0.1:3000', 'http://localhost:5173'];

const corsOptions = {
  origin: true, // true reflects the request origin
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/managers", managerRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/tracker", trackerRoutes);
app.use("/api/mail", mailRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/worksheets", worksheetRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/monitoring", monitoringRoutes);
app.use("/api/salary-structure", salaryStructureRoutes);
app.use("/api/salary", salaryRoutes);
app.use("/api", activityRoutes);
app.use("/api/idle", idleEvent);
app.use("/api/teams", teamRoutes);
app.use("/api/blocked", blockAppRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/tracker", require("./routes/idleTracker.routes"));
app.use("/api/leaves", leaveRoutes);
app.use("/api", calendarRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/announcements", announcementsRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/company-documents", companyDocumentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api", projectDocumentRoutes);
app.use(errorHandler);

app.get("/", (req, res) => res.send("Backend + WebSocket is running!"));

// promisified listen helper
function listenOnce(srv, port) {
    return new Promise((resolve, reject) => {
        const onError = (err) => {
            cleanup();
            reject(err);
        };
        const onListening = () => {
            cleanup();
            resolve();
        };
        function cleanup() {
            srv.removeListener("error", onError);
            srv.removeListener("listening", onListening);
        }
        srv.once("error", onError);
        srv.once("listening", onListening);
        try {
            srv.listen(port);
        } catch (err) {
            cleanup();
            reject(err);
        }
    });
}

async function startServerWithAutoPort({ startPort = 5000, maxAttempts = 50 } = {}) {
    let port = Number(process.env.PORT) || startPort;
    if (!Number.isInteger(port) || port <= 0) port = startPort;
    const maxPort = port + Math.max(1, maxAttempts - 1);

    for (; port <= maxPort; port++) {
        console.log(`Trying to bind server to port ${port}...`);
        try {
            await listenOnce(server, port);

            server.on("error", (err) => {
                console.error("Server runtime error:", err);
            });

            console.log(`🚀 Server + Socket running on http://localhost:${port}`);
            return port;
        } catch (err) {
            if (err && err.code === "EADDRINUSE") {
                console.warn(`Port ${port} is already in use. Trying ${port + 1}...`);
                try {
                    server.close();
                } catch (closeErr) {}
                continue;
            } else {
                throw err;
            }
        }
    }

    throw new Error(`No available ports between ${process.env.PORT || startPort} and ${maxPort}`);
}

function handleExitSignals() {
    const shutdown = async (signal) => {
        console.info(`\nReceived ${signal}. Shutting down gracefully...`);
        try {
            server.close(() => console.log("HTTP server closed."));
            try { io.close(); console.log("Socket.io closed."); } catch (ioErr) { console.warn("Socket.io close error:", ioErr); }
            try { await mongoose.disconnect(); console.log("MongoDB disconnected."); } catch (dbErr) { console.warn("Error disconnecting MongoDB:", dbErr); }
        } finally {
            process.exit(0);
        }
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}

(async function boot() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        console.error("Missing MONGO_URI in environment. Aborting startup.");
        process.exit(1);
    }

    const startPort = Number(process.env.PORT) || 5000;
    const maxAttempts = 50;

    console.log("🔌 Connecting to MongoDB Atlas...", mongoUri);

    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000, socketTimeoutMS: 45000 });
        console.log("✅ MongoDB Atlas Connected");

        registerSocketHandlers(io);

        try { startHeartbeatMonitor(); } catch (err) { console.warn("Heartbeat monitor startup failed:", err); }
        try { startTaskScheduler(); } catch (err) { console.warn("Task scheduler startup failed:", err); }

        const boundPort = await startServerWithAutoPort({ startPort, maxAttempts });
        process.env.PORT = String(boundPort);
        handleExitSignals();
    } catch (err) {
        console.error("❌ Startup failed:", err);
        process.exit(1);
    }
})();
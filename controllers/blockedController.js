
async function blockedAppsHandler(req, res) {
    const { employeeId } = req.query;

    // if (!employeeId) {
    //     return res.status(400).json({ error: "employeeId is required" });
    // }

    console.log(`Fetching demo blocked apps for employeeId: ${employeeId}`);

    // 🔹 Demo apps list (can vary per employee if needed)
    const demoApps = ["notepad", "calc", "vlc", "discord","msedge"];

    res.json(demoApps);
}
async function blockedSiteHandler(req, res) {
    const { employeeId } = req.query;

    console.log(`Fetching demo blocked apps for employeeId: ${employeeId}`);

    // 🔹 Demo blocked sites/apps
    const demoBlockedApps = ["google.com", "x.com", "youtube.com"];

    res.json(demoBlockedApps);
}

module.exports = { blockedAppsHandler,blockedSiteHandler };
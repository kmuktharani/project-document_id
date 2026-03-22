const { Parser } = require("json2csv");
const Worksheet = require("../models/worksheetModel");

// ==============================
// 📊 EXPORT ALL WORKSHEETS AS CSV
// ==============================
exports.exportExcel = async (req, res) => {
  try {
    const worksheets = await Worksheet.find().sort({ createdAt: -1 });
    console.log("Worksheets found:", worksheets.length);
    worksheets.forEach((ws, index) => {
      console.log(`Worksheet ${index} remarks:`, ws.remarks);
    });

    if (!worksheets || worksheets.length === 0) {
      return res.status(404).json({ message: "No worksheets found" });
    }

    // Format exactly like your table
    const formattedData = worksheets.map((ws) => ({
      ID: ws._id.toString().slice(-5),
      Title: ws.title,
      Description: ws.description,
      Developer: ws.developer,
      Tester: ws.tester || "-",
      Priority: ws.priority,
      Deadline: new Date(ws.deadline).toLocaleDateString(),
      Status: ws.status,
      Bugs: ws.bugs || 0,
      "Last Updated": new Date(ws.updatedAt).toLocaleDateString(),
      Remarks: ws.remarks || "",
    }));

    const fields = [
      "ID",
      "Title",
      "Description",
      "Developer",
      "Tester",
      "Priority",
      "Deadline",
      "Status",
      "Bugs",
      "Last Updated",
      "Remarks",
    ];

    const json2csv = new Parser({ fields });
    const csv = json2csv.parse(formattedData);

    res.header("Content-Type", "text/csv");
    res.attachment("All_WorkSheets.csv");
    return res.send(csv);

  } catch (error) {
    console.error("Export Error:", error);
    res.status(500).json({ message: "Excel Export Failed" });
  }
};

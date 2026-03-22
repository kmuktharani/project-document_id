const SalaryStructure = require("../models/SalaryStructure");
const PayrollRun = require("../models/PayrollRun");
const PayrollRecord = require("../models/PayrollRecord");

exports.generatePayroll = async (req, res) => {
    try {
        const { month } = req.body;

        let run = await PayrollRun.findOne({ month });
        if (run) {
            return res.status(400).json({ message: "Payroll already exists" });
        }

        run = await PayrollRun.create({
            month,
            processedBy: req.user.id
        });

        const structures = await SalaryStructure.find({ isActive: true });

        if (!structures.length) {
            return res.status(400).json({ message: "No active salary structures found" });
        }

        const records = structures.map(s => {
            const gross = s.basic + s.hra + s.bonus;
            const net = gross - s.deductions;

            return {
                payrollRunId: run._id,
                employeeId: s.employeeId,
                breakdown: {
                    basic: s.basic,
                    hra: s.hra,
                    bonus: s.bonus,
                    deductions: s.deductions
                },
                grossSalary: gross,
                netSalary: net
            };
        });

        await PayrollRecord.insertMany(records);

        res.json({ message: "Payroll generated successfully" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.viewSalaries = async (req, res) => {
    try {
        const { month } = req.params;

        const run = await PayrollRun.findOne({ month });
        if (!run) return res.status(404).json({ message: "Payroll not found" });

        const records = await PayrollRecord.find({ payrollRunId: run._id })
            .populate("employeeId", "username email");

        res.json(records);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.modifySalary = async (req, res) => {
    try {
        const { recordId } = req.params;
        const { bonus, deductions } = req.body;

        const record = await PayrollRecord.findById(recordId);
        if (!record) return res.status(404).json({ message: "Record not found" });

        const run = await PayrollRun.findById(record.payrollRunId);
        if (run.status !== "DRAFT")
            return res.status(400).json({ message: "Cannot modify after approval" });

        if (bonus !== undefined) record.breakdown.bonus = bonus;
        if (deductions !== undefined) record.breakdown.deductions = deductions;

        record.grossSalary = record.breakdown.basic + record.breakdown.hra + record.breakdown.bonus;
        record.netSalary = record.grossSalary - record.breakdown.deductions;

        await record.save();

        res.json({ message: "Salary updated" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.approvePayroll = async (req, res) => {
    try {
        const { month } = req.params;

        const run = await PayrollRun.findOne({ month });
        if (!run) return res.status(404).json({ message: "Payroll not found" });

        run.status = "APPROVED";
        run.approvedBy = req.user.id;
        await run.save();

        await PayrollRecord.updateMany(
            { payrollRunId: run._id },
            { status: "APPROVED" }
        );

        res.json({ message: "Payroll approved" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.releasePayroll = async (req, res) => {
    try {
        const { month } = req.params;

        const run = await PayrollRun.findOne({ month });
        if (!run) return res.status(404).json({ message: "Payroll not found" });

        run.status = "RELEASED";
        run.releasedBy = req.user.id;
        await run.save();

        await PayrollRecord.updateMany(
            { payrollRunId: run._id },
            {
                status: "PAID",
                paidDate: new Date()
            }
        );

        res.json({ message: "Salaries released" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.salaryHistory = async (req, res) => {
    try {
        const { username } = req.params;
        const User = require("../models/user");

        const employee = await User.findOne({ username: username.toUpperCase() });
        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        const records = await PayrollRecord.find({ employeeId: employee._id })
            .populate("payrollRunId", "month status")
            .sort({ createdAt: -1 });

        res.json(records);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.viewMySalary = async (req, res) => {
    try {
        const records = await PayrollRecord.find({ employeeId: req.user.id })
            .populate("payrollRunId", "month status")
            .sort({ createdAt: -1 })
            .limit(12);

        res.json(records);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.viewMyPayslip = async (req, res) => {
    try {
        const { month } = req.params;

        const run = await PayrollRun.findOne({ month });
        if (!run) return res.status(404).json({ message: "Payroll not found" });

        const record = await PayrollRecord.findOne({
            payrollRunId: run._id,
            employeeId: req.user.id
        }).populate("employeeId", "username email firstName lastName department");

        if (!record) return res.status(404).json({ message: "Payslip not found" });

        const payslipData = {
            company: {
                name: "LIFEBOX NEXTGEN PVT. LTD.",
                location: "Narasaraopet, Andhra Pradesh",
                contact: "hr@lifeboxnextgen.com"
            },
            month: month,
            employee: {
                name: `${record.employeeId.firstName} ${record.employeeId.lastName}`,
                username: record.employeeId.username,
                email: record.employeeId.email,
                department: record.employeeId.department
            },
            status: record.status,
            paidDate: record.paidDate ? record.paidDate.toDateString() : "Not Paid Yet",
            earnings: {
                basicSalary: record.breakdown.basic,
                hra: record.breakdown.hra,
                bonus: record.breakdown.bonus
            },
            deductions: record.breakdown.deductions,
            grossSalary: record.grossSalary,
            netSalary: record.netSalary,
            generatedAt: new Date().toISOString()
        };

        res.json(payslipData);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.downloadPayslip = async (req, res) => {
    try {
        const PDFDocument = require("pdfkit");
        const { month } = req.params;

        const run = await PayrollRun.findOne({ month });
        if (!run) return res.status(404).json({ message: "Payroll not found" });

        const record = await PayrollRecord.findOne({
            payrollRunId: run._id,
            employeeId: req.user.id
        }).populate("employeeId", "username email firstName lastName department employeeId designation");

        if (!record) return res.status(404).json({ message: "Payslip not found" });

        const doc = new PDFDocument({ size: "A4", margin: 0 });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=payslip-${month}.pdf`);
        doc.pipe(res);

        const W = 595.28;
        const MARGIN = 40;
        const CONTENT_W = W - MARGIN * 2;
        const NAVY = "#1a2e4a";
        const LIGHT_GRAY = "#f5f5f5";
        const BORDER = "#d0d0d0";
        const TEXT_DARK = "#1a1a1a";
        const TEXT_MID = "#444444";

        //Header
        doc.rect(0, 0, W, 100).fill(NAVY);
        doc.fillColor("#ffffff")
            .fontSize(22)
            .font("Helvetica-Bold")
            .text("Lifebox NextGen Pvt. Ltd.", MARGIN, 28);
        doc.fillColor("#aac4e0")
            .fontSize(11)
            .font("Helvetica")
            .text(`Payslip for ${month}`, MARGIN, 58);
        doc.fillColor("#aac4e0")
            .fontSize(9)
            .text("Narasaraopet, Andhra Pradesh  |  hr@lifeboxnextgen.com", MARGIN, 76);

        let y = 120;

        //Employee Details 
        const emp = record.employeeId;
        const empName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim();
        const paidDateStr = record.paidDate ? new Date(record.paidDate).toISOString().split("T")[0] : "Pending";
        const txnRef = `TXN${paidDateStr.replace(/-/g, "")}${(emp.username || "EMP").slice(0, 3)}`;

        const leftDetails = [
            ["Employee Name", empName],
            ["Employee ID", emp.employeeId || emp.username],
            ["Designation", emp.designation || "—"],
            ["Department", emp.department || "—"],
        ];
        const rightDetails = [
            ["Payment Date", paidDateStr],
            ["Txn Ref", txnRef],
            ["Pay Period", month],
            ["Status", record.status],
        ];

        const COL_W = CONTENT_W / 2 - 10;
        leftDetails.forEach(([label, val], i) => {
            const row_y = y + i * 22;
            doc.fillColor(TEXT_MID).fontSize(9).font("Helvetica").text(label + ":", MARGIN, row_y);
            doc.fillColor(TEXT_DARK).fontSize(10).font("Helvetica-Bold").text(val, MARGIN + 110, row_y);
        });
        rightDetails.forEach(([label, val], i) => {
            const row_y = y + i * 22;
            const rx = MARGIN + COL_W + 20;
            doc.fillColor(TEXT_MID).fontSize(9).font("Helvetica").text(label + ":", rx, row_y);
            doc.fillColor(TEXT_DARK).fontSize(10).font("Helvetica-Bold").text(String(val), rx + 90, row_y);
        });

        y += leftDetails.length * 22 + 20;

        //Earnings
        const HALF = CONTENT_W / 2 - 8;
        const ROW_H = 24;
        const HDR_H = 28;

        doc.rect(MARGIN, y, HALF, HDR_H).fill(NAVY);
        doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold")
            .text("Earnings", MARGIN + 8, y + 8)
            .text("Amount (₹)", MARGIN + HALF - 80, y + 8);

        //Deductions header
        const DX = MARGIN + HALF + 16;
        doc.rect(DX, y, HALF, HDR_H).fill(NAVY);
        doc.fillColor("#ffffff").fontSize(10).font("Helvetica-Bold")
            .text("Deductions", DX + 8, y + 8)
            .text("Amount (₹)", DX + HALF - 80, y + 8);

        y += HDR_H;

        // Earnings rows
        const providentFund = Math.round(record.breakdown.basic * 0.12);
        const incomeTax = Math.round((record.grossSalary - record.breakdown.basic) * 0.15);
        const otherDed = record.breakdown.deductions - providentFund - incomeTax;

        const earnRows = [
            ["Basic Salary", record.breakdown.basic],
            ["HRA", record.breakdown.hra],
            ["Special Allowance", 0],
            ["Bonus", record.breakdown.bonus],
        ];
        const dedRows = [
            ["Provident Fund", providentFund],
            ["Income Tax", incomeTax],
            ["Other Deductions", Math.max(0, otherDed)],
        ];

        const maxRows = Math.max(earnRows.length, dedRows.length);
        for (let i = 0; i < maxRows; i++) {
            const rowY = y + i * ROW_H;
            const bg = i % 2 === 0 ? "#ffffff" : LIGHT_GRAY;

            // Earnings cell
            doc.rect(MARGIN, rowY, HALF, ROW_H).fill(bg).stroke(BORDER);
            if (earnRows[i]) {
                doc.fillColor(TEXT_DARK).fontSize(9).font("Helvetica")
                    .text(earnRows[i][0], MARGIN + 8, rowY + 7)
                    .text(earnRows[i][1]?.toLocaleString() || "0", MARGIN + HALF - 80, rowY + 7);
            }

            // Deductions cell
            doc.rect(DX, rowY, HALF, ROW_H).fill(bg).stroke(BORDER);
            if (dedRows[i]) {
                doc.fillColor(TEXT_DARK).fontSize(9).font("Helvetica")
                    .text(dedRows[i][0], DX + 8, rowY + 7)
                    .text(dedRows[i][1]?.toLocaleString() || "0", DX + HALF - 80, rowY + 7);
            }
        }

        y += maxRows * ROW_H + 16;

        //Net Salary summary
        doc.rect(MARGIN, y, CONTENT_W, 32).fill("#e8f0fe").stroke(BORDER);
        doc.fillColor(NAVY).fontSize(11).font("Helvetica-Bold")
            .text(`Net Salary Payable:   ₹${record.netSalary?.toLocaleString()}`, MARGIN + 8, y + 9);
        doc.fillColor("#444444").fontSize(9).font("Helvetica")
            .text(`(Gross ₹${record.grossSalary?.toLocaleString()} − Deductions ₹${record.breakdown.deductions?.toLocaleString()})`, MARGIN + 300, y + 11);

        y += 50;

        //Footer
        doc.fillColor("#999999").fontSize(8).font("Helvetica")
            .text("This is a computer-generated payslip. No signature required.", MARGIN, y, { align: "center", width: CONTENT_W })
            .text("For queries, contact hr@lifeboxnextgen.com", MARGIN, y + 14, { align: "center", width: CONTENT_W });

        doc.end();

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


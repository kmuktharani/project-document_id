const { verifyToken } = require("../utils/jwt");

function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authorization token missing"
            });
        }

        const token = authHeader.split(" ")[1];
        const decoded = verifyToken(token);

        if (!decoded || !decoded.id) {
            return res.status(401).json({
                success: false,
                message: "Invalid token payload"
            });
        }

        req.user = decoded;
        next();
    } catch (error) {
        console.error("❌ JWT Authentication Error:", error.message);
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
}

function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({
                success: false,
                message: "Access denied: user role missing"
            });
        }

        const userRole = req.user.role.toLowerCase();
        const isAllowed = allowedRoles
            .map(role => role.toLowerCase())
            .includes(userRole);

        if (!isAllowed) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Allowed roles: ${allowedRoles.join(", ")}`
            });
        }

        next();
    };
}

module.exports = { authenticate, authorize };
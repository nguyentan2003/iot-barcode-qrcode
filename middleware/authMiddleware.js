const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) return res.status(401).json({ message: "Bạn chưa đăng nhập" });

    try {
        const decoded = jwt.verify(
            token.replace("Bearer ", ""),
            process.env.JWT_SECRET
        );
        req.user = decoded;
        next();
    } catch (err) {
        res.status(403).json({ message: "Token không hợp lệ" });
    }
};

module.exports = authMiddleware;

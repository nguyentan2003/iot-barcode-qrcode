const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../iot-frontend/models/userModel");

exports.register = async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const user = new User({ username, password, role });
        await user.save();
        res.status(201).json({ message: "Đăng ký thành công!" });
    } catch (err) {
        res.status(500).json({ message: "Lỗi đăng ký", error: err.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user)
            return res
                .status(400)
                .json({ message: "Sai tài khoản hoặc mật khẩu" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
            return res
                .status(400)
                .json({ message: "Sai tài khoản hoặc mật khẩu" });

        // Tạo token
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({ message: "Đăng nhập thành công", token });
    } catch (err) {
        res.status(500).json({ message: "Lỗi đăng nhập", error: err.message });
    }
};

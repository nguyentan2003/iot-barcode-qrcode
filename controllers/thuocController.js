const Thuoc = require("../models/thuocModel");
const { broadcast } = require("../services/websocket");

exports.getAllThuoc = async (req, res) => {
    try {
        const medicines = await Thuoc.find();
        res.json(medicines);
    } catch (err) {
        res.status(500).json({ message: "Lỗi truy vấn", error: err.message });
    }
};

exports.getThuocByName = async (req, res) => {
    try {
        const ten_thuoc = req.params.ten_thuoc.replace(/[^a-zA-Z0-9\s]/g, "");
        const medicines = await Thuoc.find({
            ten_thuoc: new RegExp(`^${ten_thuoc}$`, "i"),
            han_che: 0,
        });

        if (!medicines.length) {
            return res
                .status(404)
                .json({ message: `Không tìm thấy thuốc: ${ten_thuoc}` });
        }

        res.json({ data: medicines });
        broadcast({ event: "thuoc_tuong_ung", data: medicines });
    } catch (err) {
        res.status(500).json({ message: "Lỗi tìm thuốc", error: err.message });
    }
};

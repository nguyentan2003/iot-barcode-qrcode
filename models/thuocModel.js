const mongoose = require("mongoose");

const thuocSchema = new mongoose.Schema({
    ten_thuoc: { type: String, required: true, unique: true },
    gia_thuoc: { type: Number, required: true },
    hinh_anh: { type: String, default: null },
    so_luong: { type: Number, required: true },
    han_che: { type: Number, required: true, default: 1 },
});

const Thuoc = mongoose.model("Thuoc", thuocSchema);
module.exports = Thuoc;

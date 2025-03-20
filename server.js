// Import các module cần thiết
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const morgan = require("morgan");
const WebSocket = require("ws");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");

// Khởi tạo Express app
const app = express();
const port = process.env.PORT || 8000;

// Sử dụng các middleware
app.use(bodyParser.json());
app.use(cors());
app.use(morgan("dev"));

// Kết nối MongoDB
const MONGODB_URI = "mongodb://localhost:27017/iot";
mongoose
    .connect(MONGODB_URI)
    .then(() => console.log("Connected to MongoDB successfully"))
    .catch((err) => {
        console.error("MongoDB connection error:", err);
        process.exit(1); // Thoát nếu không kết nối được MongoDB
    });

const db = mongoose.connection;
db.on("error", console.error.bind(console, "Lỗi kết nối đến MongoDB:"));
db.once("open", () => {
    console.log("Đã kết nối thành công đến MongoDB");
});

// Định nghĩa Schema và Model cho MongoDB
const thuocSchema = new mongoose.Schema({
    ten_thuoc: { type: String, required: true },
    gia_thuoc: { type: Number, required: true },
    hinh_anh: { type: String, default: null },
    so_luong: { type: Number, required: true },
    han_che: { type: Number, required: true },
});
const Thuoc = mongoose.model("Thuoc", thuocSchema);

// Khởi tạo server WebSocket
const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws) => {
    console.log("Client đã kết nối với WebSocket");
    ws.on("message", (message) => {
        console.log("Nhận tin nhắn từ client:", message);
    });
});

// Cấu hình Multer để lưu trữ ảnh vào thư mục 'uploads'
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/"); // Lưu ảnh vào thư mục 'uploads'
    },
    filename: function (req, file, cb) {
        const fileExtension = path.extname(file.originalname); // Lấy phần mở rộng của file (e.g., '.jpg', '.png')
        const newFileName =
            req.body.ten_thuoc.replace(/\s+/g, "_").toLowerCase() +
            fileExtension; // Tạo tên file mới
        cb(null, newFileName); // Đặt tên cho file
    },
});

const upload = multer({ storage: storage }); // Khai báo upload với cấu hình Multer

// Route để thêm thuốc mới
app.post("/add-thuoc", upload.single("hinh_anh"), async (req, res) => {
    try {
        const { ten_thuoc, gia_thuoc, so_luong } = req.body;
        const hinh_anh = req.file ? `/uploads/${req.file.filename}` : null; // Đường dẫn ảnh

        // Tạo đối tượng Thuoc mới và lưu vào cơ sở dữ liệu
        const newThuoc = new Thuoc({
            ten_thuoc,
            gia_thuoc,
            so_luong,
            hinh_anh,
            han_che: 1,
        });

        await newThuoc.save();
        res.status(201).json({
            message: "Thuốc đã được thêm thành công!",
            thuoc: newThuoc,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi khi thêm thuốc", error });
    }
});

// Tạo đường dẫn tĩnh cho ảnh (cho phép frontend truy cập ảnh)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API lấy tất cả thuốc
app.get("/get-all-thuoc", async (req, res) => {
    try {
        const allMedicines = await Thuoc.find().exec(); // Chỉ lấy thuốc có han_che = 0
        res.json(allMedicines);
    } catch (err) {
        res.status(500).send("Lỗi truy vấn MongoDB: " + err.message);
    }
});

// API để tìm thuốc theo tên
app.get("/chon-thuoc/:ten_thuoc", async (req, res) => {
    const { ten_thuoc } = req.params; // Lấy tham số ten_thuoc từ URL
    console.log("Tên thuốc tìm kiếm:", ten_thuoc); // Kiểm tra đầu vào từ URL
    try {
        // Tìm thuốc có tên giống với tên thuốc trong cơ sở dữ liệu
        const medicines = await Thuoc.find({
            ten_thuoc: new RegExp(ten_thuoc, "i"), // Dùng RegExp để tìm kiếm không phân biệt chữ hoa chữ thường
            han_che: 0, // Chỉ lấy thuốc có han_che = 0
        }).exec();

        if (medicines.length === 0) {
            // Nếu không tìm thấy thuốc, trả về thông báo không tìm thấy
            return res.status(404).json({
                message: `Không tìm thấy thuốc với tên: ${ten_thuoc}`,
            });
        }

        // Nếu tìm thấy thuốc, trả về dữ liệu thuốc
        const response = {
            data: medicines.map(
                ({ ten_thuoc, gia_thuoc, hinh_anh, so_luong, han_che }) => ({
                    ten_thuoc,
                    gia_thuoc,
                    hinh_anh,
                    so_luong,
                    han_che,
                })
            ),
        };

        res.json(response); // Trả về dữ liệu thuốc tìm được

        // Gửi thông tin cập nhật qua WebSocket
        const responseString = JSON.stringify(response);
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(responseString);
            }
        });

        console.log("Truy vấn thành công:", response);
    } catch (err) {
        console.error("Lỗi khi thực hiện truy vấn:", err.message);
        res.status(500).send("Lỗi truy vấn MongoDB: " + err.message);
    }
});

// Danh sách thuốc fake
const danhSachThuoc = [
    {
        ten_thuoc: "Acetyldihydrocodeine",
        gia_thuoc: 100000,
        hinh_anh: "/uploads/acetyldihydrocodein.jpg",
        so_luong: 50,
        han_che: 1,
    },
    {
        ten_thuoc: "Alfentanil",
        gia_thuoc: 12000,
        hinh_anh: "/uploads/alfentanil.jpg",
        so_luong: 40,
        han_che: 1,
    },
    {
        ten_thuoc: "Alphaprodine",
        gia_thuoc: 15000,
        hinh_anh: "/uploads/alphaprodine.jpg",
        so_luong: 60,
        han_che: 1,
    },
    {
        ten_thuoc: "Butorphanol",
        gia_thuoc: 20000,
        hinh_anh: "/uploads/butorphanol.jpg",
        so_luong: 30,
        han_che: 1,
    },
];

// // // Chèn dữ liệu vào MongoDB
// Thuoc.insertMany(danhSachThuoc)
//     .then(() => {
//         console.log("✅ Thêm dữ liệu thành công!");
//         mongoose.disconnect();
//     })
//     .catch((err) => {
//         console.error("❌ Lỗi khi thêm dữ liệu:", err);
//     });
// Khởi chạy server
app.listen(port, () => {
    console.log(`Máy chủ đang chạy tại: http://localhost:${port}`);
});

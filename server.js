// Import các module cần thiết
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const morgan = require("morgan");
const WebSocket = require("ws");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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

const mongoSanitize = require("express-mongo-sanitize");
app.use(mongoSanitize());

// API để tìm thuốc theo tên
app.get("/chon-thuoc/:ten_thuoc", async (req, res) => {
    const { ten_thuoc } = req.params; // Lấy tham số ten_thuoc từ URL
    console.log("Tên thuốc tìm kiếm:", ten_thuoc); // Kiểm tra đầu vào từ URL
    try {
        const sanitizedTenThuoc = ten_thuoc.replace(/[^a-zA-Z0-9\s]/g, ""); // Chỉ giữ chữ và số
        const medicines = await Thuoc.find({
            ten_thuoc: new RegExp(`^${sanitizedTenThuoc}$`, "i"),
            han_che: 0,
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

// API lấy thông tin đơn thuốc theo mã đơn hàng
app.get("/don-thuoc/:ma_don_thuoc", async (req, res) => {
    const { ma_don_thuoc } = req.params; // Lấy mã đơn hàng từ URL

    try {
        // Tìm đơn hàng theo ID
        const order = await Order.findById(ma_don_thuoc);
        if (!order) {
            return res.status(404).json({
                status: 404,
                message: "Không tìm thấy đơn thuốc!",
            });
        }

        // Lấy danh sách thuốc trong đơn hàng
        const orderDetails = await OrderDetail.find({ order_id: ma_don_thuoc });

        // Trả về kết quả
        let response = {
            status: 200,
            ma_don_thuoc,
            nguoi_mua: order.nguoi_mua,
            tong_tien: order.tong_tien,
            danh_sach_thuoc: orderDetails.map(
                ({ ten_thuoc, quantity, gia_thuoc, hinh_anh }) => ({
                    ten_thuoc,
                    quantity,
                    gia_thuoc,
                    hinh_anh,
                })
            ),
        };
        res.json(response);
        // Gửi thông tin cập nhật qua WebSocket
        const responseString = JSON.stringify(response);
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(responseString);
            }
        });
    } catch (error) {
        console.error("Lỗi khi lấy đơn thuốc:", error);
        res.status(500).json({
            status: 500,
            message: "Lỗi khi lấy đơn thuốc",
            error,
        });
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

// Định nghĩa schema cho bảng user
const Schema = mongoose.Schema;
const UserSchema = new Schema({
    username: String,
    password: String,
    role: { type: String, enum: ["user", "admin"] },
});

const User = mongoose.model("User", UserSchema);

// // Băm mật khẩu sử dụng bcrypt
// const saltRounds = 10; // số lượng vòng lặp để băm mật khẩu
// bcrypt.hash("password", saltRounds, (err, hashedPassword) => {
//     if (err) throw err;

//     // Tạo các tài khoản mẫu
//     const users = [
//         { username: "user", password: hashedPassword, role: "user" },
//         { username: "admin", password: hashedPassword, role: "admin" },
//     ];

//     // Thêm các tài khoản vào MongoDB
//     async function createUsers() {
//         try {
//             const docs = await User.insertMany(users);
//             console.log("Thêm tài khoản mẫu thành công:", docs);
//         } catch (err) {
//             console.error("Lỗi khi thêm tài khoản:", err);
//         } finally {
//             mongoose.disconnect();
//         }
//     }

//     // Gọi hàm tạo tài khoản
//     createUsers();
// });

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) return res.status(401).json({ message: "Sai tên đăng nhập!" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Sai mật khẩu!" });

    const token = jwt.sign({ id: user._id, role: user.role }, "SECRET_KEY", {
        expiresIn: "1h",
    });
    res.json({ token });
});

// Định nghĩa Schema cho bảng Order
const orderSchema = new mongoose.Schema(
    {
        nguoi_mua: { type: String, required: true },
        tong_tien: { type: Number, required: true },
    },
    { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

// Định nghĩa Schema cho bảng Order Detail
const orderDetailSchema = new mongoose.Schema({
    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        required: true,
    },
    ten_thuoc: { type: String, required: true },
    quantity: { type: Number, required: true },
    gia_thuoc: { type: Number, required: true },
    hinh_anh: { type: String, required: true },
});

const OrderDetail = mongoose.model("OrderDetail", orderDetailSchema);

// API để tạo đơn thuốc
app.post("/create-order", async (req, res) => {
    const { nguoi_mua, tong_tien, danh_sach_thuoc } = req.body;

    console.log(nguoi_mua);
    console.log(tong_tien);
    console.log(danh_sach_thuoc);

    // Kiểm tra dữ liệu đầu vào
    if (
        !nguoi_mua ||
        !tong_tien ||
        !Array.isArray(danh_sach_thuoc) ||
        danh_sach_thuoc.length === 0
    ) {
        return res.status(400).json({
            message:
                "Thiếu thông tin đơn hàng hoặc danh sách thuốc không hợp lệ!",
        });
    }

    try {
        // Tạo đơn hàng
        const newOrder = new Order({ nguoi_mua, tong_tien });
        await newOrder.save();

        // Lưu chi tiết đơn hàng
        const orderDetails = danh_sach_thuoc.map((thuoc) => ({
            order_id: newOrder._id,
            ten_thuoc: thuoc.ten_thuoc,
            quantity: thuoc.quantity,
            gia_thuoc: thuoc.gia_thuoc,
            hinh_anh: thuoc.hinh_anh,
        }));

        await OrderDetail.insertMany(orderDetails);

        res.status(201).json({
            status: 0,
            message: "Đơn thuốc đã được tạo thành công!",
            order: newOrder,
            orderDetails,
        });
    } catch (error) {
        console.error("Lỗi khi tạo đơn thuốc:", error);
        res.status(500).json({
            status: 1,
            message: "Lỗi khi tạo đơn thuốc",
            error,
        });
    }
});

app.listen(port, () => {
    console.log(`Máy chủ đang chạy tại: http://localhost:${port}`);
});

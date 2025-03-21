const express = require("express");
const {
    getAllThuoc,
    getThuocByName,
} = require("../controllers/thuocController");

const router = express.Router();

router.get("/", getAllThuoc);
router.get("/:ten_thuoc", getThuocByName);

module.exports = router;

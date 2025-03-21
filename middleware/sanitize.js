const mongoSanitize = require("express-mongo-sanitize");

module.exports = (req, res, next) => {
    mongoSanitize.sanitize(req.body);
    mongoSanitize.sanitize(req.params);
    next();
};

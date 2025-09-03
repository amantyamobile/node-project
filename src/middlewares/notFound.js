const { json } = require("express")

const notFoundMid = (req, res, next) => {
    res.status(404),json({error : 'NotFound'})
};


module.exports = notFoundMid;
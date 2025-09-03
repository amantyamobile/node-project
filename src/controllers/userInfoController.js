const userInfoService = require('../service/userInfoService');

const userInfoDetail = async (req, res) => {
    try {
        console.log("userInfoDetail in UserInfoController")
        const userInfo = await userInfoService.userInfoDetails(req, res);
        return userInfo;

    } catch (error) {
        console.log("Error occurred while fetching user info");
        throw error;
    }
};


async function userBasicInfoDetail(req, res, next) {
    try {
        console.log("userBasicInfoDetail in UserInfoController")
        const userInfo = await userInfoService.userBasicInfoDetails(req, res, next);
        res.json(userInfo);
    } catch (error) {
        console.log("Error occurred while fetching user info");
        next(error);
    }
};


const addUserInfoDetail = async (req, res) => {
    try {
        const { userId, userName, email, phone } = req.body; // ✅ body data
        console.log("Request Body:", req.body);

        const result = await userInfoService.addUserInfoDetails(userId, userName, email, phone);
        res.json(result);

    } catch (error) {
        console.log("Error occurred while fetching user info");
        throw error;
    }
};


const deleteUserInfoDetail = async (req, res) => {
    try {
        const { userId } = req.params;
        console.log("Request userId:", userId);

        const result = await userInfoService.deleteUserInfoDetails(userId);
        console.log('API Response', result);
        res.status(200).json(result);
    } catch (error) {
        console.log("Error occurred while fetching user info");
        next(error);
    }
};


module.exports = {
    userInfoDetail,
    userBasicInfoDetail,
    addUserInfoDetail,
    deleteUserInfoDetail
};
const pool = require('../db/dbConnection');
const userModel = require('../models/userModel');

const userData = [];

const userInfoDetails = async (req, res) => {
    try {
        const userData = await userModel.getAllUsers(2);
        return res.status(200).json({
            status: 200,
            success: true,
            message: "User is fetched successfully",
            data: userData
        });

    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: "Exception occured while fetching users",
            data: {}
        });
    }
};


async function userBasicInfoDetails(req, res, next) {
    try {
        let dataSet = {};
        dataSet.name = 'Rahul Gupta';
        dataSet.email = "rg@gmail.com";
        if (dataSet.email !== 'rahul@gmail.com') {
            throw new Error("Email does not match");
        }

        return res.status(200).json({
            status: 200,
            success: true,
            message: "User is fetched successfully",
            data: dataSet
        });

    } catch (error) {
        next(error);
    }
};


const addUserInfoDetails = async (userId, userNAme, email, phone) => {
    let dataSet = {};
    dataSet.userId = userId;
    dataSet.userNAme = userNAme;
    dataSet.email = email;
    dataSet.phone = phone;
    userData.push(dataSet);

    return { status: 200, success: true, message: "User is added successfully", data: {} };

};

const deleteUserInfoDetails = async (userId) => {
    const index = userData.findIndex(user => user.userId == userId);
    if (index == -1) {
        return { status: 404, success: false, message: "User Id is not present", data: {} };
    }
    userData.splice(index, 1);

    return { status: 200, success: true, message: "User is deleted successfully", data: {} };
};

module.exports = {
    userInfoDetails,
    userBasicInfoDetails,
    addUserInfoDetails,
    deleteUserInfoDetails
};
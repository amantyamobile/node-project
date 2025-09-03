const express = require('express');
const router = express.Router();
const userInfoController = require('../controllers/userInfoController');

router.get('/', (req, res) => {
    console.log("First API is being used.")
    res.json({ message: 'API is up' });
});


router.get('/user-info', userInfoController.userInfoDetail);
router.get('/user-basic-info', userInfoController.userBasicInfoDetail);
router.post('/add-user-info', userInfoController.addUserInfoDetail);
router.delete('/delete-user-info/:userId', userInfoController.deleteUserInfoDetail);
module.exports = router;

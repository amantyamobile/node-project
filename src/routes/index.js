const express = require('express');
const router = express.Router();
const userInfoController = require('../controllers/userInfoController');
const bugbotRoutes = require('./bugbotRoutes');

router.get('/', (req, res) => {
    console.log("First API is being used.")
    res.json({ 
        message: 'API is up',
        services: {
            user_management: '/api/user-info',
            bugbot_review: '/api/bugbot'
        }
    });
});

// User management routes
router.get('/user-info', userInfoController.userInfoDetail);
router.get('/user-basic-info', userInfoController.userBasicInfoDetail);
router.post('/add-user-info', userInfoController.addUserInfoDetail);
router.delete('/delete-user-info/:userId', userInfoController.deleteUserInfoDetail);

// Bugbot review system routes
router.use('/bugbot', bugbotRoutes);

module.exports = router;

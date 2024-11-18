const express = require('express');
const { login, authenticate, register } = require('../controllers/authController');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

router.post('/auth/login', login);
router.post('/auth/register', register);

module.exports = router;

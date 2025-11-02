const express = require('express');
const hostController = require('./../controllers/hostController');

const router = express.Router();

// Public routes - no authentication required
router.get('/', hostController.getAllHosts);
router.get('/:id', hostController.getHost);

module.exports = router;


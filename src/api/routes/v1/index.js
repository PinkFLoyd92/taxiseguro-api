const express = require('express');
const userRoutes = require('./user.route');
const routeRoutes = require('./route.route');
const fenceRoutes = require('./fence.route');

const router = express.Router();

/**
 * GET v1/status
 */
router.get('/status', (req, res) => res.send('OK'));

router.use('/users', userRoutes);
router.use('/routes', routeRoutes);
router.use('/fences', fenceRoutes);

module.exports = router;

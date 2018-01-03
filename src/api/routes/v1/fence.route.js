const express = require('express');
// const validate = require('express-validation');
const controller = require('../../controllers/fence.controller');
// const {
//   listRoutes,
//   createRoute,
//   replaceRoute,
//   updateRoute,
// } = require('../../validations/route.validation');

const router = express.Router();

/**
 * Load fence when API with routeId route parameter is hit
 */
router.param('fenceId', controller.load);


router
  .route('/')
  .get(controller.list)
  .post(controller.create);


router
  .route('/:fenceId')
  .get(controller.get)
  .delete(controller.remove);


module.exports = router;

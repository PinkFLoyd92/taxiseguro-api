const express = require('express');
const validate = require('express-validation');
const controller = require('../../controllers/route.controller');
 const {
   checkRoute
//   listRoutes,
//   createRoute,
//   replaceRoute,
//   updateRoute,
 } = require('../../validations/route.validation');

const router = express.Router();

/**
 * Load route when API with routeId route parameter is hit
 */
router.param('routeId', controller.load);


router
  .route('/')
  .get(controller.list)
  .post(controller.create);


router
  .route('/:routeId')
  .get(controller.get)
  .delete(controller.remove);

router
  .route('/checkRoute/:routeId')
  .patch(validate(checkRoute), controller.checkRoute);


module.exports = router;

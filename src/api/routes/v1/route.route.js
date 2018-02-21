const express = require('express');
const validate = require('express-validation');
const controller = require('../../controllers/route.controller');
const {
  createRoute,
  checkRoute,
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
  /**
   * @api {get} v1/users List Routes
   * @apiDescription Get a list of routes
   * @apiVersion 1.0.0
   * @apiName ListRoutes
   * @apiGroup Routes
   *
   *
   * @apiParam  {Number{1-}}       [page=1]     List page
   * @apiParam  {Number{1-100}}    [perPage=1]  routes per page
   * @apiParam  {Date}             [dateTime]   TimeStamp saving route's start
   * @apiParam  {Multipoint}       [points]     Start of route
   * @apiParam  {Point}            [start]      Starting Point of the route.
   * @apiParam  {Point}            [end]        Ending Point of the route.
   * @apiParam  {String=inactive, active, cancelled, finished}  [status]       Route's status
   *
   * @apiSuccess {Object[]} routes List of routes.
   *
   */
  .get(controller.list)
  /**
   * @api {post} v1/routes Create route
   * @apiDescription Create a new route
   * @apiVersion 1.0.0
   * @apiName CreateRoute
   * @apiGroup Routes
   *
   *
   * @apiParam  {String=inactive, active, cancelled, finished}  [status]    Route's status
   * @apiParam  {User}             [driver]       Id of driver in route
   * @apiParam  {User}             [client]       Id of client in route(Optional)
   * @apiParam  {Multipoint}       [points]     Start of route
   * @apiParam  {Point}            [start]      Starting Point of the route.
   * @apiParam  {Point}            [end]        Ending Point of the route.
   *
   * @apiSuccess (Created 201) {String}  _id         Route's id
   * @apiSuccess (Created 201) {String}  status       Route's status
   * @apiSuccess (Created 201) {Date}    date  Timestamp
   *
   * @apiError (Bad Request 400)   ValidationError  Some parameters may contain invalid values
   * @apiError (Unauthorized 401)  Unauthorized     Only authenticated users can create the data
   * @apiError (Forbidden 403)     Forbidden        Only admins can create the data

  post(authorize(ADMIN), validate(createUser), controller.create);
   */
  .post(validate(createRoute), controller.create);


router
  .route('/choose/:routeId')
  .patch(controller.chooseDriver);

router
  .route('/isRouteSafe')
  .post(controller.isRouteSafe);

router
  .route('/active')
  .get(controller.listActive);

router
  .route('/:routeId')
  .get(controller.get)
  .delete(controller.remove);

router
  .route('/checkRoute/:routeId')
  .patch(validate(checkRoute), controller.checkRoute);

router
  .route('/routeScore')
  .post(controller.getRouteScore);

module.exports = router;

const lineString = require('@turf/helpers').lineString;
const point = require('@turf/helpers').point;
const multiPoint = require('@turf/helpers').multiPoint;
const isPointInPolygon = require('@turf/boolean-point-in-polygon');
const buffer = require('@turf/buffer');
const distance = require('@turf/distance');
const httpStatus = require('http-status');
const Route = require('../models/route.model');
const User = require('../models/user.model');
const { handler: errorHandler } = require('../middlewares/error');

/**
 * Load route and append to req.
 * @public
 */
exports.load = async (req, res, next, id) => {
  try {
    const route = await Route.get(id);
    req.locals = { route };
    return next();
  } catch (error) {
    return errorHandler(error, req, res);
  }
};

// choosing driver
exports.chooseDriver = async (req, res, next) => {
  let maxDistance = 20000; // kilometers
  let driverChosen = null;
  // console.info(req.app.drivers);
  const { route } = req.locals;
  try {
    if (route && req.app.drivers.length !== 0) {
      // check which driver is close to this
      const start = point([route.start.coordinates[0], route.start.coordinates[1]]);
      req.app.drivers.forEach(async (driver) => {
        const user = await User.get(driver._id);
        // await User.get(driver._id).then((user) => {
          const position = point([user.location.coordinates[1], user.location.coordinates[0]]);
          console.info(distance(start, position), { units: 'kilometers' });
          if (distance(start, position) < maxDistance) {
            driverChosen = driver;
            maxDistance = distance(start, position, { units: 'kilometers' });
          }
        // }).catch((error) => {
        //   console.info(error);
        // });
      }).then((result) => {
        console.info(result);
      });
      if (driverChosen) {
        res.status(httpStatus.OK);
        res.send('Exito');
        req.app.io.to(driverChosen.socketId).emit('DRIVER REQUEST', req.locals.route);
      }
    }
    res.status(httpStatus.CONFLICT);
    res.send('NOT AVAILABLE');
  } catch (error) {
    res.status(httpStatus.BAD_REQUEST);
    res.json(error);
  }
};
/**
 * Get route
 * @public
 */
exports.get = (req, res) => {
  res.json(req.locals.route.transform());
};

/**
 * Create new route
 * @public
 */
exports.create = async (req, res, next) => {
  try {
    // arreglar esto...
    req.body.points = multiPoint(req.body.points);
    req.body.points = req.body.points.geometry;
    const route = new Route(req.body);
    const savedRoute = await route.save();
    if (savedRoute) {
      // chooseDriver();
    }
    res.status(httpStatus.CREATED);
    res.json(savedRoute.transform());
  } catch (error) {
    res.status(httpStatus.BAD_REQUEST);
    res.json(error);
  }
};

/**
 * Get routes list
 * @public
 */
exports.list = async (req, res, next) => {
  try {
    const routes = await Route.list(req.query);
    const transformedRoutes = routes.map(route => route.transform());
    res.json(transformedRoutes);
  } catch (error) {
    next(error);
  }
};


exports.listActive = async (req, res, next) => {
  try {
    const routes = await Route.listActive(req.query);
    const transformedRoutes = routes.map(route => route.transform());
    res.json(transformedRoutes);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete route
 * @public
 */
exports.remove = (req, res, next) => {
  const { route } = req.locals;

  route.remove()
    .then(() => res.status(httpStatus.NO_CONTENT).end())
    .catch(e => next(e));
};


exports.checkRoute = (req, res, next) => {
  const { route } = req.locals;
  const linestring1 = lineString(route.points.coordinates);
  const _point = point(req.body.position);
  const buffered = buffer(linestring1, 10, { units: 'kilometers' });
  const isInBuffer = isPointInPolygon(_point, buffered.geometry);
  // emiting alert...
  if (isInBuffer) {
    try {
      req.app.io.to(req.params.routeId).emit('DANGER', { danger: 'danger' });
    } catch (e) {
      console.error('Something wrong happened, ', e);
    }
  }
  res.send(isInBuffer);
};


const lineString = require('@turf/helpers').lineString;
const point = require('@turf/helpers').point;
const async = require('async');
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
    let routeData = {
      client: req.body.client,
      points: req.body.points,
      start: req.body.start,
      end: req.body.end,
      status: req.body.status,
      route_index: req.body.route_index,
      duration: req.body.duration
    };
    if (req.body.driver) {
      routeData.driver = req.body.driver;
    }
    if (req.body.supersededRoute) {
      routeData.supersededRoute = req.body.supersededRoute;
    }
    if (req.body.waypoints) {
      routeData.waypoints = multiPoint(req.body.waypoints);
      routeData.waypoints = routeData.waypoints.geometry;
    }
    routeData.points = multiPoint(req.body.points);
    routeData.points = routeData.points.geometry;
    const route = new Route(routeData);
    const savedRoute = await route.save();
    //if client request for a taxi, choose a driver
    if (req.body.taxiRequest && savedRoute) {
      chooseDriver(req, res, next, savedRoute);
    } else if(savedRoute && req.body.supersededRoute) {
      updateSupersededRoute(req, savedRoute)
    }
    res.status(httpStatus.CREATED);
    res.json(savedRoute.transform());
  } catch (error) {
    res.status(httpStatus.BAD_REQUEST);
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


// choosing driver
const chooseDriver = (req, res, next, route) => {
  if (!req.app.drivers || req.app.drivers.length === 0) {
    res.status(httpStatus.NOT_ACCEPTABLE);
    res.end('error');
  }
  let maxDistance = 30000; // kilometers
  let driverChosen = null;
  try {
    if (route && req.app.drivers.length !== 0) {
      // check which driver is close to this
      const start = point([route.start.coordinates[1], route.start.coordinates[0]]);
      async.forEach(req.app.drivers, async (driver, callback) => {
        try {
          const tmpRoute = await Route.findOne({
            driver: driver._id,
            status: { $in: ['active', 'pending'] },
          }).exec().catch((e) => {
            console.error('Something bad happened, ', e);
          });
          if (!tmpRoute) {
            const user = await User.get(driver._id);
            const position = point([user.location.coordinates[1], user.location.coordinates[0]]);
            if (distance(start, position) < maxDistance) {
              driverChosen = driver;
              maxDistance = distance(start, position, { units: 'kilometers' });
            }
          }
          callback();
        } catch (e) {
          console.error('Something wrong happened, ', e);
        }
      }, async (err) => {
        if (!driverChosen) {
          res.status(httpStatus.CONFLICT);
          res.end('COULD NOT FIND A DRIVER');
        }
        if (err) {
          console.error('ERROR HAPPENED LOOKING FOR A DRIVER', err);
          // res.end(err);
        } else if (driverChosen) {
          const user = await User.get(route.client);
          const driver = await User.get(driverChosen._id);
          // agregamos el conductor a la ruta.
          const newRoute = Object.assign(route, { driver: driverChosen._id, status: 'pending' });
          await newRoute.save();
          const client = req.app.clients.filter(client => {
            if (client._id == route.client) return client;
          })
          req.app.io.to(driverChosen.socketId).emit('ROUTE REQUEST', { user, route });
          if (client) {
            req.app.io.to(client[0].socketId).emit('DRIVER - CHOSEN', driver);
          } else console.info("Client disconnected")

        } else {
          console.info('WE COULD NOT FIND ANY DRIVER AVAILABLE.');
          res.status(httpStatus.CONFLICT);
          res.end('COULD NOT FIND A DRIVER');
        }
      });
    }
  } catch (error) {
    console.error(error);
    res.status(httpStatus.BAD_REQUEST);
    res.json(error);
  }
};
//update superseded route status and send 'ROUTE CHANGE - RESULT' event
const updateSupersededRoute = (req, savedRoute) => {
  Route.findById(req.body.supersededRoute, (err, route) => {
    if (err) {
      console.error(err)
    }
    if (route) {
      route.status = 'superseded'; 
      route.save();
    }
  });
  req.app.io.of('/').in(req.body.supersededRoute).clients((error, socketIds) => {
    if (error) throw error;
    socketIds.forEach((socketId) => {
      req.app.io.sockets.sockets[socketId].leave(req.body.supersededRoute);
      req.app.io.sockets.sockets[socketId].join(savedRoute._id);
    });
    Route.find({ _id: savedRoute._id})
    .populate('client')
    .populate('driver')
    .exec( (err, route) => {
      if (err) return err
      req.app.monitors.forEach((monitor) => {
        req.app.io.to(monitor.socketId).emit('ROUTE CHANGE - RESULT', status="ok", route[0]);
      });
      const driverID = route[0].driver._id;
      const filterDrivers = req.app.drivers.filter(driver => driver._id == driverID);
      if (filterDrivers) {
        req.app.io.to(filterDrivers[0].socketId).emit('ROUTE CHANGE - RESULT', status="ok", route[0]);
      }
    });  
  });
}
exports.chooseDriver = (req, res, next) => {
  if (!req.app.drivers || req.app.drivers.length === 0) {
    res.status(httpStatus.NOT_ACCEPTABLE);
    res.end('error');
  }
  let maxDistance = 30000; // kilometers
  let driverChosen = null;
  // console.info(req.app.drivers);
  const { route } = req.locals;
  try {
    if (route && req.app.drivers.length !== 0) {
      const start = point([route.start.coordinates[1], route.start.coordinates[0]]);
      async.forEach(req.app.drivers, async (driver, callback) => {
      // check if driver is already in a route.
        const tmpRoute = await Route.findOne({
          driver: driver._id,
          status: { $in: ['active', 'pending'] },
        }).exec().catch((e) => {
          console.error(e);
        });
        if (!tmpRoute) {
          const user = await User.get(driver._id);
          const position = point([user.location.coordinates[1], user.location.coordinates[0]]);
          // validar si conductor ya esta en ruta
          if (distance(start, position) < maxDistance) {
            driverChosen = driver;
            maxDistance = distance(start, position, { units: 'kilometers' });
          }
          callback();
        }
        callback();
      }, async (err) => {
        if (!driverChosen) {
          res.status(httpStatus.CONFLICT);
          res.end('COULD NOT FIND A DRIVER');
        }
        if (err) {
          res.end(err);
        } else if (driverChosen) {
          const user = await User.get(route.client);
          const newRoute = Object.assign(route, { driver: driverChosen._id });
          await newRoute.save();
          req.app.io.to(driverChosen.socketId).emit('ROUTE REQUEST', { user, route });
          res.status(httpStatus.OK);
          res.end(JSON.stringify(driverChosen));
        } else {
          res.status(httpStatus.NOT_FOUND);
          res.end('Not found');
        }
      });
    }
  } catch (error) {
    console.error(error);
    res.status(httpStatus.BAD_REQUEST);
    res.json(error);
  }
};


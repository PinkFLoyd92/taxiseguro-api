const lineString = require('@turf/helpers').lineString;
const isPointInPolygon = require('@turf/boolean-point-in-polygon');
const buffer = require('@turf/buffer');
const User = require('../models/user.model');
const Route = require('../models/route.model');
const distance = require('@turf/distance');
const point = require('@turf/helpers').point;
const { maxDistance } = require('./../../config/vars');
const { maxDistanceToFinish } = require('./../../config/vars');

/* we update the route to active, when the client's position and the driver's position are the same.
*/

function callback(err, numAffected) {
  // numAffected is the number of updated documents
  if (err) {
    console.error(err);
  }
  console.info(numAffected);
}


exports.deletePendingRoutesByUserId = async (userId) => {
  await Route.remove({
    client: userId,
    status: 'pending',
  });
};
exports.checkRouteStatus = async (io, monitors = [], data = {}) => {
  const conditions = { _id: data.userId };
  const update = {
    location: {
      type: 'Point',
      coordinates: [data.position.longitude, data.position.latitude],
    },
  };
  const options = { multi: false };

  await User.update(conditions, update, options, callback);

  if (!data.route_id) {
    return false;
  }
  const route = await Route.get(data.route_id);
  if (route) {
    if (!route.driver || !route.client) return false;

    let client = null;
    let driver = null;
    let clientPos = null;
    let driverPos = null;

    if (data.role === 'client') {
      driver = await User.get(route.driver);
      clientPos = point([data.position.latitude, data.position.longitude]);
      driverPos = point([driver.location.coordinates[1], driver.location.coordinates[0]]);
      if (route.status === 'active' || route.status === 'danger') {
        checkBuffer(route, data, io, monitors, clientPos);
      }
    } else { // driver
      client = await User.get(route.client);
      clientPos = point([client.location.coordinates[1], client.location.coordinates[0]]);
      driverPos = point([data.position.latitude, data.position.longitude]);
    }

    if (route.status === 'active' || route.status === 'danger') {
      console.info('ROUTE IS ALREADY ACTIVATED');
      canRouteFinish(clientPos, driverPos, route, io, monitors);
    } else if (route.status === 'pending' && data.role === 'driver') {
      console.info('ROUTE IS NOT ACTIVATED YET');
      canRouteActivate(clientPos, driverPos, route, io, monitors);
    }
  }
};

const canRouteActivate = async (clientPos, driverPos, route, io, monitors = []) => {
  let _route = null;
  console.info('distance kilometers: ', distance(driverPos, clientPos), ', DEBE SER MENOR DE 30 m PARA ACTIVARSE');
  if (distance(driverPos, clientPos) < maxDistance) {
    _route = Object.assign(route, { status: 'active' });
    await _route.save();
    io.to(_route._id).emit('ROUTE - START', { routeStatus: 'active' });

    const driver = await User.get(route.driver);
    const client = await User.get(route.client);
    monitors.forEach((monitor) => {
      io.to(monitor.socketId).emit('ROUTE - ACTIVE', { route: _route, client, driver });
    });
    return true;
  }
  return false;
};

const canRouteFinish = async (clientPos, driverPos, route, io, monitors = []) => {
  const endPos = point([route.end.coordinates[1], route.end.coordinates[0]]);
  const clientDistance = distance(endPos, clientPos);
  const driverDistance = distance(endPos, driverPos);
  console.info('distance kilometers client: ', clientDistance, ', DEBE SER MENOR DE 50 m');
  console.info('distance kilometers driver: ', driverDistance, ', DEBE SER MENOR DE 50 m');

  if ((clientDistance < maxDistanceToFinish) && (driverDistance < maxDistanceToFinish)) {
    console.info('ROUTE CAN FINISH');
    const _route = Object.assign(route, { status: 'finished' });
    _route.save((err, ruta) => {
      if (err) { console.error('Something bad happened, ', err); } else if (ruta) {
        io.to(ruta._id).emit('ROUTE - FINISH');
        monitors.forEach((monitor) => {
          io.to(monitor.socketId).emit('ROUTE - INACTIVE', { route: ruta });
        });
        io.of('/').in(ruta._id).clients((error, socketIds) => {
          if (error) throw error;
          socketIds.forEach((socketId) => {
            io.sockets.sockets[socketId].leave(ruta._id);
          });
        });
      }
    }); // save route
  }
};

exports.isDriverInActiveRoute = async (data, io) => {
  const route = await Route.findOne({ driver: data._id, status: { $in: ['active', 'pending', 'danger'] } })
    .populate('client')
    .populate('driver')
    .select('-updatedAt -createdAt -points')
    .exec();

  return route;
};

exports.isClientInActiveRoute = async (data, io) => {
  const route = await Route.findOne({ client: data._id, status: { $in: ['active', 'pending', 'danger'] } })
    .populate('client')
    .populate('driver')
    .select('-updatedAt -createdAt -points')
    .exec();

  return route;
};

// 0.5 KM buffer
const checkBuffer = async (route, data, io, monitors, clientPos) => {
  const coordinates = route.points.coordinates.map((coordinate) => {
    const _coordinate = [coordinate[0], coordinate[1]];
    const tmp_lat = _coordinate[1];
    _coordinate[1] = _coordinate[0];
    _coordinate[0] = tmp_lat;
    return _coordinate;
  });
  const linestring1 = lineString(coordinates);
  const _point = clientPos;
  const buffered = buffer(linestring1, 1, { units: 'kilometers' });
  const isInBuffer = isPointInPolygon(_point, buffered.geometry);
  console.info('DISTANCE BUFFER, ', isInBuffer);
  if (!isInBuffer) {
    monitors.forEach((monitor) => {
      io.to(monitor.socketId).emit('ROUTE - DANGER', { routeId: route._id, outofBuffer: true });
    });
  }
  if (!isInBuffer && route.status === 'active') {
    const _route = Object.assign(route, { status: 'danger' });
    await _route.save();
    console.info('PELIGRO, SALIO USUARIO DEL BUFFER');
    try {
      monitors.forEach((monitor) => {
        io.to(monitor.socketId).emit('ROUTE - DANGER', { routeId: route._id, outofBuffer: true });
      });
    } catch (e) {
      console.error('Something wrong happened, ', e);
    }
  } else if (isInBuffer) { // se encuentra dentro del buffer
    // console.info('SE ENCUENTRA DENTRO DEL BUFFER');
    try {
      if (route.status === 'danger') {
        console.info('ENTRO DE NUEVO AL BUFFER');
        const _route = Object.assign(route, { status: 'active' });
        await _route.save();
        monitors.forEach((monitor) => {
          io.to(monitor.socketId).emit('ROUTE - DANGER', { routeId: route._id, outofBuffer: false });
        });
      }
    } catch (e) {
      console.error('Something wrong happened, ', e);
    }
  }
};

exports.saveScore = async (routeId, score) => {
  Route.findById(routeId, (err, route) => {
    if (err) {
      console.error('Something bad happened, ', e);
    }
    if (route) {
      route.safeScore = score;
      route.save();
    }
  });
};


// coordinates are sent from android client
exports.getRouteScore = async (coordinates) => {
  let totalScore = 0;
  const routes = await Route.listRatedRoutes();
  const scores = [];
  routes.forEach((route) => {
    let counterEqualPoints = 0;
    const linestring1 = lineString(route.points.coordinates);
    const buffered = buffer(linestring1, 0.5, { units: 'kilometers' });
    coordinates.forEach((pointEvalRoute) => {
      const _point = point(pointEvalRoute);
      const isInBuffer = isPointInPolygon(_point, buffered.geometry);
      if (isInBuffer) {
        counterEqualPoints += 1;
      }

      if (counterEqualPoints >= route.points.coordinates.length / 2) {
        scores.push(route.safeScore);
      }
    });
  });
  if (scores.length === 0) { totalScore = -1; } else {
    totalScore = scores.reduce(add, 0) / scores.length;
  }
  return Math.ceil(totalScore); // returning the upward integer
};

const arePointsEqual = (mongoPoint, androidPoint) => (mongoPoint[1] === androidPoint[1]
          && mongoPoint[0] === androidPoint[0]);

function add(a, b) {
  return a + b;
}

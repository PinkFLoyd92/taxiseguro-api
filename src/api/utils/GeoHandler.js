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
    } else if (route.status === 'pending') {
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
    route = Object.assign(route, { status: 'finished' });
    route.save((err, route) => {
      if (err) { console.error('Something bad happened, ', err); } else if (route) {
        io.to(route._id).emit('ROUTE - FINISH');
        monitors.forEach((monitor) => {
          io.to(monitor.socketId).emit('ROUTE - INACTIVE', { route });
        });
        io.of('/').in(route._id).clients((error, socketIds) => {
          if (error) throw error;
          socketIds.forEach((socketId) => {
            io.sockets.sockets[socketId].leave(route._id);
          });
        });
      }
    }); // save route
  }
};

exports.isDriverInActiveRoute = async (data, io) => {
  const route = await Route.findOne({ driver: data._id, status: { $in: ['active', 'pending'] } })
    .populate('client')
    .populate('driver')
    .select('-updatedAt -createdAt -points')
    .exec();

  return route;
};

exports.isClientInActiveRoute = async (data, io) => {
  const route = await Route.findOne({ client: data._id, status: { $in: ['active', 'pending'] } })
    .populate('client')
    .populate('driver')
    .select('-updatedAt -createdAt -points')
    .exec();

  return route;
};

// 10 KM buffer
const checkBuffer = async (route, data, io, monitors, clientPos) => {
  const linestring1 = lineString(route.points.coordinates);
  const _point = clientPos;
  const buffered = buffer(linestring1, 10, { units: 'kilometers' });
  const isInBuffer = isPointInPolygon(_point, buffered.geometry);
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
  } else { // se encuentra dentro del buffer
    try {
      if (route.status === 'danger') {
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

const User = require('../models/user.model');
const Route = require('../models/route.model');
const distance = require('@turf/distance');
const point = require('@turf/helpers').point;
const { maxDistance } = require('./../../config/vars');

/* we update the route to active, when the client's position and the driver's position are the same.
*/

function callback(err, numAffected) {
  // numAffected is the number of updated documents
  if (err) {
    console.error(err);
  }
  console.info(numAffected);
}

exports.canRouteActivate = async (io, routeId, drivers = [], clients = [], monitors = [], data = {}) => {
  const conditions = { _id: data._id };
  const update = {
    location: {
      type: 'Point',
      coordinates: [data.position.longitude, data.position.latitude],
    },
  };
  const options = { multi: false };

  await User.update(conditions, update, options, callback);
  let client = null;
  let driver = null;
  let route = null;
  if (!routeId) {
    return false;
  }
  route = await Route.get(routeId);
  if (route.status === 'active') {
    console.info('ROUTE IS ALREADY ACTIVATED');
    return true;
  }
  if (!route.driver) return false;
  client = await User.get(route.client);
  driver = await User.get(route.driver);

  const clientPos = point([route.start.coordinates[1], route.start.coordinates[0]]); // cambiar esto por lo del user??
  const driverPos = point([driver.location.coordinates[1], driver.location.coordinates[0]]);
  console.info('distance kilometers: ', distance(driverPos, clientPos), ', DEBE SER MENOR DE 5 KM PARA ACTIVARSE');
  if (distance(driverPos, clientPos) < maxDistance) {
    route = Object.assign(route, { status: 'active' });
    await route.save();
    io.to(routeId).emit('ROUTE - START', { routeStatus: 'active' });
    monitors.forEach((monitor) => {
      io.to(monitor.socketId).emit('ROUTE - ACTIVE', { route });
    });
    return true;
  }
  return false;
};

exports.isDriverInActiveRoute = async (data, io) => {
  const route = await Route.findOne({ driver: data._id, status: { $in: ['active', 'pending'] } })
    .populate('client')
    .populate('driver')
    .select('-updatedAt -createdAt -points')
    .exec();

  return route;
};

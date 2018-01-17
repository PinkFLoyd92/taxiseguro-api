const User = require('../models/user.model');
const Route = require('../models/route.model');
const distance = require('@turf/distance');
const point = require('@turf/helpers').point;
const { maxDistance } = require('./../../config/vars');

/* we update the route to active, when the client's position and the driver's position are the same.
*/
exports.canRouteActivate = async (io, routeId, drivers = [], clients = [], monitors = []) => {
  let client = null;
  let driver = null;
  let route = null;
  if (!routeId) {
    return false;
  }
  route = await Route.get(routeId);
  if (route.status === 'active') {
    return true;
  }
  if (!route.driver) return false;
  client = await User.get(route.client);
  driver = await User.get(route.driver);
  const clientPos = point([client.location.coordinates[1], client.location.coordinates[0]]);
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


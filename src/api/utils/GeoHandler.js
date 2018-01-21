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

exports.checkRouteStatus = async (io, monitors = [], data = {} ) => {
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
  let route = await Route.get(data.route_id);
  if (route) {
    if (!route.driver || !route.client) return false;
    let client = null;
    let driver = null;
    let clientPos = null;
    let driverPos = null;
    if (data.role === 'client') {
      driver = await User.get(route.driver);
      clientPos =  point([data.position.latitude, data.position.longitude]);  
      driverPos = point([driver.location.coordinates[1], driver.location.coordinates[0]]);
    } else { //driver
      client = await User.get(route.client);
      clientPos =  point([client.location.coordinates[1], client.location.coordinates[0]]);  
      driverPos = point([data.position.latitude, data.position.longitude]);
    }

    if (route.status === 'active') {
      console.info('ROUTE IS ALREADY ACTIVATED');
      canRouteFinish(clientPos, driverPos, route, io, monitors)
    } else if(route.status === 'pending') {
      console.info('ROUTE IS NOT ACTIVATED YET');
      canRouteActivate(clientPos, driverPos, route, io, monitors)
    }
  }
}

canRouteActivate = async (clientPos, driverPos, route, io, monitors = []) => {
  
  console.info('distance kilometers: ', distance(driverPos, clientPos), ', DEBE SER MENOR DE 30 m PARA ACTIVARSE');
  if (distance(driverPos, clientPos) < maxDistance) {
    route = Object.assign(route, { status: 'active' });
    await route.save();
    io.to(route._id).emit('ROUTE - START', { routeStatus: 'active' });
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

canRouteFinish = async (clientPos, driverPos, route, io, monitors = []) => {
   
  const endPos = point([route.end.coordinates[1], route.end.coordinates[0]]);
  const clientDistance =  distance(endPos, clientPos)
  const driverDistance =  distance(endPos, driverPos)
  console.info('distance kilometers client: ', clientDistance, ', DEBE SER MENOR DE 50 m');
  console.info('distance kilometers driver: ', driverDistance, ', DEBE SER MENOR DE 50 m');
  
  if ((clientDistance < maxDistanceToFinish) && (driverDistance < maxDistanceToFinish)) {
    console.info("ROUTE CAN FINISH")
    route = Object.assign(route, { status: 'inactive' });
    route.save((err, route) => {
      if (err)
        console.error('Something bad happened, ', err);
      else if(route) {
        
        io.to(route._id).emit('ROUTE - FINISH');
        monitors.forEach((monitor) => {
          io.to(monitor.socketId).emit('ROUTE - INACTIVE', { route });
        });
        io.of('/').in(route._id).clients((error, socketIds) => {
          if (error) throw error;
          socketIds.forEach(socketId => {
            io.sockets.sockets[socketId].leave(route._id)
          });
        });
    
      }
    }); //save route
  } 

}
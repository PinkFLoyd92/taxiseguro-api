const Route = require('./api/models/route.model');
const User = require('./api/models/user.model');

// make bluebird default Promise
Promise = require('bluebird'); // eslint-disable-line no-global-assign
const { port, env } = require('./config/vars');
const app = require('./config/express');
const http = require('http');
const mongoose = require('./config/mongoose');

const server = http.createServer(app);
const io = require('socket.io').listen(server);
const {
  checkRouteStatus,
  isDriverInActiveRoute,
  isClientInActiveRoute,
  deletePendingRoutesByUserId,
} = require('./api/utils/GeoHandler');

server.listen(9000);
console.info('Socket Server listening in port 9000');
app.io = io;

// open mongoose connection
mongoose.connect();

// listen to requests
app.listen(port, () => console.info(`server started on port ${port} (${env})`));

const socketClients = new Map();
const drivers = [];
const clients = [];
const monitors = [];
app.socketClients = socketClients;
app.drivers = drivers;
app.clients = clients;
app.monitors = monitors;

io.set('origins', '*:*');
io.on('connection', (socket) => {
  socket.on('CHAT - GET MONITORS', async () => {
    await monitors.forEach(async (user) => {
      const usuario = await User.findOne({ _id: user._id });
      console.info('creating monitor...');
      socket.emit('CHAT - MONITORS', usuario);
    });
  });
  /*
  JUST SEND THE ROOM ID
*/
  socket.on('JOIN ROUTE', (room) => {
    // JOINING ROUTE
    socket.join(room);
  });

  socket.on('LEAVE ROUTE', (room) => {
    socket.leave(room);
  });

  socket.on('SENDINFO', (data) => {
    let _data = {};
    const userInfo = {};

    // _data JSON containing the info.
    _data = (typeof (data) === 'string') ? JSON.parse(data) : data;

    userInfo._id = _data._id;
    userInfo.role = _data.role;
    userInfo.socketId = socket.id;
    socketClients.set(socket.id, userInfo);
    switch (userInfo.role) {
      case 'client':
        clients.push(userInfo);
        break;
      case 'driver':
        drivers.push(userInfo);
        break;
      case 'monitor':
        monitors.push(userInfo);
        notifyMonitorConnected(_data);
        break;
      default:
        break;
    }
  });


  /*
  data: { route_id, user_id, role, message}
*/
  socket.on('ROUTE - CHAT', async (data) => {
    const _data = (typeof (data) === 'string') ? JSON.parse(data) : data;
    const route = await Route.get(_data.route_id);
    if (route) {
      switch (data.role) {
        case 'client':
          const clientInfo = await clients.find(client => client._id == route.client);
          if (!clientInfo) {
            socket.emit('ROUTE - CHAT ERROR', { role: _data.role, route_id: _data.route_id });
            break;
          }
          io.sockets.to(clientInfo.socketId).emit('ROUTE - CHAT', _data);
          break;
        case 'driver':
          const driverInfo = drivers.find(driver => driver._id === route.driver);
          if (!driverInfo) {
            socket.emit('ROUTE - CHAT ERROR', { role: _data.role, route_id: _data.route_id });
            break;
          }
          io.sockets.to(driverInfo.socketId).emit('ROUTE - CHAT', _data);
          break;
        default:
          console.error('error Role is not well defined...');
          break;
      }
    }
  });

  socket.on('CHAT - SEND FROM CLIENT', async (data) => {
    const _data = (typeof (data) === 'string') ? JSON.parse(data) : data;
    monitors.forEach((monitor) => { // cambiar esto...
      console.info(_data);
      io.to(monitor.socketId).emit('ROUTE - CHAT RECEIVE', _data);
    });
  });
  /*
  data: { position, route_id, role, userId  }
*/
  socket.on('POSITION', async (data) => {
    const _data = (typeof (data) === 'string') ? JSON.parse(data) : data;

    try {
      if (!_data.role || !_data.userId) {
        console.info(_data);
        console.info('PLEASE SEND THE ROLE OF THE USER...');
        console.info('PLEASE SEND THE USERID');
        return;
      }
      await checkRouteStatus(io, monitors, _data);
      if (_data.role === 'driver') {
        io.to(_data.route_id).emit('ROUTE - POSITION DRIVER', { position: _data.position, routeId: _data.route_id });
      } else if (_data.role === 'client') {
        io.to(_data.route_id).emit('ROUTE - POSITION CLIENT', { position: _data.position, routeId: _data.route_id });
      } else {
        console.error('PLEASE ADD THE ROLE TO THE DATA PAYLOAD.');
      }
    } catch (e) {
      console.error('Something wrong happened, ', e);
    }
  });
  socket.on('PANIC BUTTON', (data) => {
    const _data = (typeof (data) === 'string') ? JSON.parse(data) : data;
    try {
      monitors.forEach((monitor) => {
        io.to(monitor.socketId).emit('PANIC BUTTON', _data);
      });
    } catch (e) {
      console.error('Something wrong happened, ', e);
    }
  });
  // _id, role
  socket.on('DRIVER - IS IN ROUTE?', async (data) => {
    let _data = {};
    let routeInfo = null;
    if (typeof (data) === 'string') {
      _data = JSON.parse(data);
    } else {
      _data = data;
    }

    try {
      routeInfo = await isDriverInActiveRoute(_data, io); // route mongoose object
      if (routeInfo) {
        console.info('LOADING ROUTE');
        console.info(routeInfo);
        io.to(socket.id).emit('DRIVER - IS IN ROUTE', routeInfo);
        socket.join(routeInfo._id);
      } else {
        console.error('ROUTE NOT FOUND...');
      }
    } catch (e) {
      console.error('Something wrong happened, ', e);
    }
  });
  socket.on('CLIENT - IS IN ROUTE?', async (data) => {
    let _data = {};
    let routeInfo = null;
    if (typeof (data) === 'string') {
      _data = JSON.parse(data);
    } else {
      _data = data;
    }

    try {
      routeInfo = await isClientInActiveRoute(_data, io); // route mongoose object
      if (routeInfo) {
        console.info('LOADING ROUTE');
        console.info(routeInfo);
        io.to(socket.id).emit('CLIENT - IS IN ROUTE', routeInfo);
        socket.join(routeInfo._id);
      } else {
        console.error('ROUTE NOT FOUND...');
      }
    } catch (e) {
      console.error('Something wrong happened, ', e);
    }
  });
  socket.on('ROUTE CHANGE - REQUEST', async (data) => {
    const filterClients = clients.filter(client => client._id === data.clientId);
    if (filterClients) {
      io.to(filterClients[0].socketId).emit('ROUTE CHANGE - REQUEST', data);
    }
  });
  socket.on('ROUTE CHANGE - RESULT', async (status, route) => {
    if (status === 'cancel') {
      const driverID = route.driverId;
      const filterDrivers = drivers.filter(driver => driver._id === driverID);
      if (filterDrivers) {
        io.to(filterDrivers[0].socketId).emit('ROUTE CHANGE - RESULT', status);
      }
    }
  });
  socket.on('ROUTE DELETE', async (userId) => {
    deletePendingRoutesByUserId(userId);
  });
  socket.on('disconnect', () => {
    // console.info('DISCONNECTED SOCKET...');
    const userInfo = socketClients.get(socket.id);

    try {
      switch (userInfo.role) {
        case 'client':
          const indexClient = clients.findIndex(element => element.socketId === socket.id);
          if (indexClient >= 0) {
            clients.splice(indexClient, 1);
          }
          break;
        case 'driver':
          const indexDriver = drivers.findIndex(element => element.socketId === socket.id);
          if (indexDriver >= 0) {
            drivers.splice(indexDriver, 1);
          }
          break;
        case 'monitor':

          const indexMonitor = monitors.findIndex(element => element.socketId === socket.id);
          notifyMonitorDisconnected(monitors[indexMonitor]);
          if (indexMonitor >= 0) {
            monitors.splice(indexMonitor, 1);
          }
          break;
        default:
          break;
      }
    } catch (e) {
      console.error('Something wrong happened, ', e);
    }
    try {
      socketClients.delete(socket.id);
      console.info('Removing socket...');
    } catch (e) {
      console.error('Something wrong happened, ', e);
    }
  });
});

function notifyMonitorConnected(data) {
  drivers.forEach((driver) => {
    io.sockets.to(driver.socketId).emit('MONITOR - CONNECTED', data);
  });
  clients.forEach((client) => {
    io.sockets.to(client.socketId).emit('MONITOR - CONNECTED', data);
  });
}

function notifyMonitorDisconnected(data) {
  drivers.forEach((driver) => {
    io.sockets.to(driver.socketId).emit('MONITOR - DISCONNECTED', data);
  });
  clients.forEach((client) => {
    io.sockets.to(client.socketId).emit('MONITOR - DISCONNECTED', data);
  });
}

/**
* Exports express
* @public
*/
module.exports = app;

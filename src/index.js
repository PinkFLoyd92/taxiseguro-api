// make bluebird default Promise
Promise = require('bluebird'); // eslint-disable-line no-global-assign
const { port, env } = require('./config/vars');
const app = require('./config/express');
const http = require('http');
const mongoose = require('./config/mongoose');

const server = http.createServer(app);
const io = require('socket.io').listen(server);

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
/*
  JUST SEND THE ROOM ID
*/
  socket.on('JOIN ROUTE', (room) => {
    // JOINING ROUTE
    socket.join(room);
  });

  socket.on('SENDINFO', (data) => {
    let _data = {};
    console.info('RETRIEVING USER INFO FROM CLIENT');
    if (typeof (data) === 'string') {
      _data = JSON.parse(data);
    }
    const userInfo = {};
    userInfo._id = _data._id;
    userInfo.role = _data.role;
    userInfo.socketId = socket.id;
    socketClients.set(socket.id, userInfo);
    switch (userInfo.role) {
      case 'client':
        console.info('Nuevo cliente');
        clients.push(userInfo);
        break;
      case 'driver':
        console.info('Nuevo conductor');
        drivers.push(userInfo);
        break;
      case 'monitor':
        console.info('Nuevo monitor');
        monitors.push(userInfo);
        break;
      default:
        break;
    }
  });

  /*
  data parameters: { position, route_id, role }
*/
  socket.on('POSITION', (data) => {
    try {
      if (!data.role) {
        return;
      }
      if (data.role === 'driver') {
        io.to(data.route_id).emit('ROUTE - POSITION DRIVER', { position: data.position });
      } else if (data.role === 'client') {
        io.to(data.route_id).emit('ROUTE - POSITION CLIENT', { position: data.position });
      } else {
        console.error('PLEASE ADD THE ROLE TO THE DATA PAYLOAD.');
      }
    } catch (e) {
      console.error('Something wrong happened, ', e);
    }
  });
  socket.on('PANIC BUTTON', (data) => {
    try {
      monitors.forEach((monitor) => {
        io.to(monitor.socketId).emit('PANIC BUTTON', data);
      });
    } catch (e) {
      console.error('Something wrong happened, ', e);
    }
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
/**
* Exports express
* @public
*/
module.exports = app;


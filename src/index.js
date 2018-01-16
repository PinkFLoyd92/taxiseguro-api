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

  socket.on('joinRoute', (room) => {
    socket.join(room);
  });

  socket.on('SENDINFO', (data) => {
    console.info('RETRIEVING USER INFO FROM CLIENT');
    if (typeof (data) === 'string') {
      data = JSON.parse(data);
    }
    const userInfo = {};
    userInfo._id = data._id;
    userInfo.role = data.role;
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

  socket.on('POSITION', (data) => {
    try {
      console.log('data: ', data);
    } catch (e) {
      console.error('Something wrong happened, ', e);
    }
  });
  socket.on('PANIC BUTTON', (data) => {
    try {
      console.log('data: ', data);
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


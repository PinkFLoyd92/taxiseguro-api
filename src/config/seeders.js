Promise = require('bluebird'); // eslint-disable-line no-global-assign

const seeder = require('mongoose-seed');
const { mongo } = require('./vars');
const User = require('../api/models/user.model');
const Route = require('../api/models/route.model');

function seedRoute(driverName, clientName, info = {}) {
  return new Promise((resolve) => {
    User.findOne({ name: driverName }).exec()
      .then((user1) => {
        User.findOne({ name: clientName }).exec()
          .then((user2) => {
            // console.info(user2);
            Route.create({ driver: user1._id, client: user2._id }).then((route) => {
              resolve(route);
            }, (error) => {
              console.error(error);
            });
          }, (error) => {
            console.error(error);
          });
      }, (error) => {
        console.error(error);
      });
  });
}

async function populateAll(seeder) {
  await Promise.all([seedRoute('Usuario 1', 'Usuario 2', {})]).then(() => {
    seeder.disconnect();
  });
}
// Connect to MongoDB via Mongoose
seeder.connect(mongo.uri, () => {
  // Load Mongoose models
  seeder.loadModels([
    'src/api/models/user.model.js',
    'src/api/models/route.model.js',
    'src/api/models/fence.model.js',
  ]);

  // Clear specified collections
  seeder.clearModels(['User', 'Route', 'Fence'], () => {
    // Callback to populate DB once collections have been cleared
    seeder.populateModels(data, () => {
      populateAll(seeder);
    });
  });
});

// Data array containing seed data - documents organized by Model
const data = [
  {
    model: 'User',
    documents: [
      {
        name: 'Usuario 1',
        password: '123456',
        role: 'driver',
      },
      {
        name: 'Usuario 2',
        password: '123456',
        role: 'client',
      },
      {
        name: 'Usuario 3',
        password: '123456',
        role: 'monitor',
      },
    ],
  },
  // {
  //   model: 'Route',
  //   documents: [
  //     {
  //       name: 'Usuario 1',
  //       password: '123456',
  //       role: 'driver',
  //     },
  //     {
  //       name: 'Usuario 2',
  //       password: '123456',
  //       role: 'client',
  //     },
  //     {
  //       name: 'Usuario 3',
  //       password: '123456',
  //       role: 'monitor',
  //     },
  //   ],
  // },
];

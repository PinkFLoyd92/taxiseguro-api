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
            Route.create({ driver: user1._id, client: user2._id, points: info.geoInfo.points, start:info.geoInfo.start, end: info.geoInfo.end}).then((route) => {
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
  await Promise.all([seedRoute('Usuario 1', 'Usuario 2', {
    geoInfo: {
      start: {
        type: 'Point',
        coordinates: [-79.96027, -2.14607],
      },
      end: {
        type: 'Point',
        coordinates: [-79.947786, -2.158966],
      },
      points: {
        type: 'MultiPoint',
        coordinates: [
          [-79.958721, -2.147813],
          [-79.955361, -2.151361],
          [-79.952895, -2.15198],
          [-79.946415, -2.157803],
        ],
      },
    },
  })]).then(() => {
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
        location: {
          type: "Point",
          coordinates: [-2.14403,-79.96104]
        }
      },
      {
        name: 'Usuario 2',
        password: '123456',
        role: 'client',
        location: {
          type: "Point",
          coordinates: [-2.14403,-79.96104]
        }
      },
      {
        name: 'Usuario 3',
        password: '123456',
        role: 'monitor',
        location: {
          type: "Point",
          coordinates: [-2.14403,-79.96104]
        }
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

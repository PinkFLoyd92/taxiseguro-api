const multiPoint = require('@turf/helpers').multiPoint;
const lineString = require('@turf/helpers').lineString;
const isPointInPolygon = require('@turf/boolean-point-in-polygon');
const buffer = require('@turf/buffer');

Promise = require('bluebird');
// eslint-disable-line no-global-assign

const seeder = require('mongoose-seed');
const { mongo } = require('./vars');
const User = require('../api/models/user.model');
const Route = require('../api/models/route.model');
const Fence = require('../api/models/fence.model');

function seedRoute(driverName, clientName, info = {}) {
  return new Promise((resolve) => {
    User.findOne({ name: driverName }).exec()
      .then((user1) => {
        User.findOne({ name: clientName }).exec()
          .then((user2) => {
            // console.info(user2);
            Route.create({
              driver: user1._id, client: user2._id, points: info.geoInfo.points, start: info.geoInfo.start, end: info.geoInfo.end,
            }).then((route) => {
              try {
                const linestring1 = lineString(info.geoInfo.points.coordinates);
                const buffered = buffer(linestring1, 10, { units: 'kilometers' });
                // console.info(buffered)
                console.info(isPointInPolygon(info.geoInfo.start, buffered.geometry));
              } catch (e) {
                console.error(e);
              }
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


async function populateAll() {
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
        cedula: '0929478321',
        mobile: '09934213432',
        username: 'user1',
        password: '123456',
        vehicle_plate: 'GYA-123',
        vehicle_description: 'Nissan 370z negro',
        role: 'driver',
        location: {
          type: 'Point',
          coordinates: [-79.96104, -2.14403],
        },
      },
      {
        name: 'driver1',
        cedula: '0929478311',
        mobile: '09934213432',
        username: 'driver1',
        password: '123456',
        vehicle_plate: 'GYA-123',
        vehicle_description: 'Nissan 370z negro',
        role: 'driver',
        location: {
          type: 'Point',
          coordinates: [0,0],
        },
      },
      {
        name: 'driver2',
        cedula: '0929478314',
        mobile: '09934213452',
        username: 'driver2',
        password: '123456',
        vehicle_plate: 'GYA-123',
        vehicle_description: 'Nissan 370z negro',
        role: 'driver',
        location: {
          type: 'Point',
          coordinates: [-79.96104, -2.14403],
        },
      },
      {
        name: 'Usuario 2',
        cedula: '0929478111',
        mobile: '09934212232',
        username: 'user2',
        password: '123456',
        role: 'client',
        location: {
          type: 'Point',
          coordinates: [-79.96104, -2.14403],
        },
      },
      {
        name: 'Usuario 3',
        cedula: '0912478111',
        mobile: '09987212232',
        username: 'user3',
        password: '123456',
        role: 'monitor',
        location: {
          type: 'Point',
          coordinates: [-79.96104, -2.14403],
        },
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

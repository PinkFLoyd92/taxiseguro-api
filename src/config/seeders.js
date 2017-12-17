const seeder = require('mongoose-seed');
const { mongo } = require('./vars');

// Connect to MongoDB via Mongoose
seeder.connect(mongo.uri, () => {
  // Load Mongoose models
  seeder.loadModels([
    'src//api/models/user.model.js',
    'src/api/models/route.model.js',
    'src/api/models/fence.model.js',
  ]);

  // Clear specified collections
  seeder.clearModels(['User', 'Route', 'Fence'], () => {
    // Callback to populate DB once collections have been cleared
    seeder.populateModels(data, () => {
      seeder.disconnect();
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

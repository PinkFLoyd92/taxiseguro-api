const Joi = require('joi');
const Route = require('../models/route.model'); // driver or client

module.exports = {

  // PATCH /v1/routes/checkRoute/:routeId
  checkRoute: {
    body: {
      position: Joi.array().required()
    },
    params: {
      routeId: Joi.string().regex(/^[a-fA-F0-9]{24}$/).required(),
    },
  },
};

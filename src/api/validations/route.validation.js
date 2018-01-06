const Joi = require('joi');
const Route = require('../models/route.model'); // driver or client

module.exports = {

  // POST /v1/routes
  createRoute: {
    body: {
      client: Joi.string().max(128).required(),
      points: Joi.array().required(),
      start: { coordinates: Joi.array().required() },
      end: { coordinates: Joi.array().required() },
      status: Joi.string().valid(Route.possibleStatus),
    },
  },

  // PATCH /v1/routes/checkRoute/:routeId
  checkRoute: {
    body: {
      position: Joi.array().required(),
    },
    params: {
      routeId: Joi.string().regex(/^[a-fA-F0-9]{24}$/).required(),
    },
  },
};

const Joi = require('joi');
const User = require('../models/user.model'); // driver or client

module.exports = {

  // GET /v1/users
  listUsers: {
    query: {
      page: Joi.number().min(1),
      perPage: Joi.number().min(1).max(20),
      name: Joi.string(),
      role: Joi.string().valid(User.roles),
      active: Joi.boolean(),
    },
  },

  // POST /v1/users
  createUser: {
    body: {
      name: Joi.string().max(128).required(),
      cedula: Joi.string().min(10).max(10).required(),
      mobile: Joi.string().max(15),
      username: Joi.string().max(60).required(),
      password: Joi.string().min(6).max(128).required(),
      role: Joi.string().valid(User.roles),
    },
  },

  // PUT /v1/users/:userId
  replaceUser: {
    body: {
      name: Joi.string().max(128),
      password: Joi.string().min(6).max(128).required(),
      role: Joi.string().valid(User.roles),
    },
    params: {
      userId: Joi.string().regex(/^[a-fA-F0-9]{24}$/).required(),
    },
  },

  // PATCH /v1/users/:userId
  updateUser: {
    body: {
      name: Joi.string().max(128),
      cedula: Joi.string().min(10).max(10),
      mobile: Joi.string().max(15),
      username: Joi.string().max(60),
      password: Joi.string().min(6).max(128),
      role: Joi.string().valid(User.roles),
    },
    params: {
      userId: Joi.string().regex(/^[a-fA-F0-9]{24}$/).required(),
    },
  },
};

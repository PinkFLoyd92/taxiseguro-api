const mongoose = require('mongoose');
const GeoJSON = require('mongoose-geojson-schema');
const httpStatus = require('http-status');
const { omitBy, isNil } = require('lodash');
// const bcrypt = require('bcryptjs');
// const moment = require('moment-timezone');
// const uuidv4 = require('uuid/v4');
const APIError = require('../utils/APIError');
// const { env } = require('../../config/vars');

/**
* User Roles
*/
const roles = ['driver', 'client', 'monitor'];

/**
 * User Schema
 * @private
 */
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    maxlength: 128,
    index: true,
    trim: true,
  },
  cedula: {
    type: String,
    maxlength: 10,
    trim: true,
  },
  mobile: {
    type: String,
    maxlength: 15,
    trim: true,
  },
  username: {
    type: String,
    maxlength: 60,
    index: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    maxlength: 128,
  },
  role: {
    type: String,
    enum: roles,
    default: 'driver',
  },
  vehicle_plate: {
    type: String,
    maxlength: 10,
  },
  vehicle_description: {
    type: String,
    maxlength: 200,
  },
  isMoving: {
    type: Boolean,
    default: false,
  },
  location: mongoose.Schema.Types.Point,
}, {
  timestamps: true,
});

/**
 * Methods
 */
userSchema.method({
  transform() {
    const transformed = {};
    const fields = ['_id', 'name', 'role', 'createdAt'];

    fields.forEach((field) => {
      transformed[field] = this[field];
    });

    return transformed;
  },

});

/**
 * Statics
 */
userSchema.statics = {

  roles,

  /**
   * Get user
   *
   * @param {ObjectId} id - The objectId of user.
   * @returns {Promise<User, APIError>}
   */
  async get(id) {
    try {
      let user;

      if (mongoose.Types.ObjectId.isValid(id)) {
        user = await this.findById(id).exec();
      }
      if (user) {
        return user;
      }

      throw new APIError({
        message: 'User does not exist',
        status: httpStatus.NOT_FOUND,
      });
    } catch (error) {
      throw error;
    }
  },

  /**
   * List users in descending order of 'createdAt' timestamp.
   *
   * @param {number} skip - Number of users to be skipped.
   * @param {number} limit - Limit number of users to be returned.
   * @returns {Promise<User[]>}
   */
  list({
    page = 1, perPage = 30, name, role,
  }) {
    const options = omitBy({ name, role }, isNil);

    return this.find(options)
      .sort({ createdAt: -1 })
      .skip(perPage * (page - 1))
      .limit(perPage)
      .exec();
  },
};

/**
 * @typedef User
 */
module.exports = mongoose.model('User', userSchema);

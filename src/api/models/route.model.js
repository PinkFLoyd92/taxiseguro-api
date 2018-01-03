const GeoJSON = require('mongoose-geojson-schema');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const { omitBy, isNil } = require('lodash');
const APIError = require('../utils/APIError');

/**
* Route Status
*/
const possibleStatus = ['inactive', 'active', 'cancelled', 'finished'];

/**
 * Route Schema
 * @private
 */
const routeSchema = new mongoose.Schema({
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: {
    type: Date,
    default: Date.now,
  },
  points: mongoose.Schema.Types.MultiPoint,
  start: mongoose.Schema.Types.Point,
  end: mongoose.Schema.Types.Point,
  status: {
    type: String,
    enum: possibleStatus,
    default: 'inactive',
  },
}, {
  timestamps: true,
});

/**
 * Statics
 */
routeSchema.statics = {

  possibleStatus,

  /**
   * Get route
   *
   * @param {ObjectId} id - The objectId of route.
   * @returns {Promise<Route, APIError>}
   */
  async get(id) {
    try {
      let route;

      if (mongoose.Types.ObjectId.isValid(id)) {
        route = await this.findById(id).exec();
      }
      if (route) {
        return route;
      }

      throw new APIError({
        message: 'Route does not exist',
        status: httpStatus.NOT_FOUND,
      });
    } catch (error) {
      throw error;
    }
  },

  /**
   * List routes in descending order of 'createdAt' timestamp.
   *
   * @param {number} skip - Number of routes to be skipped.
   * @param {number} limit - Limit number of routes to be returned.
   * @returns {Promise<Route[]>}
   */
  list({
    page = 1, perPage = 30, driver, client,
  }) {
    const options = omitBy({ driver, client }, isNil);

    return this.find(options)
      .sort({ createdAt: -1 })
      .skip(perPage * (page - 1))
      .limit(perPage)
      .exec();
  },
};

/**
 * @typedef Route
 */
module.exports = mongoose.model('Route', routeSchema);

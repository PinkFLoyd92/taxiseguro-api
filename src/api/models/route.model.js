const GeoJSON = require('mongoose-geojson-schema');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const { omitBy, isNil } = require('lodash');
const APIError = require('../utils/APIError');

/**
* Route Status
*/
const possibleStatus = ['inactive', 'active', 'danger', 'finished', 'pending', 'superseded', 'panic'];

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
  pointsClient: {
    type: mongoose.Schema.Types.MultiPoint,
    select: false,
  },
  pointsDriver: {
    type: mongoose.Schema.Types.MultiPoint,
    select: false,
  },
  status: {
    type: String,
    enum: possibleStatus,
    default: 'pending',
  },
  route_index: {
    type: Number,
    default: 0
  },
  supersededRoute: {
    type: String,
  },
}, {
  timestamps: true,
});

/**
 * Statics
 */

routeSchema.method({
  transform() {
    // const transformed = {};
    // const fields = ['points', 'start', 'end', 'createdAt', 'status', 'driver', 'client', '_id'];

    // const transformed = {};
    // const fields = ['points', 'start', 'end', 'createdAt', 'status', '_id'];

    // fields.forEach((field) => {
    //   transformed[field] = this[field];
    // });

    return this;
    // return transformed;
  },

});
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
   * Update Position
   *
   * @param {ObjectId} id - The objectId of route.
   * @param {String} typeOfUser - The type of user (driver, client).
   * @param {Array} Point - The point to add (driver, client).
   * @returns {Promise<Route, APIError>}
   */
  async updateUserPosition(id, typeOfUser, point) {
    try {
      let route;

      if (mongoose.Types.ObjectId.isValid(id)) {
        route = await this.findById(id).exec();
      }
      if (route) {
        switch (typeOfUser) {
          case 'driver':
            route.pointsDriver.push(point);
            break;
          case 'client':
            route.pointsDriver.push(point);
            break;
          default:
            break;
        }

        await route.save();
        return {
          status: httpStatus.OK,
        };
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

  /**
   * List activeroutes paginated
   *
   * @param {number} skip - Number of routes to be skipped.
   * @param {number} limit - Limit number of routes to be returned.
   * @returns {Promise<Route[]>}
   */
  listActive({
    page = 1, perPage = 30,
  }) {
    const options = omitBy({ }, isNil);
    return this.find({ status: { $in: ['active', 'danger'] } })
      .populate('client')
      .populate('driver ')
      .sort({ createdAt: -1 })
      .skip(perPage * (page - 1))
      .limit(perPage)
      .exec((err, route) => {
        if (err) return (err);
        // console.info(route);
        return route;
      });
  },
  /**
   * Check if user is in Route [active or pending]
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
};

/**
 * @typedef Route
 */
module.exports = mongoose.model('Route', routeSchema);

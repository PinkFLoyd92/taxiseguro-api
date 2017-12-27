const GeoJSON = require('mongoose-geojson-schema');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const { omitBy, isNil } = require('lodash');
const APIError = require('../utils/APIError');

/**
 * Fence Schema
 * @private
 */
const fenceSchema = new mongoose.Schema({
  route: { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
  polygon: mongoose.Schema.Types.Polygon,
}, {
  timestamps: true,
});

/**
 * Statics
 */
fenceSchema.statics = {

  /**
   * Get fence
   *
   * @param {ObjectId} id - The objectId of fence.
   * @returns {Promise<Fence, APIError>}
   */
  async get(id) {
    try {
      let fence;

      if (mongoose.Types.ObjectId.isValid(id)) {
        fence = await this.findById(id).exec();
      }
      if (fence) {
        return fence;
      }

      throw new APIError({
        message: 'Fence does not exist',
        status: httpStatus.NOT_FOUND,
      });
    } catch (error) {
      throw error;
    }},

  /**
   * List fences in descending order of 'createdAt' timestamp.
   *
   * @param {number} skip - Number of fences to be skipped.
   * @param {number} limit - Limit number of fences to be returned.
   * @returns {Promise<Fence[]>}
   */
  list({
    page = 1, perPage = 30, route,
  }) {
    const options = omitBy({ route }, isNil);

    return this.find(options)
      .sort({ createdAt: -1 })
      .skip(perPage * (page - 1))
      .limit(perPage)
      .exec();
  },
};

/**
 * @typedef Fence
 */
module.exports = mongoose.model('Fence', fenceSchema);

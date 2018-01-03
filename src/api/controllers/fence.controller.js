const httpStatus = require('http-status');
const { omit } = require('lodash');
const Fence = require('../models/fence.model');
const { handler: errorHandler } = require('../middlewares/error');

/**
 * Load fence and append to req.
 * @public
 */
exports.load = async (req, res, next, id) => {
  try {
    const fence = await Fence.get(id);
    req.locals = { fence };
    return next();
  } catch (error) {
    return errorHandler(error, req, res);
  }
};

/**
 * Get fence
 * @public
 */
exports.get = (req, res) => res.json(req.locals.fence.transform());

/**
 * Create new fence
 * @public
 */
exports.create = async (req, res, next) => {
  try {
    const fence = new Fence(req.body);
    const savedFence = await fence.save();
    res.status(httpStatus.CREATED);
    res.json(savedFence.transform());
  } catch (error) {
    return errorHandler(error, req, res);
  }
};


/**
 * Update existing fence
 * @public
 */
exports.update = (req, res, next) => {
  const fence = Object.assign(req.locals.fence);
  fence.save()
    .then(savedFence => res.json(savedFence.transform()))
    .catch(e => errorHandler(e, req, res));
};

/**
 * Get fence list
 * @public
 */
exports.list = async (req, res, next) => {
  try {
    const fences = await Fence.list(req.query);
    const transformedFences = fences.map(fence => fence.transform());
    res.json(transformedFences);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete fence
 * @public
 */
exports.remove = (req, res, next) => {
  const { fence } = req.locals;

  fence.remove()
    .then(() => res.status(httpStatus.NO_CONTENT).end())
    .catch(e => next(e));
};

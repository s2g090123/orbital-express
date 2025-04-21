/**
 * USER V1Create ACTION
 */

'use strict';

// ENV variables
const { NODE_ENV, HOSTNAME } = process.env;

// built-in node modules
const os = require('os');
const fs = require('fs');
const path = require('path');

// third-party node modules
const _ = require('lodash'); // general helper methods: https://lodash.com/docs
const Op = require('sequelize').Op; // for model operator aliases like $gte, $eq
const joi = require('joi'); // argument validations: https://github.com/hapijs/joi/blob/master/API.md
const moment = require('moment-timezone'); // manage timezone and dates: https://momentjs.com/timezone/docs/
const convert = require('convert-units'); // https://www.npmjs.com/package/convert-units
const slugify = require('slugify'); // convert string to URL friendly string: https://www.npmjs.com/package/slugify
const sanitize = require("sanitize-filename"); // sanitize filename: https://www.npmjs.com/package/sanitize-filename
const passport = require('passport'); // handle authentication: http://www.passportjs.org/docs/
const currency = require('currency.js'); // handling currency operations (add, subtract, multiply) without JS precision issues: https://github.com/scurker/currency.js/
const accounting = require('accounting'); // handle outputing readable format for currency: http://openexchangerates.github.io/accounting.js/

// services
const lang = require('../../../services/language'); // internationalization
const email = require('../../../services/email'); // to send emails
const queue = require('../../../services/queue'); // process background tasks from Queue
const socket = require('../../../services/socket'); // require socket service to initiate socket.io to emit real-time events to client-side applications: https://socket.io/docs/emit-cheatsheet/
const { SOCKET_ROOMS, SOCKET_EVENTS } = require('../../../services/socket');
const { ERROR_CODES, errorResponse, joiErrorsMessage } = require('../../../services/error');

// helpers
const { getOffset, getOrdering, convertStringListToWhereStmt } = require('../../../helpers/cruqd');
const { randomString } = require('../../../helpers/logic');
const { LIST_INT_REGEX, DATE_TIME_FORMAT_Z } = require('../../../helpers/constants');
// const { localHelperMethod } = require('../helpers'); // local helpers related to User feature folder

// models
const models = require('../../../models');

// methods - Notice that module.exports defines the methods first and THEN we write the actual methods below. We do this BECAUSE as the file gets bigger and bigger, it is much easier to find the methods you are looking for. It may not seem like a problem now but as the codebase gets more complex and files get to be thousands of lines and you are debugging or figuring out how something works, it is much easier to find the method you are looking for if you have all the methods defined at the top of the file. This is extremely important.
module.exports = {
  V1Create
}

/**
 * Method Description
 *
 * GET  /v1/users/<method>
 * POST /v1/users/<method>
 *
 * Use req.__('') or res.__('') for i18n language translations (DON'T require('i18n') since it is already attached to the req & res objects): https://github.com/mashpie/i18n-node
 *
 * Must be logged out | Must be logged in | Can be both logged in or logged out
 * Roles: ['admin', 'partner', 'user.ADMIN']
 *
 * req.params = {}
 * req.args = {
 *   @alpha - (STRING - REQUIRED): Alpha argument description
 *   @beta - (BOOLEAN - OPTIONAL) [DEFAULT - 100]: Beta argument description
 *   @charlie - (NUMBER - OPTIONAL or REQUIRED): Cato argument description
 *   @gamma - (STRING - OPTIONAL if req.admin exists): Gamma argument description
 *   @delta - (STRING - REQUIRED): Delta argument description
 *   @zeta - (STRING - REQUIRED) [VALID - 'a', 'b']: Zeta argument description
 * }
 *
 * Success: Return { status: 200, success: true, data: { key: 'value' }}
 * Errors:
 *   400: BAD_REQUEST_INVALID_ARGUMENTS
 *   401: UNAUTHORIZED
 *   500: INTERNAL_SERVER_ERROR
 *
 * !IMPORTANT: This is an important message
 * !NOTE: This is a note
 * TODO: This is a todo
 */
async function V1Create(req, res) {
  const i18n = lang.getLocalI18n(); // get local i18n object - remember to set the locale based on the user e.g. i18n.setLocale(user.locale);

  const schema = joi.object({
    alpha: joi.string().trim().min(1).lowercase().required().error(new Error(req.__('USER_V1Create_Invalid_Argument[alpha]'))),
    beta: joi.boolean().default(true).optional().error(new Error(req.__('USER_V1Create_Invalid_Argument[beta]'))),
    charlie: joi.number().integer().min(1).max(10).error(new Error(req.__('USER_V1Create_Invalid_Argument[charlie]'))),
    delta: joi.string().trim().lowercase().min(3).email().required().error(new Error(req.__('USER_V1Create_Invalid_Argument[delta]'))),
    gamma: joi.string().when(joi.ref('$admin'), { // if admin exists on req.admin, then gamma is optional, otherwise it is required
      is: joi.exist(),
      then: joi.optional(),
      otherwise: joi.required(),
    }).error(new Error(req.__('USER_V1Create_Invalid_Argument[gamma]'))),
    zeta: joi.string().trim().valid('a', 'b').required().error(new Error(req.__('USER_V1Create_Invalid_Argument[zeta]')))
  }).with('alpha', 'beta') // must come together
    .xor('beta', 'gamma') // one and not the other must exists
    .or('gamma', 'delta'); // at least one must exists

  // validate
  const { error, value } = schema.validate(req.args, { context: req }); // have { context: req } here so in joi we can check if admin exists on req.admin above
  if (error)
    return errorResponse(req, ERROR_CODES.BAD_REQUEST_INVALID_ARGUMENTS, joiErrorsMessage(error));
  req.args = value; // arguments are updated and variable types are converted to correct type. ex. '5' -> 5, 'true' -> true

  /***** DO WORK HERE *****/
  try {
    // assemble data
    const data = { key: 'value' };

    // ADD BACKGROUND JOB TO QUEUE
    const UserQueue = queue.get('UserQueue'); // grab relevent queue
    const job = await UserQueue.add('V1CreateTask', data); // add new job to queue

    // language translation - key should follow this format, FEATURE_FOLDER_NAME[snake_case_details]. UPPERCASE feature folder followed by snake case details of key
    // const message = req.__('USER[put_new_message_key]', { email: 'bob@example.com' });

    // SOCKET EMIT EVENT
    // const io = await socket.get(); // get socket.io instance
    // io.to(`${SOCKET_ROOMS.GLOBAL}`).emit(SOCKET_EVENTS.EXAMPLE_EVENT, data);
    // io.to(`${SOCKET_ROOMS.ADMIN}${EXAMPLE_ADMIN_ID}`).emit(SOCKET_EVENTS.EXAMPLE_EVENT, data);

    // return response - this will be wrapped around in a "resolve" promise automatically because this is an async function
    return {
      status: 200,
      success: true,
      jobId: job.id,
      data: data
    };
  } catch (error) {
    // this will be wrapped around in a "reject" promise automatically because this is an async function
    throw error;
  }
} // END V1Create

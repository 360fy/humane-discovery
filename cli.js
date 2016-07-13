#!/usr/bin/env node
const path = require('path');
process.env.NODE_CONFIG_DIR = path.resolve(__dirname, 'config');
process.env.MODULE_ROOT = path.resolve(__dirname);

require('./lib/CliInvoker.js');
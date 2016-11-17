import 'babel-polyfill';
import _ from 'lodash';
import Path from 'path';
import Promise from 'bluebird';

import Config from 'config-boilerplate/lib/Config';
import globalOption from 'command-line-boilerplate/lib/GlobalOption';
import globalArg from 'command-line-boilerplate/lib/GlobalArg';
import runCli from 'command-line-boilerplate/lib/CliRunner';
import outputHelp from 'command-line-boilerplate/lib/OutputHelp';
import loadPlugin from 'plugin-boilerplate/lib/PluginLoader';
import ValidationError from 'humane-node-commons/lib/ValidationError';

import cli from './Cli';

globalOption('-c, --config [CONFIG]', 'Path to JSON / YAML based environment configs, such as esConfig, redisConfig etc');

globalOption('-d, --discoveryPlugin [DISCOVERY PLUGIN]',
  `Path to single discovery plugin.
            Can be name of globally installed module or full path to module directory.
            Defaults to:
                1) Current directory - must be a valid node module
                2) HUMANE_PLUGIN_DISCOVERY environment variable`
);

// runs the cli
runCli(true);

function validDiscoveryPlugin(path, throwError) {
    if (!path) {
        return null;
    }

    return loadPlugin(process.env.MODULE_ROOT, path, throwError);
}

Promise.resolve(globalArg('discoveryPlugin'))
  .then(plugin => validDiscoveryPlugin(plugin, true))
  .then((plugin) => {
      if (!plugin) {
          return validDiscoveryPlugin(process.cwd());
      }

      return plugin;
  })
  .then((plugin) => {
      if (!plugin) {
          return validDiscoveryPlugin(process.env.HUMANE_PLUGIN_DISCOVERY, true);
      }

      return plugin;
  })
  .then((plugin) => {
      if (!plugin) {
          console.error('No plugin was specified or found');

          outputHelp();

          return false;
      }

      const defaultConfig = globalArg('config')
        ? new Config('default', globalArg('config'), Path.join(__dirname, '..', 'config'))
        : new Config('default', Path.join(__dirname, '..', 'config'));

      return cli(_.defaultsDeep({}, plugin, defaultConfig));
  })
  .catch(error => error.name === 'ValidationError' || error instanceof ValidationError, (error) => {
      console.error('VALIDATION ERROR: ', error.message);
  });

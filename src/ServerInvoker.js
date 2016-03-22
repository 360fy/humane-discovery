import 'babel-polyfill';
import _ from 'lodash';
import Path from 'path';
import Promise from 'bluebird';

import Config from 'config-boilerplate/lib/Config';

import globalOption from 'command-line-boilerplate/lib/GlobalOption';
import globalArg from 'command-line-boilerplate/lib/GlobalArg';
import runCli from 'command-line-boilerplate/lib/CliRunner';

import DiscoveryServer from './DiscoveryServer';

import loadPlugin from './DiscoveryPluginLoader';

globalOption('-c, --config [CONFIG]', 'Path to JSON / YAML based environment configs, such as esConfig, redisConfig etc');

globalOption('-d, --discoveryPlugin [DISCOVERY PLUGIN]',
  `Path to single or list of comma separated discovery plugins.
            Can be name of globally installed module or full path to module directory.
            Defaults to:
                1) Current directory - must be a valid node module
                2) HUMANE_PLUGIN_DISCOVERY environment variable`
);

globalOption('--transliterator [MODULE DIRECTORY]',
  `Path to transliterator plugin.
            Can be name of globally installed plugin module or full path to plugin directory.
            Defaults to: HUMANE_PLUGIN_TRANSLITERATOR environment variable`);

globalOption('-p, --port [PORT]', 'Specifies server port');

globalOption('-l, --logDirectory [LOG DIRECTORY]', 'Full path to log directory');

// runs the cli
runCli();

function validDiscoveryPlugin(pathOrMultiPath, throwError) {
    if (!pathOrMultiPath) {
        return null;
    }

    const multi = /,/.test(pathOrMultiPath);

    if (multi) {
        const paths = _(pathOrMultiPath).split(',').map(path => _.trim(path)).value();
        return Promise.all(_.map(paths, path => loadPlugin(path, throwError)));
    }

    return loadPlugin(pathOrMultiPath, throwError);
}

// TODO: setup watcher for plugin changes
Promise.resolve(globalArg('discoveryPlugin'))
  .then(pluin => validDiscoveryPlugin(pluin, true))
  .then(plugin => !plugin ? validDiscoveryPlugin(process.cwd()) : plugin)
  .then(plugin => !plugin ? validDiscoveryPlugin(process.env.HUMANE_PLUGIN_DISCOVERY, true) : plugin)
  .then(plugin => {
      if (!plugin) {
          console.error('No plugin was specified or found');
          process.exit(1);
      }

      const multi = true;

      const defaultConfig = globalArg('config')
        ? new Config('default', globalArg('config'), Path.join(__dirname, '..', 'config'))
        : new Config('default', Path.join(__dirname, '..', 'config'));

      // start the server here
      const server = new DiscoveryServer(multi,
        globalArg('port') || process.env.HUMANE_SERVER_PORT || defaultConfig.HUMANE_SERVER_PORT || '3000',
        globalArg('logDirectory'));

      const transliteratorPlugin = globalArg('transliterator') || process.env.HUMANE_PLUGIN_TRANSLITERATOR || defaultConfig.plugins && defaultConfig.plugins.transliterator;

      let transliterator = null;
      if (transliteratorPlugin) {
          const Transliterator = require(transliteratorPlugin).default;
          transliterator = new Transliterator();
      }

      if (_.isArray(plugin)) {
          const plugins = _.map(plugin, con => _.extend({}, defaultConfig, {transliterator}, con));

          return server.withPlugins(plugins).build();
      }

      return server.withPlugin(_.extend({}, defaultConfig, {transliterator}, plugin)).build();
  });

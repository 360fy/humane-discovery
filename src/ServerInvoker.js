import 'babel-polyfill';
import _ from 'lodash';
import Path from 'path';
import Promise from 'bluebird';
import Config from 'config-boilerplate/lib/Config';
import globalOption from 'command-line-boilerplate/lib/GlobalOption';
import globalArg from 'command-line-boilerplate/lib/GlobalArg';
import runCli from 'command-line-boilerplate/lib/CliRunner';
import outputHelp from 'command-line-boilerplate/lib/OutputHelp';
import DiscoveryServer from './DiscoveryServer';
import loadPlugin from 'plugin-boilerplate/lib/PluginLoader';

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
runCli(true);

function validDiscoveryPlugin(pathOrMultiPath, throwError) {
    if (!pathOrMultiPath) {
        return null;
    }

    const multi = /,/.test(pathOrMultiPath);

    if (multi) {
        const paths = _(pathOrMultiPath)
          .split(',')
          .map(path => _.trim(path))
          .value();
        return Promise.all(_.map(paths, path => loadPlugin(process.env.MODULE_ROOT, path, throwError)));
    }

    return loadPlugin(process.env.MODULE_ROOT, pathOrMultiPath, throwError);
}

// TODO: setup watcher for plugin changes
Promise.resolve(globalArg('discoveryPlugin'))
  .then(pluin => validDiscoveryPlugin(pluin, true))
  .then(plugin => {
      if (!plugin) {
          return validDiscoveryPlugin(process.cwd());
      }

      return plugin;
  })
  .then(plugin => {
      if (!plugin) {
          return validDiscoveryPlugin(process.env.HUMANE_PLUGIN_DISCOVERY, true);
      }

      return plugin;
  })
  .then(pluginOrArray => {
      if (!pluginOrArray) {
          console.error('No plugin was specified or found');

          outputHelp();

          return false;
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

      if (_.isArray(pluginOrArray)) {
          const plugins = _.map(pluginOrArray, plugin => _.defaultsDeep({}, plugin, {transliterator}, defaultConfig));

          return server.withPlugins(plugins).build();
      }

      return server.withPlugin(_.defaultsDeep({}, pluginOrArray, {transliterator}, defaultConfig)).build();
  });

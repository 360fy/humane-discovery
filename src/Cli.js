import _ from 'lodash';
import Indexer from 'humane-indexer/lib/Indexer';
import buildIndexerCli from 'humane-indexer/lib/IndexerCliBuilder';
import currentCommand from 'command-line-boilerplate/lib/CurrentCommand';
import outputHelp from 'command-line-boilerplate/lib/OutputHelp';
import runCli from 'command-line-boilerplate/lib/CliRunner';

//
// cli specific includes
//

export default function (config) {
    const indexerBuilder = () => new Indexer(_.pick(config, [
        'instanceName',
        'indicesConfig',
        'logLevel',
        'esConfig',
        'redisConfig',
        'redisSentinelConfig',
        'locksConfig',
        'cacheConfig'
    ]));

    // specific to the client => show section wise... need to be done for all plugins
    buildIndexerCli(indexerBuilder, config.indicesConfig);

    // runs the cli
    runCli(true);

    if (!currentCommand()) {
        // output help
        outputHelp();
    }
}
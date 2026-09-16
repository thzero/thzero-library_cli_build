import config from 'config';

import Constants from '../constants.js';
import LibraryCommonServiceConstants from '@thzero/library_common_service/constants.js';

import '@thzero/library_common/utility/string.js';
import injector from '@thzero/library_common/utility/injector.js';
import LibraryCommonUtility from '@thzero/library_common/utility/index.js';
import Response from '@thzero/library_common/response/index.js';
import LibraryMomentUtility from '@thzero/library_common/utility/moment.js';

import configService from '../service/config.js';
// import appMetricsMonitoringService from '@thzero/library_server_monitoring_appmetrics';
import loggerService from '@thzero/library_common_service/service/logger.js';
import pinoLoggerService from '@thzero/library_server_logger_pino';
import winstonLoggerService from '@thzero/library_server_logger_winston';

import buildService from '../service/build.js';

import bootCli from './cli.js';

class BootMain {
	async start(...args) {
		const correlationId = LibraryCommonUtility.generateId();

		try {
			const cli = new bootCli();
			if (!cli.run()) {
				if ((cli.cmd === 'help') || (cli.cmd === 'version'))
					return Response.success(correlationId);

				return Response.error('BootMain', 'start', 'Invalid command line arguments.', null, null, null, correlationId);
			}

			process.on('uncaughtException', function(err) {
				console.log('Caught exception', err);
				return process.exit(99);
			});

			this._injector = injector;

			LibraryMomentUtility.initDateTime();

			// https://github.com/lorenwest/node-config/wiki
			this._appConfig = new configService(config.get('app'));

			const plugins = await this._initPlugins(args);

			injector.addSingleton(LibraryCommonServiceConstants.InjectorKeys.SERVICE_CONFIG, this._appConfig);

			this._services = new Map();
			const loggerServiceI = new loggerService();

			// this._injectService(LibraryCommonServiceConstants.InjectorKeys.SERVICE_MONITORING, new appMetricsMonitoringService());
			this._injectService(Constants.InjectorKeys.SERVICE_LOGGER_PINO, new pinoLoggerService());
			this._injectService(Constants.InjectorKeys.SERVICE_LOGGER_WINSTON, new winstonLoggerService());
			this._injectService(LibraryCommonServiceConstants.InjectorKeys.SERVICE_LOGGER, loggerServiceI);
			loggerServiceI.register(Constants.InjectorKeys.SERVICE_LOGGER_PINO);
			loggerServiceI.register(Constants.InjectorKeys.SERVICE_LOGGER_WINSTON);

			this._injectService(Constants.InjectorKeys.SERVICE_BUILD, new buildService());

			for (const pluginService of plugins)
				await pluginService.initServices(this._services);

			for (const [key, value] of this._services) {
				console.log(`services.init - ${key}`);
				await value.init(injector);
			}

			try {
				const service = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD);
				return await service.process(correlationId, cli.args);
			}
			catch (err) {
				loggerServiceI.exception('Build', 'start', err);
				return Response.error('BootMain', 'start', null, err, null, null, correlationId);
			}
		}
		catch (err) {
			console.error(err);
			return Response.error('BootMain', 'start', null, err, null, null, correlationId);
		}
	}

	async _initPlugins(plugins) {
		let obj;
		const results = [];
		for (const plugin of plugins) {
			obj = new plugin();
			await obj.init(this._appConfig, injector);
			results.push(obj);
		}
		return results;
	}

	_injectService(key, service) {
		console.log(`services.inject - ${key}`);
		this._services.set(key, service);
		injector.addSingleton(key, service);
	}
}

export default BootMain;

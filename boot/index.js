import config from 'config';

import Constants from '../constants.js';
import LibraryCommonServiceConstants from '@thzero/library_common_service/constants.js';

import LibraryUtility from '@thzero/library_common/utility/index.js';

// require('@thzero/library_common/utility/string');
String.isNullOrEmpty = function(value) {
	//return !(typeof value === 'string' && value.length > 0)
	return !value;
}

String.isString = function(value) {
	return (typeof value === "string" || value instanceof String);
}

String.trim = function(value) {
	if (!value || !String.isString(value))
		return value;
	return value.trim();
}
import injector from '@thzero/library_common/utility/injector.js';

import configService from '../service/config.js';
// import appMetricsMonitoringService from '@thzero/library_server_monitoring_appmetrics';
import loggerService from '@thzero/library_common_service/service/logger.js';
import pinoLoggerService from '@thzero/library_server_logger_pino';
import winstonLoggerService from '@thzero/library_server_logger_winston';

import buildService from '../service/build.js';

import bootCli from './cli.js';

class BootMain {
	async start(...args) {
		try {
			const cli = new bootCli();
			if (!cli.run())
				return false;

			process.on('uncaughtException', function(err) {
				console.log('Caught exception', err);
				return process.exit(99);
			});

			this._injector = injector;

			LibraryUtility.initDateTime();

			// https://github.com/lorenwest/node-config/wiki
			this._appConfig = new configService(config.get('app'));

			const plugins = this._initPlugins(args);

			injector.addSingleton(LibraryCommonServiceConstants.InjectorKeys.SERVICE_CONFIG, this._appConfig);

			this._services = new Map();
			const loggerServiceI = new loggerService();

			// this._injectService(LibraryCommonServiceConstants.InjectorKeys.SERVICE_MONITORING, new appMetricsMonitoringService());
			this._injectService(Constants.InjectorKeys.SERVICE_LOGGER_PINO, new pinoLoggerService());
			this._injectService(Constants.InjectorKeys.SERVICE_LOGGER_WISTON, new winstonLoggerService());
			this._injectService(LibraryCommonServiceConstants.InjectorKeys.SERVICE_LOGGER, loggerServiceI);
			loggerServiceI.register(Constants.InjectorKeys.SERVICE_LOGGER_PINO);
			loggerServiceI.register(Constants.InjectorKeys.SERVICE_LOGGER_WISTON);

			this._injectService(Constants.InjectorKeys.SERVICE_BUILD, new buildService());

			for (const pluginService of plugins)
				await pluginService.initServices(this._services);

			for (const [key, value] of this._services) {
				console.log(`services.init - ${key}`);
				await value.init(injector);
			}

			try {
				const service = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD);
				const response = service.process(LibraryUtility.generateId(), cli.args);
				return response;
			}
			catch (err) {
				loggerServiceI.exception('Build', 'init', err);
			}
		}
		catch (err) {
			console.error(err);
		}
	}

	_initPlugins(plugins) {
		let obj;
		const results = [];
		for (const plugin of plugins) {
			obj = new plugin();
			obj.init(this._appConfig, injector);
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

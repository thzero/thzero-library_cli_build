import config from 'config';

import http from 'http';
import express from 'express';
import RED from 'node-red';

import runtime from '@node-red/runtime';
import redUtil from '@node-red/util';

import Constants from '../constants';
import LibraryCommonServiceConstants from '@thzero/library_common_service/constants';

import LibraryUtility from '@thzero/library_common/utility';

// require('@thzero/library_common/utility/string');
String.isNullOrEmpty = function(value) {
	//return !(typeof value === 'string' && value.length > 0)
	return !value;
}

String.isString = function(value) {
	return (typeof value === 'string' || value instanceof String);
}

String.trim = function(value) {
	if (!value || !String.isString(value))
		return value;
	return value.trim();
}
import injector from '@thzero/library_common/utility/injector';

import configService from '../service/config';
// import appMetricsMonitoringService from '@thzero/library_server_monitoring_appmetrics';
import loggerService from '@thzero/library_common_service/service/logger';
import pinoLoggerService from '@thzero/library_server_logger_pino';
import winstonLoggerService from '@thzero/library_server_logger_winston';

import buildService from '../service/build';

import bootCli from './cli';
import red from 'node-red';

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
				args.editor = true;

				// // Create the settings object - see default settings.js file for other options
				const settings = {
					httpAdminRoot: false,
					httpNodeRoot: false,
					userDir: '/home/nol/.nodered/',
					functionGlobalContext: { } // enables global context
				};

				let app = null;
				let server = null;
				if (args.editor) {
					settings.httpAdminRoot = '/red';
					settings.httpNodeRoot = '/api';
				
					// Create an Express app
					app = express();
					// Create a server
					server = http.createServer(app);
				}

				// Initialise the runtime with a server and settings
				RED.init(server, settings);

				if (args.editor) {
					// Serve the editor UI from /red
					app.use(settings.httpAdminRoot, RED.httpAdmin);

					// // // Serve the http nodes UI from /api
					// // app.use(settings.httpNodeRoot, RED.httpNode);

					server.listen(12000);
				}

				RED.start();

				RED.events.on('flows:started', async function(msg) {
					loggerServiceI.info2('Node-Red flows have been started.');

					if (!args.editor) {
						// TODO: Need to get the correct flow, and then call the 'setflow'.
						RED.events.emit('build:start', 'yeah yeah!'); // TODO
					}
				});

				RED.events.on('build:start', async function(msg) {
					console.log('what?!');
				});

				RED.events.on('build:complete', async function(msg) {
					const name = msg.payload ? msg.payload.name : 'dummy';
					loggerServiceI.info2(`Build flow '${name}' has completed!`);
					loggerServiceI.debug('Build', 'init', 'msg', msg);

					// TODO: need to shutdown Node-RED, and allow the CLI to shutdown.
				});

				RED.events.on('build:message:test', async function(msg) {
					loggerServiceI.debug('Build', 'init', 'msg', msg);
				});

				// const flow = await RED.runtime.flows.getFlow({ id: 'ad2cc20df3f941ca' });
				// console.log(flow);
			}
			catch (err) {
				loggerServiceI.exception('Build', 'init', err);
			}

			// try {
			// 	const service = this._injector.getService(Constants.InjectorKeys.SERVICE_BUILD);
			// 	const response = service.process(LibraryUtility.generateId(), cli.args);
			// 	return response;
			// }
			// catch (err) {
			// 	loggerServiceI.exception('Build', 'init', err);
			// }

			return { success: true };
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

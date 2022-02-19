class BootPlugin {
	async init(config, injector) {
		this._config = config;
		this._injector = injector;

	}

	async initServices(services) {
		this._services = services;

		await this._initServices();
	}

	_injectService(key, service) {
		console.log(`services.inject - ${key}`);
		this._services.set(key, service);
		this._injector.addSingleton(key, service);
	}

	async _initServices() {
	}
}

export default BootPlugin;

class ExceptionHelper {
  constructor(notificationHelper) {
    this.notificationHelper = notificationHelper;
  }

  async throwAndNotifyError(message) {
    await this.notificationHelper.notify('Release failed: ' + message);
    throw new Error(message);
  }
}

module.exports = { ExceptionHelper: ExceptionHelper };

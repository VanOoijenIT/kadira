const logger = getLogger();

Ntp = function (endpoint) {
  this.setEndpoint(endpoint);
  this.diff = 0;
  this.synced = false;
  this.reSyncCount = 0;
  this.reSync = new Retry({
    baseTimeout: 1000 * 60,
    maxTimeout: 1000 * 60 * 10,
    minCount: 0,
  });
};

Ntp._now = function () {
  const now = Date.now();
  if (typeof now === "number") {
    return now;
  }
  if (now instanceof Date) {
    // some extenal JS libraries override Date.now and returns a Date object
    // which directly affect us. So we need to prepare for that
    return now.getTime();
  }
  // trust me. I've seen now === undefined
  return new Date().getTime();
};

Ntp.prototype.setEndpoint = function (endpoint) {
  this.endpoint = `${endpoint}/simplentp/sync`;
};

Ntp.prototype.getTime = function () {
  return Ntp._now() + Math.round(this.diff);
};

Ntp.prototype.syncTime = function (localTime) {
  return localTime + Math.ceil(this.diff);
};

Ntp.prototype.sync = function () {
  logger("init sync");
  const self = this;
  let retryCount = 0;
  const retry = new Retry({
    baseTimeout: 1000 * 20,
    maxTimeout: 1000 * 60,
    minCount: 1,
    minTimeout: 0,
  });
  syncTime();

  function syncTime() {
    if (retryCount < 5) {
      logger("attempt time sync with server", retryCount);
      // if we send 0 to the retryLater, cacheDns will run immediately
      retry.retryLater(retryCount++, cacheDns);
    } else {
      logger("maximum retries reached");
      self.reSync.retryLater(self.reSyncCount++, function () {
        const args = [].slice.call(arguments);
        self.sync.apply(self, args);
      });
    }
  }

  // first attempt is to cache dns. So, calculation does not
  // include DNS resolution time
  function cacheDns() {
    self.getServerTime((err) => {
      if (!err) {
        calculateTimeDiff();
      } else {
        syncTime();
      }
    });
  }

  function calculateTimeDiff() {
    const clientStartTime = new Date().getTime();
    self.getServerTime((err, serverTime) => {
      if (!err && serverTime) {
        // (Date.now() + clientStartTime)/2 : Midpoint between req and res
        const networkTime = (new Date().getTime() - clientStartTime) / 2;
        const serverStartTime = serverTime - networkTime;
        self.diff = serverStartTime - clientStartTime;
        self.synced = true;
        // we need to send 1 into retryLater.
        self.reSync.retryLater(self.reSyncCount++, function () {
          const args = [].slice.call(arguments);
          self.sync.apply(self, args);
        });
        logger("successfully updated diff value", self.diff);
      } else {
        syncTime();
      }
    });
  }
};

Ntp.prototype.getServerTime = function (callback) {
  const self = this;

  if (Meteor.isServer) {
    const Fiber = Npm.require("fibers");
    new Fiber(() => {
      fetch(self.endpoint)
        .then(async (res) => {
          const serverTime = parseInt(await res.text());
          callback(null, serverTime);
        })
        .catch((err) => callback(err));
    }).run();
  } else {
    httpRequest(self.endpoint, {}, async (err, res) => {
      if (err || !res) {
        callback(err);
      } else {
        const serverTime = parseInt(await res.text());
        callback(null, serverTime);
      }
    });
  }
};

function getLogger() {
  if (Meteor.isServer) {
    return Npm.require("debug")("kadira:ntp");
  }
  return function (message) {
    const canLogKadira =
      Meteor._localStorage.getItem("LOG_KADIRA") !== null &&
      typeof console !== "undefined";

    if (canLogKadira) {
      if (message) {
        message = `kadira:ntp ${message}`;
        arguments[0] = message;
      }
      console.log.apply(console, arguments);
    }
  };
}

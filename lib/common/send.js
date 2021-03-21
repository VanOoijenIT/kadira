Kadira.send = function (payload, path, callback) {
  if (!Kadira.connected) {
    throw new Error(
      "You need to connect with Kadira first, before sending messages!"
    );
  }

  path = path.substr(0, 1) != "/" ? `/${path}` : path;
  const endpoint = Kadira.options.endpoint + path;
  let retryCount = 0;
  const retry = new Retry({
    minCount: 1,
    minTimeout: 0,
    baseTimeout: 1000 * 5,
    maxTimeout: 1000 * 60,
  });

  const sendFunction = Kadira._getSendFunction();
  tryToSend();

  function tryToSend(err) {
    if (retryCount < 5) {
      retry.retryLater(retryCount++, send);
    } else {
      console.warn("Error sending error traces to kadira server");
      if (callback) callback(err);
    }
  }

  function send() {
    sendFunction(endpoint, payload, function (err, content, statusCode) {
      if (err) {
        tryToSend(err);
      } else if (statusCode == 200) {
        if (callback) callback(null, content);
      } else if (callback) callback(new Meteor.Error(statusCode, content));
    });
  }
};

Kadira._getSendFunction = function () {
  return Meteor.isServer ? Kadira._serverSend : Kadira._clientSend;
};

Kadira._clientSend = function (endpoint, payload, callback) {
  httpRequest(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then((r) => {
      callback(null, r);
    })
    .catch((e) => {
      callback(e, null);
    });
};

Kadira._serverSend = function (endpoint, payload, callback) {
  callback = callback || function () {};
  const Fiber = Npm.require("fibers");
  new Fiber(function () {
    const httpOptions = {
      data: payload,
      headers: Kadira.options.authHeaders,
      method: "POST",
    };

    fetch(endpoint, httpOptions)
      .then((res) => {
        const content = res.statusCode === 200 ? res.data : res.content;
        callback(null, content, res.statusCode);
      })
      .catch((err) => callback(err));
  }).run();
};

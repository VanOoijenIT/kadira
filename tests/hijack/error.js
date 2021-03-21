Tinytest.add("Errors - Meteor._debug - track with Meteor._debug", function (
  test
) {
  const originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
  Kadira.enableErrorTracking();
  Kadira.models.error = new ErrorModel("foo");
  Meteor._debug("_debug", "_stack");
  const payload = Kadira.models.error.buildPayload();
  const error = payload.errors[0];
  const expected = {
    appId: "foo",
    name: "_debug",
    subType: "Meteor._debug",
    // startTime: 1408098721327,
    type: "server-internal",
    trace: {
      type: "server-internal",
      name: "_debug",
      subType: "Meteor._debug",
      errored: true,
      // at: 1408098721326,
      events: [
        ["start", 0, {}],
        ["error", 0, { error: { message: "_debug", stack: "_stack" } }],
      ],
      metrics: { total: 0 },
    },
    stacks: [{ stack: "_stack" }],
    count: 1,
  };

  delete error.startTime;
  delete error.trace.at;
  test.equal(expected, error);
  _resetErrorTracking(originalErrorTrackingStatus);
});

Tinytest.add("Errors - Meteor._debug - do not track method errors", function (
  test
) {
  const originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
  Kadira.enableErrorTracking();
  Kadira.models.error = new ErrorModel("foo");
  const method = RegisterMethod(causeError);
  const client = GetMeteorClient();

  try {
    const result = client.call(method);
  } catch (e) {
    // ignore the error
  }

  const payload = Kadira.models.error.buildPayload();
  const error = payload.errors[0];
  test.equal(1, payload.errors.length);
  test.equal(error.type, "method");
  test.equal(error.subType, method);
  _resetErrorTracking(originalErrorTrackingStatus);

  function causeError() {
    fetch("localhost", { method: "POST" }).then(Function);
  }
});

Tinytest.addAsync(
  "Errors - Meteor._debug - do not track pubsub errors",
  function (test, done) {
    const originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
    Kadira.enableErrorTracking();
    Kadira.models.error = new ErrorModel("foo");
    const pubsub = RegisterPublication(causeError);
    const client = GetMeteorClient();
    const result = client.subscribe(pubsub, {
      onError() {
        const payload = Kadira.models.error.buildPayload();
        const error = payload.errors[0];
        test.equal(1, payload.errors.length);
        test.equal(error.type, "sub");
        test.equal(error.subType, pubsub);
        _resetErrorTracking(originalErrorTrackingStatus);
        done();
      },
    });

    function causeError() {
      fetch("localhost", { method: "POST" }).then(Function);
    }
  }
);

Tinytest.addAsync("Errors - method error - track Meteor.Error", function (
  test,
  done
) {
  const originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
  const methodId = RegisterMethod(function () {
    throw new Meteor.Error("ERR_CODE", "reason");
  });
  const client = GetMeteorClient();
  try {
    const result = client.call(methodId);
  } catch (ex) {
    const errorMessage = "reason [ERR_CODE]";
    test.equal(ex.message, errorMessage);
    const payload = Kadira.models.error.buildPayload();
    const error = payload.errors[0];
    test.isTrue(error.stacks[0].stack.indexOf(errorMessage) >= 0);

    const lastEvent = error.trace.events[error.trace.events.length - 1];
    test.isTrue(lastEvent[2].error.message.indexOf(errorMessage) >= 0);
    test.isTrue(lastEvent[2].error.stack.indexOf(errorMessage) >= 0);
    done();
  }

  _resetErrorTracking(originalErrorTrackingStatus);
});

Tinytest.addAsync("Errors - method error - track NodeJs Error", function (
  test,
  done
) {
  const originalErrorTrackingStatus = Kadira.options.enableErrorTracking;
  const methodId = RegisterMethod(function () {
    throw new Error("the-message");
  });
  const client = GetMeteorClient();
  try {
    const result = client.call(methodId);
  } catch (ex) {
    const errorMessage = "the-message";
    test.isTrue(ex.message.match(/Internal server error/));
    const payload = Kadira.models.error.buildPayload();
    const error = payload.errors[0];
    test.isTrue(error.stacks[0].stack.indexOf(errorMessage) >= 0);

    const lastEvent = error.trace.events[error.trace.events.length - 1];
    test.isTrue(lastEvent[2].error.message.indexOf(errorMessage) >= 0);
    test.isTrue(lastEvent[2].error.stack.indexOf(errorMessage) >= 0);
    done();
  }

  _resetErrorTracking(originalErrorTrackingStatus);
});

function _resetErrorTracking(status) {
  if (status) {
    Kadira.enableErrorTracking();
  } else {
    Kadira.disableErrorTracking();
  }
}

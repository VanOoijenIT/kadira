getBrowserInfo = function () {
  return {
    browser: window.navigator.userAgent,
    userId: Meteor.userId && Meteor.userId(),
    url: location.href,
    resolution: getResolution(),
  };
};

getResolution = function () {
  if (screen && screen.width && screen.height) {
    const resolution = `${screen.width}x${screen.height}`;
    return resolution;
  }
};

getErrorStack = function (zone, callback) {
  const trace = [];
  const eventMap = zone.eventMap || {};
  const infoMap = zone.infoMap || {};

  trace.push({
    at: new Date().getTime(),
    stack: zone.erroredStack.get(),
  });

  processZone();
  function processZone() {
    // we assume, first two zones are not interesting
    // bacause, they are some internal meteor loading stuffs
    if (zone && zone.depth > 2) {
      let stack = "";
      if (zone.currentStack) {
        stack = zone.currentStack.get();
      }

      let events = eventMap[zone.id];
      let info = getInfoArray(infoMap[zone.id]);
      const ownerArgsEvent =
        events && events[0] && events[0].type == "owner-args" && events.shift();
      const runAt = ownerArgsEvent ? ownerArgsEvent.at : zone.runAt;
      let ownerArgs = ownerArgsEvent ? _.toArray(ownerArgsEvent.args) : [];

      // limiting
      events = _.map(_.last(events, 5), checkSizeAndPickFields(100));
      info = _.map(_.last(info, 5), checkSizeAndPickFields(100));
      ownerArgs = checkSizeAndPickFields(200)(_.first(ownerArgs, 5));

      zone.owner && delete zone.owner.zoneId;

      trace.push({
        createdAt: zone.createdAt,
        runAt,
        stack,
        owner: zone.owner,
        ownerArgs,
        events,
        info,
        zoneId: zone.id,
      });
      zone = zone.parent;

      setTimeout(processZone, 0);
    } else {
      callback(trace);
    }
  }
};

getInfoArray = function (info) {
  return _(info || {}).map(function (value, type) {
    value.type = type;
    return value;
  });
};

getTime = function () {
  if (Kadira && Kadira.syncedDate) {
    return Kadira.syncedDate.getTime();
  }
  return new Date().getTime();
};

checkSizeAndPickFields = function (maxFieldSize) {
  return function (obj) {
    maxFieldSize = maxFieldSize || 100;
    for (const key in obj) {
      const value = obj[key];
      try {
        const valueStringified = JSON.stringify(value);
        if (valueStringified.length > maxFieldSize) {
          obj[key] = `${valueStringified.substr(0, maxFieldSize)} ...`;
        } else {
          obj[key] = value;
        }
      } catch (ex) {
        obj[key] = "Error: cannot stringify value";
      }
    }
    return obj;
  };
};

httpRequest = async function (url, options, callback) {
  fetch(url, options)
    .then((r) => {
      callback(null, r);
    })
    .then((e) => {
      callback(e, null);
    });
};

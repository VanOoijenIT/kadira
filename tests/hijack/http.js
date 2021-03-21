Tinytest.add("HTTP - call a server", function (test) {
  EnableTrackingMethods();
  const methodId = RegisterMethod(async function () {
    const result = await fetch("http://localhost:3301");
    return result.statusCode;
  });
  const client = GetMeteorClient();
  const result = client.call(methodId);
  const events = GetLastMethodEvents([0, 2]);
  const expected = [
    ["start", , { userId: null, params: "[]" }],
    ["wait", , { waitOn: [] }],
    [
      "http",
      ,
      { url: "http://localhost:3301", method: "GET", statusCode: 200 },
    ],
    ["complete"],
  ];
  test.equal(events, expected);
  test.equal(result, 200);
  CleanTestData();
});

Tinytest.add("HTTP - async callback", function (test) {
  EnableTrackingMethods();
  const methodId = RegisterMethod(function () {
    const Future = Npm.require("fibers/future");
    const f = new Future();
    let result;
    fetch("http://localhost:3301")
      .then(function (res) {
        result = res;
        f.return();
      })
      .catch(() => {
        f.return();
      });
    f.wait();
    return result.statusCode;
  });
  const client = GetMeteorClient();
  const result = client.call(methodId);
  const events = GetLastMethodEvents([0, 2]);
  const expected = [
    ["start", , { userId: null, params: "[]" }],
    ["wait", , { waitOn: [] }],
    ["http", , { url: "http://localhost:3301", method: "GET", async: true }],
    ["async", , {}],
    ["complete"],
  ];
  test.equal(events, expected);
  test.equal(result, 200);
  CleanTestData();
});

(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['exports', 'QueryEditor', 'Nymph', 'LogEntry'], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require('QueryEditor'), require('Nymph'), require('LogEntry'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.QueryEditor, global.Nymph, global.LogEntry);
    global.LogalyzerApp = mod.exports;
  }
})(this, function (exports, _QueryEditor, _Nymph, _LogEntry) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  var _QueryEditor2 = _interopRequireDefault(_QueryEditor);

  var _Nymph2 = _interopRequireDefault(_Nymph);

  var _LogEntry2 = _interopRequireDefault(_LogEntry);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  function _toConsumableArray(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
        arr2[i] = arr[i];
      }

      return arr2;
    } else {
      return Array.from(arr);
    }
  }

  var chartColors = {
    red: 'rgb(229,57,53)',
    indigo: 'rgb(57,73,171)',
    teal: 'rgb(0,137,123)',
    yellow: 'rgb(253,216,53)',
    pink: 'rgb(216,27,96)',
    blue: 'rgb(30,136,229)',
    green: 'rgb(67,160,71)',
    amber: 'rgb(255,179,0)',
    purple: 'rgb(142,36,170)',
    lightBlue: 'rgb(3,155,229)',
    lightGreen: 'rgb(124,179,66)',
    orange: 'rgb(251,140,0)',
    deepPurple: 'rgb(94,53,177)',
    cyan: 'rgb(0,172,193)',
    lime: 'rgb(192,202,51)',
    deepOrange: 'rgb(244,81,30)',
    brown: 'rgb(109,76,65)',
    grey: 'rgb(117,117,117)',
    blueGrey: 'rgb(84,110,122)'
  };

  ///////////////////////////////////////
  //  Aggregetor Functions
  ///////////////////////////////////////

  var extractBy = function extractBy(property, unknownIsCalled, appendProperty) {
    return function (entries) {
      var values = {};
      var data = [],
          eventHandlers = {};

      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var value = entry.get(property);

        if (!value || value === "-") {
          if (values[unknownIsCalled]) {
            values[unknownIsCalled].value++;
          } else {
            values[unknownIsCalled] = { value: 1 };
          }
        } else {
          var finalVal = value,
              valueAppend = void 0;
          if (appendProperty) {
            valueAppend = entry.get(appendProperty);
            if (!valueAppend) {
              valueAppend = '-';
            }
            finalVal += ' ' + valueAppend;
          }
          if (values[finalVal]) {
            values[finalVal].value++;
          } else {
            if (appendProperty) {
              values[finalVal] = {
                propValue: value,
                appendValue: valueAppend,
                value: 1
              };
            } else {
              values[finalVal] = {
                propValue: value,
                value: 1
              };
            }
          }
        }
      }

      // Convert every entry to an array.

      var _loop = function _loop(k) {
        var label = k + " (" + Math.round(values[k].value / entries.length * 10000) / 100 + "%, " + values[k].value + ")";
        data.push({
          x: label,
          y: values[k].value
        });
        if (k === unknownIsCalled) {
          eventHandlers[label] = function (app) {
            var selectors = app.get("selectors");
            selectors.push({
              type: "|",
              data: [[property, false]],
              strict: [[property, "-"]],
              "!isset": [property]
            });
            app.set({ selectors: selectors });
            alert("Added selector to filter for an unknown " + property + ".");
          };
        } else {
          eventHandlers[label] = function (app) {
            var selectors = app.get("selectors");
            if (appendProperty) {
              if (values[k].appendValue === "-") {
                selectors.push({
                  type: "&",
                  "1": {
                    type: "|",
                    data: [[appendProperty, false]],
                    strict: [[appendProperty, "-"]],
                    "!isset": [appendProperty]
                  },
                  strict: [[property, values[k].propValue]]
                });
              } else {
                selectors.push({
                  type: "&",
                  strict: [[property, values[k].propValue], [appendProperty, values[k].appendValue]]
                });
              }
            } else {
              selectors.push({
                type: "&",
                strict: [[property, values[k].propValue]]
              });
            }
            app.set({ selectors: selectors });
            alert("Added selector to filter for this " + property + (appendProperty ? " and " + appendProperty : "") + ".");
          };
        }
      };

      for (var k in values) {
        _loop(k);
      }

      data.sort(function (a, b) {
        return b.y - a.y;
      });

      return { data: data, eventHandlers: eventHandlers };
    };
  };

  var aggregateFunctions = {
    totalListenersOverTime: {
      name: "Total Listeners Over Time",
      axisLabel: "Listeners",
      defaultChartFunction: "timeSeriesSteppedArea",
      func: function func(entries) {
        var timeFormat = 'YYYY-MM-DD HH:mm:ss';

        function newDateString(timestamp) {
          return moment("" + timestamp, "X").format(timeFormat);
        }

        var earliest = void 0,
            latest = void 0,
            deltas = {},
            data = [];

        // Go through and save every time someone logs on and off and the
        // earliest/latest delta.
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          var timeOn = Math.floor(entry.get("time"));
          var timeOff = Math.floor(entry.get("timeEnd"));

          if (timeOn < earliest || earliest === undefined) {
            earliest = timeOn;
          }
          if (timeOff > latest || latest === undefined) {
            latest = timeOff;
          }
          if (deltas[timeOn]) {
            deltas[timeOn]++;
          } else {
            deltas[timeOn] = 1;
          }
          if (deltas[timeOff]) {
            deltas[timeOff]--;
          } else {
            deltas[timeOff] = -1;
          }
        }

        // Now comes the hard part. Going through every second from earliest to
        // latest and calculating number of listeners.
        var currentListeners = 0;
        for (var _i = earliest; _i <= latest; _i++) {
          if (deltas[_i]) {
            currentListeners += deltas[_i];

            data.push({
              x: newDateString(_i),
              y: currentListeners
            });
          }
        }

        return { data: data };
      }
    },

    remoteHost: {
      name: "Remote Host (Unique Visitors)",
      axisLabel: "Requests",
      defaultChartFunction: "horizontalBar",
      func: extractBy("remoteHost", "Unknown")
    },

    resources: {
      name: "Requested Resources",
      axisLabel: "Requests",
      defaultChartFunction: "horizontalBar",
      func: extractBy("resource", "Unknown")
    },

    refererByDomain: {
      name: "Referer By Domain",
      axisLabel: "Requests",
      defaultChartFunction: "horizontalBar",
      func: function func(entries) {
        var values = {
          "Direct Request": 0,
          "Unknown": 0
        };
        var refererDomainRegex = /^\w+:\/\/(?:www\.)?([A-Za-z0-9-:.]+)/g;
        var data = [],
            eventHandlers = {};

        // Go through and parse out the domain of the referer.
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          var value = entry.get("referer");

          if (!value || value === "-") {
            values["Direct Request"]++;
          } else {
            var match = refererDomainRegex.exec(value);
            if (match !== null && match.length > 1) {
              if (values[match[1]]) {
                values[match[1]]++;
              } else {
                values[match[1]] = 1;
              }
            } else {
              values["Unknown"]++;
            }
          }
        }

        // Convert every entry to an array.
        for (var k in values) {
          data.push({
            x: k + " (" + Math.round(values[k] / entries.length * 10000) / 100 + "%, " + values[k] + ")",
            y: values[k]
          });
        }

        data.sort(function (a, b) {
          return b.y - a.y;
        });

        return { data: data, eventHandlers: eventHandlers };
      }
    },

    searchTerms: {
      name: "Search Terms",
      axisLabel: "Requests",
      defaultChartFunction: "horizontalBar",
      func: function func(entries) {
        var values = {};
        var searchTermsByServiceRegex = /^\w+:\/\/(?:www\.)?[A-Za-z0-9-:.]+\/.*q=([^&]+)(?:&|$)/g;
        var data = [],
            eventHandlers = {};

        // Go through and parse out the search terms and service.
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          var value = entry.get("referer");

          if (!(!value || value === "-")) {
            var match = searchTermsByServiceRegex.exec(value);
            if (match !== null && match.length > 1) {
              var key = decodeURIComponent(match[1].replace(/\+/g, ' '));
              if (values[key]) {
                values[key]++;
              } else {
                values[key] = 1;
              }
            }
          }
        }

        // Convert every entry to an array.

        var _loop2 = function _loop2(k) {
          var label = k + " (" + Math.round(values[k] / entries.length * 10000) / 100 + "%, " + values[k] + ")";
          data.push({
            x: label,
            y: values[k]
          });
          eventHandlers[label] = function (app) {
            var selectors = app.get("selectors");
            selectors.push({
              type: "&",
              like: [["referer", "%q=" + encodeURIComponent(k).replace(/%20/g, '+').replace(/%/g, '\%').replace(/_/g, '\_') + "%"]]
            });
            app.set({ selectors: selectors });
            alert("Added selector to filter for this searth term.");
          };
        };

        for (var k in values) {
          _loop2(k);
        }

        data.sort(function (a, b) {
          return b.y - a.y;
        });

        return { data: data, eventHandlers: eventHandlers };
      }
    },

    searchTermsByService: {
      name: "Search Terms by Service",
      axisLabel: "Requests",
      defaultChartFunction: "horizontalBar",
      func: function func(entries) {
        var values = {};
        var searchTermsByServiceRegex = /^\w+:\/\/(?:www\.)?([A-Za-z0-9-:.]+)\/.*q=([^&]+)(?:&|$)/g;
        var data = [],
            eventHandlers = {};

        // Go through and parse out the search terms and service.
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          var value = entry.get("referer");

          if (!(!value || value === "-")) {
            var match = searchTermsByServiceRegex.exec(value);
            if (match !== null && match.length > 2) {
              var key = match[1] + ": " + decodeURIComponent(match[2].replace(/\+/g, ' '));
              if (values[key]) {
                values[key]++;
              } else {
                values[key] = 1;
              }
            }
          }
        }

        // Convert every entry to an array.

        var _loop3 = function _loop3(k) {
          var label = k + " (" + Math.round(values[k] / entries.length * 10000) / 100 + "%, " + values[k] + ")";
          data.push({
            x: label,
            y: values[k]
          });
          eventHandlers[label] = function (app) {
            var selectors = app.get("selectors");
            selectors.push({
              type: "&",
              like: [["referer", "%" + k.split(": ", 2)[0] + "/%q=" + encodeURIComponent(k.split(": ", 2)[1]).replace(/%20/g, '+').replace(/%/g, '\%').replace(/_/g, '\_') + "%"]]
            });
            app.set({ selectors: selectors });
            alert("Added selector to filter for this searth term and service.");
          };
        };

        for (var k in values) {
          _loop3(k);
        }

        data.sort(function (a, b) {
          return b.y - a.y;
        });

        return { data: data, eventHandlers: eventHandlers };
      }
    },

    allReferers: {
      name: "All Referers",
      axisLabel: "Requests",
      defaultChartFunction: "horizontalBar",
      func: extractBy("referer", "Direct Request")
    },

    browser: {
      name: "Browser",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("uaBrowserName", "Unknown")
    },

    browserVersion: {
      name: "Browser Version",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("uaBrowserName", "Unknown", "uaBrowserVersion")
    },

    cpuArchitecture: {
      name: "CPU Architecture",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("uaCpuArchitecture", "Unknown")
    },

    deviceType: {
      name: "Device Type",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("uaDeviceType", "Unknown")
    },

    deviceVendor: {
      name: "Device Vendor",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("uaDeviceVendor", "Unknown")
    },

    deviceModel: {
      name: "Device Model",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("uaDeviceVendor", "Unknown", "uaDeviceModel")
    },

    engine: {
      name: "Engine",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("uaEngineName", "Unknown")
    },

    engineVersion: {
      name: "Engine Version",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("uaEngineName", "Unknown", "uaEngineVersion")
    },

    os: {
      name: "OS",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("uaOsName", "Unknown")
    },

    osVersion: {
      name: "OS Version",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("uaOsName", "Unknown", "uaOsVersion")
    },

    allUserAgents: {
      name: "All User Agents",
      axisLabel: "Requests",
      defaultChartFunction: "horizontalBar",
      func: extractBy("userAgent", "Unknown")
    },

    timeZone: {
      name: "Timezone",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("timeZone", "Unknown")
    },

    continentCode: {
      name: "Continent Code",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("continentCode", "Unknown")
    },

    continent: {
      name: "Continent",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("continent", "Unknown")
    },

    countryCode: {
      name: "Country Code",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("countryCode", "Unknown")
    },

    country: {
      name: "Country",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("country", "Unknown")
    },

    provinceCode: {
      name: "Province Code",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("provinceCode", "Unknown")
    },

    province: {
      name: "Province",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("province", "Unknown")
    },

    postalCode: {
      name: "Postal Code",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("postalCode", "Unknown")
    },

    city: {
      name: "City",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("city", "Unknown")
    },

    countryProvince: {
      name: "Country and Province",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("country", "Unknown", "province")
    },

    countryCity: {
      name: "Country and City",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("country", "Unknown", "city")
    },

    countryPostalCode: {
      name: "Country and Postal Code",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("country", "Unknown", "postalCode")
    },

    provinceCity: {
      name: "Province and City",
      axisLabel: "Requests",
      defaultChartFunction: "pie",
      func: extractBy("province", "Unknown", "city")
    },

    responseStatusCode: {
      name: "Response Status Code",
      axisLabel: "Requests",
      defaultChartFunction: "horizontalBar",
      func: extractBy("statusCode", "Unknown")
    }
  };

  ///////////////////////////////////////
  //  Charting Functions
  ///////////////////////////////////////

  var timeSeries = function timeSeries(graphType, area, stepped) {
    return function (app, label, axisLabel, data, canvas, eventHandlers) {
      var timeFormat = 'YYYY-MM-DD HH:mm:ss';

      var color = Chart.helpers.color;
      var config = {
        type: graphType,
        data: {
          labels: [],
          datasets: [{
            label: axisLabel,
            backgroundColor: color(chartColors.indigo).alpha(0.5).rgbString(),
            borderColor: chartColors.indigo,
            fill: !!area,
            steppedLine: !!stepped,
            lineTension: 0,
            // cubicInterpolationMode: 'monotone',
            data: data
          }]
        },
        options: {
          title: {
            display: true,
            text: label
          },
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            xAxes: [{
              type: "time",
              time: {
                format: timeFormat,
                // round: 'day'
                tooltipFormat: 'll HH:mm'
              },
              scaleLabel: {
                display: true,
                labelString: 'Date / Time'
              }
            }],
            yAxes: [{
              scaleLabel: {
                display: true,
                labelString: axisLabel
              }
            }]
          },
          zoom: {
            enabled: true,
            mode: 'x'
          },
          onClick: function onClick(ev, elements) {
            if (elements[0] !== undefined && elements[0]._model !== undefined && elements[0]._model.label !== undefined && eventHandlers !== undefined && eventHandlers.hasOwnProperty(elements[0]._model.label)) {
              eventHandlers[elements[0]._model.label](app);
            }
          }
        }
      };

      var ctx = canvas.getContext("2d");
      return { context: ctx, chart: new Chart(ctx, config) };
    };
  };

  var chartFunctions = {
    timeSeriesSteppedArea: {
      name: "Time Series Stepped Area",
      func: timeSeries("line", true, true)
    },

    timeSeriesStepped: {
      name: "Time Series Stepped",
      func: timeSeries("line", false, true)
    },

    timeSeriesLine: {
      name: "Time Series Line",
      func: timeSeries("line")
    },

    timeSeriesArea: {
      name: "Time Series Area",
      func: timeSeries("line", true)
    },

    timeSeriesBar: {
      name: "Time Series Bar",
      func: timeSeries("bar")
    },

    bar: {
      name: "Bar Chart",
      func: function func(app, label, axisLabel, data, canvas, eventHandlers) {
        var color = Chart.helpers.color;
        var config = {
          type: 'bar',
          data: {
            labels: data.map(function (v) {
              return v.x;
            }),
            datasets: [{
              label: axisLabel,
              backgroundColor: color(chartColors.blue).alpha(0.5).rgbString(),
              borderColor: chartColors.blueGrey,
              borderWidth: 1,
              data: data.map(function (v) {
                return v.y;
              })
            }]
          },
          options: {
            // Elements options apply to all of the options unless overridden in a dataset
            // In this case, we are setting the border of each horizontal bar to be 2px wide
            elements: {
              rectangle: {
                borderWidth: 2
              }
            },
            responsive: true,
            maintainAspectRatio: false,
            legend: {
              display: false
            },
            title: {
              display: true,
              text: label + " (" + data.length + " total)"
            },
            onClick: function onClick(ev, elements) {
              if (elements[0] !== undefined && elements[0]._model !== undefined && elements[0]._model.label !== undefined && eventHandlers !== undefined && eventHandlers.hasOwnProperty(elements[0]._model.label)) {
                eventHandlers[elements[0]._model.label](app);
              }
            }
          }
        };

        var ctx = canvas.getContext("2d");
        return { context: ctx, chart: new Chart(ctx, config) };
      }
    },

    horizontalBar: {
      name: "Horizontal Bar Chart",
      func: function func(app, label, axisLabel, data, canvas, eventHandlers) {
        var color = Chart.helpers.color;
        var config = {
          type: 'horizontalBar',
          data: {
            labels: data.map(function (v) {
              return v.x;
            }),
            datasets: [{
              label: axisLabel,
              backgroundColor: color(chartColors.blue).alpha(0.5).rgbString(),
              borderColor: chartColors.blueGrey,
              borderWidth: 1,
              data: data.map(function (v) {
                return v.y;
              })
            }]
          },
          options: {
            // Elements options apply to all of the options unless overridden in a dataset
            // In this case, we are setting the border of each horizontal bar to be 2px wide
            elements: {
              rectangle: {
                borderWidth: 2
              }
            },
            responsive: true,
            maintainAspectRatio: false,
            legend: {
              display: false
            },
            title: {
              display: true,
              text: label + " (" + data.length + " total)"
            },
            onClick: function onClick(ev, elements) {
              if (elements[0] !== undefined && elements[0]._model !== undefined && elements[0]._model.label !== undefined && eventHandlers !== undefined && eventHandlers.hasOwnProperty(elements[0]._model.label)) {
                eventHandlers[elements[0]._model.label](app);
              }
            }
          }
        };

        var ctx = canvas.getContext("2d");
        return { context: ctx, chart: new Chart(ctx, config) };
      }
    },

    pie: {
      name: "Pie Chart",
      func: function func(app, label, axisLabel, data, canvas, eventHandlers) {
        var color = Chart.helpers.color;
        var chartColorsKeys = Object.keys(chartColors);
        var config = {
          type: 'pie',
          data: {
            labels: data.map(function (v) {
              return v.x;
            }),
            datasets: [{
              label: axisLabel,
              backgroundColor: data.map(function (v, i) {
                return color(chartColors[chartColorsKeys[i % chartColorsKeys.length]]).alpha(0.5).rgbString();
              }),
              data: data.map(function (v) {
                return v.y;
              })
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            title: {
              display: true,
              text: label + " (" + data.length + " total)"
            },
            onClick: function onClick(ev, elements) {
              if (elements[0] !== undefined && elements[0]._index !== undefined && data[elements[0]._index] !== undefined && eventHandlers !== undefined && eventHandlers.hasOwnProperty(data[elements[0]._index].x)) {
                eventHandlers[data[elements[0]._index].x](app);
              }
            }
          }
        };

        var ctx = canvas.getContext("2d");
        return { context: ctx, chart: new Chart(ctx, config) };
      }
    }
  };

  var originalHash = window.location.hash.replace(/^#/, '');
  var currentHash = originalHash;

  function query(options, selectors) {
    return [options].concat(_toConsumableArray(selectors));
  }

  function urlHashUpdate(aggregateFunction, chartFunction, options, selectors) {
    currentHash = JSON.stringify({ aggregateFunction: aggregateFunction, chartFunction: chartFunction, options: options, selectors: selectors });
    window.location.hash = currentHash;
    return null;
  }

  function data() {
    return {
      __supportedClasses: [_LogEntry2.default],
      __showQueryEditor: false,
      __loading: false,
      __currentChart: null,
      __aggregateFunctions: aggregateFunctions,
      __chartFunctions: chartFunctions,
      __aggregateFunctionsKeys: Object.keys(aggregateFunctions),
      __chartFunctionsKeys: Object.keys(chartFunctions),
      aggregateFunction: "totalListenersOverTime",
      chartFunction: "timeSeriesSteppedArea",
      options: {
        "class": _LogEntry2.default.class
      },
      selectors: [{
        "type": "&",
        "strict": ["resource", "/stream"]
      }, {
        "type": "&",
        "gte": ["timeEnd", null, "-1 week"],
        "lte": ["timeStart", null, "now"]
      }, {
        "type": "&",
        "gte": ["duration", 300],
        "lte": ["duration", 86400]
      }]
    };
  };

  var methods = {
    runQuery: function runQuery() {
      var _this = this;

      var __currentChart = this.get("__currentChart");
      var aggregateFunction = this.get("aggregateFunction");
      var chartFunction = this.get("chartFunction");

      if (__currentChart) {
        __currentChart.chart.destroy();
        __currentChart.context.clearRect(0, 0, this.refs.canvas.width, this.refs.canvas.height);
      }

      this.set({ __loading: true });
      var query = this.get("query");
      _Nymph2.default.getEntities.apply(_Nymph2.default, _toConsumableArray(query)).then(function (entries) {
        var aggFuncObj = aggregateFunctions[aggregateFunction];
        var chartFuncObj = chartFunctions[chartFunction];
        // Run the aggregator:
        var aggResults = aggFuncObj.func(entries);
        var data = aggResults.data;
        var eventHandlers = aggResults.eventHandlers;

        // Create the chart:
        _this.set({
          __currentChart: chartFuncObj.func(_this, aggFuncObj.name, aggFuncObj.axisLabel, data, _this.refs.canvas, eventHandlers),
          __loading: false
        });
      }, function (err) {
        alert("Error: " + err);
      });
    },
    toggleQueryEditor: function toggleQueryEditor() {
      this.set({ __showQueryEditor: !this.get("__showQueryEditor") });
    },
    increaseChartHeight: function increaseChartHeight() {
      this.refs.canvascontainer.style.height = parseInt(this.refs.canvascontainer.style.height, 10) + 40 + "%";
    },
    decreaseChartHeight: function decreaseChartHeight() {
      this.refs.canvascontainer.style.height = parseInt(this.refs.canvascontainer.style.height, 10) - 40 + "%";
    }
  };

  function oncreate() {
    var _this2 = this;

    var updateFromHash = function updateFromHash(hash) {
      try {
        var state = JSON.parse(hash);
        _this2.set({ selectors: [] });
        _this2.set(state);
      } catch (e) {
        // ignore errors here.
      }
    };
    updateFromHash(originalHash);
    setInterval(function () {
      // Compare the current hash with the window's hash. If the window's
      // hash has been updated, update our state.
      var windowHash = window.location.hash.replace(/^#/, '');
      if (windowHash !== currentHash) {
        currentHash = windowHash;
        updateFromHash(currentHash);
      }
    }, 5);
  };

  function encapsulateStyles(node) {
    setAttribute(node, "svelte-2868722327", "");
  }

  function add_css() {
    var style = createElement("style");
    style.id = 'svelte-2868722327-style';
    style.textContent = "[svelte-2868722327].w-auto,[svelte-2868722327] .w-auto{width:auto}[svelte-2868722327].query-editor h2,[svelte-2868722327] .query-editor h2{border-bottom:1px solid #000;padding-bottom:.5em;margin-bottom:.5em}[svelte-2868722327].chart-canvas,[svelte-2868722327] .chart-canvas{-moz-user-select:none;-webkit-user-select:none;-ms-user-select:none}[svelte-2868722327].loader,[svelte-2868722327] .loader,[svelte-2868722327].loader:after,[svelte-2868722327] .loader:after{border-radius:50%;width:3em;height:3em}[svelte-2868722327].loader,[svelte-2868722327] .loader{margin:60px auto;font-size:10px;position:relative;text-indent:-9999em;border-top:1.1em solid rgba(0,0,0, 0.2);border-right:1.1em solid rgba(0,0,0, 0.2);border-bottom:1.1em solid rgba(0,0,0, 0.2);border-left:1.1em solid #000000;-webkit-transform:translateZ(0);-ms-transform:translateZ(0);transform:translateZ(0);-webkit-animation:load8 1.1s infinite linear;animation:svelte-2868722327-load8 1.1s infinite linear}@-webkit-keyframes load8 {[svelte-2868722327]0%,[svelte-2868722327] 0%{-webkit-transform:rotate(0deg);transform:rotate(0deg)}[svelte-2868722327]100%,[svelte-2868722327] 100%{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}@keyframes svelte-2868722327-load8{0%{-webkit-transform:rotate(0deg);transform:rotate(0deg)}100%{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}";
    appendNode(style, document.head);
  }

  function create_main_fragment(state, component) {
    var div,
        div_1,
        label,
        text,
        select,
        select_updating = false,
        text_2,
        label_1,
        text_3,
        select_1,
        select_1_updating = false,
        text_5,
        button,
        text_6,
        text_7,
        button_1,
        text_10,
        div_2,
        div_2_class_value,
        queryeditor_updating = {},
        text_12,
        hr,
        text_13,
        div_3,
        h1,
        text_15,
        div_4,
        button_2,
        text_17,
        button_3,
        text_21,
        div_5,
        div_6,
        div_6_class_value,
        text_22,
        div_7,
        canvas;

    var __aggregateFunctionsKeys = state.__aggregateFunctionsKeys;

    var each_blocks = [];

    for (var i = 0; i < __aggregateFunctionsKeys.length; i += 1) {
      each_blocks[i] = create_each_block(state, __aggregateFunctionsKeys, __aggregateFunctionsKeys[i], i, component);
    }

    function select_change_handler() {
      select_updating = true;
      var selectedOption = select.querySelector(':checked') || select.options[0];
      component.set({ aggregateFunction: selectedOption && selectedOption.__value });
      select_updating = false;
    }

    function change_handler(event) {
      var state = component.get();
      component.set({ chartFunction: state.__aggregateFunctions[state.aggregateFunction].defaultChartFunction });
    }

    var __chartFunctionsKeys = state.__chartFunctionsKeys;

    var each_1_blocks = [];

    for (var i = 0; i < __chartFunctionsKeys.length; i += 1) {
      each_1_blocks[i] = create_each_block_1(state, __chartFunctionsKeys, __chartFunctionsKeys[i], i, component);
    }

    function select_1_change_handler() {
      select_1_updating = true;
      var selectedOption = select_1.querySelector(':checked') || select_1.options[0];
      component.set({ chartFunction: selectedOption && selectedOption.__value });
      select_1_updating = false;
    }

    function click_handler(event) {
      component.toggleQueryEditor();
    }

    var current_block_type = select_block_type(state);
    var if_block = current_block_type(state, component);

    function click_handler_1(event) {
      component.runQuery();
    }

    var queryeditor_initial_data = {
      classCheckbox: "mr-1",
      classInput: "form-control form-control-sm d-inline w-auto",
      classSelect: "form-control form-control-sm d-inline w-auto",
      classAddButton: "btn btn-sm btn-primary mx-1",
      classRemoveButton: "btn btn-sm btn-danger mx-1",
      classButton: "btn btn-sm btn-secondary mx-1"
    };
    if ('options' in state) {
      queryeditor_initial_data.options = state.options;
      queryeditor_updating.options = true;
    }
    if ('selectors' in state) {
      queryeditor_initial_data.selectors = state.selectors;
      queryeditor_updating.selectors = true;
    }
    if ('__supportedClasses' in state) {
      queryeditor_initial_data.supportedClasses = state.__supportedClasses;
      queryeditor_updating.supportedClasses = true;
    }
    var queryeditor = new _QueryEditor2.default({
      _root: component._root,
      data: queryeditor_initial_data,
      _bind: function _bind(changed, childState) {
        var state = component.get(),
            newState = {};
        if (!queryeditor_updating.options && changed.options) {
          newState.options = childState.options;
        }

        if (!queryeditor_updating.selectors && changed.selectors) {
          newState.selectors = childState.selectors;
        }

        if (!queryeditor_updating.supportedClasses && changed.supportedClasses) {
          newState.__supportedClasses = childState.supportedClasses;
        }
        queryeditor_updating = assign({}, changed);
        component._set(newState);
        queryeditor_updating = {};
      }
    });

    component._root._beforecreate.push(function () {
      var state = component.get(),
          childState = queryeditor.get(),
          newState = {};
      if (!childState) return;
      if (!queryeditor_updating.options) {
        newState.options = childState.options;
      }

      if (!queryeditor_updating.selectors) {
        newState.selectors = childState.selectors;
      }

      if (!queryeditor_updating.supportedClasses) {
        newState.__supportedClasses = childState.supportedClasses;
      }
      queryeditor_updating = { options: true, selectors: true, supportedClasses: true };
      component._set(newState);
      queryeditor_updating = {};
    });

    var queryeditor_context = {
      state: state
    };

    function click_handler_2(event) {
      component.increaseChartHeight();
    }

    function click_handler_3(event) {
      component.decreaseChartHeight();
    }

    return {
      c: function create() {
        div = createElement("div");
        div_1 = createElement("div");
        label = createElement("label");
        text = createText("Aggregrator\n      ");
        select = createElement("select");

        for (var i = 0; i < each_blocks.length; i += 1) {
          each_blocks[i].c();
        }

        text_2 = createText("\n    ");
        label_1 = createElement("label");
        text_3 = createText("Chart\n      ");
        select_1 = createElement("select");

        for (var i = 0; i < each_1_blocks.length; i += 1) {
          each_1_blocks[i].c();
        }

        text_5 = createText("\n    ");
        button = createElement("button");
        if_block.c();
        text_6 = createText(" Query Editor");
        text_7 = createText("\n    ");
        button_1 = createElement("button");
        button_1.textContent = "Run Query";
        text_10 = createText("\n  ");
        div_2 = createElement("div");
        queryeditor._fragment.c();
        text_12 = createText("\n  ");
        hr = createElement("hr");
        text_13 = createText("\n\n  ");
        div_3 = createElement("div");
        h1 = createElement("h1");
        h1.textContent = "Logalyzer Results";
        text_15 = createText("\n    ");
        div_4 = createElement("div");
        button_2 = createElement("button");
        button_2.textContent = "Increase Height";
        text_17 = createText("\n      ");
        button_3 = createElement("button");
        button_3.textContent = "Decrease Height";
        text_21 = createText("\n  ");
        div_5 = createElement("div");
        div_6 = createElement("div");
        text_22 = createText("\n    ");
        div_7 = createElement("div");
        canvas = createElement("canvas");
        this.h();
      },

      h: function hydrate() {
        encapsulateStyles(div);
        div_1.className = "d-flex";
        label.className = "mx-3 mb-0";
        select.className = "form-control d-inline w-auto ml-2";

        if (!('aggregateFunction' in state)) component._root._beforecreate.push(select_change_handler);

        addListener(select, "change", select_change_handler);
        addListener(select, "change", change_handler);
        label_1.className = "mx-3 mb-0";
        select_1.className = "form-control d-inline w-auto ml-2";

        if (!('chartFunction' in state)) component._root._beforecreate.push(select_1_change_handler);

        addListener(select_1, "change", select_1_change_handler);
        button.type = "button";
        button.className = "btn btn-secondary mx-3";
        addListener(button, "click", click_handler);
        button_1.type = "button";
        button_1.className = "btn btn-primary ml-auto";
        addListener(button_1, "click", click_handler_1);
        div_2.className = div_2_class_value = "mb-3 " + (state.__showQueryEditor ? '' : 'd-none');
        div_3.className = "d-flex align-items-start justify-content-between";
        button_2.className = "btn btn-secondary";
        addListener(button_2, "click", click_handler_2);
        button_3.className = "btn btn-secondary";
        addListener(button_3, "click", click_handler_3);
        setStyle(div_5, "position", "relative");
        setStyle(div_5, "height", "60vh");
        div_6.className = div_6_class_value = "loader " + (state.__loading ? '' : 'd-none');
        div_7.className = "chart-container";
        setStyle(div_7, "position", "relative");
        setStyle(div_7, "height", "140%");
        setStyle(div_7, "width", "100%");
        canvas.className = "chart-canvas";
      },

      m: function mount(target, anchor) {
        insertNode(div, target, anchor);
        appendNode(div_1, div);
        appendNode(label, div_1);
        appendNode(text, label);
        appendNode(select, label);

        for (var i = 0; i < each_blocks.length; i += 1) {
          each_blocks[i].m(select, null);
        }

        var value = state.aggregateFunction;
        for (var i = 0; i < select.options.length; i += 1) {
          var option = select.options[i];

          if (option.__value === value) {
            option.selected = true;
            break;
          }
        }

        appendNode(text_2, div_1);
        appendNode(label_1, div_1);
        appendNode(text_3, label_1);
        appendNode(select_1, label_1);

        for (var i = 0; i < each_1_blocks.length; i += 1) {
          each_1_blocks[i].m(select_1, null);
        }

        var value_1 = state.chartFunction;
        for (var i = 0; i < select_1.options.length; i += 1) {
          var option_1 = select_1.options[i];

          if (option_1.__value === value_1) {
            option_1.selected = true;
            break;
          }
        }

        appendNode(text_5, div_1);
        appendNode(button, div_1);
        if_block.m(button, null);
        appendNode(text_6, button);
        appendNode(text_7, div_1);
        appendNode(button_1, div_1);
        appendNode(text_10, div);
        appendNode(div_2, div);
        queryeditor._mount(div_2, null);
        appendNode(text_12, div);
        appendNode(hr, div);
        appendNode(text_13, div);
        appendNode(div_3, div);
        appendNode(h1, div_3);
        appendNode(text_15, div_3);
        appendNode(div_4, div_3);
        appendNode(button_2, div_4);
        appendNode(text_17, div_4);
        appendNode(button_3, div_4);
        appendNode(text_21, div);
        appendNode(div_5, div);
        appendNode(div_6, div_5);
        appendNode(text_22, div_5);
        appendNode(div_7, div_5);
        component.refs.canvascontainer = div_7;
        appendNode(canvas, div_7);
        component.refs.canvas = canvas;
      },

      p: function update(changed, state) {
        var __aggregateFunctionsKeys = state.__aggregateFunctionsKeys;

        if (changed.__aggregateFunctionsKeys || changed.__aggregateFunctions) {
          for (var i = 0; i < __aggregateFunctionsKeys.length; i += 1) {
            if (each_blocks[i]) {
              each_blocks[i].p(changed, state, __aggregateFunctionsKeys, __aggregateFunctionsKeys[i], i);
            } else {
              each_blocks[i] = create_each_block(state, __aggregateFunctionsKeys, __aggregateFunctionsKeys[i], i, component);
              each_blocks[i].c();
              each_blocks[i].m(select, null);
            }
          }

          for (; i < each_blocks.length; i += 1) {
            each_blocks[i].u();
            each_blocks[i].d();
          }
          each_blocks.length = __aggregateFunctionsKeys.length;
        }

        if (!select_updating) {
          var value = state.aggregateFunction;
          for (var i = 0; i < select.options.length; i += 1) {
            var option = select.options[i];

            if (option.__value === value) {
              option.selected = true;
              break;
            }
          }
        }

        var __chartFunctionsKeys = state.__chartFunctionsKeys;

        if (changed.__chartFunctionsKeys || changed.__chartFunctions) {
          for (var i = 0; i < __chartFunctionsKeys.length; i += 1) {
            if (each_1_blocks[i]) {
              each_1_blocks[i].p(changed, state, __chartFunctionsKeys, __chartFunctionsKeys[i], i);
            } else {
              each_1_blocks[i] = create_each_block_1(state, __chartFunctionsKeys, __chartFunctionsKeys[i], i, component);
              each_1_blocks[i].c();
              each_1_blocks[i].m(select_1, null);
            }
          }

          for (; i < each_1_blocks.length; i += 1) {
            each_1_blocks[i].u();
            each_1_blocks[i].d();
          }
          each_1_blocks.length = __chartFunctionsKeys.length;
        }

        if (!select_1_updating) {
          var value_1 = state.chartFunction;
          for (var i = 0; i < select_1.options.length; i += 1) {
            var option_1 = select_1.options[i];

            if (option_1.__value === value_1) {
              option_1.selected = true;
              break;
            }
          }
        }

        if (current_block_type !== (current_block_type = select_block_type(state))) {
          if_block.u();
          if_block.d();
          if_block = current_block_type(state, component);
          if_block.c();
          if_block.m(button, text_6);
        }

        if (changed.__showQueryEditor && div_2_class_value !== (div_2_class_value = "mb-3 " + (state.__showQueryEditor ? '' : 'd-none'))) {
          div_2.className = div_2_class_value;
        }

        var queryeditor_changes = {};
        if (!queryeditor_updating.options && changed.options) {
          queryeditor_changes.options = state.options;
          queryeditor_updating.options = true;
        }
        if (!queryeditor_updating.selectors && changed.selectors) {
          queryeditor_changes.selectors = state.selectors;
          queryeditor_updating.selectors = true;
        }
        if (!queryeditor_updating.supportedClasses && changed.__supportedClasses) {
          queryeditor_changes.supportedClasses = state.__supportedClasses;
          queryeditor_updating.supportedClasses = true;
        }
        queryeditor._set(queryeditor_changes);
        queryeditor_updating = {};

        queryeditor_context.state = state;

        if (changed.__loading && div_6_class_value !== (div_6_class_value = "loader " + (state.__loading ? '' : 'd-none'))) {
          div_6.className = div_6_class_value;
        }
      },

      u: function unmount() {
        detachNode(div);

        for (var i = 0; i < each_blocks.length; i += 1) {
          each_blocks[i].u();
        }

        for (var i = 0; i < each_1_blocks.length; i += 1) {
          each_1_blocks[i].u();
        }

        if_block.u();
      },

      d: function destroy() {
        destroyEach(each_blocks);

        removeListener(select, "change", select_change_handler);
        removeListener(select, "change", change_handler);

        destroyEach(each_1_blocks);

        removeListener(select_1, "change", select_1_change_handler);
        removeListener(button, "click", click_handler);
        if_block.d();
        removeListener(button_1, "click", click_handler_1);
        queryeditor.destroy(false);
        removeListener(button_2, "click", click_handler_2);
        removeListener(button_3, "click", click_handler_3);
        if (component.refs.canvascontainer === div_7) component.refs.canvascontainer = null;
        if (component.refs.canvas === canvas) component.refs.canvas = null;
      }
    };
  }

  // (6:8) {{#each __aggregateFunctionsKeys as key}}
  function create_each_block(state, __aggregateFunctionsKeys, key, key_index, component) {
    var option,
        option_value_value,
        text_value = state.__aggregateFunctions[key].name,
        text;

    return {
      c: function create() {
        option = createElement("option");
        text = createText(text_value);
        this.h();
      },

      h: function hydrate() {
        option.__value = option_value_value = key;
        option.value = option.__value;
      },

      m: function mount(target, anchor) {
        insertNode(option, target, anchor);
        appendNode(text, option);
      },

      p: function update(changed, state, __aggregateFunctionsKeys, key, key_index) {
        if (changed.__aggregateFunctionsKeys && option_value_value !== (option_value_value = key)) {
          option.__value = option_value_value;
        }

        option.value = option.__value;
        if ((changed.__aggregateFunctions || changed.__aggregateFunctionsKeys) && text_value !== (text_value = state.__aggregateFunctions[key].name)) {
          text.data = text_value;
        }
      },

      u: function unmount() {
        detachNode(option);
      },

      d: noop
    };
  }

  // (16:8) {{#each __chartFunctionsKeys as key}}
  function create_each_block_1(state, __chartFunctionsKeys, key_1, key_index_1, component) {
    var option,
        option_value_value,
        text_value = state.__chartFunctions[key_1].name,
        text;

    return {
      c: function create() {
        option = createElement("option");
        text = createText(text_value);
        this.h();
      },

      h: function hydrate() {
        option.__value = option_value_value = key_1;
        option.value = option.__value;
      },

      m: function mount(target, anchor) {
        insertNode(option, target, anchor);
        appendNode(text, option);
      },

      p: function update(changed, state, __chartFunctionsKeys, key_1, key_index_1) {
        if (changed.__chartFunctionsKeys && option_value_value !== (option_value_value = key_1)) {
          option.__value = option_value_value;
        }

        option.value = option.__value;
        if ((changed.__chartFunctions || changed.__chartFunctionsKeys) && text_value !== (text_value = state.__chartFunctions[key_1].name)) {
          text.data = text_value;
        }
      },

      u: function unmount() {
        detachNode(option);
      },

      d: noop
    };
  }

  // (24:6) {{#if __showQueryEditor}}
  function create_if_block(state, component) {
    var text;

    return {
      c: function create() {
        text = createText("Hide");
      },

      m: function mount(target, anchor) {
        insertNode(text, target, anchor);
      },

      u: function unmount() {
        detachNode(text);
      },

      d: noop
    };
  }

  // (24:35) {{else}}
  function create_if_block_1(state, component) {
    var text;

    return {
      c: function create() {
        text = createText("Show");
      },

      m: function mount(target, anchor) {
        insertNode(text, target, anchor);
      },

      u: function unmount() {
        detachNode(text);
      },

      d: noop
    };
  }

  function select_block_type(state) {
    if (state.__showQueryEditor) return create_if_block;
    return create_if_block_1;
  }

  function LogalyzerApp(options) {
    init(this, options);
    this.refs = {};
    this._state = assign(data(), options.data);
    this._recompute({ options: 1, selectors: 1, aggregateFunction: 1, chartFunction: 1 }, this._state);

    if (!document.getElementById("svelte-2868722327-style")) add_css();

    var _oncreate = oncreate.bind(this);

    if (!options._root) {
      this._oncreate = [_oncreate];
      this._beforecreate = [];
      this._aftercreate = [];
    } else {
      this._root._oncreate.push(_oncreate);
    }

    this._fragment = create_main_fragment(this._state, this);

    if (options.target) {
      this._fragment.c();
      this._fragment.m(options.target, options.anchor || null);

      this._lock = true;
      callAll(this._beforecreate);
      callAll(this._oncreate);
      callAll(this._aftercreate);
      this._lock = false;
    }
  }

  assign(LogalyzerApp.prototype, methods, {
    destroy: destroy,
    get: get,
    fire: fire,
    observe: observe,
    on: on,
    set: set,
    teardown: destroy,
    _set: _set,
    _mount: _mount,
    _unmount: _unmount
  });

  LogalyzerApp.prototype._recompute = function _recompute(changed, state) {
    if (changed.options || changed.selectors) {
      if (differs(state.query, state.query = query(state.options, state.selectors))) changed.query = true;
    }

    if (changed.aggregateFunction || changed.chartFunction || changed.options || changed.selectors) {
      if (differs(state.urlHashUpdate, state.urlHashUpdate = urlHashUpdate(state.aggregateFunction, state.chartFunction, state.options, state.selectors))) changed.urlHashUpdate = true;
    }
  };

  function setAttribute(node, attribute, value) {
    node.setAttribute(attribute, value);
  }

  function createElement(name) {
    return document.createElement(name);
  }

  function appendNode(node, target) {
    target.appendChild(node);
  }

  function assign(target) {
    var k,
        source,
        i = 1,
        len = arguments.length;
    for (; i < len; i++) {
      source = arguments[i];
      for (k in source) {
        target[k] = source[k];
      }
    }

    return target;
  }

  function createText(data) {
    return document.createTextNode(data);
  }

  function addListener(node, event, handler) {
    node.addEventListener(event, handler, false);
  }

  function setStyle(node, key, value) {
    node.style.setProperty(key, value);
  }

  function insertNode(node, target, anchor) {
    target.insertBefore(node, anchor);
  }

  function detachNode(node) {
    node.parentNode.removeChild(node);
  }

  function destroyEach(iterations) {
    for (var i = 0; i < iterations.length; i += 1) {
      if (iterations[i]) iterations[i].d();
    }
  }

  function removeListener(node, event, handler) {
    node.removeEventListener(event, handler, false);
  }

  function noop() {}

  function init(component, options) {
    component.options = options;

    component._observers = { pre: blankObject(), post: blankObject() };
    component._handlers = blankObject();
    component._root = options._root || component;
    component._yield = options._yield;
    component._bind = options._bind;
  }

  function callAll(fns) {
    while (fns && fns.length) {
      fns.pop()();
    }
  }

  function destroy(detach) {
    this.destroy = noop;
    this.fire('destroy');
    this.set = this.get = noop;

    if (detach !== false) this._fragment.u();
    this._fragment.d();
    this._fragment = this._state = null;
  }

  function get(key) {
    return key ? this._state[key] : this._state;
  }

  function fire(eventName, data) {
    var handlers = eventName in this._handlers && this._handlers[eventName].slice();
    if (!handlers) return;

    for (var i = 0; i < handlers.length; i += 1) {
      handlers[i].call(this, data);
    }
  }

  function observe(key, callback, options) {
    var group = options && options.defer ? this._observers.post : this._observers.pre;

    (group[key] || (group[key] = [])).push(callback);

    if (!options || options.init !== false) {
      callback.__calling = true;
      callback.call(this, this._state[key]);
      callback.__calling = false;
    }

    return {
      cancel: function cancel() {
        var index = group[key].indexOf(callback);
        if (~index) group[key].splice(index, 1);
      }
    };
  }

  function on(eventName, handler) {
    if (eventName === 'teardown') return this.on('destroy', handler);

    var handlers = this._handlers[eventName] || (this._handlers[eventName] = []);
    handlers.push(handler);

    return {
      cancel: function cancel() {
        var index = handlers.indexOf(handler);
        if (~index) handlers.splice(index, 1);
      }
    };
  }

  function set(newState) {
    this._set(assign({}, newState));
    if (this._root._lock) return;
    this._root._lock = true;
    callAll(this._root._beforecreate);
    callAll(this._root._oncreate);
    callAll(this._root._aftercreate);
    this._root._lock = false;
  }

  function _set(newState) {
    var oldState = this._state,
        changed = {},
        dirty = false;

    for (var key in newState) {
      if (differs(newState[key], oldState[key])) changed[key] = dirty = true;
    }
    if (!dirty) return;

    this._state = assign({}, oldState, newState);
    this._recompute(changed, this._state);
    if (this._bind) this._bind(changed, this._state);
    dispatchObservers(this, this._observers.pre, changed, this._state, oldState);
    this._fragment.p(changed, this._state);
    dispatchObservers(this, this._observers.post, changed, this._state, oldState);
  }

  function _mount(target, anchor) {
    this._fragment.m(target, anchor);
  }

  function _unmount() {
    this._fragment.u();
  }

  function differs(a, b) {
    return a !== b || a && (typeof a === 'undefined' ? 'undefined' : _typeof(a)) === 'object' || typeof a === 'function';
  }

  function blankObject() {
    return Object.create(null);
  }

  function dispatchObservers(component, group, changed, newState, oldState) {
    for (var key in group) {
      if (!changed[key]) continue;

      var newValue = newState[key];
      var oldValue = oldState[key];

      var callbacks = group[key];
      if (!callbacks) continue;

      for (var i = 0; i < callbacks.length; i += 1) {
        var callback = callbacks[i];
        if (callback.__calling) continue;

        callback.__calling = true;
        callback.call(component, newValue, oldValue);
        callback.__calling = false;
      }
    }
  }
  exports.default = LogalyzerApp;
});

/*jshint loopfunc:true*/
/*globals describe, it, expect, IOPS, sinon, afterEach, beforeEach, jasmine, window, console, spyOn, XDomainRequest, XMLHttpRequest*/
var GLOBAL = this;
var TOKEN = 'test_token';

function destroy() {
    IOPS.destroy('default');
    IOPS.destroy(TOKEN);
}

function mockXMLHttpRequests() {
    // Prevent requests
    this.xhr = sinon.useFakeXMLHttpRequest();

    // List requests
    var requestList = this.requestList = [];
    this.xhr.onCreate = function (request) {
        requestList.push(request);
    };
}

function addGetJson() {
    this.getXhrJson = function (xhrRequestId) {
        return JSON.parse(this.requestList[xhrRequestId].requestBody);
    };
}

function restoreXMLHttpRequests() {
    if (this.xhr) {
        this.xhr.restore();
    }
}

describe('construction', function () {
    it('with string', function () {
        expect(IOPS.init({
            token: TOKEN,
            region: 'eu'
        })).toBe(true);
    });

    it('with object', function () {
        expect(IOPS.init({
            token: TOKEN,
            region: 'eu'
        })).toBe(true);
    });

    // TODO: Test Raul's multi logger

    describe('fails', function () {
        it('without token', function () {
            expect(IOPS.init).toThrow("Invalid parameters for init()");
        });

        it('without token (object)', function () {
            expect(function () {
                IOPS.init({});
            }).toThrow("Token not present.");
        });
    });

    afterEach(destroy);
});

describe('sending messages', function () {
    beforeEach(mockXMLHttpRequests);
    beforeEach(addGetJson);
    beforeEach(function () {
        IOPS.init({
            token: TOKEN,
            trace: true,
            region: 'eu'
        });
    });

    it('logs null values', function () {
        IOPS.log(null);

        expect(this.getXhrJson(0).event).toBe(null);
    });

    it('logs undefined values', function () {
        IOPS.log(undefined);

        expect(this.getXhrJson(0).event).toBe('undefined');
    });

    it('logs object with nullish properties', function () {
        IOPS.log({
            undef: undefined,
            nullVal: null
        });

        var event = this.getXhrJson(0).event;
        expect(event.undef).toBe('undefined');
        expect(event.nullVal).toBe(null);
    });

    it('logs array with nullish values', function () {
        IOPS.log([
            undefined,
            null
        ]);

        var event = this.getXhrJson(0).event;
        expect(event[0]).toBe('undefined');
        expect(event[1]).toBe(null);
    });

    it('sends trace code', function () {
        IOPS.log('test');

        var trace = this.getXhrJson(0).trace;
        expect(trace).toEqual(jasmine.any(String));
        expect(trace.length).toBe(8);
    });

    it('accepts multiple arguments', function () {
        var args = ['test', 1, undefined];

        IOPS.log.apply(IOPS, args);

        var event = this.getXhrJson(0).event;
        expect(event.length).toBe(3);
        expect(event[0]).toBe(args[0]);
        expect(event[1]).toBe(args[1]);
        expect(event[2]).toBe('undefined');
    });

    afterEach(destroy);
});

describe('sends log level', function () {
    beforeEach(mockXMLHttpRequests);
    beforeEach(addGetJson);
    beforeEach(function () {
        IOPS.init({
            token: TOKEN,
            region: 'eu'
        });
    });

    var methods = [
        'log',
        'info',
        'warn',
        'error'
    ];

    for (var i = 0; i < methods.length; i++) {
        var method = methods[i];
        var level = method.toUpperCase();

        it(level, function (method, level) {
            return function () {
                IOPS[method]('test');
                expect(this.getXhrJson(0).level).toBe(level);
            };
        }(method, level));
    }

    it('excludes cyclic values', function () {
        var a = {};
        a.b = a;

        IOPS.log(a);

        expect(this.getXhrJson(0).event.b).toBe('<?>');
    });

    afterEach(restoreXMLHttpRequests);
    afterEach(destroy);
});

describe('sending user agent data', function () {
    beforeEach(mockXMLHttpRequests);
    beforeEach(addGetJson);

    function checkAgentInfo(agent) {
        expect(agent).toBeDefined();

        // Perhaps these could be filled in since we're running in a
        // real browser now?
        expect(agent.url).toBeDefined();
        expect(agent.referrer).toBeDefined();
        expect(agent.screen).toBeDefined();
        expect(agent.window).toBeDefined();
        expect(agent.browser).toBeDefined();
        expect(agent.platform).toBeDefined();
    }

    it('page_info: never - never sends log data', function () {
        IOPS.init({
            token: TOKEN,
            page_info: 'never',
            region: 'eu'
        });

        IOPS.log('hi');

        var data = this.getXhrJson(0);

        expect(data.event).toBe('hi');
        expect(this.getXhrJson(0).agent).toBeUndefined();
    });

    it('page_info: per-entry - sends log data for each log', function () {
        IOPS.init({
            token: TOKEN,
            page_info: 'per-entry',
            region: 'eu'
        });

        IOPS.log('hi');

        // Check data is sent the first time
        checkAgentInfo(this.getXhrJson(0).event);

        // Respond to first request so that the 2nd request will be made
        this.requestList[0].respond();

        expect(this.getXhrJson(1).event).toBe('hi');

        IOPS.log('hi again');
        this.requestList[1].respond();

        // Check that page info is sent subsequent times
        checkAgentInfo(this.getXhrJson(2).event);

        this.requestList[2].respond();

        expect(this.getXhrJson(3).event).toBe('hi again');
    });

    it('page_info: per-page - always sends data for each log', function () {
        IOPS.init({
            token: TOKEN,
            page_info: 'per-page',
            region: 'eu'
        });

        IOPS.log('hi');

        // Check data is sent the first time
        checkAgentInfo(this.getXhrJson(0).event);

        // Respond to first request so that the 2nd request will be made
        this.requestList[0].respond();

        expect(this.getXhrJson(1).event).toBe('hi');

        IOPS.log('hi again');
        this.requestList[1].respond();

        // Check that no data is sent subsequent times
        expect(this.getXhrJson(2).event).toBe('hi again');
    });

    afterEach(destroy);
});

describe('catch all option', function () {
    beforeEach(mockXMLHttpRequests);
    beforeEach(function () {
        this.oldErrorHandler = sinon.stub(GLOBAL, 'onerror')
            .returns(true);
    });

    it('assigns onerror handler', function () {
        IOPS.init({
            token: TOKEN,
            catchall: true,
            region: 'eu'
        });
        // Don't test if onerror is set because #1 we've got a stub
        // and 2nd, karma has its handler.
        expect(GLOBAL.onerror).not.toBe(this.oldErrorHandler);
    });

    it('sends errors', function () {
        // Don't care what happens to this, just ignore the error
        IOPS.init({
            token: TOKEN,
            catchall: true,
            region: 'eu'
        });

        // Check if onerror handler is not the stub from above
        expect(GLOBAL.onerror).not.toBe(this.oldErrorHandler);

        expect(this.requestList.length).toBe(0);

        // Pretend to trigger an error like the browser might
        GLOBAL.onerror('Script error', 'http://example.com', 0);

        expect(this.requestList.length).toBe(1);
    });

    it('bubbles onerror calls', function () {
        IOPS.init({
            token: TOKEN,
            catchall: true,
            region: 'eu'
        });

        // Pretend to trigger an error like the browser might
        GLOBAL.onerror('Script error', 'http://example.com', 0);

        expect(this.oldErrorHandler.calledOnce).toBe(true);
    });

    afterEach(function () {
        if (this.oldErrorHandler.restore) {
            this.oldErrorHandler.restore();
        }
    });
    afterEach(restoreXMLHttpRequests);
    afterEach(destroy);
});

describe('destroys log streams', function () {
    it('default', function () {
        IOPS.init({
                token: TOKEN,
                region: 'eu'
        });
        IOPS.destroy();

        expect(function () {
            IOPS.init({
                token: TOKEN,
                region: 'eu'
            });
        }).not.toThrow();
    });

    it('custom name', function () {
        IOPS.init({
            token: TOKEN,
            name: 'test',
            region: 'eu'
        });
        IOPS.destroy('test');

        expect(function () {
            IOPS.init({
                token: TOKEN,
                name: 'test',
                region: 'eu'
            });
        }).not.toThrow();
        IOPS.destroy('test');
    });

    afterEach(destroy);
});

describe('tests for SSL', function () {
    beforeEach(mockXMLHttpRequests);
    beforeEach(addGetJson);

    it('SSL option set to true leads to \"https\"', function () {
        IOPS.init({
            token: TOKEN,
            name: 'test',
            ssl: true,
            region: 'eu'
        });
        IOPS.log("Test");
        var url = this.requestList[0].url;
        expect(url.indexOf('https') === 0).toBe(true);
        IOPS.destroy('test');
    });

    it('SSL option set to false leads to \"http\"', function () {
        IOPS.init({
            token: TOKEN,
            name: 'test',
            ssl: false,
            region: 'eu'
        });
        IOPS.log("Test");
        var url = this.requestList[0].url;
        expect(url.indexOf("https") === -1).toBe(true);
        expect(url.indexOf("http") === 0).toBe(true);
        IOPS.destroy('test');
    });

    it('SSL option not set leads to \"https\"', function () {
        IOPS.init({
            token: TOKEN,
            name: 'test',
            region: 'eu'
        });
        IOPS.log("Test");
        var url = this.requestList[0].url;
        expect(url.indexOf("https") === 0).toBe(true);
        IOPS.destroy('test');
    });
});

describe('tests for region', function () {
    beforeEach(mockXMLHttpRequests);
    beforeEach(addGetJson);

    it('Setting the region to each of the allowed values adds that region to the url', function () {
        var regions = ["eu", "us", "ca", "ap", "au"];
        regions.forEach(function (region) {
            mockXMLHttpRequests();
            IOPS.init({
                token: TOKEN,
                name: 'test' + region,
                region: region
            });
            IOPS.log("Test");
            var url = this.requestList[0].url;
            expect(url.indexOf('/' + region + '.') === 7).toBe(true, "Expected " + region +
                                        " in the url, got: " + url.substring(7,9));
            IOPS.destroy('test' + region);
        });
    });

    it('Not setting the region throws error "No region defined"', function () {
        try {
            IOPS.init({
                token: TOKEN,
                name: 'test'
            });
            done.fail();
        } catch(e) {
            expect(e).toBe("No region defined");
        }
        IOPS.destroy('test');
    });

    it('Setting the region to an unrecognised value throws error "Unrecognised region"', function () {
        try {
            IOPS.init({
                token: TOKEN,
                name: 'test',
                region: 'random_region'
            });
            done.fail();
        } catch(e) {
            expect(e).toBe("Unrecognised region");
        }
        IOPS.destroy('test');
    });
});

describe('no_format option', function () {
    beforeEach(mockXMLHttpRequests);
    beforeEach(addGetJson);

    it('Should send data to noformat if no format is enabled', function () {
        IOPS.init({
            token: TOKEN,
            no_format: true,
            region: 'eu'
        });
        IOPS.log('some message');
        var url = this.requestList[0].url;
        expect(url).toContain("noformat");
    });

    it('Should send data to js if no format is disabled', function () {
        IOPS.init({
            token: TOKEN,
            no_format: false,
            region: 'eu'
        });
        IOPS.log('some message');
        var url = this.requestList[0].url;
        expect(url).toContain("v1");
    });

    afterEach(restoreXMLHttpRequests);
    afterEach(destroy);
});


describe('custom endpoint', function () {
    beforeEach(mockXMLHttpRequests);
    beforeEach(addGetJson);
    beforeEach(function () {
        window.IOPSENDPOINT = 'somewhere1.com/custom-logging';
        IOPS.init({
            token: TOKEN,
            region: 'eu'
        });
    });

    it('can be set', function () {
        IOPS.log('some message');
        var lastReq = this.requestList[0];
        expect(lastReq.url).toBe('https://eu.somewhere1.com/custom-logging/logs/test_token');
    });

    afterEach(restoreXMLHttpRequests);
    afterEach(destroy);
});

describe('print option', function () {
    beforeEach(mockXMLHttpRequests);
    beforeEach(function () {
        spyOn(console, 'log');
        spyOn(console, 'info');
        spyOn(console, 'warn');
        spyOn(console, 'error');
        IOPS.init({
            token: TOKEN,
            print: true,
            region: 'eu'
        });
    });

    it('should log to console also', function () {
        IOPS.log('some message');
        expect(console.log.mostRecentCall.args[0].trace).toMatch(/[0-9a-z]{8}/);
        expect(console.log.mostRecentCall.args[0].event).toEqual('some message');
        expect(console.log.mostRecentCall.args[0].level).toEqual('LOG');
    });

    it('below IE9 should stringify console messages', function () {
        /*jshint -W020 */
        XDomainRequest = XMLHttpRequest; //trick into thinking we are in IE8/9 browser
        /*jshint +W020 */
        IOPS.log('some message');
        expect(console.log.mostRecentCall.args[0]).toMatch(/[0-9a-z]{8} some message/);
    });

    afterEach(restoreXMLHttpRequests);
    afterEach(destroy);
});

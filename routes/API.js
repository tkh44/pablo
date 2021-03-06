
var redis = require("redis"),
    client = redis.createClient();

exports.crossSiteSettings = function(request, response, next) {
    response.set({
        "Access-Control-Allow-Origin" : "*",
        "Access-Control-Allow-Headers": "origin,content-Type,x-requested-with"
    });
    next();
};

exports.post = function(request, response) {
    var token = request.params.token,
        now = Date.now();

    client.incr(token + ":id", function(error, newId){
        var id = newId,
            hashKey = token + ":" + id + ":data",
            rBody = request.body;
        //These values are based on the chart found here: https://dvcs.w3.org/hg/webperf/raw-file/tip/specs/NavigationTiming/Overview.html#processing-model
        client.hmset(hashKey, {
            "time" :            now,
            "path" :            request.path,
            "host" :            request.host,
            "url"  :            request.url,
            "ip"   :            request.ip,
            "totalDuration" :   rBody.loadEventEnd - rBody.navigationStart,
            "redirect" :        rBody.redirectEnd - rBody.redirectStart,
            "appCache" :        rBody.domainLookupStart - rBody.fetchStart,
            "dns" :             rBody.domainLookupEnd - rBody.domainLookupStart,
            "tcp" :             rBody.connectEnd - rBody.connectStart,
            "request" :         rBody.responseStart - rBody.requestStart,
            "response" :        rBody.responseEnd - rBody.responseStart,
            "processing" :      rBody.domComplete - rBody.domLoading,
            "load" :            rBody.loadEventEnd - rBody.loadEventStart
        });

        client.zadd(token + ":sortedId", now, id);
    });
    response.end();
};

exports.get = function(request, response) {
    var token =     request.params.token,
        startTime = request.params.startTime || 0,
        endTime =   request.params.endTime || Date.now(); //You shouldn't have data in the future.  Are timezones an issue?

    var dataSet = "" + token + ":sortedId";

    client.zrangebyscore(dataSet, startTime, endTime, function(error, results) {
        var multi = client.multi();

        for (var x = 0; x < results.length; x++){
            var queryString = token + ":" + results[x] + ":data";
            multi.hgetall(queryString);
        }

        multi.exec(function(error, replies){
            response.json(replies);
        });
    });
};

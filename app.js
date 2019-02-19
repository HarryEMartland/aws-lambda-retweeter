const Twitter = require('twitter');
const moment = require('moment');
const AWS = require('aws-sdk');

const env = process.env;
const SINCE_TIME_DURATION = env.SINCE_TIME_DURATION || 1;
const SINCE_TIME_UNIT = env.SINCE_TIME_UNIT || "hours";
const QUERIES = env.QUERIES.split(',');
const SCREEN_NAME_BLACKLIST = (env.SCREEN_NAME_BLACKLIST||"").split(',');

const client = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

const comprehend = new AWS.Comprehend();

exports.handler = function (event, context, callback) {

    return Promise.all(QUERIES.map(search)
        .map(retweet))
        .catch(function (error) {
            console.error(error);
            callback(error, null);
        })
        .then(function () {
            callback(null, null);
        });
};

function search(query) {
    return client.get('search/tweets', {q: query, count: 100})
        .then(function (tweets) {
            return tweets.statuses.filter(function (tweet) {
                tweet.created_at = moment(tweet.created_at, "ddd MMM DD HH:mm:ss ZZ YYYY");
                return tweet.created_at.isAfter(moment().subtract(SINCE_TIME_DURATION, SINCE_TIME_UNIT));
            }).filter(tweet=>{
                return !SCREEN_NAME_BLACKLIST.includes(tweet.user.screen_name)
            });
        });
}

function retweet(promise) {
    return promise.then(function (tweets) {

        if(tweets.length === 0){
            return Promise.resolve()
        }

        const params = {LanguageCode: "en", TextList: tweets.map(function(tweet) {
                return tweet.text;
            })};

        return comprehend.batchDetectSentiment(params).promise()
            .then(response => {
                response.ResultList.forEach(result=>{tweets[result.Index].sentiment = result.Sentiment})

                return Promise.all(tweets.filter(tweet=>tweet.sentiment==='POSITIVE').map(function (tweet) {
                    return client.post('statuses/retweet/' + tweet.id_str, {})
                        .then(function () {
                            console.log(tweet.id_str, tweet.created_at, tweet.text, tweet.sentiment);
                            console.log(JSON.stringify({tweetCount:1}))
                        })
                        .catch(console.error)
                }))
            });

    })
}
